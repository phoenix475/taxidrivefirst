import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import type { NotificationRequest } from "@/lib/email.server";
import { calculatePrice } from "@/lib/pricing";
import { enforceRateLimit } from "@/lib/rate-limit.server";

const reservationSchema = z.object({
  // Aller simple uniquement : le mode aller-retour a été retiré.
  trip_type: z.literal("one_way").default("one_way"),
  pickup_address: z.string().trim().min(3).max(300),
  dropoff_address: z.string().trim().min(3).max(300),
  pickup_at: z.string().min(1),
  passengers: z.number().int().min(1).max(7),
  luggage: z.number().int().min(0).max(7),
  vehicle_class: z.literal("van"),
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(6).max(30),
  notes: z.string().trim().max(1000).optional().nullable(),
  payment_method: z.enum(["cash", "online"]).default("cash"),
  // Coordonnées GPS des adresses choisies dans la liste (servent uniquement au
  // calcul de la distance, non stockées). Absentes si l'adresse a été tapée à la main.
  pickup_lat: z.number().min(-90).max(90).optional().nullable(),
  pickup_lng: z.number().min(-180).max(180).optional().nullable(),
  dropoff_lat: z.number().min(-90).max(90).optional().nullable(),
  dropoff_lng: z.number().min(-180).max(180).optional().nullable(),
});

export const createReservation = createServerFn({ method: "POST" })
  .validator((data: unknown) => reservationSchema.parse(data))
  .handler(async ({ data }) => {
    enforceRateLimit("createReservation", 5, 10 * 60 * 1000);

    const { getSql } = await import("@/lib/db.server");
    const sql = getSql();
    const { pickup_lat, pickup_lng, dropoff_lat, dropoff_lng } = data;

    // La distance et le prix sont toujours calculés ici, côté serveur — jamais
    // repris du navigateur. Sans distance, pas de réservation : sinon la course
    // partirait au forfait minimum quelle que soit sa longueur.
    const { getRouteDistance } = await import("@/lib/route-distance.server");
    const route = await getRouteDistance(
      { address: data.pickup_address, lat: pickup_lat, lng: pickup_lng },
      { address: data.dropoff_address, lat: dropoff_lat, lng: dropoff_lng },
    ).catch((routeError) => {
      console.error("createReservation distance error", routeError);
      throw new Error(
        "Impossible de calculer la distance de ce trajet. Choisissez vos adresses dans la liste de suggestions, puis réessayez.",
      );
    });
    const distanceKm = route.distanceKm;

    const priceEuros = calculatePrice({
      vehicleClass: data.vehicle_class,
      tripType: data.trip_type,
      distanceKm,
    });
    const estimatedPriceCents = Math.round(priceEuros * 100);

    let row: { id: string };
    try {
      [row] = await sql<{ id: string }[]>`
        INSERT INTO reservations (
          trip_type, pickup_address, dropoff_address, pickup_at, passengers, luggage,
          vehicle_class, full_name, phone, notes, payment_method,
          distance_km, duration_minutes, estimated_price_cents
        ) VALUES (
          ${data.trip_type}, ${data.pickup_address}, ${data.dropoff_address},
          ${new Date(data.pickup_at)}, ${data.passengers}, ${data.luggage},
          ${data.vehicle_class}, ${data.full_name}, ${data.phone}, ${data.notes ?? null},
          ${data.payment_method}, ${distanceKm}, ${route.durationMinutes}, ${estimatedPriceCents}
        )
        RETURNING id
      `;
    } catch (dbError) {
      console.error("createReservation error", dbError);
      throw new Error("Impossible d'enregistrer votre réservation. Réessayez.");
    }

    // Le chauffeur est prévenu de chaque réservation, quel que soit le mode de
    // paiement — sinon il ne peut pas l'organiser. L'email est préparé ici mais
    // envoyé par le navigateur : FormSubmit refuse les appels des serveurs Render.
    const { buildReservationNotification } = await import("@/lib/email.server");
    let notification: NotificationRequest | null = null;
    try {
      notification = buildReservationNotification({
        id: row.id,
        full_name: data.full_name,
        phone: data.phone,
        pickup_address: data.pickup_address,
        dropoff_address: data.dropoff_address,
        pickup_at: data.pickup_at,
        trip_type: data.trip_type,
        passengers: data.passengers,
        luggage: data.luggage,
        notes: data.notes,
        distance_km: distanceKm,
        priceEuros,
        payment: data.payment_method === "cash" ? "cash" : "online_pending",
      });
    } catch (emailError) {
      console.error("buildReservationNotification error", emailError);
    }

    if (data.payment_method === "cash") {
      return { id: row.id, checkoutUrl: null as string | null, notification };
    }

    const { createCheckoutSession } = await import("@/lib/stripe.server");
    const origin = getRequest()?.headers.get("origin") ?? "";
    const checkout = await createCheckoutSession({
      reservationId: row.id,
      priceCents: estimatedPriceCents,
      description: `TaxiDriveFirst — ${data.pickup_address} → ${data.dropoff_address}`,
      successUrl: `${origin}/reservation-confirmee?ref=${row.id}&payment=success`,
      cancelUrl: `${origin}/?reservation=${row.id}&payment=cancelled`,
    });

    await sql`UPDATE reservations SET stripe_session_id = ${checkout.id} WHERE id = ${row.id}`;

    return { id: row.id, checkoutUrl: checkout.url, notification };
  });

// Résumé public (non sensible) d'une réservation, utilisé par la page
// /reservation-confirmee — l'id est un UUID non devinable, mais on ne renvoie
// volontairement ni téléphone ni nom pour éviter toute fuite si le
// lien de confirmation est transféré.
const reservationSummarySchema = z.object({ id: z.string().uuid() });

export const getReservationSummary = createServerFn({ method: "GET" })
  .validator((data: unknown) => reservationSummarySchema.parse(data))
  .handler(async ({ data }) => {
    const { getSql } = await import("@/lib/db.server");
    const sql = getSql();

    const [row] = await sql<
      {
        id: string;
        pickup_address: string;
        dropoff_address: string;
        pickup_at: Date;
        trip_type: string;
        vehicle_class: string;
        estimated_price_cents: number | null;
        payment_method: "cash" | "online";
        stripe_payment_status: "unpaid" | "paid" | "refunded";
      }[]
    >`
      SELECT id, pickup_address, dropoff_address, pickup_at, trip_type, vehicle_class,
             estimated_price_cents, payment_method, stripe_payment_status
      FROM reservations
      WHERE id = ${data.id}
    `;
    if (!row) {
      throw new Error("Réservation introuvable.");
    }
    return { ...row, pickup_at: row.pickup_at.toISOString() };
  });
