import { Router } from "express";
import { prisma } from "../db";
import { authenticateToken, type AuthRequest } from "../middleware/auth";

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// ====================================================
// PHASE 10: Restaurant Operational Settings System
// ====================================================

// Helper function to resolve restaurant ID for both OWNER and STAFF users
async function getRestaurantContext(userId: string) {
  const profile = await prisma.restaurantProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    return { error: "Restaurant profile not found", status: 404 };
  }

  const userRole = profile.ownerRole || "OWNER";
  const restaurantId = userRole === "STAFF" ? profile.managedByOwnerId! : profile.id;

  // Get owner profile for KYC check
  const ownerProfile = userRole === "STAFF"
    ? await prisma.restaurantProfile.findUnique({ where: { id: restaurantId } })
    : profile;

  if (!ownerProfile) {
    return { error: "Restaurant not found", status: 404 };
  }

  if (!ownerProfile.isVerified) {
    return {
      error: "Restaurant must complete KYC verification",
      status: 403,
      requiresVerification: true,
    };
  }

  return {
    profile,
    ownerProfile,
    restaurantId,
    userRole,
    isOwner: userRole === "OWNER",
  };
}

// ====================================================
// GET /api/restaurant/settings/hours
// Get restaurant hours schedule
// ====================================================
router.get("/hours", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "restaurant") {
      return res.status(403).json({ error: "Only restaurants can access settings" });
    }

    // Get restaurant context (handles OWNER and STAFF)
    const context = await getRestaurantContext(userId);
    
    if ('error' in context) {
      return res.status(context.status).json(
        context.requiresVerification 
          ? { error: context.error, requiresVerification: true }
          : { error: context.error }
      );
    }

    const { profile, restaurantId, userRole } = context;

    // RBAC: OWNER always allowed, STAFF requires analytics permission
    if (userRole === "STAFF" && !profile.canViewAnalytics) {
      return res.status(403).json({ error: "Insufficient permissions to view operational settings" });
    }

    // Get all hours for this restaurant
    const hours = await prisma.restaurantHours.findMany({
      where: { restaurantId },
      orderBy: { dayOfWeek: 'asc' },
    });

    // If no hours exist, create default (all days closed)
    // OWNER only can create defaults
    if (hours.length === 0 && userRole === "OWNER") {
      const daysOfWeek = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
      
      const defaultHours = await Promise.all(
        daysOfWeek.map((day) =>
          prisma.restaurantHours.create({
            data: {
              restaurantId,
              dayOfWeek: day,
              isClosed: true,
            },
          })
        )
      );

      return res.json({ hours: defaultHours });
    }

    res.json({ hours });
  } catch (error) {
    console.error("[Restaurant Settings] Get hours error:", error);
    res.status(500).json({ error: "Failed to fetch restaurant hours" });
  }
});

// ====================================================
// PATCH /api/restaurant/settings/hours
// Update restaurant hours schedule
// ====================================================
router.patch("/hours", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { hours } = req.body; // Array of hour updates

    if (role !== "restaurant") {
      return res.status(403).json({ error: "Only restaurants can update settings" });
    }

    if (!Array.isArray(hours)) {
      return res.status(400).json({ error: "Hours must be an array" });
    }

    // Get restaurant context (handles OWNER and STAFF)
    const context = await getRestaurantContext(userId);
    
    if ('error' in context) {
      return res.status(context.status).json(
        context.requiresVerification 
          ? { error: context.error, requiresVerification: true }
          : { error: context.error }
      );
    }

    const { restaurantId, isOwner } = context;

    // RBAC: Only OWNER can modify operational settings
    if (!isOwner) {
      return res.status(403).json({ error: "Only restaurant owners can modify operational settings" });
    }

    // Validate and update hours
    const updatedHours = [];
    
    for (const hourData of hours) {
      const { dayOfWeek, isClosed, openTime1, closeTime1, openTime2, closeTime2 } = hourData;

      // Validation
      if (!dayOfWeek) {
        return res.status(400).json({ error: "dayOfWeek is required for each hour entry" });
      }

      // Upsert hour entry
      const updated = await prisma.restaurantHours.upsert({
        where: {
          restaurantId_dayOfWeek: {
            restaurantId,
            dayOfWeek,
          },
        },
        update: {
          isClosed,
          openTime1,
          closeTime1,
          openTime2,
          closeTime2,
        },
        create: {
          restaurantId,
          dayOfWeek,
          isClosed,
          openTime1,
          closeTime1,
          openTime2,
          closeTime2,
        },
      });

      updatedHours.push(updated);
    }

    res.json({
      message: "Restaurant hours updated successfully",
      hours: updatedHours,
    });
  } catch (error) {
    console.error("[Restaurant Settings] Update hours error:", error);
    res.status(500).json({ error: "Failed to update restaurant hours" });
  }
});

// ====================================================
// GET /api/restaurant/settings/operational
// Get operational settings (delivery, pickup, etc.)
// ====================================================
router.get("/operational", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "restaurant") {
      return res.status(403).json({ error: "Only restaurants can access settings" });
    }

    // Get restaurant context (handles OWNER and STAFF)
    const context = await getRestaurantContext(userId);
    
    if ('error' in context) {
      return res.status(context.status).json(
        context.requiresVerification 
          ? { error: context.error, requiresVerification: true }
          : { error: context.error }
      );
    }

    const { profile, restaurantId, userRole, isOwner } = context;

    // RBAC: OWNER always allowed, STAFF requires analytics permission
    if (userRole === "STAFF" && !profile.canViewAnalytics) {
      return res.status(403).json({ error: "Insufficient permissions to view operational settings" });
    }

    // Get or create operational settings (OWNER only can create)
    let settings = await prisma.operationalSettings.findUnique({
      where: { restaurantId },
    });

    if (!settings && isOwner) {
      settings = await prisma.operationalSettings.create({
        data: {
          restaurantId,
        },
      });
    }

    res.json({ settings });
  } catch (error) {
    console.error("[Restaurant Settings] Get operational error:", error);
    res.status(500).json({ error: "Failed to fetch operational settings" });
  }
});

// ====================================================
// PATCH /api/restaurant/settings/operational
// Update operational settings
// ====================================================
router.patch("/operational", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const updateData = req.body;

    if (role !== "restaurant") {
      return res.status(403).json({ error: "Only restaurants can update settings" });
    }

    // Get restaurant context (handles OWNER and STAFF)
    const context = await getRestaurantContext(userId);
    
    if ('error' in context) {
      return res.status(context.status).json(
        context.requiresVerification 
          ? { error: context.error, requiresVerification: true }
          : { error: context.error }
      );
    }

    const { restaurantId, isOwner } = context;

    // RBAC: Only OWNER can modify operational settings
    if (!isOwner) {
      return res.status(403).json({ error: "Only restaurant owners can modify operational settings" });
    }

    // Upsert operational settings
    const settings = await prisma.operationalSettings.upsert({
      where: { restaurantId },
      update: updateData,
      create: {
        restaurantId,
        ...updateData,
      },
    });

    res.json({
      message: "Operational settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error("[Restaurant Settings] Update operational error:", error);
    res.status(500).json({ error: "Failed to update operational settings" });
  }
});

// ====================================================
// GET /api/restaurant/settings/zones
// Get delivery zones
// ====================================================
router.get("/zones", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "restaurant") {
      return res.status(403).json({ error: "Only restaurants can access settings" });
    }

    // Get restaurant context (handles OWNER and STAFF)
    const context = await getRestaurantContext(userId);
    
    if ('error' in context) {
      return res.status(context.status).json(
        context.requiresVerification 
          ? { error: context.error, requiresVerification: true }
          : { error: context.error }
      );
    }

    const { profile, restaurantId, userRole } = context;

    // RBAC: OWNER always allowed, STAFF requires analytics permission
    if (userRole === "STAFF" && !profile.canViewAnalytics) {
      return res.status(403).json({ error: "Insufficient permissions to view delivery zones" });
    }

    // Get all delivery zones
    const zones = await prisma.deliveryZone.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ zones });
  } catch (error) {
    console.error("[Restaurant Settings] Get zones error:", error);
    res.status(500).json({ error: "Failed to fetch delivery zones" });
  }
});

// ====================================================
// POST /api/restaurant/settings/zones
// Create a new delivery zone
// ====================================================
router.post("/zones", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const zoneData = req.body;

    if (role !== "restaurant") {
      return res.status(403).json({ error: "Only restaurants can create zones" });
    }

    // Get restaurant context (handles OWNER and STAFF)
    const context = await getRestaurantContext(userId);
    
    if ('error' in context) {
      return res.status(context.status).json(
        context.requiresVerification 
          ? { error: context.error, requiresVerification: true }
          : { error: context.error }
      );
    }

    const { restaurantId, isOwner } = context;

    // RBAC: Only OWNER can modify
    if (!isOwner) {
      return res.status(403).json({ error: "Only restaurant owners can create delivery zones" });
    }

    // Validate zone data
    if (!zoneData.zoneName) {
      return res.status(400).json({ error: "Zone name is required" });
    }

    // Create zone
    const zone = await prisma.deliveryZone.create({
      data: {
        restaurantId,
        ...zoneData,
      },
    });

    res.status(201).json({
      message: "Delivery zone created successfully",
      zone,
    });
  } catch (error) {
    console.error("[Restaurant Settings] Create zone error:", error);
    res.status(500).json({ error: "Failed to create delivery zone" });
  }
});

// ====================================================
// DELETE /api/restaurant/settings/zones/:id
// Delete a delivery zone
// ====================================================
router.delete("/zones/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { id } = req.params;

    if (role !== "restaurant") {
      return res.status(403).json({ error: "Only restaurants can delete zones" });
    }

    // Get restaurant context (handles OWNER and STAFF)
    const context = await getRestaurantContext(userId);
    
    if ('error' in context) {
      return res.status(context.status).json(
        context.requiresVerification 
          ? { error: context.error, requiresVerification: true }
          : { error: context.error }
      );
    }

    const { restaurantId, isOwner } = context;

    // RBAC: Only OWNER can modify
    if (!isOwner) {
      return res.status(403).json({ error: "Only restaurant owners can delete delivery zones" });
    }

    // Verify zone belongs to this restaurant
    const zone = await prisma.deliveryZone.findUnique({
      where: { id },
    });

    if (!zone) {
      return res.status(404).json({ error: "Delivery zone not found" });
    }

    if (zone.restaurantId !== restaurantId) {
      return res.status(403).json({ error: "You don't own this delivery zone" });
    }

    // Delete zone
    await prisma.deliveryZone.delete({
      where: { id },
    });

    res.json({ message: "Delivery zone deleted successfully" });
  } catch (error) {
    console.error("[Restaurant Settings] Delete zone error:", error);
    res.status(500).json({ error: "Failed to delete delivery zone" });
  }
});

// ====================================================
// GET /api/restaurant/settings/surge
// Get surge pricing settings
// ====================================================
router.get("/surge", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "restaurant") {
      return res.status(403).json({ error: "Only restaurants can access settings" });
    }

    // Get restaurant context (handles OWNER and STAFF)
    const context = await getRestaurantContext(userId);
    
    if ('error' in context) {
      return res.status(context.status).json(
        context.requiresVerification 
          ? { error: context.error, requiresVerification: true }
          : { error: context.error }
      );
    }

    const { profile, restaurantId, userRole, isOwner } = context;

    // RBAC: OWNER always allowed, STAFF requires analytics permission
    if (userRole === "STAFF" && !profile.canViewAnalytics) {
      return res.status(403).json({ error: "Insufficient permissions to view surge settings" });
    }

    // Get or create surge settings (OWNER only can create)
    let settings = await prisma.surgeSettings.findUnique({
      where: { restaurantId },
    });

    if (!settings && isOwner) {
      settings = await prisma.surgeSettings.create({
        data: {
          restaurantId,
        },
      });
    }

    res.json({ settings });
  } catch (error) {
    console.error("[Restaurant Settings] Get surge error:", error);
    res.status(500).json({ error: "Failed to fetch surge settings" });
  }
});

// ====================================================
// PATCH /api/restaurant/settings/surge
// Update surge pricing settings
// ====================================================
router.patch("/surge", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const updateData = req.body;

    if (role !== "restaurant") {
      return res.status(403).json({ error: "Only restaurants can update settings" });
    }

    // Get restaurant context (handles OWNER and STAFF)
    const context = await getRestaurantContext(userId);
    
    if ('error' in context) {
      return res.status(context.status).json(
        context.requiresVerification 
          ? { error: context.error, requiresVerification: true }
          : { error: context.error }
      );
    }

    const { restaurantId, isOwner } = context;

    // RBAC: Only OWNER can modify surge settings
    if (!isOwner) {
      return res.status(403).json({ error: "Only restaurant owners can modify surge settings" });
    }

    // Validate surge multiplier range
    if (updateData.surgeMultiplier !== undefined) {
      if (updateData.surgeMultiplier < 1.0 || updateData.surgeMultiplier > 2.0) {
        return res.status(400).json({ error: "Surge multiplier must be between 1.0 and 2.0" });
      }
    }

    if (updateData.weekendMultiplier !== undefined) {
      if (updateData.weekendMultiplier < 1.0 || updateData.weekendMultiplier > 2.0) {
        return res.status(400).json({ error: "Weekend multiplier must be between 1.0 and 2.0" });
      }
    }

    // Upsert surge settings
    const settings = await prisma.surgeSettings.upsert({
      where: { restaurantId },
      update: updateData,
      create: {
        restaurantId,
        ...updateData,
      },
    });

    res.json({
      message: "Surge settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error("[Restaurant Settings] Update surge error:", error);
    res.status(500).json({ error: "Failed to update surge settings" });
  }
});

export default router;
