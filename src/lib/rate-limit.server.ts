// Rate-limit en mémoire par IP — suffisant pour une seule instance Render.
// Si le service passe un jour en plusieurs instances, remplacer par un
// backend partagé (ex: table Supabase ou Redis).
import { getRequest } from "@tanstack/react-start/server";

const hits = new Map<string, { count: number; resetAt: number }>();

function getClientIp(): string {
  const headers = getRequest()?.headers;
  const ip =
    headers?.get("cf-connecting-ip") ??
    headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers?.get("x-real-ip");
  return ip || "unknown";
}

export function enforceRateLimit(key: string, maxRequests: number, windowMs: number): void {
  const ip = getClientIp();
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();

  const entry = hits.get(bucketKey);
  if (!entry || now > entry.resetAt) {
    hits.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return;
  }

  entry.count += 1;
  if (entry.count > maxRequests) {
    throw new Error("Trop de requêtes. Réessayez dans quelques instants.");
  }
}
