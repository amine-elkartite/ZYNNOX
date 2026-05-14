import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { cleanText } from "../utils/validation.js";

function normalized(result, source) {
  const url = cleanText(result.url || result.link || result.href || "", 1000);
  return {
    title: cleanText(result.title || result.name || url || "Untitled result", 240),
    url,
    snippet: cleanText(result.snippet || result.description || result.body || "", 700),
    source,
    publishedDate: result.publishedDate || result.date || "",
    score: Number(result.score || result.rank || 0)
  };
}

function demoResults(query, limit) {
  return Array.from({ length: Math.min(limit, 5) }, (_, index) => ({
    title: `Demo source ${index + 1} for ${query}`,
    url: `https://example.com/zynnox-demo/${encodeURIComponent(query).slice(0, 40)}/${index + 1}`,
    snippet: "Demo search mode is enabled. Configure SEARCH_MODE=production and SEARCH_API_KEY for live web results.",
    source: "demo",
    publishedDate: "",
    score: 1 - index * 0.1
  }));
}

async function serper(query, limit) {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": env.searchApiKey },
    body: JSON.stringify({ q: query, num: limit })
  });
  if (!response.ok) throw new AppError("Serper search failed.", response.status, "SEARCH_PROVIDER_ERROR", await response.text());
  const payload = await response.json();
  return [...(payload.organic || []), ...(payload.news || [])].slice(0, limit).map((item) => normalized(item, "serper"));
}

async function tavily(query, limit) {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: env.searchApiKey, query, max_results: limit, search_depth: "advanced" })
  });
  if (!response.ok) throw new AppError("Tavily search failed.", response.status, "SEARCH_PROVIDER_ERROR", await response.text());
  const payload = await response.json();
  return (payload.results || []).slice(0, limit).map((item) => normalized(item, "tavily"));
}

async function brave(query, limit) {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(limit));
  const response = await fetch(url, { headers: { Accept: "application/json", "X-Subscription-Token": env.searchApiKey } });
  if (!response.ok) throw new AppError("Brave search failed.", response.status, "SEARCH_PROVIDER_ERROR", await response.text());
  const payload = await response.json();
  return (payload.web?.results || []).slice(0, limit).map((item) => normalized(item, "brave"));
}

export async function searchWeb(query, options = {}) {
  const cleanQuery = cleanText(query, 500);
  if (!cleanQuery) throw new AppError("Search query is required.", 400, "SEARCH_QUERY_REQUIRED");
  const limit = Math.min(Number(options.limit || env.maxSearchResults), 10);
  if (env.searchMode !== "production") return demoResults(cleanQuery, limit);
  if (!env.searchApiKey) throw new AppError("Search API is not configured.", 503, "SEARCH_UNAVAILABLE");
  if (env.searchProvider === "tavily") return tavily(cleanQuery, limit);
  if (env.searchProvider === "brave") return brave(cleanQuery, limit);
  return serper(cleanQuery, limit);
}
