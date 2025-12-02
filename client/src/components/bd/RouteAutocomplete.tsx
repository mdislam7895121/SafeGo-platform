import { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { MapPin, ArrowRight, Clock, Bus, ArrowLeftRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BD_ROUTES,
  getUniqueOrigins,
  getDestinationsForOrigin,
  getRouteDetails,
  type BDRoute,
} from "@/lib/bd-routes";
import { searchBanglaWithFuzzy, normalizeBangla } from "@/lib/bangla-fuzzy";

interface RouteAutocompleteProps {
  type: "origin" | "destination";
  value: string;
  onChange: (value: string, valueBn?: string) => void;
  originValue?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  testIdPrefix?: string;
}

interface CityOption {
  en: string;
  bn: string;
}

export function RouteAutocomplete({
  type,
  value,
  onChange,
  originValue,
  placeholder,
  disabled,
  className,
  testIdPrefix = "route",
}: RouteAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(value || "");
  const [filteredOptions, setFilteredOptions] = useState<CityOption[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const allCities = useMemo(() => {
    return type === "origin" ? getUniqueOrigins() : getDestinationsForOrigin(originValue || "");
  }, [type, originValue]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredOptions(allCities.slice(0, 15));
    } else {
      const normalized = normalizeBangla(searchQuery);
      const results = searchBanglaWithFuzzy(
        allCities,
        normalized,
        (city) => [city.en, city.bn],
        0.4
      );
      setFilteredOptions(results.slice(0, 15));
    }
  }, [searchQuery, allCities]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setSearchQuery(value || "");
  }, [value]);

  const handleSelect = (city: CityOption) => {
    setSearchQuery(city.bn);
    onChange(city.bn, city.en);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSearchQuery("");
    onChange("");
    inputRef.current?.focus();
  };

  const defaultPlaceholder = type === "origin" ? "কোথা থেকে?" : "কোথায় যাবেন?";

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || defaultPlaceholder}
          className={cn("h-12 pl-10 pr-10 text-base", disabled && "opacity-50")}
          disabled={disabled}
          data-testid={`input-${testIdPrefix}-${type}`}
        />
        {searchQuery && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={handleClear}
            data-testid={`button-clear-${type}`}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <Card className="absolute z-50 mt-1 w-full shadow-lg border">
          <ScrollArea className="max-h-64">
            <div className="p-1">
              {filteredOptions.map((city, index) => (
                <button
                  key={`${city.en}-${index}`}
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-md",
                    "hover-elevate transition-colors",
                    searchQuery === city.bn && "bg-primary/10"
                  )}
                  onClick={() => handleSelect(city)}
                  data-testid={`option-${type}-${city.en.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium block truncate">{city.bn}</span>
                    <span className="text-xs text-muted-foreground">{city.en}</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>
      )}

      {isOpen && searchQuery.trim() !== "" && filteredOptions.length === 0 && (
        <Card className="absolute z-50 mt-1 w-full shadow-lg border p-4 text-center">
          <p className="text-muted-foreground text-sm">কোনো রুট পাওয়া যায়নি</p>
        </Card>
      )}
    </div>
  );
}

interface RouteSelectionProps {
  origin: string;
  destination: string;
  onOriginChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onSwap?: () => void;
  showRouteInfo?: boolean;
  className?: string;
}

export function RouteSelection({
  origin,
  destination,
  onOriginChange,
  onDestinationChange,
  onSwap,
  showRouteInfo = false,
  className,
}: RouteSelectionProps) {
  const [routeDetails, setRouteDetails] = useState<BDRoute | null>(null);

  useEffect(() => {
    if (origin && destination) {
      const details = getRouteDetails(origin, destination);
      setRouteDetails(details || null);
    } else {
      setRouteDetails(null);
    }
  }, [origin, destination]);

  const handleSwap = () => {
    if (onSwap) {
      onSwap();
    } else {
      const tempOrigin = origin;
      onOriginChange(destination);
      onDestinationChange(tempOrigin);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col md:flex-row gap-2 md:gap-3 items-start md:items-center">
        <div className="flex-1 w-full md:w-auto">
          <RouteAutocomplete
            type="origin"
            value={origin}
            onChange={onOriginChange}
            testIdPrefix="route"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 self-center"
          onClick={handleSwap}
          disabled={!origin && !destination}
          data-testid="button-swap-route"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </Button>

        <div className="flex-1 w-full md:w-auto">
          <RouteAutocomplete
            type="destination"
            value={destination}
            onChange={onDestinationChange}
            originValue={origin}
            testIdPrefix="route"
          />
        </div>
      </div>

      {showRouteInfo && routeDetails && (
        <Card className="p-3 bg-muted/30">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="font-medium">{routeDetails.fromBn}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{routeDetails.toBn}</span>
            </div>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{routeDetails.duration}</span>
            </div>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span>{routeDetails.distance}</span>
            </div>

            <div className="flex gap-1.5">
              {routeDetails.busTypes.map((type) => (
                <Badge key={type} variant="secondary" className="text-xs">
                  {type === "ac" && "এসি"}
                  {type === "non_ac" && "নন-এসি"}
                  {type === "sleeper" && "স্লিপার"}
                  {type === "coach" && "কোচ"}
                </Badge>
              ))}
            </div>

            <Badge
              variant={
                routeDetails.category === "intercity"
                  ? "default"
                  : routeDetails.category === "tourist"
                  ? "outline"
                  : "secondary"
              }
              className="text-xs"
            >
              {routeDetails.category === "intercity" && "আন্তঃনগর"}
              {routeDetails.category === "district" && "জেলা"}
              {routeDetails.category === "tourist" && "পর্যটন"}
            </Badge>
          </div>
        </Card>
      )}
    </div>
  );
}

export function PopularRoutes({
  onSelect,
  className,
}: {
  onSelect: (origin: string, destination: string) => void;
  className?: string;
}) {
  const popularRoutes = [
    { from: "ঢাকা", to: "চট্টগ্রাম" },
    { from: "ঢাকা", to: "সিলেট" },
    { from: "ঢাকা", to: "কক্সবাজার" },
    { from: "ঢাকা", to: "রাজশাহী" },
    { from: "চট্টগ্রাম", to: "ঢাকা" },
    { from: "সিলেট", to: "ঢাকা" },
    { from: "চট্টগ্রাম", to: "কক্সবাজার" },
    { from: "ঢাকা", to: "খুলনা" },
  ];

  return (
    <div className={cn("space-y-2", className)}>
      <h4 className="text-sm font-medium text-muted-foreground">জনপ্রিয় রুট</h4>
      <div className="flex flex-wrap gap-2">
        {popularRoutes.map((route, index) => (
          <Button
            key={index}
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={() => onSelect(route.from, route.to)}
            data-testid={`button-popular-route-${index}`}
          >
            {route.from} <ArrowRight className="h-3 w-3 mx-1" /> {route.to}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function CreateReverseRouteButton({
  origin,
  destination,
  onCreateReverse,
  className,
}: {
  origin: string;
  destination: string;
  onCreateReverse: (newOrigin: string, newDestination: string) => void;
  className?: string;
}) {
  if (!origin || !destination) return null;

  const reverseExists = getRouteDetails(destination, origin);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("gap-2", className)}
      onClick={() => onCreateReverse(destination, origin)}
      data-testid="button-create-reverse"
    >
      <ArrowLeftRight className="h-4 w-4" />
      রিভার্স রুট তৈরি করুন ({destination} → {origin})
      {reverseExists && (
        <Badge variant="secondary" className="ml-1 text-xs">
          বিদ্যমান
        </Badge>
      )}
    </Button>
  );
}
