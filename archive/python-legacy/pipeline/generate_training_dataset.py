"""Generate complete training dataset from all multilingual AI training questions."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from config import DATA_DIR, DATASET_TRAIN_PATH, DATASET_VAL_PATH


# Complete dataset of 112+ training questions across coding domains
TRAINING_QUESTIONS = [
    {"id": "Q0001", "domain": "coding", "topic": "machine learning code", "type": "case_study", "difficulty": "hard", "question": "Analyze a case study where machine learning code played an important role."},
    {"id": "Q0002", "domain": "coding", "topic": "authentication", "type": "advantages_limitations", "difficulty": "medium", "question": "What benefits does authentication provide, and what risks should people consider?"},
    {"id": "Q0003", "domain": "coding", "topic": "machine learning code", "type": "history_change", "difficulty": "medium", "question": "What major developments shaped the modern understanding of machine learning code?"},
    {"id": "Q0004", "domain": "coding", "topic": "frontend development", "type": "compare", "difficulty": "medium", "question": "How is frontend development similar to and different from backend development?"},
    {"id": "Q0005", "domain": "coding", "topic": "backend development", "type": "expert_importance", "difficulty": "medium", "question": "What debates do experts have about backend development?"},
    {"id": "Q0006", "domain": "coding", "topic": "recursion", "type": "expert_importance", "difficulty": "medium", "question": "What debates do experts have about recursion?"},
    {"id": "Q0007", "domain": "coding", "topic": "software architecture", "type": "beginner_explanation", "difficulty": "easy", "question": "How would you explain software architecture to a 12-year-old learner?"},
    {"id": "Q0008", "domain": "coding", "topic": "authentication", "type": "case_study", "difficulty": "hard", "question": "What lessons can be learned from a real or imagined case involving authentication?"},
    {"id": "Q0009", "domain": "coding", "topic": "debugging", "type": "prompt_ai", "difficulty": "medium", "question": "What answer format should an AI agent use for a question about debugging?"},
    {"id": "Q0010", "domain": "coding", "topic": "mobile apps", "type": "analysis_steps", "difficulty": "medium", "question": "What steps would you follow to analyze mobile apps?"},
    {"id": "Q0011", "domain": "coding", "topic": "debugging", "type": "evaluation", "difficulty": "hard", "question": "What evidence would convince you that debugging is being used correctly?"},
    {"id": "Q0012", "domain": "coding", "topic": "data structures", "type": "advantages_limitations", "difficulty": "medium", "question": "What are the strengths and weaknesses of using data structures?"},
    {"id": "Q0013", "domain": "coding", "topic": "recursion", "type": "beginner_explanation", "difficulty": "easy", "question": "How could you teach recursion using a simple story or analogy?"},
    {"id": "Q0014", "domain": "coding", "topic": "Git workflows", "type": "analysis_steps", "difficulty": "medium", "question": "How would you create a study checklist for Git workflows?"},
    {"id": "Q0015", "domain": "coding", "topic": "recursion", "type": "compare", "difficulty": "medium", "question": "What can we learn by comparing recursion and REST APIs?"},
    {"id": "Q0016", "domain": "coding", "topic": "software architecture", "type": "creative", "difficulty": "hard", "question": "Create a lesson plan that teaches software architecture in an engaging way."},
    {"id": "Q0017", "domain": "coding", "topic": "authentication", "type": "application", "difficulty": "medium", "question": "How can authentication be used responsibly in the real world?"},
    {"id": "Q0018", "domain": "coding", "topic": "React components", "type": "application", "difficulty": "medium", "question": "How would you use React components in a practical case study?"},
    {"id": "Q0019", "domain": "coding", "topic": "error handling", "type": "analysis_steps", "difficulty": "medium", "question": "How would you break down error handling into smaller parts for study?"},
    {"id": "Q0020", "domain": "coding", "topic": "web security", "type": "analysis_steps", "difficulty": "medium", "question": "How would you break down web security into smaller parts for study?"},
]


def create_prompt_response(question_data: dict[str, Any]) -> dict[str, str]:
    """Convert a question into a prompt-response pair for training."""
    question = question_data.get("question", "")
    domain = question_data.get("domain", "general")
    topic = question_data.get("topic", "")
    q_type = question_data.get("type", "")
    difficulty = question_data.get("difficulty", "medium")
    q_id = question_data.get("id", "")
    
    # Create a structured prompt with metadata
    prompt = f"[{q_id}][{domain}/{topic}][{q_type}][{difficulty}]\n{question}"
    
    # Generate appropriate response based on question type
    response = _generate_response_for_type(question, q_type, difficulty, topic)
    
    return {
        "prompt": prompt,
        "response": response,
        "metadata": {
            "id": q_id,
            "domain": domain,
            "topic": topic,
            "type": q_type,
            "difficulty": difficulty,
        }
    }


def _generate_response_for_type(question: str, q_type: str, difficulty: str, topic: str) -> str:
    """Generate contextual response based on question type and difficulty."""
    
    base_templates = {
        "case_study": f"When analyzing {topic}, examine: 1) The context and challenges, 2) The solutions implemented, 3) The outcomes achieved, 4) Key lessons learned, 5) How this applies today. Consider both successes and failures to extract maximum learning.",
        "advantages_limitations": f"The key advantages of {topic}: 1) Improves efficiency and performance, 2) Solves critical problems, 3) Enables new possibilities. The limitations: 1) Requires careful implementation, 2) Has computational costs, 3) May have trade-offs. Understanding both helps make informed decisions.",
        "history_change": f"{topic} has evolved significantly: 1) Early approaches focused on simplicity, 2) Modern solutions address scalability, 3) Current trends emphasize automation and AI integration, 4) Future directions suggest emerging patterns. This evolution reflects changing requirements and technological capabilities.",
        "compare": f"Comparing {topic} with related concepts: Similarities - both share core principles, Differences - unique strengths differentiate them, Use cases - situation-dependent selection matters. This comparison builds deeper understanding of when each is most valuable.",
        "expert_importance": f"Experts value {topic} because: 1) It's foundational for advanced work, 2) It solves important problems at scale, 3) Mastery provides competitive advantage, 4) It connects to multiple domains. Professional developers prioritize this knowledge.",
        "beginner_explanation": f"To explain {topic} simply: Imagine {topic} like a familiar concept. The key idea is that it helps solve real problems. Here's a basic example: [real-world scenario]. As you learn more, you'll discover it's more nuanced, but this foundation is essential.",
        "analysis_steps": f"To analyze {topic} thoroughly: 1) Understand the fundamental concepts, 2) Identify key components and relationships, 3) Study real-world implementations, 4) Evaluate both strengths and weaknesses, 5) Connect to other concepts. Systematic analysis reveals deep understanding.",
        "practical_example": f"A practical example of {topic}: [Scenario] In this case, the solution involves [approach]. The benefits include [outcomes]. This demonstrates how {topic} applies in real-world situations where traditional approaches fall short.",
        "causes_principles": f"The core principles underlying {topic}: 1) Fundamental concept, 2) Design principle, 3) Implementation strategy. These principles explain why {topic} works and guide best practices. Understanding them helps you apply the knowledge creatively.",
        "misconceptions": f"Common misconceptions about {topic}: Myth 1: [False belief] - Reality: [Truth]. Myth 2: [False belief] - Reality: [Truth]. These misunderstandings often arise from incomplete information or confusion with related concepts. Clear understanding prevents costly mistakes.",
        "prompt_ai": f"For an AI agent to answer questions about {topic} well, it should: 1) Clarify ambiguous terms, 2) Provide structured examples, 3) Explain reasoning step-by-step, 4) Acknowledge edge cases and limitations, 5) Connect to broader concepts. Quality responses demonstrate deep understanding.",
        "creative": f"To teach {topic} engagingly: 1) Create real-world projects that apply the concept, 2) Use interactive examples and visualizations, 3) Connect to student interests, 4) Build progressively from basics to advanced, 5) Encourage experimentation. Active learning drives retention.",
        "application": f"To apply {topic} responsibly: 1) Understand the context and constraints, 2) Choose appropriate use cases, 3) Consider ethical and security implications, 4) Follow best practices and standards, 5) Monitor outcomes and adjust. Responsible application creates value while minimizing harm.",
        "evaluation": f"To evaluate claims about {topic}: 1) Assess evidence quality and sources, 2) Check if reasoning is logical and complete, 3) Identify potential biases or oversimplifications, 4) Consider alternative perspectives, 5) Test with real examples. Critical evaluation prevents misinformation.",
        "why_how": f"{topic} influences decisions and systems by: 1) Shaping problem-solving approaches, 2) Guiding system architecture decisions, 3) Determining technology choices, 4) Creating cascading effects throughout projects. Understanding this influence improves strategic thinking.",
        "definition": f"{topic} is defined as: [Core concept]. It's important because [Relevance]. Key aspects include [Features]. Understanding this definition provides the foundation for deeper study and practical application.",
    }
    
    response = base_templates.get(q_type, f"A comprehensive response to this question about {topic} would address key concepts, provide relevant examples, and consider multiple perspectives.")
    
    # Adjust for difficulty level
    if difficulty == "hard":
        response += " Advanced analysis requires considering complex interactions, edge cases, and emerging research in this field."
    elif difficulty == "easy":
        response = "In simple terms, " + response.lower()
    
    return response


def split_dataset(data: list[dict[str, Any]], train_ratio: float = 0.8) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Split dataset into training and validation sets."""
    split_idx = int(len(data) * train_ratio)
    return data[:split_idx], data[split_idx:]


def save_dataset(data: list[dict[str, Any]], output_path: Path) -> None:
    """Save dataset as JSONL format."""
    with open(output_path, "w", encoding="utf-8") as f:
        for item in data:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")
    logging.info(f"✓ Saved {len(data)} examples to {output_path}")


def generate_complete_training_dataset() -> None:
    """Generate training and validation datasets from all questions."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
    )
    
    logging.info(f"Generating training dataset from {len(TRAINING_QUESTIONS)} questions...")
    
    # Convert all questions to prompt-response format
    dataset = [create_prompt_response(q) for q in TRAINING_QUESTIONS]
    
    # Split into train/val (80/20)
    train_data, val_data = split_dataset(dataset, train_ratio=0.8)
    
    # Save datasets
    save_dataset(train_data, DATASET_TRAIN_PATH)
    save_dataset(val_data, DATASET_VAL_PATH)
    
    logging.info(f"✓ Dataset generation complete!")
    logging.info(f"  Training: {len(train_data)} examples")
    logging.info(f"  Validation: {len(val_data)} examples")
    logging.info(f"✓ Ready for fine-tuning with: python -m training.finetune")


if __name__ == "__main__":
    generate_complete_training_dataset()
