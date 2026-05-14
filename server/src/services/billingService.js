import { CREDIT_PACKS } from "../config/plans.js";
import { AppError } from "../utils/AppError.js";
import { addCredits, resetMonthlyCredits } from "./creditService.js";
import { createInvoice, findUserById, getPlan, getSubscription, listPlans, savePaymentEvent, upsertSubscription } from "./memoryService.js";
import { createStripeCheckoutSession, createStripePortalSession, creditPackById, isBillingDemo } from "./paymentService.js";

export async function availablePlans() {
  return listPlans();
}

export async function currentSubscription(userId) {
  return getSubscription(userId);
}

export async function checkout({ userId, planId }) {
  const [plan, user] = await Promise.all([getPlan(planId), findUserById(userId)]);
  if (!plan) throw new AppError("Plan not found.", 404, "PLAN_NOT_FOUND");
  if (!plan.stripePriceKey && plan.id !== "free") throw new AppError("This plan requires sales contact.", 400, "PLAN_NOT_SELF_SERVE");
  if (isBillingDemo()) {
    await demoUpgrade({ userId, planId });
    return { mode: "demo", checkoutUrl: "/app/billing?demo=upgraded", plan };
  }
  return createStripeCheckoutSession({ plan, user });
}

export async function portal({ userId }) {
  const user = await findUserById(userId);
  return createStripePortalSession({ user });
}

export async function demoUpgrade({ userId, planId }) {
  const plan = await getPlan(planId);
  if (!plan) throw new AppError("Plan not found.", 404, "PLAN_NOT_FOUND");
  const subscription = await upsertSubscription({
    userId,
    planId: plan.id,
    status: "active",
    provider: "demo",
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false
  });
  const creditResult = plan.monthlyCredits ? await resetMonthlyCredits({ userId, plan }) : null;
  await createInvoice({
    userId,
    provider: "demo",
    amountDue: plan.priceMonthly || 0,
    status: "paid",
    metadata: { planId: plan.id }
  });
  return { subscription, credits: creditResult?.user?.credits ?? null, plan };
}

export async function buyCredits({ userId, packId }) {
  const pack = creditPackById(packId);
  if (!pack) throw new AppError("Credit pack not found.", 404, "CREDIT_PACK_NOT_FOUND");
  const creditResult = await addCredits({
    userId,
    amount: pack.credits,
    reason: `Purchased ${pack.name}`,
    referenceType: "credit_pack",
    referenceId: pack.id
  });
  await createInvoice({
    userId,
    provider: isBillingDemo() ? "demo" : "stripe",
    amountDue: pack.price,
    status: isBillingDemo() ? "paid" : "pending",
    metadata: { packId }
  });
  return { pack, remainingCredits: creditResult.user.credits, creditPacks: CREDIT_PACKS };
}

export async function handlePaymentWebhook({ provider, eventType, payload }) {
  const event = await savePaymentEvent({ provider, eventType, payload, processed: true });
  return { received: true, eventId: event.id };
}
