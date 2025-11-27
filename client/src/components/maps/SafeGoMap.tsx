import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapLocation {
  lat: number;
  lng: number;
  label?: string;
}

export type ActiveLeg = "to_pickup" | "to_dropoff" | "completed";

export interface SafeGoMapProps {
  center?: MapLocation;
  zoom?: number;
  driverLocation?: MapLocation | null;
  pickupLocation?: MapLocation | null;
  dropoffLocation?: MapLocation | null;
  activeLeg?: ActiveLeg;
  routeCoordinates?: [number, number][];
  onMapReady?: () => void;
  className?: string;
  showControls?: boolean;
}

const driverIcon = L.divIcon({
  className: "safego-driver-marker",
  html: `<div style="
    background: linear-gradient(135deg, #10B981 0%, #059669 100%);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  ">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
    </svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

const pickupIcon = L.divIcon({
  className: "safego-pickup-marker",
  html: `<div style="
    background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  ">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const dropoffIcon = L.divIcon({
  className: "safego-dropoff-marker",
  html: `<div style="
    background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  ">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

function MapBoundsHandler({ 
  driverLocation, 
  pickupLocation, 
  dropoffLocation,
  activeLeg 
}: { 
  driverLocation?: MapLocation | null;
  pickupLocation?: MapLocation | null;
  dropoffLocation?: MapLocation | null;
  activeLeg?: ActiveLeg;
}) {
  const map = useMap();
  
  useEffect(() => {
    const bounds: L.LatLngExpression[] = [];
    
    if (driverLocation) {
      bounds.push([driverLocation.lat, driverLocation.lng]);
    }
    if (pickupLocation && activeLeg === "to_pickup") {
      bounds.push([pickupLocation.lat, pickupLocation.lng]);
    }
    if (dropoffLocation && activeLeg === "to_dropoff") {
      bounds.push([dropoffLocation.lat, dropoffLocation.lng]);
    }
    if (pickupLocation && dropoffLocation && !activeLeg) {
      bounds.push([pickupLocation.lat, pickupLocation.lng]);
      bounds.push([dropoffLocation.lat, dropoffLocation.lng]);
    }
    
    if (bounds.length >= 2) {
      const latLngBounds = L.latLngBounds(bounds);
      map.fitBounds(latLngBounds, { padding: [50, 50], maxZoom: 15 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    }
  }, [map, driverLocation, pickupLocation, dropoffLocation, activeLeg]);
  
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

function generateSampleRoute(
  start: MapLocation,
  end: MapLocation
): [number, number][] {
  const points: [number, number][] = [];
  const steps = 20;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = start.lat + (end.lat - start.lat) * t;
    const lng = start.lng + (end.lng - start.lng) * t;
    const jitter = (Math.sin(i * 0.8) * 0.001) * (1 - Math.abs(t - 0.5) * 2);
    points.push([lat + jitter, lng + jitter]);
  }
  
  return points;
}

export function SafeGoMap({
  center = { lat: 40.7128, lng: -74.006 },
  zoom = 13,
  driverLocation,
  pickupLocation,
  dropoffLocation,
  activeLeg = "to_pickup",
  routeCoordinates,
  onMapReady,
  className = "",
  showControls = true,
}: SafeGoMapProps) {
  const [mapReady, setMapReady] = useState(false);
  
  const getRouteColor = () => {
    if (activeLeg === "to_pickup") return "#3B82F6";
    if (activeLeg === "to_dropoff") return "#10B981";
    return "#6B7280";
  };
  
  const computedRoute = routeCoordinates || (() => {
    if (activeLeg === "to_pickup" && driverLocation && pickupLocation) {
      return generateSampleRoute(driverLocation, pickupLocation);
    }
    if (activeLeg === "to_dropoff" && driverLocation && dropoffLocation) {
      return generateSampleRoute(driverLocation, dropoffLocation);
    }
    if (pickupLocation && dropoffLocation) {
      return generateSampleRoute(pickupLocation, dropoffLocation);
    }
    return [];
  })();
  
  const mapCenter: [number, number] = driverLocation 
    ? [driverLocation.lat, driverLocation.lng]
    : [center.lat, center.lng];

  return (
    <div className={`relative ${className}`} data-testid="safego-map-container">
      <div className="absolute top-3 left-3 z-[1000] bg-primary/95 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border border-primary">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-primary-foreground" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-primary-foreground leading-tight">SafeGo Map</span>
            <span className="text-[10px] text-primary-foreground/80 leading-tight">Live Navigation</span>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-3 right-3 z-[1000] bg-background/80 backdrop-blur-sm rounded px-2 py-1 shadow-sm border text-[10px] text-muted-foreground">
        Powered by SafeGo
      </div>
      
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
        />
        
        <MapBoundsHandler 
          driverLocation={driverLocation}
          pickupLocation={pickupLocation}
          dropoffLocation={dropoffLocation}
          activeLeg={activeLeg}
        />
        
        <MapReadyHandler onMapReady={() => {
          setMapReady(true);
          onMapReady?.();
        }} />
        
        {computedRoute.length > 1 && (
          <Polyline
            positions={computedRoute}
            pathOptions={{
              color: getRouteColor(),
              weight: 5,
              opacity: 0.8,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        )}
        
        {driverLocation && (
          <Marker 
            position={[driverLocation.lat, driverLocation.lng]} 
            icon={driverIcon}
          >
            <Popup>
              <div className="font-medium">Your Location</div>
              {driverLocation.label && (
                <div className="text-sm text-muted-foreground">{driverLocation.label}</div>
              )}
            </Popup>
          </Marker>
        )}
        
        {pickupLocation && (
          <Marker 
            position={[pickupLocation.lat, pickupLocation.lng]} 
            icon={pickupIcon}
          >
            <Popup>
              <div className="font-medium">Pickup Location</div>
              {pickupLocation.label && (
                <div className="text-sm text-muted-foreground">{pickupLocation.label}</div>
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
              <div className="font-medium">Dropoff Location</div>
              {dropoffLocation.label && (
                <div className="text-sm text-muted-foreground">{dropoffLocation.label}</div>
              )}
            </Popup>
          </Marker>
        )}
      </MapContainer>
      
      {activeLeg !== "completed" && (
        <div className="absolute bottom-3 left-3 right-3 z-[1000] flex gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-background/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-md border text-xs">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>Driver</span>
          </div>
          <div className="flex items-center gap-1.5 bg-background/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-md border text-xs">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span>Pickup</span>
          </div>
          <div className="flex items-center gap-1.5 bg-background/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-md border text-xs">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span>Dropoff</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default SafeGoMap;
