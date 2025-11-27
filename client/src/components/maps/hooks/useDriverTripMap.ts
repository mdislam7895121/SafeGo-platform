import { useState, useCallback, useRef, useEffect } from "react";
import * as turf from "@turf/turf";

export interface MapLocation {
  lat: number;
  lng: number;
  label?: string;
  heading?: number;
}

export type FocusMode = "full-route" | "driver" | "pickup" | "dropoff";
export type ActiveLeg = "to_pickup" | "to_dropoff" | "completed";

interface RouteInfo {
  coordinates: [number, number][];
  distanceKm: number;
  etaMinutes: number;
}

interface UseDriverTripMapOptions {
  onDistanceUpdate?: (distanceKm: number, etaMinutes: number) => void;
  onFocusChange?: (mode: FocusMode) => void;
  averageSpeedKmh?: number;
}

interface UseDriverTripMapReturn {
  driverLocation: MapLocation | null;
  pickupLocation: MapLocation | null;
  dropoffLocation: MapLocation | null;
  routeInfo: RouteInfo | null;
  focusMode: FocusMode;
  activeLeg: ActiveLeg;
  updateDriverMarker: (position: MapLocation) => void;
  setPickupLocation: (location: MapLocation) => void;
  setDropoffLocation: (location: MapLocation) => void;
  showRoute: (origin: MapLocation, destination: MapLocation, waypoints?: MapLocation[]) => void;
  setFocus: (mode: FocusMode) => void;
  setActiveLeg: (leg: ActiveLeg) => void;
  fitToRouteBounds: () => { bounds: [[number, number], [number, number]] } | null;
  calculateDistanceToTarget: () => { distanceKm: number; etaMinutes: number } | null;
}

const DEFAULT_SPEED_KMH = 30;

function calculateDistance(from: MapLocation, to: MapLocation): number {
  try {
    const fromPoint = turf.point([from.lng, from.lat]);
    const toPoint = turf.point([to.lng, to.lat]);
    return turf.distance(fromPoint, toPoint, { units: "kilometers" });
  } catch {
    return 0;
  }
}

function calculateEta(distanceKm: number, speedKmh: number): number {
  return Math.ceil((distanceKm / speedKmh) * 60);
}

function generateSmoothRoute(start: MapLocation, end: MapLocation): [number, number][] {
  const points: [number, number][] = [];
  const steps = 25;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = start.lat + (end.lat - start.lat) * t;
    const lng = start.lng + (end.lng - start.lng) * t;
    const curve = Math.sin(t * Math.PI) * 0.0005;
    points.push([lat + curve, lng + curve * 0.5]);
  }
  
  return points;
}

export function useDriverTripMap(options: UseDriverTripMapOptions = {}): UseDriverTripMapReturn {
  const { onDistanceUpdate, onFocusChange, averageSpeedKmh = DEFAULT_SPEED_KMH } = options;
  
  const [driverLocation, setDriverLocation] = useState<MapLocation | null>(null);
  const [pickupLocation, setPickupLocation] = useState<MapLocation | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<MapLocation | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [focusMode, setFocusMode] = useState<FocusMode>("full-route");
  const [activeLeg, setActiveLeg] = useState<ActiveLeg>("to_pickup");
  
  const lastDistanceRef = useRef<number>(0);
  const lastEtaRef = useRef<number>(0);
  
  const updateDriverMarker = useCallback((position: MapLocation) => {
    setDriverLocation(position);
  }, []);
  
  const showRoute = useCallback((origin: MapLocation, destination: MapLocation, waypoints?: MapLocation[]) => {
    const coordinates = generateSmoothRoute(origin, destination);
    const distanceKm = calculateDistance(origin, destination);
    const etaMinutes = calculateEta(distanceKm, averageSpeedKmh);
    
    setRouteInfo({
      coordinates,
      distanceKm: Math.round(distanceKm * 10) / 10,
      etaMinutes: Math.max(1, etaMinutes),
    });
    
    if (onDistanceUpdate) {
      onDistanceUpdate(distanceKm, etaMinutes);
    }
  }, [averageSpeedKmh, onDistanceUpdate]);
  
  const setFocus = useCallback((mode: FocusMode) => {
    setFocusMode(mode);
    if (onFocusChange) {
      onFocusChange(mode);
    }
  }, [onFocusChange]);
  
  const fitToRouteBounds = useCallback((): { bounds: [[number, number], [number, number]] } | null => {
    const points: [number, number][] = [];
    
    if (driverLocation) {
      points.push([driverLocation.lat, driverLocation.lng]);
    }
    if (pickupLocation && activeLeg === "to_pickup") {
      points.push([pickupLocation.lat, pickupLocation.lng]);
    }
    if (dropoffLocation && (activeLeg === "to_dropoff" || activeLeg === "to_pickup")) {
      points.push([dropoffLocation.lat, dropoffLocation.lng]);
    }
    
    if (points.length < 2) return null;
    
    const lats = points.map(p => p[0]);
    const lngs = points.map(p => p[1]);
    
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ];
    
    return { bounds };
  }, [driverLocation, pickupLocation, dropoffLocation, activeLeg]);
  
  const calculateDistanceToTarget = useCallback(() => {
    if (!driverLocation) return null;
    
    const target = activeLeg === "to_pickup" ? pickupLocation : dropoffLocation;
    if (!target) return null;
    
    const distanceKm = calculateDistance(driverLocation, target);
    const etaMinutes = calculateEta(distanceKm, averageSpeedKmh);
    
    return {
      distanceKm: Math.round(distanceKm * 10) / 10,
      etaMinutes: Math.max(1, etaMinutes),
    };
  }, [driverLocation, pickupLocation, dropoffLocation, activeLeg, averageSpeedKmh]);
  
  useEffect(() => {
    const result = calculateDistanceToTarget();
    if (result && onDistanceUpdate) {
      const hasChanged = 
        Math.abs(result.distanceKm - lastDistanceRef.current) > 0.05 ||
        result.etaMinutes !== lastEtaRef.current;
      
      if (hasChanged) {
        lastDistanceRef.current = result.distanceKm;
        lastEtaRef.current = result.etaMinutes;
        onDistanceUpdate(result.distanceKm, result.etaMinutes);
      }
    }
  }, [driverLocation, calculateDistanceToTarget, onDistanceUpdate]);
  
  return {
    driverLocation,
    pickupLocation,
    dropoffLocation,
    routeInfo,
    focusMode,
    activeLeg,
    updateDriverMarker,
    setPickupLocation,
    setDropoffLocation,
    showRoute,
    setFocus,
    setActiveLeg,
    fitToRouteBounds,
    calculateDistanceToTarget,
  };
}

export default useDriverTripMap;
