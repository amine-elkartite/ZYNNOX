import crypto from "node:crypto";
import { env } from "../config/env.js";
import { CREDIT_PACKS } from "../config/plans.js";
import { AppError } from "../utils/AppError.js";

export function isBillingDemo() {
  return env.billingMode !== "production";
}

export function verifyStripeSignature(rawBody, signature) {
  if (isBillingDemo()) return true;
  if (!env.stripeWebhookSecret) throw new AppError("Stripe webhook secret is missing.", 500, "WEBHOOK_SECRET_MISSING");
  const header = String(signature || "");
  const entries = header.split(",").reduce((items, part) => {
    const [key, value] = part.split("=");
    if (!key || !value) return items;
    items[key] = [...(items[key] || []), value];
    return items;
  }, {});
  const timestamp = Number(entries.t?.[0]);
  const expectedSignatures = entries.v1 || [];
  if (!Number.isFinite(timestamp) || expectedSignatures.length === 0) {
    throw new AppError("Invalid Stripe signature header.", 400, "WEBHOOK_SIGNATURE_INVALID");
  }
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (ageSeconds > 300) {
    throw new AppError("Stripe webhook signature timestamp is outside tolerance.", 400, "WEBHOOK_SIGNATURE_EXPIRED");
  }
  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ""), "utf8");
  const signedPayload = Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), bodyBuffer]);
  const digest = crypto.createHmac("sha256", env.stripeWebhookSecret).update(signedPayload).digest("hex");
  const digestBuffer = Buffer.from(digest, "hex");
  const verified = expectedSignatures.some((expected) => {
    const expectedBuffer = Buffer.from(expected, "hex");
    return expectedBuffer.length === digestBuffer.length && crypto.timingSafeEqual(expectedBuffer, digestBuffer);
  });
  if (!verified) {
    throw new AppError("Stripe webhook signature verification failed.", 400, "WEBHOOK_SIGNATURE_INVALID");
  }
  return true;
}

export async function createStripeCheckoutSession({ plan, user }) {
  if (isBillingDemo()) {
    return {
      mode: "demo",
      checkoutUrl: `/app/billing?demoPlan=${plan.id}`,
      message: `Demo checkout prepared for ${plan.name}.`
    };
  }
  const priceId = env.stripePrices[plan.stripePriceKey];
  if (!env.stripeSecretKey || !priceId) throw new AppError("Stripe price is not configured for this plan.", 500, "STRIPE_NOT_CONFIGURED");
  const body = new URLSearchParams({
    mode: "subscription",
    success_url: `${env.clientUrls[0]}/app/billing?checkout=success`,
    cancel_url: `${env.clientUrls[0]}/pricing?checkout=cancelled`,
    customer_email: user.email,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    client_reference_id: user.id,
    "metadata[userId]": user.id,
    "metadata[planId]": plan.id,
    "subscription_data[metadata][userId]": user.id,
    "subscription_data[metadata][planId]": plan.id
  });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!response.ok) throw new AppError("Stripe checkout failed.", response.status, "STRIPE_CHECKOUT_FAILED", await response.text());
  const session = await response.json();
  return { mode: "stripe", checkoutUrl: session.url, sessionId: session.id };
}

export async function createStripePortalSession() {
  if (isBillingDemo()) return { mode: "demo", portalUrl: "/app/billing?portal=demo" };
  if (!env.stripeSecretKey) throw new AppError("Stripe is not configured.", 500, "STRIPE_NOT_CONFIGURED");
  return { mode: "stripe", portalUrl: `${env.clientUrls[0]}/app/billing` };
}

export function creditPackById(packId) {
  return CREDIT_PACKS.find((pack) => pack.id === packId);
}
