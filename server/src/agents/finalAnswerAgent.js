const SYSTEM_PROMPT = `You are the ZYNNOX Final Answer Agent.
Combine agent results into one professional answer. Include citations when sources are present and include credits used and remaining credits.
Return JSON with answer, actionItems, confidence.`;

function fallback({ message, agentResults, sources, creditsUsed, remainingCredits }) {
  const summaries = agentResults.map((result) => `${result.agent}: ${result.summary || result.answer || "completed"}`).join("\n");
  const citations = sources.map((source, index) => `[${index + 1}] ${source.title} - ${source.url}`).join("\n");
  return {
    answer: [`ZYNNOX processed: ${message}`, summaries, citations ? `Sources:\n${citations}` : "", `Credits used: ${creditsUsed}. Remaining credits: ${remainingCredits}.`].filter(Boolean).join("\n\n"),
    actionItems: [],
    confidence: sources.length ? 0.6 : 0.4
  };
}

export const finalAnswerAgent = {
  id: "final",
  name: "Final Answer Agent",
  systemPrompt: SYSTEM_PROMPT,
  async run({ message, ai, routerResult, agentResults, sources, creditsUsed, remainingCredits }) {
    const fallbackResult = fallback({ message, agentResults, sources, creditsUsed, remainingCredits });
    try {
      const result = await ai.json(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ message, routerResult, agentResults, sources, creditsUsed, remainingCredits }) }
        ],
        { maxTokens: 1200 }
      );
      return { agent: this.id, answer: result.answer || fallbackResult.answer, actionItems: result.actionItems || [], confidence: result.confidence || fallbackResult.confidence };
    } catch {
      return { agent: this.id, ...fallbackResult };
    }
  }
};
