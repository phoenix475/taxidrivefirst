// Grille tarifaire TaxiDriveFirst — Van Mercedes Classe V, Paris & Île-de-France.
// Pour changer les prix : modifie juste les nombres ci-dessous, rien d'autre à toucher.

export type VehicleClass = "van";
export type TripType = "one_way" | "round_trip";

export const PRICING = {
  van: {
    // Tarif au km, quelle que soit la distance et la destination (aéroports compris).
    perKm: 3,
    // Prix minimum d'une course : tout trajet de moins de 10 km paie ce montant.
    // Comme 50 € ÷ 3 €/km ≈ 17 km, le minimum s'applique en fait jusqu'à ~17 km :
    // sans ça, un trajet de 11 km (33 €) coûterait moins cher qu'un de 9 km.
    minimumFare: 50,
  },
} satisfies Record<VehicleClass, { perKm: number; minimumFare: number }>;

export function calculatePrice(params: {
  vehicleClass: VehicleClass;
  tripType: TripType;
  distanceKm: number;
}): number {
  const grid = PRICING[params.vehicleClass];

  const distanceKm = Math.max(params.distanceKm, 0);
  const effectiveDistanceKm = params.tripType === "round_trip" ? distanceKm * 2 : distanceKm;
  const distanceCost = effectiveDistanceKm * grid.perKm;

  // Arrondi à l'euro le plus proche : pas de prix du genre 61,97 €.
  return Math.round(Math.max(distanceCost, grid.minimumFare));
}
