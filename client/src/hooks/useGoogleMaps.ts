/// <reference types="@types/google.maps" />
import { useState, useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    google: typeof google;
    initGoogleMapsCallback?: () => void;
    googleMapsLoaded?: boolean;
  }
}

let loadPromise: Promise<void> | null = null;
let isLoaded = false;

async function loadGoogleMapsSDK(): Promise<void> {
  if (isLoaded && window.google?.maps?.places) {
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise(async (resolve, reject) => {
    try {
      const response = await fetch("/api/maps/config");
      if (!response.ok) {
        throw new Error("Failed to fetch maps config");
      }
      const config = await response.json();
      const apiKey = config.apiKey;

      if (!apiKey) {
        throw new Error("No API key available");
      }

      const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
      if (existingScript) {
        if (window.google?.maps?.places) {
          isLoaded = true;
          resolve();
          return;
        }
        existingScript.remove();
      }

      window.initGoogleMapsCallback = () => {
        isLoaded = true;
        window.googleMapsLoaded = true;
        console.log("[GoogleMaps] SDK loaded successfully with Places library");
        resolve();
      };

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMapsCallback`;
      script.async = true;
      script.defer = true;
      script.onerror = (e) => {
        console.error("[GoogleMaps] Failed to load SDK:", e);
        reject(new Error("Failed to load Google Maps SDK"));
      };

      document.head.appendChild(script);
      console.log("[GoogleMaps] Loading SDK with Places library...");
    } catch (error) {
      console.error("[GoogleMaps] Error loading SDK:", error);
      reject(error);
    }
  });

  return loadPromise;
}

export function useGoogleMaps() {
  const [isReady, setIsReady] = useState(isLoaded && !!window.google?.maps?.places);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && window.google?.maps?.places) {
      setIsReady(true);
      return;
    }

    setIsLoading(true);
    loadGoogleMapsSDK()
      .then(() => {
        setIsReady(true);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  return { isReady, isLoading, error };
}

interface PlaceResult {
  address: string;
  lat: number;
  lng: number;
  placeId: string;
}

export function useGooglePlacesAutocomplete(
  inputRef: React.RefObject<HTMLInputElement>,
  onPlaceSelect: (place: PlaceResult) => void,
  options?: {
    types?: string[];
    componentRestrictions?: { country: string | string[] };
  }
) {
  const { isReady, error } = useGoogleMaps();
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const listenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const onPlaceSelectRef = useRef(onPlaceSelect);

  onPlaceSelectRef.current = onPlaceSelect;

  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || !window.google?.maps?.places) {
      return;
    }

    if (autocompleteRef.current) {
      return;
    }

    console.log("[GooglePlaces] Initializing Autocomplete widget...");

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry", "place_id", "name"],
      types: options?.types || ["geocode", "establishment"],
      componentRestrictions: options?.componentRestrictions || { country: "us" },
    });

    autocompleteRef.current = autocomplete;

    listenerRef.current = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      console.log("[GooglePlaces] Place selected:", place);

      if (!place.geometry?.location) {
        console.warn("[GooglePlaces] No geometry for selected place");
        return;
      }

      const result: PlaceResult = {
        address: place.formatted_address || place.name || "",
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        placeId: place.place_id || "",
      };

      console.log("[GooglePlaces] Calling onPlaceSelect with:", result);
      onPlaceSelectRef.current(result);
    });

    console.log("[GooglePlaces] Autocomplete initialized successfully");
  }, [inputRef, options?.types, options?.componentRestrictions]);

  useEffect(() => {
    if (isReady && inputRef.current) {
      initAutocomplete();
    }

    return () => {
      if (listenerRef.current && window.google?.maps?.event) {
        window.google.maps.event.removeListener(listenerRef.current);
        listenerRef.current = null;
      }
      autocompleteRef.current = null;
    };
  }, [isReady, initAutocomplete]);

  return { isReady, error, autocomplete: autocompleteRef.current };
}
