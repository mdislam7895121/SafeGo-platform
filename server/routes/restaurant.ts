import { Router } from "express";
import { Prisma } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { validateRestaurantKYC } from "../utils/kyc-validator";
import { notifyFoodOrderStatusChange, notifyRestaurantIssueEscalated } from "../utils/notifications";
import { prisma } from "../db";
import { auditMenuAction, getClientIp, EntityType, logAuditEvent, ActionType } from "../utils/audit";
import { uploadMenuItemImage, uploadRestaurantImage, getFileUrl, deleteFile } from "../middleware/upload";
import {
  isRestaurantOwner,
  getStaffForOwner,
  createStaffMember,
  canManageStaff,
} from "../staff/staffUtils";
import { dispatchFoodDelivery } from "../services/foodDeliveryDispatchService";

const router = Router();

// All routes require authentication and restaurant role
router.use(authenticateToken);
router.use(requireRole(["restaurant"]));

// Middleware to check KYC completion for critical operations
async function requireKYCCompletion(req: AuthRequest, res: any, next: any) {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Use user's countryCode as fallback if not set on profile
    const profileWithCountry = {
      ...restaurantProfile,
      countryCode: restaurantProfile.countryCode || restaurantProfile.user.countryCode,
    };

    const kycValidation = validateRestaurantKYC(profileWithCountry);
    if (!kycValidation.isComplete) {
      return res.status(403).json({
        error: "KYC verification required",
        message: "Please complete your KYC verification to perform this action",
        missingFields: kycValidation.missingFields,
        countryCode: kycValidation.countryCode,
      });
    }

    next();
  } catch (error) {
    console.error("KYC check error:", error);
    return res.status(500).json({ error: "Failed to verify KYC status" });
  }
}

// Middleware to check OWNER role for menu management
async function requireOwnerRole(req: AuthRequest, res: any, next: any) {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Check if user has OWNER role (default to OWNER if not set for backward compatibility)
    const role = restaurantProfile.ownerRole || "OWNER";
    if (role !== "OWNER") {
      return res.status(403).json({
        error: "Insufficient permissions",
        message: "Only restaurant owners can perform this action",
      });
    }

    next();
  } catch (error) {
    console.error("Owner role check error:", error);
    return res.status(500).json({ error: "Failed to verify permissions" });
  }
}

// ====================================================
// PATCH /api/restaurant/profile
// Update restaurant profile
// ====================================================
router.patch("/profile", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { restaurantName, address } = req.body;

    // Get restaurant profile
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Prepare update data
    const updateData: any = {};
    if (restaurantName) updateData.restaurantName = restaurantName;
    if (address) updateData.address = address;

    // Update profile
    const updatedProfile = await prisma.restaurantProfile.update({
      where: { userId },
      data: updateData,
    });

    res.json({
      message: "Profile updated successfully",
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ====================================================
// POST /api/restaurant/status
// Update restaurant status (Open/Closed, Busy mode)
// ====================================================
const statusUpdateSchema = z.object({
  isOpen: z.boolean().optional(),
  isBusy: z.boolean().optional(),
});

router.post("/status", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const validationResult = statusUpdateSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const { isOpen, isBusy } = validationResult.data;

    // Get restaurant profile
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Update profile with status (using isActive for open/closed, isBusy for busy mode)
    const updateData: any = {};
    if (typeof isOpen === 'boolean') {
      updateData.isActive = isOpen;
    }
    if (typeof isBusy === 'boolean') {
      updateData.isBusy = isBusy;
    }

    let updatedProfile = restaurantProfile;
    if (Object.keys(updateData).length > 0) {
      updatedProfile = await prisma.restaurantProfile.update({
        where: { userId },
        data: updateData,
      });
    }

    res.json({
      message: "Restaurant status updated successfully",
      isOpen: updatedProfile.isActive,
      isBusy: updatedProfile.isBusy,
    });
  } catch (error) {
    console.error("Status update error:", error);
    res.status(500).json({ error: "Failed to update restaurant status" });
  }
});

// ====================================================
// STAFF MANAGEMENT API (R3)
// ====================================================

// POST /api/restaurant/staff - Create/invite staff member
router.post("/staff", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const createStaffSchema = z.object({
      name: z.string().min(1, "Name is required"),
      email: z.string().email("Invalid email format"),
      phone: z.string().min(1, "Phone is required"),
      temporaryPassword: z.string().min(8, "Password must be at least 8 characters"),
      permissions: z.object({
        canEditCategories: z.boolean().optional().default(false),
        canEditItems: z.boolean().optional().default(false),
        canToggleAvailability: z.boolean().optional().default(false),
        canUseBulkTools: z.boolean().optional().default(false),
        canViewAnalytics: z.boolean().optional().default(false),
        canViewPayouts: z.boolean().optional().default(false),
        canManageOrders: z.boolean().optional().default(false),
      }).optional(),
    });

    const validatedData = createStaffSchema.parse(req.body);

    const ownerProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true, restaurantName: true },
    });

    if (!ownerProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Create staff member using utility function
    const { user, restaurantProfile } = await createStaffMember(ownerProfile.id, validatedData);

    // Audit log
    await logAuditEvent({
      entityType: EntityType.RESTAURANT,
      entityId: ownerProfile.id,
      action: ActionType.CREATE,
      details: `Created staff member: ${validatedData.name} (${validatedData.email})`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json({
      message: "Staff member created successfully",
      staff: {
        id: restaurantProfile.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        staffActive: restaurantProfile.staffActive,
        permissions: {
          canEditCategories: restaurantProfile.canEditCategories,
          canEditItems: restaurantProfile.canEditItems,
          canToggleAvailability: restaurantProfile.canToggleAvailability,
          canUseBulkTools: restaurantProfile.canUseBulkTools,
          canViewAnalytics: restaurantProfile.canViewAnalytics,
          canViewPayouts: restaurantProfile.canViewPayouts,
          canManageOrders: restaurantProfile.canManageOrders,
        },
        createdAt: restaurantProfile.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Create staff error:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: error.message || "Failed to create staff member" });
  }
});

// GET /api/restaurant/staff - List all staff members
router.get("/staff", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const ownerProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!ownerProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Get all staff members using utility function
    const staffMembers = await getStaffForOwner(ownerProfile.id);

    // Transform response to include user details
    const staffList = staffMembers.map((staff) => ({
      id: staff.id,
      userId: staff.userId,
      name: staff.user.name,
      email: staff.user.email,
      phone: staff.user.phone,
      staffActive: staff.staffActive,
      permissions: {
        canEditCategories: staff.canEditCategories,
        canEditItems: staff.canEditItems,
        canToggleAvailability: staff.canToggleAvailability,
        canUseBulkTools: staff.canUseBulkTools,
        canViewAnalytics: staff.canViewAnalytics,
        canViewPayouts: staff.canViewPayouts,
        canManageOrders: staff.canManageOrders,
      },
      lastLoginAt: staff.lastLoginAt,
      createdAt: staff.createdAt,
    }));

    res.json({ staff: staffList });
  } catch (error: any) {
    console.error("Get staff error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch staff members" });
  }
});

// PATCH /api/restaurant/staff/:id - Update staff permissions
router.patch("/staff/:id", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id: staffId } = req.params;

    const updateStaffSchema = z.object({
      staffActive: z.boolean().optional(),
      permissions: z.object({
        canEditCategories: z.boolean().optional(),
        canEditItems: z.boolean().optional(),
        canToggleAvailability: z.boolean().optional(),
        canUseBulkTools: z.boolean().optional(),
        canViewAnalytics: z.boolean().optional(),
        canViewPayouts: z.boolean().optional(),
        canManageOrders: z.boolean().optional(),
      }).optional(),
    });

    const validatedData = updateStaffSchema.parse(req.body);

    const ownerProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!ownerProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify staff belongs to this owner
    const canManage = await canManageStaff(userId, staffId);
    if (!canManage) {
      return res.status(403).json({ error: "You can only manage your own staff members" });
    }

    // Prepare update data
    const updateData: any = {};
    if (validatedData.staffActive !== undefined) {
      updateData.staffActive = validatedData.staffActive;
    }
    if (validatedData.permissions) {
      Object.assign(updateData, validatedData.permissions);
    }

    // Update staff member
    const updatedStaff = await prisma.restaurantProfile.update({
      where: { id: staffId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    // Audit log
    await logAuditEvent({
      entityType: EntityType.RESTAURANT,
      entityId: ownerProfile.id,
      action: ActionType.UPDATE,
      details: `Updated staff permissions: ${updatedStaff.user.name} (${updatedStaff.user.email})`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
    });

    res.json({
      message: "Staff permissions updated successfully",
      staff: {
        id: updatedStaff.id,
        userId: updatedStaff.userId,
        name: updatedStaff.user.name,
        email: updatedStaff.user.email,
        phone: updatedStaff.user.phone,
        staffActive: updatedStaff.staffActive,
        permissions: {
          canEditCategories: updatedStaff.canEditCategories,
          canEditItems: updatedStaff.canEditItems,
          canToggleAvailability: updatedStaff.canToggleAvailability,
          canUseBulkTools: updatedStaff.canUseBulkTools,
          canViewAnalytics: updatedStaff.canViewAnalytics,
          canViewPayouts: updatedStaff.canViewPayouts,
          canManageOrders: updatedStaff.canManageOrders,
        },
        lastLoginAt: updatedStaff.lastLoginAt,
        createdAt: updatedStaff.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Update staff error:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: error.message || "Failed to update staff member" });
  }
});

// DELETE /api/restaurant/staff/:id - Soft delete (deactivate) staff member
router.delete("/staff/:id", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id: staffId } = req.params;

    const ownerProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!ownerProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify staff belongs to this owner
    const canManage = await canManageStaff(userId, staffId);
    if (!canManage) {
      return res.status(403).json({ error: "You can only manage your own staff members" });
    }

    // Get staff details before deactivation
    const staffMember = await prisma.restaurantProfile.findUnique({
      where: { id: staffId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!staffMember) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    // Soft delete by marking as inactive
    await prisma.restaurantProfile.update({
      where: { id: staffId },
      data: { staffActive: false },
    });

    // Audit log
    await logAuditEvent({
      entityType: EntityType.RESTAURANT,
      entityId: ownerProfile.id,
      action: ActionType.DELETE,
      details: `Deactivated staff member: ${staffMember.user.name} (${staffMember.user.email})`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
    });

    res.json({
      message: "Staff member deactivated successfully",
      success: true,
    });
  } catch (error: any) {
    console.error("Delete staff error:", error);
    res.status(500).json({ error: error.message || "Failed to deactivate staff member" });
  }
});

// ====================================================
// GET /api/restaurant/home
// Get restaurant dashboard data
// ====================================================
router.get("/home", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get restaurant profile
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            countryCode: true,
            isBlocked: true,
          },
        },
        restaurantWallet: true,
      },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    res.json({
      profile: {
        id: restaurantProfile.id,
        email: restaurantProfile.user.email,
        restaurantName: restaurantProfile.restaurantName,
        address: restaurantProfile.address,
        countryCode: restaurantProfile.user.countryCode,
        verificationStatus: restaurantProfile.verificationStatus,
        isVerified: restaurantProfile.isVerified,
        rejectionReason: restaurantProfile.rejectionReason,
        ownerRole: restaurantProfile.ownerRole || "OWNER", // Phase 6: Include owner role for RBAC
        isOpen: restaurantProfile.isActive,  // C-1: Restaurant open/closed status
        isBusy: restaurantProfile.isBusy,    // C-1: Restaurant busy mode
      },
      wallet: restaurantProfile.restaurantWallet ? {
        balance: restaurantProfile.restaurantWallet.balance,
        negativeBalance: restaurantProfile.restaurantWallet.negativeBalance,
      } : null,
    });
  } catch (error) {
    console.error("Restaurant home error:", error);
    res.status(500).json({ error: "Failed to fetch restaurant data" });
  }
});

// ====================================================
// WALLET & PAYOUT API
// ====================================================

// GET /api/restaurant/wallet/transactions
// Get restaurant wallet transaction history
router.get("/wallet/transactions", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: restaurantProfile.id,
          ownerType: "restaurant",
        },
      },
    });

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const transactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.walletTransaction.count({
      where: { walletId: wallet.id },
    });

    res.json({
      transactions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// POST /api/restaurant/payout/request
// Request a payout
router.post("/payout/request", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    // Validate and parse amount (accepts numbers and numeric strings without precision loss)
    const { amount: rawAmount } = req.body;
    
    if (rawAmount === undefined || rawAmount === null) {
      return res.status(400).json({ error: "Amount is required" });
    }

    let amountDecimal: Prisma.Decimal;
    try {
      amountDecimal = new Prisma.Decimal(rawAmount);
    } catch {
      return res.status(400).json({ error: "Amount must be a valid number" });
    }

    if (!amountDecimal.isPositive()) {
      return res.status(400).json({ error: "Amount must be greater than zero" });
    }

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: restaurantProfile.id,
          ownerType: "restaurant",
        },
      },
    });

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Check if restaurant has negative balance
    if (!wallet.negativeBalance.isZero()) {
      return res.status(400).json({
        error: `Cannot request payout while debt exists. Outstanding commission: ${wallet.negativeBalance} ${wallet.currency}`,
      });
    }

    // Check if restaurant has sufficient available balance
    if (wallet.availableBalance.lt(amountDecimal)) {
      return res.status(400).json({
        error: `Insufficient balance. Available: ${wallet.availableBalance} ${wallet.currency}`,
      });
    }

    // Create payout request atomically
    const payout = await prisma.$transaction(async (tx) => {
      // Deduct from wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { decrement: amountDecimal },
        },
      });

      // Verify balance didn't go negative (concurrency protection)
      if (updatedWallet.availableBalance.isNegative()) {
        throw new Error("Insufficient funds - concurrent payout detected");
      }

      // Create payout record
      const newPayout = await tx.payout.create({
        data: {
          walletId: wallet.id,
          ownerType: "restaurant",
          ownerId: restaurantProfile.id,
          countryCode: wallet.countryCode,
          amount: amountDecimal,
          method: "manual_request",
          status: "pending",
        },
      });

      // Record wallet transaction with accurate post-update snapshot
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          ownerType: "restaurant",
          countryCode: wallet.countryCode,
          serviceType: "payout",
          direction: "debit",
          amount: amountDecimal,
          balanceSnapshot: updatedWallet.availableBalance,
          negativeBalanceSnapshot: updatedWallet.negativeBalance,
          referenceType: "payout",
          referenceId: newPayout.id,
          description: `Payout request #${newPayout.id.substring(0, 8)}`,
        },
      });

      return newPayout;
    });

    res.status(201).json({
      message: "Payout request created successfully",
      payout,
    });
  } catch (error) {
    console.error("Request payout error:", error);
    res.status(500).json({ error: "Failed to create payout request" });
  }
});

// GET /api/restaurant/payouts
// Get restaurant payout history
router.get("/payouts", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const where: any = {
      ownerType: "restaurant",
      ownerId: restaurantProfile.id,
    };

    if (status) {
      where.status = status;
    }

    const payouts = await prisma.payout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.payout.count({ where });

    res.json({
      payouts,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Get payouts error:", error);
    res.status(500).json({ error: "Failed to fetch payouts" });
  }
});

// ====================================================
// RESTAURANT PAYOUTS & SETTLEMENT SYSTEM (Phase 5)
// ====================================================

// GET /api/restaurant/payouts/overview
// Get comprehensive payout overview with wallet balance, settlements, etc.
router.get("/payouts/overview", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const { getRestaurantPayoutOverview } = await import("../payouts/restaurantPayouts");
    const overview = await getRestaurantPayoutOverview(restaurantProfile.id);

    res.json(overview);
  } catch (error: any) {
    console.error("Get payout overview error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch payout overview" });
  }
});

// GET /api/restaurant/payouts/ledger
// Get detailed wallet transaction ledger
router.get("/payouts/ledger", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const { getRestaurantLedger } = await import("../payouts/restaurantPayouts");
    const result = await getRestaurantLedger(restaurantProfile.id, limit, offset);

    res.json({
      ledger: result.ledger,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total,
      },
    });
  } catch (error: any) {
    console.error("Get ledger error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch ledger" });
  }
});

// GET /api/restaurant/payouts/settlements
// Get settlement cycles (weekly settlements)
router.get("/payouts/settlements", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const { getRestaurantSettlements } = await import("../payouts/restaurantPayouts");
    const settlements = await getRestaurantSettlements(restaurantProfile.id);

    res.json({ settlements });
  } catch (error: any) {
    console.error("Get settlements error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch settlements" });
  }
});

// POST /api/restaurant/payouts/request-enhanced
// Enhanced payout request with OWNER-only access and comprehensive validation
router.post("/payouts/request-enhanced", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { amount: rawAmount } = req.body;

    // Check if user is RESTAURANT_OWNER (not STAFF)
    const { isRestaurantOwner } = await import("../payouts/restaurantPayouts");
    const isOwner = await isRestaurantOwner(userId);

    if (!isOwner) {
      return res.status(403).json({
        error: "Only restaurant owners can request payouts",
      });
    }

    // Validate amount
    if (rawAmount === undefined || rawAmount === null) {
      return res.status(400).json({ error: "Amount is required" });
    }

    let amountDecimal: Prisma.Decimal;
    try {
      amountDecimal = new Prisma.Decimal(rawAmount);
    } catch {
      return res.status(400).json({ error: "Amount must be a valid number" });
    }

    if (!amountDecimal.isPositive()) {
      return res.status(400).json({ error: "Amount must be greater than zero" });
    }

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Check if restaurant is verified
    if (!restaurantProfile.isVerified) {
      return res.status(403).json({
        error: "KYC verification required to request payouts",
      });
    }

    const wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: restaurantProfile.id,
          ownerType: "RESTAURANT",
        },
      },
    });

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Check minimum payout threshold
    const minPayoutThreshold = restaurantProfile.countryCode === "BD" ? 500 : 10;
    if (amountDecimal.lt(minPayoutThreshold)) {
      return res.status(400).json({
        error: `Minimum payout amount is ${minPayoutThreshold} ${wallet.currency}`,
      });
    }

    // Check if restaurant has negative balance
    if (!wallet.negativeBalance.isZero()) {
      return res.status(400).json({
        error: `Cannot request payout while debt exists. Outstanding commission: ${wallet.negativeBalance} ${wallet.currency}`,
      });
    }

    // Check if restaurant has sufficient available balance
    if (wallet.availableBalance.lt(amountDecimal)) {
      return res.status(400).json({
        error: `Insufficient balance. Available: ${wallet.availableBalance} ${wallet.currency}`,
      });
    }

    // Create payout request atomically
    const payout = await prisma.$transaction(async (tx) => {
      // Deduct from wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { decrement: amountDecimal },
        },
      });

      // Verify balance didn't go negative (concurrency protection)
      if (updatedWallet.availableBalance.isNegative()) {
        throw new Error("Insufficient funds - concurrent payout detected");
      }

      // Create payout record
      const newPayout = await tx.payout.create({
        data: {
          walletId: wallet.id,
          countryCode: wallet.countryCode,
          ownerType: "restaurant",
          ownerId: restaurantProfile.id,
          amount: amountDecimal,
          method: "manual_request",
          status: "pending",
          isDemo: restaurantProfile.isDemo,
        },
      });

      // Create wallet transaction record
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          ownerType: "RESTAURANT",
          countryCode: wallet.countryCode,
          serviceType: "payout",
          direction: "debit",
          amount: amountDecimal,
          balanceSnapshot: updatedWallet.availableBalance,
          negativeBalanceSnapshot: updatedWallet.negativeBalance,
          referenceType: "payout",
          referenceId: newPayout.id,
          description: `Payout request #${newPayout.id.substring(0, 8)}`,
        },
      });

      return newPayout;
    });

    res.status(201).json({
      message: "Payout request created successfully",
      payout,
    });
  } catch (error: any) {
    console.error("Request payout error:", error);
    res.status(500).json({ error: error.message || "Failed to create payout request" });
  }
});

// ====================================================
// MENU MANAGEMENT API
// ====================================================

// GET /api/restaurant/menu/categories
// Get all menu categories for restaurant
router.get("/menu/categories", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId: restaurantProfile.id },
      orderBy: { displayOrder: "asc" },
      include: {
        menuItems: {
          where: { isArchived: false },
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    res.json({ categories });
  } catch (error) {
    console.error("Get menu categories error:", error);
    res.status(500).json({ error: "Failed to fetch menu categories" });
  }
});

// ====================================================
// RESTAURANT ORDER MANAGEMENT API
// ====================================================

// GET /api/restaurant/orders/overview
// Get restaurant orders overview with today's stats (requires KYC completion)
router.get("/orders/overview", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { restaurantWallet: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Get today's date range
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get today's orders
    const todayOrders = await prisma.foodOrder.findMany({
      where: {
        restaurantId: restaurantProfile.id,
        createdAt: { gte: todayStart },
      },
    });

    // Calculate today's stats
    const todayStats = todayOrders.reduce(
      (acc, order) => {
        acc.totalOrders++;
        acc.totalRevenue = acc.totalRevenue.add(order.serviceFare);
        acc.totalCommission = acc.totalCommission.add(order.safegoCommission);
        
        if (order.status === "placed") acc.placedCount++;
        else if (order.status === "accepted" || order.status === "preparing" || order.status === "ready_for_pickup") 
          acc.activeCount++;
        else if (order.status === "delivered") acc.completedCount++;
        else if (order.status.startsWith("cancelled")) acc.cancelledCount++;
        
        return acc;
      },
      {
        totalOrders: 0,
        totalRevenue: new Prisma.Decimal(0),
        totalCommission: new Prisma.Decimal(0),
        placedCount: 0,
        activeCount: 0,
        completedCount: 0,
        cancelledCount: 0,
      }
    );

    res.json({
      today: {
        totalOrders: todayStats.totalOrders,
        totalRevenue: todayStats.totalRevenue.toNumber(),
        totalCommission: todayStats.totalCommission.toNumber(),
        netRevenue: todayStats.totalRevenue.minus(todayStats.totalCommission).toNumber(),
        placedCount: todayStats.placedCount,
        activeCount: todayStats.activeCount,
        completedCount: todayStats.completedCount,
        cancelledCount: todayStats.cancelledCount,
      },
      wallet: restaurantProfile.restaurantWallet ? {
        balance: restaurantProfile.restaurantWallet.balance.toNumber(),
        negativeBalance: restaurantProfile.restaurantWallet.negativeBalance.toNumber(),
      } : null,
    });
  } catch (error) {
    console.error("Get orders overview error:", error);
    res.status(500).json({ error: "Failed to fetch orders overview" });
  }
});

// GET /api/restaurant/orders/live
// Get live orders board (Kanban-style) (requires KYC completion)
router.get("/orders/live", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Get all active orders (not completed or cancelled)
    const activeStatuses = [
      "placed",
      "accepted",
      "preparing",
      "ready_for_pickup",
      "picked_up",
      "on_the_way",
    ];

    const liveOrders = await prisma.foodOrder.findMany({
      where: {
        restaurantId: restaurantProfile.id,
        status: { in: activeStatuses },
      },
      orderBy: { createdAt: "asc" },
      include: {
        customer: {
          include: {
            user: { select: { email: true } },
          },
        },
        driver: {
          include: {
            user: { select: { email: true } },
          },
        },
      },
    });

    // Group by status
    const boardColumns = {
      placed: [] as any[],
      accepted: [] as any[],
      preparing: [] as any[],
      ready_for_pickup: [] as any[],
      picked_up: [] as any[],
      on_the_way: [] as any[],
    };

    liveOrders.forEach((order) => {
      const column = boardColumns[order.status as keyof typeof boardColumns];
      if (column) {
        column.push({
          ...order,
          items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
        });
      }
    });

    res.json({ board: boardColumns });
  } catch (error) {
    console.error("Get live orders error:", error);
    res.status(500).json({ error: "Failed to fetch live orders" });
  }
});

// GET /api/restaurant/orders
// Get all orders for restaurant
router.get("/orders", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const status = req.query.status as string;
    const orderType = req.query.orderType as string;
    const paymentStatus = req.query.paymentStatus as string;
    const timeRange = req.query.timeRange as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const where: any = { restaurantId: restaurantProfile.id };
    
    // Status filter
    if (status) {
      where.status = status;
    }

    // Order type filter (delivery/pickup)
    if (orderType) {
      where.orderType = orderType;
    }

    // Payment status filter
    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    // Time range filter
    if (timeRange) {
      const now = new Date();
      let startDate: Date;

      switch (timeRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'last7days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'last30days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0); // All time
      }

      where.createdAt = {
        gte: startDate,
      };
    }

    const orders = await prisma.foodOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        customer: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
        driver: {
          include: {
            user: {
              select: { email: true },
            },
            vehicles: {
              where: { isActive: true, isPrimary: true },
            },
          },
        },
      },
    });

    const total = await prisma.foodOrder.count({ where });

    // Parse items JSON for each order
    const ordersWithParsedItems = orders.map(order => ({
      ...order,
      items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
    }));

    res.json({
      orders: ordersWithParsedItems,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Get restaurant orders error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// GET /api/restaurant/orders/:id
// Get specific order details
router.get("/orders/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const order = await prisma.foodOrder.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
      include: {
        customer: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
        driver: {
          include: {
            user: {
              select: { email: true },
            },
            vehicles: {
              where: { isActive: true, isPrimary: true },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({
      order: {
        ...order,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
      },
    });
  } catch (error) {
    console.error("Get order details error:", error);
    res.status(500).json({ error: "Failed to fetch order details" });
  }
});

// POST /api/restaurant/orders/:id/status
// Update order status with audit logging (requires KYC completion)
// Step 45: Extended to support restaurantNotes, prepMinutes, customerMessage
router.post("/orders/:id/status", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { status, restaurantNotes, prepMinutes, customerMessage, cancellationReason } = req.body;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Get current order
    const order = await prisma.foodOrder.findFirst({
      where: { id, restaurantId: restaurantProfile.id },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Validate status transitions (business rules)
    const validTransitions: Record<string, string[]> = {
      placed: ["accepted", "cancelled_restaurant"],
      accepted: ["preparing", "cancelled_restaurant"],
      preparing: ["ready_for_pickup", "cancelled_restaurant"],
      ready_for_pickup: ["picked_up"],
      picked_up: ["on_the_way"],
      on_the_way: ["delivered"],
    };

    const currentValidStatuses = validTransitions[order.status] || [];
    if (!currentValidStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status transition from ${order.status} to ${status}`,
        validStatuses: currentValidStatuses,
      });
    }

    // Step 45: Validate optional kitchen fields with proper type handling
    const kitchenSchema = z.object({
      restaurantNotes: z.string().max(1000).optional().nullable(),
      prepMinutes: z.number().int().min(1).max(180).optional().nullable(),
      customerMessage: z.string().max(500).optional().nullable(),
      cancellationReason: z.string().max(1000).optional().nullable(),
    });
    const kitchenValidation = kitchenSchema.safeParse({
      restaurantNotes,
      prepMinutes,
      customerMessage,
      cancellationReason,
    });
    if (!kitchenValidation.success) {
      return res.status(400).json({
        error: "Validation failed for kitchen fields",
        details: kitchenValidation.error.errors,
      });
    }

    // Update order with transaction and audit log
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Update order status with timestamps
      const updateData: any = { status, updatedAt: new Date() };
      
      // Step 45: Include optional restaurant management fields
      // Store empty strings as empty strings, nulls as nulls, undefined means don't update
      if (restaurantNotes !== undefined) {
        updateData.restaurantNotes = restaurantNotes === "" ? null : restaurantNotes;
      }
      if (prepMinutes !== undefined) {
        updateData.restaurantPrepMinutes = prepMinutes === 0 || prepMinutes === null ? null : prepMinutes;
      }
      if (customerMessage !== undefined) {
        updateData.customerStatusMessage = customerMessage === "" ? null : customerMessage;
      }
      
      if (status === "accepted") updateData.acceptedAt = new Date();
      else if (status === "preparing") updateData.preparingAt = new Date();
      else if (status === "ready_for_pickup") updateData.readyAt = new Date();
      else if (status === "picked_up") updateData.pickedUpAt = new Date();
      else if (status === "delivered") {
        updateData.deliveredAt = new Date();
        updateData.completedAt = new Date();
      } else if (status.startsWith("cancelled")) {
        updateData.cancelledAt = new Date();
        updateData.whoCancelled = "restaurant";
        if (cancellationReason) updateData.cancellationReason = cancellationReason;
      }

      const updated = await tx.foodOrder.update({
        where: { id },
        data: updateData,
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorEmail: restaurantProfile.user.email,
          actorRole: "restaurant",
          actionType: "order_status_update",
          entityType: "food_order",
          entityId: id,
          description: `Order status changed from ${order.status} to ${status}`,
          metadata: {
            restaurantId: restaurantProfile.id,
            previousStatus: order.status,
            newStatus: status,
            orderId: id,
          },
          success: true,
        },
      });

      return updated;
    });

    // Send notifications to all parties (restaurant, customer, driver)
    await notifyFoodOrderStatusChange({
      orderId: id,
      orderCode: order.orderCode || undefined,
      restaurantId: restaurantProfile.id,
      customerId: order.customerId,
      driverId: order.driverId || undefined,
      oldStatus: order.status,
      newStatus: status,
      updatedBy: userId,
      countryCode: restaurantProfile.countryCode || undefined,
    });

    // Step 46: Dispatch driver when order is ready for pickup (delivery orders only)
    let dispatchResult = null;
    if (status === "ready_for_pickup" && order.orderType === "delivery") {
      try {
        dispatchResult = await dispatchFoodDelivery(id);
        if (!dispatchResult.success) {
          console.error(`[FoodDeliveryDispatch] Failed to dispatch order ${id}:`, dispatchResult.error);
        } else {
          console.log(`[FoodDeliveryDispatch] Order ${id} dispatched successfully, deliveryId: ${dispatchResult.deliveryId}`);
        }
      } catch (dispatchError) {
        console.error(`[FoodDeliveryDispatch] Error dispatching order ${id}:`, dispatchError);
      }
    }

    res.json({
      message: "Order status updated successfully",
      order: {
        ...updatedOrder,
        items: typeof updatedOrder.items === 'string' ? JSON.parse(updatedOrder.items) : updatedOrder.items,
      },
      dispatch: dispatchResult,
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// POST /api/restaurant/orders/:id/seen
// Mark order as seen by restaurant (Step 45: Kitchen Flow)
router.post("/orders/:id/seen", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Only mark as seen if not already seen
    const order = await prisma.foodOrder.findFirst({
      where: { id, restaurantId: restaurantProfile.id },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (!order.restaurantSeenAt) {
      await prisma.foodOrder.update({
        where: { id },
        data: { restaurantSeenAt: new Date() },
      });
    }

    res.json({ success: true, seenAt: order.restaurantSeenAt || new Date() });
  } catch (error) {
    console.error("Mark order seen error:", error);
    res.status(500).json({ error: "Failed to mark order as seen" });
  }
});

// PATCH /api/restaurant/orders/:id/notes
// Update restaurant notes for an order (Step 45: Kitchen Flow)
router.patch("/orders/:id/notes", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { restaurantNotes, customerStatusMessage, restaurantPrepMinutes } = req.body;

    // Step 45: Validate notes fields with proper bounds
    const notesSchema = z.object({
      restaurantNotes: z.string().max(1000).optional().nullable(),
      customerStatusMessage: z.string().max(500).optional().nullable(),
      restaurantPrepMinutes: z.number().int().min(1).max(180).optional().nullable(),
    });
    const validation = notesSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.errors,
      });
    }

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const order = await prisma.foodOrder.findFirst({
      where: { id, restaurantId: restaurantProfile.id },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Allow clearing fields with empty strings or null
    const updateData: any = { updatedAt: new Date() };
    if (restaurantNotes !== undefined) updateData.restaurantNotes = restaurantNotes || null;
    if (customerStatusMessage !== undefined) updateData.customerStatusMessage = customerStatusMessage || null;
    if (restaurantPrepMinutes !== undefined) updateData.restaurantPrepMinutes = restaurantPrepMinutes || null;

    const updated = await prisma.foodOrder.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      order: {
        ...updated,
        items: typeof updated.items === 'string' ? JSON.parse(updated.items) : updated.items,
      },
    });
  } catch (error) {
    console.error("Update order notes error:", error);
    res.status(500).json({ error: "Failed to update order notes" });
  }
});

// POST /api/restaurant/orders/:id/issue
// Report an issue with an order (requires KYC completion)
router.post("/orders/:id/issue", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { issueType, description } = req.body;

    const schema = z.object({
      issueType: z.enum(["quality", "delivery", "payment", "customer", "other"]),
      description: z.string().min(10).max(500),
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.errors,
      });
    }

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify order ownership
    const order = await prisma.foodOrder.findFirst({
      where: { id, restaurantId: restaurantProfile.id },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Create audit log for issue report
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        actorEmail: restaurantProfile.user.email,
        actorRole: "restaurant",
        actionType: "order_issue_reported",
        entityType: "food_order",
        entityId: id,
        description: `Restaurant reported ${issueType} issue: ${description.substring(0, 100)}`,
        metadata: {
          restaurantId: restaurantProfile.id,
          orderId: id,
          issueType,
          description,
        },
        success: true,
      },
    });

    // Create admin notification for escalated issue
    await notifyRestaurantIssueEscalated({
      restaurantId: restaurantProfile.id,
      orderId: id,
      orderCode: order.orderCode || undefined,
      issueType,
      issueDescription: description,
      reportedBy: userId,
      countryCode: restaurantProfile.countryCode || undefined,
    });

    res.json({
      message: "Issue reported successfully. Our team will review and contact you soon.",
      issueId: id,
    });
  } catch (error) {
    console.error("Report order issue error:", error);
    res.status(500).json({ error: "Failed to report issue" });
  }
});

// GET /api/restaurant/wallet
// Get restaurant wallet information (requires KYC completion)
router.get("/wallet", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Get or create wallet
    let wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: restaurantProfile.id,
          ownerType: "RESTAURANT",
        },
      },
    });

    if (!wallet) {
      // Create wallet if it doesn't exist
      wallet = await prisma.wallet.create({
        data: {
          ownerId: restaurantProfile.id,
          ownerType: "RESTAURANT",
          countryCode: restaurantProfile.countryCode || "US",
          availableBalance: 0,
          negativeBalance: 0,
          currency: restaurantProfile.countryCode === "BD" ? "BDT" : "USD",
          isDemo: restaurantProfile.isDemo,
        },
      });
    }

    // Format wallet data to match frontend expectations
    const formattedWallet = {
      availableBalance: wallet.availableBalance.toString(),
      negativeBalance: wallet.negativeBalance.toString(),
      currency: wallet.currency,
    };

    res.json({ wallet: formattedWallet });
  } catch (error) {
    console.error("Get wallet error:", error);
    res.status(500).json({ error: "Failed to fetch wallet information" });
  }
});

// GET /api/restaurant/kyc-status
// Get KYC verification status
router.get("/kyc-status", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const kycValidation = validateRestaurantKYC(restaurantProfile);

    res.json({
      isComplete: kycValidation.isComplete,
      missingFields: kycValidation.missingFields,
      countryCode: kycValidation.countryCode,
      verificationStatus: restaurantProfile.verificationStatus,
      isVerified: restaurantProfile.isVerified,
    });
  } catch (error) {
    console.error("Get KYC status error:", error);
    res.status(500).json({ error: "Failed to fetch KYC status" });
  }
});

// ====================================================
// MENU MANAGEMENT API (Phase 3)
// ====================================================

// GET /api/restaurant/categories
// List all global main categories (for menu item categorization)
router.get("/categories", async (req: AuthRequest, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
      },
    });

    res.json({ categories });
  } catch (error) {
    console.error("Get global categories error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// GET /api/restaurant/subcategories/:categoryId
// List all subcategories for a specific main category (or all if categoryId is 'all')
router.get("/subcategories/:categoryId", async (req: AuthRequest, res) => {
  try {
    const { categoryId } = req.params;

    // Support fetching all subcategories for smart search/auto-suggest
    const whereClause: Prisma.SubCategoryWhereInput = { isActive: true };
    if (categoryId !== 'all') {
      whereClause.categoryId = categoryId;
    }

    const subcategories = await prisma.subCategory.findMany({
      where: whereClause,
      // Deterministic ordering: group by category, then by display order
      orderBy: [
        { categoryId: "asc" },
        { displayOrder: "asc" },
      ],
      select: {
        id: true,
        categoryId: true,
        name: true,
        slug: true,
        displayOrder: true,
      },
    });

    res.json({ subcategories });
  } catch (error) {
    console.error("Get subcategories error:", error);
    res.status(500).json({ error: "Failed to fetch subcategories" });
  }
});

// GET /api/restaurant/menu/categories
// List all menu categories for the restaurant (LEGACY - restaurant-specific categories)
router.get("/menu/categories", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId: restaurantProfile.id },
      orderBy: { displayOrder: "asc" },
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
    });

    res.json({ categories });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// POST /api/restaurant/menu/categories
// Create a new menu category (OWNER only)
router.post("/menu/categories", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const schema = z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      isActive: z.boolean().default(true),
    }).strict(); // Prevent unknown properties

    const { name, description, isActive } = schema.parse(req.body);

    // Get max display order for the restaurant
    const maxDisplayOrder = await prisma.menuCategory.aggregate({
      where: { restaurantId: restaurantProfile.id },
      _max: { displayOrder: true },
    });

    const category = await prisma.menuCategory.create({
      data: {
        restaurantId: restaurantProfile.id,
        name,
        description: description || null,
        isActive: isActive ?? true,
        displayOrder: (maxDisplayOrder._max.displayOrder ?? 0) + 1,
      },
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "create",
      entityType: "menu_category",
      entityId: category.id,
      restaurantId: restaurantProfile.id,
      description: `Created menu category: ${name}`,
      metadata: { name, isActive },
    });

    res.json({ category });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Create category error:", error);
    res.status(500).json({ error: "Failed to create category" });
  }
});

// PATCH /api/restaurant/menu/categories/:id
// Update a menu category (OWNER only)
router.patch("/menu/categories/:id", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify category belongs to restaurant
    const category = await prisma.menuCategory.findFirst({
      where: { id, restaurantId: restaurantProfile.id },
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    }).strict(); // Prevent unknown properties

    const updates = schema.parse(req.body);

    const updatedCategory = await prisma.menuCategory.update({
      where: { id },
      data: updates,
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "update",
      entityType: "menu_category",
      entityId: id,
      restaurantId: restaurantProfile.id,
      description: `Updated menu category: ${updatedCategory.name}`,
      metadata: updates,
    });

    res.json({ category: updatedCategory });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Update category error:", error);
    res.status(500).json({ error: "Failed to update category" });
  }
});

// DELETE /api/restaurant/menu/categories/:id
// Delete a menu category (OWNER only, only if no items)
router.delete("/menu/categories/:id", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify category belongs to restaurant
    const category = await prisma.menuCategory.findFirst({
      where: { id, restaurantId: restaurantProfile.id },
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Prevent deletion if category has items
    if (category._count.menuItems > 0) {
      return res.status(400).json({
        error: "Cannot delete category with items",
        itemCount: category._count.menuItems,
      });
    }

    await prisma.menuCategory.delete({
      where: { id },
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "delete",
      entityType: "menu_category",
      entityId: id,
      restaurantId: restaurantProfile.id,
      description: `Deleted menu category: ${category.name}`,
      metadata: { name: category.name },
    });

    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

// PATCH /api/restaurant/menu/categories/reorder
// Reorder menu categories (OWNER only)
router.patch("/menu/categories/reorder", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const schema = z.object({
      categoryIds: z.array(z.string()).min(1), // At least one category required
    }).strict(); // Prevent unknown properties

    const { categoryIds } = schema.parse(req.body);

    // Verify all categories belong to restaurant
    const categories = await prisma.menuCategory.findMany({
      where: {
        id: { in: categoryIds },
        restaurantId: restaurantProfile.id,
      },
    });

    if (categories.length !== categoryIds.length) {
      return res.status(400).json({ error: "Invalid category IDs" });
    }

    // Update display order for each category
    await prisma.$transaction(
      categoryIds.map((id, index) =>
        prisma.menuCategory.update({
          where: { id },
          data: { displayOrder: index + 1 },
        })
      )
    );

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "update",
      entityType: "menu_category",
      entityId: restaurantProfile.id,
      restaurantId: restaurantProfile.id,
      description: `Reordered ${categoryIds.length} menu categories`,
      metadata: { categoryIds },
    });

    res.json({ message: "Categories reordered successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Reorder categories error:", error);
    res.status(500).json({ error: "Failed to reorder categories" });
  }
});

// GET /api/restaurant/menu/items
// List all menu items with pagination and filters
router.get("/menu/items", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const categoryId = req.query.categoryId as string;
    const search = req.query.search as string;
    const availability = req.query.availability as string;

    const where: any = {
      restaurantId: restaurantProfile.id,
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { shortDescription: { contains: search, mode: "insensitive" } },
      ];
    }

    if (availability) {
      where.availabilityStatus = availability;
    }

    const [items, total] = await Promise.all([
      prisma.menuItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          category: {
            select: { id: true, name: true },
          },
          mainCategory: {
            select: { id: true, name: true, slug: true },
          },
          subCategoryLinks: {
            include: {
              subCategory: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
          optionGroups: {
            include: {
              options: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      prisma.menuItem.count({ where }),
    ]);

    // Add flattened relational IDs for frontend convenience
    const serializedItems = items.map(item => ({
      ...item,
      mainCategoryId: item.mainCategoryId || item.mainCategory?.id || null,
      subCategoryIds: item.subCategoryLinks?.map(link => link.subCategoryId) || [],
    }));

    res.json({
      items: serializedItems,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Get items error:", error);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

// GET /api/restaurant/menu/items/:id
// Get single menu item with full details
router.get("/menu/items/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const item = await prisma.menuItem.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
      include: {
        category: true,
        mainCategory: true,
        subCategoryLinks: {
          include: {
            subCategory: true,
          },
        },
        optionGroups: {
          include: {
            options: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    // Add flattened relational IDs for frontend convenience
    const serializedItem = {
      ...item,
      mainCategoryId: item.mainCategoryId || item.mainCategory?.id || null,
      subCategoryIds: item.subCategoryLinks?.map(link => link.subCategoryId) || [],
    };

    res.json({ item: serializedItem });
  } catch (error) {
    console.error("Get item error:", error);
    res.status(500).json({ error: "Failed to fetch item" });
  }
});

// POST /api/restaurant/menu/items
// Create a new menu item (OWNER only)
router.post("/menu/items", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const schema = z.object({
      categoryId: z.string().optional(), // LEGACY: Optional for backwards compatibility
      primaryCategory: z.string().optional(), // LEGACY: New two-level category system
      subCategories: z.array(z.string()).optional().default([]), // LEGACY: New two-level category system
      mainCategoryId: z.string().optional(), // NEW: Relational model main category FK
      subCategoryIds: z.array(z.string()).optional().default([]), // NEW: Relational model subcategory IDs
      name: z.string().min(1).max(200),
      shortDescription: z.string().max(500).optional(),
      longDescription: z.string().optional(),
      basePrice: z.coerce.number().min(0), // Coerce string to number for Decimal fields
      currency: z.string().default("USD"),
      preparationTimeMinutes: z.number().int().min(0).optional(),
      availabilityStatus: z.enum(["available", "unavailable", "out_of_stock"]).default("available"),
      isFeatured: z.boolean().default(false),
      isVegetarian: z.boolean().default(false),
      isVegan: z.boolean().default(false),
      isHalal: z.boolean().default(false),
      isSpicy: z.boolean().default(false),
      dietaryTags: z.array(z.string()).default([]),
      itemImageUrl: z.string().url().optional(),
    }).strict(); // Prevent unknown properties

    const data = schema.parse(req.body);

    // Verify legacy category if categoryId is provided (backwards compatibility)
    if (data.categoryId) {
      const category = await prisma.menuCategory.findFirst({
        where: {
          id: data.categoryId,
          restaurantId: restaurantProfile.id,
        },
      });

      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
    }

    // Verify main category if mainCategoryId is provided (new relational model)
    if (data.mainCategoryId) {
      const mainCategory = await prisma.category.findUnique({
        where: { id: data.mainCategoryId, isActive: true },
      });

      if (!mainCategory) {
        return res.status(404).json({ error: "Main category not found" });
      }
    }

    // Verify subcategories if subCategoryIds are provided (new relational model)
    if (data.subCategoryIds && data.subCategoryIds.length > 0) {
      const subcategories = await prisma.subCategory.findMany({
        where: {
          id: { in: data.subCategoryIds },
          isActive: true,
        },
      });

      if (subcategories.length !== data.subCategoryIds.length) {
        return res.status(400).json({ error: "One or more subcategories not found" });
      }
    }

    // Create menu item with related subcategories using transaction
    const item = await prisma.$transaction(async (tx) => {
      // Create menu item
      const newItem = await tx.menuItem.create({
        data: {
          restaurantId: restaurantProfile.id,
          categoryId: data.categoryId || null, // LEGACY
          primaryCategory: data.primaryCategory || null, // LEGACY
          subCategories: data.subCategories || [], // LEGACY
          mainCategoryId: data.mainCategoryId || null, // NEW
          name: data.name,
          shortDescription: data.shortDescription || null,
          longDescription: data.longDescription || null,
          basePrice: data.basePrice,
          currency: data.currency,
          preparationTimeMinutes: data.preparationTimeMinutes || null,
          availabilityStatus: data.availabilityStatus,
          isFeatured: data.isFeatured,
          isVegetarian: data.isVegetarian,
          isVegan: data.isVegan,
          isHalal: data.isHalal,
          isSpicy: data.isSpicy,
          dietaryTags: data.dietaryTags || [],
          itemImageUrl: data.itemImageUrl || null,
        },
      });

      // Create MenuItemCategory relationships for subcategories
      if (data.subCategoryIds && data.subCategoryIds.length > 0) {
        await tx.menuItemCategory.createMany({
          data: data.subCategoryIds.map((subCategoryId) => ({
            menuItemId: newItem.id,
            subCategoryId,
          })),
        });
      }

      return newItem;
    });

    // Fetch item with relations for response
    const itemWithRelations = await prisma.menuItem.findUnique({
      where: { id: item.id },
      include: {
        category: true, // LEGACY
        mainCategory: true, // NEW
        subCategoryLinks: { // NEW
          include: {
            subCategory: true,
          },
        },
      },
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "create",
      entityType: "menu_item",
      entityId: item.id,
      restaurantId: restaurantProfile.id,
      description: `Created menu item: ${item.name}`,
      metadata: {
        name: item.name,
        categoryId: item.categoryId,
        mainCategoryId: item.mainCategoryId,
        basePrice: item.basePrice.toString(),
      },
    });

    // Add flattened relational IDs for frontend convenience
    const serializedItem = {
      ...itemWithRelations,
      mainCategoryId: itemWithRelations?.mainCategoryId || itemWithRelations?.mainCategory?.id || null,
      subCategoryIds: itemWithRelations?.subCategoryLinks?.map(link => link.subCategoryId) || [],
    };

    res.json({ item: serializedItem });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Create item error:", error);
    res.status(500).json({ error: "Failed to create item" });
  }
});

// PATCH /api/restaurant/menu/items/:id
// Update a menu item (OWNER only)
router.patch("/menu/items/:id", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify item belongs to restaurant
    const item = await prisma.menuItem.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!item) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    const schema = z.object({
      categoryId: z.string().optional(), // LEGACY
      primaryCategory: z.string().optional(), // LEGACY
      subCategories: z.array(z.string()).optional(), // LEGACY
      mainCategoryId: z.string().optional(), // NEW
      subCategoryIds: z.array(z.string()).optional(), // NEW
      name: z.string().min(1).max(200).optional(),
      shortDescription: z.string().max(500).optional(),
      longDescription: z.string().optional(),
      basePrice: z.coerce.number().min(0).optional(), // Coerce string to number for Decimal fields
      currency: z.string().optional(),
      preparationTimeMinutes: z.number().int().min(0).optional(),
      availabilityStatus: z.enum(["available", "unavailable", "out_of_stock"]).optional(),
      isFeatured: z.boolean().optional(),
      isVegetarian: z.boolean().optional(),
      isVegan: z.boolean().optional(),
      isHalal: z.boolean().optional(),
      isSpicy: z.boolean().optional(),
      dietaryTags: z.array(z.string()).optional(),
      itemImageUrl: z.string().url().optional(),
    }).strict(); // Prevent unknown properties

    const updates = schema.parse(req.body);

    // If legacy category is being changed, verify it belongs to restaurant
    if (updates.categoryId) {
      const category = await prisma.menuCategory.findFirst({
        where: {
          id: updates.categoryId,
          restaurantId: restaurantProfile.id,
        },
      });

      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
    }

    // Verify main category if mainCategoryId is provided (new relational model)
    if (updates.mainCategoryId !== undefined) {
      if (updates.mainCategoryId) {
        const mainCategory = await prisma.category.findUnique({
          where: { id: updates.mainCategoryId, isActive: true },
        });

        if (!mainCategory) {
          return res.status(404).json({ error: "Main category not found" });
        }
      }
    }

    // Verify subcategories if subCategoryIds are provided (new relational model)
    if (updates.subCategoryIds !== undefined && updates.subCategoryIds.length > 0) {
      const subcategories = await prisma.subCategory.findMany({
        where: {
          id: { in: updates.subCategoryIds },
          isActive: true,
        },
      });

      if (subcategories.length !== updates.subCategoryIds.length) {
        return res.status(400).json({ error: "One or more subcategories not found" });
      }
    }

    // Update menu item with transaction for subcategory relationship changes
    const updatedItem = await prisma.$transaction(async (tx) => {
      // Update menu item
      const newUpdates: any = { ...updates };
      delete newUpdates.subCategoryIds; // Remove from direct update

      const updated = await tx.menuItem.update({
        where: { id },
        data: newUpdates,
      });

      // Update subcategory relationships if subCategoryIds is provided
      if (updates.subCategoryIds !== undefined) {
        // Delete existing relationships
        await tx.menuItemCategory.deleteMany({
          where: { menuItemId: id },
        });

        // Create new relationships
        if (updates.subCategoryIds.length > 0) {
          await tx.menuItemCategory.createMany({
            data: updates.subCategoryIds.map((subCategoryId) => ({
              menuItemId: id,
              subCategoryId,
            })),
          });
        }
      }

      return updated;
    });

    // Fetch item with relations for response
    const itemWithRelations = await prisma.menuItem.findUnique({
      where: { id },
      include: {
        category: true, // LEGACY
        mainCategory: true, // NEW
        subCategoryLinks: { // NEW
          include: {
            subCategory: true,
          },
        },
      },
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "update",
      entityType: "menu_item",
      entityId: id,
      restaurantId: restaurantProfile.id,
      description: `Updated menu item: ${updatedItem.name}`,
      metadata: updates,
    });

    // Add flattened relational IDs for frontend convenience
    const serializedItem = {
      ...itemWithRelations,
      mainCategoryId: itemWithRelations?.mainCategoryId || itemWithRelations?.mainCategory?.id || null,
      subCategoryIds: itemWithRelations?.subCategoryLinks?.map(link => link.subCategoryId) || [],
    };

    res.json({ item: serializedItem });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Update item error:", error);
    res.status(500).json({ error: "Failed to update item" });
  }
});

// POST /api/restaurant/menu/items/:id/image
// Upload menu item image (OWNER only)
router.post("/menu/items/:id/image", requireKYCCompletion, requireOwnerRole, uploadMenuItemImage, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify item belongs to restaurant
    const item = await prisma.menuItem.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!item) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    // Generate file URL
    const imageUrl = getFileUrl(req.file.filename);

    // Delete old image file if exists (cleanup)
    if (item.itemImageUrl) {
      try {
        const oldFilename = item.itemImageUrl.split('/').pop();
        if (oldFilename) {
          const { deleteFile } = await import("../middleware/upload");
          deleteFile(oldFilename);
        }
      } catch (error) {
        console.error("Failed to delete old image:", error);
        // Continue even if deletion fails - new image is more important
      }
    }

    // Update menu item with new image URL
    const updatedItem = await prisma.menuItem.update({
      where: { id },
      data: { itemImageUrl: imageUrl },
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "update",
      entityType: "menu_item",
      entityId: id,
      restaurantId: restaurantProfile.id,
      description: `Uploaded image for menu item: ${item.name}`,
      metadata: { imageUrl },
    });

    res.json({
      message: "Image uploaded successfully",
      imageUrl,
      item: updatedItem,
    });
  } catch (error: any) {
    console.error("Upload menu item image error:", error);
    res.status(500).json({ error: error.message || "Failed to upload image" });
  }
});

// PATCH /api/restaurant/menu/items/:id/availability
// Toggle item availability (STAFF and OWNER allowed - no OWNER check needed)
router.patch("/menu/items/:id/availability", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify item belongs to restaurant
    const item = await prisma.menuItem.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!item) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    const schema = z.object({
      availabilityStatus: z.enum(["available", "unavailable", "out_of_stock"]),
    }).strict(); // Prevent unknown properties

    const { availabilityStatus } = schema.parse(req.body);

    const updatedItem = await prisma.menuItem.update({
      where: { id },
      data: { availabilityStatus },
      include: {
        category: true,
      },
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "update",
      entityType: "menu_item",
      entityId: id,
      restaurantId: restaurantProfile.id,
      description: `Updated item availability: ${updatedItem.name} to ${availabilityStatus}`,
      metadata: { availabilityStatus, itemName: updatedItem.name },
    });

    res.json({ item: updatedItem });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Update item availability error:", error);
    res.status(500).json({ error: "Failed to update item availability" });
  }
});

// DELETE /api/restaurant/menu/items/:id
// Delete a menu item (OWNER only)
router.delete("/menu/items/:id", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify item belongs to restaurant
    const item = await prisma.menuItem.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!item) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    // Delete associated option groups and options (cascade)
    await prisma.$transaction([
      prisma.menuOption.deleteMany({
        where: {
          optionGroup: {
            menuItemId: id,
          },
        },
      }),
      prisma.menuOptionGroup.deleteMany({
        where: { menuItemId: id },
      }),
      prisma.menuItem.delete({
        where: { id },
      }),
    ]);

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "delete",
      entityType: "menu_item",
      entityId: id,
      restaurantId: restaurantProfile.id,
      description: `Deleted menu item: ${item.name}`,
      metadata: { name: item.name, categoryId: item.categoryId },
    });

    res.json({ message: "Menu item deleted successfully" });
  } catch (error) {
    console.error("Delete item error:", error);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// PATCH /api/restaurant/menu/items/bulk
// Bulk update menu items (OWNER only - toggle availability, update prices, etc.)
router.patch("/menu/items/bulk", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const schema = z.object({
      itemIds: z.array(z.string()).min(1), // At least one item required
      updates: z.object({
        availabilityStatus: z.enum(["available", "unavailable", "out_of_stock"]).optional(),
        isFeatured: z.boolean().optional(),
        basePrice: z.coerce.number().min(0).optional(), // Coerce string to number for Decimal fields
      }).refine(data => Object.keys(data).length > 0, {
        message: "At least one field must be provided for update",
      }),
    }).strict(); // Prevent unknown properties

    const { itemIds, updates } = schema.parse(req.body);

    // Verify all items belong to restaurant
    const items = await prisma.menuItem.findMany({
      where: {
        id: { in: itemIds },
        restaurantId: restaurantProfile.id,
      },
    });

    if (items.length !== itemIds.length) {
      return res.status(400).json({ error: "Invalid item IDs" });
    }

    // Perform bulk update
    const result = await prisma.menuItem.updateMany({
      where: {
        id: { in: itemIds },
        restaurantId: restaurantProfile.id,
      },
      data: updates,
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "update",
      entityType: "menu_item",
      entityId: restaurantProfile.id,
      restaurantId: restaurantProfile.id,
      description: `Bulk updated ${itemIds.length} menu items`,
      metadata: { itemIds, updates },
    });

    res.json({ message: "Items updated successfully", count: result.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Bulk update items error:", error);
    res.status(500).json({ error: "Failed to update items" });
  }
});

// GET /api/restaurant/menu/option-groups
// List all option groups for a menu item
router.get("/menu/option-groups", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const itemId = req.query.itemId as string;

    if (!itemId) {
      return res.status(400).json({ error: "itemId is required" });
    }

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify menu item belongs to restaurant
    const menuItem = await prisma.menuItem.findFirst({
      where: {
        id: itemId,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!menuItem) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    const optionGroups = await prisma.menuOptionGroup.findMany({
      where: { itemId },
      orderBy: { createdAt: "asc" },
      include: {
        options: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    res.json({ optionGroups });
  } catch (error) {
    console.error("Get option groups error:", error);
    res.status(500).json({ error: "Failed to fetch option groups" });
  }
});

// POST /api/restaurant/menu/option-groups
// Create a new option group for a menu item (OWNER only)
router.post("/menu/option-groups", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const schema = z.object({
      itemId: z.string(),
      name: z.string().min(1).max(100),
      type: z.string().default("single"),
      isRequired: z.boolean().default(false),
      minSelect: z.number().int().min(0).optional(),
      maxSelect: z.number().int().min(0).optional(),
    }).strict(); // Prevent unknown properties

    const data = schema.parse(req.body);

    // Verify menu item belongs to restaurant
    const menuItem = await prisma.menuItem.findFirst({
      where: {
        id: data.itemId,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!menuItem) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    const optionGroup = await prisma.menuOptionGroup.create({
      data: {
        restaurantId: restaurantProfile.id,
        itemId: data.itemId,
        name: data.name,
        type: data.type,
        isRequired: data.isRequired,
        minSelect: data.minSelect || null,
        maxSelect: data.maxSelect || null,
      },
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "create",
      entityType: "menu_option_group",
      entityId: optionGroup.id,
      restaurantId: restaurantProfile.id,
      description: `Created option group: ${optionGroup.name}`,
      metadata: { name: optionGroup.name, itemId: data.itemId },
    });

    res.json({ optionGroup });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Create option group error:", error);
    res.status(500).json({ error: "Failed to create option group" });
  }
});

// PATCH /api/restaurant/menu/option-groups/:id
// Update an option group (OWNER only)
router.patch("/menu/option-groups/:id", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify option group belongs to restaurant's menu item
    const optionGroup = await prisma.menuOptionGroup.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!optionGroup) {
      return res.status(404).json({ error: "Option group not found" });
    }

    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      type: z.string().optional(),
      isRequired: z.boolean().optional(),
      minSelect: z.number().int().min(0).optional(),
      maxSelect: z.number().int().min(0).optional(),
    }).strict(); // Prevent unknown properties

    const updates = schema.parse(req.body);

    const updatedOptionGroup = await prisma.menuOptionGroup.update({
      where: { id },
      data: updates,
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "update",
      entityType: "menu_option_group",
      entityId: id,
      restaurantId: restaurantProfile.id,
      description: `Updated option group: ${updatedOptionGroup.name}`,
      metadata: updates,
    });

    res.json({ optionGroup: updatedOptionGroup });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Update option group error:", error);
    res.status(500).json({ error: "Failed to update option group" });
  }
});

// DELETE /api/restaurant/menu/option-groups/:id
// Delete an option group (OWNER only, cascade deletes options)
router.delete("/menu/option-groups/:id", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify option group belongs to restaurant's menu item
    const optionGroup = await prisma.menuOptionGroup.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!optionGroup) {
      return res.status(404).json({ error: "Option group not found" });
    }

    // Delete option group (options are cascade deleted)
    await prisma.$transaction([
      prisma.menuOption.deleteMany({
        where: { optionGroupId: id },
      }),
      prisma.menuOptionGroup.delete({
        where: { id },
      }),
    ]);

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "delete",
      entityType: "menu_option_group",
      entityId: id,
      restaurantId: restaurantProfile.id,
      description: `Deleted option group: ${optionGroup.name}`,
      metadata: { name: optionGroup.name },
    });

    res.json({ message: "Option group deleted successfully" });
  } catch (error) {
    console.error("Delete option group error:", error);
    res.status(500).json({ error: "Failed to delete option group" });
  }
});

// POST /api/restaurant/menu/options
// Create a new option for an option group (OWNER only)
router.post("/menu/options", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const schema = z.object({
      optionGroupId: z.string(),
      label: z.string().min(1).max(100),
      priceDelta: z.coerce.number().default(0), // Coerce string to number for Decimal fields
      isActive: z.boolean().default(true),
      isDefault: z.boolean().default(false),
    }).strict(); // Prevent unknown properties

    const data = schema.parse(req.body);

    // Verify option group belongs to restaurant's menu item
    const optionGroup = await prisma.menuOptionGroup.findFirst({
      where: {
        id: data.optionGroupId,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!optionGroup) {
      return res.status(404).json({ error: "Option group not found" });
    }

    const option = await prisma.menuOption.create({
      data: {
        optionGroupId: data.optionGroupId,
        label: data.label,
        priceDelta: data.priceDelta,
        isActive: data.isActive,
        isDefault: data.isDefault,
      },
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "create",
      entityType: "menu_option",
      entityId: option.id,
      restaurantId: restaurantProfile.id,
      description: `Created menu option: ${option.label}`,
      metadata: { label: option.label, optionGroupId: data.optionGroupId, priceDelta: option.priceDelta.toString() },
    });

    res.json({ option });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Create option error:", error);
    res.status(500).json({ error: "Failed to create option" });
  }
});

// PATCH /api/restaurant/menu/options/:id
// Update a menu option (OWNER only)
router.patch("/menu/options/:id", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify option belongs to restaurant's menu item
    const option = await prisma.menuOption.findFirst({
      where: {
        id,
        optionGroup: {
          restaurantId: restaurantProfile.id,
        },
      },
    });

    if (!option) {
      return res.status(404).json({ error: "Option not found" });
    }

    const schema = z.object({
      label: z.string().min(1).max(100).optional(),
      priceDelta: z.coerce.number().optional(), // Coerce string to number for Decimal fields
      isActive: z.boolean().optional(),
      isDefault: z.boolean().optional(),
    }).strict(); // Prevent unknown properties

    const updates = schema.parse(req.body);

    const updatedOption = await prisma.menuOption.update({
      where: { id },
      data: updates,
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "update",
      entityType: "menu_option",
      entityId: id,
      restaurantId: restaurantProfile.id,
      description: `Updated menu option: ${updatedOption.label}`,
      metadata: updates,
    });

    res.json({ option: updatedOption });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Update option error:", error);
    res.status(500).json({ error: "Failed to update option" });
  }
});

// DELETE /api/restaurant/menu/options/:id
// Delete a menu option (OWNER only)
router.delete("/menu/options/:id", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Verify option belongs to restaurant's menu item
    const option = await prisma.menuOption.findFirst({
      where: {
        id,
        optionGroup: {
          restaurantId: restaurantProfile.id,
        },
      },
    });

    if (!option) {
      return res.status(404).json({ error: "Option not found" });
    }

    await prisma.menuOption.delete({
      where: { id },
    });

    // Audit log
    await auditMenuAction({
      actorId: userId,
      actorEmail: restaurantProfile.user.email,
      actorRole: "restaurant",
      ipAddress: getClientIp(req),
      actionType: "delete",
      entityType: "menu_option",
      entityId: id,
      restaurantId: restaurantProfile.id,
      description: `Deleted menu option: ${option.label}`,
      metadata: { label: option.label },
    });

    res.json({ message: "Option deleted successfully" });
  } catch (error) {
    console.error("Delete option error:", error);
    res.status(500).json({ error: "Failed to delete option" });
  }
});

// ============================================================================
// ANALYTICS ENDPOINTS - Phase 4
// ============================================================================

import {
  getOverviewAnalytics,
  getItemAnalytics,
  getCustomerAnalytics,
  getDriverAnalytics,
} from "../analytics/restaurantAnalytics";

// Date range filter schema
const dateRangeSchema = z.object({
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)),
});

// GET /api/restaurant/analytics/overview - Overview metrics
router.get("/analytics/overview", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Default to last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const filters = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : startDate,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : endDate,
    };

    const metrics = await getOverviewAnalytics(restaurantProfile.id, filters);
    res.json(metrics);
  } catch (error) {
    console.error("Overview analytics error:", error);
    res.status(500).json({ error: "Failed to fetch overview analytics" });
  }
});

// GET /api/restaurant/analytics/items - Item performance analytics
router.get("/analytics/items", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const filters = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : startDate,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : endDate,
    };

    const analytics = await getItemAnalytics(restaurantProfile.id, filters);
    res.json(analytics);
  } catch (error) {
    console.error("Item analytics error:", error);
    res.status(500).json({ error: "Failed to fetch item analytics" });
  }
});

// GET /api/restaurant/analytics/customers - Customer analytics
router.get("/analytics/customers", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const filters = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : startDate,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : endDate,
    };

    const analytics = await getCustomerAnalytics(restaurantProfile.id, filters);
    res.json(analytics);
  } catch (error) {
    console.error("Customer analytics error:", error);
    res.status(500).json({ error: "Failed to fetch customer analytics" });
  }
});

// GET /api/restaurant/analytics/drivers - Driver performance analytics
router.get("/analytics/drivers", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const filters = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : startDate,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : endDate,
    };

    const analytics = await getDriverAnalytics(restaurantProfile.id, filters);
    res.json(analytics);
  } catch (error) {
    console.error("Driver analytics error:", error);
    res.status(500).json({ error: "Failed to fetch driver analytics" });
  }
});

// ====================================================
// PHASE 7: PROMOTIONS & COUPONS API
// ====================================================

// GET /api/restaurant/promotions
// Get all promotions for restaurant (OWNER-only)
router.get("/promotions", requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true, isVerified: true, countryCode: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // KYC gating: Unverified restaurants cannot create/view promotions
    if (!restaurantProfile.isVerified) {
      return res.status(403).json({
        error: "Your restaurant must be verified before accessing promotions",
        kyc_required: true,
      });
    }

    const { status, type } = req.query;

    const where: any = { restaurantId: restaurantProfile.id };

    // Filter by status
    if (status) {
      const now = new Date();
      if (status === "active") {
        where.isActive = true;
        where.isFlagged = false;
        where.startDate = { lte: now };
        where.endDate = { gte: now };
      } else if (status === "scheduled") {
        where.isActive = true;
        where.startDate = { gt: now };
      } else if (status === "expired") {
        where.endDate = { lt: now };
      }
    }

    // Filter by type
    if (type) {
      where.promoType = type;
    }

    const promotions = await prisma.promotion.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json({ promotions });
  } catch (error: any) {
    console.error("Get promotions error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch promotions" });
  }
});

// POST /api/restaurant/promotions
// Create a new promotion (OWNER-only, KYC required)
router.post("/promotions", requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true, isVerified: true, countryCode: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // KYC gating
    if (!restaurantProfile.isVerified) {
      return res.status(403).json({
        error: "Your restaurant must be verified before creating promotions",
        kyc_required: true,
      });
    }

    const {
      title,
      description,
      promoType,
      discountValue,
      discountPercentage,
      buyQuantity,
      getQuantity,
      applicableItems,
      applicableCategories,
      minOrderAmount,
      maxDiscountCap,
      usageLimitPerCustomer,
      globalUsageLimit,
      startDate,
      endDate,
      timeWindowStart,
      timeWindowEnd,
      isFirstTimeCustomerOnly,
      isActive,
    } = req.body;

    // Validate required fields
    if (!title || !promoType || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate promotion type specific fields
    if (promoType === "percentage_discount" && !discountPercentage) {
      return res.status(400).json({ error: "Discount percentage required for percentage discount" });
    }
    if (promoType === "fixed_discount" && !discountValue) {
      return res.status(400).json({ error: "Discount value required for fixed discount" });
    }
    if (promoType === "bogo" && (!buyQuantity || !getQuantity)) {
      return res.status(400).json({ error: "Buy and get quantities required for BOGO promotion" });
    }

    const promotion = await prisma.promotion.create({
      data: {
        restaurantId: restaurantProfile.id,
        title,
        description,
        promoType,
        discountValue: discountValue ? new Prisma.Decimal(discountValue) : null,
        discountPercentage: discountPercentage ? new Prisma.Decimal(discountPercentage) : null,
        buyQuantity,
        getQuantity,
        applicableItems,
        applicableCategories,
        minOrderAmount: minOrderAmount ? new Prisma.Decimal(minOrderAmount) : null,
        maxDiscountCap: maxDiscountCap ? new Prisma.Decimal(maxDiscountCap) : null,
        usageLimitPerCustomer,
        globalUsageLimit,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        timeWindowStart,
        timeWindowEnd,
        isFirstTimeCustomerOnly: isFirstTimeCustomerOnly || false,
        isActive: isActive !== undefined ? isActive : true,
        createdByOwnerId: userId,
      },
    });

    // Audit log
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await logAuditEvent({
        actorId: userId,
        actorEmail: user.email,
        actorRole: user.role,
        ipAddress: getClientIp(req),
        actionType: ActionType.CREATE_PROMOTION,
        entityType: EntityType.PROMOTION,
        entityId: promotion.id,
        description: `Created promotion: ${promotion.title}`,
        metadata: {
          promotion_id: promotion.id,
          title: promotion.title,
          promo_type: promotion.promoType,
          restaurant_id: restaurantProfile.id,
        },
      });
    }

    res.status(201).json({ promotion });
  } catch (error: any) {
    console.error("Create promotion error:", error);
    res.status(500).json({ error: error.message || "Failed to create promotion" });
  }
});

// PATCH /api/restaurant/promotions/:id
// Update a promotion (OWNER-only)
router.patch("/promotions/:id", requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true, isVerified: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Check promotion ownership
    const existingPromotion = await prisma.promotion.findUnique({
      where: { id },
    });

    if (!existingPromotion) {
      return res.status(404).json({ error: "Promotion not found" });
    }

    if (existingPromotion.restaurantId !== restaurantProfile.id) {
      return res.status(403).json({ error: "You do not have permission to update this promotion" });
    }

    const updateData: any = {};
    const allowedFields = [
      "title",
      "description",
      "discountValue",
      "discountPercentage",
      "buyQuantity",
      "getQuantity",
      "applicableItems",
      "applicableCategories",
      "minOrderAmount",
      "maxDiscountCap",
      "usageLimitPerCustomer",
      "globalUsageLimit",
      "startDate",
      "endDate",
      "timeWindowStart",
      "timeWindowEnd",
      "isFirstTimeCustomerOnly",
      "isActive",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (
          field === "discountValue" ||
          field === "discountPercentage" ||
          field === "minOrderAmount" ||
          field === "maxDiscountCap"
        ) {
          updateData[field] = req.body[field] ? new Prisma.Decimal(req.body[field]) : null;
        } else if (field === "startDate" || field === "endDate") {
          updateData[field] = new Date(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    const updatedPromotion = await prisma.promotion.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await logAuditEvent({
        actorId: userId,
        actorEmail: user.email,
        actorRole: user.role,
        ipAddress: getClientIp(req),
        actionType: ActionType.UPDATE_PROMOTION,
        entityType: EntityType.PROMOTION,
        entityId: id,
        description: `Updated promotion: ${updatedPromotion.title}`,
        metadata: {
          promotion_id: id,
          changes: Object.keys(updateData),
          restaurant_id: restaurantProfile.id,
        },
      });
    }

    res.json({ promotion: updatedPromotion });
  } catch (error: any) {
    console.error("Update promotion error:", error);
    res.status(500).json({ error: error.message || "Failed to update promotion" });
  }
});

// DELETE /api/restaurant/promotions/:id
// Delete (soft delete) a promotion (OWNER-only)
router.delete("/promotions/:id", requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Check promotion ownership
    const existingPromotion = await prisma.promotion.findUnique({
      where: { id },
    });

    if (!existingPromotion) {
      return res.status(404).json({ error: "Promotion not found" });
    }

    if (existingPromotion.restaurantId !== restaurantProfile.id) {
      return res.status(403).json({ error: "You do not have permission to delete this promotion" });
    }

    // Soft delete by setting isActive to false
    await prisma.promotion.update({
      where: { id },
      data: { isActive: false },
    });

    // Audit log
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await logAuditEvent({
        actorId: userId,
        actorEmail: user.email,
        actorRole: user.role,
        ipAddress: getClientIp(req),
        actionType: ActionType.DELETE_PROMOTION,
        entityType: EntityType.PROMOTION,
        entityId: id,
        description: `Deleted promotion: ${existingPromotion.title}`,
        metadata: {
          promotion_id: id,
          title: existingPromotion.title,
          restaurant_id: restaurantProfile.id,
        },
      });
    }

    res.json({ message: "Promotion deleted successfully" });
  } catch (error: any) {
    console.error("Delete promotion error:", error);
    res.status(500).json({ error: error.message || "Failed to delete promotion" });
  }
});

// GET /api/restaurant/promotions/coupons
// Get all coupons for restaurant (OWNER-only)
router.get("/promotions/coupons", requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true, isVerified: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // KYC gating
    if (!restaurantProfile.isVerified) {
      return res.status(403).json({
        error: "Your restaurant must be verified before accessing coupons",
        kyc_required: true,
      });
    }

    const coupons = await prisma.coupon.findMany({
      where: { restaurantId: restaurantProfile.id },
      orderBy: { createdAt: "desc" },
    });

    res.json({ coupons });
  } catch (error: any) {
    console.error("Get coupons error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch coupons" });
  }
});

// POST /api/restaurant/promotions/coupons
// Create a new coupon (OWNER-only, KYC required)
router.post("/promotions/coupons", requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true, isVerified: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // KYC gating
    if (!restaurantProfile.isVerified) {
      return res.status(403).json({
        error: "Your restaurant must be verified before creating coupons",
        kyc_required: true,
      });
    }

    const {
      code,
      discountType,
      discountValue,
      discountPercentage,
      minOrderAmount,
      maxDiscountCap,
      usageLimitPerCustomer,
      globalUsageLimit,
      startDate,
      endDate,
      isActive,
      autoGenerate,
    } = req.body;

    // Auto-generate code if requested
    let couponCode = code?.toUpperCase();
    if (autoGenerate) {
      const { generateCouponCode, isCouponCodeUnique } = await import("../promotions/validationUtils");
      let attempts = 0;
      do {
        couponCode = generateCouponCode();
        attempts++;
      } while (!(await isCouponCodeUnique(couponCode, restaurantProfile.id)) && attempts < 10);

      if (attempts >= 10) {
        return res.status(500).json({ error: "Failed to generate unique coupon code" });
      }
    }

    if (!couponCode) {
      return res.status(400).json({ error: "Coupon code is required" });
    }

    if (!discountType || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate discount type specific fields
    if (discountType === "percentage" && !discountPercentage) {
      return res.status(400).json({ error: "Discount percentage required for percentage discount" });
    }
    if (discountType === "fixed_amount" && !discountValue) {
      return res.status(400).json({ error: "Discount value required for fixed amount discount" });
    }

    // Check if code already exists
    const existing = await prisma.coupon.findFirst({
      where: {
        code: couponCode,
        restaurantId: restaurantProfile.id,
      },
    });

    if (existing) {
      return res.status(400).json({ error: "Coupon code already exists for this restaurant" });
    }

    const coupon = await prisma.coupon.create({
      data: {
        restaurantId: restaurantProfile.id,
        code: couponCode,
        discountType,
        discountValue: discountValue ? new Prisma.Decimal(discountValue) : null,
        discountPercentage: discountPercentage ? new Prisma.Decimal(discountPercentage) : null,
        minOrderAmount: minOrderAmount ? new Prisma.Decimal(minOrderAmount) : null,
        maxDiscountCap: maxDiscountCap ? new Prisma.Decimal(maxDiscountCap) : null,
        usageLimitPerCustomer,
        globalUsageLimit,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive !== undefined ? isActive : true,
        createdByOwnerId: userId,
      },
    });

    // Audit log
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await logAuditEvent({
        actorId: userId,
        actorEmail: user.email,
        actorRole: user.role,
        ipAddress: getClientIp(req),
        actionType: ActionType.CREATE_COUPON,
        entityType: EntityType.COUPON,
        entityId: coupon.id,
        description: `Created coupon: ${coupon.code}`,
        metadata: {
          coupon_id: coupon.id,
          code: coupon.code,
          discount_type: coupon.discountType,
          restaurant_id: restaurantProfile.id,
        },
      });
    }

    res.status(201).json({ coupon });
  } catch (error: any) {
    console.error("Create coupon error:", error);
    res.status(500).json({ error: error.message || "Failed to create coupon" });
  }
});

// ====================================================
// PHASE 8: Restaurant Review & Rating Management System
// ====================================================

// ====================================================
// GET /api/restaurant/reviews
// Get all reviews for this restaurant
// ====================================================
router.get("/reviews", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true, ownerRole: true, canViewAnalytics: true, managedByOwnerId: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // RBAC: Allow OWNER or STAFF with canViewAnalytics permission
    const role = restaurantProfile.ownerRole || "OWNER";
    if (role === "STAFF" && !restaurantProfile.canViewAnalytics) {
      return res.status(403).json({
        error: "Insufficient permissions",
        message: "You need analytics permission to view reviews",
      });
    }

    // Parse query parameters for filtering
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
    const includeHidden = req.query.includeHidden === "true";

    // Build where clause
    const where: any = {
      restaurantId: restaurantProfile.id,
    };

    // Filter by rating if specified
    if (rating && rating >= 1 && rating <= 5) {
      where.rating = rating;
    }

    // Filter hidden reviews (default: exclude hidden)
    if (!includeHidden) {
      where.isHidden = false;
    }

    // Get reviews with pagination - NO customer data included for privacy
    const [reviews, totalCount] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              createdAt: true,
              deliveredAt: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);

    res.json({
      reviews: reviews.map((review: any, index: number) => ({
        id: review.id,
        // NO orderId, restaurantId, or customer data - privacy protection
        orderDate: review.order.createdAt,
        deliveredAt: review.order.deliveredAt,
        // Anonymous reviewer identifier (sequential per page)
        reviewerLabel: `Reviewer #${(page - 1) * limit + index + 1}`,
        rating: review.rating,
        reviewText: review.reviewText,
        images: review.images,
        isHidden: review.isHidden,
        isFlagged: review.isFlagged,
        createdAt: review.createdAt,
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    console.error("Get reviews error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch reviews" });
  }
});

// ====================================================
// GET /api/restaurant/reviews/stats
// Get review statistics for this restaurant
// ====================================================
router.get("/reviews/stats", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true, ownerRole: true, canViewAnalytics: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // RBAC: Allow OWNER or STAFF with canViewAnalytics permission
    const role = restaurantProfile.ownerRole || "OWNER";
    if (role === "STAFF" && !restaurantProfile.canViewAnalytics) {
      return res.status(403).json({
        error: "Insufficient permissions",
        message: "You need analytics permission to view review statistics",
      });
    }

    // Get all non-hidden reviews for this restaurant
    const reviews = await prisma.review.findMany({
      where: {
        restaurantId: restaurantProfile.id,
        isHidden: false,
      },
      select: {
        rating: true,
      },
    });

    // Calculate statistics
    const totalReviews = reviews.length;
    let averageRating = 0;
    const ratingDistribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    if (totalReviews > 0) {
      let sum = 0;
      reviews.forEach((review: any) => {
        sum += review.rating;
        ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
      });
      averageRating = sum / totalReviews;
    }

    // Calculate percentages for distribution
    const ratingDistributionPercentage = {
      1: totalReviews > 0 ? (ratingDistribution[1] / totalReviews) * 100 : 0,
      2: totalReviews > 0 ? (ratingDistribution[2] / totalReviews) * 100 : 0,
      3: totalReviews > 0 ? (ratingDistribution[3] / totalReviews) * 100 : 0,
      4: totalReviews > 0 ? (ratingDistribution[4] / totalReviews) * 100 : 0,
      5: totalReviews > 0 ? (ratingDistribution[5] / totalReviews) * 100 : 0,
    };

    res.json({
      totalReviews,
      averageRating: Number(averageRating.toFixed(2)),
      ratingDistribution,
      ratingDistributionPercentage,
    });
  } catch (error: any) {
    console.error("Get review stats error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch review statistics" });
  }
});

// ====================================================
// PHASE 9: Restaurant Branding & Media Gallery
// ====================================================

// GET /api/restaurant/branding - Get restaurant branding settings
router.get("/branding", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true, ownerRole: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Check if STAFF has analytics permission (read-only access)
    const role = restaurantProfile.ownerRole || "OWNER";
    if (role === "STAFF") {
      const fullProfile = await prisma.restaurantProfile.findUnique({
        where: { id: restaurantProfile.id },
        select: { canViewAnalytics: true },
      });
      
      if (!fullProfile?.canViewAnalytics) {
        return res.status(403).json({
          error: "Insufficient permissions",
          message: "You need analytics permission to view branding settings",
        });
      }
    }

    // Get or create branding settings
    let branding = await prisma.restaurantBranding.findUnique({
      where: { restaurantId: restaurantProfile.id },
    });

    // If no branding exists, create default
    if (!branding) {
      branding = await prisma.restaurantBranding.create({
        data: {
          restaurantId: restaurantProfile.id,
          themeMode: "light",
        },
      });
    }

    res.json(branding);
  } catch (error: any) {
    console.error("Get branding error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch branding settings" });
  }
});

// PATCH /api/restaurant/branding - Update restaurant branding settings (OWNER-only)
router.patch("/branding", requireKYCCompletion, requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Validate input
    const updateSchema = z.object({
      logoUrl: z.string().url().optional().nullable(),
      coverPhotoUrl: z.string().url().optional().nullable(),
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
      secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
      themeMode: z.enum(["light", "dark", "auto"]).optional(),
    });

    const validatedData = updateSchema.parse(req.body);

    // Get or create branding
    let branding = await prisma.restaurantBranding.findUnique({
      where: { restaurantId: restaurantProfile.id },
    });

    if (!branding) {
      // Create new branding
      branding = await prisma.restaurantBranding.create({
        data: {
          restaurantId: restaurantProfile.id,
          ...validatedData,
        },
      });
    } else {
      // Update existing branding
      branding = await prisma.restaurantBranding.update({
        where: { restaurantId: restaurantProfile.id },
        data: validatedData,
      });
    }

    // Audit log
    await logAuditEvent({
      entityType: EntityType.RESTAURANT,
      entityId: restaurantProfile.id,
      userId,
      action: ActionType.UPDATE,
      details: `Updated branding settings`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
    });

    res.json(branding);
  } catch (error: any) {
    console.error("Update branding error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid branding data", details: error.errors });
    }
    res.status(500).json({ error: error.message || "Failed to update branding settings" });
  }
});

// POST /api/restaurant/upload-image - Upload branding/gallery images (OWNER only)
router.post("/upload-image", requireKYCCompletion, requireOwnerRole, (req: AuthRequest, res, next) => {
  uploadRestaurantImage(req, res, (err) => {
    if (err) {
      console.error("Restaurant image upload error:", err);
      return res.status(400).json({ 
        error: err.message || "Failed to upload image",
        errorCode: "UPLOAD_FAILED"
      });
    }
    next();
  });
}, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ 
        error: "No file provided",
        errorCode: "NO_FILE"
      });
    }

    // Validate image type from query param
    const imageType = req.query.type as string;
    const validTypes = ["logo", "cover", "gallery", "menu_item"];
    if (!imageType || !validTypes.includes(imageType)) {
      return res.status(400).json({ 
        error: "Invalid image type",
        errorCode: "INVALID_TYPE",
        validTypes
      });
    }

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true, user: { select: { email: true } } },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Generate the URL for the uploaded file
    const fileUrl = getFileUrl(file.filename);

    const messages: Record<string, string> = {
      logo: "Logo uploaded successfully",
      cover: "Cover photo uploaded successfully",
      gallery: "Gallery image uploaded successfully",
      menu_item: "Menu item image uploaded successfully"
    };

    // If this is a logo or cover, update branding
    if (imageType === "logo" || imageType === "cover") {
      const updateField = imageType === "logo" ? "logoUrl" : "coverPhotoUrl";
      
      // Get existing branding to clean up old file
      const existingBranding = await prisma.restaurantBranding.findUnique({
        where: { restaurantId: restaurantProfile.id },
        select: { logoUrl: true, coverPhotoUrl: true }
      });

      const oldUrl = existingBranding?.[updateField as keyof typeof existingBranding];
      if (oldUrl && typeof oldUrl === 'string') {
        try {
          const oldFilename = oldUrl.split('/').pop();
          if (oldFilename) {
            deleteFile(oldFilename);
          }
        } catch (err) {
          console.error("Failed to delete old branding file:", err);
        }
      }

      // Create or update branding
      await prisma.restaurantBranding.upsert({
        where: { restaurantId: restaurantProfile.id },
        create: {
          restaurantId: restaurantProfile.id,
          [updateField]: fileUrl,
        },
        update: {
          [updateField]: fileUrl,
        },
      });
    }

    // Audit log
    await logAuditEvent({
      entityType: EntityType.RESTAURANT,
      entityId: restaurantProfile.id,
      userId,
      action: ActionType.CREATE,
      details: `Uploaded ${imageType} image`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
    });

    res.json({
      success: true,
      url: fileUrl,
      type: imageType,
      filename: file.filename,
      message: messages[imageType]
    });
  } catch (error: any) {
    console.error("Restaurant image upload error:", error);
    res.status(500).json({ 
      error: "Failed to upload image",
      errorCode: "SERVER_ERROR"
    });
  }
});

// GET /api/restaurant/gallery - Get restaurant media gallery
router.get("/gallery", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true, ownerRole: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Check if STAFF has analytics permission (read-only access)
    const role = restaurantProfile.ownerRole || "OWNER";
    if (role === "STAFF") {
      const fullProfile = await prisma.restaurantProfile.findUnique({
        where: { id: restaurantProfile.id },
        select: { canViewAnalytics: true },
      });
      
      if (!fullProfile?.canViewAnalytics) {
        return res.status(403).json({
          error: "Insufficient permissions",
          message: "You need analytics permission to view gallery",
        });
      }
    }

    // Get media gallery (exclude admin-hidden items for STAFF)
    const where: any = { restaurantId: restaurantProfile.id };
    if (role === "STAFF") {
      where.isHidden = false;
    }

    const media = await prisma.restaurantMedia.findMany({
      where,
      orderBy: [
        { displayOrder: "asc" },
        { createdAt: "desc" },
      ],
    });

    res.json(media);
  } catch (error: any) {
    console.error("Get gallery error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch gallery" });
  }
});

// POST /api/restaurant/gallery/upload - Upload media to gallery
router.post("/gallery/upload", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true, ownerRole: true, canViewAnalytics: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Check permissions - OWNER always has access, STAFF needs canViewAnalytics
    const role = restaurantProfile.ownerRole || "OWNER";
    if (role === "STAFF" && !restaurantProfile.canViewAnalytics) {
      return res.status(403).json({
        error: "Insufficient permissions",
        message: "You need analytics permission to upload media",
      });
    }

    // Validate input
    const uploadSchema = z.object({
      filePath: z.string().min(1),
      fileUrl: z.string().url().optional().nullable(),
      fileType: z.string().default("image"),
      category: z.enum(["food", "ambience", "team", "kitchen", "other"]),
    });

    const validatedData = uploadSchema.parse(req.body);

    // Check gallery limit (max 50 photos)
    const mediaCount = await prisma.restaurantMedia.count({
      where: { restaurantId: restaurantProfile.id },
    });

    if (mediaCount >= 50) {
      return res.status(400).json({ error: "Gallery limit reached (50 photos maximum)" });
    }

    // Get next display order
    const lastMedia = await prisma.restaurantMedia.findFirst({
      where: { restaurantId: restaurantProfile.id },
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    });

    const displayOrder = (lastMedia?.displayOrder ?? -1) + 1;

    // Create media entry
    const media = await prisma.restaurantMedia.create({
      data: {
        restaurantId: restaurantProfile.id,
        filePath: validatedData.filePath,
        fileUrl: validatedData.fileUrl,
        fileType: validatedData.fileType,
        category: validatedData.category,
        displayOrder,
      },
    });

    // Audit log
    await logAuditEvent({
      entityType: EntityType.RESTAURANT,
      entityId: restaurantProfile.id,
      userId,
      action: ActionType.CREATE,
      details: `Uploaded media to gallery (${validatedData.category})`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
    });

    res.json(media);
  } catch (error: any) {
    console.error("Upload media error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid media data", details: error.errors });
    }
    res.status(500).json({ error: error.message || "Failed to upload media" });
  }
});

// PATCH /api/restaurant/gallery/:id - Update media (category, displayOrder)
router.patch("/gallery/:id", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true, ownerRole: true, canViewAnalytics: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Check permissions
    const role = restaurantProfile.ownerRole || "OWNER";
    if (role === "STAFF" && !restaurantProfile.canViewAnalytics) {
      return res.status(403).json({
        error: "Insufficient permissions",
        message: "You need analytics permission to update media",
      });
    }

    // Verify media belongs to this restaurant
    const media = await prisma.restaurantMedia.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!media) {
      return res.status(404).json({ error: "Media not found" });
    }

    // Validate input
    const updateSchema = z.object({
      category: z.enum(["food", "ambience", "team", "kitchen", "other"]).optional(),
      displayOrder: z.number().int().min(0).optional(),
    });

    const validatedData = updateSchema.parse(req.body);

    // Update media
    const updatedMedia = await prisma.restaurantMedia.update({
      where: { id },
      data: validatedData,
    });

    // Audit log
    await logAuditEvent({
      entityType: EntityType.RESTAURANT,
      entityId: restaurantProfile.id,
      userId,
      action: ActionType.UPDATE,
      details: `Updated gallery media ${id}`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
    });

    res.json(updatedMedia);
  } catch (error: any) {
    console.error("Update media error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid media data", details: error.errors });
    }
    res.status(500).json({ error: error.message || "Failed to update media" });
  }
});

// DELETE /api/restaurant/gallery/:id - Delete media (soft delete)
router.delete("/gallery/:id", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true, ownerRole: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Only OWNER can delete
    const role = restaurantProfile.ownerRole || "OWNER";
    if (role !== "OWNER") {
      return res.status(403).json({
        error: "Insufficient permissions",
        message: "Only restaurant owners can delete media",
      });
    }

    // Verify media belongs to this restaurant
    const media = await prisma.restaurantMedia.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!media) {
      return res.status(404).json({ error: "Media not found" });
    }

    // Delete media (hard delete for Phase 9, can be converted to soft delete later)
    await prisma.restaurantMedia.delete({
      where: { id },
    });

    // Audit log
    await logAuditEvent({
      entityType: EntityType.RESTAURANT,
      entityId: restaurantProfile.id,
      userId,
      action: ActionType.DELETE,
      details: `Deleted gallery media ${id}`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
    });

    res.json({ success: true, message: "Media deleted successfully" });
  } catch (error: any) {
    console.error("Delete media error:", error);
    res.status(500).json({ error: error.message || "Failed to delete media" });
  }
});

// =====================================================
// GET /api/restaurant/analytics
// Get restaurant analytics and performance insights
// Security: KYC required for financial data, restaurantId scoped
// =====================================================
router.get("/analytics", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { range = "7d" } = req.query;

    // Get restaurant profile
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Calculate time range
    const now = new Date();
    let startDate: Date;
    let groupBy: "hour" | "day" = "day";

    switch (range) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        groupBy = "hour";
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = "day";
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupBy = "day";
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = "day";
    }

    // Fetch all orders in the time range (scoped to this restaurant only)
    const orders = await prisma.foodOrder.findMany({
      where: {
        restaurantId: restaurantProfile.id,
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        id: true,
        orderCode: true,
        status: true,
        items: true,
        serviceFare: true,
        restaurantPayout: true,
        safegoCommission: true,
        paymentMethod: true,
        orderType: true,
        createdAt: true,
        acceptedAt: true,
        preparingAt: true,
        readyAt: true,
        pickedUpAt: true,
        deliveredAt: true,
        completedAt: true,
        whoCancelled: true,
        cancellationReason: true,
        customer: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate KPIs
    const totalOrders = orders.length;
    
    // Completed orders: successfully delivered/completed
    const completedOrders = orders.filter(o => 
      o.status === "delivered" || o.status === "completed"
    );
    
    // Calculate earnings and AOV from completed orders only (more accurate)
    const totalEarnings = completedOrders.reduce((sum, order) => sum + Number(order.restaurantPayout || 0), 0);
    const averageOrderValue = completedOrders.length > 0 ? totalEarnings / completedOrders.length : 0;

    // Acceptance rate: accepted orders / all orders (simple and transparent)
    const acceptedOrders = orders.filter(o => o.acceptedAt !== null);
    const acceptanceRate = totalOrders > 0 ? (acceptedOrders.length / totalOrders) * 100 : 0;

    // Cancellation rate: cancelled orders / total orders
    const cancelledOrders = orders.filter(o => 
      o.status.includes("cancelled") || o.whoCancelled !== null
    );
    const cancellationRate = totalOrders > 0 ? (cancelledOrders.length / totalOrders) * 100 : 0;

    // On-time completion rate: completed orders / accepted orders (as percentage)
    const onTimeCompletionRate = acceptedOrders.length > 0 ? (completedOrders.length / acceptedOrders.length) * 100 : 0;

    // Group orders by time bucket for charts
    const ordersOverTime: { [key: string]: number } = {};
    const earningsOverTime: { [key: string]: number } = {};

    orders.forEach(order => {
      const date = new Date(order.createdAt);
      let key: string;

      if (groupBy === "hour") {
        // Group by hour for "today"
        key = `${date.getHours()}:00`;
      } else {
        // Group by date for 7d and 30d
        key = date.toISOString().split("T")[0];
      }

      ordersOverTime[key] = (ordersOverTime[key] || 0) + 1;
      earningsOverTime[key] = (earningsOverTime[key] || 0) + Number(order.restaurantPayout || 0);
    });

    // Convert to arrays for charts
    const ordersTimeSeries = Object.entries(ordersOverTime)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const earningsTimeSeries = Object.entries(earningsOverTime)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top categories and items analysis
    const itemStats: { [key: string]: { count: number; revenue: number } } = {};
    const categoryStats: { [key: string]: { count: number; revenue: number } } = {};

    orders.forEach(order => {
      const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items;
      const orderRevenue = Number(order.restaurantPayout || 0);

      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          const itemName = item.name || item.itemName || "Unknown";
          const category = item.category || "Uncategorized";

          // Track item stats
          if (!itemStats[itemName]) {
            itemStats[itemName] = { count: 0, revenue: 0 };
          }
          itemStats[itemName].count += 1;
          itemStats[itemName].revenue += orderRevenue / items.length; // Distribute revenue evenly

          // Track category stats
          if (!categoryStats[category]) {
            categoryStats[category] = { count: 0, revenue: 0 };
          }
          categoryStats[category].count += 1;
          categoryStats[category].revenue += orderRevenue / items.length;
        });
      }
    });

    // Top 5 items and categories
    const topItems = Object.entries(itemStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topCategories = Object.entries(categoryStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Recent orders (last 30 in range)
    const recentOrders = orders.slice(0, 30).map(order => ({
      id: order.id,
      orderCode: order.orderCode,
      customerName: order.customer?.user?.name || "Customer",
      amount: Number(order.restaurantPayout || 0),
      orderType: order.orderType,
      status: order.status,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
    }));

    // Audit log for analytics access
    await logAuditEvent({
      entityType: EntityType.RESTAURANT,
      entityId: restaurantProfile.id,
      userId,
      action: ActionType.VIEW,
      details: `Viewed analytics for range: ${range}`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
    });

    res.json({
      range,
      groupBy,
      kpis: {
        totalOrders,
        totalEarnings,
        averageOrderValue,
        acceptanceRate,
        cancellationRate,
        onTimeCompletionRate,
      },
      charts: {
        ordersOverTime: ordersTimeSeries,
        earningsOverTime: earningsTimeSeries,
        topItems,
        topCategories,
      },
      recentOrders,
    });
  } catch (error: any) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch analytics" });
  }
});

// =====================================================
// STAFF MANAGEMENT ROUTES (R3)
// Security: OWNER-only access, audit logging enabled
// =====================================================

// GET /api/restaurant/staff - List all staff members (OWNER only, KYC required)
router.get("/staff", requireOwnerRole, requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get restaurant profile
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Get all staff members for this owner
    const staff = await getStaffForOwner(restaurantProfile.id);

    // Audit log
    await logAuditEvent({
      entityType: EntityType.RESTAURANT,
      entityId: restaurantProfile.id,
      userId,
      action: ActionType.VIEW,
      details: `Viewed staff list (${staff.length} members)`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
    });

    res.json({ staff });
  } catch (error: any) {
    console.error("List staff error:", error);
    res.status(500).json({ error: error.message || "Failed to list staff" });
  }
});

// POST /api/restaurant/staff - Invite/create new staff member (OWNER only, KYC required)
router.post("/staff", requireOwnerRole, requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { name, email, phone, temporaryPassword, permissions } = req.body;

    // Validation
    if (!name || !email || !temporaryPassword) {
      return res.status(400).json({ error: "Name, email, and temporary password are required" });
    }

    // Get restaurant profile
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Create staff member
    const { user, restaurantProfile: staffProfile } = await createStaffMember(
      restaurantProfile.id,
      {
        name,
        email,
        phone: phone || "",
        temporaryPassword,
        permissions,
      }
    );

    // Audit log
    await logAuditEvent({
      entityType: EntityType.RESTAURANT,
      entityId: restaurantProfile.id,
      userId,
      action: ActionType.CREATE,
      details: `Created staff member: ${name} (${email})`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
    });

    res.json({
      success: true,
      message: "Staff member created successfully",
      staff: {
        id: staffProfile.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        ...staffProfile,
      },
    });
  } catch (error: any) {
    console.error("Create staff error:", error);
    res.status(500).json({ error: error.message || "Failed to create staff member" });
  }
});

// PATCH /api/restaurant/staff/:staffId - Update staff permissions/status (OWNER only)
router.patch("/staff/:staffId", requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { staffId } = req.params;
    const { permissions, staffActive } = req.body;

    // Verify owner can manage this staff member
    const canManage = await canManageStaff(userId, staffId);
    if (!canManage) {
      return res.status(403).json({ error: "You cannot manage this staff member" });
    }

    // Get restaurant profile for audit logging
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    // Update staff profile
    const updatedStaff = await prisma.restaurantProfile.update({
      where: { id: staffId },
      data: {
        staffActive: staffActive !== undefined ? staffActive : undefined,
        canEditCategories: permissions?.canEditCategories,
        canEditItems: permissions?.canEditItems,
        canToggleAvailability: permissions?.canToggleAvailability,
        canUseBulkTools: permissions?.canUseBulkTools,
        canViewAnalytics: permissions?.canViewAnalytics,
        canViewPayouts: permissions?.canViewPayouts,
        canManageOrders: permissions?.canManageOrders,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    // Audit log
    await logAuditEvent({
      entityType: EntityType.RESTAURANT,
      entityId: restaurantProfile!.id,
      userId,
      action: ActionType.UPDATE,
      details: `Updated staff member: ${updatedStaff.user.name} (${staffId})`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
    });

    res.json({
      success: true,
      message: "Staff member updated successfully",
      staff: updatedStaff,
    });
  } catch (error: any) {
    console.error("Update staff error:", error);
    res.status(500).json({ error: error.message || "Failed to update staff member" });
  }
});

// DELETE /api/restaurant/staff/:staffId - Remove staff member (OWNER only)
router.delete("/staff/:staffId", requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { staffId } = req.params;

    // Verify owner can manage this staff member
    const canManage = await canManageStaff(userId, staffId);
    if (!canManage) {
      return res.status(403).json({ error: "You cannot manage this staff member" });
    }

    // Get restaurant profile for audit logging
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    // Get staff details before deletion
    const staffProfile = await prisma.restaurantProfile.findUnique({
      where: { id: staffId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!staffProfile) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    // Soft delete: just deactivate instead of hard delete
    await prisma.restaurantProfile.update({
      where: { id: staffId },
      data: { staffActive: false },
    });

    // Audit log
    await logAuditEvent({
      entityType: EntityType.RESTAURANT,
      entityId: restaurantProfile!.id,
      userId,
      action: ActionType.DELETE,
      details: `Removed staff member: ${staffProfile.user.name} (${staffProfile.user.email})`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
    });

    res.json({
      success: true,
      message: "Staff member removed successfully",
    });
  } catch (error: any) {
    console.error("Remove staff error:", error);
    res.status(500).json({ error: error.message || "Failed to remove staff member" });
  }
});

// POST /api/restaurant/staff/:staffId/block - Block/unblock staff member (OWNER only)
router.post("/staff/:staffId/block", requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { staffId } = req.params;
    const { block, reason } = req.body;

    // Verify owner can manage this staff member
    const canManage = await canManageStaff(userId, staffId);
    if (!canManage) {
      return res.status(403).json({ error: "You cannot manage this staff member" });
    }

    // Get restaurant profile for audit logging
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    // Get staff details before update
    const staffProfile = await prisma.restaurantProfile.findUnique({
      where: { id: staffId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!staffProfile) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    // Update staff active status
    const updatedStaff = await prisma.restaurantProfile.update({
      where: { id: staffId },
      data: { staffActive: !block },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    // Create notification for staff member
    await prisma.notification.create({
      data: {
        userId: updatedStaff.userId,
        type: "alert",
        title: block ? "Account Suspended" : "Account Activated",
        body: block
          ? `Your staff account has been suspended.${reason ? ` Reason: ${reason}` : ""}`
          : "Your staff account has been activated. You can now log in.",
      },
    });

    // Audit log
    await logAuditEvent({
      entityType: EntityType.RESTAURANT,
      entityId: restaurantProfile!.id,
      userId,
      action: block ? ActionType.DELETE : ActionType.UPDATE,
      details: `${block ? "Blocked" : "Unblocked"} staff member: ${staffProfile.user.name} (${staffProfile.user.email})${reason ? ` - Reason: ${reason}` : ""}`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
    });

    res.json({
      success: true,
      message: `Staff member ${block ? "blocked" : "unblocked"} successfully`,
      staff: updatedStaff,
    });
  } catch (error: any) {
    console.error("Block/unblock staff error:", error);
    res.status(500).json({ error: error.message || "Failed to block/unblock staff member" });
  }
});

// GET /api/restaurant/staff/activity - Get staff activity log (OWNER only)
router.get("/staff/activity", requireOwnerRole, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { limit = 50, offset = 0, staffId } = req.query;

    // Get restaurant profile
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Get all staff members for this owner to filter audit logs
    const staff = await getStaffForOwner(restaurantProfile.id);
    const staffUserIds = staff.map((s) => s.user.id);

    // If staffId query param is provided, validate ownership and filter to that staff member
    let actorIdFilter: string | string[] = staffUserIds;
    if (staffId && typeof staffId === "string") {
      // Validate that the requested staff member belongs to this owner
      const canManage = await canManageStaff(userId, staffId);
      if (!canManage) {
        return res.status(403).json({
          error: "You do not have permission to view this staff member's activity",
        });
      }

      // Find the staff member's user ID
      const staffMember = staff.find((s) => s.id === staffId);
      if (staffMember) {
        actorIdFilter = staffMember.user.id;
      } else {
        // staffId provided but not found in owner's staff - return empty result
        return res.json({
          logs: [],
          total: 0,
          limit: Number(limit),
          offset: Number(offset),
        });
      }
    }

    // Build where clause - only show logs from staff members, not all restaurant logs
    const where = {
      entityType: EntityType.RESTAURANT,
      entityId: restaurantProfile.id,
      userId: Array.isArray(actorIdFilter) ? { in: actorIdFilter } : actorIdFilter,
    };

    // Get activity logs filtered by staff members only
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: {
        timestamp: "desc",
      },
      take: Number(limit),
      skip: Number(offset),
    });

    // Get total count
    const total = await prisma.auditLog.count({ where });

    // Get user details for each log
    const userIds = [...new Set(logs.map((log) => log.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const logsWithUsers = logs.map((log) => ({
      ...log,
      user: userMap.get(log.userId),
    }));

    res.json({
      logs: logsWithUsers,
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error: any) {
    console.error("Activity log error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch activity log" });
  }
});

// =====================================================
// PROMOTION MANAGEMENT ROUTES (R4)
// Security: OWNER or STAFF with canManagePromotions permission
// =====================================================

// Middleware to check promotion management permission
async function requirePromotionPermission(req: AuthRequest, res: any, next: any) {
  try {
    const userId = req.user!.userId;
    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const role = restaurantProfile.ownerRole || "OWNER";
    
    // OWNER always has permission, STAFF needs canManagePromotions
    if (role !== "OWNER" && !restaurantProfile.canManagePromotions) {
      return res.status(403).json({
        error: "Insufficient permissions",
        message: "You do not have permission to manage promotions",
      });
    }

    next();
  } catch (error) {
    console.error("Promotion permission check error:", error);
    return res.status(500).json({ error: "Failed to verify permissions" });
  }
}

// GET /api/restaurant/promotions - List all promotions
router.get("/promotions", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { status, type, search, limit = 50, offset = 0 } = req.query;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Build where clause
    const where: any = {
      restaurantId: restaurantProfile.id,
    };

    if (status && typeof status === "string") {
      where.status = status as any;
    }

    if (type && typeof type === "string") {
      where.promoType = type as any;
    }

    if (search && typeof search === "string") {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get promotions
    const promotions = await prisma.promotion.findMany({
      where,
      include: {
        coupons: {
          select: { id: true, code: true, currentUsageCount: true },
        },
        _count: {
          select: { promotionUsages: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: Number(limit),
      skip: Number(offset),
    });

    // Get total count
    const total = await prisma.promotion.count({ where });

    // Audit log
    await logAuditEvent({
      entityType: EntityType.RESTAURANT,
      entityId: restaurantProfile.id,
      userId,
      action: ActionType.VIEW,
      details: `Viewed promotions list (${promotions.length} promotions)`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
    });

    res.json({
      promotions,
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error: any) {
    console.error("List promotions error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch promotions" });
  }
});

// POST /api/restaurant/promotions - Create new promotion
router.post("/promotions", requireKYCCompletion, requirePromotionPermission, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const {
      title,
      description,
      promoType,
      discountValue,
      discountPercentage,
      buyQuantity,
      getQuantity,
      applicableItems,
      applicableCategories,
      minOrderAmount,
      maxDiscountCap,
      usageLimitPerCustomer,
      globalUsageLimit,
      startDate,
      endDate,
      timeWindowStart,
      timeWindowEnd,
      daysOfWeek,
      isFirstTimeCustomerOnly,
      couponCode,
      autoGenerateCoupon,
    } = req.body;

    // Validation
    if (!title || !promoType || !startDate || !endDate) {
      return res.status(400).json({ error: "Title, promotion type, start date, and end date are required" });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      return res.status(400).json({ error: "End date must be after start date" });
    }

    // Validate discount
    if (promoType === "percentage_discount" && (!discountPercentage || discountPercentage <= 0 || discountPercentage > 100)) {
      return res.status(400).json({ error: "Percentage discount must be between 0 and 100" });
    }

    if (promoType === "fixed_discount" && (!discountValue || discountValue <= 0)) {
      return res.status(400).json({ error: "Fixed discount amount must be greater than 0" });
    }

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true, countryCode: true, user: { select: { countryCode: true } } },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Determine promotion status based on dates
    const now = new Date();
    let status: any = "UPCOMING";
    if (now >= start && now <= end) {
      status = "ACTIVE";
    } else if (now > end) {
      status = "EXPIRED";
    }

    // Create promotion
    const promotion = await prisma.promotion.create({
      data: {
        restaurantId: restaurantProfile.id,
        title,
        description,
        promoType,
        status,
        discountValue: discountValue ? parseFloat(discountValue) : null,
        discountPercentage: discountPercentage ? parseFloat(discountPercentage) : null,
        buyQuantity,
        getQuantity,
        applicableItems: applicableItems || null,
        applicableCategories: applicableCategories || null,
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : null,
        maxDiscountCap: maxDiscountCap ? parseFloat(maxDiscountCap) : null,
        usageLimitPerCustomer: usageLimitPerCustomer ? parseInt(usageLimitPerCustomer) : null,
        globalUsageLimit: globalUsageLimit ? parseInt(globalUsageLimit) : null,
        startDate: start,
        endDate: end,
        timeWindowStart,
        timeWindowEnd,
        daysOfWeek: daysOfWeek || [],
        isFirstTimeCustomerOnly: isFirstTimeCustomerOnly || false,
        createdByOwnerId: restaurantProfile.id,
      },
    });

    // Create coupon if requested
    let coupon = null;
    if (autoGenerateCoupon || couponCode) {
      const code = couponCode || `PROMO${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      
      // Check code uniqueness
      const existing = await prisma.coupon.findUnique({
        where: { restaurantId_code: { restaurantId: restaurantProfile.id, code } },
      });

      if (existing) {
        return res.status(400).json({ error: "Coupon code already exists" });
      }

      coupon = await prisma.coupon.create({
        data: {
          restaurantId: restaurantProfile.id,
          promotionId: promotion.id,
          code,
          discountType: promoType === "percentage_discount" ? "percentage" : "fixed_amount",
          discountValue: discountValue ? parseFloat(discountValue) : null,
          discountPercentage: discountPercentage ? parseFloat(discountPercentage) : null,
          minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : null,
          maxDiscountCap: maxDiscountCap ? parseFloat(maxDiscountCap) : null,
          usageLimitPerCustomer: usageLimitPerCustomer ? parseInt(usageLimitPerCustomer) : null,
          globalUsageLimit: globalUsageLimit ? parseInt(globalUsageLimit) : null,
          startDate: start,
          endDate: end,
          createdByOwnerId: restaurantProfile.id,
        },
      });
    }

    // Audit log
    await logAuditEvent({
      entityType: EntityType.RESTAURANT,
      entityId: restaurantProfile.id,
      userId,
      action: ActionType.CREATE,
      details: `Created promotion: ${title}${coupon ? ` with coupon code: ${coupon.code}` : ""}`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json({ promotion, coupon });
  } catch (error: any) {
    console.error("Create promotion error:", error);
    res.status(500).json({ error: error.message || "Failed to create promotion" });
  }
});

// GET /api/restaurant/promotions/:id - Get promotion detail
router.get("/promotions/:id", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const promotion = await prisma.promotion.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
      include: {
        coupons: true,
        promotionUsages: {
          orderBy: { usedAt: "desc" },
          take: 10,
        },
        _count: {
          select: { promotionUsages: true },
        },
      },
    });

    if (!promotion) {
      return res.status(404).json({ error: "Promotion not found" });
    }

    res.json({ promotion });
  } catch (error: any) {
    console.error("Get promotion error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch promotion" });
  }
});

// PATCH /api/restaurant/promotions/:id - Update promotion
router.patch("/promotions/:id", requireKYCCompletion, requirePromotionPermission, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const updates = req.body;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    // Check if promotion exists and belongs to this restaurant
    const existing = await prisma.promotion.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Promotion not found" });
    }

    // Validate dates if provided
    if (updates.startDate && updates.endDate) {
      const start = new Date(updates.startDate);
      const end = new Date(updates.endDate);
      if (end <= start) {
        return res.status(400).json({ error: "End date must be after start date" });
      }
    }

    // Update promotion
    const promotion = await prisma.promotion.update({
      where: { id },
      data: {
        ...updates,
        updatedByOwnerId: restaurantProfile.id,
      },
    });

    // Audit log
    await logAuditEvent({
      entityType: EntityType.RESTAURANT,
      entityId: restaurantProfile.id,
      userId,
      action: ActionType.UPDATE,
      details: `Updated promotion: ${promotion.title}`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
    });

    res.json({ promotion });
  } catch (error: any) {
    console.error("Update promotion error:", error);
    res.status(500).json({ error: error.message || "Failed to update promotion" });
  }
});

// POST /api/restaurant/promotions/:id/toggle - Toggle promotion active status
router.post("/promotions/:id/toggle", requireKYCCompletion, requirePromotionPermission, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const existing = await prisma.promotion.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Promotion not found" });
    }

    // Toggle between ACTIVE and PAUSED (preserve UPCOMING/EXPIRED status)
    let newStatus: any = existing.status;
    if (existing.status === "ACTIVE") {
      newStatus = "PAUSED";
    } else if (existing.status === "PAUSED") {
      newStatus = "ACTIVE";
    } else {
      return res.status(400).json({ error: `Cannot toggle promotion in ${existing.status} status` });
    }

    const promotion = await prisma.promotion.update({
      where: { id },
      data: {
        status: newStatus,
        updatedByOwnerId: restaurantProfile.id,
      },
    });

    // Audit log
    await logAuditEvent({
      entityType: EntityType.RESTAURANT,
      entityId: restaurantProfile.id,
      userId,
      action: ActionType.UPDATE,
      details: `Toggled promotion status: ${existing.title} (${existing.status} → ${newStatus})`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
    });

    res.json({ promotion });
  } catch (error: any) {
    console.error("Toggle promotion error:", error);
    res.status(500).json({ error: error.message || "Failed to toggle promotion" });
  }
});

// DELETE /api/restaurant/promotions/:id - Archive/soft delete promotion
router.delete("/promotions/:id", requireKYCCompletion, requirePromotionPermission, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const existing = await prisma.promotion.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Promotion not found" });
    }

    // Soft delete by marking as EXPIRED and inactive
    const promotion = await prisma.promotion.update({
      where: { id },
      data: {
        status: "EXPIRED",
        isActive: false,
        updatedByOwnerId: restaurantProfile.id,
      },
    });

    // Audit log
    await logAuditEvent({
      entityType: EntityType.RESTAURANT,
      entityId: restaurantProfile.id,
      userId,
      action: ActionType.DELETE,
      details: `Archived promotion: ${existing.title}`,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
    });

    res.json({ success: true, promotion });
  } catch (error: any) {
    console.error("Delete promotion error:", error);
    res.status(500).json({ error: error.message || "Failed to archive promotion" });
  }
});

// GET /api/restaurant/promotions/:id/usage - Get promotion usage stats
router.get("/promotions/:id/usage", requireKYCCompletion, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    const promotion = await prisma.promotion.findFirst({
      where: {
        id,
        restaurantId: restaurantProfile.id,
      },
      include: {
        promotionUsages: {
          orderBy: { usedAt: "desc" },
        },
        _count: {
          select: { promotionUsages: true },
        },
      },
    });

    if (!promotion) {
      return res.status(404).json({ error: "Promotion not found" });
    }

    // Calculate usage stats
    const totalRedemptions = promotion._count.promotionUsages;
    const totalDiscountAmount = promotion.promotionUsages.reduce(
      (sum, usage) => sum + Number(usage.discountAmount),
      0
    );

    const uniqueCustomers = new Set(promotion.promotionUsages.map((u) => u.customerId)).size;

    res.json({
      totalRedemptions,
      totalDiscountAmount,
      uniqueCustomers,
      usages: promotion.promotionUsages,
    });
  } catch (error: any) {
    console.error("Get promotion usage error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch promotion usage" });
  }
});

export default router;
