import { useRef, useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, X, Navigation } from "lucide-react";
import { usePlacesAutocomplete, useGoogleMaps } from "@/hooks/useGoogleMaps";

interface GooglePlacesInputProps {
  value: string;
  onChange: (value: string) => void;
  onLocationSelect: (location: {
    address: string;
    lat: number;
    lng: number;
    placeId?: string;
  }) => void;
  onCurrentLocation?: () => void;
  isLoadingCurrentLocation?: boolean;
  placeholder?: string;
  variant?: "pickup" | "dropoff";
  showCurrentLocation?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function GooglePlacesInput({
  value,
  onChange,
  onLocationSelect,
  onCurrentLocation,
  isLoadingCurrentLocation = false,
  placeholder = "Search location...",
  variant = "pickup",
  showCurrentLocation = true,
  autoFocus = false,
  className = "",
}: GooglePlacesInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const { isLoaded, isLoading: isLoadingMaps, error } = useGoogleMaps();

  const handlePlaceSelect = useCallback(
    (place: {
      address: string;
      lat: number;
      lng: number;
      placeId: string;
    }) => {
      onLocationSelect({
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        placeId: place.placeId,
      });
      onChange(place.address.split(",")[0]);
      setIsFocused(false);
    },
    [onLocationSelect, onChange]
  );

  usePlacesAutocomplete({
    inputRef,
    onPlaceSelect: handlePlaceSelect,
    options: {
      componentRestrictions: { country: "us" },
      types: ["geocode", "establishment"],
    },
  });

  useEffect(() => {
    if (autoFocus && inputRef.current && isLoaded) {
      inputRef.current.focus();
    }
  }, [autoFocus, isLoaded]);

  useEffect(() => {
    if (inputRef.current && isLoaded) {
      inputRef.current.value = value;
    }
  }, [value, isLoaded]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleClear = () => {
    onChange("");
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  };

  const handleCurrentLocation = () => {
    onCurrentLocation?.();
    setIsFocused(false);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <MapPin
          className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 ${
            variant === "pickup" ? "text-blue-500" : "text-red-500"
          }`}
        />
        <Input
          ref={inputRef}
          defaultValue={value}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder={isLoadingMaps ? "Loading maps..." : placeholder}
          className="pl-10 pr-10 h-12 text-base"
          disabled={!isLoaded || isLoadingMaps}
          data-testid={`input-${variant}-location`}
        />
        {isLoadingMaps && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {value && !isLoadingMaps && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={handleClear}
            data-testid={`button-clear-${variant}-input`}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showCurrentLocation && isFocused && isLoaded && (
        <div className="absolute top-full left-0 right-0 mt-1 z-[9999] bg-background border rounded-lg shadow-lg overflow-hidden">
          <button
            className="w-full flex items-center gap-3 p-4 hover-elevate text-left"
            onClick={handleCurrentLocation}
            disabled={isLoadingCurrentLocation}
            data-testid="button-use-current-location"
          >
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
              {isLoadingCurrentLocation ? (
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              ) : (
                <Navigation className="h-5 w-5 text-blue-600" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium">Use current location</p>
              <p className="text-sm text-muted-foreground">
                {isLoadingCurrentLocation ? "Getting location..." : "GPS location"}
              </p>
            </div>
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive mt-1" data-testid="text-maps-error">
          Maps unavailable: {error}
        </p>
      )}
    </div>
  );
}
