import { cleanText } from "../utils/validation.js";

const SYSTEM_PROMPT = `You are the ZYNNOX Coding Agent. Return JSON with summary, recommendations, risks, confidence.`;

export const codingAgent = {
  id: "coding",
  name: "Coding Agent",
  systemPrompt: SYSTEM_PROMPT,
  async run({ message, ai }) {
    try {
      const result = await ai.json(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: cleanText(message, 8000) }
        ],
        { maxTokens: 800 }
      );
      return { agent: this.id, summary: result.summary, recommendations: result.recommendations || [], risks: result.risks || [], confidence: result.confidence || 0.7 };
    } catch (error) {
      return { agent: this.id, summary: "Coding agent fallback used.", recommendations: ["Configure AI_MODE=production for detailed coding output."], risks: [error.message], confidence: 0.25 };
    }
  }
};
