import { useRef, useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, X, Navigation } from "lucide-react";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";

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
  onFocus?: () => void;
  onBlur?: () => void;
  inputClassName?: string;
  hideIcon?: boolean;
  dropdownZIndex?: number;
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
  onFocus,
  onBlur,
  inputClassName = "",
  hideIcon = false,
  dropdownZIndex = 25,
}: GooglePlacesInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const listenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const isSelectingRef = useRef(false);
  const [showCurrentLocationButton, setShowCurrentLocationButton] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const { isReady, isLoading: isLoadingMaps, error } = useGoogleMaps();

  // Initialize Google Places Autocomplete directly in this component
  // to properly handle the controlled input + autocomplete interaction
  useEffect(() => {
    if (!isReady || !inputRef.current || autocompleteRef.current) {
      return;
    }

    console.log("[GooglePlacesInput] Initializing Autocomplete widget...");

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry", "place_id", "name"],
      types: ["geocode", "establishment"],
      componentRestrictions: { country: "us" },
    });

    autocompleteRef.current = autocomplete;

    // Listen for clicks on the autocomplete dropdown BEFORE place_changed fires
    // This sets the flag early so handleInputChange knows to skip processing
    const handleDropdownClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Google's autocomplete dropdown has class "pac-container" and items have "pac-item"
      if (target.closest('.pac-container')) {
        console.log("[GooglePlacesInput] Dropdown clicked, setting selection flag");
        isSelectingRef.current = true;
      }
    };

    // Use capture phase to catch the event before Google processes it
    document.addEventListener('mousedown', handleDropdownClick, true);

    listenerRef.current = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      console.log("[GooglePlacesInput] place_changed fired:", place);

      if (!place.geometry?.location) {
        console.warn("[GooglePlacesInput] No geometry for selected place");
        // Reset flag if selection failed
        isSelectingRef.current = false;
        return;
      }

      const fullAddress = place.formatted_address || place.name || "";
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const placeId = place.place_id || "";

      console.log("[GooglePlacesInput] Calling onLocationSelect with:", { fullAddress, lat, lng, placeId });

      // Explicitly update the input DOM value to ensure React state syncs
      if (inputRef.current) {
        inputRef.current.value = fullAddress;
      }

      // Call onLocationSelect with full place data
      // The parent component is responsible for updating both the location AND the display address
      onLocationSelect({
        address: fullAddress,
        lat,
        lng,
        placeId,
      });

      setShowCurrentLocationButton(false);
      setIsFocused(false);

      // Reset flag after React has processed the state updates
      setTimeout(() => {
        isSelectingRef.current = false;
      }, 200);
    });

    console.log("[GooglePlacesInput] Autocomplete initialized successfully");

    return () => {
      document.removeEventListener('mousedown', handleDropdownClick, true);
      if (listenerRef.current && window.google?.maps?.event) {
        window.google.maps.event.removeListener(listenerRef.current);
        listenerRef.current = null;
      }
      autocompleteRef.current = null;
    };
  }, [isReady, onLocationSelect]);

  useEffect(() => {
    if (autoFocus && inputRef.current && isReady) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [autoFocus, isReady]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // If we're in the middle of selecting from autocomplete, don't process
    if (isSelectingRef.current) {
      return;
    }
    const newValue = e.target.value;
    onChange(newValue);
    setShowCurrentLocationButton(newValue.length === 0 && showCurrentLocation);
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    if (showCurrentLocation) {
      setShowCurrentLocationButton(true);
    }
    onFocus?.();
  };

  const handleInputBlur = () => {
    // Call parent onBlur immediately so it can manage its own timing
    onBlur?.();
    // Delay internal state updates to allow click events on current location button
    setTimeout(() => {
      setIsFocused(false);
      setShowCurrentLocationButton(false);
    }, 200);
  };

  const handleClear = () => {
    onChange("");
    // Focus back on input after clearing
    inputRef.current?.focus();
  };

  const handleCurrentLocation = () => {
    onCurrentLocation?.();
    setShowCurrentLocationButton(false);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        {!hideIcon && (
          <MapPin
            className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 z-10 ${
              variant === "pickup" ? "text-blue-500" : "text-red-500"
            }`}
          />
        )}
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={isLoadingMaps ? "Loading Google Maps..." : placeholder}
          className={`${hideIcon ? "pr-10" : "pl-10 pr-10"} h-12 text-base ${inputClassName}`}
          disabled={!isReady}
          autoComplete="off"
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
            type="button"
            data-testid={`button-clear-${variant}-input`}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showCurrentLocation && showCurrentLocationButton && isReady && isFocused && (
        <div className={`absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg overflow-hidden`} style={{ zIndex: dropdownZIndex }}>
          <button
            type="button"
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
