import { createFileRoute } from "@tanstack/react-router";

import { verifyStripeWebhookSignature } from "@/lib/stripe.server";

export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
          console.error("STRIPE_WEBHOOK_SECRET manquant.");
          return new Response("Server misconfigured", { status: 500 });
        }

        const signatureHeader = request.headers.get("stripe-signature");
        const payload = await request.text();
        if (!signatureHeader) {
          return new Response("Missing signature", { status: 400 });
        }

        const valid = await verifyStripeWebhookSignature({
          payload,
          signatureHeader,
          webhookSecret,
        });
        if (!valid) {
          return new Response("Invalid signature", { status: 400 });
        }

        const event = JSON.parse(payload);

        if (event.type === "checkout.session.completed") {
          const session = event.data.object;
          const reservationId: string | undefined = session.metadata?.reservation_id;

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const update = supabaseAdmin.from("reservations").update({
            stripe_payment_status: "paid",
            status: "confirmed",
          });
          const query = reservationId
            ? update.eq("id", reservationId)
            : update.eq("stripe_session_id", session.id);

          const { data: rows, error } = await query.select();
          if (error) {
            console.error("stripe-webhook: failed to update reservation", error);
            return new Response("Database error", { status: 500 });
          }

          const row = rows?.[0];
          if (row) {
            const { sendReservationNotificationEmail } = await import("@/lib/email.server");
            await sendReservationNotificationEmail({
              ...row,
              priceEuros: (row.estimated_price_cents ?? 0) / 100,
              payment: "online_paid",
            }).catch((emailError) => {
              console.error("stripe-webhook: notification email error", emailError);
            });
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
