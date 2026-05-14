const SYSTEM_PROMPT = `You are the ZYNNOX AI Search Agent.
Plan multiple web searches, compare sources, extract facts, and create a research-style answer.
Return JSON with answer, summary, keyFindings, confidence, followUpQuestions.`;

export const aiSearchAgent = {
  id: "ai-search",
  name: "AI Search Agent",
  systemPrompt: SYSTEM_PROMPT,
  async planQueries({ query, depth, ai }) {
    if (depth === "quick") return [query];
    try {
      const result = await ai.json(
        [
          { role: "system", content: "Return JSON only: {\"queries\":[\"...\"]}. Create web search queries." },
          { role: "user", content: JSON.stringify({ query, depth }) }
        ],
        { maxTokens: 300 }
      );
      return Array.isArray(result.queries) && result.queries.length ? result.queries.slice(0, depth === "deep" ? 5 : 3) : [query];
    } catch {
      return depth === "deep" ? [query, `${query} analysis`, `${query} latest sources`] : [query, `${query} overview`];
    }
  },
  async synthesize({ query, depth, sources, ai }) {
    try {
      return await ai.json(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ query, depth, sources }) }
        ],
        { maxTokens: 1200 }
      );
    } catch {
      return {
        answer: sources.length
          ? `I found ${sources.length} source(s). In demo mode, ZYNNOX can show the research flow, and production mode will synthesize a deeper sourced answer.`
          : "No sources were found for this query.",
        summary: "AI Search completed with fallback synthesis.",
        keyFindings: sources.slice(0, 5).map((source) => source.snippet || source.title),
        confidence: sources.length ? "medium" : "low",
        followUpQuestions: ["Should I run a deeper search?", "Do you want a source-by-source comparison?"]
      };
    }
  }
};
