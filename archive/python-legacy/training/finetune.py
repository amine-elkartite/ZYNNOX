"""LoRA fine-tuning script using Hugging Face Transformers, PEFT, and TRL."""

from __future__ import annotations

import inspect
from pathlib import Path
from typing import Any

import torch
from datasets import Dataset, load_dataset
from peft import LoraConfig
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from trl import SFTTrainer

from config import (
    BASE_MODEL_NAME,
    DATASET_TRAIN_PATH,
    FINAL_MODEL_DIR,
    LEARNING_RATE,
    LOGGING_STEPS,
    LORA_ALPHA,
    LORA_DROPOUT,
    LORA_R,
    LORA_TARGET_MODULES,
    MAX_SEQ_LENGTH,
    NUM_TRAIN_EPOCHS,
    OUTPUT_DIR,
    PER_DEVICE_TRAIN_BATCH_SIZE,
    SAVE_STEPS,
    ensure_directories,
)


def _format_example(example: dict[str, Any]) -> dict[str, str]:
    """Convert one JSON dataset row into the requested chat-style text format."""
    prompt = str(example.get("prompt", "")).strip()
    response = str(example.get("response", "")).strip()
    return {"text": f"<human>: {prompt}\n<assistant>: {response}"}


def _load_training_dataset(dataset_file: str | Path) -> Dataset:
    """Load dataset_train.json and add a formatted text column for SFTTrainer."""
    dataset_path = Path(dataset_file)
    if not dataset_path.exists():
        raise FileNotFoundError(f"Training dataset not found: {dataset_path}")

    dataset = load_dataset("json", data_files=str(dataset_path), split="train")
    if len(dataset) == 0:
        raise ValueError("Training dataset is empty; collect and export data first.")
    return dataset.map(_format_example)


def _load_model_and_tokenizer(base_model_name: str) -> tuple[Any, Any]:
    """Load the base causal language model and tokenizer for LoRA training."""
    tokenizer = AutoTokenizer.from_pretrained(base_model_name, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model_kwargs: dict[str, Any] = {}
    if torch.cuda.is_available():
        model_kwargs["torch_dtype"] = torch.float16
        model_kwargs["device_map"] = "auto"

    model = AutoModelForCausalLM.from_pretrained(base_model_name, **model_kwargs)
    model.config.use_cache = False
    return model, tokenizer


def _training_arguments(output_dir: Path) -> TrainingArguments:
    """Build the requested Hugging Face training arguments."""
    return TrainingArguments(
        output_dir=str(output_dir),
        num_train_epochs=NUM_TRAIN_EPOCHS,
        per_device_train_batch_size=PER_DEVICE_TRAIN_BATCH_SIZE,
        learning_rate=LEARNING_RATE,
        save_steps=SAVE_STEPS,
        logging_steps=LOGGING_STEPS,
        fp16=torch.cuda.is_available(),
        report_to="none",
        remove_unused_columns=False,
    )


def _lora_config() -> LoraConfig:
    """Create the requested LoRA adapter configuration."""
    return LoraConfig(
        r=LORA_R,
        lora_alpha=LORA_ALPHA,
        lora_dropout=LORA_DROPOUT,
        target_modules=LORA_TARGET_MODULES,
        bias="none",
        task_type="CAUSAL_LM",
    )


def _build_trainer(
    model: Any,
    tokenizer: Any,
    dataset: Dataset,
    training_args: TrainingArguments,
    lora_config: LoraConfig,
) -> SFTTrainer:
    """Create an SFTTrainer while supporting both older and newer TRL APIs."""
    trainer_parameters = inspect.signature(SFTTrainer.__init__).parameters
    trainer_kwargs: dict[str, Any] = {
        "model": model,
        "args": training_args,
        "train_dataset": dataset,
        "peft_config": lora_config,
    }

    try:
        from trl import SFTConfig

        config_parameters = inspect.signature(SFTConfig.__init__).parameters
        requested_config_kwargs: dict[str, Any] = {
            "output_dir": training_args.output_dir,
            "num_train_epochs": NUM_TRAIN_EPOCHS,
            "per_device_train_batch_size": PER_DEVICE_TRAIN_BATCH_SIZE,
            "learning_rate": LEARNING_RATE,
            "save_steps": SAVE_STEPS,
            "logging_steps": LOGGING_STEPS,
            "fp16": torch.cuda.is_available(),
            "report_to": "none",
            "remove_unused_columns": False,
            "dataset_text_field": "text",
            "packing": False,
        }
        config_kwargs = {
            key: value
            for key, value in requested_config_kwargs.items()
            if key in config_parameters
        }

        if "max_length" in config_parameters:
            config_kwargs["max_length"] = MAX_SEQ_LENGTH
        elif "max_seq_length" in config_parameters:
            config_kwargs["max_seq_length"] = MAX_SEQ_LENGTH

        trainer_kwargs["args"] = SFTConfig(**config_kwargs)
    except ImportError:
        pass

    if "processing_class" in trainer_parameters:
        trainer_kwargs["processing_class"] = tokenizer
    elif "tokenizer" in trainer_parameters:
        trainer_kwargs["tokenizer"] = tokenizer

    if "dataset_text_field" in trainer_parameters:
        trainer_kwargs["dataset_text_field"] = "text"

    if "max_seq_length" in trainer_parameters:
        trainer_kwargs["max_seq_length"] = MAX_SEQ_LENGTH

    return SFTTrainer(**trainer_kwargs)


def fine_tune_model(
    dataset_file: str | Path = DATASET_TRAIN_PATH,
    base_model_name: str = BASE_MODEL_NAME,
    output_dir: str | Path = OUTPUT_DIR,
) -> str:
    """Fine-tune TinyLlama with LoRA and save the final model to ./my_model/final."""
    ensure_directories()
    output_path = Path(output_dir)
    final_path = FINAL_MODEL_DIR if output_path == OUTPUT_DIR else output_path / "final"

    dataset = _load_training_dataset(dataset_file)
    model, tokenizer = _load_model_and_tokenizer(base_model_name)
    training_args = _training_arguments(output_path)
    lora_config = _lora_config()
    trainer = _build_trainer(model, tokenizer, dataset, training_args, lora_config)

    trainer.train()
    final_path.mkdir(parents=True, exist_ok=True)
    trainer.model.save_pretrained(final_path)
    tokenizer.save_pretrained(final_path)
    return str(final_path)


if __name__ == "__main__":
    print(fine_tune_model())
