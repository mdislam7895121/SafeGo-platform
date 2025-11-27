/// <reference types="@types/google.maps" />
import { useState, useEffect, useRef } from "react";

declare global {
  interface Window {
    google: typeof google;
    initGoogleMapsCallback: () => void;
  }
}

interface GoogleMapsConfig {
  apiKey: string;
  libraries: string[];
}

interface UseGoogleMapsResult {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  google: typeof google | null;
}

let googleMapsPromise: Promise<void> | null = null;
let isGoogleMapsLoaded = false;

async function fetchMapsConfig(): Promise<GoogleMapsConfig | null> {
  try {
    const response = await fetch("/api/maps/config");
    if (!response.ok) {
      throw new Error("Failed to fetch maps config");
    }
    return response.json();
  } catch (error) {
    console.error("Error fetching maps config:", error);
    return null;
  }
}

function loadGoogleMapsScript(apiKey: string, libraries: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isGoogleMapsLoaded && window.google?.maps) {
      resolve();
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      if (window.google?.maps) {
        isGoogleMapsLoaded = true;
        resolve();
      } else {
        window.initGoogleMapsCallback = () => {
          isGoogleMapsLoaded = true;
          resolve();
        };
      }
      return;
    }

    window.initGoogleMapsCallback = () => {
      isGoogleMapsLoaded = true;
      resolve();
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${libraries.join(",")}&callback=initGoogleMapsCallback`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      reject(new Error("Failed to load Google Maps script"));
    };

    document.head.appendChild(script);
  });
}

export function useGoogleMaps(): UseGoogleMapsResult {
  const [isLoaded, setIsLoaded] = useState(isGoogleMapsLoaded);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    if (isGoogleMapsLoaded && window.google?.maps) {
      setIsLoaded(true);
      return;
    }

    if (googleMapsPromise) {
      googleMapsPromise
        .then(() => {
          setIsLoaded(true);
        })
        .catch((err) => {
          setError(err.message);
        });
      return;
    }

    setIsLoading(true);

    googleMapsPromise = (async () => {
      const config = await fetchMapsConfig();
      if (!config) {
        throw new Error("Maps configuration not available");
      }
      await loadGoogleMapsScript(config.apiKey, config.libraries);
    })();

    googleMapsPromise
      .then(() => {
        setIsLoaded(true);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  return {
    isLoaded,
    isLoading,
    error,
    google: isLoaded ? window.google : null,
  };
}

interface UsePlacesAutocompleteOptions {
  inputRef: React.RefObject<HTMLInputElement>;
  onPlaceSelect: (place: {
    address: string;
    lat: number;
    lng: number;
    placeId: string;
    addressComponents?: {
      streetNumber?: string;
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  }) => void;
  options?: google.maps.places.AutocompleteOptions;
}

export function usePlacesAutocomplete({
  inputRef,
  onPlaceSelect,
  options = {},
}: UsePlacesAutocompleteOptions) {
  const { isLoaded, error } = useGoogleMaps();
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const listenerRef = useRef<google.maps.MapsEventListener | null>(null);

  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    const defaultOptions: google.maps.places.AutocompleteOptions = {
      fields: ["formatted_address", "geometry", "place_id", "address_components"],
      componentRestrictions: { country: "us" },
      ...options,
    };

    const autocomplete = new window.google.maps.places.Autocomplete(
      inputRef.current,
      defaultOptions
    );

    autocompleteRef.current = autocomplete;

    listenerRef.current = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();

      if (!place.geometry?.location) {
        console.warn("No geometry for selected place");
        return;
      }

      const addressComponents: {
        streetNumber?: string;
        street?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      } = {};

      place.address_components?.forEach((component) => {
        const types = component.types;
        if (types.includes("street_number")) {
          addressComponents.streetNumber = component.long_name;
        }
        if (types.includes("route")) {
          addressComponents.street = component.long_name;
        }
        if (types.includes("locality")) {
          addressComponents.city = component.long_name;
        }
        if (types.includes("administrative_area_level_1")) {
          addressComponents.state = component.short_name;
        }
        if (types.includes("postal_code")) {
          addressComponents.postalCode = component.long_name;
        }
        if (types.includes("country")) {
          addressComponents.country = component.short_name;
        }
      });

      onPlaceSelect({
        address: place.formatted_address || "",
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        placeId: place.place_id || "",
        addressComponents,
      });
    });

    return () => {
      if (listenerRef.current) {
        window.google.maps.event.removeListener(listenerRef.current);
        listenerRef.current = null;
      }
    };
  }, [isLoaded, inputRef, onPlaceSelect, options]);

  return {
    isLoaded,
    error,
    autocomplete: autocompleteRef.current,
  };
}
