"use client";

// Champ adresse avec autocomplétion Google Places.
// Sans clé NEXT_PUBLIC_GOOGLE_MAPS_API_KEY : champs manuels (adresse, CP, ville).
import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
    __placesReady?: () => void;
  }
}

export type AddressValue = { address: string; postalCode: string; city: string };

let scriptLoading = false;

function loadPlaces(onReady: () => void) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return;
  if (window.google?.maps?.places) return onReady();
  window.__placesReady = onReady;
  if (scriptLoading) return;
  scriptLoading = true;
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=__placesReady&language=fr&region=FR`;
  script.async = true;
  document.head.appendChild(script);
}

export default function AddressAutocomplete({
  value,
  onChange,
}: {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [placesActive, setPlacesActive] = useState(false);
  const hasKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

  useEffect(() => {
    if (!hasKey || !inputRef.current) return;
    loadPlaces(() => {
      if (!inputRef.current || !window.google?.maps?.places) return;
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: "fr" },
        fields: ["address_components", "formatted_address"],
        types: ["address"],
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const comps: any[] = place.address_components ?? [];
        const get = (type: string) =>
          comps.find((c) => c.types.includes(type))?.long_name ?? "";
        const streetNumber = get("street_number");
        const route = get("route");
        onChange({
          address: [streetNumber, route].filter(Boolean).join(" ") || place.formatted_address || "",
          postalCode: get("postal_code"),
          city: get("locality") || get("postal_town"),
        });
      });
      setPlacesActive(true);
    });
  }, [hasKey, onChange]);

  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor="address">
          Adresse du chantier *
        </label>
        <input
          ref={inputRef}
          id="address"
          className="input"
          placeholder="12 rue des Lilas…"
          autoComplete="street-address"
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="postalCode">
            Code postal *
          </label>
          <input
            id="postalCode"
            className="input"
            placeholder="44000"
            inputMode="numeric"
            pattern="\d{5}"
            maxLength={5}
            autoComplete="postal-code"
            value={value.postalCode}
            onChange={(e) =>
              onChange({ ...value, postalCode: e.target.value.replace(/\D/g, "") })
            }
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="city">
            Ville
          </label>
          <input
            id="city"
            className="input"
            placeholder="Nantes"
            autoComplete="address-level2"
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
          />
        </div>
      </div>
      {placesActive && (
        <p className="text-xs text-leaf-800/60">
          Commencez à taper : les suggestions Google complètent le code postal et la ville.
        </p>
      )}
    </div>
  );
}
