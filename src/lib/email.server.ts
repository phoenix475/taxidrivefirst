// Email au chauffeur à chaque réservation, via FormSubmit (formsubmit.co) :
// aucun compte ni clé API. Au tout premier envoi, FormSubmit envoie un lien
// d'activation à NOTIFICATION_EMAIL ; les emails partent dès qu'il est cliqué.
// Import uniquement depuis du code serveur (handlers de createServerFn, routes API serveur).
import process from "node:process";

// Adresse qui reçoit chaque nouvelle réservation (le chauffeur / l'exploitant).
function getNotificationEmail(): string {
  const to = process.env.NOTIFICATION_EMAIL;
  if (!to) throw new Error("Configuration manquante: NOTIFICATION_EMAIL.");
  return to;
}

// FormSubmit refuse les envois sans site d'origine.
function getSiteUrl(): string {
  return process.env.SITE_URL || "https://taxidrivefirst.fr";
}

export async function sendReservationNotificationEmail(reservation: {
  id: string;
  full_name: string;
  phone: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_at: string;
  return_at?: string | null;
  trip_type: string;
  passengers: number;
  luggage: number;
  notes?: string | null;
  distance_km?: number | null;
  priceEuros: number;
  // cash : paiement sur place. online_pending : le client vient d'être envoyé
  // sur Stripe (pas encore payé). online_paid : Stripe a confirmé le paiement.
  payment: "cash" | "online_pending" | "online_paid";
}): Promise<void> {
  const formatDate = (value: string) =>
    new Date(value).toLocaleString("fr-FR", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    });

  const { paymentLabel, subjectPrefix } = {
    cash: {
      paymentLabel: "Sur place (à bord)",
      subjectPrefix: "Nouvelle course",
    },
    online_pending: {
      paymentLabel: "En ligne — PAS ENCORE PAYÉ, le client est sur la page Stripe",
      subjectPrefix: "Nouvelle course (paiement en attente)",
    },
    online_paid: {
      paymentLabel: "En ligne — PAYÉ via Stripe",
      subjectPrefix: "Paiement confirmé",
    },
  }[reservation.payment];

  const pickupDate = formatDate(reservation.pickup_at);
  const siteUrl = getSiteUrl();

  // Les clés deviennent les lignes du tableau dans l'email (template "table").
  const fields: Record<string, string> = {
    _subject: `${subjectPrefix} — ${pickupDate} — ${reservation.priceEuros} €`,
    _template: "table",
    _captcha: "false",
    Client: reservation.full_name,
    Téléphone: reservation.phone,
    Départ: reservation.pickup_address,
    Arrivée: reservation.dropoff_address,
    "Prise en charge": pickupDate,
    Passagers: String(reservation.passengers),
    Bagages: String(reservation.luggage),
    Distance: reservation.distance_km == null ? "non calculée" : `${reservation.distance_km} km`,
    Prix: `${reservation.priceEuros} €`,
    Paiement: paymentLabel,
    Référence: reservation.id.slice(0, 8).toUpperCase(),
    "Voir toutes les courses": `${siteUrl}/admin`,
  };
  if (reservation.return_at) fields.Retour = formatDate(reservation.return_at);
  if (reservation.notes) fields.Remarques = reservation.notes;

  const response = await fetch(
    `https://formsubmit.co/ajax/${encodeURIComponent(getNotificationEmail())}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: siteUrl,
        Referer: `${siteUrl}/`,
      },
      body: JSON.stringify(fields),
    },
  );

  const json = await response.json().catch(() => null);
  // FormSubmit répond 200 même en cas d'échec : le vrai résultat est dans `success`.
  if (!response.ok || String(json?.success) !== "true") {
    console.error("FormSubmit error", response.status, json);
    throw new Error("Échec de l'envoi de l'email de notification.");
  }
}
