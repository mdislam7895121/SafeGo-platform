import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MapPin,
  ArrowLeft,
  Clock,
  Search,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { useRideBooking } from "@/contexts/RideBookingContext";
import { SafeGoMap } from "@/components/maps/SafeGoMap";

interface SearchResult {
  placeId: string;
  address: string;
  lat: number;
  lng: number;
}

const mockSearchResults: SearchResult[] = [
  { placeId: "1", address: "Bashundhara City Shopping Mall, Dhaka", lat: 23.7509, lng: 90.3935 },
  { placeId: "2", address: "Dhaka Airport Terminal 1", lat: 23.8423, lng: 90.3976 },
  { placeId: "3", address: "Gulshan 2 Circle, Dhaka", lat: 23.7934, lng: 90.4144 },
  { placeId: "4", address: "Dhanmondi 27, Dhaka", lat: 23.7506, lng: 90.3746 },
  { placeId: "5", address: "Mirpur 10, Dhaka", lat: 23.8069, lng: 90.3686 },
];

export default function RideDropoffPage() {
  const [, setLocation] = useLocation();
  const { state, setDropoff, setStep, canProceedToDropoff, canProceedToOptions } = useRideBooking();
  
  const [searchQuery, setSearchQuery] = useState(state.dropoff?.address || "");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!canProceedToDropoff) {
      setLocation("/rider/ride/pickup");
      return;
    }
    setStep("dropoff");
  }, [setStep, canProceedToDropoff, setLocation]);

  useEffect(() => {
    if (searchQuery.length >= 3) {
      setIsSearching(true);
      setShowResults(true);
      const timer = setTimeout(() => {
        const filtered = mockSearchResults.filter(r => 
          r.address.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setSearchResults(filtered.length > 0 ? filtered : mockSearchResults.slice(0, 3));
        setIsSearching(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  }, [searchQuery]);

  const handleSelectResult = (result: SearchResult) => {
    setDropoff({
      address: result.address,
      lat: result.lat,
      lng: result.lng,
      placeId: result.placeId,
    });
    setSearchQuery(result.address);
    setShowResults(false);
  };

  const handleConfirmDropoff = () => {
    if (canProceedToOptions) {
      setLocation("/rider/ride/options");
    }
  };

  const handleBack = () => {
    setLocation("/rider/ride/pickup");
  };

  return (
    <div className="flex flex-col h-full" data-testid="ride-dropoff-page">
      <div className="p-4 border-b bg-background">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-back-dropoff">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold" data-testid="text-dropoff-title">Set Dropoff Location</h1>
            <p className="text-sm text-muted-foreground">Search for your destination</p>
          </div>
        </div>

        <Card className="mb-3 bg-muted/50">
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-white">A</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Pickup</p>
                <p className="text-sm font-medium truncate" data-testid="text-pickup-summary">
                  {state.pickup?.address || "Not set"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-red-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Where are you going?"
            className="pl-10"
            data-testid="input-dropoff-search"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {showResults && searchResults.length > 0 && (
          <Card className="mt-2 max-h-60 overflow-y-auto">
            <CardContent className="p-0 divide-y">
              {searchResults.map((result) => (
                <button
                  key={result.placeId}
                  className="w-full flex items-center gap-3 p-3 hover-elevate text-left"
                  onClick={() => handleSelectResult(result)}
                  data-testid={`search-result-${result.placeId}`}
                >
                  <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm truncate flex-1">{result.address}</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex-1 relative min-h-[250px]">
        <SafeGoMap
          pickupLocation={state.pickup ? {
            lat: state.pickup.lat,
            lng: state.pickup.lng,
            label: "Pickup",
          } : null}
          dropoffLocation={state.dropoff ? {
            lat: state.dropoff.lat,
            lng: state.dropoff.lng,
            label: "Dropoff",
          } : null}
          showControls={true}
          className="h-full w-full"
        />
      </div>

      <div className="p-4 border-t bg-background space-y-3">
        {state.dropoff && (
          <Card className="bg-muted/50">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white">B</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Dropoff location</p>
                  <p className="text-sm text-muted-foreground truncate" data-testid="text-selected-dropoff">
                    {state.dropoff.address}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Button
          className="w-full"
          size="lg"
          disabled={!canProceedToOptions}
          onClick={handleConfirmDropoff}
          data-testid="button-see-ride-options"
        >
          See Ride Options
        </Button>
      </div>
    </div>
  );
}
