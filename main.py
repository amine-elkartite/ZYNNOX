"""End-to-end pipeline entry point for collection, filtering, export, and training."""

from __future__ import annotations

import logging

from config import (
    DEFAULT_QUESTION_COUNT,
    DEFAULT_TOPICS,
    OLLAMA_MODEL,
    PIPELINE_LOG_PATH,
    ensure_directories,
)
from pipeline.exporter import export_dataset
from pipeline.filter import filter_quality
from pipeline.generator import generate_questions
from pipeline.querier import query_local_ai
from pipeline.storage import get_stats, init_db, question_exists, save_to_db
from training.finetune import fine_tune_model
from training.inference import test_model


def setup_logging() -> None:
    """Configure file and console logging for pipeline activity."""
    ensure_directories()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
        handlers=[
            logging.FileHandler(PIPELINE_LOG_PATH, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )


def run_collection_pipeline(
    topics: list[str],
    n_questions: int = 100,
) -> dict[str, int]:
    """Generate questions, query Ollama, skip duplicates, and save answers."""
    from tqdm import tqdm

    setup_logging()
    init_db()
    generated_questions = generate_questions(topics, n_questions)
    saved = 0
    skipped = 0
    failed = 0

    logging.info("Generated %s questions across %s topics.", len(generated_questions), len(topics))

    for item in tqdm(generated_questions, desc="Collecting answers", unit="question"):
        try:
            if question_exists(item.question):
                skipped += 1
                logging.info("Skipping duplicate question: %s", item.question)
                continue

            answer = query_local_ai(item.question, model=OLLAMA_MODEL)
            if answer.startswith("ERROR:"):
                failed += 1
                logging.warning("Ollama query failed for question: %s | %s", item.question, answer)

            if save_to_db(item.question, answer, OLLAMA_MODEL, item.topic):
                saved += 1
                logging.info("Saved Q&A pair for topic '%s'.", item.topic)
            else:
                skipped += 1
        except Exception as exc:
            failed += 1
            logging.exception("Failed to process question '%s': %s", item.question, exc)

    stats = {"saved": saved, "skipped": skipped, "failed": failed}
    logging.info("Collection complete: %s", stats)
    return stats


def main() -> None:
    """Run the requested full project pipeline from database setup through inference."""
    setup_logging()
    init_db()

    try:
        collection_stats = run_collection_pipeline(
            topics=DEFAULT_TOPICS,
            n_questions=DEFAULT_QUESTION_COUNT,
        )
        logging.info("Collection stats: %s", collection_stats)

        quality_stats = filter_quality()
        logging.info("Quality stats: %s", quality_stats)

        export_stats = export_dataset()
        logging.info("Export stats: %s", export_stats)
        logging.info("Database stats: %s", get_stats())

        if int(export_stats["train_records"]) == 0:
            logging.warning("No training records exported; skipping fine-tuning and inference.")
            return

        final_model_path = fine_tune_model()
        logging.info("Fine-tuned model saved to: %s", final_model_path)
        test_model("What is artificial intelligence?")
    except Exception as exc:
        logging.exception("Main pipeline failed gracefully: %s", exc)


if __name__ == "__main__":
    main()
