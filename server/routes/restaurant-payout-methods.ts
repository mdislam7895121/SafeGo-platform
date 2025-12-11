import { Router } from "express";
import { prisma } from "../db";
import { RestaurantPayoutMethodService } from "../services/RestaurantPayoutMethodService";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { requirePayoutVerification, type PayoutAuthRequest } from "../middleware/payoutTwoFactor";
import { logAuditEvent, getClientIp } from "../utils/audit";
import type { CountryCode, PayoutRailType, PayoutProvider, PayoutMethodStatus } from "../../shared/types";

const router = Router();

// Middleware to ensure only restaurant owners can access payout methods
async function requireOwnerRole(req: AuthRequest, res: any, next: any) {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    if (restaurantProfile.ownerRole !== "OWNER") {
      return res.status(403).json({ 
        error: "Access denied. Only restaurant owners can manage payout methods." 
      });
    }

    // Attach restaurant ID to request for convenience
    (req as any).restaurantId = restaurantProfile.id;
    (req as any).restaurantEmail = req.user!.email;
    
    next();
  } catch (error) {
    console.error("Error in requireOwnerRole middleware:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/restaurants/me/payout-methods
 * Get all payout methods for the authenticated restaurant
 * Requires: OWNER role only (no staff access)
 */
router.get("/me/payout-methods", authenticateToken, requireRole("RESTAURANT"), requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const restaurantId = (req as any).restaurantId;

    const methods = await RestaurantPayoutMethodService.getRestaurantPayoutMethods(restaurantId);

    res.json({ payoutMethods: methods });
  } catch (error: any) {
    console.error("Error fetching payout methods:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /api/restaurants/me/payout-methods
 * Create a new payout method for the authenticated restaurant
 * Requires: OWNER role only
 * Body: { countryCode, payoutRailType, provider, currency, maskedDetails, metadata, isDefault }
 */
router.post("/me/payout-methods", authenticateToken, requireRole("RESTAURANT"), requireOwnerRole, requirePayoutVerification, async (req: PayoutAuthRequest, res) => {
  try {
    const restaurantId = (req as any).restaurantId;
    const restaurantEmail = (req as any).restaurantEmail;
    const userId = req.user!.userId;

    const {
      countryCode, // Optional - derived from restaurant profile for security
      payoutRailType,
      provider,
      currency,
      maskedDetails,
      metadata,
      isDefault,
    } = req.body;

    // Validate required fields (countryCode is derived server-side, not required from client)
    if (!payoutRailType || !provider || !currency || !maskedDetails) {
      return res.status(400).json({
        error: "Missing required fields: payoutRailType, provider, currency, maskedDetails",
      });
    }

    const payoutMethod = await RestaurantPayoutMethodService.createPayoutMethod({
      restaurantId,
      countryCode: countryCode as CountryCode,
      payoutRailType: payoutRailType as PayoutRailType,
      provider: provider as PayoutProvider,
      currency,
      maskedDetails,
      metadata: metadata || {},
      isDefault: isDefault || false,
      actorRole: "OWNER",
      createdByActorId: userId,
    });

    // Audit log
    await logAuditEvent({
      actorId: userId,
      actorEmail: restaurantEmail,
      actorRole: "RESTAURANT_OWNER",
      ipAddress: getClientIp(req),
      actionType: "CREATE_PAYOUT_METHOD",
      entityType: "payout_method",
      entityId: payoutMethod.id,
      description: `Created new ${payoutRailType} payout method for restaurant ${restaurantId}`,
      metadata: {
        restaurantId,
        payoutRailType,
        provider,
        currency,
        isDefault,
      },
    });

    res.status(201).json({ payoutMethod });
  } catch (error: any) {
    console.error("Error creating payout method:", error);
    
    // Handle validation errors with appropriate status codes
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || "Internal server error" });
  }
});

/**
 * PATCH /api/restaurants/me/payout-methods/:id
 * Update a payout method (status, default flag)
 * Requires: OWNER role only
 * Body: { status, isDefault }
 */
router.patch("/me/payout-methods/:id", authenticateToken, requireRole("RESTAURANT"), requireOwnerRole, requirePayoutVerification, async (req: PayoutAuthRequest, res) => {
  try {
    const restaurantId = (req as any).restaurantId;
    const restaurantEmail = (req as any).restaurantEmail;
    const userId = req.user!.userId;
    const { id } = req.params;
    const { status, isDefault } = req.body;

    const updates: any = {
      lastUpdatedByActorId: userId,
    };

    if (status !== undefined) {
      updates.status = status as PayoutMethodStatus;
    }

    if (isDefault !== undefined) {
      updates.isDefault = isDefault;
    }

    const updated = await RestaurantPayoutMethodService.updatePayoutMethod(
      id,
      restaurantId,
      updates
    );

    // Audit log
    await logAuditEvent({
      actorId: userId,
      actorEmail: restaurantEmail,
      actorRole: "RESTAURANT_OWNER",
      ipAddress: getClientIp(req),
      actionType: "UPDATE_PAYOUT_METHOD",
      entityType: "payout_method",
      entityId: id,
      description: `Updated payout method ${id} for restaurant ${restaurantId}`,
      metadata: updates,
    });

    res.json({ payoutMethod: updated });
  } catch (error: any) {
    console.error("Error updating payout method:", error);
    if (error.message === "Payout method not found or access denied") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /api/restaurants/me/payout-methods/:id/disable
 * Disable a payout method
 * Requires: OWNER role only
 */
router.post("/me/payout-methods/:id/disable", authenticateToken, requireRole("RESTAURANT"), requireOwnerRole, requirePayoutVerification, async (req: PayoutAuthRequest, res) => {
  try {
    const restaurantId = (req as any).restaurantId;
    const restaurantEmail = (req as any).restaurantEmail;
    const userId = req.user!.userId;
    const { id } = req.params;

    const disabled = await RestaurantPayoutMethodService.disablePayoutMethod(
      id,
      restaurantId,
      userId
    );

    // Audit log
    await logAuditEvent({
      actorId: userId,
      actorEmail: restaurantEmail,
      actorRole: "RESTAURANT_OWNER",
      ipAddress: getClientIp(req),
      actionType: "UPDATE_PAYOUT_METHOD",
      entityType: "payout_method",
      entityId: id,
      description: `Disabled payout method ${id} for restaurant ${restaurantId}`,
      metadata: { status: "DISABLED" },
    });

    res.json({ payoutMethod: disabled });
  } catch (error: any) {
    console.error("Error disabling payout method:", error);
    if (error.message === "Payout method not found or access denied") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /api/restaurants/me/payout-methods/:id/set-default
 * Set a payout method as default
 * Requires: OWNER role only
 */
router.post("/me/payout-methods/:id/set-default", authenticateToken, requireRole("RESTAURANT"), requireOwnerRole, requirePayoutVerification, async (req: PayoutAuthRequest, res) => {
  try {
    const restaurantId = (req as any).restaurantId;
    const restaurantEmail = (req as any).restaurantEmail;
    const userId = req.user!.userId;
    const { id } = req.params;

    const updated = await RestaurantPayoutMethodService.setAsDefault(
      id,
      restaurantId,
      userId
    );

    // Audit log
    await logAuditEvent({
      actorId: userId,
      actorEmail: restaurantEmail,
      actorRole: "RESTAURANT_OWNER",
      ipAddress: getClientIp(req),
      actionType: "UPDATE_PAYOUT_METHOD",
      entityType: "payout_method",
      entityId: id,
      description: `Set payout method ${id} as default for restaurant ${restaurantId}`,
      metadata: { isDefault: true },
    });

    res.json({ payoutMethod: updated });
  } catch (error: any) {
    console.error("Error setting default payout method:", error);
    if (error.message === "Payout method not found or access denied") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

export default router;
