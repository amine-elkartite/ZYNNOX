"""Integrated web collection pipeline for turning source text into Q&A rows."""

from __future__ import annotations

import logging
import re
from typing import Any, Iterable

from config import (
    DEFAULT_REDDIT_SUBREDDITS,
    OLLAMA_MODEL,
    SCRAPING_LOG_PATH,
    WEB_QA_MODEL_NAME,
    WEB_QA_PROMPT_TEMPLATE,
    ensure_directories,
)
from pipeline.cleaner import clean_content
from pipeline.dedupe import deduplicate
from pipeline.querier import query_local_ai
from pipeline.scraper import scrape_page
from pipeline.sources import scrape_arxiv, scrape_reddit, scrape_wikipedia
from pipeline.storage import init_db, save_to_db
from pipeline.web_search import web_search


def setup_scraping_logging() -> None:
    """Configure logging to scraping.log without disturbing existing handlers."""
    ensure_directories()
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)

    log_path = str(SCRAPING_LOG_PATH)
    if not any(
        isinstance(handler, logging.FileHandler)
        and getattr(handler, "baseFilename", None) == log_path
        for handler in logger.handlers
    ):
        file_handler = logging.FileHandler(SCRAPING_LOG_PATH, encoding="utf-8")
        file_handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))
        logger.addHandler(file_handler)


def _record_content(record: dict[str, Any]) -> str:
    """Build a single plain text blob from a source record's useful fields."""
    parts = [
        str(record.get("title") or ""),
        str(record.get("summary") or ""),
        str(record.get("question") or ""),
        str(record.get("accepted_answer") or ""),
        str(record.get("content") or ""),
    ]
    return "\n\n".join(part for part in parts if part.strip())


def _collect_topic_texts(topic: str, n_per_source: int) -> list[str]:
    """Collect raw text for a topic from search results, Wikipedia, Reddit, and arXiv."""
    raw_texts: list[str] = []

    logging.info("Searching DuckDuckGo for topic: %s", topic)
    for result in web_search(topic, max_results=n_per_source):
        text = scrape_page(result["url"])
        if text:
            raw_texts.append(text)

    logging.info("Collecting Wikipedia articles for topic: %s", topic)
    raw_texts.extend(_record_content(record) for record in scrape_wikipedia(topic, n_per_source))

    logging.info("Collecting arXiv papers for topic: %s", topic)
    raw_texts.extend(_record_content(record) for record in scrape_arxiv(topic, n_per_source))

    for subreddit in DEFAULT_REDDIT_SUBREDDITS:
        logging.info("Collecting Reddit posts from r/%s for topic context: %s", subreddit, topic)
        for record in scrape_reddit(subreddit, max_posts=n_per_source):
            combined = _record_content(record)
            if topic.lower() in combined.lower():
                raw_texts.append(combined)

    return raw_texts


def _content_to_qa_pairs(content: str) -> list[dict[str, str]]:
    """Ask local Llama3 to convert source text into five Q&A pairs."""
    prompt = WEB_QA_PROMPT_TEMPLATE.format(content=content[:6000])
    response = query_local_ai(prompt, model=OLLAMA_MODEL)
    if response.startswith("ERROR:"):
        logging.warning("Q&A generation failed: %s", response)
        return []
    return parse_qa_pairs(response)


def parse_qa_pairs(text: str) -> list[dict[str, str]]:
    """Parse Llama output formatted as repeated Q:/A: question-answer pairs."""
    if not text:
        return []

    pattern = re.compile(
        r"Q:\s*(?P<question>.*?)(?:\n|\r\n)A:\s*(?P<answer>.*?)(?=\n\s*Q:|\Z)",
        re.IGNORECASE | re.DOTALL,
    )
    pairs: list[dict[str, str]] = []
    for match in pattern.finditer(text.strip()):
        question = re.sub(r"\s+", " ", match.group("question")).strip(" -")
        answer = re.sub(r"\s+", " ", match.group("answer")).strip(" -")
        if question and answer:
            pairs.append({"question": question, "answer": answer})
    return pairs


def _clean_and_dedupe(raw_texts: Iterable[str]) -> list[str]:
    """Clean, language-filter, and near-deduplicate collected source texts."""
    cleaned = []
    for raw_text in raw_texts:
        content = clean_content(raw_text)
        if content:
            cleaned.append(content)
    return deduplicate(cleaned)


def run_web_collection(topics: list[str], n_per_source: int = 50) -> dict[str, int]:
    """Collect web content, generate Q&A pairs with Llama3, and save them to SQLite."""
    setup_scraping_logging()
    init_db()

    stats = {
        "topics": len(topics),
        "raw_texts": 0,
        "clean_texts": 0,
        "qa_pairs": 0,
        "saved": 0,
        "skipped_duplicates": 0,
    }

    for topic in topics:
        try:
            logging.info("Starting web collection for topic: %s", topic)
            raw_texts = _collect_topic_texts(topic, n_per_source)
            stats["raw_texts"] += len(raw_texts)

            clean_texts = _clean_and_dedupe(raw_texts)
            stats["clean_texts"] += len(clean_texts)

            for content in clean_texts:
                pairs = _content_to_qa_pairs(content)
                stats["qa_pairs"] += len(pairs)
                for pair in pairs:
                    saved = save_to_db(
                        pair["question"],
                        pair["answer"],
                        WEB_QA_MODEL_NAME,
                        topic,
                    )
                    if saved:
                        stats["saved"] += 1
                    else:
                        stats["skipped_duplicates"] += 1
            logging.info("Finished web collection for topic '%s': %s", topic, stats)
        except Exception as exc:
            logging.exception("Web collection failed for topic '%s': %s", topic, exc)

    return stats
