"""DuckDuckGo web search utilities for discovering candidate source pages."""

from __future__ import annotations

import logging
import time
from threading import Lock
from typing import Any

from config import WEB_SEARCH_DELAY_SECONDS, WEB_SEARCH_MAX_RESULTS


_SEARCH_LOCK = Lock()
_LAST_SEARCH_AT = 0.0


def _respect_search_rate_limit() -> None:
    """Wait long enough to keep DuckDuckGo searches at least two seconds apart."""
    global _LAST_SEARCH_AT
    with _SEARCH_LOCK:
        elapsed = time.monotonic() - _LAST_SEARCH_AT
        wait_seconds = WEB_SEARCH_DELAY_SECONDS - elapsed
        if wait_seconds > 0:
            time.sleep(wait_seconds)
        _LAST_SEARCH_AT = time.monotonic()


def _load_ddgs() -> Any:
    """Import the DuckDuckGo search client with a fallback for the renamed package."""
    try:
        from duckduckgo_search import DDGS

        return DDGS
    except ImportError:
        from ddgs import DDGS

        return DDGS


def _normalize_result(result: dict[str, Any]) -> dict[str, str]:
    """Convert DuckDuckGo result keys into the project's title/url/snippet schema."""
    return {
        "title": str(result.get("title") or "").strip(),
        "url": str(result.get("href") or result.get("url") or "").strip(),
        "snippet": str(result.get("body") or result.get("snippet") or "").strip(),
    }


def web_search(query: str, max_results: int = WEB_SEARCH_MAX_RESULTS) -> list[dict[str, str]]:
    """Search DuckDuckGo and return title, URL, and snippet dictionaries.

    The function requires no API key. It enforces a two-second delay between
    calls, catches client and network failures, and returns an empty list when
    search cannot be completed safely.
    """
    if not query or not query.strip():
        logging.warning("web_search called with an empty query.")
        return []

    _respect_search_rate_limit()
    try:
        DDGS = _load_ddgs()
        with DDGS() as client:
            results = client.text(
                query.strip(),
                region="wt-wt",
                safesearch="moderate",
                max_results=max_results,
            )
            normalized = [_normalize_result(result) for result in results]
            return [item for item in normalized if item["url"]]
    except Exception as exc:
        logging.warning("DuckDuckGo search failed for query '%s': %s", query, exc)
        return []
