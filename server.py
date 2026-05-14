"""Local ZYNNOX API server for real chat responses.

Run this file with:

    python3 server.py

Then open http://localhost:8000. The browser app will POST questions to
``/api/chat`` and this server will answer with the local Ollama model. When
web-search mode is enabled in the UI, it uses the existing web search/scraping
pipeline before asking Ollama to answer from the gathered context.
"""

from __future__ import annotations

import json
import mimetypes
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 8000


def _json_response(handler: SimpleHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    """Write a JSON API response with browser-friendly CORS headers."""
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()
    handler.wfile.write(body)


def _save_ollama_answer(question: str, answer_text: str) -> bool:
    """Persist direct Ollama answers to the existing knowledge database."""
    try:
        from pipeline.storage import save_to_db

        return save_to_db(
            question=question,
            answer=answer_text,
            model_name="llama3",
            topic="chat",
            source="ollama",
            needs_training=False,
        )
    except Exception:
        return False


def _direct_ollama_answer(question: str) -> dict[str, Any]:
    """Ask local Ollama directly for normal chat mode."""
    from pipeline.querier import query_local_ai

    answer_text = query_local_ai(question)
    if answer_text.startswith("ERROR:"):
        return {
            "question": question,
            "answer": answer_text,
            "source": "ollama_error",
            "confident": False,
            "urls": [],
            "saved_to_db": False,
        }

    return {
        "question": question,
        "answer": answer_text,
        "source": "ollama",
        "confident": True,
        "urls": [],
        "saved_to_db": _save_ollama_answer(question, answer_text),
    }


def _web_grounded_answer(question: str) -> dict[str, Any]:
    """Search the web, answer from context, and save useful web-grounded Q&A."""
    from training.smart_inference import (
        _answer_found,
        _search_wikipedia_context,
        auto_learn,
        generate_from_context,
        search_for_answer,
    )

    web_result = search_for_answer(question)
    web_answer = generate_from_context(question, str(web_result["context"]))
    if _answer_found(str(web_answer["answer"])):
        sources = list(web_result["sources"])
        return {
            "question": question,
            "answer": str(web_answer["answer"]),
            "source": "web_search",
            "confident": True,
            "urls": sources,
            "saved_to_db": auto_learn(question, str(web_answer["answer"]), sources, source="web_search"),
        }

    wiki_result = _search_wikipedia_context(question)
    wiki_answer = generate_from_context(question, str(wiki_result["context"]))
    if _answer_found(str(wiki_answer["answer"])):
        sources = list(wiki_result["sources"])
        return {
            "question": question,
            "answer": str(wiki_answer["answer"]),
            "source": "wikipedia",
            "confident": True,
            "urls": sources,
            "saved_to_db": auto_learn(question, str(wiki_answer["answer"]), sources, source="wikipedia"),
        }

    return _direct_ollama_answer(question)


def real_answer(question: str, web_search: bool) -> dict[str, Any]:
    """Return a real model answer instead of a static browser response."""
    clean_question = question.strip()
    if not clean_question:
        return {
            "question": "",
            "answer": "Please enter a question.",
            "source": "validation",
            "confident": False,
            "urls": [],
            "saved_to_db": False,
        }
    if web_search:
        return _web_grounded_answer(clean_question)
    return _direct_ollama_answer(clean_question)


class ZynnoxHandler(SimpleHTTPRequestHandler):
    """Serve index.html and expose the /api/chat endpoint."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        if self.path == "/api/health":
            _json_response(self, HTTPStatus.OK, {"ok": True, "service": "zynnox-api"})
            return
        if self.path == "/":
            self.path = "/index.html"
        super().do_GET()

    def do_POST(self) -> None:
        if self.path != "/api/chat":
            _json_response(self, HTTPStatus.NOT_FOUND, {"ok": False, "error": "Unknown endpoint."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length).decode("utf-8")
            payload = json.loads(raw_body or "{}")
            question = str(payload.get("message") or payload.get("question") or "")
            use_web = bool(payload.get("web_search"))
            result = real_answer(question, use_web)
            _json_response(self, HTTPStatus.OK, {"ok": True, "result": result})
        except Exception as exc:
            _json_response(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {
                    "ok": False,
                    "error": (
                        "ZYNNOX backend failed. Make sure dependencies are installed "
                        "and Ollama is running with `ollama run llama3`."
                    ),
                    "details": str(exc),
                },
            )


def main() -> None:
    """Start the local ZYNNOX HTTP server."""
    mimetypes.add_type("text/html; charset=utf-8", ".html")
    server = ThreadingHTTPServer((HOST, PORT), ZynnoxHandler)
    print(f"ZYNNOX is running at http://{HOST}:{PORT}")
    print("Make sure Ollama is running: ollama run llama3")
    server.serve_forever()


if __name__ == "__main__":
    main()
