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
from app.services.research_agent import answer_chat, get_dashboard_summary, run_card_batch

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["analyze"])

# In-memory store for the latest submission (for debugging / step-by-step flow)
_latest_analyze_payload: dict | None = None

# Session store for streaming analysis: session_id -> context for LLM
_sessions: dict[str, dict] = {}

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
):
    """
    Step 1: Submit form + either document_text (paste) or files. Backend uses text or extracts
    from files to build document_context, stores in session. Returns session_id.
    """
    global _sessions
    session_id = str(uuid.uuid4())
    logger.info("[analyze/start] New session_id=%s role=%s property=%s", session_id, analyze_as, property_name)

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

    _sessions[session_id] = {
        "analyze_as": analyze_as,
        "property_name": property_name,
        "address": address,
        "leasable_area": leasable_area,
        "current_base_rent": current_base_rent,
        "document_context": document_context,
    }
    logger.info("[analyze/start] Session stored. Total sessions=%s", len(_sessions))
    return {"ok": True, "session_id": session_id}


async def _stream_analysis(session_id: str):
    """Generator: yield ndjson lines (progress + cards_batch + dashboard + done)."""
    session = _sessions.get(session_id)
    if not session:
        yield json.dumps({"type": "error", "message": "Session not found"}) + "\n"
        return

    ctx = session
    total_topics = len(CARD_TOPICS)
    all_cards: list[dict] = []
    seen_titles: set[str] = set()
    logger.info("[analyze/stream] Starting stream for session_id=%s total_topics=%s", session_id, total_topics)

    # User-friendly activity log lines: what the agent is doing (non-technical)
    _progress_messages = {
        "Income shifts (local income, higher/lower vs expected)": "Looking up local income and rent trends…",
        "Traffic counts (current vs future, higher/lower)": "Checking traffic and footfall data…",
        "Rent averages (same property, area, historical)": "Gathering rent averages and history…",
        "Rent forecast (today vs future, up or down)": "Estimating rent outlook (today vs future)…",
        "Nearby infrastructure developments (effect on rents)": "Researching nearby infrastructure and developments…",
        "Co-tenancy mix (e.g. anchor tenant commitment, category clustering)": "Analyzing tenant mix and anchor tenants…",
        "Demographics & consumer buying capacity": "Checking demographics and spending capacity…",
        "Footfall": "Checking footfall data…",
        "Local vacancy (new projects, tenant leverage to request lower rent)": "Looking at local vacancy and new projects…",
        "Tenant business category trends (e.g. apparel growth in area)": "Researching tenant category trends in the area…",
        "Tenant / landlord risk (RAW FACTS ONLY: brand, cash, payment history, disputes, loans)": "Checking tenant and landlord risk factors…",
        "Upcoming building maintenance (e.g. HVAC)": "Looking up upcoming maintenance (e.g. HVAC)…",
        "Market activity & trends (area and tenant category)": "Gathering market activity and trends…",
        "Sales comps (portfolio vs this lease, comp brands, avg lease term, competitors in property)": "Comparing sales and lease comps…",
        "Portfolio data (user-provided only)": "Reviewing portfolio data…",
        "NOI vs cashflow & avg occupancy (landlord: NOI to run building, occupancy level)": "Checking NOI, cashflow, and occupancy…",
    }

    for batch_start in range(0, total_topics, BATCH_SIZE):
        batch_topics = CARD_TOPICS[batch_start : batch_start + BATCH_SIZE]
        batch_index = batch_start // BATCH_SIZE + 1
        for topic in batch_topics:
            progress_msg = _progress_messages.get(topic, f"Researching {topic.split(' (')[0].strip() if ' (' in topic else topic}…")
            yield json.dumps({"type": "progress", "message": progress_msg, "topic": topic}) + "\n"
        logger.debug("[analyze/stream] Batch %s: %s", batch_index, batch_topics)

        cards = await asyncio.to_thread(
            run_card_batch,
            analyze_as=ctx["analyze_as"],
            property_name=ctx["property_name"],
            address=ctx["address"],
            leasable_area=ctx["leasable_area"],
            current_base_rent=ctx["current_base_rent"],
            document_context=ctx.get("document_context"),
            card_topics_batch=batch_topics,
            batch_index=batch_index,
        )
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
    )
    session["dashboard_summary"] = dashboard_data
    session["cards"] = all_cards
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
    session = _sessions.get(session_id)
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


@router.post("/analyze/chat")
def analyze_chat(body: ChatRequest):
    """
    Chat with the Research Agent. Uses full session context (property, documents, dashboard, cards).
    Returns a concise, to-the-point reply from OpenAI.
    """
    session = _sessions.get(body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    message = (body.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    logger.info("[analyze/chat] session_id=%s message_len=%s", body.session_id, len(message))
    reply = answer_chat(session, message)
    return {"reply": reply}
