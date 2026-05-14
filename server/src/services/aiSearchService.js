import { aiSearchAgent } from "../agents/aiSearchAgent.js";
import { aiSearchCost } from "../config/creditCosts.js";
import { webSearchTool } from "../tools/webSearchTool.js";
import { aiProviderService } from "./aiProviderService.js";
import { assertCredits, chargeForAction } from "./creditService.js";
import { saveAiSearchSession } from "./memoryService.js";

export async function runAiSearch({ userId, query, depth }) {
  const credits = aiSearchCost(depth);
  await assertCredits(userId, credits);
  const searchQueries = await aiSearchAgent.planQueries({ query, depth, ai: aiProviderService });
  const sourceMap = new Map();
  for (const searchQuery of searchQueries) {
    const { results } = await webSearchTool.execute({ query: searchQuery, limit: depth === "deep" ? 8 : 5, userId });
    for (const result of results) {
      sourceMap.set(result.url, result);
    }
  }
  const sources = [...sourceMap.values()];
  const synthesized = await aiSearchAgent.synthesize({ query, depth, sources, ai: aiProviderService });
  const charge = await chargeForAction({
    userId,
    credits,
    actionType: `ai_search_${depth}`,
    referenceType: "ai_search",
    referenceId: query,
    metadata: { depth, searchQueries }
  });
  const session = await saveAiSearchSession({
    userId,
    query,
    depth,
    answer: synthesized.answer,
    summary: synthesized.summary,
    sources,
    searchQueries,
    confidence: synthesized.confidence,
    creditsUsed: credits
  });
  return {
    answer: synthesized.answer,
    summary: synthesized.summary,
    sources,
    searchQueries,
    confidence: synthesized.confidence,
    followUpQuestions: synthesized.followUpQuestions || [],
    creditsUsed: credits,
    remainingCredits: charge.user.credits,
    sessionId: session.id
  };
}
