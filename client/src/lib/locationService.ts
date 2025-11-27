import { apiRequest } from "./queryClient";

export interface SearchResult {
  placeId: string;
  address: string;
  name?: string;
  mainText?: string;
  secondaryText?: string;
  lat: number;
  lng: number;
  type?: string;
}

export interface PlaceDetails {
  placeId: string;
  name?: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  addressComponents: {
    streetNumber?: string;
    street?: string;
    city?: string;
    state?: string;
    stateLong?: string;
    postalCode?: string;
    country?: string;
    countryLong?: string;
  };
}

export interface RouteInfo {
  distanceMiles: number;
  durationMinutes: number;
  distanceText: string;
  durationText: string;
  polyline: string;
  startAddress: string;
  endAddress: string;
  rawDistanceMeters: number;
  rawDurationSeconds: number;
  providerSource: string;
}

export interface SavedPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  icon: "home" | "work" | "star";
  createdAt: string;
}

export interface RecentLocation {
  id: string;
  address: string;
  lat: number;
  lng: number;
  timestamp: string;
}

const SAVED_PLACES_KEY = "safego_saved_places";
const RECENT_LOCATIONS_KEY = "safego_recent_locations";
const MAX_RECENT_LOCATIONS = 10;

// Session token for Google Places API billing optimization
let currentSessionToken: string | null = null;

function isClient(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

// Search locations using Google Places Autocomplete via backend proxy
export async function searchLocations(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];
  
  try {
    const response = await fetch("/api/maps/autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: query }),
      credentials: "include",
      signal,
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        console.warn("Location search requires authentication");
        return [];
      }
      throw new Error("Search failed");
    }
    
    const data = await response.json();
    currentSessionToken = data.sessionToken;
    
    // Return predictions without coordinates (need place-details for coords)
    return (data.predictions || []).map((p: any) => ({
      placeId: p.placeId,
      address: p.description,
      name: p.mainText,
      mainText: p.mainText,
      secondaryText: p.secondaryText,
      lat: 0, // Will be fetched from place-details
      lng: 0,
      type: p.types?.[0],
    }));
  } catch (error: any) {
    if (error.name === "AbortError") return [];
    console.error("Location search error:", error);
    return [];
  }
}

// Get full place details including coordinates
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  try {
    const response = await fetch("/api/maps/place-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        placeId, 
        sessionToken: currentSessionToken 
      }),
      credentials: "include",
    });
    
    if (!response.ok) {
      throw new Error("Failed to get place details");
    }
    
    const data = await response.json();
    currentSessionToken = null; // Clear after place selection
    
    return {
      placeId: data.placeId,
      name: data.name,
      formattedAddress: data.formattedAddress,
      lat: data.lat,
      lng: data.lng,
      addressComponents: data.addressComponents || {},
    };
  } catch (error) {
    console.error("Place details error:", error);
    return null;
  }
}

// Reverse geocode using Google Geocoding API via backend proxy
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch("/api/maps/reverse-geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
      credentials: "include",
    });
    
    if (!response.ok) {
      throw new Error("Reverse geocode failed");
    }
    
    const data = await response.json();
    return data.formattedAddress || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch (error) {
    console.error("Reverse geocode error:", error);
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}

// Get reverse geocode with full details
export async function reverseGeocodeDetails(lat: number, lng: number): Promise<PlaceDetails | null> {
  try {
    const response = await fetch("/api/maps/reverse-geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
      credentials: "include",
    });
    
    if (!response.ok) {
      throw new Error("Reverse geocode failed");
    }
    
    const data = await response.json();
    return {
      placeId: data.placeId || "",
      formattedAddress: data.formattedAddress || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      lat,
      lng,
      addressComponents: data.addressComponents || {},
    };
  } catch (error) {
    console.error("Reverse geocode error:", error);
    return null;
  }
}

// Get route directions with distance, duration, and polyline
export async function getRouteDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<RouteInfo | null> {
  try {
    const response = await fetch("/api/maps/directions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin, destination }),
      credentials: "include",
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn("No route found between locations");
        return null;
      }
      throw new Error("Failed to get directions");
    }
    
    const data = await response.json();
    return {
      distanceMiles: data.distanceMiles,
      durationMinutes: data.durationMinutes,
      distanceText: data.distanceText,
      durationText: data.durationText,
      polyline: data.polyline,
      startAddress: data.startAddress,
      endAddress: data.endAddress,
      rawDistanceMeters: data.rawDistanceMeters,
      rawDurationSeconds: data.rawDurationSeconds,
      providerSource: data.providerSource,
    };
  } catch (error) {
    console.error("Directions error:", error);
    return null;
  }
}

// Decode Google's encoded polyline format into array of [lat, lng] coordinates
export function decodePolyline(encoded: string): [number, number][] {
  if (!encoded) return [];
  
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    coords.push([lat / 1e5, lng / 1e5]);
  }

  return coords;
}

// Calculate simple distance (Haversine formula) - fallback for when Google API is unavailable
export function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): { distanceMiles: number; durationMinutes: number } {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMiles = Math.round(R * c * 1.3 * 10) / 10; // 1.3 factor for road distance
  const avgSpeedMph = 25;
  const durationMinutes = Math.max(1, Math.ceil((distanceMiles / avgSpeedMph) * 60));
  return { distanceMiles, durationMinutes };
}

export function getSavedPlaces(): SavedPlace[] {
  if (!isClient()) return getDefaultSavedPlaces();
  try {
    const stored = localStorage.getItem(SAVED_PLACES_KEY);
    return stored ? JSON.parse(stored) : getDefaultSavedPlaces();
  } catch {
    return getDefaultSavedPlaces();
  }
}

export function getDefaultSavedPlaces(): SavedPlace[] {
  return [
    {
      id: "home",
      name: "Home",
      address: "Add home address",
      lat: 0,
      lng: 0,
      icon: "home",
      createdAt: new Date().toISOString(),
    },
    {
      id: "work",
      name: "Work",
      address: "Add work address",
      lat: 0,
      lng: 0,
      icon: "work",
      createdAt: new Date().toISOString(),
    },
  ];
}

export function saveSavedPlace(place: SavedPlace): void {
  if (!isClient()) return;
  try {
    const places = getSavedPlaces();
    const existingIndex = places.findIndex(p => p.id === place.id);
    
    if (existingIndex >= 0) {
      places[existingIndex] = place;
    } else {
      places.push(place);
    }
    
    localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(places));
  } catch (error) {
    console.error("Failed to save place:", error);
  }
}

export function deleteSavedPlace(id: string): void {
  if (!isClient()) return;
  try {
    const places = getSavedPlaces().filter(p => p.id !== id);
    localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(places));
  } catch (error) {
    console.error("Failed to delete place:", error);
  }
}

export function getRecentLocations(): RecentLocation[] {
  if (!isClient()) return [];
  try {
    const stored = localStorage.getItem(RECENT_LOCATIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addRecentLocation(location: Omit<RecentLocation, "id" | "timestamp">): void {
  if (!isClient()) return;
  try {
    const recent = getRecentLocations();
    
    const existingIndex = recent.findIndex(
      r => Math.abs(r.lat - location.lat) < 0.0001 && Math.abs(r.lng - location.lng) < 0.0001
    );
    
    if (existingIndex >= 0) {
      recent.splice(existingIndex, 1);
    }
    
    const newLocation: RecentLocation = {
      id: crypto.randomUUID(),
      ...location,
      timestamp: new Date().toISOString(),
    };
    
    recent.unshift(newLocation);
    
    const trimmed = recent.slice(0, MAX_RECENT_LOCATIONS);
    localStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error("Failed to add recent location:", error);
  }
}

export function clearRecentLocations(): void {
  if (!isClient()) return;
  try {
    localStorage.removeItem(RECENT_LOCATIONS_KEY);
  } catch (error) {
    console.error("Failed to clear recent locations:", error);
  }
}

export function calculateRouteInfo(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number
): { distanceKm: number; etaMinutes: number } {
  const R = 6371;
  const dLat = ((dropoffLat - pickupLat) * Math.PI) / 180;
  const dLng = ((dropoffLng - pickupLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((pickupLat * Math.PI) / 180) *
      Math.cos((dropoffLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = Math.round(R * c * 1.3 * 10) / 10;
  const avgSpeedKmh = 30;
  const etaMinutes = Math.max(1, Math.ceil((distanceKm / avgSpeedKmh) * 60));
  return { distanceKm, etaMinutes };
}
