import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

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
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(6).max(30),
  flight_number: z.string().trim().max(20).optional().nullable(),
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, ...reservation } = data;

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

    const { data: row, error } = await supabaseAdmin
      .from("reservations")
      .insert({
        ...reservation,
        pickup_at: new Date(data.pickup_at).toISOString(),
        distance_km: distanceKm,
        duration_minutes: route.durationMinutes,
        estimated_price_cents: estimatedPriceCents,
      })
      .select("id")
      .single();
    if (error) {
      console.error("createReservation error", error);
      throw new Error("Impossible d'enregistrer votre réservation. Réessayez.");
    }

    // Le chauffeur est prévenu de chaque réservation, quel que soit le mode de
    // paiement — sinon il ne peut pas l'organiser.
    const { sendReservationNotificationEmail } = await import("@/lib/email.server");
    await sendReservationNotificationEmail({
      id: row.id,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone,
      pickup_address: data.pickup_address,
      dropoff_address: data.dropoff_address,
      pickup_at: data.pickup_at,
      trip_type: data.trip_type,
      passengers: data.passengers,
      luggage: data.luggage,
      flight_number: data.flight_number,
      notes: data.notes,
      distance_km: distanceKm,
      priceEuros,
      payment: data.payment_method === "cash" ? "cash" : "online_pending",
    }).catch((emailError) => {
      console.error("sendReservationNotificationEmail error", emailError);
    });

    if (data.payment_method === "cash") {
      return { id: row.id, checkoutUrl: null as string | null };
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

    await supabaseAdmin
      .from("reservations")
      .update({ stripe_session_id: checkout.id })
      .eq("id", row.id);

    return { id: row.id, checkoutUrl: checkout.url };
  });

// Résumé public (non sensible) d'une réservation, utilisé par la page
// /reservation-confirmee — l'id est un UUID non devinable, mais on ne renvoie
// volontairement ni email ni téléphone ni nom pour éviter toute fuite si le
// lien de confirmation est transféré.
const reservationSummarySchema = z.object({ id: z.string().uuid() });

export const getReservationSummary = createServerFn({ method: "GET" })
  .validator((data: unknown) => reservationSummarySchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("reservations")
      .select(
        "id, pickup_address, dropoff_address, pickup_at, trip_type, vehicle_class, estimated_price_cents, payment_method, stripe_payment_status",
      )
      .eq("id", data.id)
      .single();
    if (error || !row) {
      throw new Error("Réservation introuvable.");
    }
    return row;
  });
