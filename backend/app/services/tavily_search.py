"""
Tavily web search: returns real URLs and content so the LLM can cite actual sources.
Used by the research agent to ensure each card's source_url is a URL we fetched (no hallucination).
"""
import logging
import os
import time
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from app.core.config import BACKEND_ROOT

logger = logging.getLogger(__name__)

_env_path = BACKEND_ROOT / ".env"
_tavily_client: Any = None
_tavily_client_key: str | None = None  # key used to build cached client
_last_tavily_call_time: float = 0
# Minimum seconds between Tavily API calls to avoid rate limit (excessive requests)
TAVILY_THROTTLE_SECONDS = 2.0


def _get_tavily_key() -> str | None:
    """Read TAVILY_API_KEY from env and .env file so updates to .env are picked up without restart."""
    load_dotenv(_env_path, override=True)
    raw = (os.environ.get("TAVILY_API_KEY") or "").strip().strip("'\"")
    if raw and raw not in {"sk-...", "sk-ant-..."}:
        return raw
    if _env_path.exists():
        try:
            text = _env_path.read_text(encoding="utf-8-sig").strip()
            for line in text.splitlines():
                line = line.strip()
                if line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                if key.strip() == "TAVILY_API_KEY":
                    v = value.strip().strip("'\"").strip()
                    return v if v and v not in {"sk-...", "sk-ant-..."} else None
        except Exception:
            pass
    return None


def _get_client():
    global _tavily_client, _tavily_client_key
    current_key = _get_tavily_key()
    if not current_key:
        return None
    # If the key changed (e.g. .env updated), clear cache so we use the new key
    if _tavily_client is not None and _tavily_client_key != current_key:
        _tavily_client = None
        _tavily_client_key = None
        logger.info("[tavily] API key changed; using new key")
    if _tavily_client is not None:
        return _tavily_client
    try:
        from tavily import TavilyClient
        _tavily_client = TavilyClient(api_key=current_key)
        _tavily_client_key = current_key
        return _tavily_client
    except Exception as e:
        logger.warning("[tavily] TavilyClient init failed: %s", e)
        return None


def _throttle():
    """Ensure we don't call Tavily more than once per TAVILY_THROTTLE_SECONDS."""
    global _last_tavily_call_time
    elapsed = time.monotonic() - _last_tavily_call_time
    if elapsed < TAVILY_THROTTLE_SECONDS:
        time.sleep(TAVILY_THROTTLE_SECONDS - elapsed)
    _last_tavily_call_time = time.monotonic()


def search_tavily(
    query: str,
    max_results: int = 10,
    search_depth: str = "basic",
) -> list[dict[str, str]]:
    """
    Run a Tavily search and return a list of {title, url, content} for each result.
    Used so the LLM can only cite these URLs (no invented links).
    Throttled to avoid "excessive requests" / rate limit.
    """
    client = _get_client()
    if not client:
        return []
    _throttle()
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
    if not _get_client():
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
