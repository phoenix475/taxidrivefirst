// Helpers Stripe côté serveur — appels REST directs (pas de SDK `stripe`,
// pour ne pas ajouter de dépendance npm). Import uniquement depuis du code
// serveur (handlers de createServerFn, routes API serveur).
import process from "node:process";

function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Configuration manquante: STRIPE_SECRET_KEY.");
  return key;
}

async function stripeRequest(path: string, body: Record<string, string>) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  const json = await response.json();
  if (!response.ok) {
    console.error("Stripe API error", json);
    throw new Error(json?.error?.message ?? "Erreur Stripe.");
  }
  return json;
}

export async function createCheckoutSession(params: {
  reservationId: string;
  priceCents: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string }> {
  const session = await stripeRequest("checkout/sessions", {
    mode: "payment",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(params.priceCents),
    "line_items[0][price_data][product_data][name]": params.description,
    "line_items[0][quantity]": "1",
    "metadata[reservation_id]": params.reservationId,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });
  return { id: session.id, url: session.url };
}

/**
 * Vérifie la signature d'un webhook Stripe (algorithme HMAC-SHA256 documenté
 * par Stripe), sans dépendre du SDK officiel.
 */
export async function verifyStripeWebhookSignature(params: {
  payload: string;
  signatureHeader: string;
  webhookSecret: string;
  toleranceSeconds?: number;
}): Promise<boolean> {
  const { createHmac, timingSafeEqual } = await import("node:crypto");

  const parts = params.signatureHeader.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split("=");
    if (key && value) acc[key] = value;
    return acc;
  }, {});

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const tolerance = params.toleranceSeconds ?? 300;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > tolerance) return false;

  const expectedSignature = createHmac("sha256", params.webhookSecret)
    .update(`${timestamp}.${params.payload}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expectedSignature, "utf8");
  const actualBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
