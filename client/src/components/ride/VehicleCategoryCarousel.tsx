/**
 * VehicleCategoryCarousel Component
 * 
 * C7 - SafeGo Ride Card Full Redesign
 * Horizontal scrollable carousel of vehicle categories with per-category pricing.
 * Supports both mobile (horizontal pills) and desktop (vertical cards) layouts.
 * Uber-quality design with consistent visual styling.
 */

import { useMemo } from "react";
import { 
  VehicleCategoryCard, 
  VehicleCategoryCardSkeleton,
  type CategoryAvailability,
} from "./VehicleCategoryCard";
import { 
  type VehicleCategoryId, 
  VEHICLE_CATEGORIES, 
  VEHICLE_CATEGORY_ORDER,
} from "@shared/vehicleCategories";
import type { RouteFareBreakdown } from "@/lib/fareTypes";

export interface CategoryAvailabilityInfo {
  categoryId: VehicleCategoryId;
  availability: CategoryAvailability;
  reason?: string;
}

export interface VehicleCategoryCarouselProps {
  selectedCategory: VehicleCategoryId;
  onSelectCategory: (categoryId: VehicleCategoryId) => void;
  getFareForCategory: (categoryId: VehicleCategoryId) => RouteFareBreakdown | null;
  isLoading: boolean;
  currency: string;
  promoCode?: string;
  promoDiscount?: number;
  categoryAvailability?: CategoryAvailabilityInfo[];
  variant?: "horizontal" | "vertical";
  baseEtaMinutes?: number;
}

export function VehicleCategoryCarousel({
  selectedCategory,
  onSelectCategory,
  getFareForCategory,
  isLoading,
  currency,
  promoCode,
  promoDiscount = 0,
  categoryAvailability = [],
  variant = "horizontal",
  baseEtaMinutes = 5,
}: VehicleCategoryCarouselProps) {
  const activeCategories = useMemo(() => {
    return VEHICLE_CATEGORY_ORDER.filter(
      (id) => VEHICLE_CATEGORIES[id]?.isActive
    );
  }, []);

  const availabilityMap = useMemo(() => {
    const map = new Map<VehicleCategoryId, CategoryAvailabilityInfo>();
    for (const info of categoryAvailability) {
      map.set(info.categoryId, info);
    }
    return map;
  }, [categoryAvailability]);

  const getCategoryAvailability = (categoryId: VehicleCategoryId): CategoryAvailability => {
    const info = availabilityMap.get(categoryId);
    return info?.availability ?? "available";
  };

  const getCategoryUnavailableReason = (categoryId: VehicleCategoryId): string | undefined => {
    const info = availabilityMap.get(categoryId);
    return info?.reason;
  };

  if (isLoading && activeCategories.length === 0) {
    return (
      <div className={variant === "horizontal" 
        ? "flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-4 px-4" 
        : "grid grid-cols-1 md:grid-cols-2 gap-3"
      }>
        {[1, 2, 3, 4, 5].map((i) => (
          <VehicleCategoryCardSkeleton 
            key={i} 
            variant={variant === "horizontal" ? "pill" : "card"} 
          />
        ))}
      </div>
    );
  }

  if (variant === "horizontal") {
    return (
      <div 
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-4 px-4"
        data-testid="category-carousel-horizontal"
      >
        {activeCategories.map((categoryId) => {
          const config = VEHICLE_CATEGORIES[categoryId];
          const fare = getFareForCategory(categoryId);
          const availability = getCategoryAvailability(categoryId);
          const unavailableReason = getCategoryUnavailableReason(categoryId);
          const etaMinutes = baseEtaMinutes + config.etaMinutesOffset;

          return (
            <VehicleCategoryCard
              key={categoryId}
              categoryId={categoryId}
              config={config}
              fare={fare?.totalFare ?? null}
              originalFare={fare?.totalFare}
              currency={currency}
              isSelected={categoryId === selectedCategory}
              isLoading={isLoading && fare === null}
              availability={availability}
              unavailableReason={unavailableReason}
              promoCode={promoCode}
              promoDiscount={promoDiscount}
              etaMinutes={etaMinutes}
              onSelect={onSelectCategory}
              variant="pill"
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="category-carousel-vertical">
      {activeCategories.map((categoryId) => {
        const config = VEHICLE_CATEGORIES[categoryId];
        const fare = getFareForCategory(categoryId);
        const availability = getCategoryAvailability(categoryId);
        const unavailableReason = getCategoryUnavailableReason(categoryId);
        const etaMinutes = baseEtaMinutes + config.etaMinutesOffset;

        return (
          <VehicleCategoryCard
            key={categoryId}
            categoryId={categoryId}
            config={config}
            fare={fare?.totalFare ?? null}
            originalFare={fare?.totalFare}
            currency={currency}
            isSelected={categoryId === selectedCategory}
            isLoading={isLoading && fare === null}
            availability={availability}
            unavailableReason={unavailableReason}
            promoCode={promoCode}
            promoDiscount={promoDiscount}
            etaMinutes={etaMinutes}
            onSelect={onSelectCategory}
            variant="card"
          />
        );
      })}
    </div>
  );
}

export function VehicleCategoryCarouselLoading({ variant = "horizontal" }: { variant?: "horizontal" | "vertical" }) {
  if (variant === "horizontal") {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <VehicleCategoryCardSkeleton key={i} variant="pill" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <VehicleCategoryCardSkeleton key={i} variant="card" />
      ))}
    </div>
  );
}
