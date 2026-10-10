// Distance et durée routières entre deux points via l'API Google Distance
// Matrix. Chaque point est soit des coordonnées GPS, soit une adresse en
// texte libre (quand le client n'a pas choisi dans la liste de suggestions).
// Clé serveur dédiée, jamais exposée au navigateur.
export type RoutePoint = { address: string; lat?: number | null; lng?: number | null };

export async function getRouteDistance(
  origin: RoutePoint,
  destination: RoutePoint,
): Promise<{ distanceKm: number; durationMinutes: number }> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!apiKey) {
    throw new Error("Configuration manquante: GOOGLE_MAPS_SERVER_KEY.");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", toQuery(origin));
  url.searchParams.set("destinations", toQuery(destination));
  url.searchParams.set("units", "metric");
  url.searchParams.set("region", "fr");
  url.searchParams.set("language", "fr");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Impossible de calculer la distance du trajet.");
  }

  const json = await response.json();
  const element = json?.rows?.[0]?.elements?.[0];
  if (json.status !== "OK" || !element || element.status !== "OK") {
    console.error("Distance Matrix error", json.status, json.error_message, element?.status);
    throw new Error("Itinéraire introuvable entre ces deux adresses.");
  }

  return {
    distanceKm: Math.round(element.distance.value / 10) / 100,
    durationMinutes: Math.round(element.duration.value / 60),
  };
}

function toQuery(point: RoutePoint): string {
  return point.lat != null && point.lng != null ? `${point.lat},${point.lng}` : point.address;
}
