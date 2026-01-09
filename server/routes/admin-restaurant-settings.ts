import { Router } from "express";
import { prisma } from "../db";
import { authenticateToken, type AuthRequest } from "../middleware/auth";
import { safeAuditLogCreate } from "../utils/audit";

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// ====================================================
// PHASE 10: Admin Restaurant Settings Oversight
// ====================================================

// ====================================================
// GET /api/admin/restaurants/:id/settings
// Get all operational settings for a restaurant (read-only)
// ====================================================
router.get(
  "/restaurants/:id/settings",
  async (req: AuthRequest, res) => {
    // Check admin role
    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const { id } = req.params;

      // Get restaurant profile
      const restaurant = await prisma.restaurantProfile.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              email: true,
              countryCode: true,
            },
          },
        },
      });

      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      // Get all settings
      const [hours, operational, zones, surge] = await Promise.all([
        prisma.restaurantHours.findMany({
          where: { restaurantId: id },
          orderBy: { dayOfWeek: 'asc' },
        }),
        prisma.operationalSettings.findUnique({
          where: { restaurantId: id },
        }),
        prisma.deliveryZone.findMany({
          where: { restaurantId: id },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.surgeSettings.findUnique({
          where: { restaurantId: id },
        }),
      ]);

      res.json({
        restaurant: {
          id: restaurant.id,
          name: restaurant.restaurantName,
          email: restaurant.user.email,
          countryCode: restaurant.user.countryCode,
          cityCode: restaurant.cityCode,
          isVerified: restaurant.isVerified,
          isActive: restaurant.isActive,
          isSuspended: restaurant.isSuspended,
        },
        settings: {
          hours: hours.length > 0 ? hours : null,
          operational: operational || null,
          zones: zones.length > 0 ? zones : null,
          surge: surge || null,
        },
      });
    } catch (error) {
      console.error("[Admin] Get restaurant settings error:", error);
      res.status(500).json({ error: "Failed to fetch restaurant settings" });
    }
  }
);

// ====================================================
// POST /api/admin/restaurants/:id/settings/override
// Override restaurant settings (temporary closure, etc.)
// ====================================================
router.post(
  "/restaurants/:id/settings/override",
  async (req: AuthRequest, res) => {
    // Check admin role
    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const { id } = req.params;
      const { action, reason, until } = req.body;
      const adminUserId = req.user!.userId;

      // Validate action
      const validActions = ['temporary_close', 'temporary_open', 'disable_delivery', 'enable_delivery'];
      if (!validActions.includes(action)) {
        return res.status(400).json({ 
          error: "Invalid action",
          validActions,
        });
      }

      // Get restaurant profile
      const restaurant = await prisma.restaurantProfile.findUnique({
        where: { id },
      });

      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      // Get or create operational settings
      let settings = await prisma.operationalSettings.findUnique({
        where: { restaurantId: id },
      });

      if (!settings) {
        settings = await prisma.operationalSettings.create({
          data: { restaurantId: id },
        });
      }

      // Apply override based on action
      let updateData: any = {};
      let auditAction = "";

      switch (action) {
        case 'temporary_close':
          updateData = {
            isTemporarilyClosed: true,
            temporaryCloseReason: reason || "Admin override",
            temporaryCloseUntil: until ? new Date(until) : null,
          };
          auditAction = "ADMIN_TEMPORARY_CLOSE";
          break;

        case 'temporary_open':
          updateData = {
            isTemporarilyClosed: false,
            temporaryCloseReason: null,
            temporaryCloseUntil: null,
          };
          auditAction = "ADMIN_TEMPORARY_OPEN";
          break;

        case 'disable_delivery':
          updateData = {
            deliveryEnabled: false,
          };
          auditAction = "ADMIN_DISABLE_DELIVERY";
          break;

        case 'enable_delivery':
          updateData = {
            deliveryEnabled: true,
          };
          auditAction = "ADMIN_ENABLE_DELIVERY";
          break;
      }

      // Update settings
      const updated = await prisma.operationalSettings.update({
        where: { restaurantId: id },
        data: updateData,
      });

      // Log audit trail
      await safeAuditLogCreate({
        data: {
          adminUserId,
          targetUserId: restaurant.userId,
          action: auditAction,
          details: JSON.stringify({
            restaurantId: id,
            restaurantName: restaurant.restaurantName,
            reason,
            until,
            override: updateData,
          }),
        },
      });

      // Send notification to restaurant
      await prisma.notification.create({
        data: {
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userId: restaurant.userId,
          type: 'admin_override',
          title: 'Admin Override Applied',
          body: `An admin has modified your operational settings: ${action.replace('_', ' ')}${reason ? `. Reason: ${reason}` : ''}`,
        },
      });

      res.json({
        message: "Settings override applied successfully",
        settings: updated,
      });
    } catch (error) {
      console.error("[Admin] Override settings error:", error);
      res.status(500).json({ error: "Failed to apply settings override" });
    }
  }
);

// ====================================================
// GET /api/admin/restaurants/:id/settings/audit
// Get audit history for restaurant settings changes
// ====================================================
router.get(
  "/restaurants/:id/settings/audit",
  async (req: AuthRequest, res) => {
    // Check admin role
    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const { id } = req.params;

      // Get restaurant profile
      const restaurant = await prisma.restaurantProfile.findUnique({
        where: { id },
      });

      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      // Get audit logs related to settings
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          targetUserId: restaurant.userId,
          action: {
            in: [
              'ADMIN_TEMPORARY_CLOSE',
              'ADMIN_TEMPORARY_OPEN',
              'ADMIN_DISABLE_DELIVERY',
              'ADMIN_ENABLE_DELIVERY',
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          admin: {
            include: {
              adminProfile: {
                select: {
                  adminRole: true,
                },
              },
            },
          },
        },
      });

      const formattedLogs = auditLogs.map((log: typeof auditLogs[0]) => ({
        id: log.id,
        action: log.action,
        adminEmail: log.admin.email,
        adminRole: log.admin.adminProfile?.adminRole || 'UNKNOWN',
        details: log.details,
        createdAt: log.createdAt,
      }));

      res.json({
        restaurantId: id,
        restaurantName: restaurant.restaurantName,
        auditLogs: formattedLogs,
        count: formattedLogs.length,
      });
    } catch (error) {
      console.error("[Admin] Get settings audit error:", error);
      res.status(500).json({ error: "Failed to fetch audit history" });
    }
  }
);

export default router;
