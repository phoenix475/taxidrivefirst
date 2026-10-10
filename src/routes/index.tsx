import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { createReservation } from "@/lib/reservations.functions";
import { calculateTrip } from "@/lib/distance.functions";
import { calculatePrice, PRICING } from "@/lib/pricing";
import { useAddressAutocomplete, type SelectedPlace } from "@/lib/places";
import { makeRouteMap, type MapPoint } from "@/lib/route-map";
import { SITE, SiteShell } from "@/components/site-chrome";

export const Route = createFileRoute("/")({
  component: Home,
});

const VAN = {
  name: "Van",
  model: "Mercedes Classe V",
  pax: 7,
  bags: 7,
  extras: ["Sièges face à face", "Grand coffre", "Sièges enfant", "Eau fraîche", "Chargeurs USB-C"],
};

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const eur2 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

type Place = { address: string; short: string; lat: number; lng: number };

// Raccourcis « trajets fréquents » : ils pré-remplissent le formulaire avec des
// coordonnées connues, le prix vient ensuite de Google comme pour toute adresse.
const SPOTS: Record<string, Place> = {
  opera: {
    address: "Place de l'Opéra, 75009 Paris, France",
    short: "Paris",
    lat: 48.8719,
    lng: 2.3316,
  },
  eiffel: {
    address: "Tour Eiffel, Avenue Gustave Eiffel, 75007 Paris, France",
    short: "Paris",
    lat: 48.8584,
    lng: 2.2945,
  },
  cdg: {
    address: "Aéroport Paris-Charles de Gaulle, 95700 Roissy-en-France, France",
    short: "CDG",
    lat: 49.0097,
    lng: 2.5479,
  },
  ory: {
    address: "Aéroport de Paris-Orly, 94390 Orly, France",
    short: "Orly",
    lat: 48.7262,
    lng: 2.3652,
  },
  disney: {
    address: "Disneyland Paris, 77777 Chessy, France",
    short: "Disneyland",
    lat: 48.8722,
    lng: 2.7758,
  },
  versailles: {
    address: "Château de Versailles, Place d'Armes, 78000 Versailles, France",
    short: "Versailles",
    lat: 48.8049,
    lng: 2.1204,
  },
  defense: {
    address: "La Défense, 92800 Puteaux, France",
    short: "La Défense",
    lat: 48.8919,
    lng: 2.2381,
  },
};

const FREQUENT = [
  { label: "Paris ↔ Aéroport CDG", from: "opera", to: "cdg" },
  { label: "Paris ↔ Aéroport d'Orly", from: "opera", to: "ory" },
  { label: "CDG ↔ Orly", from: "cdg", to: "ory" },
  { label: "Paris ↔ Disneyland Paris", from: "opera", to: "disney" },
  { label: "Paris ↔ Versailles", from: "eiffel", to: "versailles" },
  { label: "Paris ↔ La Défense", from: "opera", to: "defense" },
];

const ADDRESS_NOT_FOUND_MESSAGE =
  "Adresse introuvable : impossible de calculer le trajet. Vérifiez l'orthographe ou choisissez l'adresse dans la liste de suggestions.";

function Home() {
  const [preset, setPreset] = useState<{ from: Place; to: Place; n: number } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success") {
      toast.success("Paiement reçu ! Votre réservation est confirmée.");
    } else if (payment === "cancelled") {
      toast.error("Paiement annulé. Votre réservation reste en attente.");
    }
    if (payment) {
      params.delete("payment");
      params.delete("reservation");
      const query = params.toString();
      window.history.replaceState({}, "", query ? `?${query}` : window.location.pathname);
    }
  }, []);

  const pickTrip = (from: string, to: string) => {
    setPreset((p) => ({ from: SPOTS[from], to: SPOTS[to], n: (p?.n ?? 0) + 1 }));
    document.getElementById("reserver")?.scrollIntoView({ block: "start" });
  };

  return (
    <SiteShell>
      <header className="hero" id="top">
        <div className="wrap">
          <BookingConsole preset={preset} />
          <div className="facts">
            <div className="fact">
              <b className="num">60 min</b>
              <span>d'attente offerte à l'aéroport</span>
            </div>
            <div className="fact">
              <b className="num">0 €</b>
              <span>de supplément si votre vol a du retard</span>
            </div>
            <div className="fact">
              <b className="num">Prix fixe</b>
              <span>connu avant de réserver</span>
            </div>
            <div className="fact">
              <b className="num">24h/24</b>
              <span>Paris &amp; Île-de-France</span>
            </div>
          </div>
        </div>
      </header>

      <Tarifs onPick={pickTrip} />
      <Flotte />
      <Deroule />
      <Services />
      <Faq />
      <Cta />
    </SiteShell>
  );
}

/* -------------------- CONSOLE CARTE + RÉSERVATION -------------------- */

type PaymentMethod = "cash" | "online";
type Coords = { lat: number; lng: number };

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function BookingConsole({ preset }: { preset: { from: Place; to: Place; n: number } | null }) {
  const navigate = useNavigate();
  const submit = useServerFn(createReservation);
  const calculateDistance = useServerFn(calculateTrip);

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupCoords, setPickupCoords] = useState<Coords | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<Coords | null>(null);
  const [distance, setDistance] = useState<{ distanceKm: number; durationMinutes: number } | null>(
    null,
  );
  // idle : adresses incomplètes · loading : calcul en cours · ok : distance
  // trouvée · error : Google ne trouve pas le trajet (adresse mal écrite).
  const [distanceStatus, setDistanceStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  const [date, setDate] = useState(() => isoDate(new Date(Date.now() + 86400000)));
  const [time, setTime] = useState("08:30");
  const [passengers, setPassengers] = useState(2);
  const [luggage, setLuggage] = useState(2);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [notes, setNotes] = useState("");

  const pickupInputRef = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<ReturnType<typeof makeRouteMap> | null>(null);

  useAddressAutocomplete(pickupInputRef, (place: SelectedPlace) => {
    setPickup(place.formattedAddress);
    setPickupCoords({ lat: place.lat, lng: place.lng });
  });
  useAddressAutocomplete(dropoffInputRef, (place: SelectedPlace) => {
    setDropoff(place.formattedAddress);
    setDropoffCoords({ lat: place.lat, lng: place.lng });
  });

  useEffect(() => {
    if (!preset) return;
    setPickup(preset.from.address);
    setPickupCoords({ lat: preset.from.lat, lng: preset.from.lng });
    setDropoff(preset.to.address);
    setDropoffCoords({ lat: preset.to.lat, lng: preset.to.lng });
    setStep(1);
  }, [preset]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const map = makeRouteMap(canvasRef.current);
    mapRef.current = map;
    return () => map.destroy();
  }, []);

  useEffect(() => {
    mapRef.current?.setRoute(pickupCoords as MapPoint | null, dropoffCoords as MapPoint | null);
  }, [pickupCoords, dropoffCoords]);

  // Recalcule la distance routière dès que les deux adresses sont renseignées.
  // Adresses choisies dans la liste : calcul immédiat sur les coordonnées GPS.
  // Adresses tapées à la main : calcul sur le texte, après une courte pause de frappe.
  useEffect(() => {
    if (pickup.trim().length < 3 || dropoff.trim().length < 3) {
      setDistance(null);
      setDistanceStatus("idle");
      return;
    }
    let cancelled = false;
    setDistance(null);
    setDistanceStatus("loading");
    const delay = pickupCoords && dropoffCoords ? 0 : 800;
    const timer = setTimeout(() => {
      calculateDistance({
        data: {
          origin: { address: pickup, lat: pickupCoords?.lat, lng: pickupCoords?.lng },
          destination: { address: dropoff, lat: dropoffCoords?.lat, lng: dropoffCoords?.lng },
        },
      })
        .then((res) => {
          if (cancelled) return;
          setDistance(res);
          setDistanceStatus("ok");
        })
        .catch(() => {
          if (cancelled) return;
          setDistance(null);
          setDistanceStatus("error");
        });
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pickup, dropoff, pickupCoords, dropoffCoords]);

  const price = distance
    ? calculatePrice({ vehicleClass: "van", tripType: "one_way", distanceKm: distance.distanceKm })
    : null;
  const minimumApplied = price != null && price === PRICING.van.minimumFare;

  const pickupAt = () => {
    const d = new Date(`${date}T${time || "08:30"}`);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const swap = () => {
    setPickup(dropoff);
    setDropoff(pickup);
    setPickupCoords(dropoffCoords);
    setDropoffCoords(pickupCoords);
  };

  const next = () => {
    setError(null);
    const when = pickupAt();
    if (!pickup.trim() || !dropoff.trim() || !when) {
      setError("Renseignez départ, arrivée, date et heure.");
      return;
    }
    if (when.getTime() < Date.now()) {
      setError("Choisissez une date et une heure à venir.");
      return;
    }
    // Pas de distance, pas de prix : on bloque ici plutôt qu'à la toute fin.
    if (distanceStatus === "loading") {
      setError("Calcul de la distance en cours, patientez une seconde…");
      return;
    }
    if (distanceStatus !== "ok") {
      // Le détail est déjà affiché sous les adresses, pas besoin de le répéter.
      setError("Corrigez l'adresse de départ ou d'arrivée ci-dessus.");
      return;
    }
    setStep(2);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      next();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await submit({
        data: {
          trip_type: "one_way",
          pickup_address: pickup,
          dropoff_address: dropoff,
          pickup_at: pickupAt()!.toISOString(),
          passengers,
          luggage,
          vehicle_class: "van",
          full_name: fullName,
          email,
          phone,
          flight_number: flightNumber || null,
          notes: notes || null,
          payment_method: paymentMethod,
          pickup_lat: pickupCoords?.lat ?? null,
          pickup_lng: pickupCoords?.lng ?? null,
          dropoff_lat: dropoffCoords?.lat ?? null,
          dropoff_lng: dropoffCoords?.lng ?? null,
        },
      });
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      navigate({ to: "/reservation-confirmee", search: { ref: res.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const ticketLines: [string, React.ReactNode][] = distance
    ? [
        ["Distance (Google Maps)", `${Math.round(distance.distanceKm)} km`],
        ["Durée estimée", `${distance.durationMinutes} min`],
        minimumApplied
          ? ["Tarif", <span className="tag">Course minimum</span>]
          : [
              `Distance × ${eur2.format(PRICING.van.perKm)}/km`,
              eur2.format(distance.distanceKm * PRICING.van.perKm),
            ],
      ]
    : [];

  return (
    <div className="console" id="reserver">
      <div className="map-panel">
        <canvas
          id="map"
          ref={canvasRef}
          aria-label="Carte de l'itinéraire entre le départ et l'arrivée"
          role="img"
        />
        <div className="map-chip tl">
          <span className="live-dot" />
          Itinéraire estimé
        </div>
        <div className="map-chip bl">
          <div>
            Distance
            <b className="num">{distance ? `${Math.round(distance.distanceKm)} km` : "–"}</b>
          </div>
          <div>
            Durée<b className="num">{distance ? `${distance.durationMinutes} min` : "–"}</b>
          </div>
        </div>
      </div>

      <form className="booking" onSubmit={onSubmit} noValidate={step === 1}>
        <div>
          <div className="eyebrow">{step === 1 ? "Estimation immédiate" : "Étape 2 sur 2"}</div>
          <h1 style={{ marginTop: 6 }}>{step === 1 ? "Votre trajet" : "Vos coordonnées"}</h1>
        </div>

        {/* Les champs d'adresse restent montés à l'étape 2 : l'auto-complétion
            Google est branchée une seule fois sur ces <input>. */}
        <div hidden={step !== 1} style={{ display: step === 1 ? "contents" : "none" }}>
          <div className="route-fields">
            <div className="stack">
              <div className="field">
                <label htmlFor="from">Départ</label>
                <input
                  id="from"
                  type="text"
                  ref={pickupInputRef}
                  value={pickup}
                  onChange={(e) => {
                    setPickup(e.target.value);
                    setPickupCoords(null);
                  }}
                  placeholder="Adresse, gare, aéroport…"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="to">Arrivée</label>
                <input
                  id="to"
                  type="text"
                  ref={dropoffInputRef}
                  value={dropoff}
                  onChange={(e) => {
                    setDropoff(e.target.value);
                    setDropoffCoords(null);
                  }}
                  placeholder="Hôtel, adresse, aéroport…"
                  autoComplete="off"
                />
              </div>
            </div>
            <button
              type="button"
              className="swap"
              onClick={swap}
              aria-label="Inverser départ et arrivée"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M5 2v12M5 14l-3-3M5 14l3-3M11 14V2M11 2L8 5M11 2l3 3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          {distanceStatus === "error" && <p className="field-hint">{ADDRESS_NOT_FOUND_MESSAGE}</p>}

          <div className="row4">
            <div className="field">
              <label htmlFor="date">Date</label>
              <input
                type="date"
                id="date"
                value={date}
                min={isoDate(new Date())}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="time">Heure</label>
              <input
                type="time"
                id="time"
                value={time}
                step={300}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="pax">Passagers</label>
              <select id="pax" value={passengers} onChange={(e) => setPassengers(+e.target.value)}>
                {Array.from({ length: VAN.pax }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="bags">Bagages</label>
              <select id="bags" value={luggage} onChange={(e) => setLuggage(+e.target.value)}>
                {Array.from({ length: VAN.bags + 1 }, (_, i) => i).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <span className="legend">Véhicule</span>
            <div className="veh-single">
              <div>
                <div className="veh-name">
                  {VAN.name} · {VAN.model}
                </div>
                <div className="veh-cap">
                  {VAN.pax} passagers · {VAN.bags} bagages
                </div>
              </div>
              <span className="veh-price">{price != null ? eur.format(price) : "–"}</span>
            </div>
          </div>

          <div className="ticket" aria-live="polite">
            {distanceStatus === "loading" && (
              <div className="line">
                <span>Calcul du trajet…</span>
                <span />
              </div>
            )}
            {distanceStatus === "idle" && (
              <div className="line">
                <span>Saisissez un départ et une arrivée</span>
                <span />
              </div>
            )}
            {ticketLines.map(([k, v]) => (
              <div className="line" key={k}>
                <span>{k}</span>
                <span>{v}</span>
              </div>
            ))}
            <div className="total">
              <span>Prix TTC</span>
              <b>{price != null ? eur.format(price) : "–"}</b>
            </div>
          </div>
        </div>

        {step === 2 && (
          <>
            <div className="route-recap">
              <span>
                <b>{pickup}</b> → <b>{dropoff}</b>
              </span>
              <button type="button" className="link-btn" onClick={() => setStep(1)}>
                Modifier
              </button>
            </div>
            <div className="field">
              <label htmlFor="name">Nom complet</label>
              <input
                id="name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Marie Dupont"
                autoComplete="name"
              />
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="marie@email.com"
                  autoComplete="email"
                />
              </div>
              <div className="field">
                <label htmlFor="phone">Téléphone</label>
                <input
                  id="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="06 12 34 56 78"
                  autoComplete="tel"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="flight">N° de vol ou de train (optionnel)</label>
              <input
                id="flight"
                type="text"
                value={flightNumber}
                onChange={(e) => setFlightNumber(e.target.value)}
                placeholder="AF1234"
              />
            </div>
            <div className="field">
              <label htmlFor="notes">Remarques (optionnel)</label>
              <textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Siège enfant, skis, poussette…"
              />
            </div>
            <fieldset className="pay">
              <legend className="legend">Paiement</legend>
              <button
                type="button"
                aria-pressed={paymentMethod === "cash"}
                onClick={() => setPaymentMethod("cash")}
              >
                Payer à bord
              </button>
              <button
                type="button"
                aria-pressed={paymentMethod === "online"}
                onClick={() => setPaymentMethod("online")}
              >
                Payer en ligne
              </button>
            </fieldset>
          </>
        )}

        {error && <p className="form-error">{error}</p>}

        {step === 1 ? (
          <button type="submit" className="btn btn-amber">
            Continuer
          </button>
        ) : (
          <div className="actions">
            <button type="button" className="link-muted" onClick={() => setStep(1)}>
              ← Retour
            </button>
            <button type="submit" className="btn btn-amber" disabled={loading}>
              {loading
                ? "Envoi…"
                : paymentMethod === "online"
                  ? `Payer ${price != null ? eur.format(price) : ""}`
                  : `Réserver · ${price != null ? eur.format(price) : ""}`}
            </button>
          </div>
        )}
        <p className="form-note">
          Sans engagement. Annulation gratuite jusqu'à 24 h avant la prise en charge.
        </p>
      </form>
    </div>
  );
}

/* -------------------- TARIFS -------------------- */
function Tarifs({ onPick }: { onPick: (from: string, to: string) => void }) {
  return (
    <section className="band" id="tarifs">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow">Tarifs</div>
            <h2>
              Un prix au kilomètre,
              <br />
              connu d'avance.
            </h2>
          </div>
          <p>
            Le prix est calculé sur la distance routière réelle (Google Maps) au moment de la
            réservation. Jour, nuit ou embouteillages : le montant affiché est celui que vous payez.
          </p>
        </div>
        <div className="tariffs">
          <div className="tariff">
            <b className="num">{eur2.format(PRICING.van.perKm)}</b>
            <span>par kilomètre</span>
          </div>
          <div className="tariff">
            <b className="num">{eur.format(PRICING.van.minimumFare)}</b>
            <span>course minimum, pour les trajets de moins de 10 km</span>
          </div>
          <div className="tariff">
            <b className="num">0 €</b>
            <span>de supplément nuit, week-end ou bagages</span>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Trajets fréquents</th>
                <th className="r">
                  <span style={{ position: "absolute", left: -9999 }}>Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {FREQUENT.map((f) => (
                <tr key={f.label}>
                  <td className="trajet">{f.label}</td>
                  <td className="r">
                    <button type="button" className="link-btn" onClick={() => onPick(f.from, f.to)}>
                      Voir le prix →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-note">
          <span>Prix TTC par trajet, pour le véhicule entier</span>
          <span>Attente offerte : 60 min aéroports, 15 min gares</span>
          <span>Siège enfant fourni sur demande, sans supplément</span>
        </div>
      </div>
    </section>
  );
}

/* -------------------- FLOTTE -------------------- */
const VAN_SHAPE = {
  body: "M20 104 L20 74 Q22 62 40 56 L70 46 Q86 26 112 22 L352 22 Q376 22 380 42 L384 104",
  win: [
    "M92 50 Q100 32 118 30 L170 30 L170 50 Z",
    "M178 30 L250 30 L250 50 L178 50 Z",
    "M258 30 L340 30 Q360 30 362 44 L362 50 L258 50 Z",
  ],
  wheels: [100, 316],
};

function Flotte() {
  return (
    <section className="band" id="flotte">
      <div className="wrap fleet">
        <div>
          <div className="eyebrow">Le véhicule</div>
          <div style={{ marginTop: 16 }}>
            <div className="fleet-name">{VAN.name}</div>
            <p className="fleet-model">{VAN.model} ou équivalent</p>
            <dl className="specs">
              <div>
                <dt>Passagers</dt>
                <dd className="num">{VAN.pax}</dd>
              </div>
              <div>
                <dt>Bagages</dt>
                <dd className="num">{VAN.bags} valises</dd>
              </div>
              <div>
                <dt>Au kilomètre</dt>
                <dd className="num">{eur2.format(PRICING.van.perKm)}</dd>
              </div>
              <div>
                <dt>Course minimum</dt>
                <dd className="num">{eur.format(PRICING.van.minimumFare)}</dd>
              </div>
            </dl>
            <a className="btn btn-amber" href="#reserver">
              Réserver ce véhicule
            </a>
          </div>
        </div>
        <div className="fleet-visual">
          <svg className="car-draw" viewBox="0 0 410 140" role="img" aria-label="Silhouette du van">
            <ellipse cx="205" cy="128" rx="190" ry="6" fill="#000" fillOpacity=".45" />
            <path
              className="body"
              d={`${VAN_SHAPE.body} Z`}
              fill="#1B212A"
              stroke="#ECE6DA"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {VAN_SHAPE.win.map((w) => (
              <path
                key={w}
                d={w}
                fill="#E9A23B"
                fillOpacity=".14"
                stroke="#E9A23B"
                strokeOpacity=".6"
                strokeWidth="1.2"
              />
            ))}
            <line x1="40" y1="88" x2="370" y2="88" stroke="#ECE6DA" strokeOpacity=".18" />
            <path d="M370 76 L384 78" stroke="#E9A23B" strokeWidth="4" strokeLinecap="round" />
            {VAN_SHAPE.wheels.map((x) => (
              <g key={x}>
                <circle cx={x} cy="104" r="22" fill="#141920" stroke="#ECE6DA" strokeWidth="2" />
                <circle cx={x} cy="104" r="9" fill="none" stroke="#E9A23B" strokeWidth="1.5" />
              </g>
            ))}
          </svg>
          <div className="fleet-extras">
            {VAN.extras.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------- DÉROULÉ -------------------- */
function Deroule() {
  const steps = [
    ["Vous réservez", "En ligne ou par téléphone. Le prix ferme s'affiche avant la validation."],
    [
      "Confirmation par SMS",
      "La veille : nom du chauffeur, modèle du véhicule, plaque d'immatriculation.",
    ],
    [
      "Prise en charge",
      "À l'aéroport, accueil en zone arrivées avec une pancarte. Votre vol est suivi en temps réel.",
    ],
    ["Paiement", "À bord, ou en ligne par carte au moment de la réservation."],
  ];
  return (
    <section className="band">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow">Comment ça se passe</div>
            <h2>
              De la réservation
              <br />à la portière.
            </h2>
          </div>
          <p>
            Chaque étape est confirmée par écrit. Vous n'avez jamais à rappeler pour savoir où en
            est votre course.
          </p>
        </div>
        <div className="steps">
          {steps.map(([t, d], i) => (
            <div className="step" key={t}>
              <div className="step-n">{i + 1}</div>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------- SERVICES -------------------- */
function Services() {
  const services = [
    [
      "Aéroports & gares",
      `dès ${eur.format(PRICING.van.minimumFare)}`,
      "CDG, Orly, Beauvais et toutes les gares parisiennes. Suivi du vol ou du train, attente incluse, aide aux bagages.",
    ],
    [
      "Mise à disposition",
      "sur devis",
      "Un chauffeur et son véhicule pour la demi-journée ou la journée : rendez-vous successifs, shopping, visites.",
    ],
    [
      "Entreprises",
      "compte pro",
      "Plusieurs collaborateurs, une seule facture mensuelle. Accueil de vos clients et partenaires à l'aéroport.",
    ],
    [
      "Groupes & événements",
      "sur devis",
      "Jusqu'à 7 passagers par van : mariages, séminaires, navettes pour vos invités.",
    ],
  ];
  return (
    <section className="band" id="services">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow">Services</div>
            <h2>
              Un chauffeur pour
              <br />
              chaque occasion.
            </h2>
          </div>
        </div>
        <div className="services">
          {services.map(([t, from, d]) => (
            <article className="service" key={t}>
              <div className="service-top">
                <h3>{t}</h3>
                <span className="from">{from}</span>
              </div>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------- FAQ -------------------- */
function Faq() {
  const items = [
    [
      "Que se passe-t-il si mon vol a du retard ?",
      "Votre chauffeur suit votre vol et adapte l'heure de prise en charge. Le retard ne vous est pas facturé, et les 60 minutes d'attente offertes commencent à l'atterrissage réel.",
    ],
    [
      "Comment est calculé le prix ?",
      `${eur2.format(PRICING.van.perKm)} par kilomètre sur la distance routière calculée par Google Maps, avec une course minimum de ${eur.format(PRICING.van.minimumFare)}. Le prix affiché avant la réservation est celui que vous payez.`,
    ],
    [
      "Puis-je annuler ma réservation ?",
      "Oui, gratuitement jusqu'à 24 h avant la prise en charge. Au-delà, 50 % du montant est retenu.",
    ],
    [
      "Combien de bagages puis-je emporter ?",
      `Jusqu'à ${VAN.bags} valises dans le van. Pour des skis, une poussette ou un vélo, précisez-le dans les remarques.`,
    ],
    [
      "Les chauffeurs sont-ils des professionnels agréés ?",
      "Tous nos chauffeurs sont titulaires de la carte professionnelle VTC et inscrits au registre des VTC. Les véhicules sont assurés pour le transport de personnes et entretenus chaque mois.",
    ],
  ];
  return (
    <section className="band" id="faq">
      <div className="wrap faq">
        <div>
          <div className="eyebrow">Questions</div>
          <div className="section-head" style={{ marginBottom: 0 }}>
            <h2>
              Avant de
              <br />
              réserver.
            </h2>
          </div>
        </div>
        <div>
          {items.map(([q, a], i) => (
            <details key={q} open={i === 0}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------- CTA -------------------- */
function Cta() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(SITE.phoneDisplay).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => undefined,
    );
  };
  return (
    <section className="cta">
      <div className="wrap">
        <h2>
          Un départ
          <br />
          demain matin ?<br />
          <span>On s'en occupe.</span>
        </h2>
        <div className="cta-actions">
          <a className="btn btn-amber" href="#reserver">
            Estimer mon trajet
          </a>
          <div className="phone-line">
            <a className="phone-big" href={SITE.phoneHref} style={{ textDecoration: "none" }}>
              {SITE.phoneDisplay}
            </a>
            <button type="button" className="copy-btn" onClick={copy}>
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
          <span className="form-note">Réservation par téléphone 7j/7, de 6 h à 23 h</span>
        </div>
      </div>
    </section>
  );
}
