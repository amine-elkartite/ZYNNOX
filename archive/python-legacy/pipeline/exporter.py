"""Dataset export helpers for supervised fine-tuning."""

from __future__ import annotations

import json
import random
from pathlib import Path

from config import (
    DATA_DIR,
    DATASET_PATH,
    DATASET_TRAIN_PATH,
    DATASET_VAL_PATH,
    MIN_EXPORT_SCORE,
    RANDOM_SEED,
    ensure_directories,
)
from pipeline.storage import get_all_pairs


def _resolve_output_path(output_file: str | Path) -> Path:
    """Resolve dataset output paths relative to the data directory by default."""
    path = Path(output_file)
    if path.is_absolute():
        return path
    return DATA_DIR / path


def _write_json(path: Path, records: list[dict[str, str]]) -> None:
    """Write records as pretty JSON with UTF-8 encoding."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")


def export_dataset(
    output_file: str | Path = DATASET_PATH.name,
    min_score: float = MIN_EXPORT_SCORE,
) -> dict[str, int | str]:
    """Export high-quality rows and create 90/10 train and validation splits."""
    ensure_directories()
    output_path = _resolve_output_path(output_file)
    pairs = get_all_pairs()
    records = [
        {
            "prompt": str(pair["question"]),
            "response": str(pair["answer"]),
            "topic": str(pair["topic"] or "unknown"),
        }
        for pair in pairs
        if float(pair.get("quality_score") or 0.0) >= min_score
    ]

    rng = random.Random(RANDOM_SEED)
    rng.shuffle(records)

    if len(records) <= 1:
        train_records = records
        val_records: list[dict[str, str]] = []
    else:
        split_index = max(1, int(len(records) * 0.9))
        train_records = records[:split_index]
        val_records = records[split_index:]

    _write_json(output_path, records)
    _write_json(DATASET_TRAIN_PATH, train_records)
    _write_json(DATASET_VAL_PATH, val_records)

    return {
        "dataset_file": str(output_path),
        "total_records": len(records),
        "train_records": len(train_records),
        "validation_records": len(val_records),
    }
