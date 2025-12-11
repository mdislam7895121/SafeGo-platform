import { useMemo, useRef, useEffect, useState } from "react";
import { Marker, useMap } from "react-leaflet";
import L from "leaflet";

interface DraggableMarkerProps {
  position: { lat: number; lng: number };
  onDragEnd: (lat: number, lng: number) => void;
  variant: "pickup" | "dropoff";
  isDraggable?: boolean;
  showAnimation?: boolean;
}

const createMarkerIcon = (variant: "pickup" | "dropoff", isAnimating: boolean) => {
  const color = variant === "pickup" ? "#3B82F6" : "#EF4444";
  const gradientFrom = variant === "pickup" ? "#3B82F6" : "#EF4444";
  const gradientTo = variant === "pickup" ? "#2563EB" : "#DC2626";
  const label = variant === "pickup" ? "A" : "B";
  
  const animationStyle = isAnimating ? `
    animation: marker-drop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  ` : "";
  
  return L.divIcon({
    className: `safego-${variant}-marker-draggable`,
    html: `
      <div style="
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        ${animationStyle}
      ">
        <div style="
          background: linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%);
          width: 48px;
          height: 48px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 4px solid white;
          box-shadow: 0 4px 16px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="
            transform: rotate(45deg);
            color: white;
            font-weight: bold;
            font-size: 16px;
          ">${label}</span>
        </div>
        <div style="
          width: 4px;
          height: 8px;
          background: ${color};
          border-radius: 0 0 2px 2px;
          margin-top: -4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        "></div>
        <div style="
          width: 10px;
          height: 10px;
          background: ${color};
          border-radius: 50%;
          opacity: 0.3;
          margin-top: 2px;
        "></div>
      </div>
      <style>
        @keyframes marker-drop {
          0% { transform: translateY(-30px); opacity: 0; }
          60% { transform: translateY(5px); }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes marker-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .safego-${variant}-marker-draggable:active {
          cursor: grabbing;
        }
      </style>
    `,
    iconSize: [48, 66],
    iconAnchor: [24, 66],
    popupAnchor: [0, -66],
  });
};

export function DraggableMarker({
  position,
  onDragEnd,
  variant,
  isDraggable = true,
  showAnimation = false,
}: DraggableMarkerProps) {
  const [isAnimating, setIsAnimating] = useState(showAnimation);
  const markerRef = useRef<L.Marker>(null);
  const map = useMap();

  const icon = useMemo(() => createMarkerIcon(variant, isAnimating), [variant, isAnimating]);

  useEffect(() => {
    if (showAnimation) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 400);
      return () => clearTimeout(timer);
    }
  }, [showAnimation, position.lat, position.lng]);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker) {
          const latlng = marker.getLatLng();
          onDragEnd(latlng.lat, latlng.lng);
        }
      },
      drag() {
        const marker = markerRef.current;
        if (marker) {
          const pos = marker.getLatLng();
          map.panTo(pos, { animate: false });
        }
      },
    }),
    [onDragEnd, map]
  );

  return (
    <Marker
      ref={markerRef}
      position={[position.lat, position.lng]}
      icon={icon}
      draggable={isDraggable}
      eventHandlers={eventHandlers}
    />
  );
}

export default DraggableMarker;
