import { z } from "zod";
import { dashboardStats, getConversationWithMessages, listAgentRuns, listConversations, listTools } from "../services/memoryService.js";
import { runAgentConversation } from "../services/agentOrchestrator.js";
import { getIntelligenceDashboard } from "../services/intelligenceService.js";

export const chatSchema = z.object({
  message: z.string().min(1).max(80000),
  conversationId: z.string().uuid().optional().nullable()
});

export async function chat(request, response) {
  response.json({ ok: true, ...(await runAgentConversation({ userId: request.user.id, message: request.body.message, conversationId: request.body.conversationId })) });
}

export async function runs(request, response) {
  response.json({ ok: true, runs: await listAgentRuns({ userId: request.user.id }) });
}

export async function conversations(request, response) {
  response.json({ ok: true, conversations: await listConversations({ userId: request.user.id }) });
}

export async function conversationById(request, response) {
  response.json({ ok: true, conversation: await getConversationWithMessages({ userId: request.user.id, conversationId: request.params.id }) });
}

export async function tools(request, response) {
  response.json({ ok: true, tools: await listTools() });
}

export async function dashboard(request, response) {
  response.json({ ok: true, stats: await dashboardStats(request.user.id) });
}

export async function intelligenceDashboard(_request, response) {
  response.json({ ok: true, intelligence: await getIntelligenceDashboard() });
}
