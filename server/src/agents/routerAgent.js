import { estimateChatCost } from "../config/creditCosts.js";
import { cleanText } from "../utils/validation.js";

const SYSTEM_PROMPT = `You are the ZYNNOX Router Agent.
Return JSON only:
{
  "taskType": "",
  "selectedAgents": [],
  "requiresWebSearch": true,
  "estimatedCredits": 0,
  "reason": ""
}
Use web search for latest/current/recent/pricing/docs/legal/security/product/API/deployment/library information or when uncertain.`;

function heuristic(message) {
  const text = message.toLowerCase();
  const selectedAgents = new Set();
  if (/\b(search|research|latest|current|today|pricing|docs|api|news|source|citation|unknown)\b/.test(text)) selectedAgents.add("research");
  if (/\b(code|debug|bug|refactor|api|backend|frontend|react|database|project|website|generate)\b/.test(text)) selectedAgents.add("coding");
  if (/\b(security|jwt|cors|secret|password|vulnerability|payment|stripe|compliance)\b/.test(text)) selectedAgents.add("security");
  if (/\b(ui|ux|design|layout|responsive|dashboard|brand|color|accessibility)\b/.test(text)) selectedAgents.add("uiux");
  if (/\b(strategy|business|pricing|roadmap|subscription|credits|plan|monetization)\b/.test(text)) selectedAgents.add("business");
  if (!selectedAgents.size) selectedAgents.add("business");
  const requiresWebSearch = estimateChatCost(message) > 1;
  if (requiresWebSearch) selectedAgents.add("research");
  return {
    taskType: text.includes("website") ? "website" : requiresWebSearch ? "research" : "chat",
    selectedAgents: [...selectedAgents],
    requiresWebSearch,
    estimatedCredits: estimateChatCost(message),
    reason: "Heuristic routing selected agents from request keywords."
  };
}

export const routerAgent = {
  id: "router",
  name: "Router Agent",
  systemPrompt: SYSTEM_PROMPT,
  async run({ message, history, ai }) {
    const fallback = heuristic(cleanText(message, 4000));
    try {
      const result = await ai.json(
        [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              message: cleanText(message, 4000),
              recentHistory: history.slice(-8).map((item) => ({ role: item.role, content: item.content }))
            })
          }
        ],
        { maxTokens: 500 }
      );
      return {
        ...fallback,
        ...result,
        selectedAgents: Array.isArray(result.selectedAgents) && result.selectedAgents.length ? result.selectedAgents : fallback.selectedAgents,
        estimatedCredits: Number(result.estimatedCredits || fallback.estimatedCredits)
      };
    } catch (error) {
      return { ...fallback, reason: `${fallback.reason} Router fallback used: ${error.code || error.message}` };
    }
  }
};
