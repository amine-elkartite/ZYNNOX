"""Training content cleaning and language filtering."""

from __future__ import annotations

import logging
import re

from bs4 import BeautifulSoup

from config import MIN_CONTENT_WORDS, TARGET_LANGUAGE


def _detect_language(text: str) -> str | None:
    """Detect the text language, returning None when detection is inconclusive."""
    try:
        from langdetect import LangDetectException, detect
    except ImportError:
        logging.warning("langdetect is not installed; content language cannot be verified.")
        return None

    try:
        return detect(text)
    except LangDetectException:
        return None
    except Exception as exc:
        logging.warning("Language detection failed: %s", exc)
        return None


def _strip_html_if_present(raw_text: str) -> str:
    """Remove HTML tags when upstream sources provide HTML snippets or bodies."""
    if "<" not in raw_text or ">" not in raw_text:
        return raw_text
    soup = BeautifulSoup(raw_text, "html.parser")
    for element in soup.select("script, style, noscript"):
        element.decompose()
    return soup.get_text(" ", strip=True)


def clean_content(raw_text: str) -> str | None:
    """Clean raw text and keep only valid English training content.

    The cleaner removes URLs, emails, phone numbers, unusual symbols, and
    excessive whitespace. Content below the configured minimum word count or
    outside the target language is rejected with ``None``.
    """
    if not raw_text or not raw_text.strip():
        return None

    text = _strip_html_if_present(raw_text)
    text = re.sub(r"https?://\S+|www\.\S+", " ", text)
    text = re.sub(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b", " ", text)
    text = re.sub(r"\+?\d[\d\s().-]{7,}\d", " ", text)
    text = re.sub(r"[^A-Za-z0-9.,;:!?()'\"%/\-\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    if len(text.split()) < MIN_CONTENT_WORDS:
        return None

    detected_language = _detect_language(text[:5000])
    if detected_language != TARGET_LANGUAGE:
        logging.info(
            "Skipping content with detected language '%s'; target is '%s'.",
            detected_language,
            TARGET_LANGUAGE,
        )
        return None

    return text
