"""Ollama query client with retries and graceful error handling."""

from __future__ import annotations

import time
from typing import Any

import requests

from config import (
    OLLAMA_API_URL,
    OLLAMA_MODEL,
    REQUEST_RETRIES,
    REQUEST_TIMEOUT_SECONDS,
    RETRY_BACKOFF_SECONDS,
)


def _extract_response(payload: dict[str, Any]) -> str:
    """Read Ollama's response text from a JSON payload in a defensive way."""
    response = payload.get("response")
    if isinstance(response, str) and response.strip():
        return response.strip()
    return "ERROR: Ollama returned an empty or malformed response."


def query_local_ai(question: str, model: str = OLLAMA_MODEL) -> str:
    """Send a question to the local Ollama generate API and return the answer.

    The function retries transient network, timeout, HTTP, and JSON errors up to
    ``REQUEST_RETRIES`` times, then returns an error string that the quality
    filter can remove later.
    """
    if not question or not question.strip():
        return "ERROR: Question cannot be empty."

    body = {"model": model, "prompt": question, "stream": False}
    last_error = "Unknown Ollama request failure."

    for attempt in range(1, REQUEST_RETRIES + 1):
        try:
            response = requests.post(
                OLLAMA_API_URL,
                json=body,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            return _extract_response(response.json())
        except requests.Timeout:
            last_error = f"Timeout while querying Ollama on attempt {attempt}."
        except requests.ConnectionError:
            last_error = (
                "Connection error while querying Ollama. "
                "Is Ollama running on localhost:11434?"
            )
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else "unknown"
            last_error = f"Ollama returned HTTP status {status} on attempt {attempt}."
        except ValueError:
            last_error = f"Ollama returned invalid JSON on attempt {attempt}."
        except requests.RequestException as exc:
            last_error = f"Unexpected Ollama request error on attempt {attempt}: {exc}"

        if attempt < REQUEST_RETRIES:
            time.sleep(RETRY_BACKOFF_SECONDS * attempt)

    return f"ERROR: {last_error}"
