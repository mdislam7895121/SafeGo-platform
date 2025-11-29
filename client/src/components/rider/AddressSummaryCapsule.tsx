/**
 * AddressSummaryCapsule - Compact Uber-style address summary for mobile
 * 
 * Used on Screen 2 (Choose Your Ride) and Screen 3 (Choose Your Route)
 * Shows a compact 2-line summary of pickup and dropoff with expand/collapse.
 * Tapping Edit returns user to Screen 1 (Plan Your Ride).
 * 
 * This component is UI-only - no business logic changes.
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react";

interface LocationData {
  address: string;
  lat: number;
  lng: number;
  name?: string;
}

interface AddressSummaryCapsuleProps {
  pickup: LocationData | null;
  dropoff: LocationData | null;
  onEdit: () => void;
  className?: string;
}

export function AddressSummaryCapsule({
  pickup,
  dropoff,
  onEdit,
  className = "",
}: AddressSummaryCapsuleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Format address for display - show short version by default
  const formatShort = (location: LocationData | null): string => {
    if (!location) return "Not set";
    // Show name if available, otherwise first part of address
    if (location.name) return location.name;
    const parts = location.address.split(",");
    return parts[0]?.trim() || location.address;
  };

  // Format full address for expanded view
  const formatFull = (location: LocationData | null): string => {
    if (!location) return "Not set";
    return location.address;
  };

  const pickupShort = formatShort(pickup);
  const dropoffShort = formatShort(dropoff);
  const pickupFull = formatFull(pickup);
  const dropoffFull = formatFull(dropoff);

  return (
    <div
      className={`bg-white dark:bg-card rounded-full px-4 py-3 ${className}`}
      style={{ 
        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        borderRadius: isExpanded ? "16px" : "9999px"
      }}
      data-testid="address-summary-capsule"
    >
      <div className="flex items-center gap-3">
        {/* Address Summary Content */}
        <div 
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
          data-testid="capsule-toggle"
        >
          {/* Collapsed View - Two lines */}
          {!isExpanded ? (
            <div className="flex flex-col gap-1">
              {/* Pickup Line */}
              <div className="flex items-center gap-2">
                <div 
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: "#3B82F6" }}
                />
                <span 
                  className="text-[15px] font-medium text-foreground truncate"
                  data-testid="text-pickup-short"
                >
                  {pickupShort}
                </span>
              </div>
              {/* Dropoff Line */}
              <div className="flex items-center gap-2">
                <div 
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: "#EF4444" }}
                />
                <span 
                  className="text-[15px] font-medium text-foreground truncate"
                  data-testid="text-dropoff-short"
                >
                  {dropoffShort}
                </span>
              </div>
            </div>
          ) : (
            /* Expanded View - Full addresses */
            <div className="flex flex-col gap-2 py-1">
              {/* Pickup Full */}
              <div className="flex items-start gap-2">
                <div 
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0 mt-1.5"
                  style={{ backgroundColor: "#3B82F6" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Pickup
                  </p>
                  <p 
                    className="text-[15px] font-medium text-foreground leading-snug"
                    data-testid="text-pickup-full"
                  >
                    {pickupFull}
                  </p>
                </div>
              </div>
              {/* Dropoff Full */}
              <div className="flex items-start gap-2">
                <div 
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0 mt-1.5"
                  style={{ backgroundColor: "#EF4444" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Dropoff
                  </p>
                  <p 
                    className="text-[15px] font-medium text-foreground leading-snug"
                    data-testid="text-dropoff-full"
                  >
                    {dropoffFull}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Expand/Collapse Chevron */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 rounded-full flex items-center justify-center bg-muted/50 hover:bg-muted transition-colors"
            aria-label={isExpanded ? "Collapse addresses" : "Expand addresses"}
            data-testid="button-expand-collapse"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {/* Edit Button */}
          <button
            onClick={onEdit}
            className="h-8 w-8 rounded-full flex items-center justify-center bg-primary/10 hover:bg-primary/20 transition-colors"
            aria-label="Edit addresses"
            data-testid="button-edit-addresses"
          >
            <Pencil className="h-4 w-4 text-primary" />
          </button>
        </div>
      </div>
    </div>
  );
}
