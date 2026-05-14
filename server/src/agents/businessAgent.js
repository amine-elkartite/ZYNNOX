const SYSTEM_PROMPT = `You are the ZYNNOX Business Agent. Return JSON with summary, opportunities, nextSteps, confidence.`;

export const businessAgent = {
  id: "business",
  name: "Business/Strategy Agent",
  systemPrompt: SYSTEM_PROMPT,
  async run({ message, ai }) {
    try {
      const result = await ai.json(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message }
        ],
        { maxTokens: 800 }
      );
      return { agent: this.id, summary: result.summary, opportunities: result.opportunities || [], nextSteps: result.nextSteps || [], confidence: result.confidence || 0.7 };
    } catch {
      return { agent: this.id, summary: "Position ZYNNOX as a credit-based AI agent workspace with research, build, and security workflows.", opportunities: [], nextSteps: [], confidence: 0.4 };
    }
  }
};
