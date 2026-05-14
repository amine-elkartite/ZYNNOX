import { cleanText } from "../utils/validation.js";

const SYSTEM_PROMPT = `You are the ZYNNOX Research Agent.
Use supplied web results only. Return JSON with summary, keyFindings, citations, confidence.`;

export const researchAgent = {
  id: "research",
  name: "Research Agent",
  systemPrompt: SYSTEM_PROMPT,
  async run({ message, ai, tools, userId, runId, routerDecision }) {
    const query = routerDecision?.searchQuery || message;
    const search = await tools.webSearch.execute({ query, limit: 6, userId, runId });
    const sources = search.results;
    try {
      const result = await ai.json(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ request: message, sources }) }
        ],
        { maxTokens: 900 }
      );
      return {
        agent: this.id,
        summary: cleanText(result.summary || result.answer, 3000),
        keyFindings: Array.isArray(result.keyFindings) ? result.keyFindings : [],
        citations: Array.isArray(result.citations) ? result.citations : sources,
        sources,
        confidence: result.confidence || "medium"
      };
    } catch (error) {
      return {
        agent: this.id,
        summary: sources.length ? `Found ${sources.length} source(s) for the request.` : "No usable search sources were found.",
        keyFindings: sources.map((source) => source.snippet).filter(Boolean).slice(0, 4),
        citations: sources,
        sources,
        confidence: sources.length ? "medium" : "low",
        warning: error.code || error.message
      };
    }
  }
};
