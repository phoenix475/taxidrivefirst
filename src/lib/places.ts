// Auto-complétion d'adresse via l'API Google Maps (librairie Places),
// chargée par balise <script> — pas de paquet npm nécessaire.
// On évite le paquet @types/google.maps (pas de nouvelle dépendance) :
// le SDK Google est donc typé `any` ici, volontairement.
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    google?: any;
  }
}

let loadPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps?.places) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Impossible de charger Google Maps."));
    document.head.appendChild(script);
  });

  return loadPromise;
}

export type SelectedPlace = {
  formattedAddress: string;
  lat: number;
  lng: number;
};

/**
 * Branche l'auto-complétion Google Places sur un <input>.
 * Appelle `onSelect` avec l'adresse formatée et ses coordonnées dès qu'une
 * suggestion est choisie. Restreint aux adresses françaises.
 */
export function useAddressAutocomplete(
  inputRef: React.RefObject<HTMLInputElement | null>,
  onSelect: (place: SelectedPlace) => void,
) {
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
    if (!apiKey || !inputRef.current) return;

    let autocomplete: any;
    let listener: any;
    let cancelled = false;

    loadGoogleMaps(apiKey).then(() => {
      if (cancelled || !inputRef.current) return;
      autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        fields: ["formatted_address", "geometry", "name"],
        componentRestrictions: { country: "fr" },
      });
      listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete!.getPlace();
        const location = place.geometry?.location;
        if (!place.formatted_address || !location) return;
        // Pour un lieu nommé (aéroport, gare, hôpital…), Google ne renvoie souvent
        // que la rue et la ville : on préfixe par le nom pour garder l'info.
        const name: string | undefined = place.name;
        const formattedAddress =
          name && !place.formatted_address.includes(name)
            ? `${name}, ${place.formatted_address}`
            : place.formatted_address;
        onSelectRef.current({
          formattedAddress,
          lat: location.lat(),
          lng: location.lng(),
        });
      });
    });

    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, [inputRef]);
}
