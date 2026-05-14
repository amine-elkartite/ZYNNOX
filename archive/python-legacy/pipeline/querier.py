"""Legacy AI query adapter.

The original prototype used a local runtime. ZYNNOX now routes production AI
traffic through the Node backend's external provider abstraction. This adapter
is kept only so older data utilities fail safely instead of silently connecting
to an unsupported local service.
"""

from __future__ import annotations


def query_local_ai(question: str, model: str = "zynnox-external-provider") -> str:
    """Return a safe error for legacy Python callers.

    Use ``server/src/services/aiProviderService.js`` for production AI calls.
    """
    if not question or not question.strip():
        return "ERROR: Question cannot be empty."
    return (
        "ERROR: Legacy AI querying is disabled. Start the Node backend and use "
        "/api/agent/chat, /api/ai-search, or /api/website/create instead."
    )
