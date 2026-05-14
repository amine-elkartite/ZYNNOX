"""Optional Gradio web UI for the smart inference system."""

from __future__ import annotations

from training.smart_inference import (
    answer,
    force_retrain_now,
    get_inference_stats,
    start_retrain_scheduler,
)


def _source_badge(source: str) -> str:
    """Map an answer source to the requested UI badge."""
    if source == "local_model":
        return "🧠 Local"
    if source == "wikipedia":
        return "📖 Wikipedia"
    return "🌐 Web"


def _format_urls(urls: list[str]) -> str:
    """Render source URLs as clickable Markdown links."""
    if not urls:
        return "No external sources."
    return "\n".join(f"- [{url}]({url})" for url in urls)


def _format_stats() -> str:
    """Render current inference and database stats as Markdown."""
    stats = get_inference_stats()
    return (
        f"- Total questions answered: {stats['total_questions_answered']}\n"
        f"- % answered locally: {stats['percent_answered_locally']}%\n"
        f"- % needed web search: {stats['percent_needed_web_search']}%\n"
        f"- Total pairs in database: {stats['total_pairs_in_database']}\n"
        f"- Pending training pairs: {stats['pending_training_pairs']}\n"
        f"- Last retrain date: {stats['last_retrain_date']}"
    )


def _ask(question: str) -> tuple[str, str, str, str, str]:
    """Run the smart answer pipeline and format outputs for Gradio."""
    result = answer(question)
    saved_text = "Saved to database ✓" if result["saved_to_db"] else "Not saved to database"
    return (
        result["answer"],
        _source_badge(result["source"]),
        _format_urls(result["urls"]),
        saved_text,
        _format_stats(),
    )


def _force_retrain() -> str:
    """Run a retraining check immediately from the UI."""
    result = force_retrain_now()
    if result.get("retrained"):
        return f"Model retrained on {result['pending']} new examples."
    return f"No retrain performed: {result.get('reason')} ({result.get('pending', 0)} pending)."


def build_interface():
    """Create the Gradio Blocks interface."""
    import gradio as gr

    start_retrain_scheduler(blocking=False)
    with gr.Blocks(title="Smart AI Inference") as demo:
        gr.Markdown("# Smart AI Inference")
        question = gr.Textbox(label="Question", lines=2)
        ask_button = gr.Button("Ask")
        answer_box = gr.Textbox(label="Answer", lines=8)
        source_box = gr.Textbox(label="Source")
        urls_box = gr.Markdown(label="Source URLs")
        saved_box = gr.Textbox(label="Database")
        stats_box = gr.Markdown(value=_format_stats(), label="Stats")
        retrain_button = gr.Button("Force retrain now")
        retrain_status = gr.Textbox(label="Retrain status")

        ask_button.click(
            _ask,
            inputs=question,
            outputs=[answer_box, source_box, urls_box, saved_box, stats_box],
        )
        retrain_button.click(_force_retrain, outputs=retrain_status)
    return demo


if __name__ == "__main__":
    build_interface().launch()
