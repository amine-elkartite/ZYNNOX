"""Inference utilities for testing the fine-tuned model."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

from config import BASE_MODEL_NAME, FINAL_MODEL_DIR, MAX_NEW_TOKENS
from pipeline.querier import query_local_ai


def _device() -> str:
    """Choose the best available runtime device for inference."""
    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def _load_fine_tuned_model(model_dir: str | Path = FINAL_MODEL_DIR) -> tuple[Any, Any]:
    """Load either a saved full model or a LoRA adapter from the final model path."""
    final_path = Path(model_dir)
    if not final_path.exists():
        raise FileNotFoundError(f"Fine-tuned model not found: {final_path}")

    tokenizer = AutoTokenizer.from_pretrained(final_path, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    try:
        model = AutoModelForCausalLM.from_pretrained(final_path)
    except Exception:
        base_model = AutoModelForCausalLM.from_pretrained(BASE_MODEL_NAME)
        model = PeftModel.from_pretrained(base_model, final_path)

    runtime_device = _device()
    model.to(runtime_device)
    model.eval()
    return model, tokenizer


def _generate_answer(model: Any, tokenizer: Any, question: str) -> str:
    """Generate an answer from the fine-tuned model for one question."""
    prompt = f"<human>: {question.strip()}\n<assistant>:"
    runtime_device = _device()
    encoded = tokenizer(prompt, return_tensors="pt").to(runtime_device)

    with torch.no_grad():
        output_ids = model.generate(
            **encoded,
            max_new_tokens=MAX_NEW_TOKENS,
            do_sample=True,
            temperature=0.7,
            top_p=0.9,
            pad_token_id=tokenizer.eos_token_id,
        )

    generated_ids = output_ids[0][encoded["input_ids"].shape[-1] :]
    return tokenizer.decode(generated_ids, skip_special_tokens=True).strip()


def test_model(question: str) -> str:
    """Compare the original local Llama3 answer with the fine-tuned model answer."""
    if not question or not question.strip():
        raise ValueError("Question cannot be empty.")

    original_answer = query_local_ai(question)
    model, tokenizer = _load_fine_tuned_model()
    fine_tuned_answer = _generate_answer(model, tokenizer, question)

    print("\n[Original Llama3 answer]")
    print(original_answer)
    print("\n[Your model answer]")
    print(fine_tuned_answer)
    return fine_tuned_answer


if __name__ == "__main__":
    test_model("What is artificial intelligence?")
