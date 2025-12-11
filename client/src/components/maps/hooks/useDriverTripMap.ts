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

interface OffRouteInfo {
  isOffRoute: boolean;
  distanceFromRoute: number;
  recalculationNeeded: boolean;
}

interface TurnInfo {
  isApproachingTurn: boolean;
  turnAngle: number;
  distanceToTurn: number;
  suggestedZoom: number;
}

interface UseDriverTripMapOptions {
  onDistanceUpdate?: (distanceKm: number, etaMinutes: number) => void;
  onFocusChange?: (mode: FocusMode) => void;
  onOffRoute?: (info: OffRouteInfo) => void;
  onTurnApproaching?: (info: TurnInfo) => void;
  averageSpeedKmh?: number;
  offRouteThresholdMeters?: number;
  turnDetectionDistanceMeters?: number;
}

interface UseDriverTripMapReturn {
  driverLocation: MapLocation | null;
  pickupLocation: MapLocation | null;
  dropoffLocation: MapLocation | null;
  routeInfo: RouteInfo | null;
  focusMode: FocusMode;
  activeLeg: ActiveLeg;
  offRouteInfo: OffRouteInfo;
  turnInfo: TurnInfo;
  suggestedZoom: number;
  updateDriverMarker: (position: MapLocation) => void;
  setPickupLocation: (location: MapLocation) => void;
  setDropoffLocation: (location: MapLocation) => void;
  showRoute: (origin: MapLocation, destination: MapLocation, waypoints?: MapLocation[]) => void;
  setFocus: (mode: FocusMode) => void;
  setActiveLeg: (leg: ActiveLeg) => void;
  fitToRouteBounds: () => { bounds: [[number, number], [number, number]] } | null;
  calculateDistanceToTarget: () => { distanceKm: number; etaMinutes: number } | null;
  recalculateRoute: () => void;
  checkOffRoute: () => OffRouteInfo;
  detectUpcomingTurn: () => TurnInfo;
}

const DEFAULT_SPEED_KMH = 30;
const DEFAULT_OFF_ROUTE_THRESHOLD_METERS = 50;
const DEFAULT_TURN_DETECTION_DISTANCE_METERS = 100;
const BASE_ZOOM = 16;
const TURN_ZOOM = 18;

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

function calculateDistanceToLine(
  point: MapLocation,
  routeCoords: [number, number][]
): number {
  if (routeCoords.length < 2) return Infinity;
  
  try {
    const pt = turf.point([point.lng, point.lat]);
    const line = turf.lineString(routeCoords.map(([lat, lng]) => [lng, lat]));
    const distance = turf.pointToLineDistance(pt, line, { units: "meters" });
    return distance;
  } catch {
    return Infinity;
  }
}

function calculateAngleBetweenPoints(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number]
): number {
  const bearing1 = turf.bearing(turf.point([p1[1], p1[0]]), turf.point([p2[1], p2[0]]));
  const bearing2 = turf.bearing(turf.point([p2[1], p2[0]]), turf.point([p3[1], p3[0]]));
  let angle = Math.abs(bearing2 - bearing1);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

function findNearestPointOnRoute(
  position: MapLocation,
  routeCoords: [number, number][]
): { index: number; distance: number } {
  let minDistance = Infinity;
  let nearestIndex = 0;
  
  for (let i = 0; i < routeCoords.length; i++) {
    const [lat, lng] = routeCoords[i];
    const dist = calculateDistance(position, { lat, lng });
    if (dist < minDistance) {
      minDistance = dist;
      nearestIndex = i;
    }
  }
  
  return { index: nearestIndex, distance: minDistance * 1000 };
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
  const { 
    onDistanceUpdate, 
    onFocusChange, 
    onOffRoute,
    onTurnApproaching,
    averageSpeedKmh = DEFAULT_SPEED_KMH,
    offRouteThresholdMeters = DEFAULT_OFF_ROUTE_THRESHOLD_METERS,
    turnDetectionDistanceMeters = DEFAULT_TURN_DETECTION_DISTANCE_METERS,
  } = options;
  
  const [driverLocation, setDriverLocation] = useState<MapLocation | null>(null);
  const [pickupLocation, setPickupLocation] = useState<MapLocation | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<MapLocation | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [focusMode, setFocusMode] = useState<FocusMode>("full-route");
  const [activeLeg, setActiveLeg] = useState<ActiveLeg>("to_pickup");
  const [offRouteInfo, setOffRouteInfo] = useState<OffRouteInfo>({
    isOffRoute: false,
    distanceFromRoute: 0,
    recalculationNeeded: false,
  });
  const [turnInfo, setTurnInfo] = useState<TurnInfo>({
    isApproachingTurn: false,
    turnAngle: 0,
    distanceToTurn: Infinity,
    suggestedZoom: BASE_ZOOM,
  });
  const [suggestedZoom, setSuggestedZoom] = useState(BASE_ZOOM);
  
  const lastDistanceRef = useRef<number>(0);
  const lastEtaRef = useRef<number>(0);
  const recalculationCountRef = useRef<number>(0);
  const lastOffRouteCheckRef = useRef<number>(0);
  const lastTurnCheckRef = useRef<number>(0);
  const isRecalculatingRef = useRef<boolean>(false);
  
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
  
  const checkOffRoute = useCallback((): OffRouteInfo => {
    if (!driverLocation || !routeInfo?.coordinates || routeInfo.coordinates.length < 2) {
      return { isOffRoute: false, distanceFromRoute: 0, recalculationNeeded: false };
    }
    
    const distanceFromRoute = calculateDistanceToLine(driverLocation, routeInfo.coordinates);
    const isOffRoute = distanceFromRoute > offRouteThresholdMeters;
    const recalculationNeeded = distanceFromRoute > offRouteThresholdMeters * 2;
    
    const info: OffRouteInfo = {
      isOffRoute,
      distanceFromRoute,
      recalculationNeeded,
    };
    
    setOffRouteInfo(info);
    
    if (isOffRoute && onOffRoute) {
      onOffRoute(info);
    }
    
    return info;
  }, [driverLocation, routeInfo, offRouteThresholdMeters, onOffRoute]);
  
  const detectUpcomingTurn = useCallback((): TurnInfo => {
    if (!driverLocation || !routeInfo?.coordinates || routeInfo.coordinates.length < 3) {
      return { isApproachingTurn: false, turnAngle: 0, distanceToTurn: Infinity, suggestedZoom: BASE_ZOOM };
    }
    
    const { index: nearestIndex } = findNearestPointOnRoute(driverLocation, routeInfo.coordinates);
    
    for (let i = nearestIndex + 1; i < routeInfo.coordinates.length - 1; i++) {
      const p1 = routeInfo.coordinates[i - 1];
      const p2 = routeInfo.coordinates[i];
      const p3 = routeInfo.coordinates[i + 1];
      
      const angle = calculateAngleBetweenPoints(p1, p2, p3);
      
      if (angle > 30) {
        const distanceToTurn = calculateDistance(
          driverLocation,
          { lat: p2[0], lng: p2[1] }
        ) * 1000;
        
        const isApproachingTurn = distanceToTurn < turnDetectionDistanceMeters;
        const zoomBoost = isApproachingTurn ? Math.min(2, (turnDetectionDistanceMeters - distanceToTurn) / 50) : 0;
        const newSuggestedZoom = BASE_ZOOM + zoomBoost;
        
        const info: TurnInfo = {
          isApproachingTurn,
          turnAngle: angle,
          distanceToTurn,
          suggestedZoom: newSuggestedZoom,
        };
        
        setTurnInfo(info);
        setSuggestedZoom(newSuggestedZoom);
        
        if (isApproachingTurn && onTurnApproaching) {
          onTurnApproaching(info);
        }
        
        return info;
      }
    }
    
    const noTurnInfo: TurnInfo = {
      isApproachingTurn: false,
      turnAngle: 0,
      distanceToTurn: Infinity,
      suggestedZoom: BASE_ZOOM,
    };
    setTurnInfo(noTurnInfo);
    setSuggestedZoom(BASE_ZOOM);
    return noTurnInfo;
  }, [driverLocation, routeInfo, turnDetectionDistanceMeters, onTurnApproaching]);
  
  const recalculateRoute = useCallback(() => {
    if (!driverLocation) return;
    
    const target = activeLeg === "to_pickup" ? pickupLocation : dropoffLocation;
    if (!target) return;
    
    recalculationCountRef.current += 1;
    console.log(`[SafeGo] Route recalculated (count: ${recalculationCountRef.current})`);
    
    const coordinates = generateSmoothRoute(driverLocation, target);
    const distanceKm = calculateDistance(driverLocation, target);
    const etaMinutes = calculateEta(distanceKm, averageSpeedKmh);
    
    setRouteInfo({
      coordinates,
      distanceKm: Math.round(distanceKm * 10) / 10,
      etaMinutes: Math.max(1, etaMinutes),
    });
    
    setOffRouteInfo({
      isOffRoute: false,
      distanceFromRoute: 0,
      recalculationNeeded: false,
    });
    
    if (onDistanceUpdate) {
      onDistanceUpdate(distanceKm, etaMinutes);
    }
  }, [driverLocation, activeLeg, pickupLocation, dropoffLocation, averageSpeedKmh, onDistanceUpdate]);
  
  useEffect(() => {
    if (!driverLocation || !routeInfo?.coordinates || routeInfo.coordinates.length < 2) return;
    if (isRecalculatingRef.current) return;
    
    const now = Date.now();
    if (now - lastOffRouteCheckRef.current < 2000) return;
    lastOffRouteCheckRef.current = now;
    
    const distanceFromRoute = calculateDistanceToLine(driverLocation, routeInfo.coordinates);
    const isOff = distanceFromRoute > offRouteThresholdMeters;
    const needsRecalc = distanceFromRoute > offRouteThresholdMeters * 2;
    
    setOffRouteInfo({
      isOffRoute: isOff,
      distanceFromRoute,
      recalculationNeeded: needsRecalc,
    });
    
    if (needsRecalc && !isRecalculatingRef.current) {
      isRecalculatingRef.current = true;
      
      const target = activeLeg === "to_pickup" ? pickupLocation : dropoffLocation;
      if (target) {
        recalculationCountRef.current += 1;
        console.log(`[SafeGo] Auto route recalculation (count: ${recalculationCountRef.current})`);
        
        const coordinates = generateSmoothRoute(driverLocation, target);
        const distanceKm = calculateDistance(driverLocation, target);
        const etaMinutes = calculateEta(distanceKm, averageSpeedKmh);
        
        setRouteInfo({
          coordinates,
          distanceKm: Math.round(distanceKm * 10) / 10,
          etaMinutes: Math.max(1, etaMinutes),
        });
        
        setOffRouteInfo({
          isOffRoute: false,
          distanceFromRoute: 0,
          recalculationNeeded: false,
        });
      }
      
      setTimeout(() => {
        isRecalculatingRef.current = false;
      }, 3000);
    }
  }, [driverLocation, routeInfo, offRouteThresholdMeters, activeLeg, pickupLocation, dropoffLocation, averageSpeedKmh]);
  
  useEffect(() => {
    if (!driverLocation || !routeInfo?.coordinates || routeInfo.coordinates.length < 3) return;
    
    const now = Date.now();
    if (now - lastTurnCheckRef.current < 1000) return;
    lastTurnCheckRef.current = now;
    
    const { index: nearestIndex } = findNearestPointOnRoute(driverLocation, routeInfo.coordinates);
    
    let foundTurn = false;
    for (let i = nearestIndex + 1; i < routeInfo.coordinates.length - 1 && !foundTurn; i++) {
      const p1 = routeInfo.coordinates[i - 1];
      const p2 = routeInfo.coordinates[i];
      const p3 = routeInfo.coordinates[i + 1];
      
      const angle = calculateAngleBetweenPoints(p1, p2, p3);
      
      if (angle > 30) {
        const distanceToTurn = calculateDistance(
          driverLocation,
          { lat: p2[0], lng: p2[1] }
        ) * 1000;
        
        const isApproachingTurn = distanceToTurn < turnDetectionDistanceMeters;
        const zoomBoost = isApproachingTurn ? Math.min(2, (turnDetectionDistanceMeters - distanceToTurn) / 50) : 0;
        const newSuggestedZoom = Math.round((BASE_ZOOM + zoomBoost) * 10) / 10;
        
        if (Math.abs(newSuggestedZoom - suggestedZoom) > 0.2) {
          setSuggestedZoom(newSuggestedZoom);
        }
        
        setTurnInfo({
          isApproachingTurn,
          turnAngle: angle,
          distanceToTurn,
          suggestedZoom: newSuggestedZoom,
        });
        
        foundTurn = true;
      }
    }
    
    if (!foundTurn && suggestedZoom !== BASE_ZOOM) {
      setSuggestedZoom(BASE_ZOOM);
      setTurnInfo({
        isApproachingTurn: false,
        turnAngle: 0,
        distanceToTurn: Infinity,
        suggestedZoom: BASE_ZOOM,
      });
    }
  }, [driverLocation, routeInfo, turnDetectionDistanceMeters, suggestedZoom]);
  
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
    offRouteInfo,
    turnInfo,
    suggestedZoom,
    updateDriverMarker,
    setPickupLocation,
    setDropoffLocation,
    showRoute,
    setFocus,
    setActiveLeg,
    fitToRouteBounds,
    calculateDistanceToTarget,
    recalculateRoute,
    checkOffRoute,
    detectUpcomingTurn,
  };
}

export default useDriverTripMap;
