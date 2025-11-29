/**
 * MobileAddressCapsule - Uber-style unified address capsule for mobile
 * 
 * A single, reusable component for all mobile screens:
 * - Screen 1 (Plan Your Ride): Editing mode with full address inputs
 * - Screen 2 (Choose Your Ride): Collapsed mode showing compact summary
 * - Screen 3 (Choose Your Route): Collapsed mode on route screen
 * 
 * Styling per specification:
 * - Width: 92% viewport (4% margin each side)
 * - Height: 56-64px for collapsed, taller for editing
 * - Border radius: 9999px (fully rounded capsule)
 * - Shadow: 0px 4px 12px rgba(0,0,0,0.08)
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

interface MobileAddressCapsuleProps {
  pickup: LocationData | null;
  dropoff: LocationData | null;
  mode: "editing" | "collapsed";
  onEdit: () => void;
  className?: string;
}

export function MobileAddressCapsule({
  pickup,
  dropoff,
  mode,
  onEdit,
  className = "",
}: MobileAddressCapsuleProps) {
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

  // In editing mode, this component is not rendered (RideAddressHeader is used instead)
  // So we only handle collapsed mode here
  if (mode === "editing") {
    return null;
  }

  return (
    <div
      className={`bg-white dark:bg-card ${className}`}
      style={{ 
        width: "92%",
        marginLeft: "4%",
        marginRight: "4%",
        boxShadow: "0px 4px 12px rgba(0,0,0,0.08)",
        border: "1px solid #E5E7EB",
        borderRadius: isExpanded ? "16px" : "9999px",
        minHeight: isExpanded ? "auto" : "56px",
        maxHeight: isExpanded ? "auto" : "64px",
      }}
      data-testid="mobile-address-capsule"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Address Content */}
        <div 
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
          data-testid="capsule-toggle"
        >
          {/* Collapsed View - Two compact lines */}
          {!isExpanded ? (
            <div className="flex flex-col gap-0.5">
              {/* Pickup Line */}
              <div className="flex items-center gap-2">
                <div 
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: "#3B82F6" }}
                />
                <span 
                  className="text-[14px] font-medium text-[#111827] dark:text-foreground truncate"
                  data-testid="text-pickup-short"
                >
                  {pickupShort}
                </span>
              </div>
              {/* Dropoff Line */}
              <div className="flex items-center gap-2">
                <div 
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: "#EF4444" }}
                />
                <span 
                  className="text-[14px] font-medium text-[#111827] dark:text-foreground truncate"
                  data-testid="text-dropoff-short"
                >
                  {dropoffShort}
                </span>
              </div>
            </div>
          ) : (
            /* Expanded View - Full addresses with labels */
            <div className="flex flex-col gap-2 py-1">
              {/* Pickup Full */}
              <div className="flex items-start gap-2">
                <div 
                  className="h-2 w-2 rounded-full flex-shrink-0 mt-1.5"
                  style={{ backgroundColor: "#3B82F6" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wide">
                    Pickup
                  </p>
                  <p 
                    className="text-[14px] font-medium text-[#111827] dark:text-foreground leading-snug"
                    data-testid="text-pickup-full"
                  >
                    {pickupFull}
                  </p>
                </div>
              </div>
              {/* Dropoff Full */}
              <div className="flex items-start gap-2">
                <div 
                  className="h-2 w-2 rounded-full flex-shrink-0 mt-1.5"
                  style={{ backgroundColor: "#EF4444" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wide">
                    Dropoff
                  </p>
                  <p 
                    className="text-[14px] font-medium text-[#111827] dark:text-foreground leading-snug"
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
            className="h-8 w-8 rounded-full flex items-center justify-center bg-[#F3F4F6] dark:bg-muted hover:bg-[#E5E7EB] dark:hover:bg-muted/80 transition-colors"
            aria-label={isExpanded ? "Collapse addresses" : "Expand addresses"}
            data-testid="button-expand-collapse"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-[#6B7280]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[#6B7280]" />
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

// Also export the old name for backwards compatibility
export { MobileAddressCapsule as AddressSummaryCapsule };
