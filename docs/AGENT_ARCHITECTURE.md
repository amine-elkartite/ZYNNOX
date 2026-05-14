# Agent Architecture

The agent orchestrator runs:

1. Credit precheck.
2. Router Agent.
3. Selected specialized agents.
4. Final Answer Agent.
5. Credit deduction.
6. Usage, message, step, and run logging.

Agents return structured JSON and can call tools through the orchestrator context.
