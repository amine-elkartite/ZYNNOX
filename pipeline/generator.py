"""Question generation utilities for building a local training corpus."""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Iterable

from config import QUESTIONS_PATH, RANDOM_SEED, ensure_directories


@dataclass(frozen=True)
class GeneratedQuestion:
    """Represent a generated question together with the topic it belongs to."""

    topic: str
    question: str


TOPIC_CONCEPTS = {
    "science": [
        "gravity",
        "photosynthesis",
        "evolution",
        "the scientific method",
        "climate change",
        "atoms",
        "electricity",
        "the solar system",
        "vaccines",
        "ecosystems",
    ],
    "history": [
        "the Roman Empire",
        "the Renaissance",
        "World War II",
        "ancient Egypt",
        "the Industrial Revolution",
        "the Silk Road",
        "the American Revolution",
        "the printing press",
        "the Cold War",
        "the French Revolution",
    ],
    "coding": [
        "Python functions",
        "recursion",
        "object-oriented programming",
        "databases",
        "APIs",
        "testing",
        "data structures",
        "version control",
        "debugging",
        "machine learning code",
    ],
    "mathematics": [
        "prime numbers",
        "calculus",
        "probability",
        "linear algebra",
        "geometry",
        "statistics",
        "fractions",
        "logic",
        "functions",
        "optimization",
    ],
    "philosophy": [
        "ethics",
        "free will",
        "knowledge",
        "consciousness",
        "justice",
        "identity",
        "virtue",
        "truth",
        "meaning",
        "political philosophy",
    ],
    "general knowledge": [
        "world capitals",
        "healthy habits",
        "personal finance",
        "geography",
        "public speaking",
        "critical thinking",
        "nutrition",
        "space exploration",
        "languages",
        "technology trends",
    ],
}

GENERIC_CONCEPTS = [
    "problem solving",
    "communication",
    "systems thinking",
    "evidence",
    "learning",
    "risk",
    "decision making",
    "creativity",
]

QUESTION_TEMPLATES = [
    "What is {concept}, and why is it important in {topic}?",
    "How would you explain {concept} to a beginner studying {topic}?",
    "What are the main causes or principles behind {concept}?",
    "Can you compare {concept} with another idea from {topic}?",
    "What is a practical example of {concept}?",
    "What are common misconceptions about {concept}?",
    "How has {concept} changed over time?",
    "What are the advantages and limitations of {concept}?",
    "Why do experts in {topic} care about {concept}?",
    "What steps would you follow to analyze {concept}?",
]


def _normalize_topics(topics: Iterable[str]) -> list[str]:
    """Clean topic names and reject empty topic lists before generation starts."""
    normalized = [topic.strip().lower() for topic in topics if topic and topic.strip()]
    if not normalized:
        raise ValueError("At least one non-empty topic is required.")
    return normalized


def _concepts_for_topic(topic: str) -> list[str]:
    """Return curated topic concepts, falling back to generic concepts if unknown."""
    return TOPIC_CONCEPTS.get(topic, GENERIC_CONCEPTS)


def _questions_for_topic(topic: str, count: int, rng: random.Random) -> list[GeneratedQuestion]:
    """Create a deterministic but varied set of questions for one topic."""
    concepts = _concepts_for_topic(topic)
    combinations = [
        template.format(concept=concept, topic=topic)
        for concept in concepts
        for template in QUESTION_TEMPLATES
    ]
    rng.shuffle(combinations)
    questions: list[GeneratedQuestion] = []
    seen: set[str] = set()
    variation = 1

    while len(questions) < count:
        if combinations:
            question = combinations.pop()
        else:
            concept = rng.choice(concepts)
            template = rng.choice(QUESTION_TEMPLATES)
            question = (
                f"{template.format(concept=concept, topic=topic)} "
                f"Give perspective {variation}."
            )
            variation += 1

        if question not in seen:
            seen.add(question)
            questions.append(GeneratedQuestion(topic=topic, question=question))

    return questions


def generate_questions(topics: Iterable[str], n: int = 100) -> list[GeneratedQuestion]:
    """Generate diverse questions across topics and save them to questions.txt.

    The value of ``n`` is treated as the total number of questions to create
    across all topics. Questions are distributed as evenly as possible, and the
    returned objects retain topic metadata for the collection pipeline.
    """
    ensure_directories()
    if n <= 0:
        raise ValueError("n must be greater than zero.")

    normalized_topics = _normalize_topics(topics)
    rng = random.Random(RANDOM_SEED)
    base_count, remainder = divmod(n, len(normalized_topics))
    generated: list[GeneratedQuestion] = []

    for index, topic in enumerate(normalized_topics):
        topic_count = base_count + (1 if index < remainder else 0)
        generated.extend(_questions_for_topic(topic, topic_count, rng))

    rng.shuffle(generated)
    QUESTIONS_PATH.write_text(
        "\n".join(item.question for item in generated) + "\n",
        encoding="utf-8",
    )
    return generated
