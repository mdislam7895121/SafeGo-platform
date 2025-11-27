import { useState, useEffect, useMemo } from "react";
import { MapPin, Navigation, AlertCircle, Loader2 } from "lucide-react";

interface TripRequestMapPreviewProps {
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  pickupAddress: string;
  dropoffAddress: string;
}

export function TripRequestMapPreview({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  pickupAddress,
  dropoffAddress,
}: TripRequestMapPreviewProps) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);

  const hasValidCoordinates = useMemo(() => {
    return pickupLat !== null && pickupLng !== null;
  }, [pickupLat, pickupLng]);

  const mapUrl = useMemo(() => {
    if (!hasValidCoordinates) return null;
    
    const zoom = 14;
    const width = 400;
    const height = 200;
    
    return `https://tile.openstreetmap.org/${zoom}/${Math.floor((pickupLng! + 180) / 360 * Math.pow(2, zoom))}/${Math.floor((1 - Math.log(Math.tan(pickupLat! * Math.PI / 180) + 1 / Math.cos(pickupLat! * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))}.png`;
  }, [hasValidCoordinates, pickupLat, pickupLng]);

  if (!hasValidCoordinates) {
    return (
      <div 
        className="relative h-32 rounded-xl overflow-hidden border-2 border-border bg-muted"
        data-testid="map-preview-fallback"
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <MapPin className="h-8 w-8 text-green-500 mb-2" />
          <p className="text-xs text-muted-foreground text-center px-4 line-clamp-2">
            {pickupAddress}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative h-32 rounded-xl overflow-hidden border-2 border-border bg-muted"
      data-testid="map-preview-container"
    >
      <div className="absolute inset-0 flex items-center justify-center bg-muted">
        <div className="flex flex-col items-center text-center px-4">
          <div className="relative mb-2">
            <MapPin className="h-8 w-8 text-green-500" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          </div>
          <p className="text-xs font-medium line-clamp-1">{pickupAddress}</p>
          
          {dropoffLat && dropoffLng && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <Navigation className="h-3 w-3" />
              <span className="line-clamp-1">{dropoffAddress}</span>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-2 right-2">
        <div className="bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          <span>Pickup location</span>
        </div>
      </div>
    </div>
  );
}

export default TripRequestMapPreview;
