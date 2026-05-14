import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { cleanText } from "../utils/validation.js";

function parseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    const match = String(content || "").match(/\{[\s\S]*\}/);
    if (!match) throw new AppError("AI provider returned non-JSON content.", 502, "AI_JSON_PARSE_ERROR");
    return JSON.parse(match[0]);
  }
}

function demoJson(messages) {
  const userContent = messages.at(-1)?.content || "";
  const lower = userContent.toLowerCase();
  if (lower.includes("selectedagents") || lower.includes("router")) {
    return {
      taskType: lower.includes("website") ? "website" : lower.includes("search") ? "research" : "chat",
      selectedAgents: lower.includes("code") ? ["coding", "security"] : lower.includes("design") ? ["uiux"] : ["research", "business"],
      requiresWebSearch: /\b(latest|current|search|pricing|docs|news|api|security|product)\b/.test(lower),
      estimatedCredits: /\b(search|latest|current|docs|pricing)\b/.test(lower) ? 2 : 1,
      reason: "Demo router decision generated without an external AI key."
    };
  }
  if (lower.includes("followupquestions") || lower.includes("research-style")) {
    return {
      answer: "Demo AI Search answer: configure SEARCH_MODE=production and an external AI provider for live, source-grounded research.",
      summary: "The demo flow exercised query planning, search result normalization, and citation handling.",
      keyFindings: ["Demo mode is active.", "Production search is available through Serper, Tavily, Brave, or Google-compatible providers."],
      confidence: "demo",
      followUpQuestions: ["Which search provider will you configure?", "Should this research be saved to a workspace?"]
    };
  }
  if (lower.includes("website builder")) {
    return {
      projectStructure: {
        "src/pages": ["Home.jsx", "Pricing.jsx"],
        "src/components": ["Navbar.jsx", "PricingCards.jsx"],
        "src/styles": ["theme.css"]
      },
      files: [],
      instructions: "Install dependencies, place generated files into a React/Vite project, and run the dev server.",
      previewNotes: "Demo generation returns a compact SaaS starter page."
    };
  }
  return {
    summary: "Demo AI response generated because AI_MODE=demo or no production key is configured.",
    recommendations: ["Set AI_MODE=production and AI_API_KEY for external model reasoning."],
    risks: [],
    findings: [],
    opportunities: [],
    nextSteps: ["Configure real provider keys for production."],
    confidence: 0.4,
    answer: "Demo answer: ZYNNOX is running in demo mode. Configure production AI and search keys for live agent reasoning."
  };
}

class AIProviderService {
  isDemo() {
    return env.aiMode !== "production";
  }

  async chat(messages, options = {}) {
    if (this.isDemo()) {
      return cleanText(demoJson(messages).answer || demoJson(messages).summary, options.maxChars || 4000);
    }
    if (!env.aiApiKey) {
      throw new AppError("AI provider is not configured.", 503, "AI_PROVIDER_UNAVAILABLE");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.aiTimeoutMs);
    try {
      const response = await fetch(`${env.aiBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.aiApiKey}`
        },
        body: JSON.stringify({
          model: options.model || env.aiModel,
          messages,
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens || 1400,
          response_format: options.json ? { type: "json_object" } : undefined
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        throw new AppError("AI provider request failed.", response.status, "AI_PROVIDER_ERROR", await response.text());
      }
      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (!content) throw new AppError("AI provider returned an empty response.", 502, "AI_EMPTY_RESPONSE");
      return content.trim();
    } catch (error) {
      if (error.name === "AbortError") throw new AppError("AI provider timed out.", 504, "AI_TIMEOUT");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async json(messages, options = {}) {
    if (this.isDemo()) return demoJson(messages);
    return parseJson(await this.chat(messages, { ...options, json: true }));
  }
}

export const aiProviderService = new AIProviderService();
