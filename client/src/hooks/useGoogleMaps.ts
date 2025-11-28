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

// Route alternative interface
export interface RouteAlternative {
  id: string;
  name: string;
  description: string;
  distanceMiles: number;
  durationMinutes: number;
  distanceText: string;
  durationText: string;
  polyline: string;
  rawDistanceMeters: number;
  rawDurationSeconds: number;
  trafficDurationSeconds?: number;
  trafficDurationText?: string;
  summary: string;
  warnings: string[];
  isFastest?: boolean;
  isShortest?: boolean;
  avoidsTolls?: boolean;
  avoidsHighways?: boolean;
}

// Simple hash function for strings
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Helper to deduplicate consecutive identical coordinates with tolerance
function deduplicateConsecutivePoints(points: google.maps.LatLng[], toleranceMeters = 1): google.maps.LatLng[] {
  if (points.length < 2) return points;
  
  // ~1 meter tolerance in degrees (varies by latitude, approximate for mid-latitudes)
  const tolerance = toleranceMeters / 111000;
  
  const result: google.maps.LatLng[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    if (Math.abs(prev.lat() - curr.lat()) > tolerance || 
        Math.abs(prev.lng() - curr.lng()) > tolerance) {
      result.push(curr);
    }
  }
  return result;
}

// Decode Google's encoded polyline to array of coordinates (simplified Polyline Algorithm Decoder)
function decodePolyline(encoded: string): Array<{lat: number, lng: number}> {
  if (!encoded) return [];
  
  const points: Array<{lat: number, lng: number}> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;
    
    result = 0;
    shift = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;
    
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  
  return points;
}

// Generate canonical route ID from polyline geometry hash + avoidance flags
// Uses consistent ordering based on geometry, not leg order
function generateGeometryBasedRouteId(
  type: string,
  polyline: string,
  avoidsHighways: boolean,
  avoidsTolls: boolean
): string {
  const points = decodePolyline(polyline);
  
  if (points.length === 0) {
    return `${type}-empty`;
  }
  
  // Normalize all points to 4 decimals (~11m precision)
  const normalized: Array<{lat: number, lng: number}> = [];
  let prevKey = '';
  
  for (const p of points) {
    const lat = Math.round(p.lat * 10000) / 10000;
    const lng = Math.round(p.lng * 10000) / 10000;
    const key = `${lat},${lng}`;
    
    // Skip consecutive duplicates
    if (key !== prevKey) {
      normalized.push({ lat, lng });
      prevKey = key;
    }
  }
  
  if (normalized.length === 0) {
    return `${type}-empty`;
  }
  
  // Create ORDERING-INDEPENDENT fingerprint:
  // 1. Start and end points (these define the route direction)
  // 2. Bounding box (captures route extent)
  // 3. Total path length approximation
  // 4. Avoidance flags
  
  const start = normalized[0];
  const end = normalized[normalized.length - 1];
  
  // Calculate bounding box
  let minLat = start.lat, maxLat = start.lat;
  let minLng = start.lng, maxLng = start.lng;
  let pathLength = 0;
  
  for (let i = 0; i < normalized.length; i++) {
    const p = normalized[i];
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
    
    if (i > 0) {
      const prev = normalized[i - 1];
      pathLength += Math.abs(p.lat - prev.lat) + Math.abs(p.lng - prev.lng);
    }
  }
  
  // Round path length to absorb minor variations
  const roundedLength = Math.round(pathLength * 1000);
  
  // Create deterministic fingerprint
  const avoidFlags = `H${avoidsHighways ? 1 : 0}T${avoidsTolls ? 1 : 0}`;
  const fingerprint = [
    type,
    avoidFlags,
    `S${start.lat.toFixed(4)},${start.lng.toFixed(4)}`,
    `E${end.lat.toFixed(4)},${end.lng.toFixed(4)}`,
    `B${minLat.toFixed(3)},${maxLat.toFixed(3)},${minLng.toFixed(3)},${maxLng.toFixed(3)}`,
    `L${roundedLength}`,
    `N${normalized.length}`
  ].join('|');
  
  return `${type}-${simpleHash(fingerprint)}`;
}

// Assemble validated polyline from legs with STRICT continuity enforcement
// Returns failure if segments are discontinuous (no synthetic bridges)
function assembleValidatedPolylineFromLegs(
  legs: google.maps.DirectionsLeg[],
  toleranceMeters = 15
): { polyline: string; valid: boolean; error?: string } {
  if (!legs || legs.length === 0) {
    return { polyline: '', valid: false, error: 'No legs provided' };
  }
  
  const allPoints: google.maps.LatLng[] = [];
  let prevEndLat: number | null = null;
  let prevEndLng: number | null = null;
  const tolerance = toleranceMeters / 111000; // Convert meters to degrees
  
  for (let legIdx = 0; legIdx < legs.length; legIdx++) {
    const leg = legs[legIdx];
    const steps = leg.steps || [];
    
    for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
      const step = steps[stepIdx];
      
      if (step.path && step.path.length > 0) {
        // STRICT continuity check: fail if gap exceeds tolerance
        const firstPoint = step.path[0];
        if (prevEndLat !== null && prevEndLng !== null) {
          const gap = Math.sqrt(
            Math.pow(firstPoint.lat() - prevEndLat, 2) + 
            Math.pow(firstPoint.lng() - prevEndLng, 2)
          );
          if (gap > tolerance) {
            const gapMeters = Math.round(gap * 111000);
            return { 
              polyline: '', 
              valid: false, 
              error: `Discontinuity in leg ${legIdx}, step ${stepIdx}: ${gapMeters}m gap exceeds ${toleranceMeters}m tolerance` 
            };
          }
        }
        
        // Add all points from this step
        allPoints.push(...step.path);
        
        // Update previous end position
        const lastPoint = step.path[step.path.length - 1];
        prevEndLat = lastPoint.lat();
        prevEndLng = lastPoint.lng();
      } else if (step.start_location && step.end_location) {
        // No path available, use start/end locations with continuity check
        if (prevEndLat !== null && prevEndLng !== null) {
          const gap = Math.sqrt(
            Math.pow(step.start_location.lat() - prevEndLat, 2) + 
            Math.pow(step.start_location.lng() - prevEndLng, 2)
          );
          if (gap > tolerance) {
            const gapMeters = Math.round(gap * 111000);
            return { 
              polyline: '', 
              valid: false, 
              error: `Discontinuity at step ${stepIdx} start: ${gapMeters}m gap` 
            };
          }
        }
        allPoints.push(step.start_location);
        allPoints.push(step.end_location);
        prevEndLat = step.end_location.lat();
        prevEndLng = step.end_location.lng();
      }
    }
  }
  
  if (allPoints.length < 2) {
    return { polyline: '', valid: false, error: 'Insufficient points for valid polyline' };
  }
  
  // Deduplicate consecutive points
  const dedupedPoints = deduplicateConsecutivePoints(allPoints, 1);
  
  if (dedupedPoints.length < 2) {
    return { polyline: '', valid: false, error: 'All points collapsed to single location' };
  }
  
  // Encode the validated path
  if (window.google?.maps?.geometry?.encoding) {
    const encoded = window.google.maps.geometry.encoding.encodePath(dedupedPoints);
    return { polyline: encoded, valid: true };
  }
  
  return { polyline: '', valid: false, error: 'Geometry encoding unavailable' };
}

// Helper function to extract encoded polyline string from Google Directions result
function extractPolylineString(route: google.maps.DirectionsRoute): string {
  try {
    // Primary: overview_polyline from Google (most reliable)
    const overviewPolyline = route.overview_polyline as any;
    
    if (typeof overviewPolyline === "string" && overviewPolyline.length > 0) {
      return overviewPolyline;
    }
    
    if (overviewPolyline?.points && overviewPolyline.points.length > 0) {
      return overviewPolyline.points;
    }
    
    if (typeof overviewPolyline?.getEncodedPath === "function") {
      const encoded = overviewPolyline.getEncodedPath();
      if (encoded && encoded.length > 0) {
        return encoded;
      }
    }
    
    // Secondary: overview_path array if available
    if (route.overview_path && route.overview_path.length > 0) {
      const dedupedPath = deduplicateConsecutivePoints(route.overview_path);
      if (dedupedPath.length >= 2 && window.google?.maps?.geometry?.encoding) {
        return window.google.maps.geometry.encoding.encodePath(dedupedPath);
      }
    }
    
    // Tertiary: Use validated leg assembly with continuity checks
    // On failure, gracefully fall back to simpler extraction methods
    if (route.legs && route.legs.length > 0) {
      const assembled = assembleValidatedPolylineFromLegs(route.legs);
      if (assembled.valid && assembled.polyline.length > 0) {
        return assembled.polyline;
      }
      // Log but don't fail - try fallback methods
      if (!assembled.valid) {
        console.info(`[GoogleMaps] Validated assembly skipped (${assembled.error}), using fallback`);
      }
    }
    
    // Final fallback: Use leg start/end points if we have complete coverage
    // Only use this if we have ALL leg endpoints to avoid truncated routes
    if (route.legs && route.legs.length > 0) {
      const legPoints: google.maps.LatLng[] = [];
      let hasAllEndpoints = true;
      
      for (const leg of route.legs) {
        if (!leg.start_location || !leg.end_location) {
          hasAllEndpoints = false;
          break;
        }
        legPoints.push(leg.start_location);
        legPoints.push(leg.end_location);
      }
      
      if (hasAllEndpoints && legPoints.length >= 2) {
        const dedupedLegPoints = deduplicateConsecutivePoints(legPoints);
        if (dedupedLegPoints.length >= 2 && window.google?.maps?.geometry?.encoding) {
          console.info("[GoogleMaps] Using leg endpoints fallback for polyline");
          return window.google.maps.geometry.encoding.encodePath(dedupedLegPoints);
        }
      }
    }
    
    // Return empty string - route will be filtered out rather than showing truncated
    console.warn("[GoogleMaps] Could not extract valid polyline from route - route will be skipped");
    return "";
  } catch (error) {
    console.warn("[GoogleMaps] Failed to extract polyline:", error);
    return "";
  }
}

// Client-side get route alternatives (up to 3 routes)
export async function clientGetRouteAlternatives(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<RouteAlternative[]> {
  await loadGoogleMapsSDK();
  
  if (!window.google?.maps) {
    console.error("[GoogleMaps] SDK not available for route alternatives");
    return [];
  }

  const directionsService = new window.google.maps.DirectionsService();
  
  // Helper to make a directions request
  const makeRequest = (options: google.maps.DirectionsRequest): Promise<google.maps.DirectionsResult | null> => {
    return new Promise((resolve) => {
      directionsService.route(options, (result, status) => {
        if (status === "OK" && result) {
          resolve(result);
        } else {
          resolve(null);
        }
      });
    });
  };

  // Make parallel requests for different route preferences
  const originLatLng = new window.google.maps.LatLng(origin.lat, origin.lng);
  const destinationLatLng = new window.google.maps.LatLng(destination.lat, destination.lng);

  const [standardResult, avoidHighwaysResult, avoidTollsResult] = await Promise.all([
    // Standard routes with alternatives
    makeRequest({
      origin: originLatLng,
      destination: destinationLatLng,
      travelMode: window.google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: true,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
      },
    }),
    // Avoid highways
    makeRequest({
      origin: originLatLng,
      destination: destinationLatLng,
      travelMode: window.google.maps.TravelMode.DRIVING,
      avoidHighways: true,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
      },
    }),
    // Avoid tolls
    makeRequest({
      origin: originLatLng,
      destination: destinationLatLng,
      travelMode: window.google.maps.TravelMode.DRIVING,
      avoidTolls: true,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
      },
    }),
  ]);

  // Collect all raw routes first
  interface RawRoute {
    route: google.maps.DirectionsRoute;
    type: "standard" | "avoid-highways" | "avoid-tolls";
    index: number;
  }
  const rawRoutes: RawRoute[] = [];

  if (standardResult?.routes) {
    standardResult.routes.forEach((route, index) => {
      rawRoutes.push({ route, type: "standard", index });
    });
  }

  if (avoidHighwaysResult?.routes?.[0]) {
    rawRoutes.push({ route: avoidHighwaysResult.routes[0], type: "avoid-highways", index: 0 });
  }

  if (avoidTollsResult?.routes?.[0]) {
    rawRoutes.push({ route: avoidTollsResult.routes[0], type: "avoid-tolls", index: 0 });
  }

  // Deduplicate by polyline first
  const seenPolylines = new Set<string>();
  const uniqueRawRoutes: RawRoute[] = [];

  for (const rawRoute of rawRoutes) {
    const polylineStr = extractPolylineString(rawRoute.route);
    if (polylineStr && !seenPolylines.has(polylineStr)) {
      seenPolylines.add(polylineStr);
      uniqueRawRoutes.push(rawRoute);
    }
  }

  // Convert to RouteAlternative objects
  const routes: RouteAlternative[] = [];
  
  for (let idx = 0; idx < uniqueRawRoutes.length; idx++) {
    const rawRoute = uniqueRawRoutes[idx];
    const { route, type, index } = rawRoute;
    const leg = route.legs?.[0];
    if (!leg) continue;

    const polylineStr = extractPolylineString(route);
    const distanceMeters = leg.distance?.value || 0;
    const durationSeconds = leg.duration?.value || 0;
    const trafficDurationSeconds = leg.duration_in_traffic?.value;

    let name: string;
    let description: string;
    
    if (type === "avoid-highways") {
      name = "Avoid Highways";
      description = "Uses local roads only";
    } else if (type === "avoid-tolls") {
      name = "Avoid Tolls";
      description = "No toll roads";
    } else {
      name = index === 0 ? "Recommended" : `Alternative ${index}`;
      description = route.summary || "Via main roads";
    }

    // Create a geometry-based stable ID using sampled polyline points
    // This ensures routes with same physical path get same ID regardless of metadata changes
    const stableId = generateGeometryBasedRouteId(
      type, 
      polylineStr,
      type === "avoid-highways", 
      type === "avoid-tolls"
    );

    routes.push({
      id: stableId,
      name,
      description,
      distanceMiles: Math.round((distanceMeters / 1609.344) * 10) / 10,
      durationMinutes: Math.ceil(durationSeconds / 60),
      distanceText: leg.distance?.text || "",
      durationText: leg.duration?.text || "",
      polyline: polylineStr,
      rawDistanceMeters: distanceMeters,
      rawDurationSeconds: durationSeconds,
      trafficDurationSeconds,
      trafficDurationText: leg.duration_in_traffic?.text,
      summary: route.summary || "",
      warnings: route.warnings || [],
      avoidsHighways: type === "avoid-highways",
      avoidsTolls: type === "avoid-tolls",
    });
  }

  // Mark fastest and shortest routes AFTER deduplication
  if (routes.length > 0) {
    // Mark fastest (by duration)
    const fastestRoute = routes.reduce((prev, curr) => 
      curr.rawDurationSeconds < prev.rawDurationSeconds ? curr : prev
    );
    fastestRoute.isFastest = true;

    // Mark shortest (by distance) if different from fastest
    if (routes.length > 1) {
      const shortestRoute = routes.reduce((prev, curr) => 
        curr.rawDistanceMeters < prev.rawDistanceMeters ? curr : prev
      );
      if (shortestRoute.id !== fastestRoute.id) {
        shortestRoute.isShortest = true;
      }
    }
  }

  console.log(`[GoogleMaps] Found ${routes.length} unique route alternatives`);
  return routes.slice(0, 3); // Return max 3 routes
}
