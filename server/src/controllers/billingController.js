import { z } from "zod";
import { CREDIT_PACKS } from "../config/plans.js";
import { availablePlans, buyCredits, checkout, currentSubscription, demoUpgrade, handlePaymentWebhook, portal } from "../services/billingService.js";
import { verifyStripeSignature } from "../services/paymentService.js";

export const checkoutSchema = z.object({ planId: z.string().min(2).max(50) });
export const buyCreditsSchema = z.object({ packId: z.string().min(2).max(80) });

export async function plans(_request, response) {
  response.json({ ok: true, plans: await availablePlans(), creditPacks: CREDIT_PACKS });
}

export async function subscription(request, response) {
  response.json({ ok: true, subscription: await currentSubscription(request.user.id) });
}

export async function createCheckout(request, response) {
  response.json({ ok: true, ...(await checkout({ userId: request.user.id, planId: request.body.planId })) });
}

export async function customerPortal(request, response) {
  response.json({ ok: true, ...(await portal({ userId: request.user.id })) });
}

export async function webhook(request, response) {
  const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.from(JSON.stringify(request.body || {}));
  verifyStripeSignature(rawBody, request.headers["stripe-signature"]);
  const payload = JSON.parse(rawBody.toString("utf8") || "{}");
  const result = await handlePaymentWebhook({
    provider: "stripe",
    eventType: payload?.type || "demo.event",
    payload
  });
  response.json({ ok: true, ...result });
}

export async function buyCreditPack(request, response) {
  response.json({ ok: true, ...(await buyCredits({ userId: request.user.id, packId: request.body.packId })) });
}

export async function demoPlanUpgrade(request, response) {
  response.json({ ok: true, ...(await demoUpgrade({ userId: request.user.id, planId: request.body.planId })) });
}
