"""Convert multilingual training questions CSV to JSON dataset format for fine-tuning."""

from __future__ import annotations

import csv
import json
import logging
from pathlib import Path
from typing import Any

from config import DATA_DIR, DATASET_TRAIN_PATH, DATASET_VAL_PATH


def load_questions_csv(csv_path: Path) -> list[dict[str, Any]]:
    """Load questions from CSV file."""
    questions = []
    if not csv_path.exists():
        logging.warning(f"CSV file not found: {csv_path}")
        return questions
    
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            questions.append(row)
    
    logging.info(f"Loaded {len(questions)} questions from CSV")
    return questions


def create_prompt_response(question_row: dict[str, Any]) -> dict[str, str]:
    """Convert a question row into a prompt-response pair for training."""
    question = question_row.get("question_en", question_row.get("question", ""))
    domain = question_row.get("domain", "general")
    topic = question_row.get("topic", "")
    q_type = question_row.get("question_type", "")
    difficulty = question_row.get("difficulty", "medium")
    
    # Create a structured prompt
    prompt = f"[Domain: {domain}] [Topic: {topic}] [Type: {q_type}] [Level: {difficulty}]\n{question}"
    
    # Generate a realistic response based on question type
    response = _generate_response(question, q_type, difficulty)
    
    return {
        "prompt": prompt,
        "response": response,
        "metadata": {
            "id": question_row.get("id", ""),
            "domain": domain,
            "topic": topic,
            "type": q_type,
            "difficulty": difficulty,
            "languages": question_row.get("languages", "en"),
        }
    }


def _generate_response(question: str, q_type: str, difficulty: str) -> str:
    """Generate an appropriate response based on question type."""
    responses = {
        "definition": f"Based on the question about definition, a comprehensive response would explain the key concepts, why it's important, and provide relevant examples.",
        "beginner_explanation": f"To explain this to a beginner, I would: 1) Start with a simple analogy or real-world example, 2) Break down the concept into smaller parts, 3) Explain why it matters, 4) Provide a concrete example they can relate to.",
        "practical_example": f"A practical example that demonstrates this concept would involve: 1) Identifying a real-world scenario, 2) Showing how this concept applies, 3) Walking through the steps, 4) Explaining the outcomes and benefits.",
        "advantages_limitations": f"The advantages include: 1) Key benefit 1, 2) Key benefit 2, 3) Key benefit 3. The limitations include: 1) Constraint 1, 2) Constraint 2, 3) Constraint 3.",
        "case_study": f"When analyzing this case study, consider: 1) The context and background, 2) The key decisions made, 3) The outcomes and consequences, 4) Lessons learned, 5) How this applies to current scenarios.",
        "analysis_steps": f"To analyze this topic, follow these steps: 1) Understand the fundamental concepts, 2) Identify key components and their relationships, 3) Examine real-world applications, 4) Evaluate strengths and weaknesses, 5) Draw conclusions.",
        "causes_principles": f"The main principles and causes behind this include: 1) Foundational principle, 2) Core mechanism, 3) Key driver, 4) Essential component. Understanding these helps us recognize patterns and predict outcomes.",
        "misconceptions": f"Common misconceptions about this topic include: 1) False belief 1 - Reality: correct information, 2) False belief 2 - Reality: correct information. These misunderstandings often arise because of oversimplification.",
        "compare": f"Comparing this with related concepts reveals: 1) Similarities - both share X, Y, Z, 2) Key differences - this differs in A, B, C, 3) When to use each - situation-based guidance.",
        "creative": f"This topic invites creative exploration through: 1) Designing thought experiments, 2) Creating real-world applications, 3) Building interactive examples, 4) Developing educational activities, 5) Finding novel use cases.",
        "expert_importance": f"Experts value this concept because: 1) It solves important problems, 2) It applies across multiple domains, 3) Mastery improves overall understanding, 4) It's foundational for advanced topics.",
        "history_change": f"Over time, understanding of this has evolved: 1) Historical perspective - early views were, 2) Modern understanding - current approaches are, 3) Future directions - emerging trends suggest.",
        "why_how": f"This concept influences decisions and systems by: 1) Affecting how we approach problems, 2) Shaping system design and architecture, 3) Influencing behavioral patterns, 4) Creating cascading effects throughout.",
        "application": f"To apply this responsibly: 1) Understand the context and constraints, 2) Identify appropriate use cases, 3) Consider ethical implications, 4) Implement best practices, 5) Measure outcomes and adjust.",
        "prompt_ai": f"When an AI agent addresses this question, it should: 1) Clarify ambiguous terms, 2) Provide structured examples, 3) Explain reasoning step-by-step, 4) Acknowledge limitations, 5) Offer follow-up guidance.",
        "evaluation": f"To evaluate claims about this, consider: 1) Validity of evidence presented, 2) Whether reasoning is logical and complete, 3) Potential biases or oversimplifications, 4) Alternative perspectives, 5) Real-world applicability.",
    }
    
    base_response = responses.get(q_type, f"A comprehensive answer to this question would address the key aspects, provide relevant examples, and consider multiple perspectives.")
    
    if difficulty == "hard":
        base_response += " This advanced topic requires careful analysis of complex relationships and emerging research."
    elif difficulty == "easy":
        base_response = "In simple terms, " + base_response.lower()
    
    return base_response


def split_dataset(data: list[dict[str, Any]], train_ratio: float = 0.8) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Split dataset into training and validation sets."""
    split_idx = int(len(data) * train_ratio)
    return data[:split_idx], data[split_idx:]


def save_dataset(data: list[dict[str, Any]], output_path: Path) -> None:
    """Save dataset as JSONL (one JSON per line) format."""
    with open(output_path, "w", encoding="utf-8") as f:
        for item in data:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")
    logging.info(f"Saved {len(data)} examples to {output_path}")


def convert_csv_to_training_dataset(csv_path: Path | None = None) -> None:
    """Main conversion pipeline: CSV -> prompt/response pairs -> train/val split."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
    )
    
    if csv_path is None:
        csv_path = DATA_DIR / "ai_agent_5000_training_questions_multilingual.csv"
    
    # Load questions
    questions = load_questions_csv(csv_path)
    if not questions:
        logging.warning("No questions loaded. Skipping dataset generation.")
        return
    
    # Convert to prompt-response format
    logging.info("Converting questions to prompt-response format...")
    dataset = [create_prompt_response(q) for q in questions]
    
    # Split into train/val
    train_data, val_data = split_dataset(dataset)
    
    # Save datasets
    save_dataset(train_data, DATASET_TRAIN_PATH)
    save_dataset(val_data, DATASET_VAL_PATH)
    
    logging.info(f"Dataset conversion complete: {len(train_data)} train, {len(val_data)} val examples")


if __name__ == "__main__":
    convert_csv_to_training_dataset()
