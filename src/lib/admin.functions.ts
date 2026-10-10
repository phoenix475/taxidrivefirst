import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) {
    throw new Error("Accès réservé aux administrateurs.");
  }
}

export const listReservations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);

    const { data, error } = await context.supabase
      .from("reservations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("listReservations error", error);
      throw new Error("Impossible de charger les réservations.");
    }
    return data;
  });

const updateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]),
});

export const updateReservationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => updateStatusSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);

    const { error } = await context.supabase
      .from("reservations")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) {
      console.error("updateReservationStatus error", error);
      throw new Error("Impossible de mettre à jour la réservation.");
    }
    return { ok: true };
  });

const bootstrapAdminSchema = z.object({
  setupCode: z.string().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
});

// Crée le tout premier compte admin. Se désactive automatiquement dès qu'un
// admin existe déjà — ne peut donc pas servir de porte dérobée permanente.
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .validator((data: unknown) => bootstrapAdminSchema.parse(data))
  .handler(async ({ data }) => {
    const setupCode = process.env.ADMIN_SETUP_CODE;
    if (!setupCode || data.setupCode !== setupCode) {
      throw new Error("Code de configuration invalide.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count, error: countError } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (countError) {
      console.error("bootstrapAdmin count error", countError);
      throw new Error("Impossible de vérifier les administrateurs existants.");
    }
    if (count && count > 0) {
      throw new Error("Un compte administrateur existe déjà.");
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (createError || !created.user) {
      console.error("bootstrapAdmin createUser error", createError);
      throw new Error("Impossible de créer le compte administrateur.");
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "admin" });
    if (roleError) {
      console.error("bootstrapAdmin role error", roleError);
      throw new Error("Compte créé mais impossible d'attribuer le rôle admin.");
    }

    return { ok: true };
  });
