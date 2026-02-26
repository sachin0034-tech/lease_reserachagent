import asyncio
import json
import logging
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.schemas.insight_card import CARD_TOPICS
from app.services.file_extract import extract_text_from_file
from app.services.openai_summary import summarize_with_openai
from app.services.research_agent import (
    answer_chat,
    create_custom_card_from_topic,
    edit_insight_card_with_llm,
    get_dashboard_summary,
    run_card_batch,
)
from app.services.session_store import SessionStore
from app.services.supabase_access import (
    SupabaseNotConfiguredError,
    decrement_user_credits,
    get_user_credits,
    is_user_allowed,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["analyze"])

# In-memory store for the latest submission (for debugging / step-by-step flow)
_latest_analyze_payload: dict | None = None

# Shared session store (SQLite under $HOME by default; safe across workers on same instance)
_session_store = SessionStore.from_env()

BATCH_SIZE = 5


@router.post("/analyze")
async def submit_analyze(
    analyze_as: str = Form(...),
    property_name: str = Form(...),
    address: str = Form(...),
    leasable_area: str = Form(...),
    current_base_rent: str = Form(...),
    files: list[UploadFile] = File(default=[]),
):
    """
    Receive frontend form data and optional files.
    If files are present: extract text from PDF/DOCX and run OpenAI summary on the combined text.
    """
    global _latest_analyze_payload

    payload = {
        "analyze_as": analyze_as,
        "property_name": property_name,
        "address": address,
        "leasable_area": leasable_area,
        "current_base_rent": current_base_rent,
        "file_names": [],
        "extracted_texts": {},
        "openai_summary": None,
    }

    logger.info("Received /api/analyze request: role=%s, property=%s, files=%d", analyze_as, property_name, len(files))

    if files:
        combined_text_parts = []
        for f in files:
            if not f.filename:
                continue
            # Read raw binary content (FastAPI UploadFile)
            content: bytes = await f.read()
            payload["file_names"].append(f.filename)
            logger.info("Read file %s: %d bytes (content_type=%s)", f.filename, len(content), f.content_type or "unknown")
            text = extract_text_from_file(content, f.filename)
            payload["extracted_texts"][f.filename] = text
            combined_text_parts.append(f"--- {f.filename} ---\n{text}")
            logger.info("Extracted text from %s: %d chars", f.filename, len(text))

        if combined_text_parts:
            combined = "\n\n".join(combined_text_parts)
            logger.info("Calling OpenAI for summary (combined %d chars)", len(combined))
            summary_result = summarize_with_openai(combined)
            payload["openai_summary"] = summary_result
            if summary_result.get("error"):
                logger.warning("OpenAI summary error: %s", summary_result["error"])
            else:
                logger.info("OpenAI summary: %s", summary_result.get("summary", "")[:200])
    else:
        logger.info("No files uploaded; skipping text extraction and OpenAI")

    _latest_analyze_payload = payload

    return {
        "ok": True,
        "message": "Payload received and stored",
        "received": {
            "analyze_as": payload["analyze_as"],
            "property_name": payload["property_name"],
            "file_count": len(payload["file_names"]),
            "extracted_file_count": len(payload["extracted_texts"]),
            "openai_used": payload["openai_summary"] is not None,
        },
        "openai_summary": payload["openai_summary"],
    }


@router.get("/analyze/latest")
def get_latest_analyze():
    """
    Return the last stored analyze payload (for debugging).
    """
    if _latest_analyze_payload is None:
        raise HTTPException(status_code=404, detail="No analyze payload stored yet")
    return {"payload": _latest_analyze_payload}


# --- Streaming research flow: start session, then stream cards in batches of 5 ---


@router.post("/analyze/start")
async def analyze_start(
    analyze_as: str = Form(...),
    property_name: str = Form(...),
    address: str = Form(...),
    leasable_area: str = Form(...),
    current_base_rent: str = Form(...),
    document_text: str | None = Form(default=None),
    files: list[UploadFile] = File(default=[]),
    llm_provider: str = Form(default="openai"),
    username: str | None = Form(default=None),
):
    """
    Step 1: Submit form + either document_text (paste) or files. Backend uses text or extracts
    from files to build document_context, stores in session. Returns session_id.
    """
    session_id = str(uuid.uuid4())
    provider_normalized = (llm_provider or "openai").strip().lower()
    if provider_normalized not in {"openai", "anthropic"}:
        provider_normalized = "openai"
    logger.info("[analyze/start] New session_id=%s role=%s property=%s", session_id, analyze_as, property_name)

    username_normalized = (username or "").strip()
    if username_normalized:
        try:
            if not is_user_allowed(username_normalized):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access yet. Please request access before logging in.",
                )
            current_credits = get_user_credits(username_normalized)
            if current_credits is not None:
                if current_credits < 2:
                    raise HTTPException(
                        status_code=403,
                        detail="Your credits are exhausted. Please contact the team for more credits.",
                    )
                remaining = decrement_user_credits(username_normalized, 2)
                logger.info(
                    "[analyze/start] Deducted 2 credits for %s (remaining=%s)",
                    username_normalized,
                    remaining,
                )
        except SupabaseNotConfiguredError:
            logger.warning("[analyze/start] Supabase not configured; skipping credit checks.")

    document_context = None
    if document_text and document_text.strip():
        document_context = document_text.strip()
        logger.info("[analyze/start] Document context from text: %s chars", len(document_context))
    elif files:
        combined_text_parts = []
        for f in files:
            if not f.filename:
                continue
            content: bytes = await f.read()
            logger.debug("[analyze/start] Read file %s %s bytes", f.filename, len(content))
            text = extract_text_from_file(content, f.filename)
            combined_text_parts.append(f"--- {f.filename} ---\n{text}")
        if combined_text_parts:
            document_context = "\n\n".join(combined_text_parts)
            logger.info("[analyze/start] Document context from files: %s chars", len(document_context))

    session_data = {
        "analyze_as": analyze_as,
        "property_name": property_name,
        "address": address,
        "leasable_area": leasable_area,
        "current_base_rent": current_base_rent,
        "document_context": document_context,
        "llm_provider": provider_normalized,
        "username": username_normalized if username_normalized else None,
    }
    _session_store.put(session_id, session_data)
    logger.info(
        "[analyze/start] Session stored. llm_provider=%s",
        provider_normalized,
    )
    return {"ok": True, "session_id": session_id}


async def _stream_analysis(session_id: str):
    """Generator: yield ndjson lines (progress + cards_batch + dashboard + done)."""
    session = _session_store.get(session_id)
    if not session:
        yield json.dumps({"type": "error", "message": "Session not found"}) + "\n"
        return

    ctx = session
    total_topics = len(CARD_TOPICS)
    all_cards: list[dict] = []
    seen_titles: set[str] = set()
    logger.info(
        "[analyze/stream] Starting stream for session_id=%s total_topics=%s llm_provider=%s",
        session_id,
        total_topics,
        ctx.get("llm_provider", "openai"),
    )

    for batch_start in range(0, total_topics, BATCH_SIZE):
        batch_topics = CARD_TOPICS[batch_start : batch_start + BATCH_SIZE]
        batch_index = batch_start // BATCH_SIZE + 1
        logger.debug("[analyze/stream] Batch %s: %s", batch_index, batch_topics)

        # Use streaming version for real-time progress
        from app.services.research_agent import run_card_batch_streaming

        cards, progress_messages = await run_card_batch_streaming(
            analyze_as=ctx["analyze_as"],
            property_name=ctx["property_name"],
            address=ctx["address"],
            leasable_area=ctx["leasable_area"],
            current_base_rent=ctx["current_base_rent"],
            document_context=ctx.get("document_context"),
            card_topics_batch=batch_topics,
            batch_index=batch_index,
            llm_provider=ctx.get("llm_provider", "openai"),
        )

        # Stream all progress messages in real-time
        for topic, message in progress_messages:
            yield json.dumps({"type": "progress", "message": message, "topic": topic}) + "\n"
        # Deduplicate by title (case-insensitive): keep first occurrence only
        unique_cards = []
        for c in cards:
            title_key = (c.get("title") or "").strip().lower()
            if title_key and title_key not in seen_titles:
                seen_titles.add(title_key)
                unique_cards.append(c)
        all_cards.extend(unique_cards)
        logger.info("[analyze/stream] Batch %s returned %s cards, %s unique", batch_index, len(cards), len(unique_cards))
        if unique_cards:
            yield json.dumps({"type": "cards", "cards": unique_cards, "batch_index": batch_index}) + "\n"

    dashboard_data = await asyncio.to_thread(
        get_dashboard_summary,
        property_name=ctx["property_name"],
        address=ctx["address"],
        leasable_area=ctx["leasable_area"],
        current_base_rent=ctx["current_base_rent"],
        document_context=ctx.get("document_context"),
        cards=all_cards,
        llm_provider=ctx.get("llm_provider", "openai"),
    )
    _session_store.patch(session_id, {"dashboard_summary": dashboard_data, "cards": all_cards})
    payload = {
        **dashboard_data,
        "property": {
            "name": ctx["property_name"],
            "address": ctx["address"],
            "leasable_area": ctx["leasable_area"],
            "current_base_rent": ctx["current_base_rent"],
        },
    }
    yield json.dumps({"type": "dashboard", "data": payload}) + "\n"
    yield json.dumps({"type": "done"}) + "\n"
    logger.info("[analyze/stream] Stream done for session_id=%s", session_id)


@router.get("/analyze/stream")
async def analyze_stream(session_id: str):
    """
    Step 2: Stream insight cards in batches of 5, then dashboard summary, then done.
    Events are ndjson: { "type": "progress"|"cards"|"dashboard"|"done", ... }
    """
    logger.info("[analyze/stream] GET stream session_id=%s", session_id)
    return StreamingResponse(
        _stream_analysis(session_id),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/analyze/dashboard")
def get_analyze_dashboard(session_id: str):
    """Return stored dashboard summary + property + cards for the final dashboard page."""
    session = _session_store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "property": {
            "name": session["property_name"],
            "address": session["address"],
            "leasable_area": session["leasable_area"],
            "current_base_rent": session["current_base_rent"],
        },
        "dashboard_summary": session.get("dashboard_summary"),
        "cards": session.get("cards", []),
    }


class ChatRequest(BaseModel):
    session_id: str
    message: str
    llm_provider: str | None = None
    llm_model: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class CreditsResponse(BaseModel):
    username: str
    credits: int | None


class CustomCardCreateRequest(BaseModel):
    session_id: str
    prompt: str


class CustomCardEditRequest(BaseModel):
    session_id: str
    prompt: str
    source: str  # "validation" or "custom"


@router.post("/analyze/chat")
def analyze_chat(body: ChatRequest):
    """
    Chat with the Research Agent. Uses full session context (property, documents, dashboard, cards).
    Returns a concise, to-the-point reply from the configured LLM provider and model.
    """
    session = _session_store.get(body.session_id)
    if not session:
        # Instead of 404, return a friendly message so the UI doesn't break when sessions expire
        return {
            "reply": (
                "Your analysis session has expired or was cleared on the server. "
                "Run a new analysis from the form to chat with full context (property, documents, and insights)."
            )
        }
    message = (body.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    if body.llm_provider:
        provider_normalized = body.llm_provider.strip().lower()
        if provider_normalized not in {"openai", "anthropic"}:
            provider_normalized = "openai"
        _session_store.patch(body.session_id, {"llm_provider": provider_normalized})
    logger.info(
        "[analyze/chat] session_id=%s message_len=%s llm_provider=%s",
        body.session_id,
        len(message),
        (body.llm_provider or session.get("llm_provider", "openai")),
    )
    reply = answer_chat(session, message)
    return {"reply": reply}


@router.post("/login")
def login(body: LoginRequest):
    """
    Basic login gate backed by Supabase.

    - Checks whether the given username exists in the configured Supabase table.
    - If the user is not present, returns 403 so the frontend can show a toast
      asking them to request access.
    - Password is accepted but not yet validated against Supabase auth; add
      real password / SSO verification here when ready.
    """
    username = (body.username or "").strip()
    password = (body.password or "").strip()

    if not username or not password:
        raise HTTPException(status_code=400, detail="username and password are required")

    try:
        allowed = is_user_allowed(username)
    except SupabaseNotConfiguredError as exc:
        logger.error("Supabase not configured; rejecting login attempt for %s", username)
        raise HTTPException(
            status_code=503,
            detail="Login is temporarily unavailable; please contact the team to configure access.",
        ) from exc

    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="You don't have access yet. Please request access before logging in.",
        )

    # At this stage, we only gate on presence in Supabase; real auth can be added later.
    return {"ok": True}


@router.get("/user/credits", response_model=CreditsResponse)
def get_user_credits_api(username: str):
    """
    Return the current credit balance for the given username.
    """
    username_normalized = (username or "").strip()
    if not username_normalized:
        raise HTTPException(status_code=400, detail="username is required")
    try:
        allowed = is_user_allowed(username_normalized)
    except SupabaseNotConfiguredError as exc:
        logger.error("Supabase not configured; cannot fetch credits for %s", username_normalized)
        raise HTTPException(
            status_code=503,
            detail="Credits are temporarily unavailable; please contact the team.",
        ) from exc
    if not allowed:
        raise HTTPException(status_code=403, detail="User does not have access.")
    credits = get_user_credits(username_normalized)
    return CreditsResponse(username=username_normalized, credits=credits)


@router.get("/custom-cards")
def get_custom_cards(session_id: str):
    """
    Return all custom cards stored for a session.
    """
    session = _session_store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"cards": session.get("custom_cards", [])}


@router.post("/custom-cards")
def create_custom_card(body: CustomCardCreateRequest):
    """
    Create a new custom insight card for the given session and user prompt.
    """
    session = _session_store.get(body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    prompt = (body.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    try:
        card = create_custom_card_from_topic(session, prompt)
    except Exception as exc:
        logger.warning("[custom-cards] Error creating custom card: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create custom card") from exc

    existing = session.get("custom_cards") or []
    if not isinstance(existing, list):
        existing = []
    existing.append(card)
    _session_store.patch(body.session_id, {"custom_cards": existing})
    index = len(existing) - 1
    return {"card": card, "index": index}


async def _stream_custom_card(session_id: str, prompt: str):
    """
    Generator: starts the LLM call in a background thread, then streams
    rolling progress messages every ~3 s so the frontend animation stays
    alive for the full duration of the LLM call (~20-40 s).
    """
    session = _session_store.get(session_id)
    if not session:
        yield json.dumps({"type": "error", "message": "Session not found"}) + "\n"
        return

    # Kick off the LLM in a background thread immediately
    llm_task = asyncio.create_task(
        asyncio.to_thread(create_custom_card_from_topic, session, prompt)
    )

    # Rolling progress messages — cycled until the LLM finishes
    thinking_steps = [
        "Reviewing lease context and property details…",
        "Searching for comparable market data…",
        "Querying recent transaction comps…",
        "Analyzing vacancy and demand trends…",
        "Cross-referencing benchmark figures…",
        "Evaluating negotiation leverage signals…",
        "Structuring insight card fields…",
        "Validating data evidence…",
        "Finalising card content…",
    ]
    step_index = 0

    # Stream a progress tick every 3 s while LLM is running
    while not llm_task.done():
        msg = thinking_steps[step_index % len(thinking_steps)]
        yield json.dumps({"type": "progress", "message": msg}) + "\n"
        step_index += 1
        # Wait up to 3 s, but bail early if task finishes
        try:
            await asyncio.wait_for(asyncio.shield(llm_task), timeout=3.0)
            break  # task completed within this window
        except asyncio.TimeoutError:
            pass  # still running — loop and emit next progress line
        except Exception:
            break  # real error — handled below

    # Collect result
    try:
        card = await llm_task
    except Exception as exc:
        logger.warning("[custom-cards/stream] Error: %s", exc)
        yield json.dumps({"type": "error", "message": "Failed to create custom card"}) + "\n"
        return

    existing = session.get("custom_cards") or []
    if not isinstance(existing, list):
        existing = []
    existing.append(card)
    _session_store.patch(session_id, {"custom_cards": existing})
    index = len(existing) - 1

    yield json.dumps({"type": "done", "card": card, "index": index}) + "\n"


@router.post("/custom-cards/stream")
async def create_custom_card_stream(body: CustomCardCreateRequest):
    """
    Streaming version of custom card creation.
    Yields ndjson: progress messages then a final done event with the card.
    Deducts 1 credit from the user's balance.
    """
    session = _session_store.get(body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    prompt = (body.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    # Deduct 1 credit for creating a custom card
    username = session.get("username")
    if username:
        try:
            current_credits = get_user_credits(username)
            if current_credits is not None:
                if current_credits < 1:
                    raise HTTPException(
                        status_code=403,
                        detail="Insufficient credits. You need at least 1 credit to create a custom card.",
                    )
                remaining = decrement_user_credits(username, 1)
                logger.info(
                    "[custom-cards/stream] Deducted 1 credit for %s (remaining=%s)",
                    username,
                    remaining,
                )
        except SupabaseNotConfiguredError:
            logger.warning("[custom-cards/stream] Supabase not configured; skipping credit checks.")

    return StreamingResponse(
        _stream_custom_card(body.session_id, prompt),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/custom-cards/{card_index}/edit")
def edit_custom_card(card_index: int, body: CustomCardEditRequest):
    """
    Edit an existing insight card (validation or custom) using an LLM.
    """
    session = _session_store.get(body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    prompt = (body.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    source = (body.source or "").strip().lower()
    if source not in {"validation", "custom"}:
        raise HTTPException(status_code=400, detail="source must be 'validation' or 'custom'")

    key = "cards" if source == "validation" else "custom_cards"
    cards_list = session.get(key) or []
    if not isinstance(cards_list, list) or not (0 <= card_index < len(cards_list)):
        raise HTTPException(status_code=404, detail="Card not found")

    original = cards_list[card_index]
    try:
        updated = edit_insight_card_with_llm(session, original, prompt)
    except Exception as exc:
        logger.warning("[custom-cards] Error editing card at index %s: %s", card_index, exc)
        raise HTTPException(status_code=500, detail="Failed to edit card") from exc

    cards_list[card_index] = updated
    _session_store.patch(body.session_id, {key: cards_list})
    return {"card": updated, "index": card_index, "source": source}


async def _stream_edit_card(session_id: str, card_index: int, prompt: str, source: str):
    """
    Streaming generator for card editing — keeps animation alive while LLM runs.
    Yields ndjson: progress events, then a final done event with old + new card.
    NOTE: does NOT persist the updated card — the frontend shows a diff and the
    user must confirm before the card is saved (via a separate confirm call).
    """
    session = _session_store.get(session_id)
    if not session:
        yield json.dumps({"type": "error", "message": "Session not found"}) + "\n"
        return

    key = "cards" if source == "validation" else "custom_cards"
    cards_list = session.get(key) or []
    if not isinstance(cards_list, list) or not (0 <= card_index < len(cards_list)):
        yield json.dumps({"type": "error", "message": "Card not found"}) + "\n"
        return

    original = cards_list[card_index]

    llm_task = asyncio.create_task(
        asyncio.to_thread(edit_insight_card_with_llm, session, original, prompt)
    )

    thinking_steps = [
        "Reading original card context…",
        "Analysing your refinement request…",
        "Searching for supporting market data…",
        "Cross-referencing lease benchmarks…",
        "Drafting updated insight…",
        "Revising data evidence…",
        "Updating negotiation context…",
        "Recalculating confidence score…",
        "Finalising revised card…",
    ]
    step_index = 0

    while not llm_task.done():
        msg = thinking_steps[step_index % len(thinking_steps)]
        yield json.dumps({"type": "progress", "message": msg}) + "\n"
        step_index += 1
        try:
            await asyncio.wait_for(asyncio.shield(llm_task), timeout=3.0)
            break
        except asyncio.TimeoutError:
            pass
        except Exception:
            break

    try:
        updated = await llm_task
    except Exception as exc:
        logger.warning("[edit/stream] Error editing card %s: %s", card_index, exc)
        yield json.dumps({"type": "error", "message": "Failed to update card"}) + "\n"
        return

    # Return both cards for the diff view — do NOT persist yet
    yield json.dumps({
        "type": "done",
        "original": original,
        "updated": updated,
        "index": card_index,
        "source": source,
    }) + "\n"


@router.post("/custom-cards/{card_index}/edit/stream")
async def edit_custom_card_stream(card_index: int, body: CustomCardEditRequest):
    """
    Streaming edit: yields progress messages then a done event with old + new card.
    The client shows a diff and must POST to /confirm to actually save.
    """
    session = _session_store.get(body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    prompt = (body.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")
    source = (body.source or "").strip().lower()
    if source not in {"validation", "custom"}:
        raise HTTPException(status_code=400, detail="source must be 'validation' or 'custom'")

    return StreamingResponse(
        _stream_edit_card(body.session_id, card_index, prompt, source),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class CardConfirmRequest(BaseModel):
    session_id: str
    source: str  # "validation" or "custom"
    updated_card: dict


@router.post("/custom-cards/{card_index}/confirm")
def confirm_card_edit(card_index: int, body: CardConfirmRequest):
    """
    Persist the updated card after the user confirms the diff view.
    Deducts 1 credit from the user's balance.
    """
    session = _session_store.get(body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    source = (body.source or "").strip().lower()
    if source not in {"validation", "custom"}:
        raise HTTPException(status_code=400, detail="source must be 'validation' or 'custom'")

    # Deduct 1 credit for editing a card
    username = session.get("username")
    if username:
        try:
            current_credits = get_user_credits(username)
            if current_credits is not None:
                if current_credits < 1:
                    raise HTTPException(
                        status_code=403,
                        detail="Insufficient credits. You need at least 1 credit to edit a card.",
                    )
                remaining = decrement_user_credits(username, 1)
                logger.info(
                    "[confirm_card_edit] Deducted 1 credit for %s editing %s card (remaining=%s)",
                    username,
                    source,
                    remaining,
                )
        except SupabaseNotConfiguredError:
            logger.warning("[confirm_card_edit] Supabase not configured; skipping credit checks.")

    key = "cards" if source == "validation" else "custom_cards"
    cards_list = session.get(key) or []
    if not isinstance(cards_list, list) or not (0 <= card_index < len(cards_list)):
        raise HTTPException(status_code=404, detail="Card not found")

    logger.info(
        "[confirm_card_edit] Updating %s card at index %d for session %s. source_url: %s",
        source,
        card_index,
        body.session_id[:8],
        body.updated_card.get("source_url"),
    )
    cards_list[card_index] = body.updated_card
    _session_store.patch(body.session_id, {key: cards_list})
    return {
        "ok": True,
        "index": card_index,
        "source": source,
        "updated_card": body.updated_card,
    }
