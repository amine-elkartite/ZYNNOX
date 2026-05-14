import crypto from "node:crypto";
import { configuredAiProviderNames, env } from "../config/env.js";
import { cleanText } from "../utils/validation.js";
import {
  getSearchCache,
  intelligenceSnapshot,
  listKnowledgeEntries,
  listTrainingQuestions,
  saveIntelligenceEvent,
  saveKnowledgeEntry,
  saveLearnedFact,
  saveProviderPerformance,
  saveSearchCache,
  touchKnowledgeEntry,
  findUserById
} from "./memoryService.js";

const circuitBreakers = new Map();

const QUERY_ROUTES = {
  factual: ["anthropic", "openai", "deepseek", "google", "groq", "openrouter", "mistral", "xai", "together", "perplexity"],
  reasoning: ["anthropic", "openai", "deepseek"],
  coding: ["anthropic", "openai", "deepseek"],
  news: ["perplexity", "google", "openai", "xai"],
  creative: ["anthropic", "openai", "mistral"],
  math: ["deepseek", "openai", "anthropic"],
  opinion: ["anthropic", "openai", "mistral", "xai"]
};

const OPENAI_COMPATIBLE = {
  openai: { baseUrl: "https://api.openai.com/v1", key: () => env.providers.openai.apiKey, model: () => env.providers.openai.model },
  deepseek: { baseUrl: "https://api.deepseek.com/v1", key: () => env.providers.deepseek.apiKey, model: () => env.providers.deepseek.model },
  groq: { baseUrl: "https://api.groq.com/openai/v1", key: () => env.providers.groq.apiKey, model: () => env.providers.groq.model },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", key: () => env.providers.openrouter.apiKey, model: () => env.providers.openrouter.model },
  mistral: { baseUrl: "https://api.mistral.ai/v1", key: () => env.providers.mistral.apiKey, model: () => env.providers.mistral.model },
  xai: { baseUrl: "https://api.x.ai/v1", key: () => env.providers.xai.apiKey, model: () => env.providers.xai.model },
  together: { baseUrl: "https://api.together.xyz/v1", key: () => env.providers.together.apiKey, model: () => env.providers.together.model },
  perplexity: { baseUrl: "https://api.perplexity.ai", key: () => env.providers.perplexity.apiKey, model: () => env.providers.perplexity.model }
};

const searchCacheKey = (query) => crypto.createHash("sha256").update(query.toLowerCase()).digest("hex");
const wordSet = (text) => new Set(String(text || "").toLowerCase().match(/[a-z0-9]{3,}/g) || []);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CONTENT_TYPE_LABELS = {
  research_paper: "Research Paper",
  news_article: "News",
  technical_doc: "Technical",
  legal_doc: "Legal",
  blog_article: "Blog / Commentary",
  general_query: "General Query",
  other_document: "Document"
};

function sentenceSafeText(value, maxLength = 12000) {
  const text = cleanText(value, maxLength + 1000);
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength);
  const boundary = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf("!"), clipped.lastIndexOf("?"));
  if (boundary > maxLength * 0.6) return clipped.slice(0, boundary + 1).trim();
  return `${clipped.replace(/\s+\S*$/u, "").trim()}.`;
}

function contentTypeLabel(contentType) {
  return CONTENT_TYPE_LABELS[contentType] || CONTENT_TYPE_LABELS.other_document;
}

function detectContentType(message, category) {
  const text = String(message || "").toLowerCase();
  if (/\b(abstract|doi|methodology|methods|participants|dataset|results|conclusion|limitations|related work)\b/.test(text)) return "research_paper";
  if (/\b(headline|reported|according to|spokesperson|minister|president|police|court|breaking|news agency)\b/.test(text) || category === "news") return "news_article";
  if (/\b(api|sdk|endpoint|installation|configuration|requirements|example|function|class|schema|cli|docker|kubernetes)\b/.test(text) || category === "coding") return "technical_doc";
  if (/\b(section|clause|agreement|statute|regulation|liability|jurisdiction|terms of service|privacy policy)\b/.test(text)) return "legal_doc";
  if (/\b(blog|opinion|essay|newsletter|post by|published by)\b/.test(text)) return "blog_article";
  if (String(message || "").length > 1800) return "other_document";
  return "general_query";
}

function detectLanguage(message) {
  const text = String(message || "");
  if (/[اأإء-ي]/u.test(text)) return "Arabic";
  if (/[а-яё]/iu.test(text)) return "Russian";
  if (/[一-龥ぁ-んァ-ン]/u.test(text)) return "Chinese/Japanese";
  if (/\b(le|la|les|des|une|avec|pour|dans|résumé|méthode|résultats)\b/i.test(text)) return "French";
  if (/\b(el|la|los|las|con|para|resumen|método|resultados)\b/i.test(text)) return "Spanish";
  return "English";
}

function extractTitle(message) {
  const lines = String(message || "").split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  const heading = lines.find((line) => /^#{1,3}\s+/.test(line));
  if (heading) return cleanText(heading.replace(/^#{1,3}\s+/, ""), 160);
  const explicit = lines.find((line) => /^(title|headline)\s*:/i.test(line));
  if (explicit) return cleanText(explicit.split(":").slice(1).join(":"), 160);
  const candidate = lines.find((line) => line.length >= 8 && line.length <= 160 && !/[?]$/.test(line));
  return cleanText(candidate || "ZYNNOX Intelligence Analysis", 160);
}

function extractDate(message, search) {
  const text = String(message || "");
  const found = text.match(/\b(19|20)\d{2}[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/u)
    || text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+(19|20)\d{2}\b/iu)
    || text.match(/\b(19|20)\d{2}\b/u);
  return cleanText(found?.[0] || search?.results?.find((item) => item.publishedDate)?.publishedDate || "Not found in source", 80);
}

function extractSourceName(search) {
  const first = sourceList(search)[0];
  if (!first?.url) return "Provided content";
  try {
    return new URL(first.url).hostname.replace(/^www\./, "");
  } catch {
    return first.source || "Provided content";
  }
}

function extractSpecificSignals(message) {
  const text = String(message || "");
  const numbers = [...new Set(text.match(/\b\d+(?:[.,]\d+)?\s?(?:%|percent|x|ms|s|sec|seconds|minutes|hours|days|years|million|billion|tokens|parameters|users|samples|cases|pages|GB|MB|KB)?\b/giu) || [])].slice(0, 12);
  const dates = [...new Set(text.match(/\b(?:\d{1,2}\s+)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}?,?\s*(?:19|20)\d{2}|\b(?:19|20)\d{2}\b/giu) || [])].slice(0, 8);
  const doi = text.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/iu)?.[0] || "";
  const namedEntities = [...new Set(text.match(/\b[A-Z][A-Za-z0-9&.'-]+(?:\s+[A-Z][A-Za-z0-9&.'-]+){1,5}\b/gu) || [])]
    .filter((item) => !/^(Abstract|Introduction|Methods|Results|Discussion|Conclusion|References)$/i.test(item))
    .slice(0, 12);
  const sentences = sentenceSafeText(text, 8000).split(/(?<=[.!?])\s+/u).filter((item) => item.length > 40).slice(0, 8);
  return { numbers, dates, doi, namedEntities, sentences };
}

function similarity(a, b) {
  const left = wordSet(a);
  const right = wordSet(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.sqrt(left.size * right.size);
}

function classifyQuery(message) {
  const text = message.toLowerCase();
  if (isSmallTalk(message)) return "conversation";
  if (/\b(latest|today|yesterday|current|breaking|news|recent|price|schedule)\b/.test(text)) return "news";
  if (/\b(code|bug|typescript|javascript|react|node|api|database|stacktrace|function)\b/.test(text)) return "coding";
  if (/\b(calculate|math|equation|proof|probability|integral|derivative)\b/.test(text)) return "math";
  if (/\b(write|story|brand|copy|creative|poem|campaign|idea)\b/.test(text)) return "creative";
  if (/\b(why|reason|analyze|compare|decide|tradeoff|strategy)\b/.test(text)) return "reasoning";
  if (/\b(opinion|recommend|best|should i)\b/.test(text)) return "opinion";
  return "factual";
}

function isSmallTalk(message) {
  const text = cleanText(message, 240).toLowerCase();
  return /^(hi|hello|hey|yo|sup|slm|slt|salam|salam alaykom|salam alaikom|salam alaikum|salam aleikum|salam alikom|salam 3alaykom|salam 3likom|labas|labass|labes|wach labas|kidayr|kif dayr|cv|ca va|ça va|bonjour|hola|good morning|good afternoon|good evening)[?!. ]*$/i.test(text)
    || /^(thanks|thank you|thx|ok|okay|cool|nice)[!. ]*$/i.test(text)
    || /\b(how are you|who are you|what can you do|help me|start chat)\b/i.test(text);
}

function firstName(user) {
  const name = cleanText(user?.name || "", 80).split(/\s+/u)[0];
  return name || "there";
}

function directConversationAnswer(message, user) {
  const text = cleanText(message, 240).toLowerCase();
  const name = firstName(user);
  if (/^(slm|slt|salam|salam alaykom|salam alaikom|salam alaikum|salam aleikum|salam alikom|salam 3alaykom|salam 3likom)[?!. ]*$/i.test(text)) {
    return `Wa alaykom salam ${name}! Labas?`;
  }
  if (/^(labas|labass|labes|wach labas|kidayr|kif dayr|cv|ca va|ça va)[?!. ]*$/i.test(text)) {
    return `Lhamdolilah, labas 😊\nNta kif dayr ${name}?`;
  }
  if (/^(hi|hello|hey|yo|sup|bonjour|hola|good morning|good afternoon|good evening)/i.test(text)) {
    return `Hi ${name}! How can I help you today?`;
  }
  if (/^(thanks|thank you|thx)/i.test(text)) {
    return `You’re welcome, ${name}.`;
  }
  if (/\bhow are you\b/i.test(text)) {
    return `I’m ready to help, ${name}. Send me a question, document, link, or code and I’ll work through it.`;
  }
  if (/\bwho are you\b/i.test(text)) {
    return "I’m ZYNNOX, your AI workspace assistant for chat, research, code help, credits, billing, and website generation.";
  }
  if (/\bwhat can you do|help me|start chat\b/i.test(text)) {
    return "I can answer questions, analyze documents, search the web, compare sources, help with code, generate website drafts, and explain results clearly.";
  }
  return `I’m here, ${name}. What would you like to work on?`;
}

function decomposeQuery(message, contentType = "general_query") {
  const signals = extractSpecificSignals(message);
  const title = extractTitle(message);
  const clean = sentenceSafeText(message, 800);
  const base = clean.replace(/[?!.]+$/g, "");
  const documentQueries = contentType === "general_query" ? [] : [
    `${title} methodology findings limitations`,
    `${title} source credibility key facts`,
    `${signals.doi || title} DOI publication authors`
  ];
  return [
    base,
    ...documentQueries,
    `${base} latest reliable sources`,
    `${base} technical details`,
    `${base} risks limitations`,
    `${base} examples`
  ].filter((item, index, items) => item && items.indexOf(item) === index).slice(0, 5);
}

function circuitOpen(provider) {
  const state = circuitBreakers.get(provider);
  return state?.pauseUntil && state.pauseUntil > Date.now();
}

function recordProviderSuccess(provider) {
  circuitBreakers.delete(provider);
}

function recordProviderFailure(provider) {
  const state = circuitBreakers.get(provider) || { failures: 0, pauseUntil: 0 };
  state.failures += 1;
  if (state.failures >= 3) state.pauseUntil = Date.now() + 5 * 60 * 1000;
  circuitBreakers.set(provider, state);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = env.intelligenceProviderTimeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function estimateConfidence(text, evidence = "") {
  const lengthScore = Math.min(String(text || "").length / 1400, 1);
  const evidenceScore = evidence ? similarity(text, evidence) : 0.3;
  return Math.max(0.2, Math.min(0.98, (lengthScore * 0.45) + (evidenceScore * 0.55)));
}

function estimateCost(provider, text) {
  const tokens = Math.ceil(String(text || "").length / 4);
  const perMillion = provider === "openai" ? 5 : provider === "anthropic" ? 6 : provider === "perplexity" ? 5 : 1;
  return Number(((tokens / 1_000_000) * perMillion).toFixed(6));
}

async function openAiCompatible(provider, prompt) {
  const spec = OPENAI_COMPATIBLE[provider];
  const apiKey = spec.key();
  if (!apiKey) return { skipped: true, reason: "missing_api_key" };
  const response = await fetchWithTimeout(`${spec.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://zynnox.local",
      "X-Title": "ZYNNOX Intelligence"
    },
    body: JSON.stringify({
      model: spec.model(),
      temperature: 0.2,
      max_tokens: 3200,
      messages: [
        { role: "system", content: "You are a careful ZYNNOX intelligence provider. Answer with concise reasoning, confidence, and sources when available." },
        { role: "user", content: prompt }
      ]
    })
  });
  if (!response.ok) throw new Error(await response.text());
  const payload = await response.json();
  return { response: payload?.choices?.[0]?.message?.content || "", raw: payload };
}

async function anthropic(prompt) {
  if (!env.providers.anthropic.apiKey) return { skipped: true, reason: "missing_api_key" };
  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.providers.anthropic.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: env.providers.anthropic.model,
      max_tokens: 3600,
      temperature: 0.2,
      system: "You are the ZYNNOX master synthesizer. Be accurate, cite evidence, and flag uncertainty.",
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!response.ok) throw new Error(await response.text());
  const payload = await response.json();
  return { response: (payload.content || []).map((item) => item.text).join("\n").trim(), raw: payload };
}

async function gemini(prompt) {
  if (!env.providers.google.apiKey) return { skipped: true, reason: "missing_api_key" };
  const model = env.providers.google.model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${env.providers.google.apiKey}`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
  });
  if (!response.ok) throw new Error(await response.text());
  const payload = await response.json();
  return { response: payload?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") || "", raw: payload };
}

async function callProvider(provider, prompt, category, evidenceText) {
  const started = Date.now();
  if (circuitOpen(provider)) return { provider, status: "skipped", reason: "circuit_open", responseTimeMs: 0, confidence: 0 };
  try {
    const result = provider === "anthropic" ? await anthropic(prompt) : provider === "google" ? await gemini(prompt) : await openAiCompatible(provider, prompt);
    if (result.skipped) return { provider, status: "skipped", reason: result.reason, responseTimeMs: Date.now() - started, confidence: 0 };
    recordProviderSuccess(provider);
    const response = sentenceSafeText(result.response, 16000);
    const confidence = estimateConfidence(response, evidenceText);
    return {
      provider,
      category,
      status: "fulfilled",
      response,
      confidence,
      responseTimeMs: Date.now() - started,
      costUsd: estimateCost(provider, response)
    };
  } catch (error) {
    recordProviderFailure(provider);
    return { provider, category, status: "rejected", error: cleanText(error.message, 600), responseTimeMs: Date.now() - started, confidence: 0 };
  }
}

function normalizeResult(result, provider, query) {
  const url = cleanText(result.url || result.link || result.html_url || result.apiUrl || "", 1000);
  return {
    title: cleanText(result.title || result.name || result.full_name || result.question_id || url || query, 240),
    url,
    snippet: cleanText(result.snippet || result.description || result.body || result.abstract || result.selftext || "", 900),
    source: provider,
    publishedDate: result.publishedDate || result.published_at || result.created_at || result.pubDate || result.date || "",
    score: Number(result.score || 0)
  };
}

async function braveSearch(query) {
  if (!env.searchKeys.brave) return [];
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "10");
  const response = await fetchWithTimeout(url, { headers: { Accept: "application/json", "X-Subscription-Token": env.searchKeys.brave } });
  if (!response.ok) return [];
  const payload = await response.json();
  return (payload.web?.results || []).map((item) => normalizeResult(item, "brave", query));
}

async function googleSearch(query) {
  if (!env.searchKeys.google || !env.searchKeys.googleCx) return [];
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", env.searchKeys.google);
  url.searchParams.set("cx", env.searchKeys.googleCx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "10");
  const response = await fetchWithTimeout(url);
  if (!response.ok) return [];
  const payload = await response.json();
  return (payload.items || []).map((item) => normalizeResult(item, "google", query));
}

async function bingSearch(query) {
  if (!env.searchKeys.bing) return [];
  const url = new URL("https://api.bing.microsoft.com/v7.0/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "10");
  const response = await fetchWithTimeout(url, { headers: { "Ocp-Apim-Subscription-Key": env.searchKeys.bing } });
  if (!response.ok) return [];
  const payload = await response.json();
  return (payload.webPages?.value || []).map((item) => normalizeResult(item, "bing", query));
}

async function serperSearch(query) {
  if (!env.searchKeys.serper) return [];
  const response = await fetchWithTimeout("https://google.serper.dev/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": env.searchKeys.serper },
    body: JSON.stringify({ q: query, num: 10 })
  });
  if (!response.ok) return [];
  const payload = await response.json();
  return [...(payload.organic || []), ...(payload.news || [])].map((item) => normalizeResult(item, "serper", query));
}

async function newsSearch(query) {
  if (!env.searchKeys.news) return [];
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", query);
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("sortBy", "publishedAt");
  const response = await fetchWithTimeout(url, { headers: { "X-Api-Key": env.searchKeys.news } });
  if (!response.ok) return [];
  const payload = await response.json();
  return (payload.articles || []).map((item) => normalizeResult(item, "newsapi", query));
}

async function arxivSearch(query) {
  const url = new URL("https://export.arxiv.org/api/query");
  url.searchParams.set("search_query", `all:${query}`);
  url.searchParams.set("start", "0");
  url.searchParams.set("max_results", "10");
  const response = await fetchWithTimeout(url);
  if (!response.ok) return [];
  const xml = await response.text();
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => ({
    title: match[1].match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, " ").trim(),
    url: match[1].match(/<id>([\s\S]*?)<\/id>/)?.[1],
    snippet: match[1].match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\s+/g, " ").trim(),
    source: "arxiv",
    publishedDate: match[1].match(/<published>(.*?)<\/published>/)?.[1],
    score: 0
  })).map((item) => normalizeResult(item, "arxiv", query));
}

async function wikipediaSearch(query) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("srsearch", query);
  url.searchParams.set("srlimit", "10");
  const response = await fetchWithTimeout(url);
  if (!response.ok) return [];
  const payload = await response.json();
  return (payload.query?.search || []).map((item) => normalizeResult({
    title: item.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replaceAll(" ", "_"))}`,
    snippet: item.snippet?.replace(/<[^>]+>/g, "")
  }, "wikipedia", query));
}

async function githubSearch(query) {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", query);
  url.searchParams.set("per_page", "10");
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "ZYNNOX" };
  if (env.searchKeys.github) headers.Authorization = `Bearer ${env.searchKeys.github}`;
  const response = await fetchWithTimeout(url, { headers });
  if (!response.ok) return [];
  const payload = await response.json();
  return (payload.items || []).map((item) => normalizeResult(item, "github", query));
}

async function stackOverflowSearch(query) {
  const url = new URL("https://api.stackexchange.com/2.3/search/advanced");
  url.searchParams.set("order", "desc");
  url.searchParams.set("sort", "relevance");
  url.searchParams.set("site", "stackoverflow");
  url.searchParams.set("q", query);
  url.searchParams.set("pagesize", "10");
  const response = await fetchWithTimeout(url);
  if (!response.ok) return [];
  const payload = await response.json();
  return (payload.items || []).map((item) => normalizeResult({ ...item, url: item.link }, "stackoverflow", query));
}

async function redditSearch(query) {
  const url = new URL("https://www.reddit.com/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "10");
  const response = await fetchWithTimeout(url, { headers: { "User-Agent": "ZYNNOX/1.0" } });
  if (!response.ok) return [];
  const payload = await response.json();
  return (payload.data?.children || []).map((child) => normalizeResult({
    title: child.data?.title,
    url: child.data?.url || `https://reddit.com${child.data?.permalink || ""}`,
    snippet: child.data?.selftext
  }, "reddit", query));
}

async function runSearchProvider(provider, query) {
  const started = Date.now();
  const map = {
    brave: braveSearch,
    google: googleSearch,
    bing: bingSearch,
    serper: serperSearch,
    newsapi: newsSearch,
    arxiv: arxivSearch,
    wikipedia: wikipediaSearch,
    github: githubSearch,
    stackoverflow: stackOverflowSearch,
    reddit: redditSearch
  };
  try {
    const results = await map[provider](query);
    return { provider, query, status: "fulfilled", responseTimeMs: Date.now() - started, results };
  } catch (error) {
    return { provider, query, status: "rejected", responseTimeMs: Date.now() - started, error: cleanText(error.message, 400), results: [] };
  }
}

function dedupeResults(results) {
  const seen = new Set();
  return results.filter((result) => {
    const key = result.url || `${result.source}:${result.title}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function robotsAllowed(targetUrl) {
  try {
    const url = new URL(targetUrl);
    const response = await fetchWithTimeout(`${url.origin}/robots.txt`, {}, 2500);
    if (!response.ok) return true;
    const text = await response.text();
    const disallowed = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^disallow:/i.test(line))
      .map((line) => line.split(":").slice(1).join(":").trim())
      .filter(Boolean);
    return !disallowed.some((rule) => rule !== "/" && url.pathname.startsWith(rule));
  } catch {
    return true;
  }
}

function extractHtml(html, url) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || url;
  const author = html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)/i)?.[1] || "";
  const published = html.match(/<meta[^>]+(?:property|name)=["'](?:article:published_time|date|pubdate)["'][^>]+content=["']([^"']+)/i)?.[1] || "";
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  const paywalled = /\b(subscribe to continue|paywall|sign in to continue|register to read)\b/i.test(text);
  return { title, author, publishedDate: published, content: paywalled ? "" : cleanText(text, 16000), paywalled };
}

function chunkContent(scraped, query) {
  const words = scraped.content.split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let index = 0; index < words.length; index += 380) {
    const content = words.slice(index, index + 512).join(" ");
    chunks.push({
      url: scraped.url,
      title: scraped.title,
      source: scraped.source,
      content,
      score: similarity(query, content)
    });
  }
  return chunks;
}

async function scrapeResult(result, query) {
  if (!result.url || !/^https?:\/\//i.test(result.url)) return null;
  if (!(await robotsAllowed(result.url))) return null;
  try {
    const response = await fetchWithTimeout(result.url, { headers: { "User-Agent": "ZYNNOX/1.0" } }, 8000);
    if (!response.ok) return null;
    const html = await response.text();
    const extracted = extractHtml(html, result.url);
    if (!extracted.content) return null;
    return { ...extracted, url: result.url, source: result.source, chunks: chunkContent({ ...extracted, url: result.url, source: result.source }, query) };
  } catch {
    return null;
  }
}

async function runSearchPipeline(message, subQueries) {
  const cacheKey = searchCacheKey(subQueries.join("|"));
  const cached = await getSearchCache(cacheKey);
  if (cached && new Date(cached.expiresAt) > new Date()) return { ...cached.payload, cached: true };

  const providers = ["brave", "google", "bing", "serper", "newsapi", "arxiv", "wikipedia", "github", "stackoverflow", "reddit"];
  const searchSettled = await Promise.allSettled(subQueries.flatMap((query) => providers.map((provider) => runSearchProvider(provider, query))));
  const providerRuns = searchSettled.map((item) => item.status === "fulfilled" ? item.value : { status: "rejected", results: [] });
  const results = dedupeResults(providerRuns.flatMap((run) => run.results || [])).slice(0, 80);
  const topToScrape = subQueries.flatMap((query) =>
    results
      .map((result) => ({ ...result, relevance: similarity(query, `${result.title} ${result.snippet}`) }))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 3)
  );
  const scraped = (await Promise.all(topToScrape.map((result) => scrapeResult(result, message)))).filter(Boolean);
  const chunks = scraped.flatMap((item) => item.chunks).sort((a, b) => b.score - a.score).slice(0, 15);
  const payload = { providerRuns, results, scraped, chunks, cached: false };
  await saveSearchCache({
    cacheKey,
    query: message,
    payload,
    expiresAt: new Date(Date.now() + env.intelligenceCacheTtlMs).toISOString()
  });
  return payload;
}

function evidenceText(search) {
  return [
    ...(search.chunks || []).map((chunk) => `${chunk.title}: ${chunk.content}`),
    ...(search.results || []).slice(0, 15).map((result) => `${result.title}: ${result.snippet}`)
  ].join("\n\n");
}

function sourceList(search) {
  return dedupeResults([...(search.results || []), ...(search.scraped || [])])
    .filter((item) => item.url)
    .slice(0, 20)
    .map((item) => ({ title: item.title, url: item.url, source: item.source, snippet: item.snippet || cleanText(item.content, 260) }));
}

async function retrieveKnowledge(message, category) {
  const entries = await listKnowledgeEntries(300);
  const ranked = entries
    .filter((entry) => entry.category === category || category === "factual")
    .map((entry) => ({ ...entry, similarity: similarity(message, entry.query) }))
    .sort((a, b) => b.similarity - a.similarity);
  const top = ranked[0];
  if (top && top.similarity >= env.intelligenceHighSimilarity) {
    const ageMs = Date.now() - new Date(top.createdAt).getTime();
    const freshnessMs = category === "news" ? 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    if (ageMs < freshnessMs) {
      await touchKnowledgeEntry(top.id);
      return { hit: true, entry: top };
    }
  }
  return { hit: false, context: ranked.filter((entry) => entry.similarity >= env.intelligenceContextSimilarity).slice(0, 3) };
}

function trainingQuestionText(entry) {
  const translations = Object.values(entry.translations || {}).filter(Boolean).join(" ");
  return [entry.domain, entry.topic, entry.questionType, entry.difficulty, entry.question, translations].filter(Boolean).join(" ");
}

async function retrieveTrainingQuestions(message, category) {
  const entries = await listTrainingQuestions(10000);
  return entries
    .map((entry) => {
      const score = similarity(message, trainingQuestionText(entry));
      const categoryBoost = category === "coding" && entry.domain === "coding" ? 0.08 : 0;
      return { ...entry, similarity: Math.min(1, score + categoryBoost) };
    })
    .filter((entry) => entry.similarity >= 0.12)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
}

function trainingQuestionContext(trainingQuestions) {
  if (!trainingQuestions?.length) return "None";
  return trainingQuestions
    .map((entry) => {
      const translated = Object.entries(entry.translations || {})
        .filter(([, value]) => value && value !== entry.question)
        .slice(0, 3)
        .map(([language, value]) => `${language}: ${value}`)
        .join(" | ");
      return `Similar training question (${entry.domain} / ${entry.topic} / ${entry.questionType} / ${entry.difficulty}, score ${entry.similarity.toFixed(2)}): ${entry.question}${translated ? `\nTranslations: ${translated}` : ""}`;
    })
    .join("\n\n");
}

function buildProviderPrompt({ message, category, contentType, language, search, context, trainingQuestions }) {
  const prior = (context || []).map((entry) => `Prior verified answer: ${entry.answer}`).join("\n\n");
  const trainingPrior = trainingQuestionContext(trainingQuestions);
  const signals = extractSpecificSignals(message);
  const title = extractTitle(message);
  if (contentType === "general_query") {
    return `Answer like a capable chat assistant, not like a report template.

Rules:
- Answer the user's specific message directly.
- Be natural, useful, and concise unless the question needs depth.
- Do not use the document-analysis section format for normal chat.
- If the answer needs current facts, use the web evidence and cite sources.
- If unsure, say what is uncertain and include a confidence score.
- Never invent numbers or sources.

User message:
${sentenceSafeText(message, 60000)}

Prior verified context:
${prior || "None"}

Similar training questions:
${trainingPrior}

Use similar training questions only to understand topic, language, and expected depth. They are not answer keys.

Web evidence:
${evidenceText(search) || "No web evidence collected."}`;
  }
  return `You are one validator in ZYNNOX's multi-AI intelligence pipeline.

Task:
- Read the full provided content before answering.
- Detect and respect content type: ${contentTypeLabel(contentType)}.
- Language detected: ${language}. If the source is not English, translate the relevant meaning before analyzing.
- Extract specific names, numbers, findings, methods, dates, limitations, and exact source sentences.
- Never give a generic one-line summary.
- Never invent numbers. If unsure, say so with a confidence score.
- If the user asks a specific question, answer that question first instead of re-summarizing everything.
- If the answer is not in the provided content, use exactly: "This document does not address this — here's what I found via web search:"

Required output structure:
## ${title}
**Type:** ${contentTypeLabel(contentType)}
**Source:** ${extractSourceName(search)}
**Date:** ${extractDate(message, search)}

---

### 🔍 What This Is About
### 📊 Key Findings / Main Points
### ⚙️ How They Did It (Methodology)
### 📈 Results & Numbers
### ⚠️ Limitations & Gaps
### 💡 Why This Matters
### ❓ Suggested Follow-up Questions
### 🔗 Sources Cited

Known signals extracted locally:
Numbers: ${signals.numbers.join(", ") || "None found"}
Dates: ${signals.dates.join(", ") || "None found"}
DOI: ${signals.doi || "None found"}
Named entities: ${signals.namedEntities.join(", ") || "None found"}

Query category: ${category}
Full user content / question:
${sentenceSafeText(message, 60000)}

Verified/retrieved context:
${prior || "None"}

Similar training questions:
${trainingPrior}

Use similar training questions only to understand topic, language, and expected depth. They are not answer keys.

Web evidence:
${evidenceText(search) || "No web evidence collected."}

Return only the structured analysis.`;
}

function compareProviders(providerResponses, search) {
  const evidence = evidenceText(search);
  return providerResponses.map((item) => {
    if (item.status !== "fulfilled") return { provider: item.provider, score: 0, verdict: item.status, reason: item.reason || item.error };
    const evidenceScore = similarity(item.response, evidence);
    const peerAgreement = providerResponses
      .filter((peer) => peer.provider !== item.provider && peer.status === "fulfilled")
      .reduce((sum, peer) => sum + similarity(item.response, peer.response), 0) / Math.max(1, providerResponses.filter((peer) => peer.status === "fulfilled").length - 1);
    const score = Math.max(0.1, Math.min(0.99, (evidenceScore * 0.6) + (peerAgreement * 0.4)));
    return {
      provider: item.provider,
      score,
      verdict: score > 0.72 ? "confirmed" : score > 0.45 ? "likely" : "uncertain",
      responseTimeMs: item.responseTimeMs
    };
  });
}

function localStructuredAnalysis({ message, category, contentType, language, providerResponses, search, confidenceScores = {} }) {
  if (contentType === "general_query") {
    const bestProvider = providerResponses.filter((item) => item.status === "fulfilled").sort((a, b) => b.confidence - a.confidence)[0];
    if (bestProvider?.response) return bestProvider.response;
    const sources = sourceList(search);
    if (sources.length) {
      return [
        "Here’s what I found:",
        ...sources.slice(0, 4).map((source) => `- ${source.title}: ${source.snippet || source.url}`)
      ].join("\n");
    }
    return "Live AI is not configured yet. Add at least one provider key to `.env` and restart the server. I will not fake a model answer.";
  }
  const title = extractTitle(message);
  const signals = extractSpecificSignals(message);
  const sources = sourceList(search);
  const bestProvider = providerResponses.filter((item) => item.status === "fulfilled").sort((a, b) => b.confidence - a.confidence)[0];
  const firstSentences = signals.sentences.slice(0, 3);
  const sourceLines = [
    "- Provided content: local user-supplied text in the current request.",
    ...sources.slice(0, 8).map((source) => `- ${source.title}: ${source.url}`)
  ];
  const confidence = Math.max(...Object.values(confidenceScores).map(Number).filter(Number.isFinite), bestProvider?.confidence || 0.42);
  const findings = [
    ...signals.numbers.slice(0, 5).map((number) => `- The source includes the numeric value "${number}". Verify its meaning against the cited sentence before using it operationally.`),
    ...signals.namedEntities.slice(0, 5).map((entity) => `- The source specifically names ${entity}.`),
    ...firstSentences.map((sentence) => `- Source sentence: "${sentenceSafeText(sentence, 260)}"`)
  ].slice(0, 8);

  return `## ${title}
**Type:** ${contentTypeLabel(contentType)}
**Source:** ${extractSourceName(search)}
**Date:** ${extractDate(message, search)}

---

### 🔍 What This Is About
This is a ${contentTypeLabel(contentType).toLowerCase()} analysis generated from the full request content available to ZYNNOX. Local extraction confidence is ${confidence.toFixed(2)} because ${bestProvider ? `${bestProvider.provider} also responded` : "live validator responses were unavailable or skipped"}.

### 📊 Key Findings / Main Points
${findings.length ? findings.join("\n") : "- No specific findings were safely extractable from the provided content. Confidence: 0.35."}

### ⚙️ How They Did It (Methodology)
${contentType === "research_paper" ? "The methodology must be taken from the source's Methods/Methodology section. No explicit method was safely isolated by the local fallback." : "Not applicable unless the source is a research paper or technical procedure."}

### 📈 Results & Numbers
${signals.numbers.length ? signals.numbers.map((number) => `- ${number} (found in the provided content; surrounding sentence should be used as the citation).`).join("\n") : "- No explicit result numbers were found in the provided content."}

### ⚠️ Limitations & Gaps
- Uncertainty: local fallback analysis does not fully arbitrate disagreements without a successful master synthesizer.
- Missing context: ${sources.length ? "web evidence exists, but each claim still needs source-by-source review." : "no external web evidence was available for validation."}

### 💡 Why This Matters
The response is grounded in the provided text rather than a reusable boilerplate summary. Treat any uncited claim as low confidence until a provider or web source confirms it.

### ❓ Suggested Follow-up Questions
- Which exact section supports the most important claim?
- Are any numbers, dates, or names contradicted by external sources?
- What decision should be made from this content, and what evidence threshold is required?

### 🔗 Sources Cited
${sourceLines.join("\n")}

Provider note: ${bestProvider ? `${bestProvider.provider} responded in ${bestProvider.responseTimeMs}ms.` : "Claude/GPT-4o/DeepSeek-style validation was skipped because the relevant API keys were missing or providers failed."}
Category: ${category}. Language: ${language}.`;
}

function fallbackSynthesis(message, providerResponses, search, options = {}) {
  const bestProvider = providerResponses.filter((item) => item.status === "fulfilled").sort((a, b) => b.confidence - a.confidence)[0];
  if (bestProvider?.response?.includes("### 🔍")) return bestProvider.response;
  return localStructuredAnalysis({ message, providerResponses, search, ...options });
}

async function synthesizeAnswer({ message, category, contentType, language, providerResponses, search, confidenceScores }) {
  if (contentType === "general_query") {
    const prompt = `Create the final answer from these provider responses and evidence.

User message:
${sentenceSafeText(message, 60000)}
Category: ${category}

Provider responses:
${providerResponses.map((item) => `${item.provider} [${item.status}, confidence ${item.confidence || 0}]: ${item.response || item.error || item.reason}`).join("\n\n")}

Confidence scores:
${JSON.stringify(confidenceScores, null, 2)}

Web evidence:
${evidenceText(search) || "No web evidence collected."}

Rules:
- Answer naturally like a real assistant.
- Do not use a formal document-analysis template.
- If the user only greeted you, give a short friendly greeting and ask how you can help.
- If the user asked a specific question, answer that question directly.
- Use sources only when the answer depends on web evidence.
- Flag uncertainty with a confidence score.`;

    const master = env.providers.anthropic.apiKey ? "anthropic" : env.providers.openai.apiKey ? "openai" : "";
    if (!master) return fallbackSynthesis(message, providerResponses, search, { category, contentType, language, confidenceScores });
    const result = await callProvider(master, prompt, category, evidenceText(search));
    if (result.status === "fulfilled" && result.response) return result.response;
    return fallbackSynthesis(message, providerResponses, search, { category, contentType, language, confidenceScores });
  }

  const prompt = `Synthesize the most accurate, complete answer from these sources.

Full user content / question:
${sentenceSafeText(message, 60000)}
Category: ${category}
Content type: ${contentTypeLabel(contentType)}
Detected language: ${language}

Provider responses:
${providerResponses.map((item) => `${item.provider} [${item.status}, confidence ${item.confidence || 0}]: ${item.response || item.error || item.reason}`).join("\n\n")}

Confidence scores:
${JSON.stringify(confidenceScores, null, 2)}

Web evidence:
${evidenceText(search)}

Rules:
- Use this exact section structure:
  ## [Actual Title of the Content]
  **Type:** Research Paper / News / Technical / etc
  **Source:** [domain or publication]
  **Date:** [if found]
  ---
  ### 🔍 What This Is About
  ### 📊 Key Findings / Main Points
  ### ⚙️ How They Did It (Methodology)
  ### 📈 Results & Numbers
  ### ⚠️ Limitations & Gaps
  ### 💡 Why This Matters
  ### ❓ Suggested Follow-up Questions
  ### 🔗 Sources Cited
- Cite every factual claim with an exact source sentence or source URL when evidence exists.
- If providers disagree, show both interpretations with confidence scores.
- Prefer web evidence over provider memory when they conflict.
- Never invent numbers. Every number must be traceable to provided content or web evidence.
- Never start with conversational filler.
- Never cut off mid-sentence. If the answer must be shorter, summarize remaining sections explicitly.
- Before returning, self-check that the answer is specific, traceable, uncertainty-aware, and useful to an expert.`;

  const master = env.providers.anthropic.apiKey ? "anthropic" : env.providers.openai.apiKey ? "openai" : "";
  if (!master) return fallbackSynthesis(message, providerResponses, search, { category, contentType, language, confidenceScores });
  const result = await callProvider(master, prompt, category, evidenceText(search));
  if (result.status === "fulfilled" && result.response) return result.response;
  return fallbackSynthesis(message, providerResponses, search, { category, contentType, language, confidenceScores });
}

function extractClaims(answer) {
  return String(answer || "")
    .split(/(?<=[.!?])\s+/)
    .map((item) => cleanText(item, 500))
    .filter((item) => item.length > 30)
    .slice(0, 12);
}

function factCheck(answer, search) {
  const evidence = [...(search.chunks || []), ...(search.results || [])];
  return extractClaims(answer).map((claim) => {
    const ranked = evidence
      .map((item) => ({ item, score: similarity(claim, `${item.title || ""} ${item.content || item.snippet || ""}`) }))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    return {
      claim,
      status: best?.score > 0.48 ? "verified" : best?.score > 0.28 ? "unverified" : "uncertain",
      source: best?.item?.url || "",
      score: best?.score || 0
    };
  });
}

export async function runIntelligenceQuery({ userId, message }) {
  const category = classifyQuery(message);
  const contentType = detectContentType(message, category);
  const language = detectLanguage(message);
  const liveProviders = configuredAiProviderNames();
  const steps = [
    { id: "classify", label: `Classified as ${category} / ${contentTypeLabel(contentType)}`, status: "completed" },
    { id: "knowledge", label: "Checking knowledge base", status: "running" }
  ];

  if (category === "conversation" && contentType === "general_query") {
    const user = await findUserById(userId);
    const answer = directConversationAnswer(message, user);
    steps[1].status = "skipped";
    steps.push({ id: "answer", label: "Answered directly", status: "completed" });
    await saveIntelligenceEvent({
      userId,
      query: message,
      category,
      providers: {},
      search: { resultCount: 0, scrapedCount: 0, cached: false, contentType, language },
      confidence: { overall: 0.98, direct: true },
      costUsd: 0
    });
    return {
      answer,
      category,
      contentType,
      sources: [],
      confidence: { overall: 0.98, direct: true },
      providerResponses: [],
      comparison: [],
      factChecks: [],
      steps,
      search: { resultCount: 0, scrapedCount: 0, cached: false },
      costUsd: 0,
      billable: false
    };
  }

  if (!liveProviders.length) {
    steps[1].status = "skipped";
    steps.push({ id: "providers", label: "No live AI providers configured", status: "failed" });
    const answer = "Live AI is not configured yet. Create a `.env` file, add at least one real provider key such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`, or `TOGETHER_API_KEY`, then restart the server. I will not pretend to be a real AI without a live provider.";
    return {
      answer,
      category,
      contentType,
      sources: [],
      confidence: { overall: 0, liveProviders: 0 },
      providerResponses: [],
      comparison: [],
      factChecks: [],
      steps,
      search: { resultCount: 0, scrapedCount: 0, cached: false },
      costUsd: 0,
      billable: false
    };
  }

  const knowledge = await retrieveKnowledge(message, category);
  if (knowledge.hit) {
    steps[1].status = "completed";
    await saveIntelligenceEvent({ userId, query: message, category, providers: [], search: {}, confidence: { cached: true }, costUsd: 0 });
    return {
      answer: `${knowledge.entry.answer}\n\n_From ZYNNOX knowledge base._`,
      category,
      contentType,
      sources: knowledge.entry.sources || [],
      confidence: { cached: true, overall: 0.95 },
      providerResponses: [],
      comparison: [],
      factChecks: [],
      steps,
      cached: true,
      costUsd: 0
    };
  }
  steps[1].status = "completed";
  steps.push({ id: "training", label: "Checking training question bank", status: "running" });
  const trainingQuestions = await retrieveTrainingQuestions(message, category);
  steps.at(-1).status = trainingQuestions.length ? "completed" : "skipped";
  steps.push({ id: "decompose", label: "Decomposing query", status: "completed" });
  const subQueries = decomposeQuery(message, contentType);

  steps.push({ id: "search", label: `Searching ${subQueries.length} sub-queries`, status: "running" });
  const search = await runSearchPipeline(message, subQueries);
  steps.at(-1).status = "completed";

  steps.push({ id: "providers", label: "Querying live AI providers", status: "running" });
  const prompt = buildProviderPrompt({ message, category, contentType, language, search, context: knowledge.context, trainingQuestions });
  const validationProviders = ["anthropic", "openai", "deepseek"];
  const selectedProviders = [...new Set([...validationProviders, ...(QUERY_ROUTES[category] || QUERY_ROUTES.factual)])].filter((provider) => {
    if (provider === "anthropic") return Boolean(env.providers.anthropic.apiKey);
    if (provider === "google") return Boolean(env.providers.google.apiKey);
    return Boolean(OPENAI_COMPATIBLE[provider]?.key());
  });
  const providerResponses = selectedProviders.length
    ? await Promise.all(selectedProviders.map((provider) => callProvider(provider, prompt, category, evidenceText(search))))
    : [];
  steps.at(-1).status = "completed";

  steps.push({ id: "validate", label: "Cross-validating answers", status: "running" });
  const comparison = compareProviders(providerResponses, search);
  const confidenceScores = Object.fromEntries(comparison.map((item) => [item.provider, item.score]));
  steps.at(-1).status = "completed";

  steps.push({ id: "synthesis", label: "Synthesizing final answer", status: "running" });
  const answer = await synthesizeAnswer({ message, category, contentType, language, providerResponses, search, confidenceScores });
  steps.at(-1).status = "completed";

  steps.push({ id: "fact-check", label: "Fact-checking claims", status: "running" });
  const factChecks = factCheck(answer, search);
  steps.at(-1).status = "completed";

  const sources = sourceList(search);
  const overall = factChecks.length ? factChecks.filter((item) => item.status === "verified").length / factChecks.length : Math.max(...Object.values(confidenceScores), 0.35);
  const costUsd = providerResponses.reduce((sum, item) => sum + Number(item.costUsd || 0), 0);
  const providerVotes = Object.fromEntries(providerResponses.map((item) => [item.provider, { status: item.status, confidence: item.confidence, responseTimeMs: item.responseTimeMs }]));

  await Promise.all(providerResponses.map((item) =>
    saveProviderPerformance({
      provider: item.provider,
      category,
      response: item.response,
      score: comparison.find((score) => score.provider === item.provider)?.score || 0,
      wasCorrect: (comparison.find((score) => score.provider === item.provider)?.score || 0) > 0.55,
      responseTimeMs: item.responseTimeMs,
      costUsd: item.costUsd,
      metadata: { status: item.status, error: item.error, reason: item.reason }
    })
  ));
  await saveKnowledgeEntry({ query: message, answer, sources, confidenceScores: { ...confidenceScores, overall }, providerVotes, verified: overall >= 0.5, category });
  await Promise.all(factChecks.filter((item) => item.status === "verified").map((item) => saveLearnedFact({
    fact: item.claim,
    sourceUrls: item.source ? [item.source] : [],
    confidence: "verified",
    expiresAt: category === "news" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null
  })));
  await saveIntelligenceEvent({
    userId,
    query: message,
    category,
    providers: providerVotes,
    search: { resultCount: search.results.length, scrapedCount: search.scraped.length, cached: search.cached, contentType, language },
    confidence: { overall, scores: confidenceScores },
    costUsd
  });

  return {
    answer,
    category,
    contentType,
    sources,
    confidence: { overall, scores: confidenceScores },
    providerResponses,
    comparison,
    factChecks,
    steps,
    search: { resultCount: search.results.length, scrapedCount: search.scraped.length, cached: search.cached },
    costUsd
  };
}

export async function getIntelligenceDashboard() {
  const snapshot = await intelligenceSnapshot();
  const configuredProviders = Object.entries(env.providers).map(([provider, config]) => ({
    provider,
    configured: Boolean(config.apiKey),
    model: config.model,
    circuitOpen: circuitOpen(provider)
  }));
  return {
    ...snapshot,
    configuredProviders,
    searchProviders: {
      brave: Boolean(env.searchKeys.brave),
      google: Boolean(env.searchKeys.google && env.searchKeys.googleCx),
      bing: Boolean(env.searchKeys.bing),
      serper: Boolean(env.searchKeys.serper),
      newsapi: Boolean(env.searchKeys.news),
      arxiv: true,
      wikipedia: true,
      github: true,
      stackoverflow: true,
      reddit: true
    },
    budget: { monthlyUsd: env.intelligenceMonthlyBudgetUsd }
  };
}

export async function demoDelay() {
  if (env.nodeEnv === "test") return;
  await sleep(1);
}
