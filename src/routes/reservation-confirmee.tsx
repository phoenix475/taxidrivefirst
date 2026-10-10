import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { SITE, SiteShell } from "@/components/site-chrome";
import { getReservationSummary } from "@/lib/reservations.functions";

const searchSchema = z.object({
  ref: z.string().uuid().optional(),
  payment: z.enum(["success", "cancelled"]).optional(),
});

export const Route = createFileRoute("/reservation-confirmee")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: `Réservation confirmée — ${SITE.name}` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReservationConfirmee,
});

type Summary = Awaited<ReturnType<typeof getReservationSummary>>;

function ReservationConfirmee() {
  const { ref, payment } = Route.useSearch();
  const getSummary = useServerFn(getReservationSummary);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!ref) {
      setNotFound(true);
      return;
    }
    getSummary({ data: { id: ref } })
      .then((row) => setSummary(row))
      .catch(() => setNotFound(true));
  }, [ref]);

  const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

  return (
    <SiteShell>
      <main className="wrap">
        <div className="done confirm" aria-live="polite">
          {notFound ? (
            <>
              <div className="eyebrow">Lien invalide</div>
              <h2>Réservation introuvable</h2>
              <p>
                Le lien utilisé n'est plus valide. Si vous venez de réserver, vérifiez l'email de
                confirmation reçu.
              </p>
            </>
          ) : !summary ? (
            <p>Chargement de votre réservation…</p>
          ) : (
            <>
              <div className="check">
                <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M5 12.5l4.5 4.5L19 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="eyebrow">
                {payment === "cancelled" ? "Paiement annulé" : "Demande reçue"}
              </div>
              <h2>{payment === "cancelled" ? "En attente." : "C'est noté."}</h2>
              <p className="recap">
                {summary.pickup_address} → {summary.dropoff_address}
                <br />
                {format(new Date(summary.pickup_at), "EEEE d MMMM yyyy 'à' HH'h'mm", {
                  locale: fr,
                })}
                {summary.estimated_price_cents != null &&
                  ` · ${eur.format(summary.estimated_price_cents / 100)}`}
              </p>
              <p>
                Référence <span className="ref">{summary.id.slice(0, 8).toUpperCase()}</span>.{" "}
                {payment === "cancelled"
                  ? "Votre réservation reste enregistrée en attente de paiement."
                  : "Votre chauffeur vous appelle pour confirmer l'heure et le lieu de prise en charge."}
              </p>
            </>
          )}
          <div>
            <Link className="btn btn-ghost" to="/" hash="reserver">
              {notFound ? "Retour à l'accueil" : "Nouvelle réservation"}
            </Link>
          </div>
        </div>
      </main>
    </SiteShell>
  );
}
