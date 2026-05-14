import { CREDIT_COSTS, aiSearchCost, estimateChatCost, websiteCost } from "../config/creditCosts.js";
import { AppError } from "../utils/AppError.js";
import { findUserById, listCreditTransactions, logUsage, mutateCredits } from "./memoryService.js";

export { CREDIT_COSTS, aiSearchCost, estimateChatCost, websiteCost };

export async function getBalance(userId) {
  const user = await findUserById(userId);
  if (!user) throw new AppError("User not found.", 404, "USER_NOT_FOUND");
  return {
    balance: Number(user.credits || 0),
    planId: user.planId,
    subscriptionStatus: user.subscriptionStatus
  };
}

export async function assertCredits(userId, requiredCredits) {
  const balance = await getBalance(userId);
  if (balance.balance < requiredCredits) {
    throw new AppError(
      "Insufficient credits. Please upgrade your plan or buy more credits.",
      402,
      "INSUFFICIENT_CREDITS",
      {
        requiredCredits,
        remainingCredits: balance.balance,
        upgradeOptions: ["starter", "pro", "business"],
        creditPacks: ["credits-100", "credits-500", "credits-1500"]
      }
    );
  }
  return balance;
}

export async function addCredits({ userId, amount, reason, referenceType = "system", referenceId = null }) {
  return mutateCredits({
    userId,
    amount,
    type: "credit",
    reason,
    referenceType,
    referenceId
  });
}

export async function deductCredits({ userId, amount, reason, referenceType, referenceId, actionType, metadata = {} }) {
  await assertCredits(userId, amount);
  const result = await mutateCredits({
    userId,
    amount: -Math.abs(amount),
    type: "debit",
    reason,
    referenceType,
    referenceId
  });
  await logUsage({
    userId,
    actionType,
    creditsUsed: amount,
    status: "succeeded",
    metadata: { ...metadata, referenceType, referenceId }
  });
  return result;
}

export async function refundCredits({ userId, amount, reason, referenceType, referenceId, actionType, metadata = {} }) {
  const result = await addCredits({ userId, amount: Math.abs(amount), reason, referenceType, referenceId });
  await logUsage({
    userId,
    actionType,
    creditsUsed: -Math.abs(amount),
    status: "refunded",
    metadata
  });
  return result;
}

export async function chargeForAction({ userId, credits, actionType, referenceType, referenceId, metadata }) {
  return deductCredits({
    userId,
    amount: credits,
    reason: actionType,
    referenceType,
    referenceId,
    actionType,
    metadata
  });
}

export async function creditHistory(userId, limit = 50) {
  return listCreditTransactions(userId, limit);
}

export async function resetMonthlyCredits({ userId, plan }) {
  return addCredits({
    userId,
    amount: Number(plan.monthlyCredits || 0),
    reason: `${plan.name} monthly credit reset`,
    referenceType: "subscription",
    referenceId: plan.id
  });
}
