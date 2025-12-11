/**
 * UnifiedAddressPanel - Single collapsible address panel for ALL devices
 * 
 * Features:
 * - Collapsible (expand/collapse with arrow)
 * - Shows pickup with blue dot, dropoff with red dot
 * - Swap button to swap pickup/dropoff
 * - Edit icon to open address editing
 * - Works identically on desktop and mobile (only sizing changes)
 * 
 * This component is UI-only - no business logic changes.
 */

import { useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp, Pencil, Navigation, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { GooglePlacesInput } from "./GooglePlacesInput";

interface LocationData {
  address: string;
  lat: number;
  lng: number;
  name?: string;
  placeId?: string;
}

interface UnifiedAddressPanelProps {
  pickup: LocationData | null;
  dropoff: LocationData | null;
  pickupQuery: string;
  dropoffQuery: string;
  onPickupQueryChange: (value: string) => void;
  onDropoffQueryChange: (value: string) => void;
  onPickupSelect: (location: { address: string; lat: number; lng: number; placeId?: string }) => void;
  onDropoffSelect: (location: { address: string; lat: number; lng: number; placeId?: string }) => void;
  onSwapAddresses?: () => void;
  onCurrentLocation?: () => void;
  isLocatingCurrentLocation?: boolean;
  locationError?: string | null;
  focusedField?: "pickup" | "dropoff" | null;
  onPickupFocus?: () => void;
  onPickupBlur?: () => void;
  onDropoffFocus?: () => void;
  onDropoffBlur?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
}

export function UnifiedAddressPanel({
  pickup,
  dropoff,
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
  isExpanded = true,
  onToggleExpand,
  className = "",
}: UnifiedAddressPanelProps) {
  const [internalExpanded, setInternalExpanded] = useState(true);
  const expanded = onToggleExpand ? isExpanded : internalExpanded;
  const toggleExpand = onToggleExpand ?? (() => setInternalExpanded(!internalExpanded));

  const hasPickup = pickup && pickup.address;
  const hasDropoff = dropoff && dropoff.address;
  const canSwap = hasPickup && hasDropoff;

  const formatShort = (location: LocationData | null): string => {
    if (!location) return "";
    if (location.name) return location.name;
    const parts = location.address.split(",");
    return parts[0]?.trim() || location.address;
  };

  return (
    <Card 
      className={`bg-white dark:bg-card shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-[#E5E7EB] dark:border-border overflow-hidden ${className}`}
      style={{ borderRadius: "16px" }}
      data-testid="unified-address-panel"
    >
      <CardContent className="p-0">
        {/* Header - always visible */}
        <div 
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={toggleExpand}
          data-testid="address-panel-header"
        >
          <p className="text-[0.9rem] font-semibold text-[#111827] dark:text-foreground">
            Plan your ride
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); toggleExpand(); }}
            className="h-8 w-8 rounded-full flex items-center justify-center bg-[#F3F4F6] dark:bg-muted hover:bg-[#E5E7EB] dark:hover:bg-muted/80 transition-colors"
            aria-label={expanded ? "Collapse panel" : "Expand panel"}
            data-testid="button-toggle-panel"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-[#6B7280]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[#6B7280]" />
            )}
          </button>
        </div>

        {/* Collapsed state - show compact summary */}
        {!expanded && (
          <div className="px-4 pb-3 border-t border-[#F3F4F6] dark:border-border/50">
            <div className="flex items-center gap-3 pt-3">
              {/* Pickup/Dropoff compact display */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: "#3B82F6" }} />
                  <span className="text-sm font-medium text-[#111827] dark:text-foreground truncate">
                    {formatShort(pickup) || "Set pickup"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: "#EF4444" }} />
                  <span className="text-sm font-medium text-[#111827] dark:text-foreground truncate">
                    {formatShort(dropoff) || "Set dropoff"}
                  </span>
                </div>
              </div>
              {/* Edit button */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpand(); }}
                className="h-8 w-8 rounded-full flex items-center justify-center bg-primary/10 hover:bg-primary/20 transition-colors flex-shrink-0"
                aria-label="Edit addresses"
                data-testid="button-edit-collapsed"
              >
                <Pencil className="h-4 w-4 text-primary" />
              </button>
            </div>
          </div>
        )}

        {/* Expanded state - full address inputs */}
        {expanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-[#F3F4F6] dark:border-border/50">
            {/* Pickup Row */}
            <div 
              className={`flex items-center gap-3 p-3 rounded-xl transition-all mt-3 ${
                focusedField === "pickup" 
                  ? "bg-[#EFF6FF] dark:bg-blue-900/20 border border-[#2563EB]" 
                  : "bg-muted/30 hover:bg-muted/50 border border-transparent"
              }`}
              data-testid="address-row-pickup"
            >
              {/* Blue dot icon */}
              <div 
                className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "#EFF6FF" }}
              >
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: "#2563EB" }} />
              </div>

              {/* Input */}
              <div className="flex-1 min-w-0">
                <p className="text-[0.7rem] font-medium text-[#6B7280] dark:text-muted-foreground uppercase tracking-wide mb-0.5">
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
                  inputClassName="border-0 bg-transparent p-0 h-auto text-[0.9rem] font-medium text-[#111827] dark:text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0 truncate"
                />
              </div>

              {/* Swap button */}
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

            {/* Dropoff Row */}
            <div 
              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                focusedField === "dropoff" 
                  ? "bg-[#FEF2F2] dark:bg-red-900/20 border border-[#DC2626]" 
                  : "bg-muted/30 hover:bg-muted/50 border border-transparent"
              }`}
              data-testid="address-row-dropoff"
            >
              {/* Red dot icon */}
              <div 
                className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "#FEF2F2" }}
              >
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: "#DC2626" }} />
              </div>

              {/* Input */}
              <div className="flex-1 min-w-0">
                <p className="text-[0.7rem] font-medium text-[#6B7280] dark:text-muted-foreground uppercase tracking-wide mb-0.5">
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
                  inputClassName="border-0 bg-transparent p-0 h-auto text-[0.9rem] font-medium text-[#111827] dark:text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0 truncate"
                />
              </div>

              {/* Placeholder for alignment */}
              {onSwapAddresses && <div className="h-8 w-8 flex-shrink-0" />}
            </div>

            {/* Location error */}
            {locationError && (
              <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-600 dark:text-red-400">
                {locationError}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
