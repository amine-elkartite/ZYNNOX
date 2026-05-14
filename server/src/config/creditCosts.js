export const CREDIT_COSTS = {
  AI_CHAT: 1,
  WEB_SEARCH_ANSWER: 2,
  AI_SEARCH_QUICK: 3,
  AI_SEARCH_STANDARD: 5,
  AI_SEARCH_DEEP: 8,
  WEBSITE_LANDING: 10,
  WEBSITE_DASHBOARD: 15,
  WEBSITE_FULLSTACK: 30,
  CODE_ANALYSIS: 2,
  SECURITY_SCAN: 3,
  DIRECT_SEARCH: 2
};

export function aiSearchCost(depth = "quick") {
  if (depth === "deep") return CREDIT_COSTS.AI_SEARCH_DEEP;
  if (depth === "standard") return CREDIT_COSTS.AI_SEARCH_STANDARD;
  return CREDIT_COSTS.AI_SEARCH_QUICK;
}

export function websiteCost(type = "landing") {
  if (type === "fullstack") return CREDIT_COSTS.WEBSITE_FULLSTACK;
  if (type === "dashboard" || type === "admin") return CREDIT_COSTS.WEBSITE_DASHBOARD;
  return CREDIT_COSTS.WEBSITE_LANDING;
}

export function estimateChatCost(message = "") {
  const text = String(message).toLowerCase();
  const webRequired =
    /\b(latest|current|today|recent|news|price|pricing|documentation|docs|api|security advisory|vulnerability|search|web|source|sources|citation|product|legal|deployment|library|framework|unknown)\b/.test(
      text
    );
  return webRequired ? CREDIT_COSTS.WEB_SEARCH_ANSWER : CREDIT_COSTS.AI_CHAT;
}
