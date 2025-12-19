import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as turf from "@turf/turf";

export interface MapLocation {
  lat: number;
  lng: number;
  label?: string;
  heading?: number;
}

export type ActiveLeg = "to_pickup" | "to_dropoff" | "completed";

export interface SafeGoMapProps {
  center?: MapLocation;
  zoom?: number;
  dynamicZoom?: number;
  driverLocation?: MapLocation | null;
  pickupLocation?: MapLocation | null;
  dropoffLocation?: MapLocation | null;
  activeLeg?: ActiveLeg;
  routeCoordinates?: [number, number][];
  onMapReady?: () => void;
  onDistanceCalculated?: (distanceKm: number, etaMinutes: number) => void;
  className?: string;
  showControls?: boolean;
  autoFollow?: boolean;
  showEtaOverlay?: boolean;
  showTrafficToggle?: boolean;
  isOffRoute?: boolean;
  onRecalculateRoute?: () => void;
  recenterTrigger?: number;
}

const createDriverIcon = (heading: number = 0) => L.divIcon({
  className: "safego-driver-marker-animated",
  html: `<div style="
    width: 52px;
    height: 52px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  ">
    <!-- Outer white circle with shadow -->
    <div style="
      position: absolute;
      width: 48px;
      height: 48px;
      background: white;
      border-radius: 50%;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      animation: pulse-driver 2s infinite;
    "></div>
    <!-- Inner dark circle with arrow -->
    <div style="
      position: relative;
      width: 38px;
      height: 38px;
      background: #1a1a1a;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: rotate(${heading}deg);
      transition: transform 0.5s ease-out;
    ">
      <!-- Uber-style navigation arrow pointing up -->
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3L4 20L12 16L20 20L12 3Z" fill="white"/>
      </svg>
    </div>
  </div>
  <style>
    @keyframes pulse-driver {
      0%, 100% { box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
      50% { box-shadow: 0 4px 24px rgba(0,0,0,0.5); }
    }
  </style>`,
  iconSize: [52, 52],
  iconAnchor: [26, 26],
  popupAnchor: [0, -26],
});

const pickupIcon = L.divIcon({
  className: "safego-pickup-marker",
  html: `<div style="
    background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 4px solid white;
    box-shadow: 0 4px 12px rgba(0,0,0,0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  ">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
    <div style="
      position: absolute;
      top: -8px;
      right: -8px;
      background: white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: bold;
      color: #3B82F6;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    ">A</div>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

const dropoffIcon = L.divIcon({
  className: "safego-dropoff-marker",
  html: `<div style="
    background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 4px solid white;
    box-shadow: 0 4px 12px rgba(0,0,0,0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  ">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
    <div style="
      position: absolute;
      top: -8px;
      right: -8px;
      background: white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: bold;
      color: #EF4444;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    ">B</div>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

function AutoFollowHandler({ 
  driverLocation, 
  autoFollow,
  activeLeg,
  recenterTrigger,
}: { 
  driverLocation?: MapLocation | null;
  autoFollow?: boolean;
  activeLeg?: ActiveLeg;
  recenterTrigger?: number;
}) {
  const map = useMap();
  const prevLocation = useRef<MapLocation | null>(null);
  const prevRecenterTrigger = useRef<number | undefined>(recenterTrigger);
  
  useEffect(() => {
    if (!driverLocation) return;
    
    const forceRecenter = recenterTrigger !== undefined && 
      recenterTrigger !== prevRecenterTrigger.current;
    
    if (forceRecenter) {
      map.flyTo([driverLocation.lat, driverLocation.lng], 17, {
        duration: 0.8,
        easeLinearity: 0.25,
      });
      prevRecenterTrigger.current = recenterTrigger;
      prevLocation.current = driverLocation;
      return;
    }
    
    if (!autoFollow || activeLeg === "completed") return;
    
    const hasLocationChanged = !prevLocation.current || 
      prevLocation.current.lat !== driverLocation.lat || 
      prevLocation.current.lng !== driverLocation.lng;
    
    if (hasLocationChanged) {
      map.panTo([driverLocation.lat, driverLocation.lng], {
        animate: true,
        duration: 0.5,
      });
      prevLocation.current = driverLocation;
    }
  }, [map, driverLocation, autoFollow, activeLeg, recenterTrigger]);
  
  return null;
}

function MapBoundsHandler({ 
  driverLocation, 
  pickupLocation, 
  dropoffLocation,
  activeLeg,
  autoFollow,
}: { 
  driverLocation?: MapLocation | null;
  pickupLocation?: MapLocation | null;
  dropoffLocation?: MapLocation | null;
  activeLeg?: ActiveLeg;
  autoFollow?: boolean;
}) {
  const map = useMap();
  const hasInitialized = useRef(false);
  
  useEffect(() => {
    if (hasInitialized.current && autoFollow) return;
    
    const bounds: L.LatLngExpression[] = [];
    
    if (driverLocation) {
      bounds.push([driverLocation.lat, driverLocation.lng]);
    }
    if (pickupLocation && (activeLeg === "to_pickup" || !activeLeg)) {
      bounds.push([pickupLocation.lat, pickupLocation.lng]);
    }
    if (dropoffLocation && (activeLeg === "to_dropoff" || !activeLeg)) {
      bounds.push([dropoffLocation.lat, dropoffLocation.lng]);
    }
    
    if (bounds.length >= 2) {
      const latLngBounds = L.latLngBounds(bounds);
      map.fitBounds(latLngBounds, { padding: [60, 60], maxZoom: 17 });
      hasInitialized.current = true;
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 17);
      hasInitialized.current = true;
    }
  }, [map, driverLocation, pickupLocation, dropoffLocation, activeLeg, autoFollow]);
  
  return null;
}

function MapReadyHandler({ onMapReady }: { onMapReady?: () => void }) {
  const map = useMap();
  
  useEffect(() => {
    if (onMapReady) {
      onMapReady();
    }
  }, [map, onMapReady]);
  
  return null;
}

function DynamicZoomHandler({ 
  dynamicZoom,
  driverLocation,
}: { 
  dynamicZoom?: number;
  driverLocation?: MapLocation | null;
}) {
  const map = useMap();
  const prevZoomRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (!dynamicZoom || !driverLocation) return;
    
    if (prevZoomRef.current !== dynamicZoom) {
      map.setZoom(dynamicZoom, { animate: true });
      prevZoomRef.current = dynamicZoom;
    }
  }, [map, dynamicZoom, driverLocation]);
  
  return null;
}

function generateSmoothRoute(
  start: MapLocation,
  end: MapLocation
): [number, number][] {
  const points: [number, number][] = [];
  const steps = 30;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const lat = start.lat + (end.lat - start.lat) * t;
    const lng = start.lng + (end.lng - start.lng) * t;
    const curve = Math.sin(t * Math.PI) * 0.0008;
    points.push([lat + curve, lng + curve * 0.5]);
  }
  
  return points;
}

function calculateDistanceAndEta(
  from: MapLocation,
  to: MapLocation
): { distanceKm: number; etaMinutes: number } {
  try {
    const fromPoint = turf.point([from.lng, from.lat]);
    const toPoint = turf.point([to.lng, to.lat]);
    const distance = turf.distance(fromPoint, toPoint, { units: "kilometers" });
    const avgSpeedKmh = 30;
    const etaMinutes = Math.ceil((distance / avgSpeedKmh) * 60);
    return { distanceKm: Math.round(distance * 10) / 10, etaMinutes: Math.max(1, etaMinutes) };
  } catch {
    return { distanceKm: 0, etaMinutes: 0 };
  }
}

export function SafeGoMap({
  center = { lat: 40.7128, lng: -74.006 },
  zoom = 14,
  dynamicZoom,
  driverLocation,
  pickupLocation,
  dropoffLocation,
  activeLeg = "to_pickup",
  routeCoordinates,
  onMapReady,
  onDistanceCalculated,
  className = "",
  showControls = true,
  autoFollow = true,
  showEtaOverlay = true,
  showTrafficToggle = false,
  isOffRoute = false,
  onRecalculateRoute,
  recenterTrigger,
}: SafeGoMapProps) {
  const [mapReady, setMapReady] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const driverIcon = useMemo(() => createDriverIcon(driverLocation?.heading || 0), [driverLocation?.heading]);
  
  const targetLocation = useMemo(() => {
    if (activeLeg === "to_pickup") return pickupLocation;
    if (activeLeg === "to_dropoff") return dropoffLocation;
    return null;
  }, [activeLeg, pickupLocation, dropoffLocation]);
  
  const { distanceKm, etaMinutes } = useMemo(() => {
    if (driverLocation && targetLocation) {
      return calculateDistanceAndEta(driverLocation, targetLocation);
    }
    return { distanceKm: 0, etaMinutes: 0 };
  }, [driverLocation, targetLocation]);
  
  useEffect(() => {
    if (onDistanceCalculated && distanceKm >= 0) {
      onDistanceCalculated(distanceKm, etaMinutes);
    }
  }, [distanceKm, etaMinutes, onDistanceCalculated]);
  
  const getRouteColor = () => {
    if (activeLeg === "to_pickup") return "#3B82F6";
    if (activeLeg === "to_dropoff") return "#10B981";
    return "#6B7280";
  };
  
  const computedRoute = useMemo(() => {
    if (routeCoordinates && routeCoordinates.length > 0) return routeCoordinates;
    if (activeLeg === "to_pickup" && driverLocation && pickupLocation) {
      return generateSmoothRoute(driverLocation, pickupLocation);
    }
    if (activeLeg === "to_dropoff" && driverLocation && dropoffLocation) {
      return generateSmoothRoute(driverLocation, dropoffLocation);
    }
    if (pickupLocation && dropoffLocation) {
      return generateSmoothRoute(pickupLocation, dropoffLocation);
    }
    return [];
  }, [routeCoordinates, activeLeg, driverLocation, pickupLocation, dropoffLocation]);
  
  const mapCenter: [number, number] = driverLocation 
    ? [driverLocation.lat, driverLocation.lng]
    : [center.lat, center.lng];

  return (
    <div className={`relative ${className}`} data-testid="safego-map-container">
      {showEtaOverlay && activeLeg !== "completed" && targetLocation && distanceKm > 0 && (
        <div className="absolute top-3 right-3 z-[1000] bg-background/95 backdrop-blur-sm rounded-xl px-4 py-2.5 shadow-lg border" data-testid="map-eta-overlay">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-lg font-bold text-foreground" data-testid="map-eta-minutes">{etaMinutes}</p>
              <p className="text-[10px] text-muted-foreground uppercase">min</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <p className="text-lg font-bold text-foreground" data-testid="map-distance-km">{distanceKm}</p>
              <p className="text-[10px] text-muted-foreground uppercase">km</p>
            </div>
          </div>
        </div>
      )}
      
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        style={{ height: "100%", width: "100%", borderRadius: "0.75rem" }}
        zoomControl={showControls}
        attributionControl={false}
        className="z-0"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        
        <MapBoundsHandler 
          driverLocation={driverLocation}
          pickupLocation={pickupLocation}
          dropoffLocation={dropoffLocation}
          activeLeg={activeLeg}
          autoFollow={autoFollow}
        />
        
        <AutoFollowHandler
          driverLocation={driverLocation}
          autoFollow={autoFollow}
          activeLeg={activeLeg}
          recenterTrigger={recenterTrigger}
        />
        
        <MapReadyHandler onMapReady={() => {
          setMapReady(true);
          onMapReady?.();
        }} />
        
        {dynamicZoom && (
          <DynamicZoomHandler 
            dynamicZoom={dynamicZoom}
            driverLocation={driverLocation}
          />
        )}
        
        {/* Traffic layer removed - Carto Positron provides clean Uber-like appearance */}
        
        {computedRoute.length > 1 && (
          <>
            <Polyline
              positions={computedRoute}
              pathOptions={{
                color: "#374151",
                weight: 8,
                opacity: 0.3,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            <Polyline
              positions={computedRoute}
              pathOptions={{
                color: getRouteColor(),
                weight: 5,
                opacity: 0.9,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </>
        )}
        
        {driverLocation && (
          <>
            <Circle
              center={[driverLocation.lat, driverLocation.lng]}
              radius={50}
              pathOptions={{
                color: "#10B981",
                fillColor: "#10B981",
                fillOpacity: 0.15,
                weight: 1,
              }}
            />
            <Marker 
              position={[driverLocation.lat, driverLocation.lng]} 
              icon={driverIcon}
            >
              <Popup>
                <div className="font-semibold text-base">Your Location</div>
                {driverLocation.label && (
                  <div className="text-sm text-gray-600 mt-1">{driverLocation.label}</div>
                )}
              </Popup>
            </Marker>
          </>
        )}
        
        {pickupLocation && (
          <Marker 
            position={[pickupLocation.lat, pickupLocation.lng]} 
            icon={pickupIcon}
          >
            <Popup>
              <div className="font-semibold text-base">Pickup Location</div>
              {pickupLocation.label && (
                <div className="text-sm text-gray-600 mt-1">{pickupLocation.label}</div>
              )}
            </Popup>
          </Marker>
        )}
        
        {dropoffLocation && (
          <Marker 
            position={[dropoffLocation.lat, dropoffLocation.lng]} 
            icon={dropoffIcon}
          >
            <Popup>
              <div className="font-semibold text-base">Dropoff Location</div>
              {dropoffLocation.label && (
                <div className="text-sm text-gray-600 mt-1">{dropoffLocation.label}</div>
              )}
            </Popup>
          </Marker>
        )}
      </MapContainer>
      
      {showTrafficToggle && (
        <button
          onClick={() => setShowTraffic(!showTraffic)}
          className={`absolute top-16 right-3 z-[1000] p-2.5 rounded-lg shadow-md border transition-all ${
            showTraffic 
              ? "bg-primary text-primary-foreground border-primary" 
              : "bg-background/95 backdrop-blur-sm text-foreground hover-elevate"
          }`}
          data-testid="button-toggle-traffic"
          title={showTraffic ? "Hide traffic" : "Show traffic"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="3" width="16" height="18" rx="2" />
            <circle cx="12" cy="8" r="2" />
            <circle cx="12" cy="14" r="2" />
            <circle cx="12" cy="20" r="1" />
          </svg>
        </button>
      )}
      
      {isOffRoute && onRecalculateRoute && (
        <div className="absolute top-16 left-3 right-16 z-[1000]" data-testid="off-route-warning">
          <button
            onClick={onRecalculateRoute}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 text-white font-medium py-2 px-4 rounded-lg shadow-lg animate-pulse"
            data-testid="button-recalculate-route"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            Off Route - Tap to Recalculate
          </button>
        </div>
      )}
      
    </div>
  );
}

export default SafeGoMap;
