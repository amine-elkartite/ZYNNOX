import { z } from "zod";
import { getBalance, addCredits, creditHistory } from "../services/creditService.js";
import { listUsageLogs, updateUserCredits } from "../services/memoryService.js";

export const adminCreditSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().int().positive(),
  reason: z.string().min(2).max(300).optional()
});

export async function balance(request, response) {
  response.json({ ok: true, ...(await getBalance(request.user.id)) });
}

export async function transactions(request, response) {
  const [creditTransactions, usage] = await Promise.all([
    creditHistory(request.user.id),
    listUsageLogs(request.user.id)
  ]);
  response.json({ ok: true, transactions: creditTransactions, usage });
}

export async function buyCreditsNotice(_request, response) {
  response.json({ ok: true, message: "Use POST /api/billing/buy-credits with a credit pack id." });
}

export async function adminAddCredits(request, response) {
  const result = await addCredits({
    userId: request.body.userId,
    amount: request.body.amount,
    reason: request.body.reason || "Admin credit adjustment",
    referenceType: "admin",
    referenceId: request.user.id
  });
  response.json({ ok: true, result });
}

export async function adminRemoveCredits(request, response) {
  const balanceBefore = await updateUserCredits(request.body.userId, 0);
  const result = await addCredits({
    userId: request.body.userId,
    amount: Math.max(0, Number(balanceBefore?.credits || 0) - request.body.amount),
    reason: request.body.reason || "Admin credit reset adjustment",
    referenceType: "admin",
    referenceId: request.user.id
  });
  response.json({ ok: true, result });
}
