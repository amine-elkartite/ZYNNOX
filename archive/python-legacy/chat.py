"""Terminal chat loop for the smart inference system."""

from __future__ import annotations

from training.smart_inference import answer, start_retrain_scheduler


def main() -> None:
    """Run an interactive terminal session until the user types exit."""
    start_retrain_scheduler(blocking=False)

    while True:
        question = input("You: ").strip()
        if question.lower() == "exit":
            break

        result = answer(question)
        print(f"\nAI: {result['answer']}")

        if result["source"] == "web_search":
            print(f"[Searched the web - Source: {result['urls']}]")
        elif result["source"] == "wikipedia":
            print("[Found on Wikipedia]")
        else:
            print("[Answered from local knowledge]")

        if result["saved_to_db"]:
            print("[Learned and saved to database]")

        print()


if __name__ == "__main__":
    main()
