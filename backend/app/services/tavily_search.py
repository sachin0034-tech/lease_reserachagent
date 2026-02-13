"""
Tavily web search: returns real URLs and content so the LLM can cite actual sources.
Used by the research agent to ensure each card's source_url is a URL we fetched (no hallucination).
"""
import logging
from typing import Any

from app.core.config import TAVILY_API_KEY

logger = logging.getLogger(__name__)

_tavily_client: Any = None


def _get_client():
    global _tavily_client
    if _tavily_client is not None:
        return _tavily_client
    if not TAVILY_API_KEY:
        return None
    try:
        from tavily import TavilyClient
    except ImportError:
        logger.debug("[tavily] tavily-python not installed; web search disabled")
        return None
    try:
        _tavily_client = TavilyClient(api_key=TAVILY_API_KEY)
        return _tavily_client
    except Exception as e:
        logger.warning("[tavily] TavilyClient init failed: %s", e)
        return None


def search_tavily(
    query: str,
    max_results: int = 10,
    search_depth: str = "basic",
) -> list[dict[str, str]]:
    """
    Run a Tavily search and return a list of {title, url, content} for each result.
    Used so the LLM can only cite these URLs (no invented links).
    """
    client = _get_client()
    if not client:
        return []
    try:
        response = client.search(
            query=query,
            max_results=max_results,
            search_depth=search_depth,
            include_answer=False,
        )
        results = response.get("results", []) if isinstance(response, dict) else getattr(response, "results", [])
        out = []
        seen_urls = set()
        for r in results:
            if isinstance(r, dict):
                url = (r.get("url") or "").strip()
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                title = (r.get("title") or "").strip() or url
                content = (r.get("content") or "").strip() or ""
                out.append({"title": title, "url": url, "content": content[:2000]})
            else:
                url = getattr(r, "url", None) or ""
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                title = (getattr(r, "title", None) or "").strip() or url
                content = (getattr(r, "content", None) or "").strip() or ""
                out.append({"title": title, "url": url, "content": content[:2000]})
        logger.info("[tavily] query=%s returned %s results", query[:80], len(out))
        return out
    except Exception as e:
        logger.warning("[tavily] search failed: %s", e)
        return []


def search_for_batch(
    address: str,
    property_name: str,
    card_topics_batch: list[str],
    max_results_per_query: int = 6,
) -> list[dict[str, str]]:
    """
    Run one Tavily search per topic in the batch (so results are relevant per card).
    Deduplicate by URL and return a single list of {title, url, content}.
    This list is then passed to the LLM so it can ONLY use these sources for each card.
    """
    if not TAVILY_API_KEY or not _get_client():
        return []
    seen_urls: set[str] = set()
    combined: list[dict[str, str]] = []
    for topic in card_topics_batch:
        topic_short = topic.split(" (")[0].strip() if " (" in topic else topic
        query = f"{address} {property_name} {topic_short} retail lease market rent data"
        results = search_tavily(query, max_results=max_results_per_query)
        for r in results:
            url = r.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                combined.append(r)
    return combined
