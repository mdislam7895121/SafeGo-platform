import { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface Position {
  lat: number;
  lng: number;
}

interface InterpolatedPosition extends Position {
  heading: number;
  speedMph: number;
}

interface TurnInstruction {
  text: string;
  distanceFeet: number;
  maneuver: string;
}

interface DriverTrackingConfig {
  routePoints: [number, number][];
  rideStatus: string;
  gpsUpdateIntervalMs?: number;
  interpolationSteps?: number;
}

interface DriverTrackingState {
  currentPosition: Position | null;
  interpolatedPosition: Position | null;
  heading: number;
  speedMph: number;
  positionIndex: number;
  nextTurn: TurnInstruction | null;
  isMoving: boolean;
  remainingDistanceMiles: number;
  etaMinutes: number;
}

function calculateBearing(from: Position, to: Position): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLon = toRad(to.lng - from.lng);
  
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  
  let bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

function calculateDistance(from: Position, to: Position): number {
  const R = 3959;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function interpolatePosition(from: Position, to: Position, t: number): Position {
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  };
}

function interpolateAngle(from: number, to: number, t: number): number {
  let diff = ((to - from + 540) % 360) - 180;
  return (from + diff * t + 360) % 360;
}

function detectTurnDirection(currentHeading: number, nextHeading: number): string {
  let diff = ((nextHeading - currentHeading + 540) % 360) - 180;
  
  if (Math.abs(diff) < 30) return "continue";
  if (diff > 0 && diff < 90) return "slight_right";
  if (diff >= 90 && diff < 135) return "right";
  if (diff >= 135) return "sharp_right";
  if (diff < 0 && diff > -90) return "slight_left";
  if (diff <= -90 && diff > -135) return "left";
  return "sharp_left";
}

function getManeuverText(maneuver: string, streetName?: string): string {
  const baseText = {
    continue: "Continue straight",
    slight_right: "Bear right",
    right: "Turn right",
    sharp_right: "Make a sharp right",
    slight_left: "Bear left",
    left: "Turn left",
    sharp_left: "Make a sharp left",
  }[maneuver] || "Continue";
  
  return streetName ? `${baseText} onto ${streetName}` : baseText;
}

export function useDriverTracking({
  routePoints,
  rideStatus,
  gpsUpdateIntervalMs = 3000,
  interpolationSteps = 60,
}: DriverTrackingConfig): DriverTrackingState & {
  setPositionIndex: (index: number) => void;
  resetTracking: () => void;
} {
  const [positionIndex, setPositionIndex] = useState(0);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [interpolatedPosition, setInterpolatedPosition] = useState<Position | null>(null);
  const [heading, setHeading] = useState(0);
  const [targetHeading, setTargetHeading] = useState(0);
  const [speedMph, setSpeedMph] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [nextTurn, setNextTurn] = useState<TurnInstruction | null>(null);
  const [remainingDistanceMiles, setRemainingDistanceMiles] = useState(0);
  const [etaMinutes, setEtaMinutes] = useState(0);
  
  const prevPositionRef = useRef<Position | null>(null);
  const prevTimestampRef = useRef<number>(Date.now());
  const animationFrameRef = useRef<number | null>(null);
  const interpolationProgressRef = useRef(0);
  const targetPositionRef = useRef<Position | null>(null);
  const startPositionRef = useRef<Position | null>(null);
  const startHeadingRef = useRef(0);
  
  const resetTracking = useCallback(() => {
    setPositionIndex(0);
    setCurrentPosition(null);
    setInterpolatedPosition(null);
    setHeading(0);
    setTargetHeading(0);
    setSpeedMph(0);
    setIsMoving(false);
    setNextTurn(null);
    setRemainingDistanceMiles(0);
    setEtaMinutes(0);
    prevPositionRef.current = null;
    prevTimestampRef.current = Date.now();
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    interpolationProgressRef.current = 0;
    targetPositionRef.current = null;
    startPositionRef.current = null;
  }, []);

  const calculateRemainingDistance = useCallback((fromIndex: number, toIndex: number): number => {
    if (routePoints.length < 2 || fromIndex >= toIndex) return 0;
    
    let distance = 0;
    for (let i = fromIndex; i < toIndex && i < routePoints.length - 1; i++) {
      const from = { lat: routePoints[i][0], lng: routePoints[i][1] };
      const to = { lat: routePoints[i + 1][0], lng: routePoints[i + 1][1] };
      distance += calculateDistance(from, to);
    }
    return distance;
  }, [routePoints]);

  const detectNextTurn = useCallback((fromIndex: number): TurnInstruction | null => {
    if (routePoints.length < 3 || fromIndex >= routePoints.length - 2) return null;
    
    const lookAhead = Math.min(20, routePoints.length - fromIndex - 1);
    let cumulativeDistance = 0;
    
    for (let i = fromIndex; i < fromIndex + lookAhead - 1; i++) {
      const p1 = { lat: routePoints[i][0], lng: routePoints[i][1] };
      const p2 = { lat: routePoints[i + 1][0], lng: routePoints[i + 1][1] };
      const p3 = { lat: routePoints[i + 2][0], lng: routePoints[i + 2][1] };
      
      const heading1 = calculateBearing(p1, p2);
      const heading2 = calculateBearing(p2, p3);
      const maneuver = detectTurnDirection(heading1, heading2);
      
      if (maneuver !== "continue") {
        const distanceToTurn = cumulativeDistance + calculateDistance(p1, p2);
        const distanceFeet = Math.round(distanceToTurn * 5280);
        
        return {
          text: getManeuverText(maneuver),
          distanceFeet,
          maneuver,
        };
      }
      
      cumulativeDistance += calculateDistance(p1, p2);
    }
    
    return null;
  }, [routePoints]);

  useEffect(() => {
    if (
      rideStatus !== "DRIVER_ASSIGNED" && 
      rideStatus !== "TRIP_IN_PROGRESS"
    ) {
      resetTracking();
      return;
    }

    if (routePoints.length === 0) return;

    const startIndex = Math.max(0, Math.floor(routePoints.length * 0.1));
    const initialPosition = {
      lat: routePoints[startIndex][0],
      lng: routePoints[startIndex][1],
    };

    setPositionIndex(startIndex);
    setCurrentPosition(initialPosition);
    setInterpolatedPosition(initialPosition);
    prevPositionRef.current = initialPosition;

    if (startIndex + 1 < routePoints.length) {
      const nextPoint = { lat: routePoints[startIndex + 1][0], lng: routePoints[startIndex + 1][1] };
      const initialHeading = calculateBearing(initialPosition, nextPoint);
      if (!isNaN(initialHeading) && isFinite(initialHeading)) {
        setHeading(initialHeading);
        setTargetHeading(initialHeading);
      }
    }

    const endIndex = rideStatus === "DRIVER_ASSIGNED" 
      ? Math.floor(routePoints.length * 0.3)
      : routePoints.length - 1;
    const remainingDist = calculateRemainingDistance(startIndex, endIndex);
    setRemainingDistanceMiles(remainingDist);
    setEtaMinutes(Math.ceil(remainingDist / 0.5));

  }, [rideStatus, routePoints.length]);

  useEffect(() => {
    if (!targetPositionRef.current || !startPositionRef.current || !interpolatedPosition) return;

    let lastTimestamp: number | null = null;
    const duration = gpsUpdateIntervalMs;

    const animate = (timestamp: number) => {
      if (lastTimestamp === null) lastTimestamp = timestamp;
      const elapsed = timestamp - lastTimestamp;
      const progress = Math.min(elapsed / duration, 1);

      const easeProgress = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const newPosition = interpolatePosition(
        startPositionRef.current!,
        targetPositionRef.current!,
        easeProgress
      );
      
      const newHeading = interpolateAngle(
        startHeadingRef.current,
        targetHeading,
        easeProgress
      );

      setInterpolatedPosition(newPosition);
      setHeading(newHeading);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setIsMoving(false);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [targetHeading, gpsUpdateIntervalMs]);

  const updatePosition = useCallback((newIndex: number) => {
    if (routePoints.length === 0 || newIndex >= routePoints.length) return;

    const newPosition = {
      lat: routePoints[newIndex][0],
      lng: routePoints[newIndex][1],
    };

    const now = Date.now();
    const timeDeltaHours = (now - prevTimestampRef.current) / 3600000;

    if (prevPositionRef.current && timeDeltaHours > 0) {
      const distance = calculateDistance(prevPositionRef.current, newPosition);
      const speed = distance / timeDeltaHours;
      setSpeedMph(Math.round(speed));

      const bearing = calculateBearing(prevPositionRef.current, newPosition);
      if (!isNaN(bearing) && isFinite(bearing)) {
        setTargetHeading(bearing);
      }
    }

    startPositionRef.current = interpolatedPosition || currentPosition || newPosition;
    startHeadingRef.current = heading;
    targetPositionRef.current = newPosition;
    setIsMoving(true);

    prevPositionRef.current = newPosition;
    prevTimestampRef.current = now;
    setPositionIndex(newIndex);
    setCurrentPosition(newPosition);

    const endIndex = rideStatus === "DRIVER_ASSIGNED" 
      ? Math.floor(routePoints.length * 0.3)
      : routePoints.length - 1;
    const remainingDist = calculateRemainingDistance(newIndex, endIndex);
    setRemainingDistanceMiles(remainingDist);
    
    const avgSpeedForEta = speedMph > 0 ? speedMph : 25;
    setEtaMinutes(Math.max(1, Math.ceil((remainingDist / avgSpeedForEta) * 60)));

    const turn = detectNextTurn(newIndex);
    setNextTurn(turn);
  }, [routePoints, rideStatus, interpolatedPosition, currentPosition, heading, speedMph, calculateRemainingDistance, detectNextTurn]);

  useEffect(() => {
    if (
      rideStatus !== "DRIVER_ASSIGNED" && 
      rideStatus !== "TRIP_IN_PROGRESS"
    ) {
      return;
    }

    if (routePoints.length === 0) return;

    let currentIndex = positionIndex;
    
    const interval = setInterval(() => {
      const step = rideStatus === "DRIVER_ASSIGNED" ? 2 : 3;
      const maxIndex = routePoints.length - 1;
      let newIndex = currentIndex + step;
      
      if (rideStatus === "DRIVER_ASSIGNED") {
        const pickupStopIndex = Math.min(maxIndex, Math.floor(routePoints.length * 0.3));
        if (newIndex >= pickupStopIndex) {
          newIndex = pickupStopIndex;
        }
      }
      
      if (newIndex > maxIndex) {
        newIndex = maxIndex;
      }
      
      if (newIndex !== currentIndex) {
        currentIndex = newIndex;
        updatePosition(newIndex);
      }
    }, gpsUpdateIntervalMs);

    return () => clearInterval(interval);
  }, [rideStatus, routePoints, positionIndex, gpsUpdateIntervalMs, updatePosition]);

  return {
    currentPosition,
    interpolatedPosition,
    heading,
    speedMph,
    positionIndex,
    nextTurn,
    isMoving,
    remainingDistanceMiles,
    etaMinutes,
    setPositionIndex: updatePosition,
    resetTracking,
  };
}

export function formatEtaText(minutes: number): string {
  if (minutes <= 1) return "Arriving now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatSpeedText(mph: number): string {
  return `${mph} mph`;
}

export function formatDistanceText(feet: number): string {
  if (feet < 528) return `${Math.round(feet / 10) * 10} ft`;
  const miles = feet / 5280;
  if (miles < 0.1) return `${Math.round(feet)} ft`;
  return `${miles.toFixed(1)} mi`;
}
