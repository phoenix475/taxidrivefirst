import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { enforceRateLimit } from "@/lib/rate-limit.server";

const loginSchema = z.object({ password: z.string().min(1).max(200) });

export const adminLogin = createServerFn({ method: "POST" })
  .validator((data: unknown) => loginSchema.parse(data))
  .handler(async ({ data }) => {
    enforceRateLimit("adminLogin", 10, 15 * 60 * 1000);

    const { checkAdminPassword, startAdminSession } = await import("@/lib/admin-auth.server");
    if (!checkAdminPassword(data.password)) {
      throw new Error("Mot de passe incorrect.");
    }
    startAdminSession();
    return { ok: true };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { endAdminSession } = await import("@/lib/admin-auth.server");
  endAdminSession();
  return { ok: true };
});

export const getAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  const { isAdmin } = await import("@/lib/admin-auth.server");
  return { isAdmin: isAdmin() };
});

export type AdminReservation = {
  id: string;
  created_at: string;
  trip_type: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_at: string;
  passengers: number;
  luggage: number;
  vehicle_class: string;
  full_name: string;
  phone: string;
  notes: string | null;
  estimated_price_cents: number | null;
  payment_method: "cash" | "online";
  stripe_payment_status: "unpaid" | "paid" | "refunded";
  status: "pending" | "confirmed" | "completed" | "cancelled";
};

export const listReservations = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin } = await import("@/lib/admin-auth.server");
  requireAdmin();

  const { getSql } = await import("@/lib/db.server");
  const sql = getSql();
  const rows = await sql<AdminReservation[]>`
    SELECT id, created_at, trip_type, pickup_address, dropoff_address, pickup_at,
           passengers, luggage, vehicle_class, full_name, phone, notes,
           estimated_price_cents, payment_method, stripe_payment_status, status
    FROM reservations
    ORDER BY created_at DESC
    LIMIT 500
  `;
  return rows.map((r) => ({
    ...r,
    created_at: new Date(r.created_at).toISOString(),
    pickup_at: new Date(r.pickup_at).toISOString(),
  }));
});

const updateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]),
});

export const updateReservationStatus = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateStatusSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    requireAdmin();

    const { getSql } = await import("@/lib/db.server");
    const sql = getSql();
    await sql`UPDATE reservations SET status = ${data.status} WHERE id = ${data.id}`;
    return { ok: true };
  });
