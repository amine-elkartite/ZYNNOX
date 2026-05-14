"""Near-duplicate removal with MinHash locality-sensitive hashing."""

from __future__ import annotations

import logging
import re

from config import DEDUPLICATION_THRESHOLD, MINHASH_NUM_PERMUTATIONS


def _word_shingles(text: str, width: int = 5) -> set[str]:
    """Convert text into word shingles for approximate Jaccard similarity."""
    words = re.findall(r"\w+", text.lower())
    if len(words) < width:
        return set(words)
    return {" ".join(words[index : index + width]) for index in range(len(words) - width + 1)}


def _build_minhash(text: str):
    """Create a datasketch MinHash signature from text shingles."""
    from datasketch import MinHash

    signature = MinHash(num_perm=MINHASH_NUM_PERMUTATIONS)
    for shingle in _word_shingles(text):
        signature.update(shingle.encode("utf-8"))
    return signature


def deduplicate(texts: list[str]) -> list[str]:
    """Remove near-duplicate texts using MinHash with an 80% similarity threshold."""
    if not texts:
        return []

    try:
        from datasketch import MinHashLSH
    except ImportError:
        logging.warning("datasketch is not installed; falling back to exact deduplication.")
        seen: set[str] = set()
        unique_without_minhash: list[str] = []
        for text in texts:
            normalized = re.sub(r"\s+", " ", text.strip().lower())
            if normalized and normalized not in seen:
                seen.add(normalized)
                unique_without_minhash.append(text)
        return unique_without_minhash

    lsh = MinHashLSH(
        threshold=DEDUPLICATION_THRESHOLD,
        num_perm=MINHASH_NUM_PERMUTATIONS,
    )
    unique_texts: list[str] = []

    for index, text in enumerate(texts):
        if not text or not text.strip():
            continue

        signature = _build_minhash(text)
        duplicate_keys = lsh.query(signature)
        if duplicate_keys:
            continue

        key = f"text-{index}"
        lsh.insert(key, signature)
        unique_texts.append(text)

    return unique_texts
