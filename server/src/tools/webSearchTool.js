import { env } from "../config/env.js";
import { saveSearchResults } from "../services/memoryService.js";
import { searchWeb } from "../services/searchService.js";

export const webSearchTool = {
  id: "web-search",
  name: "Web Search",
  description: "Search the web with the configured provider and return normalized sources.",
  creditCost: 2,
  async execute({ query, limit, userId, runId }) {
    const results = await searchWeb(query, { limit });
    if (userId) await saveSearchResults({ userId, runId, query, provider: env.searchMode === "production" ? env.searchProvider : "demo", results });
    return { query, results };
  }
};
