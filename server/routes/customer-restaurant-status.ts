import { Router } from "express";
import { prisma } from "../db";
import type { AuthRequest } from "../middleware/auth";

const router = Router();

// Helper function to map JS day to DayOfWeek enum
function getDayOfWeekEnum(jsDay: number): string {
  const dayMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return dayMap[jsDay];
}

// Helper function to check if restaurant is currently open
function isRestaurantOpen(hours: any[], currentTime: Date): { isOpen: boolean; todayHours: any | null } {
  const dayOfWeekEnum = getDayOfWeekEnum(currentTime.getDay());
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

  const todayHours = hours.find(h => h.dayOfWeek === dayOfWeekEnum);
  
  if (!todayHours || todayHours.isClosed) {
    return { isOpen: false, todayHours };
  }

  // Check main shift
  if (todayHours.openTime1 && todayHours.closeTime1) {
    if (currentTimeStr >= todayHours.openTime1 && currentTimeStr < todayHours.closeTime1) {
      return { isOpen: true, todayHours };
    }
  }

  // Check second shift (split shift)
  if (todayHours.openTime2 && todayHours.closeTime2) {
    if (currentTimeStr >= todayHours.openTime2 && currentTimeStr < todayHours.closeTime2) {
      return { isOpen: true, todayHours };
    }
  }

  return { isOpen: false, todayHours };
}

// Helper function to check surge pricing
function calculateSurgePricing(surge: any, currentTime: Date): { isActive: boolean; multiplier: number } {
  if (!surge || !surge.surgeEnabled) {
    return { isActive: false, multiplier: 1.0 };
  }

  const dayOfWeek = currentTime.getDay(); // 0 = Sunday, 6 = Saturday
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

  // Check weekend surge
  if (surge.weekendEnabled && (dayOfWeek === 0 || dayOfWeek === 6)) {
    return { isActive: true, multiplier: surge.weekendMultiplier || 1.0 };
  }

  // Check peak hours surge
  if (surge.peakHoursStart && surge.peakHoursEnd) {
    if (currentTimeStr >= surge.peakHoursStart && currentTimeStr < surge.peakHoursEnd) {
      return { isActive: true, multiplier: surge.surgeMultiplier || 1.0 };
    }
  }

  return { isActive: false, multiplier: 1.0 };
}

// ====================================================
// GET /api/customer/restaurants/:id/operational-status
// Get operational status for a restaurant (customer-facing)
// ====================================================
router.get("/:id/operational-status", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.query; // Customer's delivery location

    // Get restaurant basic info
    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
      select: {
        id: true,
        restaurantName: true,
        isVerified: true,
      },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Get operational settings
    const operational = await prisma.operationalSettings.findUnique({
      where: { restaurantId: id },
    });

    // Get business hours
    const hours = await prisma.restaurantHours.findMany({
      where: { restaurantId: id },
      orderBy: { dayOfWeek: 'asc' },
    });

    // Get delivery zones
    const zones = await prisma.deliveryZone.findMany({
      where: { restaurantId: id },
    });

    // Get surge settings
    const surge = await prisma.surgeSettings.findUnique({
      where: { restaurantId: id },
    });

    const currentTime = new Date();
    
    // Check if restaurant is currently open
    const { isOpen, todayHours } = isRestaurantOpen(hours, currentTime);

    // Check if temporarily closed (admin/owner override)
    const isTemporarilyClosed = operational?.temporarilyClosed || false;
    const temporaryCloseReason = operational?.temporaryCloseReason || null;

    // Count active orders for throttling check
    const activeOrderCount = await prisma.foodOrder.count({
      where: {
        restaurantId: id,
        status: {
          in: ['placed', 'confirmed', 'preparing', 'ready_for_pickup'],
        },
      },
    });

    const maxConcurrentOrders = operational?.maxConcurrentOrders;
    const isThrottled = maxConcurrentOrders ? activeOrderCount >= maxConcurrentOrders : false;

    // Calculate surge pricing
    const surgePricing = calculateSurgePricing(surge, currentTime);

    // Check delivery zone (if lat/lng provided)
    let deliveryZoneInfo = null;
    if (lat && lng) {
      const customerLat = parseFloat(lat as string);
      const customerLng = parseFloat(lng as string);

      // For now, use simple radius-based checking
      // In production, you'd use proper geospatial queries
      const matchingZone = zones.find((zone: any) => {
        if (!zone.radiusKm) return false;
        
        // Simple distance calculation (Haversine would be better)
        // This is approximate and assumes small distances
        const R = 6371; // Earth's radius in km
        const dLat = ((customerLat - (restaurant as any).latitude) * Math.PI) / 180;
        const dLng = ((customerLng - (restaurant as any).longitude) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance <= zone.radiusKm;
      });

      if (matchingZone) {
        deliveryZoneInfo = {
          zoneName: matchingZone.zoneName,
          baseFee: matchingZone.baseFee,
          feePerKm: matchingZone.feePerKm,
          estimatedMinutes: matchingZone.estimatedMinutes,
        };
      }
    }

    // Final status calculation
    const canAcceptOrders = 
      restaurant.isVerified &&
      !isTemporarilyClosed &&
      isOpen &&
      !isThrottled &&
      (operational?.deliveryEnabled || operational?.pickupEnabled);

    res.json({
      status: {
        isVerified: restaurant.isVerified,
        isOpen,
        isTemporarilyClosed,
        temporaryCloseReason,
        canAcceptOrders,
        isThrottled,
        activeOrderCount,
        maxConcurrentOrders,
      },
      todayHours: todayHours ? {
        isClosed: todayHours.isClosed,
        openTime1: todayHours.openTime1,
        closeTime1: todayHours.closeTime1,
        openTime2: todayHours.openTime2,
        closeTime2: todayHours.closeTime2,
      } : null,
      hours: hours.map((h: any) => ({
        dayOfWeek: h.dayOfWeek,
        isClosed: h.isClosed,
        openTime1: h.openTime1,
        closeTime1: h.closeTime1,
        openTime2: h.openTime2,
        closeTime2: h.closeTime2,
      })),
      operational: operational ? {
        deliveryEnabled: operational.deliveryEnabled,
        pickupEnabled: operational.pickupEnabled,
        preparationTimeMinutes: operational.preparationTimeMinutes,
        minOrderAmount: operational.minOrderAmount,
      } : null,
      surgePricing: {
        isActive: surgePricing.isActive,
        multiplier: surgePricing.multiplier,
      },
      deliveryZone: deliveryZoneInfo,
    });
  } catch (error) {
    console.error("Get operational status error:", error);
    res.status(500).json({ error: "Failed to get operational status" });
  }
});

export default router;
