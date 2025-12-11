/**
 * SafeGo Phase 1B: Routing Service
 * Provides ETA and route calculation with pluggable providers
 */

import { getDispatchFeatureConfig } from '../config/dispatchFeatures';

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  polyline?: string;
  provider: 'google' | 'haversine';
}

export interface RouteRequest {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  countryCode?: string;
  serviceType?: 'ride' | 'food' | 'parcel';
}

const EARTH_RADIUS_METERS = 6371000;
const DEFAULT_SPEED_MPS = 8.94; // ~20 mph average urban speed

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return EARTH_RADIUS_METERS * c;
}

async function getRouteFromGoogle(request: RouteRequest): Promise<RouteResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn('[RoutingService] Google Maps API key not configured');
    return null;
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.set('origin', `${request.originLat},${request.originLng}`);
    url.searchParams.set('destination', `${request.destLat},${request.destLng}`);
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('departure_time', 'now');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' || !data.routes?.[0]?.legs?.[0]) {
      console.warn('[RoutingService] Google Maps returned non-OK status:', data.status);
      return null;
    }

    const leg = data.routes[0].legs[0];
    const durationInTraffic = leg.duration_in_traffic?.value || leg.duration?.value;

    return {
      distanceMeters: leg.distance.value,
      durationSeconds: durationInTraffic,
      polyline: data.routes[0].overview_polyline?.points,
      provider: 'google',
    };
  } catch (error) {
    console.error('[RoutingService] Google Maps API error:', error);
    return null;
  }
}

function getRouteFromHaversine(request: RouteRequest): RouteResult {
  const distance = haversineDistance(
    request.originLat,
    request.originLng,
    request.destLat,
    request.destLng
  );

  const roadDistanceMultiplier = 1.3;
  const adjustedDistance = distance * roadDistanceMultiplier;

  let speedMps = DEFAULT_SPEED_MPS;
  if (request.serviceType === 'food') {
    speedMps = 6.7; // ~15 mph for food delivery (urban areas)
  } else if (request.serviceType === 'parcel') {
    speedMps = 8.0; // ~18 mph for parcel delivery
  }

  const durationSeconds = Math.ceil(adjustedDistance / speedMps);

  return {
    distanceMeters: Math.round(adjustedDistance),
    durationSeconds,
    provider: 'haversine',
  };
}

class RoutingService {
  private etaCache = new Map<string, { result: RouteResult; timestamp: number }>();
  private readonly CACHE_TTL_MS = 30000; // 30 seconds

  private getCacheKey(request: RouteRequest): string {
    return `${request.originLat.toFixed(4)},${request.originLng.toFixed(4)}-${request.destLat.toFixed(4)},${request.destLng.toFixed(4)}`;
  }

  async getRouteAndEta(request: RouteRequest): Promise<RouteResult> {
    const config = getDispatchFeatureConfig();
    
    if (config.demoMode.enabled && config.demoMode.mockEtaSeconds > 0) {
      const mockDistance = haversineDistance(
        request.originLat,
        request.originLng,
        request.destLat,
        request.destLng
      );
      return {
        distanceMeters: Math.round(mockDistance * 1.3),
        durationSeconds: config.demoMode.mockEtaSeconds,
        provider: 'haversine',
      };
    }

    if (!config.etaCalculation.enabled) {
      return getRouteFromHaversine(request);
    }

    const cacheKey = this.getCacheKey(request);
    const cached = this.etaCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.result;
    }

    let result: RouteResult;

    if (config.etaCalculation.provider === 'google') {
      const googleResult = await getRouteFromGoogle(request);
      result = googleResult || getRouteFromHaversine(request);
    } else if (config.etaCalculation.provider === 'haversine') {
      result = getRouteFromHaversine(request);
    } else {
      const googleResult = await getRouteFromGoogle(request);
      result = googleResult || getRouteFromHaversine(request);
    }

    this.etaCache.set(cacheKey, { result, timestamp: Date.now() });
    return result;
  }

  calculateDistanceBetweenPoints(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    return haversineDistance(lat1, lng1, lat2, lng2);
  }

  shouldRecalculateEta(
    previousLat: number | null,
    previousLng: number | null,
    currentLat: number,
    currentLng: number
  ): boolean {
    if (previousLat === null || previousLng === null) {
      return true;
    }

    const config = getDispatchFeatureConfig();
    const distance = haversineDistance(previousLat, previousLng, currentLat, currentLng);
    
    return distance >= config.etaCalculation.minDistanceChangeMeters;
  }

  clearCache(): void {
    this.etaCache.clear();
  }
}

export const routingService = new RoutingService();
