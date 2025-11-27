export interface SearchResult {
  placeId: string;
  address: string;
  name?: string;
  lat: number;
  lng: number;
  type?: string;
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

function isClient(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export async function searchLocations(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  if (!query || query.length < 3) return [];
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&addressdetails=1`,
      { 
        headers: { "Accept-Language": "en" },
        signal 
      }
    );
    
    if (!response.ok) throw new Error("Search failed");
    
    const data = await response.json();
    
    return data.map((item: any) => ({
      placeId: item.place_id?.toString() || crypto.randomUUID(),
      address: item.display_name,
      name: item.name || undefined,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type,
    }));
  } catch (error: any) {
    if (error.name === "AbortError") return [];
    console.error("Location search error:", error);
    return [];
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    
    if (!response.ok) throw new Error("Reverse geocode failed");
    
    const data = await response.json();
    return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch (error) {
    console.error("Reverse geocode error:", error);
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
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
