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

// Client-side reverse geocoding using Google Maps Geocoder
export async function clientReverseGeocode(lat: number, lng: number): Promise<{
  address: string;
  placeId: string;
  addressComponents: Record<string, string>;
} | null> {
  // Wait for SDK to be loaded
  await loadGoogleMapsSDK();
  
  if (!window.google?.maps) {
    console.error("[GoogleMaps] SDK not available for reverse geocoding");
    return null;
  }

  return new Promise((resolve) => {
    const geocoder = new window.google.maps.Geocoder();
    const latlng = { lat, lng };

    geocoder.geocode({ location: latlng }, (results, status) => {
      console.log("[GoogleMaps] Reverse geocode status:", status);
      
      if (status !== "OK" || !results || results.length === 0) {
        console.warn("[GoogleMaps] Reverse geocode failed:", status);
        resolve(null);
        return;
      }

      const result = results[0];
      
      // Parse address components
      const components: Record<string, string> = {};
      (result.address_components || []).forEach((comp) => {
        if (comp.types.includes("street_number")) components.streetNumber = comp.long_name;
        if (comp.types.includes("route")) components.street = comp.long_name;
        if (comp.types.includes("locality")) components.city = comp.long_name;
        if (comp.types.includes("administrative_area_level_1")) {
          components.state = comp.short_name;
          components.stateLong = comp.long_name;
        }
        if (comp.types.includes("postal_code")) components.postalCode = comp.long_name;
        if (comp.types.includes("country")) {
          components.country = comp.short_name;
          components.countryLong = comp.long_name;
        }
      });

      console.log("[GoogleMaps] Reverse geocode result:", result.formatted_address);
      
      resolve({
        address: result.formatted_address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        placeId: result.place_id || "",
        addressComponents: components,
      });
    });
  });
}

// Client-side directions using DirectionsService
export async function clientGetDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{
  distanceMiles: number;
  durationMinutes: number;
  distanceText: string;
  durationText: string;
  polyline: string;
  startAddress: string;
  endAddress: string;
  rawDistanceMeters: number;
  rawDurationSeconds: number;
} | null> {
  await loadGoogleMapsSDK();
  
  if (!window.google?.maps) {
    console.error("[GoogleMaps] SDK not available for directions");
    return null;
  }

  return new Promise((resolve) => {
    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route(
      {
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(destination.lat, destination.lng),
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        console.log("[GoogleMaps] Directions status:", status);
        
        if (status !== "OK" || !result || !result.routes?.[0]?.legs?.[0]) {
          console.warn("[GoogleMaps] Directions failed:", status);
          resolve(null);
          return;
        }

        const leg = result.routes[0].legs[0];
        const distanceMeters = leg.distance?.value || 0;
        const durationSeconds = leg.duration?.value || 0;
        const distanceMiles = Math.round((distanceMeters / 1609.344) * 10) / 10;
        const durationMinutes = Math.ceil(durationSeconds / 60);

        resolve({
          distanceMiles,
          durationMinutes,
          distanceText: leg.distance?.text || `${distanceMiles} mi`,
          durationText: leg.duration?.text || `${durationMinutes} min`,
          polyline: result.routes[0].overview_polyline || "",
          startAddress: leg.start_address || "",
          endAddress: leg.end_address || "",
          rawDistanceMeters: distanceMeters,
          rawDurationSeconds: durationSeconds,
        });
      }
    );
  });
}

// Ensure SDK is loaded
export async function ensureGoogleMapsLoaded(): Promise<boolean> {
  try {
    await loadGoogleMapsSDK();
    return true;
  } catch (error) {
    console.error("[GoogleMaps] Failed to ensure SDK is loaded:", error);
    return false;
  }
}

// Check if SDK is available
export function isGoogleMapsAvailable(): boolean {
  return isLoaded && !!window.google?.maps?.places;
}
