// Connexion Postgres côté serveur (base Render). Import uniquement depuis du
// code serveur : handlers de createServerFn (via import dynamique) ou autres
// modules .server.ts.
import process from "node:process";
import postgres from "postgres";

let _sql: ReturnType<typeof postgres> | undefined;

export function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Configuration manquante: DATABASE_URL.");
    // Connexion interne Render : pas de SSL. Connexion externe (en local) : SSL requis.
    const ssl = url.includes(".render.com") ? "require" : false;
    _sql = postgres(url, { ssl, max: 5 });
  }
  return _sql;
}
