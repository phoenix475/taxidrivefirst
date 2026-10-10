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

          const { getSql } = await import("@/lib/db.server");
          const sql = getSql();
          let rows;
          try {
            rows = await sql`
              UPDATE reservations
              SET stripe_payment_status = 'paid', status = 'confirmed'
              WHERE ${reservationId ? sql`id = ${reservationId}` : sql`stripe_session_id = ${session.id}`}
              RETURNING *
            `;
          } catch (dbError) {
            console.error("stripe-webhook: failed to update reservation", dbError);
            return new Response("Database error", { status: 500 });
          }

          const row = rows?.[0];
          if (row) {
            const { sendReservationNotificationEmail } = await import("@/lib/email.server");
            await sendReservationNotificationEmail({
              id: row.id,
              full_name: row.full_name,
              phone: row.phone,
              pickup_address: row.pickup_address,
              dropoff_address: row.dropoff_address,
              pickup_at: new Date(row.pickup_at).toISOString(),
              trip_type: row.trip_type,
              passengers: row.passengers,
              luggage: row.luggage,
              notes: row.notes,
              distance_km: row.distance_km == null ? null : Number(row.distance_km),
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
