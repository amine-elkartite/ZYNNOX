import { businessAgent } from "../agents/businessAgent.js";
import { codingAgent } from "../agents/codingAgent.js";
import { finalAnswerAgent } from "../agents/finalAnswerAgent.js";
import { researchAgent } from "../agents/researchAgent.js";
import { routerAgent } from "../agents/routerAgent.js";
import { securityAgent } from "../agents/securityAgent.js";
import { uiuxAgent } from "../agents/uiuxAgent.js";
import { estimateChatCost } from "../config/creditCosts.js";
import { aiProviderService } from "./aiProviderService.js";
import { assertCredits, chargeForAction, getBalance } from "./creditService.js";
import { runIntelligenceQuery } from "./intelligenceService.js";
import {
  addAgentStep,
  addMessage,
  createAgentRun,
  createConversation,
  finishAgentRun,
  getConversation,
  listMessages
} from "./memoryService.js";
import { billingTool } from "../tools/billingTool.js";
import { calculatorTool } from "../tools/calculatorTool.js";
import { codeAnalysisTool } from "../tools/codeAnalysisTool.js";
import { creditTool } from "../tools/creditTool.js";
import { extractUrlContentTool } from "../tools/extractUrlContentTool.js";
import { projectStructureTool } from "../tools/projectStructureTool.js";
import { securityScanTool } from "../tools/securityScanTool.js";
import { webSearchTool } from "../tools/webSearchTool.js";
import { cleanText } from "../utils/validation.js";

const AGENTS = {
  research: researchAgent,
  coding: codingAgent,
  security: securityAgent,
  uiux: uiuxAgent,
  business: businessAgent
};

const tools = {
  billing: billingTool,
  calculator: calculatorTool,
  codeAnalysis: codeAnalysisTool,
  credit: creditTool,
  extractUrlContent: extractUrlContentTool,
  projectStructure: projectStructureTool,
  securityScan: securityScanTool,
  webSearch: webSearchTool
};

function title(message) {
  return cleanText(message, 70) || "New ZYNNOX conversation";
}

function uniqueSources(results) {
  const seen = new Set();
  return results
    .flatMap((result) => result.sources || result.citations || [])
    .filter((source) => {
      const key = source.url || source.link || source.title;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

async function step(runId, agent, input, runner) {
  await addAgentStep({ runId, agentId: agent.id, status: "running", input });
  try {
    const output = await runner();
    await addAgentStep({ runId, agentId: agent.id, status: "completed", input, output });
    return output;
  } catch (error) {
    await addAgentStep({ runId, agentId: agent.id, status: "failed", input, error: error.message });
    throw error;
  }
}

export async function runAgentConversation({ userId, message, conversationId }) {
  const cleanMessage = cleanText(message, 80000);
  const estimatedCredits = estimateChatCost(cleanMessage);
  await assertCredits(userId, estimatedCredits);

  const conversation =
    (await getConversation({ userId, conversationId })) ||
    (await createConversation({ userId, title: title(cleanMessage) }));
  await addMessage({ conversationId: conversation.id, userId, role: "user", content: cleanMessage });

  const history = await listMessages({ userId, conversationId: conversation.id });
  const run = await createAgentRun({ userId, conversationId: conversation.id, input: cleanMessage });

  if (process.env.INTELLIGENCE_MODE !== "legacy") {
    const intelligence = await runIntelligenceQuery({ userId, message: cleanMessage });
    const creditsUsed = intelligence.billable === false ? 0 : estimatedCredits;
    const charge = creditsUsed
      ? await chargeForAction({
          userId,
          credits: creditsUsed,
          actionType: "ai_intelligence_answer",
          referenceType: "agent_run",
          referenceId: run.id,
          metadata: {
            category: intelligence.category,
            providers: intelligence.providerResponses?.map((item) => item.provider) || [],
            costUsd: intelligence.costUsd || 0
          }
        })
      : null;
    const remainingCredits = charge?.user?.credits ?? (await getBalance(userId)).balance;
    const usedAgents = ["intelligence-router", "web-search", "multi-provider", "cross-validator", "synthesizer", "fact-checker"];
    await addMessage({
      conversationId: conversation.id,
      userId,
      role: "assistant",
      content: intelligence.answer,
      metadata: { runId: run.id, usedAgents, sources: intelligence.sources, creditsUsed, remainingCredits, intelligence }
    });
    await finishAgentRun({ runId: run.id, status: "completed", output: intelligence.answer, usedAgents, sources: intelligence.sources, creditsUsed });
    return {
      answer: intelligence.answer,
      actionItems: [],
      usedAgents,
      sources: intelligence.sources,
      conversationId: conversation.id,
      runId: run.id,
      intelligence,
      providerResponses: intelligence.providerResponses,
      comparison: intelligence.comparison,
      factChecks: intelligence.factChecks,
      steps: intelligence.steps,
      creditsUsed,
      remainingCredits,
      balance: await getBalance(userId)
    };
  }

  const context = { userId, runId: run.id, message: cleanMessage, history, ai: aiProviderService, tools };

  const routerResult = await step(run.id, routerAgent, { message: cleanMessage }, () => routerAgent.run(context));
  const selectedAgents = [...new Set(routerResult.selectedAgents || ["business"])].filter((agent) => AGENTS[agent]);
  if (routerResult.requiresWebSearch && !selectedAgents.includes("research")) selectedAgents.unshift("research");

  const agentResults = [];
  for (const agentId of selectedAgents) {
    const agent = AGENTS[agentId];
    agentResults.push(
      await step(run.id, agent, { message: cleanMessage }, () =>
        agent.run({ ...context, routerDecision: routerResult, previousAgentResults: agentResults })
      )
    );
  }

  const sources = uniqueSources(agentResults);
  const charge = await chargeForAction({
    userId,
    credits: estimatedCredits,
    actionType: routerResult.requiresWebSearch ? "web_search_answer" : "ai_chat",
    referenceType: "agent_run",
    referenceId: run.id,
    metadata: { selectedAgents, requiresWebSearch: routerResult.requiresWebSearch }
  });
  const remainingCredits = charge.user.credits;

  const final = await step(run.id, finalAnswerAgent, { message: cleanMessage }, () =>
    finalAnswerAgent.run({
      ...context,
      routerResult,
      agentResults,
      sources,
      creditsUsed: estimatedCredits,
      remainingCredits
    })
  );

  const usedAgents = ["router", ...selectedAgents, "final"];
  await addMessage({
    conversationId: conversation.id,
    userId,
    role: "assistant",
    content: final.answer,
    metadata: { runId: run.id, usedAgents, sources, creditsUsed: estimatedCredits, remainingCredits }
  });
  await finishAgentRun({ runId: run.id, status: "completed", output: final.answer, usedAgents, sources, creditsUsed: estimatedCredits });

  return {
    answer: final.answer,
    actionItems: final.actionItems,
    usedAgents,
    sources,
    conversationId: conversation.id,
    runId: run.id,
    router: routerResult,
    agentResults,
    creditsUsed: estimatedCredits,
    remainingCredits,
    balance: await getBalance(userId)
  };
}
