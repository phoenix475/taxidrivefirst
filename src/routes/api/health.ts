import { createFileRoute } from "@tanstack/react-router";

// Réponse minimale pour le ping de maintien en éveil (.github/workflows/keep-alive.yml) :
// sur l'offre gratuite, Render endort le service après 15 min sans visite.
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () =>
        new Response("ok", {
          headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
        }),
    },
  },
});
