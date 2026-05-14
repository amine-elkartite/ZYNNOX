import { CREDIT_PACKS } from "../config/plans.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { addCredits, grantMonthlyCredits } from "./creditService.js";
import { createInvoice, findUserById, getPlan, getSubscription, listPlans, savePaymentEvent, upsertSubscription } from "./memoryService.js";
import { createStripeCheckoutSession, createStripePortalSession, creditPackById, isBillingDemo } from "./paymentService.js";

const SUBSCRIPTION_SUCCESS_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.resumed",
  "invoice.payment_succeeded"
]);

const SUBSCRIPTION_FAILURE_EVENTS = new Set([
  "checkout.session.expired",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "invoice.payment_failed"
]);

const fromStripeTimestamp = (value) => (value ? new Date(value * 1000).toISOString() : null);

function eventObject(payload) {
  return payload?.data?.object || {};
}

function eventMetadata(object) {
  return {
    ...(object?.metadata || {}),
    ...(object?.subscription_details?.metadata || {})
  };
}

function eventUserId(object) {
  const metadata = eventMetadata(object);
  return object.client_reference_id || metadata.userId || metadata.user_id || null;
}

function eventStripePriceId(object) {
  return (
    object?.items?.data?.[0]?.price?.id ||
    object?.lines?.data?.[0]?.price?.id ||
    object?.line_items?.data?.[0]?.price?.id ||
    null
  );
}

async function eventPlan(object) {
  const metadata = eventMetadata(object);
  if (metadata.planId || metadata.plan_id) return getPlan(metadata.planId || metadata.plan_id);
  const stripePriceId = eventStripePriceId(object);
  if (!stripePriceId) return null;
  const plans = await listPlans();
  return plans.find((plan) => env.stripePrices[plan.stripePriceKey] === stripePriceId) || null;
}

function stripeSubscriptionId(object) {
  return typeof object.subscription === "string" ? object.subscription : object.id || null;
}

function stripeStatus(eventType, object) {
  if (eventType === "checkout.session.completed") return object.payment_status === "unpaid" ? "incomplete" : "active";
  if (eventType === "customer.subscription.deleted") return "canceled";
  if (eventType === "customer.subscription.paused") return "paused";
  if (eventType === "invoice.payment_failed") return "past_due";
  return object.status || "active";
}

async function syncWebhookSubscription({ eventType, payload, grantCredits }) {
  const object = eventObject(payload);
  const userId = eventUserId(object);
  if (!userId) return { processed: false, action: "stored", reason: "missing_user_reference" };

  const [plan, current] = await Promise.all([eventPlan(object), getSubscription(userId)]);
  const planId = plan?.id || current?.planId || "free";
  const status = stripeStatus(eventType, object);
  const subscription = await upsertSubscription({
    userId,
    planId,
    status,
    provider: "stripe",
    providerSubscriptionId: stripeSubscriptionId(object),
    providerCustomerId: object.customer || current?.providerCustomerId || null,
    currentPeriodStart: fromStripeTimestamp(object.current_period_start) || current?.currentPeriodStart || new Date().toISOString(),
    currentPeriodEnd: fromStripeTimestamp(object.current_period_end) || current?.currentPeriodEnd || null,
    cancelAtPeriodEnd: Boolean(object.cancel_at_period_end)
  });
  const active = ["active", "trialing"].includes(status);
  const creditResult = grantCredits && active && plan ? await grantMonthlyCredits({ userId, plan }) : null;
  return {
    processed: true,
    action: grantCredits ? "subscription_synced" : "subscription_status_updated",
    subscription,
    credits: creditResult?.user?.credits ?? null
  };
}

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
  const creditResult = await grantMonthlyCredits({ userId, plan });
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
  let effect = { processed: false, action: "stored" };
  if (SUBSCRIPTION_SUCCESS_EVENTS.has(eventType)) {
    effect = await syncWebhookSubscription({ eventType, payload, grantCredits: true });
  } else if (SUBSCRIPTION_FAILURE_EVENTS.has(eventType)) {
    effect = await syncWebhookSubscription({ eventType, payload, grantCredits: false });
  }
  const event = await savePaymentEvent({ provider, eventType, payload: { ...payload, zynnoxEffect: effect }, processed: effect.processed });
  return { received: true, eventId: event.id, effect };
}
