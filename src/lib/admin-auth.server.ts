// Session admin : un seul mot de passe (ADMIN_PASSWORD) et un cookie signé
// HMAC, httpOnly. Pas de comptes utilisateurs à gérer.
import process from "node:process";
import { createHmac, timingSafeEqual } from "node:crypto";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

const COOKIE_NAME = "tdf_admin";
const SESSION_SECONDS = 30 * 24 * 3600;

function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("Configuration manquante: ADMIN_PASSWORD.");
  return password;
}

// La clé de signature dérive du mot de passe : le changer déconnecte tout le monde.
function sign(value: string): string {
  return createHmac("sha256", `tdf-admin:${getAdminPassword()}`).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function checkAdminPassword(password: string): boolean {
  return safeEqual(sign(password), sign(getAdminPassword()));
}

export function startAdminSession(): void {
  const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  setCookie(COOKIE_NAME, `${expiresAt}.${sign(expiresAt)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export function endAdminSession(): void {
  deleteCookie(COOKIE_NAME, { path: "/" });
}

export function isAdmin(): boolean {
  const cookie = getCookie(COOKIE_NAME);
  if (!cookie) return false;
  const [expiresAt, signature] = cookie.split(".");
  if (!expiresAt || !signature) return false;
  if (Number(expiresAt) < Date.now() / 1000) return false;
  return safeEqual(signature, sign(expiresAt));
}

export function requireAdmin(): void {
  if (!isAdmin()) throw new Error("Accès réservé aux administrateurs.");
}
