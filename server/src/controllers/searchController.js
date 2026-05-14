import { z } from "zod";
import { CREDIT_COSTS } from "../config/creditCosts.js";
import { chargeForAction } from "../services/creditService.js";
import { saveSearchResults } from "../services/memoryService.js";
import { searchWeb } from "../services/searchService.js";
import { env } from "../config/env.js";

export const searchSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(10).optional()
});

export async function search(request, response) {
  const results = await searchWeb(request.body.query, { limit: request.body.limit });
  const saved = await saveSearchResults({
    userId: request.user.id,
    query: request.body.query,
    provider: env.searchMode === "production" ? env.searchProvider : "demo",
    results
  });
  const charge = await chargeForAction({
    userId: request.user.id,
    credits: CREDIT_COSTS.DIRECT_SEARCH,
    actionType: "direct_search",
    referenceType: "search_results",
    referenceId: saved.id,
    metadata: { query: request.body.query }
  });
  response.json({
    ok: true,
    query: request.body.query,
    results,
    creditsUsed: CREDIT_COSTS.DIRECT_SEARCH,
    remainingCredits: charge.user.credits
  });
}
