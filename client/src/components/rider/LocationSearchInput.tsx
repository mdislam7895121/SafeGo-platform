import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Search,
  Loader2,
  Navigation,
  Home,
  Briefcase,
  Star,
  Clock,
  X,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  searchLocations,
  getPlaceDetails,
  getSavedPlaces,
  getRecentLocations,
  type SearchResult,
  type SavedPlace,
  type RecentLocation,
} from "@/lib/locationService";

interface LocationSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onLocationSelect: (location: { address: string; lat: number; lng: number; placeId?: string }) => void;
  onCurrentLocation?: () => void;
  isLoadingCurrentLocation?: boolean;
  placeholder?: string;
  variant?: "pickup" | "dropoff";
  showCurrentLocation?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function LocationSearchInput({
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
}: LocationSearchInputProps) {
  const { toast } = useToast();
  const [isFocused, setIsFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSavedPlaces(getSavedPlaces());
    setRecentLocations(getRecentLocations());
  }, []);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setFetchError(null);

    if (value.length >= 3) {
      setIsSearching(true);
      abortControllerRef.current = new AbortController();
      
      const timer = setTimeout(async () => {
        try {
          const results = await searchLocations(value, abortControllerRef.current?.signal);
          setSearchResults(results);
        } finally {
          setIsSearching(false);
        }
      }, 300);
      
      return () => {
        clearTimeout(timer);
        abortControllerRef.current?.abort();
      };
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectResult = useCallback(async (result: SearchResult) => {
    setSelectedPlaceId(result.placeId);
    setIsFetchingDetails(true);
    setFetchError(null);
    
    try {
      const details = await getPlaceDetails(result.placeId);
      
      if (details && details.lat && details.lng) {
        onLocationSelect({
          address: details.formattedAddress,
          lat: details.lat,
          lng: details.lng,
          placeId: result.placeId,
        });
        onChange(details.formattedAddress.split(",")[0]);
        setSearchResults([]);
        setIsFocused(false);
      } else {
        setFetchError("Unable to get location details. Please try again.");
        toast({
          title: "Location Error",
          description: "Could not get details for this location. Please try a different search.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching place details:", error);
      setFetchError("Failed to load location. Please try again.");
      toast({
        title: "Connection Error",
        description: "Could not connect to location service. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsFetchingDetails(false);
      setSelectedPlaceId(null);
    }
  }, [onLocationSelect, onChange, toast]);

  const handleSelectSavedPlace = useCallback((place: SavedPlace) => {
    if (place.lat === 0 && place.lng === 0) {
      return;
    }
    onLocationSelect({
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    });
    onChange(place.name);
    setIsFocused(false);
  }, [onLocationSelect, onChange]);

  const handleSelectRecent = useCallback((recent: RecentLocation) => {
    onLocationSelect({
      address: recent.address,
      lat: recent.lat,
      lng: recent.lng,
    });
    onChange(recent.address.split(",")[0]);
    setIsFocused(false);
  }, [onLocationSelect, onChange]);

  const getPlaceIcon = (icon: string) => {
    switch (icon) {
      case "home":
        return <Home className="h-4 w-4" />;
      case "work":
        return <Briefcase className="h-4 w-4" />;
      default:
        return <Star className="h-4 w-4" />;
    }
  };

  const showDropdown = isFocused && (
    value.length === 0 || 
    searchResults.length > 0 || 
    isSearching
  );

  const validSavedPlaces = savedPlaces.filter(p => p.lat !== 0 || p.lng !== 0);
  const showSuggestions = value.length < 3 && !isSearching;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <MapPin className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 ${
          variant === "pickup" ? "text-blue-500" : "text-red-500"
        }`} />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          className="pl-10 pr-10 h-12 text-base"
          data-testid={`input-${variant}-location`}
        />
        {value && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            data-testid={`button-clear-${variant}-input`}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {isSearching && (
          <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 max-h-[60vh] overflow-y-auto shadow-lg" data-testid={`${variant}-location-dropdown`}>
          <CardContent className="p-0 divide-y">
            {showCurrentLocation && showSuggestions && (
              <button
                className="w-full flex items-center gap-3 p-4 hover-elevate text-left"
                onClick={() => {
                  onCurrentLocation?.();
                  setIsFocused(false);
                }}
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
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            )}

            {showSuggestions && validSavedPlaces.length > 0 && (
              <div className="py-2">
                <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Saved Places
                </p>
                {savedPlaces.map((place) => (
                  <button
                    key={place.id}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover-elevate text-left ${
                      place.lat === 0 && place.lng === 0 ? "opacity-60" : ""
                    }`}
                    onClick={() => handleSelectSavedPlace(place)}
                    disabled={place.lat === 0 && place.lng === 0}
                    data-testid={`saved-place-${place.id}`}
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      place.icon === "home" ? "bg-green-100 dark:bg-green-900 text-green-600" :
                      place.icon === "work" ? "bg-purple-100 dark:bg-purple-900 text-purple-600" :
                      "bg-amber-100 dark:bg-amber-900 text-amber-600"
                    }`}>
                      {getPlaceIcon(place.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{place.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{place.address}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {showSuggestions && recentLocations.length > 0 && (
              <div className="py-2">
                <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Recent
                </p>
                {recentLocations.slice(0, 5).map((recent) => (
                  <button
                    key={recent.id}
                    className="w-full flex items-center gap-3 px-4 py-3 hover-elevate text-left"
                    onClick={() => handleSelectRecent(recent)}
                    data-testid={`recent-location-${recent.id}`}
                  >
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{recent.address}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="py-2">
                <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <span>Search Results</span>
                  <span className="text-xs font-normal opacity-60">powered by Google</span>
                </p>
                {fetchError && (
                  <div className="mx-4 mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    <span className="text-xs text-destructive">{fetchError}</span>
                  </div>
                )}
                {searchResults.map((result) => {
                  const isLoading = isFetchingDetails && selectedPlaceId === result.placeId;
                  const isDisabled = isLoading;
                  return (
                    <button
                      key={result.placeId}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover-elevate text-left transition-opacity ${isLoading ? "opacity-70 bg-muted/50" : ""}`}
                      onClick={() => handleSelectResult(result)}
                      disabled={isDisabled}
                      data-testid={`search-result-${result.placeId}`}
                    >
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        {isLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        ) : (
                          <MapPin className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {result.mainText && (
                          <p className="font-medium truncate">{result.mainText}</p>
                        )}
                        <p className={`text-sm truncate ${result.mainText ? "text-muted-foreground" : ""}`}>
                          {result.secondaryText || result.address}
                        </p>
                      </div>
                      {isLoading ? (
                        <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {isSearching && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isSearching && value.length >= 3 && searchResults.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Search className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No results found</p>
                <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
