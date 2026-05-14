const SYSTEM_PROMPT = `You are the ZYNNOX UI/UX Agent. Return JSON with summary, improvements, accessibility, confidence.`;

export const uiuxAgent = {
  id: "uiux",
  name: "UI/UX Agent",
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
      return { agent: this.id, summary: result.summary, improvements: result.improvements || [], accessibility: result.accessibility || [], confidence: result.confidence || 0.7 };
    } catch {
      return { agent: this.id, summary: "Use ZYNNOX dark navy, cyan, white, and soft-gray dashboard patterns with clear loading, error, and empty states.", improvements: [], accessibility: [], confidence: 0.4 };
    }
  }
};
