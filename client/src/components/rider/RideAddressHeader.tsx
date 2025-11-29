/**
 * RideAddressHeader - Professional Uber-grade address input card
 * 
 * This component is UI-only and contains no business logic.
 * All address search, geocoding, autofill, and location handling is managed by the parent.
 * The component receives all logic as props and only calls the existing handlers.
 */

import { ArrowUpDown, MapPin, Navigation } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { GooglePlacesInput } from "./GooglePlacesInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface LocationData {
  address: string;
  lat: number;
  lng: number;
  name?: string;
  placeId?: string;
}

interface RideAddressHeaderProps {
  pickupQuery: string;
  dropoffQuery: string;
  onPickupQueryChange: (value: string) => void;
  onDropoffQueryChange: (value: string) => void;
  onPickupSelect: (location: {
    address: string;
    lat: number;
    lng: number;
    placeId?: string;
  }) => void;
  onDropoffSelect: (location: {
    address: string;
    lat: number;
    lng: number;
    placeId?: string;
  }) => void;
  onSwapAddresses?: () => void;
  onCurrentLocation?: () => void;
  isLocatingCurrentLocation?: boolean;
  locationError?: string | null;
  focusedField?: "pickup" | "dropoff" | null;
  onPickupFocus?: () => void;
  onPickupBlur?: () => void;
  onDropoffFocus?: () => void;
  onDropoffBlur?: () => void;
  pickup?: LocationData | null;
  dropoff?: LocationData | null;
  className?: string;
}

export function RideAddressHeader({
  pickupQuery,
  dropoffQuery,
  onPickupQueryChange,
  onDropoffQueryChange,
  onPickupSelect,
  onDropoffSelect,
  onSwapAddresses,
  onCurrentLocation,
  isLocatingCurrentLocation = false,
  locationError,
  focusedField,
  onPickupFocus,
  onPickupBlur,
  onDropoffFocus,
  onDropoffBlur,
  pickup,
  dropoff,
  className = "",
}: RideAddressHeaderProps) {
  const hasPickup = pickup && pickup.address;
  const hasDropoff = dropoff && dropoff.address;
  const canSwap = hasPickup && hasDropoff;

  return (
    <Card 
      className={`bg-white dark:bg-card shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#E5E7EB] dark:border-border ${className}`}
      style={{ borderRadius: "16px" }}
      data-testid="ride-address-header"
    >
      <CardContent className="p-4">
        {/* Title */}
        <p className="text-[0.9rem] font-semibold text-[#111827] dark:text-foreground mb-3">
          Plan your ride
        </p>

        {/* Address rows container */}
        <div className="space-y-3">
          {/* Pickup Row */}
          <div 
            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
              focusedField === "pickup" 
                ? "bg-[#EFF6FF] dark:bg-blue-900/20 border border-[#2563EB]" 
                : "bg-muted/30 hover:bg-muted/50 border border-transparent"
            }`}
            data-testid="address-row-pickup"
          >
            {/* Left Icon */}
            <div 
              className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#EFF6FF" }}
            >
              <div 
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: "#2563EB" }}
              />
            </div>

            {/* Text Block / Input */}
            <div className="flex-1 min-w-0">
              <p className="text-[0.75rem] font-medium text-[#6B7280] dark:text-muted-foreground uppercase tracking-wide mb-0.5">
                Pickup
              </p>
              <GooglePlacesInput
                value={pickupQuery}
                onChange={onPickupQueryChange}
                onLocationSelect={onPickupSelect}
                onCurrentLocation={onCurrentLocation}
                isLoadingCurrentLocation={isLocatingCurrentLocation}
                placeholder={isLocatingCurrentLocation ? "Getting location..." : "Enter pickup location"}
                variant="pickup"
                showCurrentLocation={true}
                hideIcon={true}
                onFocus={onPickupFocus}
                onBlur={onPickupBlur}
                className="w-full"
                inputClassName="border-0 bg-transparent p-0 h-auto text-[0.95rem] font-medium text-[#111827] dark:text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0 truncate"
              />
            </div>

            {/* Swap Button (only on pickup row) */}
            {onSwapAddresses && (
              <button
                onClick={onSwapAddresses}
                disabled={!canSwap}
                className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  canSwap 
                    ? "bg-[#F3F4F6] dark:bg-muted hover:bg-[#E5E7EB] dark:hover:bg-muted/80 cursor-pointer" 
                    : "bg-[#F3F4F6] dark:bg-muted/50 opacity-50 cursor-not-allowed"
                }`}
                title="Swap pickup and dropoff"
                aria-label="Swap pickup and dropoff"
                data-testid="button-swap-addresses"
              >
                <ArrowUpDown className="h-4 w-4 text-[#6B7280] dark:text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Divider for mobile */}
          <hr className="border-[#E5E7EB] dark:border-border md:hidden" />

          {/* Dropoff Row */}
          <div 
            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
              focusedField === "dropoff" 
                ? "bg-[#FEF2F2] dark:bg-red-900/20 border border-[#DC2626]" 
                : "bg-muted/30 hover:bg-muted/50 border border-transparent"
            }`}
            data-testid="address-row-dropoff"
          >
            {/* Left Icon */}
            <div 
              className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#FEF2F2" }}
            >
              <div 
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: "#DC2626" }}
              />
            </div>

            {/* Text Block / Input */}
            <div className="flex-1 min-w-0">
              <p className="text-[0.75rem] font-medium text-[#6B7280] dark:text-muted-foreground uppercase tracking-wide mb-0.5">
                Dropoff
              </p>
              <GooglePlacesInput
                value={dropoffQuery}
                onChange={onDropoffQueryChange}
                onLocationSelect={onDropoffSelect}
                placeholder="Where to?"
                variant="dropoff"
                showCurrentLocation={false}
                hideIcon={true}
                onFocus={onDropoffFocus}
                onBlur={onDropoffBlur}
                className="w-full"
                inputClassName="border-0 bg-transparent p-0 h-auto text-[0.95rem] font-medium text-[#111827] dark:text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0 truncate"
              />
            </div>

            {/* Placeholder for alignment with pickup row swap button */}
            {onSwapAddresses && <div className="h-8 w-8 flex-shrink-0" />}
          </div>
        </div>

        {/* Location Error */}
        {locationError && (
          <Alert variant="destructive" className="mt-3" data-testid="location-error">
            <AlertCircle className="h-3 w-3" />
            <AlertDescription className="text-xs">{locationError}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
