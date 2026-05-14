"""SQLite storage layer for collected question and answer pairs."""

from __future__ import annotations

import sqlite3
from contextlib import closing
from typing import Any

from config import DB_PATH, ensure_directories


def _connect() -> sqlite3.Connection:
    """Open a SQLite connection with rows accessible by column name."""
    ensure_directories()
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def _column_exists(connection: sqlite3.Connection, column_name: str) -> bool:
    """Return True when the conversations table already contains a column."""
    columns = connection.execute("PRAGMA table_info(conversations)").fetchall()
    return any(row["name"] == column_name for row in columns)


def _ensure_column(
    connection: sqlite3.Connection,
    column_name: str,
    column_definition: str,
) -> None:
    """Add a missing conversations column for older SQLite databases."""
    if not _column_exists(connection, column_name):
        connection.execute(f"ALTER TABLE conversations ADD COLUMN {column_definition}")


def _ensure_conversation_schema(connection: sqlite3.Connection) -> None:
    """Apply additive schema migrations required by smart inference."""
    _ensure_column(connection, "source", "source TEXT DEFAULT 'llama3'")
    _ensure_column(connection, "needs_training", "needs_training BOOLEAN DEFAULT 0")
    _ensure_column(connection, "sources_urls", "sources_urls TEXT")


def init_db() -> None:
    """Initialize the SQLite database and conversations table if needed."""
    try:
        with closing(_connect()) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS conversations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    question TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    model_name TEXT,
                    topic TEXT,
                    quality_score REAL DEFAULT 0,
                    source TEXT DEFAULT 'llama3',
                    needs_training BOOLEAN DEFAULT 0,
                    sources_urls TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            _ensure_conversation_schema(connection)
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_conversations_question
                ON conversations(question)
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_conversations_topic
                ON conversations(topic)
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_conversations_source
                ON conversations(source)
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_conversations_needs_training
                ON conversations(needs_training)
                """
            )
            connection.commit()
    except sqlite3.Error as exc:
        raise RuntimeError(f"Failed to initialize database: {exc}") from exc


def question_exists(question: str) -> bool:
    """Return True when a question is already stored in the database."""
    init_db()
    try:
        with closing(_connect()) as connection:
            row = connection.execute(
                "SELECT 1 FROM conversations WHERE question = ? LIMIT 1",
                (question,),
            ).fetchone()
            return row is not None
    except sqlite3.Error as exc:
        raise RuntimeError(f"Failed to check duplicate question: {exc}") from exc


def save_to_db(
    question: str,
    answer: str,
    model_name: str,
    topic: str,
    source: str = "llama3",
    needs_training: bool = False,
    sources_urls: str | None = None,
    quality_score: float = 0.0,
) -> bool:
    """Save one question and answer pair, returning False for duplicates."""
    init_db()
    if question_exists(question):
        return False

    try:
        with closing(_connect()) as connection:
            connection.execute(
                """
                INSERT INTO conversations (
                    question,
                    answer,
                    model_name,
                    topic,
                    quality_score,
                    source,
                    needs_training,
                    sources_urls
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    question,
                    answer,
                    model_name,
                    topic,
                    quality_score,
                    source,
                    int(needs_training),
                    sources_urls,
                ),
            )
            connection.commit()
            return True
    except sqlite3.Error as exc:
        raise RuntimeError(f"Failed to save conversation: {exc}") from exc


def get_all_pairs() -> list[dict[str, Any]]:
    """Retrieve every stored Q&A pair as dictionaries for downstream processing."""
    try:
        with closing(_connect()) as connection:
            rows = connection.execute(
                """
                SELECT id,
                       question,
                       answer,
                       model_name,
                       topic,
                       quality_score,
                       source,
                       needs_training,
                       sources_urls,
                       timestamp
                FROM conversations
                ORDER BY id
                """
            ).fetchall()
            return [dict(row) for row in rows]
    except sqlite3.Error as exc:
        raise RuntimeError(f"Failed to retrieve conversations: {exc}") from exc


def update_quality_score(conversation_id: int, quality_score: float) -> None:
    """Persist a quality score for an existing conversation row."""
    try:
        with closing(_connect()) as connection:
            connection.execute(
                "UPDATE conversations SET quality_score = ? WHERE id = ?",
                (quality_score, conversation_id),
            )
            connection.commit()
    except sqlite3.Error as exc:
        raise RuntimeError(f"Failed to update quality score: {exc}") from exc


def delete_pair(conversation_id: int) -> None:
    """Delete one conversation row that failed quality filtering."""
    try:
        with closing(_connect()) as connection:
            connection.execute(
                "DELETE FROM conversations WHERE id = ?",
                (conversation_id,),
            )
            connection.commit()
    except sqlite3.Error as exc:
        raise RuntimeError(f"Failed to delete conversation: {exc}") from exc


def count_needs_training() -> int:
    """Count conversations marked for the next fine-tuning session."""
    try:
        with closing(_connect()) as connection:
            row = connection.execute(
                "SELECT COUNT(*) AS count FROM conversations WHERE needs_training = 1"
            ).fetchone()
            return int(row["count"] if row else 0)
    except sqlite3.Error as exc:
        raise RuntimeError(f"Failed to count retraining rows: {exc}") from exc


def reset_needs_training_flags() -> None:
    """Clear retraining flags after a successful fine-tuning run."""
    try:
        with closing(_connect()) as connection:
            connection.execute("UPDATE conversations SET needs_training = 0 WHERE needs_training = 1")
            connection.commit()
    except sqlite3.Error as exc:
        raise RuntimeError(f"Failed to reset retraining flags: {exc}") from exc


def get_stats() -> dict[str, Any]:
    """Return total count, average quality score, and per-topic row counts."""
    try:
        with closing(_connect()) as connection:
            summary = connection.execute(
                """
                SELECT COUNT(*) AS total_count,
                       COALESCE(AVG(quality_score), 0) AS avg_quality_score
                FROM conversations
                """
            ).fetchone()
            topic_rows = connection.execute(
                """
                SELECT COALESCE(topic, 'unknown') AS topic, COUNT(*) AS count
                FROM conversations
                GROUP BY COALESCE(topic, 'unknown')
                ORDER BY count DESC, topic ASC
                """
            ).fetchall()
            source_rows = connection.execute(
                """
                SELECT COALESCE(source, 'unknown') AS source, COUNT(*) AS count
                FROM conversations
                GROUP BY COALESCE(source, 'unknown')
                ORDER BY count DESC, source ASC
                """
            ).fetchall()
            needs_training_row = connection.execute(
                "SELECT COUNT(*) AS count FROM conversations WHERE needs_training = 1"
            ).fetchone()
            return {
                "total_count": int(summary["total_count"] if summary else 0),
                "avg_quality_score": float(
                    summary["avg_quality_score"] if summary else 0.0
                ),
                "topics_breakdown": {
                    row["topic"]: int(row["count"]) for row in topic_rows
                },
                "sources_breakdown": {
                    row["source"]: int(row["count"]) for row in source_rows
                },
                "needs_training_count": int(
                    needs_training_row["count"] if needs_training_row else 0
                ),
            }
    except sqlite3.Error as exc:
        raise RuntimeError(f"Failed to collect database stats: {exc}") from exc
