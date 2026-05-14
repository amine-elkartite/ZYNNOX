import { z } from "zod";
import { adminSnapshot, setUserRole, updateUserCredits } from "../services/memoryService.js";

export const roleSchema = z.object({ role: z.enum(["user", "admin"]) });
export const creditsSchema = z.object({ credits: z.number().int().min(0) });

export async function users(_request, response) {
  response.json({ ok: true, users: (await adminSnapshot()).users });
}

export async function usage(_request, response) {
  response.json({ ok: true, usage: (await adminSnapshot()).usage });
}

export async function subscriptions(_request, response) {
  response.json({ ok: true, subscriptions: (await adminSnapshot()).subscriptions });
}

export async function agentRuns(_request, response) {
  response.json({ ok: true, agentRuns: (await adminSnapshot()).agentRuns });
}

export async function generatedWebsites(_request, response) {
  response.json({ ok: true, generatedWebsites: (await adminSnapshot()).generatedWebsites });
}

export async function plans(_request, response) {
  response.json({ ok: true, plans: (await adminSnapshot()).plans });
}

export async function invoices(_request, response) {
  response.json({ ok: true, invoices: (await adminSnapshot()).invoices });
}

export async function updateRole(request, response) {
  response.json({ ok: true, user: await setUserRole(request.params.id, request.body.role) });
}

export async function updateCredits(request, response) {
  response.json({ ok: true, user: await updateUserCredits(request.params.id, request.body.credits) });
}
