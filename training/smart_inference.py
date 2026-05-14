"""Smart inference with local confidence checks, web fallback, and auto-learning."""

from __future__ import annotations

import json
import logging
import re
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import requests

from config import (
    ANSWER_CONTEXT_MAX_CHARS,
    AUTO_LEARN_QUALITY_SCORE,
    INFERENCE_STATS_PATH,
    LOCAL_CONFIDENCE_MIN_CHARS,
    LEGACY_AI_MODEL_NAME,
    RETRAIN_INTERVAL_HOURS,
    RETRAIN_THRESHOLD,
    SCRAPER_TIMEOUT_SECONDS,
    SCRAPER_USER_AGENT,
    SMART_INFERENCE_LOG_PATH,
    WEB_FALLBACK_RESULTS,
    WIKIPEDIA_API_URL,
    ensure_directories,
)
from pipeline.exporter import export_dataset
from pipeline.querier import query_local_ai
from pipeline.scraper import scrape_page
from pipeline.storage import (
    count_needs_training,
    get_stats,
    init_db,
    reset_needs_training_flags,
    save_to_db,
)
from pipeline.web_search import web_search


UNCERTAINTY_PHRASES = [
    "i don't know",
    "i do not know",
    "i'm not sure",
    "i am not sure",
    "i cannot answer",
    "i can't answer",
    "i have no information",
]

_MODEL_CACHE: tuple[Any, Any] | None = None
_SCHEDULER_STARTED = False


def setup_smart_inference_logging() -> None:
    """Configure file logging for smart inference and auto-learning events."""
    ensure_directories()
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    log_path = str(SMART_INFERENCE_LOG_PATH)
    if not any(
        isinstance(handler, logging.FileHandler)
        and getattr(handler, "baseFilename", None) == log_path
        for handler in logger.handlers
    ):
        file_handler = logging.FileHandler(SMART_INFERENCE_LOG_PATH, encoding="utf-8")
        file_handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))
        logger.addHandler(file_handler)


def _load_stats() -> dict[str, Any]:
    """Read inference stats from disk, returning a default state when missing."""
    ensure_directories()
    if not INFERENCE_STATS_PATH.exists():
        return {
            "total_answered": 0,
            "local_model": 0,
            "web_search": 0,
            "wikipedia": 0,
            "last_retrain_date": None,
        }
    try:
        return json.loads(INFERENCE_STATS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {
            "total_answered": 0,
            "local_model": 0,
            "web_search": 0,
            "wikipedia": 0,
            "last_retrain_date": None,
        }


def _save_stats(stats: dict[str, Any]) -> None:
    """Persist inference stats for the Gradio stats panel."""
    ensure_directories()
    INFERENCE_STATS_PATH.write_text(json.dumps(stats, indent=2), encoding="utf-8")


def _record_answer(source: str) -> None:
    """Increment answer counters after a pipeline response is produced."""
    stats = _load_stats()
    stats["total_answered"] = int(stats.get("total_answered", 0)) + 1
    stats[source] = int(stats.get(source, 0)) + 1
    _save_stats(stats)


def _mark_retrained() -> None:
    """Store the timestamp of the most recent successful retraining run."""
    stats = _load_stats()
    stats["last_retrain_date"] = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    _save_stats(stats)


def _get_or_load_model() -> tuple[Any, Any] | None:
    """Load the fine-tuned model once and reuse it across questions."""
    global _MODEL_CACHE
    if _MODEL_CACHE is not None:
        return _MODEL_CACHE
    try:
        from training.inference import _load_fine_tuned_model

        _MODEL_CACHE = _load_fine_tuned_model()
        return _MODEL_CACHE
    except Exception as exc:
        logging.warning("Fine-tuned model is unavailable: %s", exc)
        return None


def _run_model(model: Any, question: str) -> str:
    """Run a supplied model handle, cached model tuple, or callable on a question."""
    if callable(model):
        return str(model(question)).strip()

    model_bundle = model
    if model_bundle is None:
        model_bundle = _get_or_load_model()

    if not model_bundle:
        return "I don't know."

    local_model, tokenizer = model_bundle
    from training.inference import _generate_answer

    return _generate_answer(local_model, tokenizer, question).strip()


def _has_repetition(text: str) -> bool:
    """Detect repeated sentences, repeated n-grams, and low vocabulary variety."""
    normalized = re.sub(r"\s+", " ", text.lower()).strip()
    if not normalized:
        return False

    sentences = [sentence.strip() for sentence in re.split(r"[.!?]+", normalized) if sentence.strip()]
    if any(sentences.count(sentence) >= 3 for sentence in set(sentences)):
        return True

    words = re.findall(r"\w+", normalized)
    if len(words) >= 20 and len(set(words)) / len(words) < 0.35:
        return True

    four_grams = [" ".join(words[index : index + 4]) for index in range(max(0, len(words) - 3))]
    return any(four_grams.count(gram) >= 4 for gram in set(four_grams))


def check_confidence(model: Any, question: str) -> dict[str, Any]:
    """Run the fine-tuned model and flag uncertainty, short, or looping answers."""
    try:
        answer_text = _run_model(model, question)
    except Exception as exc:
        logging.warning("Local confidence check failed: %s", exc)
        answer_text = "I don't know."

    lowered = answer_text.lower()
    if any(phrase in lowered for phrase in UNCERTAINTY_PHRASES):
        return {"answer": answer_text, "confident": False, "reason": "uncertainty_phrase"}
    if len(answer_text.strip()) < LOCAL_CONFIDENCE_MIN_CHARS:
        return {"answer": answer_text, "confident": False, "reason": "too_short"}
    if _has_repetition(answer_text):
        return {"answer": answer_text, "confident": False, "reason": "repetition"}
    return {"answer": answer_text, "confident": True, "reason": "none"}


def search_for_answer(question: str) -> dict[str, Any]:
    """Search DuckDuckGo, scrape the top three accessible pages, and combine context."""
    sources: list[str] = []
    context_parts: list[str] = []

    for result in web_search(question, max_results=max(WEB_FALLBACK_RESULTS, 5)):
        if len(sources) >= WEB_FALLBACK_RESULTS:
            break
        url = result.get("url", "")
        page_text = scrape_page(url)
        if not page_text:
            continue
        sources.append(url)
        context_parts.append(page_text)

    context = "\n\n".join(context_parts)[:ANSWER_CONTEXT_MAX_CHARS]
    return {"sources": sources, "context": context}


def _answer_found(answer_text: str) -> bool:
    """Return True when a context-grounded answer is useful enough to save."""
    stripped = answer_text.strip()
    if not stripped:
        return False
    if stripped.lower().startswith("error:"):
        return False
    if stripped.lower() == "not found":
        return False
    if len(stripped) < LOCAL_CONFIDENCE_MIN_CHARS:
        return False
    return not _has_repetition(stripped)


def generate_from_context(question: str, context: str) -> dict[str, Any]:
    """Ask local Llama3 to answer using only supplied context."""
    if not context or not context.strip():
        return {"answer": "Not found", "sources": []}

    prompt = f"""
Use ONLY the context below to answer the question.
If the answer is not in the context, say "Not found".

Context: {context[:ANSWER_CONTEXT_MAX_CHARS]}

Question: {question}

Answer:
"""
    generated = query_local_ai(prompt, model=LEGACY_AI_MODEL_NAME).strip()
    if generated.startswith("ERROR:"):
        logging.warning("Context answer generation failed: %s", generated)
        return {"answer": "Not found", "sources": []}
    return {"answer": generated, "sources": []}


def auto_learn(
    question: str,
    answer: str,
    sources: list[str],
    source: str = "web_search",
) -> bool:
    """Save a newly learned Q&A pair to SQLite and flag it for retraining."""
    init_db()
    sources_json = json.dumps(sources, ensure_ascii=False)
    return save_to_db(
        question=question,
        answer=answer,
        model_name=LEGACY_AI_MODEL_NAME,
        topic="auto_learning",
        source=source,
        needs_training=True,
        sources_urls=sources_json,
        quality_score=AUTO_LEARN_QUALITY_SCORE,
    )


def _search_wikipedia_context(question: str) -> dict[str, Any]:
    """Search Wikipedia directly and return article text plus the article URL."""
    try:
        import wikipediaapi

        response = requests.get(
            WIKIPEDIA_API_URL,
            params={
                "action": "opensearch",
                "search": question,
                "limit": 1,
                "namespace": 0,
                "format": "json",
            },
            headers={"User-Agent": SCRAPER_USER_AGENT},
            timeout=SCRAPER_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
        titles = payload[1] if len(payload) > 1 else []
        urls = payload[3] if len(payload) > 3 else []
        if not titles:
            return {"sources": [], "context": ""}

        wiki = wikipediaapi.Wikipedia(user_agent=SCRAPER_USER_AGENT, language="en")
        page = wiki.page(titles[0])
        if not page.exists():
            return {"sources": [], "context": ""}

        context = f"{page.title}\n\n{page.summary}\n\n{page.text}"
        source_url = urls[0] if urls else page.fullurl
        return {"sources": [source_url], "context": context[:ANSWER_CONTEXT_MAX_CHARS]}
    except ImportError:
        logging.warning("wikipedia-api is not installed; Wikipedia fallback is unavailable.")
    except Exception as exc:
        logging.warning("Wikipedia fallback failed for '%s': %s", question, exc)
    return {"sources": [], "context": ""}


def _response_object(
    question: str,
    answer_text: str,
    source: str,
    confident: bool,
    urls: list[str] | None = None,
    saved_to_db: bool = False,
) -> dict[str, Any]:
    """Build the normalized response object returned by the smart pipeline."""
    return {
        "question": question,
        "answer": answer_text,
        "source": source,
        "confident": confident,
        "urls": urls or [],
        "saved_to_db": saved_to_db,
    }


def answer(question: str) -> dict[str, Any]:
    """Answer a question locally, then via web search, then via Wikipedia fallback."""
    setup_smart_inference_logging()
    init_db()

    if not question or not question.strip():
        return _response_object("", "Please enter a question.", "local_model", False)

    clean_question = question.strip()
    local_check = check_confidence(None, clean_question)
    if local_check["confident"]:
        _record_answer("local_model")
        logging.info("question=%r source=local_model timestamp=%s", clean_question, datetime.utcnow())
        return _response_object(
            clean_question,
            str(local_check["answer"]),
            "local_model",
            True,
            saved_to_db=False,
        )

    web_result = search_for_answer(clean_question)
    web_answer = generate_from_context(clean_question, str(web_result["context"]))
    if _answer_found(str(web_answer["answer"])):
        saved = auto_learn(
            clean_question,
            str(web_answer["answer"]),
            list(web_result["sources"]),
            source="web_search",
        )
        _record_answer("web_search")
        logging.info("question=%r source=web_search timestamp=%s", clean_question, datetime.utcnow())
        check_retrain_needed()
        return _response_object(
            clean_question,
            str(web_answer["answer"]),
            "web_search",
            True,
            urls=list(web_result["sources"]),
            saved_to_db=saved,
        )

    wikipedia_result = _search_wikipedia_context(clean_question)
    wikipedia_answer = generate_from_context(clean_question, str(wikipedia_result["context"]))
    if _answer_found(str(wikipedia_answer["answer"])):
        saved = auto_learn(
            clean_question,
            str(wikipedia_answer["answer"]),
            list(wikipedia_result["sources"]),
            source="wikipedia",
        )
        _record_answer("wikipedia")
        logging.info("question=%r source=wikipedia timestamp=%s", clean_question, datetime.utcnow())
        check_retrain_needed()
        return _response_object(
            clean_question,
            str(wikipedia_answer["answer"]),
            "wikipedia",
            True,
            urls=list(wikipedia_result["sources"]),
            saved_to_db=saved,
        )

    _record_answer("web_search")
    logging.info("question=%r source=not_found timestamp=%s", clean_question, datetime.utcnow())
    return _response_object(
        clean_question,
        "Not found",
        "web_search",
        False,
        urls=list(web_result["sources"]) or list(wikipedia_result["sources"]),
        saved_to_db=False,
    )


def check_retrain_needed(force: bool = False) -> dict[str, Any]:
    """Retrain when at least 50 newly learned Q&A pairs are waiting."""
    setup_smart_inference_logging()
    init_db()
    pending_count = count_needs_training()
    if pending_count < RETRAIN_THRESHOLD and not force:
        return {"retrained": False, "pending": pending_count, "reason": "below_threshold"}
    if pending_count == 0:
        return {"retrained": False, "pending": 0, "reason": "no_new_examples"}

    export_dataset(min_score=0.0)
    from training.finetune import fine_tune_model

    final_model_path = fine_tune_model()
    reset_needs_training_flags()
    _mark_retrained()
    logging.info("Model retrained on %s new examples", pending_count)
    return {
        "retrained": True,
        "pending": pending_count,
        "model_path": final_model_path,
    }


def start_retrain_scheduler(blocking: bool = False) -> None:
    """Schedule the retraining check every 24 hours with the schedule library."""
    global _SCHEDULER_STARTED
    if _SCHEDULER_STARTED:
        return

    import schedule

    schedule.every(RETRAIN_INTERVAL_HOURS).hours.do(check_retrain_needed)
    _SCHEDULER_STARTED = True

    def _run_forever() -> None:
        while True:
            schedule.run_pending()
            time.sleep(60)

    if blocking:
        _run_forever()
    else:
        thread = threading.Thread(target=_run_forever, daemon=True)
        thread.start()


def force_retrain_now() -> dict[str, Any]:
    """Force retraining from the UI even when fewer than 50 rows are pending."""
    return check_retrain_needed(force=True)


def get_inference_stats() -> dict[str, Any]:
    """Return runtime answer stats combined with database counts."""
    stats = _load_stats()
    total_answered = int(stats.get("total_answered", 0))
    db_stats = get_stats()
    local_count = int(stats.get("local_model", 0))
    web_count = int(stats.get("web_search", 0))

    return {
        "total_questions_answered": total_answered,
        "percent_answered_locally": round((local_count / total_answered) * 100, 2)
        if total_answered
        else 0.0,
        "percent_needed_web_search": round((web_count / total_answered) * 100, 2)
        if total_answered
        else 0.0,
        "total_pairs_in_database": db_stats["total_count"],
        "last_retrain_date": stats.get("last_retrain_date") or "Never",
        "pending_training_pairs": db_stats.get("needs_training_count", 0),
    }
