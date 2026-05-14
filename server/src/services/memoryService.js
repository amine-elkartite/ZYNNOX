import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PLAN_DEFINITIONS } from "../config/plans.js";
import { env } from "../config/env.js";
import { initializeDatabase } from "../database/db.js";

const DEFAULT_TOOLS = [
  ["web-search", "Web Search", "Searches the live web through Serper, Tavily, Brave, or demo mode."],
  ["ai-search", "AI Search", "Runs multi-query research with source ranking and citations."],
  ["website-builder", "Website Builder", "Generates React/Tailwind-ready website projects."],
  ["code-analysis", "Code Analysis", "Finds code quality, project structure, and secret risks."],
  ["security-scan", "Security Scan", "Reviews auth, CORS, JWT, validation, secrets, and payment surfaces."],
  ["calculator", "Calculator", "Evaluates safe arithmetic expressions."],
  ["url-extractor", "URL Content Extractor", "Fetches readable text from public web URLs."],
  ["project-structure", "Project Structure", "Maps and summarizes the project layout."],
  ["credit", "Credit Tool", "Checks balances, deducts, refunds, and records usage."],
  ["billing", "Billing Tool", "Creates demo or payment-provider billing operations."]
].map(([id, name, description]) => ({ id, name, description, enabled: true, metadata: {} }));

const initialStore = () => ({
  users: [],
  user_profiles: [],
  plans: PLAN_DEFINITIONS,
  subscriptions: [],
  credit_transactions: [],
  usage_logs: [],
  invoices: [],
  payment_events: [],
  conversations: [],
  messages: [],
  agent_runs: [],
  agent_steps: [],
  search_results: [],
  ai_search_sessions: [],
  generated_websites: [],
  website_files: [],
  tools: DEFAULT_TOOLS,
  settings: []
});

let cache;
let writeQueue = Promise.resolve();

const now = () => new Date().toISOString();
const id = () => randomUUID();

async function persist(data) {
  await fs.mkdir(path.dirname(env.memoryFile), { recursive: true });
  const tempFile = `${env.memoryFile}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(data, null, 2));
  await fs.rename(tempFile, env.memoryFile);
}

async function store() {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(env.memoryFile, "utf8");
    cache = { ...initialStore(), ...JSON.parse(raw) };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    cache = initialStore();
    await persist(cache);
  }
  return cache;
}

async function update(mutator) {
  const data = await store();
  const result = await mutator(data);
  writeQueue = writeQueue.then(() => persist(data));
  await writeQueue;
  return result;
}

function safeUser(user) {
  if (!user) return null;
  const safe = { ...user };
  delete safe.passwordHash;
  delete safe.password_hash;
  return safe;
}

export async function initializeMemoryService() {
  await initializeDatabase();
  await update((data) => {
    data.plans = PLAN_DEFINITIONS;
    for (const tool of DEFAULT_TOOLS) {
      if (!data.tools.some((item) => item.id === tool.id)) data.tools.push(tool);
    }
  });
}

export async function createUser({ name, email, passwordHash, role = "user" }) {
  return update((data) => {
    const normalizedEmail = email.toLowerCase();
    if (data.users.some((user) => user.email === normalizedEmail)) {
      const error = new Error("Email is already registered.");
      error.code = "DUPLICATE_EMAIL";
      throw error;
    }
    const firstUser = data.users.length === 0;
    const resolvedRole = firstUser || env.adminEmail === normalizedEmail ? "admin" : role;
    const user = {
      id: id(),
      name,
      email: normalizedEmail,
      passwordHash,
      role: resolvedRole,
      credits: 0,
      planId: "free",
      subscriptionStatus: "inactive",
      emailVerified: false,
      createdAt: now(),
      updatedAt: now()
    };
    data.users.push(user);
    data.user_profiles.push({
      id: id(),
      userId: user.id,
      company: "",
      avatarUrl: "",
      timezone: "UTC",
      metadata: {},
      createdAt: now(),
      updatedAt: now()
    });
    data.subscriptions.push({
      id: id(),
      userId: user.id,
      planId: "free",
      status: "active",
      provider: "demo",
      currentPeriodStart: now(),
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      createdAt: now(),
      updatedAt: now()
    });
    return user;
  });
}

export async function findUserByEmail(email) {
  const data = await store();
  return data.users.find((user) => user.email === email.toLowerCase()) || null;
}

export async function findUserById(userId) {
  const data = await store();
  return safeUser(data.users.find((user) => user.id === userId));
}

export async function findUserPrivateById(userId) {
  const data = await store();
  return data.users.find((user) => user.id === userId) || null;
}

export async function updateUserProfile(userId, patch) {
  return update((data) => {
    const user = data.users.find((item) => item.id === userId);
    if (!user) return null;
    if (patch.name) user.name = patch.name;
    user.updatedAt = now();
    let profile = data.user_profiles.find((item) => item.userId === userId);
    if (!profile) {
      profile = { id: id(), userId, company: "", avatarUrl: "", timezone: "UTC", metadata: {}, createdAt: now() };
      data.user_profiles.push(profile);
    }
    profile.company = patch.company ?? profile.company;
    profile.timezone = patch.timezone ?? profile.timezone;
    profile.updatedAt = now();
    return { user: safeUser(user), profile };
  });
}

export async function updateUserCredits(userId, nextCredits) {
  return update((data) => {
    const user = data.users.find((item) => item.id === userId);
    if (!user) return null;
    user.credits = Math.max(0, Number(nextCredits));
    user.updatedAt = now();
    return safeUser(user);
  });
}

export async function setUserRole(userId, role) {
  return update((data) => {
    const user = data.users.find((item) => item.id === userId);
    if (!user) return null;
    user.role = role;
    user.updatedAt = now();
    return safeUser(user);
  });
}

export async function mutateCredits({ userId, amount, type, reason, referenceType, referenceId }) {
  return update((data) => {
    const user = data.users.find((item) => item.id === userId);
    if (!user) {
      const error = new Error("User not found.");
      error.statusCode = 404;
      throw error;
    }
    const before = Number(user.credits || 0);
    const after = before + Number(amount);
    if (after < 0) {
      const error = new Error("Insufficient credits. Please upgrade your plan or buy more credits.");
      error.statusCode = 402;
      error.code = "INSUFFICIENT_CREDITS";
      error.details = { balance: before, required: Math.abs(Number(amount)) };
      throw error;
    }
    user.credits = after;
    user.updatedAt = now();
    const transaction = {
      id: id(),
      userId,
      type,
      amount: Number(amount),
      balanceBefore: before,
      balanceAfter: after,
      reason,
      referenceType,
      referenceId,
      createdAt: now()
    };
    data.credit_transactions.unshift(transaction);
    return { user: safeUser(user), transaction };
  });
}

export async function listCreditTransactions(userId, limit = 50) {
  const data = await store();
  return data.credit_transactions.filter((item) => item.userId === userId).slice(0, limit);
}

export async function logUsage({ userId, actionType, creditsUsed = 0, status, metadata = {} }) {
  return update((data) => {
    const row = { id: id(), userId, actionType, creditsUsed, status, metadata, createdAt: now() };
    data.usage_logs.unshift(row);
    return row;
  });
}

export async function listUsageLogs(userId, limit = 50) {
  const data = await store();
  return data.usage_logs.filter((item) => item.userId === userId).slice(0, limit);
}

export async function createConversation({ userId, title }) {
  return update((data) => {
    const row = { id: id(), userId, title, createdAt: now(), updatedAt: now() };
    data.conversations.unshift(row);
    return row;
  });
}

export async function getConversation({ userId, conversationId }) {
  if (!conversationId) return null;
  const data = await store();
  return data.conversations.find((item) => item.id === conversationId && item.userId === userId) || null;
}

export async function listConversations({ userId, limit = 30 }) {
  const data = await store();
  return data.conversations
    .filter((item) => item.userId === userId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, limit)
    .map((conversation) => ({
      ...conversation,
      messages: data.messages.filter((message) => message.conversationId === conversation.id)
    }));
}

export async function getConversationWithMessages({ userId, conversationId }) {
  const conversation = await getConversation({ userId, conversationId });
  if (!conversation) return null;
  const data = await store();
  return {
    ...conversation,
    messages: data.messages.filter((message) => message.conversationId === conversation.id)
  };
}

export async function addMessage({ conversationId, userId, role, content, metadata = {} }) {
  return update((data) => {
    const row = { id: id(), conversationId, userId, role, content, metadata, createdAt: now() };
    data.messages.push(row);
    const conversation = data.conversations.find((item) => item.id === conversationId);
    if (conversation) conversation.updatedAt = now();
    return row;
  });
}

export async function listMessages({ userId, conversationId, limit = 30 }) {
  const data = await store();
  return data.messages
    .filter((item) => item.userId === userId && item.conversationId === conversationId)
    .slice(-limit);
}

export async function createAgentRun({ userId, conversationId = null, input }) {
  return update((data) => {
    const row = {
      id: id(),
      userId,
      conversationId,
      status: "running",
      input,
      output: "",
      usedAgents: [],
      sources: [],
      creditsUsed: 0,
      createdAt: now(),
      completedAt: null
    };
    data.agent_runs.unshift(row);
    return row;
  });
}

export async function finishAgentRun({ runId, status, output, usedAgents = [], sources = [], creditsUsed = 0 }) {
  return update((data) => {
    const run = data.agent_runs.find((item) => item.id === runId);
    if (!run) return null;
    run.status = status;
    run.output = output;
    run.usedAgents = usedAgents;
    run.sources = sources;
    run.creditsUsed = creditsUsed;
    run.completedAt = now();
    return run;
  });
}

export async function addAgentStep({ runId, agentId, status, input = {}, output = {}, error = null }) {
  return update((data) => {
    const row = {
      id: id(),
      runId,
      agentId,
      status,
      input,
      output,
      error,
      createdAt: now(),
      completedAt: status === "running" ? null : now()
    };
    data.agent_steps.push(row);
    return row;
  });
}

export async function listAgentRuns({ userId, limit = 50 }) {
  const data = await store();
  return data.agent_runs
    .filter((item) => item.userId === userId)
    .slice(0, limit)
    .map((run) => ({ ...run, steps: data.agent_steps.filter((step) => step.runId === run.id) }));
}

export async function saveSearchResults({ userId, runId = null, query, provider, results }) {
  return update((data) => {
    const row = { id: id(), userId, runId, query, provider, results, createdAt: now() };
    data.search_results.unshift(row);
    return row;
  });
}

export async function listSearchHistory(userId, limit = 50) {
  const data = await store();
  return data.search_results.filter((item) => item.userId === userId).slice(0, limit);
}

export async function saveAiSearchSession({ userId, query, depth, answer, summary, sources, searchQueries, confidence, creditsUsed }) {
  return update((data) => {
    const row = {
      id: id(),
      userId,
      query,
      depth,
      answer,
      summary,
      sources,
      searchQueries,
      confidence,
      creditsUsed,
      createdAt: now()
    };
    data.ai_search_sessions.unshift(row);
    return row;
  });
}

export async function saveGeneratedWebsite({ userId, prompt, type, style, projectStructure, files, instructions, previewNotes, creditsUsed }) {
  return update((data) => {
    const website = {
      id: id(),
      userId,
      prompt,
      type,
      style,
      projectStructure,
      instructions,
      previewNotes,
      creditsUsed,
      createdAt: now()
    };
    data.generated_websites.unshift(website);
    const savedFiles = files.map((file) => ({
      id: id(),
      websiteId: website.id,
      path: file.path,
      content: file.content,
      language: file.language || "",
      createdAt: now()
    }));
    data.website_files.unshift(...savedFiles);
    return { ...website, files: savedFiles };
  });
}

export async function listGeneratedWebsites(userId, limit = 30) {
  const data = await store();
  return data.generated_websites
    .filter((item) => item.userId === userId)
    .slice(0, limit)
    .map((website) => ({ ...website, files: data.website_files.filter((file) => file.websiteId === website.id) }));
}

export async function listPlans() {
  const data = await store();
  return data.plans;
}

export async function getPlan(planId) {
  const data = await store();
  return data.plans.find((plan) => plan.id === planId) || null;
}

export async function getSubscription(userId) {
  const data = await store();
  return data.subscriptions.find((item) => item.userId === userId) || null;
}

export async function upsertSubscription(subscription) {
  return update((data) => {
    const existing = data.subscriptions.find((item) => item.userId === subscription.userId);
    if (existing) {
      Object.assign(existing, subscription, { updatedAt: now() });
      return existing;
    }
    const row = { id: id(), createdAt: now(), updatedAt: now(), ...subscription };
    data.subscriptions.unshift(row);
    return row;
  });
}

export async function createInvoice(invoice) {
  return update((data) => {
    const row = { id: id(), createdAt: now(), ...invoice };
    data.invoices.unshift(row);
    return row;
  });
}

export async function savePaymentEvent(event) {
  return update((data) => {
    const row = { id: id(), provider: event.provider, eventType: event.eventType, payload: event.payload, processed: event.processed, createdAt: now() };
    data.payment_events.unshift(row);
    return row;
  });
}

export async function listTools() {
  const data = await store();
  return data.tools;
}

export async function dashboardStats(userId) {
  const data = await store();
  const user = data.users.find((item) => item.id === userId);
  return {
    credits: user?.credits || 0,
    planId: user?.planId || "free",
    conversations: data.conversations.filter((item) => item.userId === userId).length,
    agentRuns: data.agent_runs.filter((item) => item.userId === userId).length,
    searches: data.search_results.filter((item) => item.userId === userId).length,
    generatedWebsites: data.generated_websites.filter((item) => item.userId === userId).length
  };
}

export async function adminSnapshot() {
  const data = await store();
  return {
    users: data.users.map(safeUser),
    usage: data.usage_logs,
    subscriptions: data.subscriptions,
    agentRuns: data.agent_runs,
    generatedWebsites: data.generated_websites,
    plans: data.plans,
    invoices: data.invoices
  };
}
