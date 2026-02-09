"""
Research Agent: calls LLM in batches to produce insight cards. Uses web search tool and structured JSON output.
"""
import json
import logging
from openai import OpenAI

from app.core.config import OPENAI_API_KEY
from app.schemas.insight_card import CARD_TOPICS, InsightCard, InsightCardBatch
from app.services.prompts import SYSTEM_MESSAGE, build_user_message

logger = logging.getLogger(__name__)

# Placeholders that are not acceptable for why_it_matters; we replace with context-based text
_WHY_IT_MATTERS_PLACEHOLDERS = frozenset({"n/a", "na", "—", "-", "none", "no data", ""})


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


# Web search tool definition for OpenAI (model can request search; we run it and return results)
WEB_SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": "Search the web for current market data, rental comps, demographics, or public records. Use when you need up-to-date information for the property or area.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
            },
            "required": ["query"],
        },
    },
}


def _run_web_search(query: str) -> str:
    """Placeholder: run web search. Replace with Tavily/Serper/Bing later."""
    logger.debug("[research_agent] web_search called: query=%s", query[:100])
    # TODO: integrate real search API
    return f"(Web search placeholder for: {query[:80]}...)"


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
) -> list[dict]:
    """
    Call LLM for one batch of cards (up to 5). Returns list of card dicts.
    Forces JSON output via structured output; uses web search tool.
    """
    logger.info("[research_agent] run_card_batch batch_index=%s topics=%s", batch_index, card_topics_batch)

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
    )
    logger.debug("[research_agent] user_message length=%s", len(user_message))

    client = OpenAI(api_key=OPENAI_API_KEY)
    messages = [
        {"role": "system", "content": SYSTEM_MESSAGE},
        {"role": "user", "content": user_message},
    ]

    logger.info("[research_agent] Calling OpenAI for batch %s", batch_index)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content or "{}"
    logger.debug("[research_agent] Raw response length=%s", len(content))

    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        logger.warning("[research_agent] JSON decode error: %s", e)
        return []

    raw_cards = data.get("cards", data) if isinstance(data.get("cards"), list) else []
    cards = []
    for i, c in enumerate(raw_cards):
        if not isinstance(c, dict):
            continue
        try:
            src = (c.get("source") or "Not available").strip()
            if src.lower() in ("web search", "websearch"):
                src = "Public data / Market sources"
            raw_url = c.get("source_url") or None
            if isinstance(raw_url, str):
                raw_url = raw_url.strip() or None
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
            logger.debug("[research_agent] Card validation error for item %s: %s", i, e)
            src = (c.get("source") or "Not available").strip()
            if src.lower() in ("web search", "websearch"):
                src = "Public data / Market sources"
            raw_url = c.get("source_url") or None
            if isinstance(raw_url, str):
                raw_url = raw_url.strip() or None
            title = c.get("title", f"Card {i+1}")
            why_it_matters = _normalize_why_it_matters(
                c.get("why_it_matters"), title, c.get("impact") or "neutral", analyze_as
            )
            cards.append({
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
            })
    logger.info("[research_agent] Got %s cards for batch %s", len(cards), batch_index)
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
) -> dict:
    """
    Produce dashboard summary from OpenAI: fair_market_rent, recommendations (ideal_term, negotiation_leverage, renewals), portfolio_context.
    Recommendations are derived by the LLM from the provided insight cards and document context (see RECOMMENDATIONS_FORMAT).
    When the API fails or there are no cards, returns _minimal_dashboard() with recommendations_source='fallback' and "—" for all recommendation fields.
    Response includes recommendations_source: 'openai' | 'fallback' so callers can verify origin.
    """
    logger.info("[research_agent] get_dashboard_summary: %s cards", len(cards))
    try:
        current = float(current_base_rent.replace(",", "").strip())
    except (ValueError, TypeError):
        current = 42.0

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

    client = OpenAI(api_key=OPENAI_API_KEY)
    models_to_try = [
        (DASHBOARD_SEARCH_MODEL, DASHBOARD_SYSTEM_WITH_SEARCH),
        (DASHBOARD_FALLBACK_MODEL, DASHBOARD_SYSTEM_NO_SEARCH),
    ]
    last_error = None
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
            comparison_pct = round((this_rent - avg_rent) / avg_rent * 100, 2) if avg_rent else 0.0
            comparison_text = str(port.get("comparison_text") or "").strip()
            if not comparison_text and avg_rent:
                comparison_text = f"This property's rent is {abs(comparison_pct):.2f}% {'below' if comparison_pct < 0 else 'above'} the average rent for similar properties."
            out = {
                "fair_market_rent": fair,
                "confidence_score": int(data.get("confidence_score", 0)),
                "vs_current_pct": vs_current_pct,
                "recommendations": {
                    "ideal_term": str(rec.get("ideal_term") or "—").strip() or "—",
                    "ideal_term_reasoning": str(rec.get("ideal_term_reasoning") or "").strip() or "",
                    "negotiation_leverage": str(rec.get("negotiation_leverage") or "—").strip() or "—",
                    "negotiation_leverage_reasoning": str(rec.get("negotiation_leverage_reasoning") or "").strip() or "",
                    "renewals": str(rec.get("renewals") or "—").strip() or "—",
                    "renewals_reasoning": str(rec.get("renewals_reasoning") or "").strip() or "",
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
                "[research_agent] dashboard summary from OpenAI (model=%s): fair_rent=%s vs_current_pct=%s confidence=%s | recommendations: ideal_term=%r negotiation_leverage=%r renewals=%r",
                model, out["fair_market_rent"], out["vs_current_pct"], out["confidence_score"],
                out["recommendations"]["ideal_term"], out["recommendations"]["negotiation_leverage"], out["recommendations"]["renewals"],
            )
            return out
        except json.JSONDecodeError as e:
            last_error = e
            logger.warning("[research_agent] get_dashboard_summary JSON error with %s: %s", model, e)
            continue
        except Exception as e:
            last_error = e
            logger.warning("[research_agent] get_dashboard_summary error with %s: %s", model, e)
            continue

    logger.warning("[research_agent] All dashboard LLM attempts failed; returning minimal dashboard")
    return _minimal_dashboard(current)


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
    a concise OpenAI reply to the user's question.
    """
    if not OPENAI_API_KEY:
        return "Chat is not configured (missing API key). Add OPENAI_API_KEY to enable."

    property_and_area = _build_property_and_area(session_data)
    context = _build_chat_context(session_data)
    system_content = CHAT_SYSTEM_TEMPLATE.format(
        property_and_area=property_and_area,
        context=context,
    )

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
        logger.info("[research_agent] answer_chat reply length=%s", len(reply))
        return reply or "I couldn't generate a response. Please try rephrasing."
    except Exception as e:
        logger.warning("[research_agent] answer_chat error: %s", e)
        return f"Sorry, an error occurred: {e!s}"
