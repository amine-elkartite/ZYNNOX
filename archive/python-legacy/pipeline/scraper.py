"""Ethical, robots-aware web page scraping utilities."""

from __future__ import annotations

import logging
import random
import re
import time
from collections import defaultdict
from typing import Any
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup

from config import (
    BLACKLISTED_DOMAINS,
    DOMAIN_DELAY_SECONDS,
    MAX_PAGES_PER_DOMAIN,
    PAGE_DELAY_RANGE_SECONDS,
    SCRAPER_TIMEOUT_SECONDS,
    SCRAPER_USER_AGENT,
)


_ROBOTS_CACHE: dict[str, RobotFileParser | None] = {}
_DOMAIN_REQUEST_COUNTS: dict[str, int] = defaultdict(int)
_LAST_DOMAIN_REQUEST_AT: dict[str, float] = {}
_LAST_REQUEST_DOMAIN: str | None = None


def _domain_from_url(url: str) -> str:
    """Extract a normalized hostname from a URL for policy and rate checks."""
    parsed = urlparse(url)
    return (parsed.netloc or "").lower().removeprefix("www.")


def _is_blacklisted(domain: str) -> bool:
    """Return True when the domain is in the never-scrape blacklist."""
    return any(domain == blocked or domain.endswith(f".{blocked}") for blocked in BLACKLISTED_DOMAINS)


def _realistic_user_agent() -> str:
    """Return a realistic User-Agent, falling back when fake-useragent is unavailable."""
    try:
        from fake_useragent import UserAgent

        return UserAgent().random
    except Exception:
        return SCRAPER_USER_AGENT


def _robots_parser(url: str) -> RobotFileParser | None:
    """Fetch and cache a site's robots.txt parser before any page request."""
    parsed = urlparse(url)
    root_url = f"{parsed.scheme}://{parsed.netloc}"
    if root_url in _ROBOTS_CACHE:
        return _ROBOTS_CACHE[root_url]

    robots_url = urljoin(root_url, "/robots.txt")
    parser = RobotFileParser()
    parser.set_url(robots_url)
    try:
        parser.read()
        _ROBOTS_CACHE[root_url] = parser
        return parser
    except Exception as exc:
        logging.info("Could not read robots.txt for %s: %s", root_url, exc)
        _ROBOTS_CACHE[root_url] = None
        return None


def _robots_allows(url: str, user_agent: str) -> bool:
    """Check robots.txt and deny scraping if the policy cannot be confirmed."""
    parser = _robots_parser(url)
    if parser is None:
        return False
    try:
        return parser.can_fetch(user_agent, url)
    except Exception as exc:
        logging.info("robots.txt check failed for %s: %s", url, exc)
        return False


def _respect_scraping_rate_limit(domain: str) -> bool:
    """Apply page delay, domain switching delay, and max pages per domain."""
    global _LAST_REQUEST_DOMAIN

    if _DOMAIN_REQUEST_COUNTS[domain] >= MAX_PAGES_PER_DOMAIN:
        logging.info("Skipping %s because the domain page cap was reached.", domain)
        return False

    if _LAST_REQUEST_DOMAIN and _LAST_REQUEST_DOMAIN != domain:
        time.sleep(DOMAIN_DELAY_SECONDS)

    last_domain_at = _LAST_DOMAIN_REQUEST_AT.get(domain)
    if last_domain_at is not None:
        elapsed = time.monotonic() - last_domain_at
        minimum_wait = random.uniform(*PAGE_DELAY_RANGE_SECONDS)
        if elapsed < minimum_wait:
            time.sleep(minimum_wait - elapsed)

    _LAST_REQUEST_DOMAIN = domain
    _LAST_DOMAIN_REQUEST_AT[domain] = time.monotonic()
    _DOMAIN_REQUEST_COUNTS[domain] += 1
    return True


def _remove_noisy_elements(soup: BeautifulSoup) -> None:
    """Remove common layout, navigation, advertising, and executable elements."""
    noisy_selectors = [
        "script",
        "style",
        "noscript",
        "iframe",
        "svg",
        "canvas",
        "form",
        "button",
        "nav",
        "header",
        "footer",
        "aside",
        "[role='navigation']",
        "[role='banner']",
        "[role='contentinfo']",
        "[class*='advert']",
        "[class*='cookie']",
        "[class*='menu']",
        "[class*='sidebar']",
        "[id*='advert']",
        "[id*='cookie']",
        "[id*='menu']",
        "[id*='sidebar']",
    ]
    for element in soup.select(",".join(noisy_selectors)):
        element.decompose()


def _clean_extracted_text(raw_text: str) -> str:
    """Normalize extracted visible text without applying training-quality filters."""
    lines = [line.strip() for line in raw_text.splitlines()]
    useful_lines = [line for line in lines if len(line.split()) >= 3]
    text = "\n".join(useful_lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def _extract_main_text(html: str) -> str:
    """Extract the most article-like visible text from a page of HTML."""
    soup = BeautifulSoup(html, "html.parser")
    _remove_noisy_elements(soup)
    candidates = soup.select("article, main, [role='main']")
    container: Any = max(candidates, key=lambda tag: len(tag.get_text(" ", strip=True)), default=soup.body or soup)
    return _clean_extracted_text(container.get_text("\n", strip=True))


def scrape_page(url: str) -> str | None:
    """Scrape a URL into clean plain text while respecting robots and bot blocks.

    Pages returning 403, 429, or 503 are skipped. The request uses a realistic
    User-Agent and a hard ten-second timeout to prevent the pipeline from
    stalling on slow or hostile sites.
    """
    if not url or not url.strip():
        return None

    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        logging.info("Skipping invalid or unsupported URL: %s", url)
        return None

    domain = _domain_from_url(url)
    if _is_blacklisted(domain):
        logging.info("Skipping blacklisted domain: %s", domain)
        return None

    user_agent = _realistic_user_agent()
    if not _robots_allows(url, user_agent):
        logging.info("Skipping %s because robots.txt does not allow it.", url)
        return None

    if not _respect_scraping_rate_limit(domain):
        return None

    try:
        response = requests.get(
            url,
            headers={"User-Agent": user_agent, "Accept": "text/html,application/xhtml+xml"},
            timeout=SCRAPER_TIMEOUT_SECONDS,
        )
        if response.status_code in {403, 429, 503}:
            logging.info("Skipping bot-blocked page %s with status %s.", url, response.status_code)
            return None
        response.raise_for_status()

        content_type = response.headers.get("content-type", "").lower()
        if "html" not in content_type and "text" not in content_type:
            logging.info("Skipping non-text page %s with content-type %s.", url, content_type)
            return None

        return _extract_main_text(response.text)
    except requests.Timeout:
        logging.warning("Timed out scraping %s.", url)
    except requests.RequestException as exc:
        logging.warning("Request failed while scraping %s: %s", url, exc)
    except Exception as exc:
        logging.warning("Unexpected scrape failure for %s: %s", url, exc)
    return None
