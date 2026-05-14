"""Quality filtering and scoring for collected Q&A pairs."""

from __future__ import annotations

import re
from typing import Any

from config import MAX_ANSWER_LENGTH, MIN_ANSWER_LENGTH
from pipeline.storage import delete_pair, get_all_pairs, update_quality_score


ERROR_PATTERNS = [
    "error:",
    "timeout",
    "connection error",
    "connection refused",
    "legacy ai returned",
    "request failure",
    "invalid json",
]


def _contains_error_message(answer: str) -> bool:
    """Detect answers produced by failed API calls rather than the model."""
    lowered = answer.lower()
    return any(pattern in lowered for pattern in ERROR_PATTERNS)


def _length_score(answer: str) -> float:
    """Score answer length with the preferred range centered on 100-500 chars."""
    length = len(answer)
    if 100 <= length <= 500:
        return 1.0
    if length < 100:
        return max(0.0, length / 100)
    if length <= MAX_ANSWER_LENGTH:
        return max(0.0, 1 - ((length - 500) / (MAX_ANSWER_LENGTH - 500)))
    return 0.0


def _structure_score(answer: str) -> float:
    """Score answers higher when they contain paragraphs, bullets, or numbered lists."""
    has_paragraphs = "\n\n" in answer.strip()
    has_bullets = bool(re.search(r"(^|\n)\s*[-*]\s+\S+", answer))
    has_numbered_list = bool(re.search(r"(^|\n)\s*\d+[.)]\s+\S+", answer))
    sentence_count = len(re.findall(r"[.!?](\s|$)", answer))

    if has_paragraphs or has_bullets or has_numbered_list:
        return 1.0
    if sentence_count >= 2:
        return 0.6
    return 0.2


def _repetition_score(question: str, answer: str) -> float:
    """Reward answers that do not simply repeat the full question text."""
    normalized_question = re.sub(r"\s+", " ", question.lower()).strip()
    normalized_answer = re.sub(r"\s+", " ", answer.lower()).strip()
    if normalized_question and normalized_question in normalized_answer:
        return 0.0
    return 1.0


def score_pair(question: str, answer: str) -> float:
    """Compute a 0-1 quality score using length, structure, and repetition signals."""
    weighted_score = (
        0.55 * _length_score(answer)
        + 0.25 * _structure_score(answer)
        + 0.20 * _repetition_score(question, answer)
    )
    return round(max(0.0, min(1.0, weighted_score)), 4)


def _should_remove(pair: dict[str, Any], min_length: int, max_length: int) -> bool:
    """Return True when a row fails hard quality requirements and should be removed."""
    answer = str(pair.get("answer", "") or "")
    return (
        len(answer) < min_length
        or len(answer) > max_length
        or _contains_error_message(answer)
    )


def filter_quality(
    min_length: int = MIN_ANSWER_LENGTH,
    max_length: int = MAX_ANSWER_LENGTH,
) -> dict[str, int]:
    """Remove low-quality answers and update quality scores for retained rows."""
    if min_length <= 0 or max_length <= min_length:
        raise ValueError("min_length must be positive and smaller than max_length.")

    pairs = get_all_pairs()
    removed = 0
    scored = 0

    for pair in pairs:
        conversation_id = int(pair["id"])
        if _should_remove(pair, min_length, max_length):
            delete_pair(conversation_id)
            removed += 1
            continue

        score = score_pair(str(pair["question"]), str(pair["answer"]))
        update_quality_score(conversation_id, score)
        scored += 1

    return {"scored": scored, "removed": removed}
