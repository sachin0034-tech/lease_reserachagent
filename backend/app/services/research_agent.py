"""
Research Agent: calls LLM in batches to produce insight cards and dashboard summaries.

Primary providers:
- OpenAI (existing integration)
- Anthropic Claude Code SDK (via claude-agent-sdk) – selected when llm_provider='anthropic'
"""
import asyncio
import json
import logging
from typing import Any

from openai import OpenAI

from app.core.config import OPENAI_API_KEY, ANTHROPIC_API_KEY
from app.schemas.insight_card import CARD_TOPICS, InsightCard, InsightCardBatch
from app.services.prompts import (
    BUILD_QUERIES_MESSAGE,
    SYSTEM_ADDITION_FOR_TOOLS,
    SYSTEM_MESSAGE,
    build_user_message,
)
from app.services.tavily_search import search_for_batch as tavily_search_for_batch, search_tavily as tavily_search_tavily

logger = logging.getLogger(__name__)

try:
    # Claude Code Python Agent SDK
    from claude_agent_sdk import (
        AssistantMessage,
        ClaudeAgentOptions,
        ResultMessage,
        TextBlock,
        query as claude_query,
    )

    _CLAUDE_SDK_AVAILABLE = True
except Exception:  # ImportError and any runtime issues
    _CLAUDE_SDK_AVAILABLE = False
    AssistantMessage = ResultMessage = TextBlock = ClaudeAgentOptions = claude_query = None  # type: ignore[assignment]

# Placeholders that are not acceptable for why_it_matters; we replace with context-based text
_WHY_IT_MATTERS_PLACEHOLDERS = frozenset({"n/a", "na", "—", "-", "none", "no data", ""})


def _normalize_provider(llm_provider: str | None) -> str:
    """Normalize provider string -> 'openai' or 'anthropic' (default openai)."""
    p = (llm_provider or "openai").strip().lower()
    return "anthropic" if p in {"anthropic", "claude", "claude_sdk"} else "openai"


def _anthropic_enabled() -> bool:
    """Return True if Anthropic Claude SDK is usable (SDK import + API key)."""
    if not _CLAUDE_SDK_AVAILABLE:
        logger.warning(
            "[research_agent] Anthropic provider selected but claude-agent-sdk is not installed. "
            "Run `pip install claude-agent-sdk` in the backend environment."
        )
        return False
    if not ANTHROPIC_API_KEY:
        logger.warning(
            "[research_agent] Anthropic provider selected but ANTHROPIC_API_KEY is not set. "
            "Set ANTHROPIC_API_KEY in backend/.env."
        )
        return False
    return True


async def _claude_query_async(
    *,
    prompt: str,
    system_prompt: str | None = None,
    output_schema: dict[str, Any] | None = None,
) -> str:
    """
    Call Claude Code SDK asynchronously and return the best-effort text payload.

    Preference order:
    1) ResultMessage.result (when present) – this is the agent's final result
    2) Concatenated AssistantMessage TextBlocks

    We intentionally disable tools by default (no code editing from this backend flow).
    """
    if output_schema is not None:
        options = ClaudeAgentOptions(
            system_prompt=system_prompt,
            allowed_tools=[],  # no tools needed – pure text generation
            output_format={"type": "json_schema", "schema": output_schema},
        )
    else:
        options = ClaudeAgentOptions(
            system_prompt=system_prompt,
            allowed_tools=[],  # no tools needed – pure text generation
        )
    chunks: list[str] = []
    final_result: str | None = None
    structured_json: str | None = None
    async for message in claude_query(prompt=prompt, options=options):  # type: ignore[misc]
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    chunks.append(block.text)
        elif isinstance(message, ResultMessage):
            # Prefer structured_output when using output_format=json_schema
            if message.structured_output is not None:
                try:
                    structured_json = json.dumps(message.structured_output)
                except TypeError:
                    # Fall back to result/text
                    pass
            # Claude Code agent's final result payload (often what we actually want)
            if isinstance(message.result, str) and message.result.strip():
                final_result = message.result.strip()

    if structured_json is not None:
        logger.debug(
            "[research_agent] _claude_query_async using structured_output JSON (len=%s)",
            len(structured_json),
        )
        return structured_json

    if final_result is not None:
        logger.debug(
            "[research_agent] _claude_query_async using ResultMessage.result (len=%s)",
            len(final_result),
        )
        return final_result

    combined = "".join(chunks).strip()
    logger.debug(
        "[research_agent] _claude_query_async using concatenated Assistant text (len=%s)",
        len(combined),
    )
    return combined


def _claude_query_blocking(
    *,
    prompt: str,
    system_prompt: str | None = None,
    output_schema: dict[str, Any] | None = None,
) -> str:
    """
    Synchronous wrapper around Claude async query for use in FastAPI threadpool / asyncio.to_thread.
    """

    async def _runner() -> str:
        return await _claude_query_async(
            prompt=prompt,
            system_prompt=system_prompt,
            output_schema=output_schema,
        )

    # These functions are only called from worker threads (no running event loop),
    # so asyncio.run is safe.
    return asyncio.run(_runner())


def _normalize_why_it_matters(why_raw: str | None, title: str, impact: str, analyze_as: str) -> str:
    """Ensure why_it_matters is never N/A or empty; derive from context if needed."""
    s = (why_raw or "").strip()
    if s and s.lower() not in _WHY_IT_MATTERS_PLACEHOLDERS:
        return s
    role = (analyze_as or "").lower()
    if "tenant" in role:
        angle = "relevant for negotiating lower or fair rent"
    elif "landlord" in role:
        angle = "relevant for supporting rent levels or lease terms"
    else:
        angle = "relevant to lease negotiation and market position"
    return f"This insight on {title or 'this topic'} is {angle} given the {impact} impact."


def _shorten_source(source: str, max_words: int = 4) -> str:
    """Keep source to 3–4 words for display. Skip for 'Not available' and short strings."""
    if not source or len(source.split()) <= max_words:
        return source
    skip = ("not available", "user document", "public data", "market sources")
    if source.strip().lower() in skip or source.strip().lower().startswith("not available"):
        return source.strip()
    words = source.strip().split()[:max_words]
    return " ".join(words).strip()


def _cards_from_llm_json(
    data: dict[str, Any],
    analyze_as: str,
    batch_index: int,
    allowed_urls: set[str] | None = None,
) -> list[dict]:
    """
    Shared card parsing logic for both OpenAI and Anthropic JSON responses.
    When allowed_urls is set (from Tavily), any source_url not in that set is cleared.
    Ensures no duplicate source_url across cards: each card gets a unique URL when possible.
    """
    raw_cards = data.get("cards", data) if isinstance(data.get("cards"), list) else []
    cards: list[dict] = []
    used_urls: set[str] = set()
    allowed_list = list(allowed_urls) if allowed_urls else []
    allowed_index = 0

    def _assign_url(url: str | None) -> str | None:
        nonlocal allowed_index
        # If no URL but we have unused allowed URLs, assign one so every card can have a source link
        if not url and allowed_list:
            while allowed_index < len(allowed_list):
                u = allowed_list[allowed_index]
                allowed_index += 1
                if u not in used_urls:
                    used_urls.add(u)
                    return u
            return None
        if not url:
            return None
        if url in used_urls and allowed_list:
            while allowed_index < len(allowed_list):
                u = allowed_list[allowed_index]
                allowed_index += 1
                if u not in used_urls:
                    used_urls.add(u)
                    return u
            return None
        if allowed_urls and url not in allowed_urls:
            return None
        used_urls.add(url)
        return url

    for i, c in enumerate(raw_cards):
        if not isinstance(c, dict):
            continue
        try:
            src = (c.get("source") or "Not available").strip()
            if src.lower() in ("web search", "websearch"):
                src = "Public data / Market sources"
            src = _shorten_source(src)
            raw_url = c.get("source_url") or None
            if isinstance(raw_url, str):
                raw_url = raw_url.strip() or None
            if allowed_urls and raw_url and raw_url not in allowed_urls:
                raw_url = None
            raw_url = _assign_url(raw_url)
            title = c.get("title") or f"Card {i+1}"
            impact = c.get("impact") or "neutral"
            why_it_matters = _normalize_why_it_matters(
                c.get("why_it_matters"), title, impact, analyze_as
            )
            card = InsightCard(
                title=title,
                impact=impact,
                confidence_score=int(c.get("confidence_score", 0)),
                source=src,
                insight=(c.get("insight") or "").strip() or None,
                data_evidence=c.get("data_evidence") or "No data",
                why_it_matters=why_it_matters,
                baseline_pct=int(b) if (b := c.get("baseline_pct")) is not None else None,
                current_trend_pct=int(t) if (t := c.get("current_trend_pct")) is not None else None,
                source_url=raw_url,
            )
            cards.append(card.model_dump())
        except Exception as e:
            logger.debug(
                "[research_agent] Card validation error for item %s in batch %s: %s", i, batch_index, e
            )
            src = (c.get("source") or "Not available").strip()
            if src.lower() in ("web search", "websearch"):
                src = "Public data / Market sources"
            src = _shorten_source(src)
            raw_url = c.get("source_url") or None
            if isinstance(raw_url, str):
                raw_url = raw_url.strip() or None
            if allowed_urls and raw_url and raw_url not in allowed_urls:
                raw_url = None
            raw_url = _assign_url(raw_url)
            title = c.get("title", f"Card {i+1}")
            why_it_matters = _normalize_why_it_matters(
                c.get("why_it_matters"), title, c.get("impact") or "neutral", analyze_as
            )
            cards.append(
                {
                    "title": title,
                    "impact": c.get("impact") or "neutral",
                    "confidence_score": int(c.get("confidence_score", 0)),
                    "source": src,
                    "insight": (c.get("insight") or "").strip() or None,
                    "data_evidence": c.get("data_evidence") or "No data",
                    "why_it_matters": why_it_matters,
                    "baseline_pct": c.get("baseline_pct"),
                    "current_trend_pct": c.get("current_trend_pct"),
                    "source_url": raw_url,
                }
            )
    return cards


# Web search tool definition for OpenAI (model calls this; we run Tavily and return results with URLs)
WEB_SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": "Search the web for current market data, rental comps, demographics, or public records. Call once per topic with a specific query. Returns a list of sources with title, URL, and content. You MUST use only these URLs as source_url in your cards.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Specific search query (e.g. address + topic + 'retail rent market')"},
            },
            "required": ["query"],
        },
    },
}


def _run_web_search_tavily(query: str) -> tuple[str, list[dict]]:
    """Run Tavily; return (formatted string for LLM, list of {title, url, content}) for URL collection."""
    from app.services.tavily_search import search_tavily
    results = search_tavily(query, max_results=8)
    if not results:
        return f"No results for: {query[:100]}", []
    lines = []
    for i, r in enumerate(results, 1):
        title = (r.get("title") or "").strip() or "Untitled"
        url = (r.get("url") or "").strip()
        content = (r.get("content") or "").strip()[:1200]
        lines.append(f"{i}. Title: {title}\n   URL: {url}\n   Content: {content}")
    return "\n\n".join(lines), results


def _openai_card_batch_with_tools(
    *,
    client: "OpenAI",
    user_message: str,
    analyze_as: str,
    batch_index: int,
    max_tool_rounds: int = 8,
) -> tuple[str, set[str]]:
    """
    Run OpenAI with web_search tool. Model calls Tavily via tool; we collect all returned URLs.
    Returns (final JSON content string, set of all URLs from tool results).
    """
    system_content = SYSTEM_MESSAGE + SYSTEM_ADDITION_FOR_TOOLS
    messages: list[dict] = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_message},
    ]
    all_urls: set[str] = set()
    content = "{}"
    for _ in range(max_tool_rounds):
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=[WEB_SEARCH_TOOL],
            tool_choice="auto",
        )
        msg = response.choices[0].message
        if not getattr(msg, "tool_calls", None):
            content = (msg.content or "").strip() or "{}"
            break
        # Append assistant message with tool_calls
        messages.append({
            "role": "assistant",
            "content": msg.content or None,
            "tool_calls": [
                {"id": tc.id, "type": "function", "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in msg.tool_calls
            ],
        })
        for tc in msg.tool_calls:
            if getattr(tc.function, "name", None) != "web_search":
                continue
            try:
                args = json.loads(tc.function.arguments or "{}")
                query = (args.get("query") or "").strip() or "retail lease market data"
            except Exception:
                query = "retail lease market data"
            result_str, results = _run_web_search_tavily(query)
            for r in results:
                u = (r.get("url") or "").strip()
                if u:
                    all_urls.add(u)
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result_str,
            })
        content = (msg.content or "").strip() or "{}"
    # Strip markdown code fence if present
    if content.startswith("```"):
        for prefix in ("```json\n", "```\n"):
            if content.startswith(prefix):
                content = content[len(prefix) :].strip()
        if content.endswith("```"):
            content = content[: content.rfind("```")].strip()
    return content, all_urls


async def run_card_batch_streaming(
    *,
    analyze_as: str,
    property_name: str,
    address: str,
    leasable_area: str,
    current_base_rent: str,
    document_context: str | None,
    card_topics_batch: list[str],
    batch_index: int,
    llm_provider: str = "openai",
) -> tuple[list[dict], list[tuple[str | None, str]]]:
    """
    Async version of run_card_batch that supports streaming progress updates.
    Returns (cards, progress_messages) where progress_messages is list of (topic, message) tuples.
    """
    provider = _normalize_provider(llm_provider)
    logger.info(
        "[research_agent] run_card_batch_streaming provider=%s batch_index=%s topics=%s",
        provider,
        batch_index,
        card_topics_batch,
    )

    progress_messages: list[tuple[str | None, str]] = []

    # Send initial progress for each topic
    for topic in card_topics_batch:
        topic_short = topic.split(" (")[0] if " (" in topic else topic
        progress_msg = f"Analyzing {topic_short}..."
        progress_messages.append((topic, progress_msg))

    if provider == "anthropic":
        if not _anthropic_enabled():
            if not OPENAI_API_KEY:
                logger.warning(
                    "[research_agent] Neither Anthropic nor OpenAI are configured; returning placeholder cards"
                )
                return (
                    [
                        {
                            "title": t,
                            "impact": "neutral",
                            "confidence_score": 0,
                            "source": "Not available",
                            "data_evidence": "No data",
                            "why_it_matters": "Enable LLM provider API keys for research.",
                        }
                        for t in card_topics_batch
                    ],
                    progress_messages,
                )
            logger.info(
                "[research_agent] Falling back to OpenAI for run_card_batch_streaming because Anthropic is not enabled"
            )
            provider = "openai"

    if provider == "openai":
        if not OPENAI_API_KEY:
            logger.warning("[research_agent] OPENAI_API_KEY not set; returning placeholder cards")
            return (
                [
                    {
                        "title": t,
                        "impact": "neutral",
                        "confidence_score": 0,
                        "source": "Not available",
                        "data_evidence": "No data",
                        "why_it_matters": "Enable API key for research.",
                    }
                    for t in card_topics_batch
                ],
                progress_messages,
            )

        user_message = build_user_message(
            analyze_as=analyze_as,
            property_name=property_name,
            address=address,
            leasable_area=leasable_area,
            current_base_rent=current_base_rent,
            document_context=document_context,
            card_topics_batch=card_topics_batch,
            batch_index=batch_index,
            search_results=None,
        )
        logger.debug("[research_agent] (OpenAI) user_message length=%s", len(user_message))
        progress_messages.append((None, "Searching the web for sources..."))

        client = OpenAI(api_key=OPENAI_API_KEY)
        content, all_urls = await asyncio.to_thread(
            _openai_card_batch_with_tools,
            client=client,
            user_message=user_message,
            analyze_as=analyze_as,
            batch_index=batch_index,
        )
        progress_messages.append((None, "Processing with OpenAI..."))

        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            logger.warning("[research_agent] OpenAI JSON decode error: %s", e)
            return [], progress_messages

        allowed_urls = all_urls if all_urls else None
        cards = _cards_from_llm_json(data, analyze_as, batch_index, allowed_urls=allowed_urls)
        logger.info(
            "[research_agent] Got %s cards for batch %s from OpenAI (streaming)", len(cards), batch_index
        )
        progress_messages.append((None, f"Completed analysis: {len(cards)} insights found"))
        return cards, progress_messages

    # Anthropic provider path with streaming: LLM generates search queries, we run Tavily, then LLM produces cards
    search_results_anthropic: list[dict] = []
    try:
        progress_messages.append((None, "Preparing search queries..."))
        queries_prompt = (
            f"Property: {property_name}\nAddress: {address}\n\nTopics (one search query per topic, same order):\n"
            + "\n".join(f"{i}. {t}" for i, t in enumerate(card_topics_batch, 1))
            + "\n\nOutput JSON only: {\"queries\": [\"query1\", \"query2\", ...]}"
        )
        queries_content = await asyncio.to_thread(
            _claude_query_blocking,
            prompt=queries_prompt,
            system_prompt=BUILD_QUERIES_MESSAGE,
            output_schema={"type": "object", "properties": {"queries": {"type": "array", "items": {"type": "string"}}}, "required": ["queries"]},
        )
        queries_data = json.loads(queries_content or "{}")
        queries_list = queries_data.get("queries") or []
        if len(queries_list) < len(card_topics_batch):
            queries_list.extend([f"{address} {property_name} retail lease market data"] * (len(card_topics_batch) - len(queries_list)))
        progress_messages.append((None, "Searching the web for sources..."))
        seen_anthropic: set[str] = set()
        for q in queries_list[: len(card_topics_batch)]:
            query_str = (q or "").strip() or f"{address} retail lease"
            results = await asyncio.to_thread(tavily_search_tavily, query_str, 8)
            for r in results:
                u = (r.get("url") or "").strip()
                if u and u not in seen_anthropic:
                    seen_anthropic.add(u)
                    search_results_anthropic.append(r)
    except Exception as e:
        logger.warning("[research_agent] Anthropic search setup failed: %s", e)

    user_message = build_user_message(
        analyze_as=analyze_as,
        property_name=property_name,
        address=address,
        leasable_area=leasable_area,
        current_base_rent=current_base_rent,
        document_context=document_context,
        card_topics_batch=card_topics_batch,
        batch_index=batch_index,
        search_results=search_results_anthropic if search_results_anthropic else None,
    )
    logger.debug("[research_agent] (Anthropic streaming) user_message length=%s", len(user_message))

    try:
        logger.info("[research_agent] Calling Anthropic Claude (streaming) for batch %s", batch_index)
        progress_messages.append((None, "Processing with Claude..."))

        options = ClaudeAgentOptions(
            system_prompt=SYSTEM_MESSAGE,
            allowed_tools=[],
            output_format={
                "type": "json_schema",
                "schema": {
                    "type": "object",
                    "properties": {
                        "cards": {
                            "type": "array",
                            "items": {"type": "object"},
                        }
                    },
                    "required": ["cards"],
                },
            },
        )

        chunks: list[str] = []
        final_result: str | None = None
        structured_json: str | None = None
        chunk_count = 0

        async for message in claude_query(prompt=user_message, options=options):  # type: ignore[misc]
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        chunks.append(block.text)
                        chunk_count += 1
                        # Send progress updates as we receive chunks
                        if chunk_count % 8 == 0:
                            progress_messages.append((None, "Claude is analyzing the data..."))
            elif isinstance(message, ResultMessage):
                if message.structured_output is not None:
                    try:
                        structured_json = json.dumps(message.structured_output)
                    except TypeError:
                        pass
                if isinstance(message.result, str) and message.result.strip():
                    final_result = message.result.strip()

        if structured_json is not None:
            content = structured_json
        elif final_result is not None:
            content = final_result
        else:
            content = "".join(chunks).strip() or "{}"

        logger.debug("[research_agent] Anthropic streaming response length=%s", len(content))
        data = json.loads(content or "{}")
    except json.JSONDecodeError as e:
        logger.warning("[research_agent] Anthropic JSON decode error: %s", e)
        return [], progress_messages
    except Exception as e:
        logger.warning("[research_agent] Anthropic error in run_card_batch_streaming: %s", e)
        return [], progress_messages

    allowed_urls = {r.get("url") for r in search_results_anthropic if r.get("url")} or None
    cards = _cards_from_llm_json(data, analyze_as, batch_index, allowed_urls=allowed_urls)
    logger.info(
        "[research_agent] Got %s cards for batch %s from Anthropic (streaming)", len(cards), batch_index
    )
    progress_messages.append((None, f"Completed analysis: {len(cards)} insights found"))
    return cards, progress_messages


def run_card_batch(
    *,
    analyze_as: str,
    property_name: str,
    address: str,
    leasable_area: str,
    current_base_rent: str,
    document_context: str | None,
    card_topics_batch: list[str],
    batch_index: int,
    llm_provider: str = "openai",
) -> list[dict]:
    """
    Call LLM for one batch of cards (up to 5). Returns list of card dicts.
    Forces JSON output; supports OpenAI and Anthropic providers.
    """
    provider = _normalize_provider(llm_provider)
    logger.info(
        "[research_agent] run_card_batch provider=%s batch_index=%s topics=%s",
        provider,
        batch_index,
        card_topics_batch,
    )

    if provider == "anthropic":
        if not _anthropic_enabled():
            # Fall back if Anthropic is misconfigured
            if not OPENAI_API_KEY:
                logger.warning(
                    "[research_agent] Neither Anthropic nor OpenAI are configured; returning placeholder cards"
                )
                return [
                    {
                        "title": t,
                        "impact": "neutral",
                        "confidence_score": 0,
                        "source": "Not available",
                        "data_evidence": "No data",
                        "why_it_matters": "Enable LLM provider API keys for research.",
                    }
                    for t in card_topics_batch
                ]
            logger.info(
                "[research_agent] Falling back to OpenAI for run_card_batch because Anthropic is not enabled"
            )
            provider = "openai"

    if provider == "openai":
        if not OPENAI_API_KEY:
            logger.warning("[research_agent] OPENAI_API_KEY not set; returning placeholder cards")
            return [
                {
                    "title": t,
                    "impact": "neutral",
                    "confidence_score": 0,
                    "source": "Not available",
                    "data_evidence": "No data",
                    "why_it_matters": "Enable API key for research.",
                }
                for t in card_topics_batch
            ]

        user_message = build_user_message(
            analyze_as=analyze_as,
            property_name=property_name,
            address=address,
            leasable_area=leasable_area,
            current_base_rent=current_base_rent,
            document_context=document_context,
            card_topics_batch=card_topics_batch,
            batch_index=batch_index,
            search_results=None,
        )
        client = OpenAI(api_key=OPENAI_API_KEY)
        content, all_urls = _openai_card_batch_with_tools(
            client=client,
            user_message=user_message,
            analyze_as=analyze_as,
            batch_index=batch_index,
        )
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            logger.warning("[research_agent] OpenAI JSON decode error: %s", e)
            return []
        allowed_urls = all_urls if all_urls else None
        cards = _cards_from_llm_json(data, analyze_as, batch_index, allowed_urls=allowed_urls)
        logger.info(
            "[research_agent] Got %s cards for batch %s from OpenAI", len(cards), batch_index
        )
        return cards

    # Anthropic provider path: LLM generates search queries, we run Tavily, then LLM produces cards
    search_results_anthropic_sync: list[dict] = []
    try:
        queries_prompt = (
            f"Property: {property_name}\nAddress: {address}\n\nTopics (one search query per topic, same order):\n"
            + "\n".join(f"{i}. {t}" for i, t in enumerate(card_topics_batch, 1))
            + "\n\nOutput JSON only: {\"queries\": [\"query1\", \"query2\", ...]}"
        )
        queries_content = _claude_query_blocking(
            prompt=queries_prompt,
            system_prompt=BUILD_QUERIES_MESSAGE,
            output_schema={"type": "object", "properties": {"queries": {"type": "array", "items": {"type": "string"}}}, "required": ["queries"]},
        )
        queries_data = json.loads(queries_content or "{}")
        queries_list = queries_data.get("queries") or []
        if len(queries_list) < len(card_topics_batch):
            queries_list.extend([f"{address} {property_name} retail lease market data"] * (len(card_topics_batch) - len(queries_list)))
        seen_sync: set[str] = set()
        for q in queries_list[: len(card_topics_batch)]:
            query_str = (q or "").strip() or f"{address} retail lease"
            results = tavily_search_tavily(query_str, 8)
            for r in results:
                u = (r.get("url") or "").strip()
                if u and u not in seen_sync:
                    seen_sync.add(u)
                    search_results_anthropic_sync.append(r)
    except Exception as e:
        logger.warning("[research_agent] Anthropic search setup failed: %s", e)

    user_message = build_user_message(
        analyze_as=analyze_as,
        property_name=property_name,
        address=address,
        leasable_area=leasable_area,
        current_base_rent=current_base_rent,
        document_context=document_context,
        card_topics_batch=card_topics_batch,
        batch_index=batch_index,
        search_results=search_results_anthropic_sync if search_results_anthropic_sync else None,
    )
    logger.debug("[research_agent] (Anthropic) user_message length=%s", len(user_message))

    try:
        logger.info("[research_agent] Calling Anthropic Claude for batch %s", batch_index)
        content = _claude_query_blocking(
            prompt=user_message,
            system_prompt=SYSTEM_MESSAGE,
            output_schema={
                "type": "object",
                "properties": {
                    "cards": {
                        "type": "array",
                        "items": {"type": "object"},
                    }
                },
                "required": ["cards"],
            },
        )
        logger.debug("[research_agent] Anthropic raw response length=%s", len(content))
        data = json.loads(content or "{}")
    except json.JSONDecodeError as e:
        logger.warning("[research_agent] Anthropic JSON decode error: %s", e)
        return []
    except Exception as e:
        logger.warning("[research_agent] Anthropic error in run_card_batch: %s", e)
        return []

    allowed_urls = {r.get("url") for r in search_results_anthropic_sync if r.get("url")} or None
    cards = _cards_from_llm_json(data, analyze_as, batch_index, allowed_urls=allowed_urls)
    logger.info(
        "[research_agent] Got %s cards for batch %s from Anthropic", len(cards), batch_index
    )
    return cards


# Try search model first; fallback to standard model so we always get LLM-generated dashboard data from cards
DASHBOARD_SEARCH_MODEL = "gpt-4o-mini-search-preview"
DASHBOARD_FALLBACK_MODEL = "gpt-4o-mini"

RECOMMENDATIONS_FORMAT = """
recommendations must be an object with exactly six keys (value + reasoning for each). You MUST derive each value ONLY from the analysis of the provided insight cards and document context—no placeholders, no example values, no mock data. If the cards do not support a value, use "—".

1. ideal_term: From the cards, infer the recommended lease term. Output format: "[number] Years" or "[number] Years + [number] Option" (e.g. 3 Years, 7 Years + 2 Option). The numbers must come from your analysis of lease term, market stability, or tenant/landlord insights in the cards.
   ideal_term_reasoning: One or two sentences explaining why you suggested this term—cite specific insight cards or evidence (e.g. market stability, comparable lease terms, tenant mix).

2. negotiation_leverage: From the cards, infer strength of negotiation position. Output format: "Low" or "Moderate" or "High" followed by " (brief reason from cards)". The level must be justified by infrastructure, co-tenancy, market activity, or risk evidence in the cards.
   negotiation_leverage_reasoning: One or two sentences explaining why you assessed leverage this way—cite vacancy, payment history, demand, or other factors from the cards.

3. renewals: From the cards, infer renewal or escalation stance. Output format: a short phrase with numbers when the cards support it (e.g. "Cap at 2% YoY", "3% annual escalation"). If cards do not specify percentages, derive from market or renewal insights or output a brief text-only phrase.
   renewals_reasoning: One or two sentences explaining why you suggested this renewal/escalation stance—cite market trends, comps, or insight cards.
"""

DASHBOARD_SYSTEM_WITH_SEARCH = """You are a lease analyst. You have access to OpenAI's built-in web search only—use it when you need current market rents, comps, or local data for the property area. Do not use any other tools.

Using the property details, uploaded document context, and all validation insight cards provided, evaluate the evidence and produce your assessment. When helpful, use web search to find current market rates or comparable leases.

Output a single JSON object with:
- fair_market_rent: number (recommended $/sq ft from cards and search)
- confidence_score: integer 0-100
- vs_current_pct: number (percent change vs current rent)
- recommendations: object with ideal_term, ideal_term_reasoning, negotiation_leverage, negotiation_leverage_reasoning, renewals, renewals_reasoning
- portfolio_context: object with this_property_rent, portfolio_avg_rent, comparison_pct, comparison_text
""" + RECOMMENDATIONS_FORMAT + """
Base every value on the insight cards and any search results. Return only valid JSON, no markdown."""

DASHBOARD_SYSTEM_NO_SEARCH = """You are a lease analyst. Using ONLY the property details, uploaded document context, and validation insight cards provided below, evaluate the evidence and produce your assessment. Do not invent data—derive every value from the cards and context.

Output a single JSON object with these exact keys:
- fair_market_rent: number (recommended $/sq ft inferred from the insight cards' data_evidence and why_it_matters)
- confidence_score: integer 0-100 (how well the cards support the recommendation)
- vs_current_pct: number (percent change vs current rent, e.g. 8.3 for +8.3%)
- recommendations: object with ideal_term, ideal_term_reasoning, negotiation_leverage, negotiation_leverage_reasoning, renewals, renewals_reasoning
- portfolio_context: object with this_property_rent (number), portfolio_avg_rent (number), comparison_pct (number), comparison_text (string)
""" + RECOMMENDATIONS_FORMAT + """
Every value must be derived from the insight cards. Return only valid JSON, no markdown."""


def get_dashboard_summary(
    *,
    property_name: str,
    address: str,
    leasable_area: str,
    current_base_rent: str,
    document_context: str | None,
    cards: list[dict],
    llm_provider: str = "openai",
) -> dict:
    """
    Produce dashboard summary from OpenAI: fair_market_rent, recommendations (ideal_term, negotiation_leverage, renewals), portfolio_context.
    Recommendations are derived by the LLM from the provided insight cards and document context (see RECOMMENDATIONS_FORMAT).
    When the API fails or there are no cards, returns _minimal_dashboard() with recommendations_source='fallback' and "—" for all recommendation fields.
    Response includes recommendations_source: 'openai' | 'anthropic' | 'fallback' so callers can verify origin.
    """
    provider = _normalize_provider(llm_provider)
    logger.info(
        "[research_agent] get_dashboard_summary provider=%s cards=%s", provider, len(cards)
    )
    try:
        current = float(current_base_rent.replace(",", "").strip())
    except (ValueError, TypeError):
        current = 42.0

    if provider == "anthropic":
        if not _anthropic_enabled():
            if not OPENAI_API_KEY:
                logger.warning(
                    "[research_agent] get_dashboard_summary: Anthropic selected but not enabled and "
                    "OPENAI_API_KEY missing; returning minimal dashboard"
                )
                return _minimal_dashboard(current)
            logger.info(
                "[research_agent] get_dashboard_summary: falling back to OpenAI because Anthropic is not enabled"
            )
            provider = "openai"

    if provider == "openai":
        if not OPENAI_API_KEY:
            logger.warning("[research_agent] OPENAI_API_KEY not set; returning minimal dashboard")
            return _minimal_dashboard(current)

    # When there are no cards, minimal dashboard is appropriate (nothing to analyze)
    if not cards:
        logger.warning("[research_agent] No cards; returning minimal dashboard")
        return _minimal_dashboard(current)

    # Build full context for the LLM
    parts = [
        f"Property: {property_name or 'N/A'}",
        f"Address: {address or 'N/A'}",
        f"Leasable area: {leasable_area or 'N/A'} sq ft",
        f"Current base rent: ${current}/sq ft",
    ]
    if document_context and document_context.strip():
        doc_snippet = document_context[:4000] + ("..." if len(document_context) > 4000 else "")
        parts.append(f"Uploaded document context:\n{doc_snippet}")
    parts.append("\nValidation insight cards (analyze these to fill every dashboard field):")
    for c in cards[:30]:
        parts.append(
            f"- {c.get('title', '')} ({c.get('impact', '')}): evidence: {c.get('data_evidence', '')[:250]} | why it matters: {c.get('why_it_matters', '')[:200]}"
        )
    user_msg = "\n".join(parts) + "\n\nOutput the JSON object only."

    if provider == "openai":
        client = OpenAI(api_key=OPENAI_API_KEY)
        models_to_try = [
            (DASHBOARD_SEARCH_MODEL, DASHBOARD_SYSTEM_WITH_SEARCH),
            (DASHBOARD_FALLBACK_MODEL, DASHBOARD_SYSTEM_NO_SEARCH),
        ]
        last_error: Exception | None = None
        for model, system_content in models_to_try:
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_content},
                        {"role": "user", "content": user_msg},
                    ],
                    response_format={"type": "json_object"},
                )
                raw = response.choices[0].message.content or "{}"
                data = json.loads(raw)
                rec = data.get("recommendations") or {}
                port = data.get("portfolio_context") or {}
                fair = float(data.get("fair_market_rent", current))
                this_rent = float(port.get("this_property_rent", fair))
                avg_rent = float(port.get("portfolio_avg_rent", current))
                # Compute vs_current_pct from actual numbers so sign is correct: positive = fair above current, negative = below
                vs_current_pct = round((fair - current) / current * 100, 2) if current else 0.0
                # Portfolio: comparison_pct = (this_property - portfolio_avg) / portfolio_avg * 100
                comparison_pct = (
                    round((this_rent - avg_rent) / avg_rent * 100, 2) if avg_rent else 0.0
                )
                comparison_text = str(port.get("comparison_text") or "").strip()
                if not comparison_text and avg_rent:
                    comparison_text = (
                        f"This property's rent is {abs(comparison_pct):.2f}% "
                        f"{'below' if comparison_pct < 0 else 'above'} the average rent for similar properties."
                    )
                out = {
                    "fair_market_rent": fair,
                    "confidence_score": int(data.get("confidence_score", 0)),
                    "vs_current_pct": vs_current_pct,
                    "recommendations": {
                        "ideal_term": str(rec.get("ideal_term") or "—").strip() or "—",
                        "ideal_term_reasoning": str(rec.get("ideal_term_reasoning") or "").strip()
                        or "",
                        "negotiation_leverage": str(rec.get("negotiation_leverage") or "—").strip()
                        or "—",
                        "negotiation_leverage_reasoning": str(
                            rec.get("negotiation_leverage_reasoning") or ""
                        ).strip()
                        or "",
                        "renewals": str(rec.get("renewals") or "—").strip() or "—",
                        "renewals_reasoning": str(rec.get("renewals_reasoning") or "").strip()
                        or "",
                    },
                    "portfolio_context": {
                        "this_property_rent": this_rent,
                        "portfolio_avg_rent": avg_rent,
                        "comparison_pct": comparison_pct,
                        "comparison_text": comparison_text,
                    },
                    "recommendations_source": "openai",
                }
                logger.info(
                    "[research_agent] dashboard summary from OpenAI (model=%s): fair_rent=%s "
                    "vs_current_pct=%s confidence=%s | recommendations: ideal_term=%r "
                    "negotiation_leverage=%r renewals=%r",
                    model,
                    out["fair_market_rent"],
                    out["vs_current_pct"],
                    out["confidence_score"],
                    out["recommendations"]["ideal_term"],
                    out["recommendations"]["negotiation_leverage"],
                    out["recommendations"]["renewals"],
                )
                return out
            except json.JSONDecodeError as e:
                last_error = e
                logger.warning(
                    "[research_agent] get_dashboard_summary JSON error with %s: %s", model, e
                )
                continue
            except Exception as e:
                last_error = e
                logger.warning("[research_agent] get_dashboard_summary error with %s: %s", model, e)
                continue

        logger.warning(
            "[research_agent] All OpenAI dashboard LLM attempts failed; returning minimal dashboard"
        )
        return _minimal_dashboard(current)

    # Anthropic provider: single-call path, no web search model
    try:
        logger.info("[research_agent] Calling Anthropic Claude for dashboard summary")
        raw = _claude_query_blocking(
            prompt=user_msg,
            system_prompt=DASHBOARD_SYSTEM_NO_SEARCH,
            output_schema={
                "type": "object",
                "properties": {
                    "fair_market_rent": {"type": "number"},
                    "confidence_score": {"type": "integer"},
                    "vs_current_pct": {"type": "number"},
                    "recommendations": {"type": "object"},
                    "portfolio_context": {"type": "object"},
                },
                "required": [
                    "fair_market_rent",
                    "confidence_score",
                    "vs_current_pct",
                    "recommendations",
                    "portfolio_context",
                ],
            },
        )
        data = json.loads(raw or "{}")
    except json.JSONDecodeError as e:
        logger.warning("[research_agent] Anthropic dashboard JSON error: %s", e)
        return _minimal_dashboard(current)
    except Exception as e:
        logger.warning("[research_agent] Anthropic dashboard error: %s", e)
        return _minimal_dashboard(current)

    rec = data.get("recommendations") or {}
    port = data.get("portfolio_context") or {}
    fair = float(data.get("fair_market_rent", current))
    this_rent = float(port.get("this_property_rent", fair))
    avg_rent = float(port.get("portfolio_avg_rent", current))
    vs_current_pct = round((fair - current) / current * 100, 2) if current else 0.0
    comparison_pct = round((this_rent - avg_rent) / avg_rent * 100, 2) if avg_rent else 0.0
    comparison_text = str(port.get("comparison_text") or "").strip()
    if not comparison_text and avg_rent:
        comparison_text = (
            f"This property's rent is {abs(comparison_pct):.2f}% "
            f"{'below' if comparison_pct < 0 else 'above'} the average rent for similar properties."
        )
    out = {
        "fair_market_rent": fair,
        "confidence_score": int(data.get("confidence_score", 0)),
        "vs_current_pct": vs_current_pct,
        "recommendations": {
            "ideal_term": str(rec.get("ideal_term") or "—").strip() or "—",
            "ideal_term_reasoning": str(rec.get("ideal_term_reasoning") or "").strip() or "",
            "negotiation_leverage": str(rec.get("negotiation_leverage") or "—").strip() or "—",
            "negotiation_leverage_reasoning": str(
                rec.get("negotiation_leverage_reasoning") or ""
            ).strip()
            or "",
            "renewals": str(rec.get("renewals") or "—").strip() or "—",
            "renewals_reasoning": str(rec.get("renewals_reasoning") or "").strip() or "",
        },
        "portfolio_context": {
            "this_property_rent": this_rent,
            "portfolio_avg_rent": avg_rent,
            "comparison_pct": comparison_pct,
            "comparison_text": comparison_text,
        },
        "recommendations_source": "anthropic",
    }
    logger.info(
        "[research_agent] dashboard summary from Anthropic: fair_rent=%s vs_current_pct=%s "
        "confidence=%s | recommendations: ideal_term=%r negotiation_leverage=%r renewals=%r",
        out["fair_market_rent"],
        out["vs_current_pct"],
        out["confidence_score"],
        out["recommendations"]["ideal_term"],
        out["recommendations"]["negotiation_leverage"],
        out["recommendations"]["renewals"],
    )
    return out


def _minimal_dashboard(current: float) -> dict:
    """Fallback when API/key fails or parse error: no hardcoded recommendations."""
    logger.info("[research_agent] dashboard summary from FALLBACK (no OpenAI): recommendations are placeholders (—)")
    return {
        "fair_market_rent": round(current, 2),
        "confidence_score": 0,
        "vs_current_pct": 0.0,
        "recommendations": {
            "ideal_term": "—",
            "ideal_term_reasoning": "",
            "negotiation_leverage": "—",
            "negotiation_leverage_reasoning": "",
            "renewals": "—",
            "renewals_reasoning": "",
        },
        "portfolio_context": {
            "this_property_rent": round(current, 2),
            "portfolio_avg_rent": round(current, 2),
            "comparison_pct": 0,
            "comparison_text": "",
        },
        "recommendations_source": "fallback",
    }


# Chat system prompt template. Use .format(property_and_area=..., context=...) when calling.
CHAT_SYSTEM_TEMPLATE = """You are the Research Agent for lease negotiation.

Property and area you must limit answers to:
{property_and_area}

CRITICAL rules:
- Answer ONLY about the above property, area, and market. Do not discuss other regions, properties, or generic advice unrelated to this specific property and area.
- Use ONLY the context below (property details, uploaded documents, dashboard summary, and validation insights). Do not invent data, statistics, or sources. If something is not in the context, say so or do not mention it.
- Keep answers concise (2-4 short paragraphs max). Use bullet points or short sentences when helpful. Cover only the most important points from the context.

--- Context ---
{context}"""

MAX_DOCUMENT_CONTEXT_CHARS = 12_000


def _build_property_and_area(session_data: dict) -> str:
    """Build a short property-and-area summary from form/session data for the chat scope."""
    return (
        f"Role: {session_data.get('analyze_as', 'N/A')} | "
        f"Property: {session_data.get('property_name', 'N/A')} | "
        f"Address/area: {session_data.get('address', 'N/A')} | "
        f"Leasable area: {session_data.get('leasable_area', 'N/A')} sq ft | "
        f"Current base rent: ${session_data.get('current_base_rent', 'N/A')}/sq ft"
    )


def _build_chat_context(session_data: dict) -> str:
    """Build the full context block from session (property, documents, dashboard, cards)."""
    parts = []

    # Property
    parts.append("## Property")
    parts.append(
        f"Role: {session_data.get('analyze_as', 'N/A')}\n"
        f"Name: {session_data.get('property_name', 'N/A')}\n"
        f"Address: {session_data.get('address', 'N/A')}\n"
        f"Leasable area: {session_data.get('leasable_area', 'N/A')} sq ft\n"
        f"Current base rent: ${session_data.get('current_base_rent', 'N/A')}/sq ft"
    )

    # Uploaded documents
    doc_ctx = session_data.get("document_context")
    if doc_ctx and doc_ctx.strip():
        truncated = doc_ctx if len(doc_ctx) <= MAX_DOCUMENT_CONTEXT_CHARS else doc_ctx[:MAX_DOCUMENT_CONTEXT_CHARS] + "\n[... truncated]"
        parts.append("\n## Uploaded documents / user content")
        parts.append(truncated)

    # Dashboard summary
    dash = session_data.get("dashboard_summary")
    if dash:
        parts.append("\n## Dashboard summary")
        parts.append(
            f"Fair market rent: ${dash.get('fair_market_rent', 'N/A')}/sq ft | "
            f"Confidence: {dash.get('confidence_score', 'N/A')}% | "
            f"Vs current: {dash.get('vs_current_pct', 'N/A')}%"
        )
        rec = dash.get("recommendations") or {}
        parts.append(f"Recommendations: Ideal term {rec.get('ideal_term', 'N/A')}; Negotiation leverage: {rec.get('negotiation_leverage', 'N/A')}; Renewals: {rec.get('renewals', 'N/A')}")
        port = dash.get("portfolio_context") or {}
        parts.append(f"Portfolio: This property ${port.get('this_property_rent', 'N/A')}/sf; Portfolio avg ${port.get('portfolio_avg_rent', 'N/A')}/sf; {port.get('comparison_text', '')}")

    # Insight cards
    cards = session_data.get("cards") or []
    if cards:
        parts.append("\n## Validation insights (summary)")
        for c in cards[:25]:
            title = c.get("title", "")
            impact = c.get("impact", "")
            evidence = (c.get("data_evidence") or "")[:200]
            why = (c.get("why_it_matters") or "")[:150]
            parts.append(f"- {title} ({impact}): {evidence}... Why: {why}")

    return "\n".join(parts)


def answer_chat(session_data: dict, user_message: str) -> str:
    """
    Build full context from session (property, documents, dashboard, cards) and return
    a concise reply to the user's question using the selected provider.
    """
    provider = _normalize_provider(session_data.get("llm_provider"))
    logger.info("[research_agent] answer_chat provider=%s", provider)

    if provider == "anthropic":
        if not _anthropic_enabled():
            if not OPENAI_API_KEY:
                return (
                    "Chat is not configured (missing Anthropic/OpenAI API keys). "
                    "Configure ANTHROPIC_API_KEY or OPENAI_API_KEY to enable chat."
                )
            logger.info(
                "[research_agent] answer_chat: falling back to OpenAI because Anthropic is not enabled"
            )
            provider = "openai"

    if provider == "openai":
        if not OPENAI_API_KEY:
            return "Chat is not configured (missing API key). Add OPENAI_API_KEY to enable."

    property_and_area = _build_property_and_area(session_data)
    context = _build_chat_context(session_data)
    system_content = CHAT_SYSTEM_TEMPLATE.format(
        property_and_area=property_and_area,
        context=context,
    )

    if provider == "openai":
        client = OpenAI(api_key=OPENAI_API_KEY)
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_content},
                    {"role": "user", "content": user_message},
                ],
            )
            reply = (response.choices[0].message.content or "").strip()
            logger.info("[research_agent] answer_chat (OpenAI) reply length=%s", len(reply))
            return reply or "I couldn't generate a response. Please try rephrasing."
        except Exception as e:
            logger.warning("[research_agent] answer_chat OpenAI error: %s", e)
            return f"Sorry, an error occurred: {e!s}"

    # Anthropic provider
    try:
        reply = _claude_query_blocking(prompt=user_message, system_prompt=system_content)
        logger.info("[research_agent] answer_chat (Anthropic) reply length=%s", len(reply))
        return reply or "I couldn't generate a response. Please try rephrasing."
    except Exception as e:
        logger.warning("[research_agent] answer_chat Anthropic error: %s", e)
        return f"Sorry, an error occurred: {e!s}"
