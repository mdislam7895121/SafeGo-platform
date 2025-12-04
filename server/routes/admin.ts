import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, loadAdminProfile, checkPermission } from "../middleware/auth";
import { authenticateToken, requireAdmin } from "../middleware/authz";
import { Permission } from "../utils/permissions";
import { z } from "zod";
import { encrypt, decrypt, isValidBdNid, isValidBdPhone, isValidSSN, maskSSN } from "../utils/encryption";
import { logAuditEvent, ActionType, EntityType, getClientIp } from "../utils/audit";
import { notifyKYCPending, notifyKYCApproved, notifyKYCRejected, notifyDriverStatusChanged, notifyRestaurantStatusChanged, notifyRestaurantCommissionChanged } from "../utils/notifications";
import { walletService } from "../services/walletService";
import { walletPayoutService } from "../services/payoutService";
import { commissionService } from "../services/commissionService";
import * as earningsService from "../services/earningsService";
import * as fraudDetectionService from "../services/fraudDetectionService";
import { scheduleAutomaticPayouts, runManualPayout } from "../services/payoutSchedulingService";
import { reconcileWalletTransactions } from "../services/reconciliationService";
import { driverVehicleService } from "../services/driverVehicleService";
import { format } from "date-fns";
import analyticsRouter, { getRBACFilter } from "./analytics";
import performanceRouter from "./performance";

const router = Router();

// All routes require authentication, admin role, and active admin status
router.use(authenticateToken);  // Step 1: Verify JWT token and set req.user
router.use(requireAdmin());      // Step 2: Verify user is admin
router.use(loadAdminProfile);    // Step 3: Load admin profile and capabilities

// ====================================================
// GET /api/admin/capabilities
// Returns the current admin user's permissions/capabilities
// ====================================================
router.get("/capabilities", async (req: AuthRequest, res) => {
  try {
    const { getAdminCapabilities } = await import('../utils/permissions');
    const capabilities = getAdminCapabilities(req.adminUser);
    
    res.json({ capabilities });
  } catch (error) {
    console.error("Error fetching admin capabilities:", error);
    res.status(500).json({ error: "Failed to fetch capabilities" });
  }
});

// ====================================================
// HELPER: Validate KYC Completeness
// Checks if driver has all required documents per country/state
// ====================================================
interface KYCValidationResult {
  isComplete: boolean;
  missingFields: string[];
}

function validateDriverKYC(
  driver: any,
  countryCode: string
): KYCValidationResult {
  const missing: string[] = [];

  // Get primary vehicle from vehicles array (safely handle empty/undefined arrays)
  const primaryVehicle = Array.isArray(driver.vehicles) && driver.vehicles.length > 0
    ? (driver.vehicles.find((v: any) => v.isPrimary) ?? driver.vehicles[0])
    : null;

  // Profile photo required for ALL drivers
  if (!driver.profilePhotoUrl) {
    missing.push("Profile photo");
  }

  // Bangladesh-specific requirements
  if (countryCode === "BD") {
    if (!driver.nidEncrypted && !driver.nidNumber) {
      missing.push("NID (National ID)");
    }
    // Check for vehicle registration document (new Vehicle field OR legacy vehicleDocuments)
    const hasNewVehicleReg = primaryVehicle?.registrationDocumentUrl;
    const hasLegacyVehicleReg = driver.vehicleDocuments?.some((doc: any) => doc.documentType === "registration");
    if (!hasNewVehicleReg && !hasLegacyVehicleReg) {
      missing.push("Vehicle registration document");
    }
  }

  // USA-specific requirements
  if (countryCode === "US") {
    // Name structure: firstName and lastName required
    if (!driver.firstName) {
      missing.push("First name");
    }
    if (!driver.lastName) {
      missing.push("Last name");
    }

    // DMV License required for ALL US drivers (front & back images + expiry)
    if (!driver.dmvLicenseFrontUrl) {
      missing.push("DMV license front image");
    }
    if (!driver.dmvLicenseBackUrl) {
      missing.push("DMV license back image");
    }
    if (!driver.dmvLicenseExpiry) {
      missing.push("DMV license expiry date");
    }

    // TLC License required ONLY for NY state drivers (front & back images + expiry)
    if (driver.usaState === "NY") {
      if (!driver.tlcLicenseFrontUrl) {
        missing.push("TLC license front image (required for NY drivers)");
      }
      if (!driver.tlcLicenseBackUrl) {
        missing.push("TLC license back image (required for NY drivers)");
      }
      if (!driver.tlcLicenseExpiry) {
        missing.push("TLC license expiry date (required for NY drivers)");
      }
    }

    // Check for vehicle registration document (new Vehicle field OR legacy vehicleDocuments)
    const hasNewVehicleReg = primaryVehicle?.registrationDocumentUrl;
    const hasLegacyVehicleReg = driver.vehicleDocuments?.some((doc: any) => doc.documentType === "registration");
    if (!hasNewVehicleReg && !hasLegacyVehicleReg) {
      missing.push("Vehicle registration document");
    }

    // Check for DMV Inspection (type, date, expiry, and document)
    if (!primaryVehicle?.dmvInspectionType) {
      missing.push("DMV inspection type");
    }
    if (!primaryVehicle?.dmvInspectionDate) {
      missing.push("DMV inspection date");
    }
    if (!primaryVehicle?.dmvInspectionExpiry) {
      missing.push("DMV inspection expiry date");
    }
    if (!primaryVehicle?.dmvInspectionImageUrl) {
      missing.push("DMV inspection document");
    }
    // Check DMV inspection status: only "VALID" is acceptable, all others fail
    // (null, undefined, "MISSING", "EXPIRED", or any unexpected value should be rejected)
    if (primaryVehicle?.dmvInspectionStatus !== 'VALID') {
      if (primaryVehicle?.dmvInspectionStatus === 'EXPIRED') {
        missing.push("DMV inspection has expired");
      } else if (primaryVehicle?.dmvInspectionStatus === 'MISSING') {
        missing.push("DMV inspection is missing");
      } else {
        // null, undefined, or unexpected values
        missing.push("DMV inspection status is not valid");
      }
    }
  }

  return {
    isComplete: missing.length === 0,
    missingFields: missing,
  };
}

// ====================================================
// GET /api/admin/stats
// Get platform statistics for admin dashboard
// ====================================================
router.get("/stats", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    // Count total users
    const totalUsers = await prisma.user.count();

    // Total drivers (all driver profiles)
    const totalDrivers = await prisma.driverProfile.count();

    // Count active drivers (distinct drivers with at least one online vehicle)
    // Using groupBy to get distinct driverIds where isOnline = true
    const activeDriversList = await prisma.vehicle.groupBy({
      by: ['driverId'],
      where: { isOnline: true },
    });
    const activeDrivers = activeDriversList.length;

    // Pending drivers (not yet approved)
    const pendingDrivers = await prisma.driverProfile.count({
      where: { verificationStatus: "pending" },
    });

    // Pending customers
    const pendingCustomers = await prisma.customerProfile.count({
      where: { verificationStatus: "pending" },
    });

    // Pending restaurants
    const pendingRestaurants = await prisma.restaurantProfile.count({
      where: { verificationStatus: "pending" },
    });

    // Suspended drivers - Note: field exists in schema but not in generated client yet
    // TODO: After Prisma regeneration, isSuspended will be available
    const suspendedDrivers = 0;

    // Blocked drivers (users with isBlocked = true and role = driver)
    const blockedDrivers = await prisma.user.count({
      where: {
        role: "driver",
        isBlocked: true,
      },
    });

    // Count total customers (users with role = customer)
    const totalCustomers = await prisma.user.count({
      where: { role: "customer" },
    });

    // Count total restaurants (users with role = restaurant)
    const restaurants = await prisma.user.count({
      where: { role: "restaurant" },
    });

    // Total complaints (open complaints - includes both driver and restaurant complaints)
    const openComplaints = await prisma.driverComplaint.count({
      where: { status: "open" },
    });

    res.json({
      totalUsers,
      totalDrivers,
      activeDrivers,
      pendingDrivers,
      pendingCustomers,
      pendingRestaurants,
      suspendedDrivers,
      blockedDrivers,
      totalCustomers,
      restaurants,
      openComplaints,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ error: "Failed to fetch admin stats" });
  }
});

// ====================================================
// GET /api/admin/pending-kyc
// List all users with pending verification
// ====================================================
router.get("/pending-kyc", checkPermission(Permission.MANAGE_KYC), async (req: AuthRequest, res) => {
  try {
    const { role } = req.query;

    // Get pending drivers
    let pendingDrivers = [];
    if (!role || role === "driver") {
      pendingDrivers = await prisma.driverProfile.findMany({
        where: { verificationStatus: "pending" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              countryCode: true,
              createdAt: true,
            },
          },
        },
      });
    }

    // Get pending customers
    let pendingCustomers = [];
    if (!role || role === "customer") {
      pendingCustomers = await prisma.customerProfile.findMany({
        where: { verificationStatus: "pending" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              countryCode: true,
              createdAt: true,
            },
          },
        },
      });
    }

    // Get pending restaurants
    let pendingRestaurants = [];
    if (!role || role === "restaurant") {
      pendingRestaurants = await prisma.restaurantProfile.findMany({
        where: { verificationStatus: "pending" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              countryCode: true,
              createdAt: true,
            },
          },
        },
      });
    }

    res.json({
      pending: {
        drivers: pendingDrivers.map((d: any) => ({
          userId: d.user.id,
          profileId: d.id,
          email: d.user.email,
          role: d.user.role,
          countryCode: d.user.countryCode,
          verificationStatus: d.verificationStatus,
          createdAt: d.user.createdAt,
        })),
        customers: pendingCustomers.map((c: any) => ({
          userId: c.user.id,
          profileId: c.id,
          email: c.user.email,
          role: c.user.role,
          countryCode: c.user.countryCode,
          verificationStatus: c.verificationStatus,
          createdAt: c.user.createdAt,
        })),
        restaurants: pendingRestaurants.map((r: any) => ({
          userId: r.user.id,
          profileId: r.id,
          email: r.user.email,
          restaurantName: r.restaurantName,
          role: r.user.role,
          countryCode: r.user.countryCode,
          verificationStatus: r.verificationStatus,
          createdAt: r.user.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Pending KYC error:", error);
    res.status(500).json({ error: "Failed to fetch pending KYC" });
  }
});

// ====================================================
// PATCH /api/admin/kyc/:userId
// Approve or reject KYC verification
// ====================================================
router.patch("/kyc/:userId", checkPermission(Permission.MANAGE_KYC), async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const { verificationStatus, rejectionReason } = req.body;

    if (!["approved", "rejected", "pending"].includes(verificationStatus)) {
      return res.status(400).json({ error: "Invalid verificationStatus. Must be: approved, rejected, or pending" });
    }

    if (verificationStatus === "rejected" && !rejectionReason) {
      return res.status(400).json({ error: "rejectionReason is required when rejecting KYC" });
    }

    // Get user to determine role
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check role-specific KYC permission
    const { requirePermission } = await import("../utils/permissions");
    const permissionMap = {
      driver: Permission.MANAGE_DRIVER_KYC,
      customer: Permission.MANAGE_CUSTOMER_KYC,
      restaurant: Permission.MANAGE_RESTAURANT_KYC,
    };
    
    const requiredPermission = permissionMap[user.role as keyof typeof permissionMap];
    if (!requiredPermission) {
      return res.status(400).json({ error: "Invalid user role for KYC processing" });
    }

    try {
      requirePermission(req.adminUser, requiredPermission);
    } catch (permError: any) {
      return res.status(permError.statusCode || 403).json({ error: permError.message || "Insufficient permissions" });
    }

    const isVerified = verificationStatus === "approved";

    // Update appropriate profile based on role
    let updatedProfile;
    if (user.role === "driver") {
      // For drivers: validate KYC completeness before approval
      if (verificationStatus === "approved") {
        const driverProfile = await prisma.driverProfile.findUnique({
          where: { userId },
          include: {
            vehicles: true,
            vehicleDocuments: true,
          },
        });
        
        if (!driverProfile) {
          return res.status(404).json({ error: "Driver profile not found" });
        }

        const validation = await validateDriverKYC(driverProfile, user.countryCode);
        if (!validation.isComplete) {
          return res.status(400).json({
            error: "Cannot approve KYC - missing required documents",
            missingFields: validation.missingFields,
            message: `Please ensure driver has uploaded: ${validation.missingFields.join(", ")}`,
          });
        }
      }

      updatedProfile = await prisma.driverProfile.update({
        where: { userId },
        data: {
          verificationStatus,
          isVerified,
          rejectionReason: verificationStatus === "rejected" ? rejectionReason : null,
        },
      });
    } else if (user.role === "customer") {
      updatedProfile = await prisma.customerProfile.update({
        where: { userId },
        data: {
          verificationStatus,
          isVerified,
          rejectionReason: verificationStatus === "rejected" ? rejectionReason : null,
        },
      });
    } else if (user.role === "restaurant") {
      updatedProfile = await prisma.restaurantProfile.update({
        where: { userId },
        data: {
          verificationStatus,
          isVerified,
          rejectionReason: verificationStatus === "rejected" ? rejectionReason : null,
        },
      });
    } else {
      return res.status(400).json({ error: "Admin users do not require KYC verification" });
    }

    // Create notification for user
    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        type: "verification",
        title: `KYC ${verificationStatus}`,
        body: verificationStatus === "approved"
          ? "Your KYC has been approved. You can now use SafeGo services."
          : `Your KYC has been rejected. Reason: ${rejectionReason}`,
      },
    });

    // Log audit event
    const actionType = verificationStatus === "approved"
      ? (user.role === "driver" ? ActionType.DRIVER_KYC_APPROVED :
         user.role === "customer" ? ActionType.CUSTOMER_KYC_APPROVED :
         ActionType.RESTAURANT_KYC_APPROVED)
      : (user.role === "driver" ? ActionType.DRIVER_KYC_REJECTED :
         user.role === "customer" ? ActionType.CUSTOMER_KYC_REJECTED :
         ActionType.RESTAURANT_KYC_REJECTED);

    await logAuditEvent({
      actorId: req.user?.userId,
      actorEmail: req.user?.email || "unknown",
      actorRole: "admin",
      ipAddress: getClientIp(req),
      actionType,
      entityType: user.role === "driver" ? EntityType.DRIVER :
                  user.role === "customer" ? EntityType.CUSTOMER :
                  EntityType.RESTAURANT,
      entityId: userId,
      description: `${verificationStatus === "approved" ? "Approved" : "Rejected"} KYC for ${user.role} ${user.email}${rejectionReason ? ` - Reason: ${rejectionReason}` : ""}`,
      metadata: {
        userId,
        userEmail: user.email,
        role: user.role,
        verificationStatus,
        ...(rejectionReason && { rejectionReason }),
      },
      success: true,
    });

    // Create admin notification
    if (verificationStatus === "approved") {
      await notifyKYCApproved({
        entityType: user.role as "driver" | "customer" | "restaurant",
        entityId: updatedProfile.id,
        countryCode: user.countryCode,
        email: user.email,
        actorId: req.user?.userId || "",
        actorEmail: req.user?.email || "unknown",
      });
    } else if (verificationStatus === "rejected") {
      await notifyKYCRejected({
        entityType: user.role as "driver" | "customer" | "restaurant",
        entityId: updatedProfile.id,
        countryCode: user.countryCode,
        email: user.email,
        actorId: req.user?.userId || "",
        actorEmail: req.user?.email || "unknown",
        reason: rejectionReason || "Not specified",
      });
    }

    res.json({
      message: `KYC ${verificationStatus} for user ${user.email}`,
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("KYC update error:", error);
    res.status(500).json({ error: "Failed to update KYC status" });
  }
});

// ====================================================
// GET /api/admin/kyc/pending
// Frontend-compatible endpoint for pending KYC requests
// ====================================================
router.get("/kyc/pending", checkPermission(Permission.MANAGE_KYC), async (req: AuthRequest, res) => {
  try {
    const { role } = req.query;

    // If no role specified, return empty array
    if (!role || typeof role !== "string") {
      return res.json([]);
    }

    let pendingUsers: any[] = [];

    if (role === "driver") {
      const profiles = await prisma.driverProfile.findMany({
        where: { verificationStatus: "pending" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              countryCode: true,
              createdAt: true,
            },
          },
        },
      });
      pendingUsers = profiles.map((p) => ({
        id: p.id, // profileId
        userId: p.user.id,
        email: p.user.email,
        role: p.user.role,
        countryCode: p.user.countryCode,
        verificationStatus: p.verificationStatus,
        dateOfBirth: p.dateOfBirth,
        nid: p.nidNumber,
        governmentId: p.governmentIdLast4,
        createdAt: p.user.createdAt,
      }));
    } else if (role === "customer") {
      const profiles = await prisma.customerProfile.findMany({
        where: { verificationStatus: "pending" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              countryCode: true,
              createdAt: true,
            },
          },
        },
      });
      pendingUsers = profiles.map((p) => ({
        id: p.id, // profileId
        userId: p.user.id,
        email: p.user.email,
        role: p.user.role,
        countryCode: p.user.countryCode,
        verificationStatus: p.verificationStatus,
        dateOfBirth: p.dateOfBirth,
        nid: p.nidNumber,
        governmentId: p.governmentIdLast4,
        createdAt: p.user.createdAt,
      }));
    } else if (role === "restaurant") {
      const profiles = await prisma.restaurantProfile.findMany({
        where: { verificationStatus: "pending" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              countryCode: true,
              createdAt: true,
            },
          },
        },
      });
      pendingUsers = profiles.map((p) => ({
        id: p.id, // profileId
        userId: p.user.id,
        email: p.user.email,
        role: p.user.role,
        countryCode: p.user.countryCode,
        restaurantName: p.restaurantName,
        verificationStatus: p.verificationStatus,
        createdAt: p.user.createdAt,
      }));
    } else if (role === "shop_partner") {
      const profiles = await prisma.shopPartner.findMany({
        where: { 
          verificationStatus: "pending",
          user: { countryCode: "BD" },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              countryCode: true,
              createdAt: true,
            },
          },
        },
      });
      pendingUsers = profiles.map((p) => ({
        id: p.id,
        userId: p.user.id,
        email: p.user.email,
        role: p.user.role,
        countryCode: p.user.countryCode,
        shopName: p.shopName,
        shopType: p.shopType,
        ownerName: p.ownerName || p.shopName,
        verificationStatus: p.verificationStatus,
        createdAt: p.user.createdAt,
      }));
    } else if (role === "ticket_operator") {
      const profiles = await prisma.ticketOperator.findMany({
        where: { 
          verificationStatus: "pending",
          user: { countryCode: "BD" },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              countryCode: true,
              createdAt: true,
            },
          },
        },
      });
      pendingUsers = profiles.map((p) => ({
        id: p.id,
        userId: p.user.id,
        email: p.user.email,
        role: p.user.role,
        countryCode: p.user.countryCode,
        operatorName: p.operatorName,
        operatorType: p.operatorType,
        ownerName: p.ownerName || p.operatorName,
        verificationStatus: p.verificationStatus,
        createdAt: p.user.createdAt,
      }));
    }

    res.json(pendingUsers);
  } catch (error) {
    console.error("KYC pending fetch error:", error);
    res.status(500).json({ error: "Failed to fetch pending KYC requests" });
  }
});

// ====================================================
// POST /api/admin/kyc/approve
// Frontend-compatible endpoint for approving KYC
// ====================================================
router.post("/kyc/approve", checkPermission(Permission.MANAGE_KYC), async (req: AuthRequest, res) => {
  try {
    const { role, profileId } = req.body;

    if (!role || !profileId) {
      return res.status(400).json({ error: "role and profileId are required" });
    }

    // Get the userId from the profile
    let userId: string | null = null;
    if (role === "driver") {
      const profile = await prisma.driverProfile.findUnique({ where: { id: profileId } });
      if (!profile) {
        return res.status(404).json({ error: "Driver profile not found" });
      }
      userId = profile.userId;

      // Update profile
      await prisma.driverProfile.update({
        where: { id: profileId },
        data: {
          verificationStatus: "approved",
          isVerified: true,
          rejectionReason: null,
        },
      });
    } else if (role === "customer") {
      const profile = await prisma.customerProfile.findUnique({ where: { id: profileId } });
      if (!profile) {
        return res.status(404).json({ error: "Customer profile not found" });
      }
      userId = profile.userId;

      // Update profile
      await prisma.customerProfile.update({
        where: { id: profileId },
        data: {
          verificationStatus: "approved",
          isVerified: true,
          rejectionReason: null,
        },
      });
    } else if (role === "restaurant") {
      const profile = await prisma.restaurantProfile.findUnique({ where: { id: profileId } });
      if (!profile) {
        return res.status(404).json({ error: "Restaurant profile not found" });
      }
      userId = profile.userId;

      // Update profile
      await prisma.restaurantProfile.update({
        where: { id: profileId },
        data: {
          verificationStatus: "approved",
          isVerified: true,
          rejectionReason: null,
        },
      });
    } else if (role === "shop_partner") {
      const profile = await prisma.shopPartner.findUnique({ where: { id: profileId } });
      if (!profile) {
        return res.status(404).json({ error: "Shop Partner profile not found" });
      }
      userId = profile.userId;

      // Update profile
      await prisma.shopPartner.update({
        where: { id: profileId },
        data: {
          verificationStatus: "approved",
          isActive: true,
        },
      });

      // Convert pending_shop_partner to shop_partner role
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user && user.role === "pending_shop_partner") {
        await prisma.user.update({
          where: { id: userId },
          data: { role: "shop_partner" },
        });
      }
    } else if (role === "ticket_operator") {
      const profile = await prisma.ticketOperator.findUnique({ where: { id: profileId } });
      if (!profile) {
        return res.status(404).json({ error: "Ticket Operator profile not found" });
      }
      userId = profile.userId;

      // Update profile
      await prisma.ticketOperator.update({
        where: { id: profileId },
        data: {
          verificationStatus: "approved",
          isActive: true,
        },
      });

      // Convert pending_ticket_operator to ticket_operator role
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user && user.role === "pending_ticket_operator") {
        await prisma.user.update({
          where: { id: userId },
          data: { role: "ticket_operator" },
        });
      }
    } else {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Create notification
    if (userId) {
      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          type: "verification",
          title: "KYC Approved",
          body: "Your KYC has been approved. You can now use SafeGo services.",
        },
      });
    }

    res.json({
      success: true,
      message: "KYC approved successfully",
      profileId,
    });
  } catch (error) {
    console.error("KYC approval error:", error);
    res.status(500).json({ error: "Failed to approve KYC" });
  }
});

// ====================================================
// POST /api/admin/kyc/reject
// Frontend-compatible endpoint for rejecting KYC
// ====================================================
router.post("/kyc/reject", checkPermission(Permission.MANAGE_KYC), async (req: AuthRequest, res) => {
  try {
    const { role, profileId, reason } = req.body;

    if (!role || !profileId || !reason) {
      return res.status(400).json({ error: "role, profileId, and reason are required" });
    }

    // Get the userId from the profile
    let userId: string | null = null;
    if (role === "driver") {
      const profile = await prisma.driverProfile.findUnique({ where: { id: profileId } });
      if (!profile) {
        return res.status(404).json({ error: "Driver profile not found" });
      }
      userId = profile.userId;

      // Update profile
      await prisma.driverProfile.update({
        where: { id: profileId },
        data: {
          verificationStatus: "rejected",
          isVerified: false,
          rejectionReason: reason,
        },
      });
    } else if (role === "customer") {
      const profile = await prisma.customerProfile.findUnique({ where: { id: profileId } });
      if (!profile) {
        return res.status(404).json({ error: "Customer profile not found" });
      }
      userId = profile.userId;

      // Update profile
      await prisma.customerProfile.update({
        where: { id: profileId },
        data: {
          verificationStatus: "rejected",
          isVerified: false,
          rejectionReason: reason,
        },
      });
    } else if (role === "restaurant") {
      const profile = await prisma.restaurantProfile.findUnique({ where: { id: profileId } });
      if (!profile) {
        return res.status(404).json({ error: "Restaurant profile not found" });
      }
      userId = profile.userId;

      // Update profile
      await prisma.restaurantProfile.update({
        where: { id: profileId },
        data: {
          verificationStatus: "rejected",
          isVerified: false,
          rejectionReason: reason,
        },
      });
    } else if (role === "shop_partner") {
      const profile = await prisma.shopPartner.findUnique({ where: { id: profileId } });
      if (!profile) {
        return res.status(404).json({ error: "Shop Partner profile not found" });
      }
      userId = profile.userId;

      // Update profile with rejection reason
      await prisma.shopPartner.update({
        where: { id: profileId },
        data: {
          verificationStatus: "rejected",
          isActive: false,
          rejectionReason: reason,
        },
      });

      // Keep user role as pending_shop_partner to allow re-onboarding
      // (role is not changed on rejection, user can resubmit onboarding)
    } else if (role === "ticket_operator") {
      const profile = await prisma.ticketOperator.findUnique({ where: { id: profileId } });
      if (!profile) {
        return res.status(404).json({ error: "Ticket Operator profile not found" });
      }
      userId = profile.userId;

      // Update profile with rejection reason
      await prisma.ticketOperator.update({
        where: { id: profileId },
        data: {
          verificationStatus: "rejected",
          isActive: false,
          rejectionReason: reason,
        },
      });

      // Keep user role as pending_ticket_operator to allow re-onboarding
      // (role is not changed on rejection, user can resubmit onboarding)
    } else {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Create notification
    if (userId) {
      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          type: "verification",
          title: "KYC Rejected",
          body: `Your KYC has been rejected. Reason: ${reason}`,
        },
      });
    }

    res.json({
      success: true,
      message: "KYC rejected successfully",
      profileId,
    });
  } catch (error) {
    console.error("KYC rejection error:", error);
    res.status(500).json({ error: "Failed to reject KYC" });
  }
});

// ====================================================
// PATCH /api/admin/block/:userId
// Block or unblock a user
// ====================================================
router.patch("/block/:userId", checkPermission(Permission.MANAGE_USER_STATUS), async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const { isBlocked } = req.body;

    if (typeof isBlocked !== "boolean") {
      return res.status(400).json({ error: "isBlocked must be a boolean" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent blocking admin users
    if (user.role === "admin") {
      return res.status(400).json({ error: "Cannot block admin users" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isBlocked },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        type: "admin",
        title: isBlocked ? "Account Blocked" : "Account Unblocked",
        body: isBlocked
          ? "Your account has been blocked. Please contact support for more information."
          : "Your account has been unblocked. You can now access SafeGo services.",
      },
    });

    // Log audit event
    const actionType = user.role === "driver" 
      ? (isBlocked ? ActionType.DRIVER_BLOCKED : ActionType.DRIVER_UNBLOCKED)
      : user.role === "customer"
      ? (isBlocked ? ActionType.CUSTOMER_BLOCKED : ActionType.CUSTOMER_UNBLOCKED)
      : ActionType.DRIVER_STATUS_CHANGE;

    await logAuditEvent({
      actorId: req.user?.userId,
      actorEmail: req.user?.email || "unknown",
      actorRole: "admin",
      ipAddress: getClientIp(req),
      actionType,
      entityType: user.role === "driver" ? EntityType.DRIVER : EntityType.CUSTOMER,
      entityId: userId,
      description: `${isBlocked ? "Blocked" : "Unblocked"} ${user.role} account for ${user.email}`,
      metadata: {
        userId,
        userEmail: user.email,
        role: user.role,
        isBlocked,
      },
      success: true,
    });

    // Create admin notification for driver status change
    if (user.role === "driver") {
      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
      });
      
      if (driverProfile) {
        await notifyDriverStatusChanged({
          driverId: driverProfile.id,
          countryCode: user.countryCode,
          email: user.email,
          action: isBlocked ? "blocked" : "unblocked",
          actorId: req.user?.userId || "",
          actorEmail: req.user?.email || "unknown",
        });
      }
    }

    res.json({
      message: `User ${isBlocked ? "blocked" : "unblocked"} successfully`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        isBlocked: updatedUser.isBlocked,
      },
    });
  } catch (error) {
    console.error("Block user error:", error);
    res.status(500).json({ error: "Failed to update user block status" });
  }
});

// ====================================================
// GET /api/admin/users
// List all users with optional role filter
// ====================================================
router.get("/users", checkPermission(Permission.VIEW_USER), async (req: AuthRequest, res) => {
  try {
    const { role } = req.query;

    const users = await prisma.user.findMany({
      where: role ? { role: role as string } : undefined,
      select: {
        id: true,
        email: true,
        role: true,
        countryCode: true,
        isBlocked: true,
        createdAt: true,
        driverProfile: {
          select: {
            verificationStatus: true,
            isVerified: true,
          },
        },
        customerProfile: {
          select: {
            verificationStatus: true,
            isVerified: true,
          },
        },
        restaurantProfile: {
          select: {
            restaurantName: true,
            verificationStatus: true,
            isVerified: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ users });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ====================================================
// POST /api/admin/settle-wallet
// Settle negative balance for driver or restaurant
// ====================================================
router.post("/settle-wallet", checkPermission(Permission.PROCESS_WALLET_SETTLEMENT), async (req: AuthRequest, res) => {
  try {
    const { walletType, walletId, settlementAmount } = req.body;

    if (!["driver", "restaurant"].includes(walletType)) {
      return res.status(400).json({ error: "walletType must be 'driver' or 'restaurant'" });
    }

    if (!walletId || !settlementAmount) {
      return res.status(400).json({ error: "walletId and settlementAmount are required" });
    }

    const amount = parseFloat(settlementAmount);
    if (amount <= 0) {
      return res.status(400).json({ error: "settlementAmount must be positive" });
    }

    if (walletType === "driver") {
      const wallet = await prisma.driverWallet.findUnique({ where: { id: walletId } });

      if (!wallet) {
        return res.status(404).json({ error: "Driver wallet not found" });
      }

      if (Number(wallet.negativeBalance) < amount) {
        return res.status(400).json({ error: "Settlement amount exceeds negative balance" });
      }

      // Settle the amount
      const updatedWallet = await prisma.driverWallet.update({
        where: { id: walletId },
        data: {
          negativeBalance: { decrement: amount },
        },
      });

      res.json({
        message: "Driver wallet settled successfully",
        wallet: {
          id: updatedWallet.id,
          balance: updatedWallet.balance,
          negativeBalance: updatedWallet.negativeBalance,
        },
      });
    } else {
      const wallet = await prisma.restaurantWallet.findUnique({ where: { id: walletId } });

      if (!wallet) {
        return res.status(404).json({ error: "Restaurant wallet not found" });
      }

      if (Number(wallet.negativeBalance) < amount) {
        return res.status(400).json({ error: "Settlement amount exceeds negative balance" });
      }

      // Settle the amount
      const updatedWallet = await prisma.restaurantWallet.update({
        where: { id: walletId },
        data: {
          negativeBalance: { decrement: amount },
        },
      });

      res.json({
        message: "Restaurant wallet settled successfully",
        wallet: {
          id: updatedWallet.id,
          balance: updatedWallet.balance,
          negativeBalance: updatedWallet.negativeBalance,
        },
      });
    }
  } catch (error) {
    console.error("Settle wallet error:", error);
    res.status(500).json({ error: "Failed to settle wallet" });
  }
});

// ====================================================
// GET /api/admin/settlement/overview
// Get overall settlement statistics
// ====================================================
router.get("/settlement/overview", checkPermission(Permission.VIEW_WALLET_SUMMARY), async (req: AuthRequest, res) => {
  try {
    // Get driver wallet stats
    const driverWallets = await prisma.driverWallet.findMany();
    const driverStats = {
      totalWallets: driverWallets.length,
      totalPendingSettlement: driverWallets.reduce((sum, w) => sum + Number(w.negativeBalance), 0),
      totalBalance: driverWallets.reduce((sum, w) => sum + Number(w.balance), 0),
      walletsNeedingSettlement: driverWallets.filter(w => Number(w.negativeBalance) > 0).length,
    };

    // Get restaurant wallet stats
    const restaurantWallets = await prisma.restaurantWallet.findMany();
    const restaurantStats = {
      totalWallets: restaurantWallets.length,
      totalPendingSettlement: restaurantWallets.reduce((sum, w) => sum + Number(w.negativeBalance), 0),
      totalBalance: restaurantWallets.reduce((sum, w) => sum + Number(w.balance), 0),
      walletsNeedingSettlement: restaurantWallets.filter(w => Number(w.negativeBalance) > 0).length,
    };

    // Get parcel commission stats (from deliveries)
    const completedDeliveries = await prisma.delivery.findMany({
      where: {
        status: "delivered",
      },
      select: {
        safegoCommission: true,
        driverId: true,
      },
    });

    const totalParcelCommission = completedDeliveries.reduce(
      (sum, d) => sum + Number(d.safegoCommission),
      0
    );

    // Approximate pending parcel commission using driver negative balances
    // Note: This is an approximation since drivers handle multiple service types
    const parcelDriverIds = [...new Set(completedDeliveries.map(d => d.driverId).filter(Boolean))];
    const parcelDriverWallets = parcelDriverIds.length > 0 
      ? await prisma.driverWallet.findMany({
          where: {
            driverId: {
              in: parcelDriverIds as string[],
            },
            negativeBalance: { gt: 0 },
          },
        })
      : [];

    const parcelPendingCommission = parcelDriverWallets.reduce(
      (sum, w) => sum + Number(w.negativeBalance),
      0
    );

    const parcelStats = {
      totalDeliveries: completedDeliveries.length,
      totalCommission: totalParcelCommission,
      pendingCommission: Math.min(parcelPendingCommission, totalParcelCommission),
      walletsNeedingSettlement: parcelDriverWallets.length,
    };

    // Calculate overall platform stats
    const totalPendingSettlement = driverStats.totalPendingSettlement + restaurantStats.totalPendingSettlement;
    const totalWalletsNeedingSettlement = driverStats.walletsNeedingSettlement + restaurantStats.walletsNeedingSettlement;

    res.json({
      driver: driverStats,
      restaurant: restaurantStats,
      parcel: parcelStats,
      overall: {
        totalPendingSettlement,
        totalWalletsNeedingSettlement,
        totalBalance: driverStats.totalBalance + restaurantStats.totalBalance,
      },
    });
  } catch (error) {
    console.error("Get settlement overview error:", error);
    res.status(500).json({ error: "Failed to fetch settlement overview" });
  }
});

// ====================================================
// GET /api/admin/settlement/pending
// Get all wallets with pending settlements
// ====================================================
router.get("/settlement/pending", checkPermission(Permission.VIEW_WALLET_SUMMARY), async (req: AuthRequest, res) => {
  try {
    const { walletType, page = "1", limit = "20" } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    let pendingDrivers: any[] = [];
    let pendingRestaurants: any[] = [];
    let driverCount = 0;
    let restaurantCount = 0;

    if (!walletType || walletType === "driver") {
      const wallets = await prisma.driverWallet.findMany({
        where: {
          negativeBalance: { gt: 0 },
        },
        include: {
          driver: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  countryCode: true,
                },
              },
            },
          },
        },
        skip: !walletType ? skip : 0,
        take: !walletType ? limitNum : undefined,
        orderBy: { negativeBalance: "desc" },
      });

      driverCount = await prisma.driverWallet.count({
        where: { negativeBalance: { gt: 0 } },
      });

      pendingDrivers = wallets.map((w) => ({
        walletId: w.id,
        walletType: "driver",
        driverId: w.driverId,
        email: w.driver.user.email,
        countryCode: w.driver.user.countryCode,
        fullName: w.driver.fullName || `${w.driver.firstName || ""} ${w.driver.lastName || ""}`.trim() || "N/A",
        balance: Number(w.balance),
        negativeBalance: Number(w.negativeBalance),
        lastUpdated: w.updatedAt,
      }));
    }

    if (!walletType || walletType === "restaurant") {
      const wallets = await prisma.restaurantWallet.findMany({
        where: {
          negativeBalance: { gt: 0 },
        },
        include: {
          restaurant: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  countryCode: true,
                },
              },
            },
          },
        },
        skip: !walletType ? 0 : skip,
        take: !walletType ? undefined : limitNum,
        orderBy: { negativeBalance: "desc" },
      });

      restaurantCount = await prisma.restaurantWallet.count({
        where: { negativeBalance: { gt: 0 } },
      });

      pendingRestaurants = wallets.map((w) => ({
        walletId: w.id,
        walletType: "restaurant",
        restaurantId: w.restaurantId,
        email: w.restaurant.user.email,
        countryCode: w.restaurant.user.countryCode,
        restaurantName: w.restaurant.restaurantName,
        address: w.restaurant.address,
        balance: Number(w.balance),
        negativeBalance: Number(w.negativeBalance),
        lastUpdated: w.updatedAt,
      }));
    }

    const allPending = [...pendingDrivers, ...pendingRestaurants];

    res.json({
      pending: allPending,
      pagination: {
        total: driverCount + restaurantCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil((driverCount + restaurantCount) / limitNum),
      },
      counts: {
        drivers: driverCount,
        restaurants: restaurantCount,
      },
    });
  } catch (error) {
    console.error("Get pending settlements error:", error);
    res.status(500).json({ error: "Failed to fetch pending settlements" });
  }
});

// ====================================================
// GET /api/admin/settlement/transaction-history/:type/:id
// Get detailed transaction history for a wallet
// ====================================================
router.get("/settlement/transaction-history/:type/:id", checkPermission(Permission.VIEW_WALLET_SUMMARY), async (req: AuthRequest, res) => {
  try {
    const { type, id } = req.params;

    if (!["driver", "restaurant"].includes(type)) {
      return res.status(400).json({ error: "Type must be 'driver' or 'restaurant'" });
    }

    if (type === "driver") {
      // Get driver wallet
      const wallet = await prisma.driverWallet.findUnique({
        where: { id },
        include: {
          driver: {
            include: {
              user: {
                select: {
                  email: true,
                  countryCode: true,
                },
              },
            },
          },
        },
      });

      if (!wallet) {
        return res.status(404).json({ error: "Driver wallet not found" });
      }

      // Get all rides for this driver
      const rides = await prisma.ride.findMany({
        where: { driverId: wallet.driverId },
        orderBy: { completedAt: "desc" },
        take: 100,
      });

      // Get all deliveries for this driver
      const deliveries = await prisma.delivery.findMany({
        where: { driverId: wallet.driverId },
        orderBy: { deliveredAt: "desc" },
        take: 100,
      });

      // Get all food orders for this driver
      const foodOrders = await prisma.foodOrder.findMany({
        where: { driverId: wallet.driverId },
        orderBy: { deliveredAt: "desc" },
        take: 100,
      });

      // Calculate totals
      const rideStats = {
        count: rides.length,
        totalFare: rides.reduce((sum, r) => sum + Number(r.serviceFare), 0),
        totalCommission: rides.reduce((sum, r) => sum + Number(r.safegoCommission), 0),
        totalPayout: rides.reduce((sum, r) => sum + Number(r.driverPayout), 0),
        cashRides: rides.filter((r) => r.paymentMethod === "cash").length,
        onlineRides: rides.filter((r) => r.paymentMethod === "online").length,
      };

      const deliveryStats = {
        count: deliveries.length,
        totalFare: deliveries.reduce((sum, d) => sum + Number(d.serviceFare), 0),
        totalCommission: deliveries.reduce((sum, d) => sum + Number(d.safegoCommission), 0),
        totalPayout: deliveries.reduce((sum, d) => sum + Number(d.driverPayout), 0),
        cashDeliveries: deliveries.filter((d) => d.paymentMethod === "cash").length,
        onlineDeliveries: deliveries.filter((d) => d.paymentMethod === "online").length,
      };

      const foodOrderStats = {
        count: foodOrders.length,
        totalFare: foodOrders.reduce((sum, f) => sum + Number(f.serviceFare), 0),
        totalCommission: foodOrders.reduce((sum, f) => sum + Number(f.safegoCommission), 0),
        totalPayout: foodOrders.reduce((sum, f) => sum + Number(f.driverPayout), 0),
        cashOrders: foodOrders.filter((f) => f.paymentMethod === "cash").length,
        onlineOrders: foodOrders.filter((f) => f.paymentMethod === "online").length,
      };

      res.json({
        walletInfo: {
          id: wallet.id,
          driverId: wallet.driverId,
          email: wallet.driver.user.email,
          countryCode: wallet.driver.user.countryCode,
          fullName: wallet.driver.fullName || `${wallet.driver.firstName || ""} ${wallet.driver.lastName || ""}`.trim() || "N/A",
          balance: Number(wallet.balance),
          negativeBalance: Number(wallet.negativeBalance),
        },
        summary: {
          totalServices: rideStats.count + deliveryStats.count + foodOrderStats.count,
          totalEarnings: rideStats.totalFare + deliveryStats.totalFare + foodOrderStats.totalFare,
          totalCommission: rideStats.totalCommission + deliveryStats.totalCommission + foodOrderStats.totalCommission,
          totalPayout: rideStats.totalPayout + deliveryStats.totalPayout + foodOrderStats.totalPayout,
        },
        breakdown: {
          rides: rideStats,
          deliveries: deliveryStats,
          foodOrders: foodOrderStats,
        },
        recentTransactions: [
          ...rides.slice(0, 10).map((r) => ({
            type: "ride",
            id: r.id,
            date: r.completedAt || r.createdAt,
            status: r.status,
            paymentMethod: r.paymentMethod,
            fare: Number(r.serviceFare),
            commission: Number(r.safegoCommission),
            payout: Number(r.driverPayout),
          })),
          ...deliveries.slice(0, 10).map((d) => ({
            type: "delivery",
            id: d.id,
            date: d.deliveredAt || d.createdAt,
            status: d.status,
            paymentMethod: d.paymentMethod,
            fare: Number(d.serviceFare),
            commission: Number(d.safegoCommission),
            payout: Number(d.driverPayout),
          })),
          ...foodOrders.slice(0, 10).map((f) => ({
            type: "foodOrder",
            id: f.id,
            date: f.deliveredAt || f.createdAt,
            status: f.status,
            paymentMethod: f.paymentMethod,
            fare: Number(f.serviceFare),
            commission: Number(f.safegoCommission),
            payout: Number(f.driverPayout),
          })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20),
      });
    } else {
      // Restaurant wallet
      const wallet = await prisma.restaurantWallet.findUnique({
        where: { id },
        include: {
          restaurant: {
            include: {
              user: {
                select: {
                  email: true,
                  countryCode: true,
                },
              },
            },
          },
        },
      });

      if (!wallet) {
        return res.status(404).json({ error: "Restaurant wallet not found" });
      }

      // Get all food orders for this restaurant
      const foodOrders = await prisma.foodOrder.findMany({
        where: { restaurantId: wallet.restaurantId },
        orderBy: { deliveredAt: "desc" },
        take: 100,
      });

      const foodOrderStats = {
        count: foodOrders.length,
        totalFare: foodOrders.reduce((sum, f) => sum + Number(f.serviceFare), 0),
        totalCommission: foodOrders.reduce((sum, f) => sum + Number(f.safegoCommission), 0),
        totalPayout: foodOrders.reduce((sum, f) => sum + Number(f.restaurantPayout), 0),
        cashOrders: foodOrders.filter((f) => f.paymentMethod === "cash").length,
        onlineOrders: foodOrders.filter((f) => f.paymentMethod === "online").length,
      };

      res.json({
        walletInfo: {
          id: wallet.id,
          restaurantId: wallet.restaurantId,
          email: wallet.restaurant.user.email,
          countryCode: wallet.restaurant.user.countryCode,
          restaurantName: wallet.restaurant.restaurantName,
          address: wallet.restaurant.address,
          balance: Number(wallet.balance),
          negativeBalance: Number(wallet.negativeBalance),
        },
        summary: {
          totalServices: foodOrderStats.count,
          totalEarnings: foodOrderStats.totalFare,
          totalCommission: foodOrderStats.totalCommission,
          totalPayout: foodOrderStats.totalPayout,
        },
        breakdown: {
          foodOrders: foodOrderStats,
        },
        recentTransactions: foodOrders.slice(0, 20).map((f) => ({
          type: "foodOrder",
          id: f.id,
          date: f.deliveredAt || f.createdAt,
          status: f.status,
          paymentMethod: f.paymentMethod,
          fare: Number(f.serviceFare),
          commission: Number(f.safegoCommission),
          payout: Number(f.restaurantPayout),
        })),
      });
    }
  } catch (error) {
    console.error("Get transaction history error:", error);
    res.status(500).json({ error: "Failed to fetch transaction history" });
  }
});

// ====================================================
// DRIVER MANAGEMENT ENDPOINTS
// ====================================================

// ====================================================
// GET /api/admin/drivers
// List all drivers with search, filters, and pagination
// ====================================================
router.get("/drivers", checkPermission(Permission.VIEW_USER), async (req: AuthRequest, res) => {
  try {
    const {
      search,
      country,
      state,
      verificationStatus,
      isSuspended,
      isOnline,
      status,
      page = "1",
      limit = "20",
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    const userFilters: any = {};

    // Search by email
    if (search) {
      userFilters.email = { contains: search as string, mode: "insensitive" };
    }

    // Filter by country
    if (country) {
      userFilters.countryCode = country as string;
    }

    // Filter by US state (only when country is US)
    if (state && state !== "all" && country === "US") {
      where.usaState = state as string;
    }

    // Filter by verification status
    if (verificationStatus) {
      where.verificationStatus = verificationStatus as string;
    }

    // Filter by suspension status
    if (isSuspended !== undefined) {
      where.isSuspended = isSuspended === "true";
    }

    // Filter by status (active, suspended, blocked)
    if (status === "suspended") {
      where.isSuspended = true;
    } else if (status === "blocked") {
      userFilters.isBlocked = true;
    } else if (status === "active") {
      userFilters.isBlocked = false;
      where.isSuspended = false;
      where.isVerified = true;
    }

    // Apply user filters if any exist
    if (Object.keys(userFilters).length > 0) {
      where.user = userFilters;
    }

    // Filter by online status (requires vehicle check)
    let onlineFilter: any = undefined;
    if (isOnline !== undefined) {
      onlineFilter = { isOnline: isOnline === "true" };
    } else if (status === "active") {
      onlineFilter = { isOnline: true };
    }

    // Fetch drivers with full details
    const [drivers, total] = await Promise.all([
      prisma.driverProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              countryCode: true,
              isBlocked: true,
              createdAt: true,
            },
          },
          vehicles: onlineFilter ? { where: onlineFilter } : true,
          driverStats: true,
          driverWallet: true,
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
      }),
      prisma.driverProfile.count({ where }),
    ]);

    // Get driver IDs for commission aggregation
    const driverIds = drivers.map((d) => d.id);

    // Aggregate commissions efficiently for all drivers in this page
    const [rideCommissions, parcelCommissions, foodCommissions] = await Promise.all([
      prisma.ride.groupBy({
        by: ["driverId"],
        where: {
          driverId: { in: driverIds },
          status: "completed",
        },
        _sum: {
          safegoCommission: true,
        },
      }),
      prisma.delivery.groupBy({
        by: ["driverId"],
        where: {
          driverId: { in: driverIds },
          status: "delivered",
        },
        _sum: {
          safegoCommission: true,
        },
      }),
      prisma.foodOrder.groupBy({
        by: ["driverId"],
        where: {
          driverId: { in: driverIds },
          status: "delivered",
        },
        _sum: {
          safegoCommission: true,
        },
      }),
    ]);

    // Build commission lookup map
    const commissionMap = new Map<string, number>();
    driverIds.forEach((id) => {
      const ride = rideCommissions.find((r) => r.driverId === id)?._sum.safegoCommission || 0;
      const parcel = parcelCommissions.find((p) => p.driverId === id)?._sum.safegoCommission || 0;
      const food = foodCommissions.find((f) => f.driverId === id)?._sum.safegoCommission || 0;
      const total = Number(ride) + Number(parcel) + Number(food);
      commissionMap.set(id, total);
    });

    // Format response with commission data
    const formattedDrivers = drivers.map((driver) => {
      // Get primary/active vehicle from the vehicles array
      const primaryVehicle = driver.vehicles?.find((v: any) => v.isPrimary) || driver.vehicles?.[0];
      return {
        id: driver.id,
        userId: driver.user.id,
        email: driver.user.email,
        countryCode: driver.user.countryCode,
        verificationStatus: driver.verificationStatus,
        isVerified: driver.isVerified,
        isSuspended: driver.isSuspended,
        suspensionReason: driver.suspensionReason,
        isBlocked: driver.user.isBlocked,
        isOnline: primaryVehicle?.isOnline || false,
        totalTrips: driver.driverStats?.totalTrips || 0,
        totalEarnings: primaryVehicle?.totalEarnings ? Number(primaryVehicle.totalEarnings) : 0,
        averageRating: driver.driverStats?.rating ? Number(driver.driverStats.rating) : 0,
        walletBalance: driver.driverWallet?.balance ? Number(driver.driverWallet.balance) : 0,
        negativeBalance: driver.driverWallet?.negativeBalance ? Number(driver.driverWallet.negativeBalance) : 0,
        commissionPaid: Number(commissionMap.get(driver.id) || 0).toFixed(2),
        vehicleType: primaryVehicle?.vehicleType,
        vehicleMake: primaryVehicle?.make,
        vehicleModel: primaryVehicle?.model || primaryVehicle?.vehicleModel,
        vehicleColor: primaryVehicle?.color,
        vehiclePlate: primaryVehicle?.licensePlate || primaryVehicle?.vehiclePlate,
        createdAt: driver.user.createdAt,
      };
    });

    res.json({
      drivers: formattedDrivers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("List drivers error:", error);
    res.status(500).json({ error: "Failed to fetch drivers" });
  }
});

// ====================================================
// GET /api/admin/drivers/pending
// List drivers with pending verification
// ====================================================
router.get("/drivers/pending", checkPermission(Permission.VIEW_USER), async (req: AuthRequest, res) => {
  try {
    const pendingDrivers = await prisma.driverProfile.findMany({
      where: { verificationStatus: "pending" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" }, // FIFO order
    });

    const formatted = pendingDrivers.map((driver) => ({
      id: driver.id,
      userId: driver.user.id,
      email: driver.user.email,
      countryCode: driver.user.countryCode,
      verificationStatus: driver.verificationStatus,
      dateOfBirth: driver.dateOfBirth,
      nidNumber: driver.nidNumber,
      governmentIdLast4: driver.governmentIdLast4,
      createdAt: driver.user.createdAt,
    }));

    res.json({ drivers: formatted });
  } catch (error) {
    console.error("Pending drivers error:", error);
    res.status(500).json({ error: "Failed to fetch pending drivers" });
  }
});

// ====================================================
// GET /api/admin/drivers/:id
// Get detailed driver information
// ====================================================
router.get("/drivers/:id", checkPermission(Permission.VIEW_USER), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const driver = await prisma.driverProfile.findUnique({
      where: { id },
      include: {
        user: true,
        vehicles: true,
        driverStats: true,
        driverWallet: true,
      },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    res.json({
      driver: {
        id: driver.id,
        userId: driver.user.id,
        email: driver.user.email,
        countryCode: driver.user.countryCode,
        isBlocked: driver.user.isBlocked,
        user: {
          id: driver.user.id,
          email: driver.user.email,
          countryCode: driver.user.countryCode,
          isBlocked: driver.user.isBlocked,
        },
        verificationStatus: driver.verificationStatus,
        isVerified: driver.isVerified,
        rejectionReason: driver.rejectionReason,
        isSuspended: driver.isSuspended,
        suspensionReason: driver.suspensionReason,
        suspendedAt: driver.suspendedAt,
        dateOfBirth: driver.dateOfBirth,
        emergencyContactName: driver.emergencyContactName,
        emergencyContactPhone: driver.emergencyContactPhone,
        // Bangladesh fields (NEW - exclude nidEncrypted for security)
        fullName: driver.fullName,
        fatherName: driver.fatherName,
        phoneNumber: driver.phoneNumber,
        village: driver.village,
        postOffice: driver.postOffice,
        thana: driver.thana,
        district: driver.district,
        presentAddress: driver.presentAddress,
        permanentAddress: driver.permanentAddress,
        nidNumber: driver.nidNumber, // Legacy field
        // nidEncrypted: EXCLUDED - only accessible via dedicated endpoint
        nidFrontImageUrl: driver.nidFrontImageUrl,
        nidBackImageUrl: driver.nidBackImageUrl,
        // Profile photo (all drivers)
        profilePhotoUrl: driver.profilePhotoUrl,
        // US fields
        usaFullLegalName: driver.usaFullLegalName,
        firstName: driver.firstName,
        middleName: driver.middleName,
        lastName: driver.lastName,
        usaPhoneNumber: driver.usaPhoneNumber,
        driverLicenseNumber: driver.driverLicenseNumber,
        licenseStateIssued: driver.licenseStateIssued,
        driverLicenseExpiry: driver.driverLicenseExpiry,
        driverLicenseImageUrl: driver.driverLicenseImageUrl,
        usaStreet: driver.usaStreet,
        usaCity: driver.usaCity,
        usaState: driver.usaState,
        usaZipCode: driver.usaZipCode,
        // DMV License (all USA drivers)
        dmvLicenseFrontUrl: driver.dmvLicenseFrontUrl,
        dmvLicenseBackUrl: driver.dmvLicenseBackUrl,
        dmvLicenseExpiry: driver.dmvLicenseExpiry,
        dmvLicenseNumber: driver.dmvLicenseNumber,
        // TLC License (NY drivers only)
        tlcLicenseFrontUrl: driver.tlcLicenseFrontUrl,
        tlcLicenseBackUrl: driver.tlcLicenseBackUrl,
        tlcLicenseExpiry: driver.tlcLicenseExpiry,
        tlcLicenseNumber: driver.tlcLicenseNumber,
        backgroundCheckStatus: driver.backgroundCheckStatus,
        backgroundCheckDate: driver.backgroundCheckDate,
        // Legacy US fields (deprecated but kept for backward compatibility)
        homeAddress: driver.homeAddress,
        governmentIdType: driver.governmentIdType,
        governmentIdLast4: driver.governmentIdLast4,
        ssnLast4: driver.ssnLast4,
        // Vehicle info (primary vehicle from vehicles array)
        vehicle: (() => {
          const primaryVehicle = driver.vehicles?.find((v: any) => v.isPrimary) || driver.vehicles?.[0];
          return primaryVehicle
            ? {
                id: primaryVehicle.id,
                vehicleType: primaryVehicle.vehicleType,
                vehicleModel: primaryVehicle.vehicleModel,
                vehiclePlate: primaryVehicle.vehiclePlate,
                make: primaryVehicle.make,
                model: primaryVehicle.model,
                year: primaryVehicle.year,
                color: primaryVehicle.color,
                licensePlate: primaryVehicle.licensePlate,
                registrationDocumentUrl: primaryVehicle.registrationDocumentUrl,
                registrationExpiry: primaryVehicle.registrationExpiry,
                insuranceDocumentUrl: primaryVehicle.insuranceDocumentUrl,
                insuranceExpiry: primaryVehicle.insuranceExpiry,
                dmvInspectionType: primaryVehicle.dmvInspectionType,
                dmvInspectionDate: primaryVehicle.dmvInspectionDate,
                dmvInspectionExpiry: primaryVehicle.dmvInspectionExpiry,
                dmvInspectionImageUrl: primaryVehicle.dmvInspectionImageUrl,
                dmvInspectionStatus: primaryVehicle.dmvInspectionStatus,
                isOnline: primaryVehicle.isOnline,
                totalEarnings: Number(primaryVehicle.totalEarnings),
              }
            : null;
        })(),
        // All vehicles array
        vehicles: driver.vehicles?.map((v: any) => ({
          id: v.id,
          vehicleType: v.vehicleType,
          vehicleModel: v.vehicleModel,
          make: v.make,
          model: v.model,
          year: v.year,
          color: v.color,
          licensePlate: v.licensePlate,
          isPrimary: v.isPrimary,
          isActive: v.isActive,
        })) || [],
        // Stats
        totalTrips: driver.driverStats?.totalTrips || 0,
        totalEarnings: (() => {
          const primaryVehicle = driver.vehicles?.find((v: any) => v.isPrimary) || driver.vehicles?.[0];
          return primaryVehicle?.totalEarnings ? Number(primaryVehicle.totalEarnings) : 0;
        })(),
        averageRating: driver.driverStats?.rating ? Number(driver.driverStats.rating) : 0,
        // Wallet
        walletBalance: driver.driverWallet?.balance ? Number(driver.driverWallet.balance) : 0,
        negativeBalance: driver.driverWallet?.negativeBalance ? Number(driver.driverWallet.negativeBalance) : 0,
        createdAt: driver.user.createdAt,
        updatedAt: driver.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get driver details error:", error);
    res.status(500).json({ error: "Failed to fetch driver details" });
  }
});

// ====================================================
// PATCH /api/admin/drivers/:id/profile
// Update driver Bangladesh profile fields (admin only)
// ====================================================
const updateDriverProfileSchema = z.object({
  fullName: z.string().min(1).optional(),
  fatherName: z.string().min(1).optional(),
  phoneNumber: z.string().refine((val) => !val || isValidBdPhone(val), {
    message: "Invalid Bangladesh phone number format (must be 01XXXXXXXXX)",
  }).optional(),
  village: z.string().min(1).optional(),
  postOffice: z.string().min(1).optional(),
  postalCode: z.string().min(1, "Postal Code is required").regex(/^[0-9]{4,6}$/, {
    message: "Postal Code must be 4-6 digits",
  }),
  thana: z.string().min(1).optional(),
  district: z.string().min(1).optional(),
  presentAddress: z.string().min(1).optional(),
  permanentAddress: z.string().min(1).optional(),
  nid: z.string().refine((val) => !val || isValidBdNid(val), {
    message: "Invalid Bangladesh NID format (must be 10-17 digits)",
  }).optional(),
});

router.patch("/drivers/:id/profile", checkPermission(Permission.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const validation = updateDriverProfileSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }

    const data = validation.data;

    // Check if driver exists
    const driver = await prisma.driverProfile.findUnique({ where: { id } });
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Prepare update data
    const updateData: any = {};
    
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.fatherName !== undefined) updateData.fatherName = data.fatherName;
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;
    if (data.village !== undefined) updateData.village = data.village;
    if (data.postOffice !== undefined) updateData.postOffice = data.postOffice;
    if (data.postalCode !== undefined) updateData.postalCode = data.postalCode;
    if (data.thana !== undefined) updateData.thana = data.thana;
    if (data.district !== undefined) updateData.district = data.district;
    if (data.presentAddress !== undefined) updateData.presentAddress = data.presentAddress;
    if (data.permanentAddress !== undefined) updateData.permanentAddress = data.permanentAddress;
    
    // Encrypt NID if provided
    if (data.nid !== undefined && data.nid) {
      updateData.nidEncrypted = encrypt(data.nid);
      // Also update legacy nidNumber field for backward compatibility
      updateData.nidNumber = data.nid;
    }

    // Update driver profile
    const updatedDriver = await prisma.driverProfile.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
            createdAt: true,
          },
        },
        vehicles: true,
        driverStats: true,
        driverWallet: true,
      },
    });

    // Return updated profile (exclude nidEncrypted)
    const { nidEncrypted, ...driverProfile } = updatedDriver as any;
    const primaryVehicle = driverProfile.vehicles?.find((v: any) => v.isPrimary) || driverProfile.vehicles?.[0];
    
    res.json({
      message: "Driver profile updated successfully",
      driver: {
        ...driverProfile,
        // Format vehicle totalEarnings as number (primary vehicle)
        vehicle: primaryVehicle ? {
          ...primaryVehicle,
          totalEarnings: Number(primaryVehicle.totalEarnings),
        } : null,
        // Add computed fields
        totalTrips: driverProfile.driverStats?.totalTrips || 0,
        totalEarnings: primaryVehicle?.totalEarnings ? Number(primaryVehicle.totalEarnings) : 0,
        averageRating: driverProfile.driverStats?.rating ? Number(driverProfile.driverStats.rating) : 0,
        walletBalance: driverProfile.driverWallet?.balance ? Number(driverProfile.driverWallet.balance) : 0,
        negativeBalance: driverProfile.driverWallet?.negativeBalance ? Number(driverProfile.driverWallet.negativeBalance) : 0,
      },
    });
  } catch (error) {
    console.error("Update driver profile error:", error);
    res.status(500).json({ error: "Failed to update driver profile" });
  }
});

// ====================================================
// PATCH /api/admin/drivers/:id/usa-profile
// Update driver USA profile fields (admin only)
// ====================================================
const updateUsaDriverProfileSchema = z.object({
  usaFullLegalName: z.string().min(1).max(200).optional(),
  firstName: z.string().min(1).max(100).optional(),
  middleName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  dateOfBirth: z.string().optional(), // ISO date string
  ssn: z.string().refine((val) => !val || isValidSSN(val), {
    message: "Invalid SSN format (must be XXX-XX-XXXX or XXXXXXXXX)",
  }).optional(),
  driverLicenseNumber: z.string().min(1).max(50).optional(),
  licenseStateIssued: z.string().length(2).optional(), // Two-letter state code
  driverLicenseExpiry: z.string().optional(), // ISO date string
  usaPhoneNumber: z.string().min(10).max(15).optional(),
  usaStreet: z.string().min(1).max(200).optional(),
  usaCity: z.string().min(1).max(100).optional(),
  usaState: z.string().length(2).optional(), // Two-letter state code
  usaZipCode: z.string().min(5).max(10).optional(),
  emergencyContactName: z.string().min(1).max(200).optional(),
  emergencyContactPhone: z.string().min(10).max(15).optional(),
  emergencyContactRelationship: z.string().min(1).max(100).optional(),
  backgroundCheckStatus: z.enum(["pending", "cleared", "failed"]).optional(),
  profilePhotoUrl: z.string().url().optional(),
  // DMV License fields (required for all USA drivers)
  dmvLicenseFrontUrl: z.string().url().optional(),
  dmvLicenseBackUrl: z.string().url().optional(),
  dmvLicenseExpiry: z.string().optional(), // ISO date string
  dmvLicenseNumber: z.string().min(1).max(50).optional(),
  // TLC License fields (required for NY state only)
  tlcLicenseFrontUrl: z.string().url().optional(),
  tlcLicenseBackUrl: z.string().url().optional(),
  tlcLicenseExpiry: z.string().optional(), // ISO date string
  tlcLicenseNumber: z.string().min(1).max(50).optional(),
});

router.patch("/drivers/:id/usa-profile", checkPermission(Permission.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const validation = updateUsaDriverProfileSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }

    const data = validation.data;

    // Check if driver exists
    const driver = await prisma.driverProfile.findUnique({ 
      where: { id },
      include: {
        user: {
          select: {
            countryCode: true
          }
        }
      }
    });
    
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Prepare update data
    const updateData: any = {};
    
    if (data.usaFullLegalName !== undefined) updateData.usaFullLegalName = data.usaFullLegalName;
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.middleName !== undefined) updateData.middleName = data.middleName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(data.dateOfBirth);
    if (data.driverLicenseNumber !== undefined) updateData.driverLicenseNumber = data.driverLicenseNumber;
    if (data.licenseStateIssued !== undefined) updateData.licenseStateIssued = data.licenseStateIssued;
    if (data.driverLicenseExpiry !== undefined) updateData.driverLicenseExpiry = new Date(data.driverLicenseExpiry);
    if (data.usaPhoneNumber !== undefined) updateData.usaPhoneNumber = data.usaPhoneNumber;
    if (data.usaStreet !== undefined) updateData.usaStreet = data.usaStreet;
    if (data.usaCity !== undefined) updateData.usaCity = data.usaCity;
    if (data.usaState !== undefined) updateData.usaState = data.usaState;
    if (data.usaZipCode !== undefined) updateData.usaZipCode = data.usaZipCode;
    if (data.emergencyContactName !== undefined) updateData.emergencyContactName = data.emergencyContactName;
    if (data.emergencyContactPhone !== undefined) updateData.emergencyContactPhone = data.emergencyContactPhone;
    if (data.emergencyContactRelationship !== undefined) updateData.emergencyContactRelationship = data.emergencyContactRelationship;
    if (data.profilePhotoUrl !== undefined) updateData.profilePhotoUrl = data.profilePhotoUrl;
    if (data.backgroundCheckStatus !== undefined) {
      updateData.backgroundCheckStatus = data.backgroundCheckStatus;
      if (data.backgroundCheckStatus !== "pending") {
        updateData.backgroundCheckDate = new Date();
      }
    }
    
    // DMV License fields
    if (data.dmvLicenseFrontUrl !== undefined) updateData.dmvLicenseFrontUrl = data.dmvLicenseFrontUrl;
    if (data.dmvLicenseBackUrl !== undefined) updateData.dmvLicenseBackUrl = data.dmvLicenseBackUrl;
    if (data.dmvLicenseExpiry !== undefined) updateData.dmvLicenseExpiry = new Date(data.dmvLicenseExpiry);
    if (data.dmvLicenseNumber !== undefined) updateData.dmvLicenseNumber = data.dmvLicenseNumber;
    
    // TLC License fields (NY only)
    if (data.tlcLicenseFrontUrl !== undefined) updateData.tlcLicenseFrontUrl = data.tlcLicenseFrontUrl;
    if (data.tlcLicenseBackUrl !== undefined) updateData.tlcLicenseBackUrl = data.tlcLicenseBackUrl;
    if (data.tlcLicenseExpiry !== undefined) updateData.tlcLicenseExpiry = new Date(data.tlcLicenseExpiry);
    if (data.tlcLicenseNumber !== undefined) updateData.tlcLicenseNumber = data.tlcLicenseNumber;
    
    // Encrypt SSN if provided
    if (data.ssn !== undefined && data.ssn) {
      // Remove dashes for storage
      const cleanedSSN = data.ssn.replace(/-/g, "");
      updateData.ssnEncrypted = encrypt(cleanedSSN);
      // Store last 4 for display purposes
      updateData.ssnLast4 = cleanedSSN.substring(5, 9);
    }

    // Update driver profile
    const updatedDriver = await prisma.driverProfile.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
            createdAt: true,
          },
        },
        vehicles: true,
        driverStats: true,
        driverWallet: true,
      },
    });

    // Return updated profile (exclude ssnEncrypted)
    const { ssnEncrypted, ...driverProfile } = updatedDriver as any;
    const primaryVehicle = driverProfile.vehicles?.find((v: any) => v.isPrimary) || driverProfile.vehicles?.[0];
    
    res.json({
      message: "USA driver profile updated successfully",
      driver: {
        ...driverProfile,
        vehicle: primaryVehicle ? {
          ...primaryVehicle,
          totalEarnings: Number(primaryVehicle.totalEarnings),
        } : null,
        totalTrips: driverProfile.driverStats?.totalTrips || 0,
        totalEarnings: primaryVehicle?.totalEarnings ? Number(primaryVehicle.totalEarnings) : 0,
        averageRating: driverProfile.driverStats?.rating ? Number(driverProfile.driverStats.rating) : 0,
        walletBalance: driverProfile.driverWallet?.balance ? Number(driverProfile.driverWallet.balance) : 0,
        negativeBalance: driverProfile.driverWallet?.negativeBalance ? Number(driverProfile.driverWallet.negativeBalance) : 0,
      },
    });
  } catch (error) {
    console.error("Update USA driver profile error:", error);
    res.status(500).json({ error: "Failed to update USA driver profile" });
  }
});

// ====================================================
// PATCH /api/admin/drivers/:id/vehicle
// Update driver vehicle information (admin only, USA drivers)
// ====================================================
const updateVehicleSchema = z.object({
  vehicleType: z.string().min(1).max(50).optional(),
  make: z.string().min(1).max(100).optional(),
  model: z.string().min(1).max(100).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  color: z.string().min(1).max(50).optional(),
  licensePlate: z.string().min(1).max(20).optional(),
  registrationDocumentUrl: z.string().url().optional(),
  registrationExpiry: z.string().optional(), // ISO date string
  insuranceDocumentUrl: z.string().url().optional(),
  insuranceExpiry: z.string().optional(), // ISO date string
  dmvInspectionType: z.string().min(1).max(100).optional(),
  dmvInspectionDate: z.string().optional(), // ISO date string
  dmvInspectionExpiry: z.string().optional(), // ISO date string
  dmvInspectionImageUrl: z.string().url().optional(),
});

router.patch("/drivers/:id/vehicle", checkPermission(Permission.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const validation = updateVehicleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Invalid vehicle data", 
        details: validation.error.errors 
      });
    }

    const data = validation.data;

    // Check if driver exists and is USA driver
    const driver = await prisma.driverProfile.findUnique({
      where: { id },
      include: {
        user: { select: { countryCode: true } },
        vehicles: true,
      },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    if (driver.user.countryCode !== "US") {
      return res.status(400).json({ error: "Vehicle updates only available for USA drivers" });
    }

    // Get primary vehicle from vehicles array
    const primaryVehicle = driver.vehicles?.find((v: any) => v.isPrimary) || driver.vehicles?.[0];

    // Prepare update data
    const updateData: any = {};
    if (data.vehicleType) updateData.vehicleType = data.vehicleType;
    if (data.make) updateData.make = data.make;
    if (data.model) {
      updateData.model = data.model;
      updateData.vehicleModel = data.model; // Keep legacy field in sync
    }
    if (data.year) updateData.year = data.year;
    if (data.color) updateData.color = data.color;
    if (data.licensePlate) {
      updateData.licensePlate = data.licensePlate;
      updateData.vehiclePlate = data.licensePlate; // Keep legacy field in sync
    }
    if (data.registrationDocumentUrl) updateData.registrationDocumentUrl = data.registrationDocumentUrl;
    if (data.registrationExpiry) updateData.registrationExpiry = new Date(data.registrationExpiry);
    if (data.insuranceDocumentUrl) updateData.insuranceDocumentUrl = data.insuranceDocumentUrl;
    if (data.insuranceExpiry) updateData.insuranceExpiry = new Date(data.insuranceExpiry);
    
    // DMV Inspection fields
    if (data.dmvInspectionType !== undefined) updateData.dmvInspectionType = data.dmvInspectionType;
    if (data.dmvInspectionDate) updateData.dmvInspectionDate = new Date(data.dmvInspectionDate);
    if (data.dmvInspectionExpiry) updateData.dmvInspectionExpiry = new Date(data.dmvInspectionExpiry);
    if (data.dmvInspectionImageUrl !== undefined) updateData.dmvInspectionImageUrl = data.dmvInspectionImageUrl;
    
    // Compute DMV Inspection status
    if (data.dmvInspectionImageUrl || data.dmvInspectionExpiry) {
      if (!data.dmvInspectionImageUrl && !primaryVehicle?.dmvInspectionImageUrl) {
        updateData.dmvInspectionStatus = 'MISSING';
      } else if (!data.dmvInspectionExpiry && !primaryVehicle?.dmvInspectionExpiry) {
        updateData.dmvInspectionStatus = 'MISSING';
      } else {
        const expiryDate = data.dmvInspectionExpiry 
          ? new Date(data.dmvInspectionExpiry) 
          : primaryVehicle?.dmvInspectionExpiry;
        
        if (expiryDate && expiryDate < new Date()) {
          updateData.dmvInspectionStatus = 'EXPIRED';
        } else {
          updateData.dmvInspectionStatus = 'VALID';
        }
      }
    }

    // Update or create vehicle
    let vehicle;
    if (primaryVehicle) {
      // Update existing vehicle
      vehicle = await prisma.vehicle.update({
        where: { id: primaryVehicle.id },
        data: updateData,
      });
    } else {
      // Create new vehicle
      vehicle = await prisma.vehicle.create({
        data: {
          id: `vehicle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          driverId: driver.id,
          vehicleType: data.vehicleType || "sedan",
          vehicleModel: data.model || "",
          vehiclePlate: data.licensePlate || "",
          isPrimary: true,
          ...updateData,
        },
      });
    }

    res.json({
      message: "Vehicle information updated successfully",
      vehicle: {
        ...vehicle,
        totalEarnings: Number(vehicle.totalEarnings),
      },
    });
  } catch (error) {
    console.error("Update vehicle error:", error);
    res.status(500).json({ error: "Failed to update vehicle information" });
  }
});

// ====================================================
// VEHICLE CATEGORY MANAGEMENT (Admin Approval System)
// ====================================================

// GET /api/admin/vehicles/pending-categories
// List all vehicles with pending category approval
router.get("/vehicles/pending-categories", checkPermission(Permission.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { page = "1", limit = "20", categoryType } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      vehicleCategoryStatus: "pending",
      vehicleCategory: { not: null },
    };

    if (categoryType) {
      where.vehicleCategory = categoryType as string;
    }

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        include: {
          driver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              kycStatus: true,
              tlcLicenseNumber: true,
              tlcLicenseExpiry: true,
              dmvLicenseNumber: true,
              dmvLicenseExpiry: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.vehicle.count({ where }),
    ]);

    const formattedVehicles = vehicles.map((v) => ({
      vehicleId: v.id,
      driverId: v.driverId,
      driverName: `${v.driver.firstName || ""} ${v.driver.lastName || ""}`.trim() || "Unknown",
      driverEmail: v.driver.email,
      driverPhone: v.driver.phone,
      driverKycStatus: v.driver.kycStatus,
      vehicleCategory: v.vehicleCategory,
      vehicleCategoryStatus: v.vehicleCategoryStatus,
      vehicleType: v.vehicleType,
      make: v.make,
      model: v.vehicleModel,
      year: v.vehicleYear,
      color: v.color,
      licensePlate: v.licensePlate,
      wheelchairAccessible: v.wheelchairAccessible,
      tlcLicenseNumber: v.tlcLicenseNumber,
      tlcLicenseExpiry: v.tlcLicenseExpiry,
      registrationExpiry: v.registrationExpiry,
      insuranceExpiry: v.insuranceExpiry,
      driverTlcLicenseNumber: v.driver.tlcLicenseNumber,
      driverTlcLicenseExpiry: v.driver.tlcLicenseExpiry,
      driverDmvLicenseNumber: v.driver.dmvLicenseNumber,
      driverDmvLicenseExpiry: v.driver.dmvLicenseExpiry,
      updatedAt: v.updatedAt,
    }));

    res.json({
      vehicles: formattedVehicles,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get pending vehicle categories error:", error);
    res.status(500).json({ error: "Failed to fetch pending vehicle categories" });
  }
});

// PATCH /api/admin/vehicles/:vehicleId/category/approve
// Approve a vehicle's category assignment
router.patch("/vehicles/:vehicleId/category/approve", checkPermission(Permission.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { vehicleId } = req.params;
    const { notes } = req.body;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            userId: true,
          },
        },
      },
    });

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    if (!vehicle.vehicleCategory) {
      return res.status(400).json({ error: "Vehicle has no category to approve" });
    }

    if (vehicle.vehicleCategoryStatus === "approved") {
      return res.status(400).json({ error: "Vehicle category is already approved" });
    }

    const updatedVehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        vehicleCategoryStatus: "approved",
        categoryApprovalNotes: notes || null,
        categoryApprovedAt: new Date(),
        categoryApprovedBy: req.user?.id,
      },
    });

    await logAuditEvent({
      adminId: req.adminUser?.id,
      actionType: ActionType.UPDATE,
      entityType: EntityType.VEHICLE,
      entityId: vehicleId,
      oldValue: JSON.stringify({ vehicleCategoryStatus: vehicle.vehicleCategoryStatus }),
      newValue: JSON.stringify({ vehicleCategoryStatus: "approved", notes }),
      ipAddress: getClientIp(req),
    });

    res.json({
      message: "Vehicle category approved successfully",
      vehicle: {
        id: updatedVehicle.id,
        vehicleCategory: updatedVehicle.vehicleCategory,
        vehicleCategoryStatus: updatedVehicle.vehicleCategoryStatus,
        categoryApprovedAt: updatedVehicle.categoryApprovedAt,
      },
    });
  } catch (error) {
    console.error("Approve vehicle category error:", error);
    res.status(500).json({ error: "Failed to approve vehicle category" });
  }
});

// PATCH /api/admin/vehicles/:vehicleId/category/reject
// Reject a vehicle's category assignment
router.patch("/vehicles/:vehicleId/category/reject", checkPermission(Permission.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { vehicleId } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== "string") {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            userId: true,
          },
        },
      },
    });

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    if (!vehicle.vehicleCategory) {
      return res.status(400).json({ error: "Vehicle has no category to reject" });
    }

    const updatedVehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        vehicleCategoryStatus: "rejected",
        categoryApprovalNotes: reason,
        categoryRejectedAt: new Date(),
        categoryRejectedBy: req.user?.id,
      },
    });

    await logAuditEvent({
      adminId: req.adminUser?.id,
      actionType: ActionType.UPDATE,
      entityType: EntityType.VEHICLE,
      entityId: vehicleId,
      oldValue: JSON.stringify({ vehicleCategoryStatus: vehicle.vehicleCategoryStatus }),
      newValue: JSON.stringify({ vehicleCategoryStatus: "rejected", reason }),
      ipAddress: getClientIp(req),
    });

    res.json({
      message: "Vehicle category rejected",
      vehicle: {
        id: updatedVehicle.id,
        vehicleCategory: updatedVehicle.vehicleCategory,
        vehicleCategoryStatus: updatedVehicle.vehicleCategoryStatus,
        categoryApprovalNotes: updatedVehicle.categoryApprovalNotes,
      },
    });
  } catch (error) {
    console.error("Reject vehicle category error:", error);
    res.status(500).json({ error: "Failed to reject vehicle category" });
  }
});

// GET /api/admin/vehicles/:vehicleId/category-history
// Get category approval history for a vehicle
router.get("/vehicles/:vehicleId/category-history", checkPermission(Permission.VIEW_USER), async (req: AuthRequest, res) => {
  try {
    const { vehicleId } = req.params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        vehicleCategory: true,
        vehicleCategoryStatus: true,
        categoryApprovalNotes: true,
        categoryApprovedAt: true,
        categoryApprovedBy: true,
        categoryRejectedAt: true,
        categoryRejectedBy: true,
        wheelchairAccessible: true,
        createdAt: true,
        updatedAt: true,
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    res.json({
      vehicleId: vehicle.id,
      currentCategory: vehicle.vehicleCategory,
      currentStatus: vehicle.vehicleCategoryStatus,
      approvalNotes: vehicle.categoryApprovalNotes,
      approvedAt: vehicle.categoryApprovedAt,
      approvedBy: vehicle.categoryApprovedBy,
      rejectedAt: vehicle.categoryRejectedAt,
      rejectedBy: vehicle.categoryRejectedBy,
      wheelchairAccessible: vehicle.wheelchairAccessible,
      driver: vehicle.driver,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    });
  } catch (error) {
    console.error("Get vehicle category history error:", error);
    res.status(500).json({ error: "Failed to fetch vehicle category history" });
  }
});

// PATCH /api/admin/vehicles/:vehicleId/category-approval
// Unified endpoint to approve/reject vehicle category with optional category assignment
router.patch("/vehicles/:vehicleId/category-approval", checkPermission(Permission.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { vehicleId } = req.params;
    const { approved, vehicleCategory, rejectionReason } = req.body;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            userId: true,
          },
        },
      },
    });

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    const oldCategory = vehicle.vehicleCategory;
    const oldStatus = vehicle.vehicleVerificationStatus;

    if (approved) {
      // Validate category for approval
      const validCategories = [
        "SAFEGO_X", "SAFEGO_COMFORT", "SAFEGO_COMFORT_XL", "SAFEGO_XL", 
        "SAFEGO_BLACK", "SAFEGO_BLACK_SUV", "SAFEGO_WAV",
        // Legacy support
        "X", "COMFORT", "COMFORT_XL", "XL", "BLACK", "BLACK_SUV", "WAV"
      ];
      if (!vehicleCategory || !validCategories.includes(vehicleCategory)) {
        return res.status(400).json({ 
          error: "Invalid category. Must be one of: SAFEGO_X, SAFEGO_COMFORT, SAFEGO_COMFORT_XL, SAFEGO_XL, SAFEGO_BLACK, SAFEGO_BLACK_SUV, SAFEGO_WAV" 
        });
      }

      const updatedVehicle = await prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          vehicleCategory: vehicleCategory,
          vehicleCategoryStatus: "approved",
          vehicleVerificationStatus: "APPROVED",
          categoryApprovalNotes: `Admin approved: ${vehicleCategory}`,
          categoryApprovedAt: new Date(),
          categoryApprovedBy: req.user?.id,
        },
      });

      await logAuditEvent({
        adminId: req.adminUser?.id,
        actionType: ActionType.UPDATE,
        entityType: EntityType.VEHICLE,
        entityId: vehicleId,
        oldValue: JSON.stringify({ vehicleCategory: oldCategory, vehicleVerificationStatus: oldStatus }),
        newValue: JSON.stringify({ vehicleCategory, vehicleVerificationStatus: "APPROVED" }),
        ipAddress: getClientIp(req),
      });

      return res.json({
        message: "Vehicle category approved successfully",
        vehicle: {
          id: updatedVehicle.id,
          vehicleCategory: updatedVehicle.vehicleCategory,
          vehicleCategoryStatus: updatedVehicle.vehicleCategoryStatus,
          vehicleVerificationStatus: updatedVehicle.vehicleVerificationStatus,
          categoryApprovedAt: updatedVehicle.categoryApprovedAt,
        },
      });
    } else {
      // Rejection/Request Changes
      const updatedVehicle = await prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          vehicleCategoryStatus: "rejected",
          vehicleVerificationStatus: "REQUEST_CHANGES",
          categoryRejectionReason: rejectionReason || "Changes requested",
          categoryRejectedAt: new Date(),
          categoryRejectedBy: req.user?.id,
        },
      });

      await logAuditEvent({
        adminId: req.adminUser?.id,
        actionType: ActionType.UPDATE,
        entityType: EntityType.VEHICLE,
        entityId: vehicleId,
        oldValue: JSON.stringify({ vehicleVerificationStatus: oldStatus }),
        newValue: JSON.stringify({ vehicleVerificationStatus: "REQUEST_CHANGES", reason: rejectionReason }),
        ipAddress: getClientIp(req),
      });

      return res.json({
        message: "Vehicle category changes requested",
        vehicle: {
          id: updatedVehicle.id,
          vehicleCategoryStatus: updatedVehicle.vehicleCategoryStatus,
          vehicleVerificationStatus: updatedVehicle.vehicleVerificationStatus,
        },
      });
    }
  } catch (error) {
    console.error("Vehicle category approval error:", error);
    res.status(500).json({ error: "Failed to update vehicle category" });
  }
});

// PATCH /api/admin/vehicles/:vehicleId/category/override
// Admin override to set a vehicle's category directly
router.patch("/vehicles/:vehicleId/category/override", checkPermission(Permission.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { vehicleId } = req.params;
    const { category, notes } = req.body;

    const validCategories = ["X", "COMFORT", "COMFORT_XL", "XL", "BLACK", "BLACK_SUV", "WAV"];
    if (!category || !validCategories.includes(category)) {
      return res.status(400).json({ 
        error: "Invalid category. Must be one of: " + validCategories.join(", ") 
      });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    const oldCategory = vehicle.vehicleCategory;
    const oldStatus = vehicle.vehicleCategoryStatus;

    const updatedVehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        vehicleCategory: category,
        vehicleCategoryStatus: "approved",
        categoryApprovalNotes: notes || `Admin override: ${oldCategory || 'none'} -> ${category}`,
        categoryApprovedAt: new Date(),
        categoryApprovedBy: req.user?.id,
      },
    });

    await logAuditEvent({
      adminId: req.adminUser?.id,
      actionType: ActionType.UPDATE,
      entityType: EntityType.VEHICLE,
      entityId: vehicleId,
      oldValue: JSON.stringify({ vehicleCategory: oldCategory, vehicleCategoryStatus: oldStatus }),
      newValue: JSON.stringify({ vehicleCategory: category, vehicleCategoryStatus: "approved", notes }),
      ipAddress: getClientIp(req),
    });

    res.json({
      message: "Vehicle category overridden successfully",
      vehicle: {
        id: updatedVehicle.id,
        vehicleCategory: updatedVehicle.vehicleCategory,
        vehicleCategoryStatus: updatedVehicle.vehicleCategoryStatus,
        previousCategory: oldCategory,
      },
    });
  } catch (error) {
    console.error("Override vehicle category error:", error);
    res.status(500).json({ error: "Failed to override vehicle category" });
  }
});

// PATCH /api/admin/vehicles/:vehicleId/reset-preferences
// Admin reset driver's category preferences to default (all eligible categories)
router.patch("/vehicles/:vehicleId/reset-preferences", checkPermission(Permission.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { vehicleId } = req.params;

    const result = await driverVehicleService.adminResetCategoryPreferences(
      vehicleId,
      req.user?.userId || req.adminUser?.id || "admin"
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    await logAuditEvent({
      adminId: req.adminUser?.id,
      actionType: ActionType.UPDATE,
      entityType: EntityType.VEHICLE,
      entityId: vehicleId,
      oldValue: "custom_preferences",
      newValue: JSON.stringify({ allowedCategories: result.data?.allowedCategories }),
      ipAddress: getClientIp(req),
    });

    res.json({
      success: true,
      message: "Driver category preferences reset to default",
      data: result.data,
    });
  } catch (error) {
    console.error("Reset category preferences error:", error);
    res.status(500).json({ error: "Failed to reset category preferences" });
  }
});

// ====================================================
// GET /api/admin/drivers/:id/ssn
// Decrypt and return masked SSN (admin only)
// ====================================================
router.get("/drivers/:id/ssn", checkPermission(Permission.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const driver = await prisma.driverProfile.findUnique({
      where: { id },
      select: {
        id: true,
        ssnEncrypted: true,
        ssnLast4: true, // Legacy fallback
      },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Try encrypted SSN first, fallback to legacy ssnLast4
    let maskedSSN = "";
    if (driver.ssnEncrypted) {
      const decryptedSSN = decrypt(driver.ssnEncrypted);
      maskedSSN = maskSSN(decryptedSSN);
    } else if (driver.ssnLast4) {
      maskedSSN = `###-##-${driver.ssnLast4}`; // Legacy format
    } else {
      return res.status(404).json({ error: "SSN not found for this driver" });
    }

    res.json({ maskedSSN });
  } catch (error) {
    console.error("Fetch driver SSN error:", error);
    res.status(500).json({ error: "Failed to fetch driver SSN" });
  }
});

// ====================================================
// GET /api/admin/drivers/:id/trips
// Get driver trip history with filters
// ====================================================
router.get("/drivers/:id/trips", checkPermission(Permission.VIEW_USER), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status, startDate, endDate, page = "1", limit = "20" } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = { driverId: id };

    if (status) {
      where.status = status as string;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    const [trips, total] = await Promise.all([
      prisma.ride.findMany({
        where,
        include: {
          customer: {
            include: {
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
      }),
      prisma.ride.count({ where }),
    ]);

    const formattedTrips = trips.map((trip) => ({
      id: trip.id,
      customerEmail: trip.customer.user.email,
      pickupAddress: trip.pickupAddress,
      dropoffAddress: trip.dropoffAddress,
      serviceFare: trip.serviceFare,
      driverPayout: trip.driverPayout,
      paymentMethod: trip.paymentMethod,
      status: trip.status,
      customerRating: trip.customerRating,
      createdAt: trip.createdAt,
      completedAt: trip.completedAt,
    }));

    res.json({
      trips: formattedTrips,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get driver trips error:", error);
    res.status(500).json({ error: "Failed to fetch driver trips" });
  }
});

// ====================================================
// PATCH /api/admin/drivers/:id/suspend
// Suspend a driver (temporary)
// ====================================================
router.patch("/drivers/:id/suspend", checkPermission(Permission.MANAGE_USER_STATUS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== "string") {
      return res.status(400).json({ error: "Suspension reason is required" });
    }

    const driver = await prisma.driverProfile.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    if (driver.isSuspended) {
      return res.status(400).json({ error: "Driver is already suspended" });
    }

    // Update driver profile
    const updated = await prisma.driverProfile.update({
      where: { id },
      data: {
        isSuspended: true,
        suspensionReason: reason,
        suspendedAt: new Date(),
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId: driver.userId,
        type: "admin",
        title: "Account Suspended",
        body: `Your driver account has been temporarily suspended. Reason: ${reason}`,
      },
    });

    // Create admin notification
    await notifyDriverStatusChanged({
      driverId: driver.id,
      countryCode: driver.user.countryCode,
      email: driver.user.email,
      action: "suspended",
      actorId: req.user?.userId || "",
      actorEmail: req.user?.email || "unknown",
    });

    res.json({
      message: "Driver suspended successfully",
      driver: {
        id: updated.id,
        isSuspended: updated.isSuspended,
        suspensionReason: updated.suspensionReason,
        suspendedAt: updated.suspendedAt,
      },
    });
  } catch (error) {
    console.error("Suspend driver error:", error);
    res.status(500).json({ error: "Failed to suspend driver" });
  }
});

// ====================================================
// PATCH /api/admin/drivers/:id/unsuspend
// Unsuspend a driver
// ====================================================
router.patch("/drivers/:id/unsuspend", checkPermission(Permission.MANAGE_USER_STATUS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const driver = await prisma.driverProfile.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    if (!driver.isSuspended) {
      return res.status(400).json({ error: "Driver is not suspended" });
    }

    // Update driver profile
    const updated = await prisma.driverProfile.update({
      where: { id },
      data: {
        isSuspended: false,
        suspensionReason: null,
        suspendedAt: null,
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId: driver.userId,
        type: "admin",
        title: "Account Unsuspended",
        body: "Your driver account suspension has been lifted. You can now accept ride requests.",
      },
    });

    // Create admin notification
    await notifyDriverStatusChanged({
      driverId: driver.id,
      countryCode: driver.user.countryCode,
      email: driver.user.email,
      action: "unsuspended",
      actorId: req.user?.userId || "",
      actorEmail: req.user?.email || "unknown",
    });

    res.json({
      message: "Driver unsuspended successfully",
      driver: {
        id: updated.id,
        isSuspended: updated.isSuspended,
      },
    });
  } catch (error) {
    console.error("Unsuspend driver error:", error);
    res.status(500).json({ error: "Failed to unsuspend driver" });
  }
});

// ====================================================
// DELETE /api/admin/drivers/:id
// Delete a driver (only if no active trips/wallet issues)
// ====================================================
router.delete("/drivers/:id", checkPermission(Permission.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const driver = await prisma.driverProfile.findUnique({
      where: { id },
      include: {
        user: true,
        driverWallet: true,
      },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Check for active trips
    const activeTrips = await prisma.ride.count({
      where: {
        driverId: id,
        status: {
          in: ["accepted", "driver_arriving", "in_progress"],
        },
      },
    });

    if (activeTrips > 0) {
      return res.status(400).json({
        error: "Cannot delete driver with active trips. Please wait for trips to complete.",
      });
    }

    // Check for negative balance
    if (driver.driverWallet && Number(driver.driverWallet.negativeBalance) > 0) {
      return res.status(400).json({
        error: "Cannot delete driver with unresolved negative balance. Settle wallet first.",
      });
    }

    // Delete driver (cascade will handle related records)
    await prisma.user.delete({
      where: { id: driver.userId },
    });

    res.json({
      message: "Driver deleted successfully",
      driverId: id,
    });
  } catch (error) {
    console.error("Delete driver error:", error);
    res.status(500).json({ error: "Failed to delete driver" });
  }
});

// ====================================================
// RESTAURANT MANAGEMENT ENDPOINTS
// ====================================================

// ====================================================
// GET /api/admin/restaurants
// List all restaurants with filters
// ====================================================
router.get("/restaurants", checkPermission(Permission.VIEW_USER), async (req: AuthRequest, res) => {
  try {
    const { search, status } = req.query;

    // Build where clause
    const where: any = {};
    const userFilters: any = {};

    // Search by email
    if (search) {
      userFilters.email = {
        contains: search as string,
        mode: "insensitive",
      };
    }

    // Filter by status (active/suspended/blocked)
    if (status === "active") {
      where.isSuspended = false;
      userFilters.isBlocked = false;
    } else if (status === "suspended") {
      where.isSuspended = true;
    } else if (status === "blocked") {
      userFilters.isBlocked = true;
    }

    // Combine filters
    if (Object.keys(userFilters).length > 0) {
      where.user = userFilters;
    }

    const restaurants = await prisma.restaurantProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
          },
        },
        restaurantWallet: {
          select: {
            balance: true,
            negativeBalance: true,
          },
        },
        foodOrders: {
          where: {
            status: "delivered",
          },
          select: {
            id: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedRestaurants = restaurants.map((restaurant) => ({
      id: restaurant.id,
      userId: restaurant.user.id,
      email: restaurant.user.email,
      restaurantName: restaurant.restaurantName,
      address: restaurant.address,
      country: restaurant.user.countryCode,
      verificationStatus: restaurant.verificationStatus,
      isVerified: restaurant.isVerified,
      rejectionReason: restaurant.rejectionReason,
      isSuspended: restaurant.isSuspended,
      suspensionReason: restaurant.suspensionReason,
      suspendedAt: restaurant.suspendedAt,
      isBlocked: restaurant.user.isBlocked,
      balance: restaurant.restaurantWallet?.balance || 0,
      negativeBalance: restaurant.restaurantWallet?.negativeBalance || 0,
      totalOrders: restaurant.foodOrders.length,
      createdAt: restaurant.createdAt,
    }));

    res.json(formattedRestaurants);
  } catch (error) {
    console.error("List restaurants error:", error);
    res.status(500).json({ error: "Failed to fetch restaurants" });
  }
});

// ====================================================
// GET /api/admin/restaurants/:id
// Get restaurant details
// ====================================================
router.get("/restaurants/:id", checkPermission(Permission.VIEW_USER), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
            createdAt: true,
          },
        },
        restaurantWallet: true,
        branding: true,
        foodOrders: {
          select: {
            id: true,
            status: true,
            serviceFare: true,
            safegoCommission: true,
            restaurantPayout: true,
            createdAt: true,
            deliveredAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            reviewText: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        menuItems: {
          select: {
            id: true,
            hasVariants: true,
            hasAddOns: true,
            availabilityStatus: true,
          },
        },
      },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Calculate stats
    const completedOrders = restaurant.foodOrders.filter(
      (order) => order.status === "delivered"
    );
    const totalRevenue = completedOrders.reduce(
      (sum, order) => sum + Number(order.restaurantPayout),
      0
    );
    const totalCommission = completedOrders.reduce(
      (sum, order) => sum + Number(order.safegoCommission),
      0
    );

    // Step 44: Calculate menu stats for admin oversight
    const menuItems = restaurant.menuItems || [];
    const menuStats = {
      totalItems: menuItems.length,
      availableItems: menuItems.filter(i => i.availabilityStatus === "available").length,
      unavailableItems: menuItems.filter(i => i.availabilityStatus === "unavailable").length,
      outOfStockItems: menuItems.filter(i => i.availabilityStatus === "out_of_stock").length,
      itemsWithVariants: menuItems.filter(i => i.hasVariants).length,
      itemsWithAddOns: menuItems.filter(i => i.hasAddOns).length,
    };

    const formattedRestaurant = {
      id: restaurant.id,
      userId: restaurant.user.id,
      email: restaurant.user.email,
      ownerName: restaurant.user.email.split('@')[0] || 'N/A',
      restaurantName: restaurant.restaurantName,
      address: restaurant.address,
      cuisineType: restaurant.cuisineType,
      description: restaurant.description,
      country: restaurant.user.countryCode,
      countryCode: restaurant.countryCode,
      verificationStatus: restaurant.verificationStatus,
      isVerified: restaurant.isVerified,
      rejectionReason: restaurant.rejectionReason,
      isSuspended: restaurant.isSuspended,
      suspensionReason: restaurant.suspensionReason,
      suspendedAt: restaurant.suspendedAt,
      isBlocked: restaurant.user.isBlocked,
      balance: restaurant.restaurantWallet?.balance ? Number(restaurant.restaurantWallet.balance) : 0,
      negativeBalance: restaurant.restaurantWallet?.negativeBalance ? Number(restaurant.restaurantWallet.negativeBalance) : 0,
      totalOrders: restaurant.foodOrders.length,
      completedOrders: completedOrders.length,
      totalRevenue,
      totalCommission,
      recentOrders: restaurant.foodOrders,
      reviews: restaurant.reviews,
      menuStats,
      // Branding
      logoUrl: restaurant.branding?.logoUrl || null,
      bannerUrl: restaurant.branding?.coverPhotoUrl || null,
      // KYC fields (Bangladesh)
      fatherName: restaurant.fatherName,
      presentAddress: restaurant.presentAddress,
      permanentAddress: restaurant.permanentAddress,
      nidNumber: restaurant.nidNumber,
      nidFrontImageUrl: restaurant.nidFrontImageUrl,
      nidBackImageUrl: restaurant.nidBackImageUrl,
      // KYC fields (US)
      homeAddress: restaurant.homeAddress,
      governmentIdType: restaurant.governmentIdType,
      governmentIdLast4: restaurant.governmentIdLast4,
      // Common KYC
      dateOfBirth: restaurant.dateOfBirth,
      emergencyContactName: restaurant.emergencyContactName,
      emergencyContactPhone: restaurant.emergencyContactPhone,
      // Business documents
      businessLicenseNumber: restaurant.businessLicenseNumber,
      businessLicenseUrl: restaurant.businessLicenseUrl,
      healthCertificateUrl: restaurant.healthCertificateUrl,
      ownerRole: restaurant.ownerRole,
      createdAt: restaurant.createdAt,
      accountCreated: restaurant.user.createdAt,
      user: restaurant.user,
    };

    res.json(formattedRestaurant);
  } catch (error) {
    console.error("Get restaurant details error:", error);
    res.status(500).json({ error: "Failed to fetch restaurant details" });
  }
});

// ====================================================
// PATCH /api/admin/restaurants/:id/suspend
// Suspend a restaurant (temporary - can't receive orders)
// ====================================================
router.patch("/restaurants/:id/suspend", checkPermission(Permission.MANAGE_RESTAURANTS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim() === "") {
      return res.status(400).json({ error: "Suspension reason is required" });
    }

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    if (restaurant.isSuspended) {
      return res.status(400).json({ error: "Restaurant is already suspended" });
    }

    const updated = await prisma.restaurantProfile.update({
      where: { id },
      data: {
        isSuspended: true,
        suspensionReason: reason,
        suspendedAt: new Date(),
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId: restaurant.userId,
        type: "admin",
        title: "Account Suspended",
        body: `Your restaurant account has been suspended. Reason: ${reason}`,
      },
    });

    // Create admin notification
    await notifyRestaurantStatusChanged({
      restaurantId: restaurant.id,
      countryCode: restaurant.user.countryCode,
      email: restaurant.user.email,
      action: "suspended",
      actorId: req.user?.userId || "",
      actorEmail: req.user?.email || "unknown",
    });

    res.json({
      message: "Restaurant suspended successfully",
      restaurant: {
        id: updated.id,
        isSuspended: updated.isSuspended,
        suspensionReason: updated.suspensionReason,
      },
    });
  } catch (error) {
    console.error("Suspend restaurant error:", error);
    res.status(500).json({ error: "Failed to suspend restaurant" });
  }
});

// ====================================================
// PATCH /api/admin/restaurants/:id/unsuspend
// Unsuspend a restaurant (lift temporary suspension)
// ====================================================
router.patch("/restaurants/:id/unsuspend", checkPermission(Permission.MANAGE_RESTAURANTS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    if (!restaurant.isSuspended) {
      return res.status(400).json({ error: "Restaurant is not suspended" });
    }

    const updated = await prisma.restaurantProfile.update({
      where: { id },
      data: {
        isSuspended: false,
        suspensionReason: null,
        suspendedAt: null,
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId: restaurant.userId,
        type: "admin",
        title: "Account Unsuspended",
        body: "Your restaurant account suspension has been lifted. You can now receive orders.",
      },
    });

    // Create admin notification
    await notifyRestaurantStatusChanged({
      restaurantId: restaurant.id,
      countryCode: restaurant.user.countryCode,
      email: restaurant.user.email,
      action: "unsuspended",
      actorId: req.user?.userId || "",
      actorEmail: req.user?.email || "unknown",
    });

    res.json({
      message: "Restaurant unsuspended successfully",
      restaurant: {
        id: updated.id,
        isSuspended: updated.isSuspended,
      },
    });
  } catch (error) {
    console.error("Unsuspend restaurant error:", error);
    res.status(500).json({ error: "Failed to unsuspend restaurant" });
  }
});

// ====================================================
// PATCH /api/admin/restaurants/:id/block
// Block a restaurant permanently (disables user account)
// ====================================================
router.patch("/restaurants/:id/block", checkPermission(Permission.MANAGE_USER_STATUS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    if (restaurant.user.isBlocked) {
      return res.status(400).json({ error: "Restaurant is already blocked" });
    }

    await prisma.user.update({
      where: { id: restaurant.userId },
      data: { isBlocked: true },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId: restaurant.userId,
        type: "admin",
        title: "Account Blocked",
        body: "Your restaurant account has been blocked by an administrator.",
      },
    });

    res.json({
      message: "Restaurant blocked successfully",
      restaurantId: id,
      userId: restaurant.userId,
    });
  } catch (error) {
    console.error("Block restaurant error:", error);
    res.status(500).json({ error: "Failed to block restaurant" });
  }
});

// ====================================================
// PATCH /api/admin/restaurants/:id/unblock
// Unblock a restaurant (reactivate user account)
// ====================================================
router.patch("/restaurants/:id/unblock", checkPermission(Permission.MANAGE_USER_STATUS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    if (!restaurant.user.isBlocked) {
      return res.status(400).json({ error: "Restaurant is not blocked" });
    }

    await prisma.user.update({
      where: { id: restaurant.userId },
      data: { isBlocked: false },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId: restaurant.userId,
        type: "admin",
        title: "Account Unblocked",
        body: "Your restaurant account has been unblocked by an administrator.",
      },
    });

    res.json({
      message: "Restaurant unblocked successfully",
      restaurantId: id,
      userId: restaurant.userId,
    });
  } catch (error) {
    console.error("Unblock restaurant error:", error);
    res.status(500).json({ error: "Failed to unblock restaurant" });
  }
});

// ====================================================
// DRIVER COMPLAINTS ENDPOINTS
// ====================================================

// ====================================================
// GET /api/admin/complaints
// List all driver complaints with filters
// ====================================================
router.get("/complaints", checkPermission(Permission.VIEW_SUPPORT_CONVERSATIONS), async (req: AuthRequest, res) => {
  try {
    const { status, driverId, page = "1", limit = "20" } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status as string;
    }

    if (driverId) {
      where.driverId = driverId as string;
    }

    const [complaints, total] = await Promise.all([
      prisma.driverComplaint.findMany({
        where,
        include: {
          driver: {
            include: {
              user: {
                select: {
                  email: true,
                  countryCode: true,
                },
              },
            },
          },
          customer: {
            include: {
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
          ride: {
            select: {
              id: true,
              pickupAddress: true,
              dropoffAddress: true,
              status: true,
              createdAt: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
      }),
      prisma.driverComplaint.count({ where }),
    ]);

    const formattedComplaints = complaints.map((complaint) => ({
      id: complaint.id,
      driverId: complaint.driverId,
      driverEmail: complaint.driver.user.email,
      customerId: complaint.customerId,
      customerEmail: complaint.customer?.user.email || null,
      rideId: complaint.rideId,
      ride: complaint.ride || null,
      reason: complaint.reason,
      description: complaint.description,
      status: complaint.status,
      resolvedAt: complaint.resolvedAt,
      resolvedBy: complaint.resolvedBy,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
    }));

    res.json({
      complaints: formattedComplaints,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("List complaints error:", error);
    res.status(500).json({ error: "Failed to fetch complaints" });
  }
});

// ====================================================
// GET /api/admin/complaints/:id
// Get complaint details
// ====================================================
router.get("/complaints/:id", checkPermission(Permission.VIEW_SUPPORT_CONVERSATIONS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const complaint = await prisma.driverComplaint.findUnique({
      where: { id },
      include: {
        driver: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                countryCode: true,
                isBlocked: true,
              },
            },
          },
        },
        customer: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
        ride: true,
      },
    });

    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    res.json({
      complaint: {
        id: complaint.id,
        driverId: complaint.driverId,
        driver: {
          id: complaint.driver.id,
          email: complaint.driver.user.email,
          countryCode: complaint.driver.user.countryCode,
          isBlocked: complaint.driver.user.isBlocked,
          isSuspended: complaint.driver.isSuspended,
          verificationStatus: complaint.driver.verificationStatus,
        },
        customerId: complaint.customerId,
        customer: complaint.customer
          ? {
              id: complaint.customer.id,
              email: complaint.customer.user.email,
            }
          : null,
        rideId: complaint.rideId,
        ride: complaint.ride || null,
        reason: complaint.reason,
        description: complaint.description,
        status: complaint.status,
        resolvedAt: complaint.resolvedAt,
        resolvedBy: complaint.resolvedBy,
        createdAt: complaint.createdAt,
        updatedAt: complaint.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get complaint details error:", error);
    res.status(500).json({ error: "Failed to fetch complaint details" });
  }
});

// ====================================================
// POST /api/admin/complaints
// Create a new complaint (admin can create manually)
// ====================================================
router.post("/complaints", checkPermission(Permission.REPLY_SUPPORT_CONVERSATIONS), async (req: AuthRequest, res) => {
  try {
    const { driverId, customerId, rideId, reason, description } = req.body;

    if (!driverId || !reason) {
      return res.status(400).json({ error: "driverId and reason are required" });
    }

    // Verify driver exists
    const driver = await prisma.driverProfile.findUnique({ where: { id: driverId } });
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Verify customer if provided
    if (customerId) {
      const customer = await prisma.customerProfile.findUnique({ where: { id: customerId } });
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
    }

    // Verify ride if provided
    if (rideId) {
      const ride = await prisma.ride.findUnique({ where: { id: rideId } });
      if (!ride) {
        return res.status(404).json({ error: "Ride not found" });
      }
    }

    const complaint = await prisma.driverComplaint.create({
      data: {
        driverId,
        customerId: customerId || null,
        rideId: rideId || null,
        reason,
        description: description || null,
      },
    });

    res.json({
      message: "Complaint created successfully",
      complaint,
    });
  } catch (error) {
    console.error("Create complaint error:", error);
    res.status(500).json({ error: "Failed to create complaint" });
  }
});

// ====================================================
// PATCH /api/admin/complaints/:id/resolve
// Resolve a complaint
// ====================================================
router.patch("/complaints/:id/resolve", checkPermission(Permission.REPLY_SUPPORT_CONVERSATIONS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const adminUserId = req.user?.userId;

    const complaint = await prisma.driverComplaint.findUnique({ where: { id } });

    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    if (complaint.status === "resolved") {
      return res.status(400).json({ error: "Complaint is already resolved" });
    }

    const updated = await prisma.driverComplaint.update({
      where: { id },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
        resolvedBy: adminUserId,
      },
    });

    res.json({
      message: "Complaint resolved successfully",
      complaint: updated,
    });
  } catch (error) {
    console.error("Resolve complaint error:", error);
    res.status(500).json({ error: "Failed to resolve complaint" });
  }
});

// ====================================================
// CUSTOMER MANAGEMENT ENDPOINTS
// ====================================================

// ====================================================
// GET /api/admin/customers
// List all customers with filters and usage statistics
// ====================================================
router.get("/customers", checkPermission(Permission.VIEW_USER), async (req: AuthRequest, res) => {
  try {
    const { search, status } = req.query;

    // Build where clause
    const whereClause: any = {};

    // Join with user table for email search and status filtering
    const userWhere: any = { role: "customer" };

    if (search) {
      userWhere.email = {
        contains: search as string,
        mode: "insensitive",
      };
    }

    if (status) {
      if (status === "active") {
        userWhere.isBlocked = false;
        whereClause.isSuspended = false;
      } else if (status === "suspended") {
        whereClause.isSuspended = true;
      } else if (status === "blocked") {
        userWhere.isBlocked = true;
      }
    }

    whereClause.user = userWhere;

    const customers = await prisma.customerProfile.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
            createdAt: true,
          },
        },
        rides: {
          select: { id: true, status: true },
        },
        foodOrders: {
          select: { id: true, status: true },
        },
        deliveries: {
          select: { id: true, status: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate usage statistics for each customer
    const customersWithStats = customers.map((customer) => ({
      id: customer.id,
      userId: customer.userId,
      email: customer.user.email,
      country: customer.user.countryCode,
      verificationStatus: customer.verificationStatus,
      isVerified: customer.isVerified,
      isSuspended: customer.isSuspended,
      suspensionReason: customer.suspensionReason,
      suspendedAt: customer.suspendedAt,
      isBlocked: customer.user.isBlocked,
      createdAt: customer.user.createdAt,
      totalRides: customer.rides.length,
      completedRides: customer.rides.filter((r) => r.status === "completed").length,
      totalFoodOrders: customer.foodOrders.length,
      completedFoodOrders: customer.foodOrders.filter((o) => o.status === "completed").length,
      totalParcels: customer.deliveries.length,
      completedParcels: customer.deliveries.filter((d) => d.status === "completed").length,
    }));

    res.json(customersWithStats);
  } catch (error) {
    console.error("Fetch customers error:", error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// ====================================================
// GET /api/admin/customers/:id
// Get detailed customer information with statistics
// ====================================================
router.get("/customers/:id", checkPermission(Permission.VIEW_USER), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customerProfile.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        // Bangladesh-specific fields (NEW - exclude nidEncrypted for security)
        fullName: true,
        fatherName: true,
        phoneNumber: true,
        village: true,
        postOffice: true,
        thana: true,
        district: true,
        presentAddress: true,
        permanentAddress: true,
        nidNumber: true, // Legacy field
        // nidEncrypted: EXCLUDED - only accessible via dedicated endpoint
        nidFrontImageUrl: true,
        nidBackImageUrl: true,
        // US-specific fields
        homeAddress: true,
        governmentIdType: true,
        governmentIdLast4: true,
        // Common fields
        dateOfBirth: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        verificationStatus: true,
        rejectionReason: true,
        isVerified: true,
        isSuspended: true,
        suspensionReason: true,
        suspendedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
            createdAt: true,
          },
        },
        rides: {
          select: {
            id: true,
            status: true,
            pickupAddress: true,
            dropoffAddress: true,
            serviceFare: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        foodOrders: {
          select: {
            id: true,
            status: true,
            serviceFare: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        deliveries: {
          select: {
            id: true,
            status: true,
            pickupAddress: true,
            dropoffAddress: true,
            serviceFare: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        driverComplaints: {
          select: {
            id: true,
            reason: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Calculate statistics
    const stats = {
      totalRides: customer.rides.length,
      completedRides: customer.rides.filter((r) => r.status === "completed").length,
      totalFoodOrders: customer.foodOrders.length,
      completedFoodOrders: customer.foodOrders.filter((o) => o.status === "completed").length,
      totalParcels: customer.deliveries.length,
      completedParcels: customer.deliveries.filter((d) => d.status === "completed").length,
      openComplaints: customer.driverComplaints.filter((c) => c.status === "open").length,
    };

    res.json({
      ...customer,
      stats,
    });
  } catch (error) {
    console.error("Fetch customer details error:", error);
    res.status(500).json({ error: "Failed to fetch customer details" });
  }
});

// ====================================================
// PATCH /api/admin/customers/:id/profile
// Update customer Bangladesh profile fields (admin only)
// ====================================================
const updateCustomerProfileSchema = z.object({
  fullName: z.string().min(1).optional(),
  fatherName: z.string().min(1).optional(),
  phoneNumber: z.string().refine((val) => !val || isValidBdPhone(val), {
    message: "Invalid Bangladesh phone number format (must be 01XXXXXXXXX)",
  }).optional(),
  village: z.string().min(1).optional(),
  postOffice: z.string().min(1).optional(),
  postalCode: z.string().regex(/^[0-9]{4,6}$/, {
    message: "Postal Code must be 4-6 digits",
  }).optional(),
  thana: z.string().min(1).optional(),
  district: z.string().min(1).optional(),
  presentAddress: z.string().min(1).optional(),
  permanentAddress: z.string().min(1).optional(),
  nid: z.string().refine((val) => !val || isValidBdNid(val), {
    message: "Invalid Bangladesh NID format (must be 10-17 digits)",
  }).optional(),
});

router.patch("/customers/:id/profile", checkPermission(Permission.MANAGE_CUSTOMERS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const validation = updateCustomerProfileSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }

    const data = validation.data;

    // Check if customer exists
    const customer = await prisma.customerProfile.findUnique({ where: { id } });
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Prepare update data
    const updateData: any = {};
    
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.fatherName !== undefined) updateData.fatherName = data.fatherName;
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;
    if (data.village !== undefined) updateData.village = data.village;
    if (data.postOffice !== undefined) updateData.postOffice = data.postOffice;
    if (data.postalCode !== undefined) updateData.postalCode = data.postalCode;
    if (data.thana !== undefined) updateData.thana = data.thana;
    if (data.district !== undefined) updateData.district = data.district;
    if (data.presentAddress !== undefined) updateData.presentAddress = data.presentAddress;
    if (data.permanentAddress !== undefined) updateData.permanentAddress = data.permanentAddress;
    
    // Encrypt NID if provided
    if (data.nid !== undefined && data.nid) {
      updateData.nidEncrypted = encrypt(data.nid);
      // Also update legacy nidNumber field for backward compatibility
      updateData.nidNumber = data.nid;
    }

    // Update customer profile
    const updatedCustomer = await prisma.customerProfile.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
            createdAt: true,
          },
        },
      },
    });

    // Return updated profile (exclude nidEncrypted)
    const { nidEncrypted, ...customerProfile } = updatedCustomer as any;
    
    res.json({
      message: "Customer profile updated successfully",
      customer: customerProfile,
    });
  } catch (error) {
    console.error("Update customer profile error:", error);
    res.status(500).json({ error: "Failed to update customer profile" });
  }
});

// ====================================================
// PATCH /api/admin/customers/:id/suspend
// Suspend a customer account (temporary restriction)
// ====================================================
router.patch("/customers/:id/suspend", checkPermission(Permission.MANAGE_CUSTOMERS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: "Suspension reason is required" });
    }

    const customer = await prisma.customerProfile.findUnique({ where: { id } });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if (customer.isSuspended) {
      return res.status(400).json({ error: "Customer is already suspended" });
    }

    const updated = await prisma.customerProfile.update({
      where: { id },
      data: {
        isSuspended: true,
        suspensionReason: reason,
        suspendedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
          },
        },
      },
    });

    // Create notification for customer
    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId: customer.userId,
        type: "account_suspended",
        title: "Account Suspended",
        body: `Your account has been suspended. Reason: ${reason}`,
      },
    });

    res.json({
      message: "Customer suspended successfully",
      customer: updated,
    });
  } catch (error) {
    console.error("Suspend customer error:", error);
    res.status(500).json({ error: "Failed to suspend customer" });
  }
});

// ====================================================
// PATCH /api/admin/customers/:id/unsuspend
// Unsuspend a customer account
// ====================================================
router.patch("/customers/:id/unsuspend", checkPermission(Permission.MANAGE_CUSTOMERS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customerProfile.findUnique({ where: { id } });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if (!customer.isSuspended) {
      return res.status(400).json({ error: "Customer is not suspended" });
    }

    const updated = await prisma.customerProfile.update({
      where: { id },
      data: {
        isSuspended: false,
        suspensionReason: null,
        suspendedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
          },
        },
      },
    });

    // Create notification for customer
    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId: customer.userId,
        type: "account_active",
        title: "Account Unsuspended",
        body: "Your account suspension has been lifted. You can now use SafeGo services.",
      },
    });

    res.json({
      message: "Customer unsuspended successfully",
      customer: updated,
    });
  } catch (error) {
    console.error("Unsuspend customer error:", error);
    res.status(500).json({ error: "Failed to unsuspend customer" });
  }
});

// ====================================================
// PATCH /api/admin/customers/:id/block
// Permanently block a customer account
// ====================================================
router.patch("/customers/:id/block", checkPermission(Permission.MANAGE_USER_STATUS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customerProfile.findUnique({ 
      where: { id },
      include: { user: true }
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if (customer.user.isBlocked) {
      return res.status(400).json({ error: "Customer is already blocked" });
    }

    // Block the user account
    await prisma.user.update({
      where: { id: customer.userId },
      data: { isBlocked: true },
    });

    // Get updated customer with user data
    const updated = await prisma.customerProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
          },
        },
      },
    });

    // Create notification for customer
    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId: customer.userId,
        type: "account_blocked",
        title: "Account Blocked",
        body: "Your account has been permanently blocked. Please contact support for more information.",
      },
    });

    res.json({
      message: "Customer blocked successfully",
      customer: updated,
    });
  } catch (error) {
    console.error("Block customer error:", error);
    res.status(500).json({ error: "Failed to block customer" });
  }
});

// ====================================================
// PATCH /api/admin/customers/:id/unblock
// Unblock a customer account
// ====================================================
router.patch("/customers/:id/unblock", checkPermission(Permission.MANAGE_USER_STATUS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customerProfile.findUnique({ 
      where: { id },
      include: { user: true }
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if (!customer.user.isBlocked) {
      return res.status(400).json({ error: "Customer is not blocked" });
    }

    // Unblock the user account
    await prisma.user.update({
      where: { id: customer.userId },
      data: { isBlocked: false },
    });

    // Get updated customer with user data
    const updated = await prisma.customerProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
          },
        },
      },
    });

    // Create notification for customer
    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId: customer.userId,
        type: "account_active",
        title: "Account Unblocked",
        body: "Your account has been unblocked. You can now use SafeGo services.",
      },
    });

    res.json({
      message: "Customer unblocked successfully",
      customer: updated,
    });
  } catch (error) {
    console.error("Unblock customer error:", error);
    res.status(500).json({ error: "Failed to unblock customer" });
  }
});

// ====================================================
// NID DECRYPTION ENDPOINTS (ADMIN ONLY - SECURE)
// ====================================================

// ====================================================
// GET /api/admin/customers/:id/nid
// Decrypt and return customer NID (admin only)
// ====================================================
router.get("/customers/:id/nid", checkPermission(Permission.MANAGE_CUSTOMERS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { decrypt } = await import("../utils/encryption.js");

    const customer = await prisma.customerProfile.findUnique({
      where: { id },
      select: {
        id: true,
        nidEncrypted: true,
        nidNumber: true, // Legacy fallback
      },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Try encrypted NID first, fallback to legacy nidNumber
    let nid = "";
    if (customer.nidEncrypted) {
      nid = decrypt(customer.nidEncrypted);
    } else if (customer.nidNumber) {
      nid = customer.nidNumber; // Legacy unencrypted data
    }

    res.json({ nid });
  } catch (error) {
    console.error("Fetch customer NID error:", error);
    res.status(500).json({ error: "Failed to fetch customer NID" });
  }
});

// ====================================================
// GET /api/admin/drivers/:id/nid
// Decrypt and return driver NID (admin only)
// ====================================================
router.get("/drivers/:id/nid", checkPermission(Permission.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { decrypt } = await import("../utils/encryption.js");

    const driver = await prisma.driverProfile.findUnique({
      where: { id },
      select: {
        id: true,
        nidEncrypted: true,
        nidNumber: true, // Legacy fallback
      },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Try encrypted NID first, fallback to legacy nidNumber
    let nid = "";
    if (driver.nidEncrypted) {
      nid = decrypt(driver.nidEncrypted);
    } else if (driver.nidNumber) {
      nid = driver.nidNumber; // Legacy unencrypted data
    }

    res.json({ nid });
  } catch (error) {
    console.error("Fetch driver NID error:", error);
    res.status(500).json({ error: "Failed to fetch driver NID" });
  }
});

// ====================================================
// GET /api/admin/drivers/:id/commission
// Get commission breakdown for a specific driver (all-time and by service)
// ====================================================
router.get("/drivers/:id/commission", checkPermission(Permission.VIEW_COMMISSION_ANALYTICS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Verify driver exists
    const driver = await prisma.driverProfile.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Aggregate commission from completed rides
    const rideCommission = await prisma.ride.aggregate({
      where: {
        driverId: id,
        status: "completed",
      },
      _sum: {
        safegoCommission: true,
      },
      _count: {
        id: true,
      },
    });

    // Aggregate commission from delivered parcels
    const parcelCommission = await prisma.delivery.aggregate({
      where: {
        driverId: id,
        status: "delivered",
      },
      _sum: {
        safegoCommission: true,
      },
      _count: {
        id: true,
      },
    });

    // Aggregate commission from delivered food orders
    const foodCommission = await prisma.foodOrder.aggregate({
      where: {
        driverId: id,
        status: "delivered",
      },
      _sum: {
        safegoCommission: true,
      },
      _count: {
        id: true,
      },
    });

    const totalCommission = 
      Number(rideCommission._sum.safegoCommission || 0) +
      Number(parcelCommission._sum.safegoCommission || 0) +
      Number(foodCommission._sum.safegoCommission || 0);

    res.json({
      driverId: id,
      totalCommission: totalCommission.toFixed(2),
      breakdown: {
        rides: {
          commission: Number(rideCommission._sum.safegoCommission || 0).toFixed(2),
          count: rideCommission._count.id,
        },
        parcels: {
          commission: Number(parcelCommission._sum.safegoCommission || 0).toFixed(2),
          count: parcelCommission._count.id,
        },
        food: {
          commission: Number(foodCommission._sum.safegoCommission || 0).toFixed(2),
          count: foodCommission._count.id,
        },
      },
    });
  } catch (error) {
    console.error("Get driver commission error:", error);
    res.status(500).json({ error: "Failed to fetch driver commission" });
  }
});

// ====================================================
// GET /api/admin/drivers/:id/wallet-summary
// Get comprehensive commission & wallet summary for a specific driver
// Includes earnings, commission, balance, country/service breakdown, and recent transactions
// ====================================================
router.get("/drivers/:id/wallet-summary", checkPermission(Permission.VIEW_WALLET_SUMMARY), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Verify driver exists and get wallet info
    const driver = await prisma.driverProfile.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            countryCode: true,
          },
        },
        driverWallet: {
          select: {
            balance: true,
            negativeBalance: true,
          },
        },
      },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Calculate current balance (balance - negativeBalance)
    const walletBalance = Number(driver.driverWallet?.balance || 0);
    const negativeBalance = Number(driver.driverWallet?.negativeBalance || 0);
    const currentBalance = walletBalance - negativeBalance;

    // === RIDES AGGREGATION ===
    const rideStats = await prisma.ride.aggregate({
      where: {
        driverId: id,
        status: "completed",
      },
      _sum: {
        driverPayout: true,
        safegoCommission: true,
      },
      _count: {
        id: true,
      },
    });

    // === DELIVERIES AGGREGATION ===
    const deliveryStats = await prisma.delivery.aggregate({
      where: {
        driverId: id,
        status: "delivered",
      },
      _sum: {
        driverPayout: true,
        safegoCommission: true,
      },
      _count: {
        id: true,
      },
    });

    // === FOOD ORDERS AGGREGATION ===
    const foodStats = await prisma.foodOrder.aggregate({
      where: {
        driverId: id,
        status: "delivered",
      },
      _sum: {
        driverPayout: true,
        safegoCommission: true,
      },
      _count: {
        id: true,
      },
    });

    // Calculate totals
    const totalTrips = rideStats._count.id + deliveryStats._count.id + foodStats._count.id;
    const totalEarnings = 
      Number(rideStats._sum.driverPayout || 0) +
      Number(deliveryStats._sum.driverPayout || 0) +
      Number(foodStats._sum.driverPayout || 0);
    const totalCommission = 
      Number(rideStats._sum.safegoCommission || 0) +
      Number(deliveryStats._sum.safegoCommission || 0) +
      Number(foodStats._sum.safegoCommission || 0);

    // === COUNTRY BREAKDOWN ===
    // Get rides by customer country
    const ridesByCountry = await prisma.ride.groupBy({
      by: ['customerId'],
      where: {
        driverId: id,
        status: "completed",
      },
      _sum: {
        driverPayout: true,
        safegoCommission: true,
      },
      _count: {
        id: true,
      },
    });

    // Fetch customer country codes
    const customerIds = ridesByCountry.map(r => r.customerId);
    const customers = await prisma.customerProfile.findMany({
      where: {
        id: {
          in: customerIds,
        },
      },
      select: {
        id: true,
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    const customerCountryMap = new Map(
      customers.map(c => [c.id, c.user?.countryCode || 'UNKNOWN'])
    );

    // Similarly for deliveries
    const deliveriesByCountry = await prisma.delivery.groupBy({
      by: ['customerId'],
      where: {
        driverId: id,
        status: "delivered",
      },
      _sum: {
        driverPayout: true,
        safegoCommission: true,
      },
      _count: {
        id: true,
      },
    });

    const deliveryCustomerIds = deliveriesByCountry.map(d => d.customerId);
    const deliveryCustomers = await prisma.customerProfile.findMany({
      where: {
        id: {
          in: deliveryCustomerIds,
        },
      },
      select: {
        id: true,
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    const deliveryCountryMap = new Map(
      deliveryCustomers.map(c => [c.id, c.user?.countryCode || 'UNKNOWN'])
    );

    // Similarly for food orders
    const foodByCountry = await prisma.foodOrder.groupBy({
      by: ['customerId'],
      where: {
        driverId: id,
        status: "delivered",
      },
      _sum: {
        driverPayout: true,
        safegoCommission: true,
      },
      _count: {
        id: true,
      },
    });

    const foodCustomerIds = foodByCountry.map(f => f.customerId);
    const foodCustomers = await prisma.customerProfile.findMany({
      where: {
        id: {
          in: foodCustomerIds,
        },
      },
      select: {
        id: true,
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    const foodCountryMap = new Map(
      foodCustomers.map(c => [c.id, c.user?.countryCode || 'UNKNOWN'])
    );

    // Aggregate by country
    const countryBreakdown: Record<string, { trips: number; earnings: number; commission: number }> = {};

    ridesByCountry.forEach(r => {
      const country = customerCountryMap.get(r.customerId) || 'UNKNOWN';
      if (!countryBreakdown[country]) {
        countryBreakdown[country] = { trips: 0, earnings: 0, commission: 0 };
      }
      countryBreakdown[country].trips += r._count.id;
      countryBreakdown[country].earnings += Number(r._sum.driverPayout || 0);
      countryBreakdown[country].commission += Number(r._sum.safegoCommission || 0);
    });

    deliveriesByCountry.forEach(d => {
      const country = deliveryCountryMap.get(d.customerId) || 'UNKNOWN';
      if (!countryBreakdown[country]) {
        countryBreakdown[country] = { trips: 0, earnings: 0, commission: 0 };
      }
      countryBreakdown[country].trips += d._count.id;
      countryBreakdown[country].earnings += Number(d._sum.driverPayout || 0);
      countryBreakdown[country].commission += Number(d._sum.safegoCommission || 0);
    });

    foodByCountry.forEach(f => {
      const country = foodCountryMap.get(f.customerId) || 'UNKNOWN';
      if (!countryBreakdown[country]) {
        countryBreakdown[country] = { trips: 0, earnings: 0, commission: 0 };
      }
      countryBreakdown[country].trips += f._count.id;
      countryBreakdown[country].earnings += Number(f._sum.driverPayout || 0);
      countryBreakdown[country].commission += Number(f._sum.safegoCommission || 0);
    });

    // === RECENT TRANSACTIONS ===
    // Fetch last 10 completed trips/orders as "transactions"
    const recentRides = await prisma.ride.findMany({
      where: {
        driverId: id,
        status: "completed",
      },
      select: {
        id: true,
        driverPayout: true,
        safegoCommission: true,
        completedAt: true,
        createdAt: true,
      },
      orderBy: {
        completedAt: 'desc',
      },
      take: 10,
    });

    const recentDeliveries = await prisma.delivery.findMany({
      where: {
        driverId: id,
        status: "delivered",
      },
      select: {
        id: true,
        driverPayout: true,
        safegoCommission: true,
        deliveredAt: true,
        createdAt: true,
      },
      orderBy: {
        deliveredAt: 'desc',
      },
      take: 10,
    });

    const recentFood = await prisma.foodOrder.findMany({
      where: {
        driverId: id,
        status: "delivered",
      },
      select: {
        id: true,
        driverPayout: true,
        safegoCommission: true,
        deliveredAt: true,
        createdAt: true,
      },
      orderBy: {
        deliveredAt: 'desc',
      },
      take: 10,
    });

    // Combine and sort all transactions
    const allTransactions = [
      ...recentRides.map(r => ({
        id: r.id,
        service: 'ride' as const,
        type: 'trip_earning' as const,
        amount: Number(r.driverPayout),
        commission: Number(r.safegoCommission),
        dateTime: r.completedAt || r.createdAt,
      })),
      ...recentDeliveries.map(d => ({
        id: d.id,
        service: 'parcel' as const,
        type: 'trip_earning' as const,
        amount: Number(d.driverPayout),
        commission: Number(d.safegoCommission),
        dateTime: d.deliveredAt || d.createdAt,
      })),
      ...recentFood.map(f => ({
        id: f.id,
        service: 'food' as const,
        type: 'trip_earning' as const,
        amount: Number(f.driverPayout),
        commission: Number(f.safegoCommission),
        dateTime: f.deliveredAt || f.createdAt,
      })),
    ].sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime()).slice(0, 10);

    // === RESPONSE ===
    res.json({
      driverId: id,
      driverCountry: driver.user?.countryCode || 'UNKNOWN',
      
      // At-a-glance stats
      totalTrips,
      totalEarnings: totalEarnings.toFixed(2),
      totalCommission: totalCommission.toFixed(2),
      currentBalance: currentBalance.toFixed(2),
      balanceStatus: currentBalance > 0 ? 'positive' : currentBalance < 0 ? 'negative' : 'zero',

      // Service breakdown
      byService: {
        rides: {
          count: rideStats._count.id,
          earnings: Number(rideStats._sum.driverPayout || 0).toFixed(2),
          commission: Number(rideStats._sum.safegoCommission || 0).toFixed(2),
        },
        food: {
          count: foodStats._count.id,
          earnings: Number(foodStats._sum.driverPayout || 0).toFixed(2),
          commission: Number(foodStats._sum.safegoCommission || 0).toFixed(2),
        },
        parcels: {
          count: deliveryStats._count.id,
          earnings: Number(deliveryStats._sum.driverPayout || 0).toFixed(2),
          commission: Number(deliveryStats._sum.safegoCommission || 0).toFixed(2),
        },
      },

      // Country breakdown
      byCountry: countryBreakdown,

      // Recent transactions
      recentTransactions: allTransactions.map(t => ({
        id: t.id,
        service: t.service,
        type: t.type,
        amount: t.amount.toFixed(2),
        commission: t.commission.toFixed(2),
        netAmount: (t.amount - t.commission).toFixed(2),
        dateTime: t.dateTime,
      })),
    });
  } catch (error) {
    console.error("Get driver wallet summary error:", error);
    res.status(500).json({ error: "Failed to fetch driver wallet summary" });
  }
});

// ====================================================
// GET /api/admin/commission/summary
// Get platform-wide commission summary with filters
// ====================================================
router.get("/commission/summary", checkPermission(Permission.VIEW_COMMISSION_ANALYTICS), async (req: AuthRequest, res) => {
  try {
    const { country, startDate, endDate } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (startDate || endDate) {
      if (startDate) {
        dateFilter.gte = new Date(startDate as string);
      }
      if (endDate) {
        dateFilter.lte = new Date(endDate as string);
      }
    }

    // Get completed rides with optional filters
    const rideWhere: any = { status: "completed" };
    if (Object.keys(dateFilter).length > 0) {
      rideWhere.completedAt = dateFilter;
    }
    if (country) {
      // Join through driver to filter by country
      rideWhere.driver = {
        user: {
          countryCode: country as string,
        },
      };
    }

    const rideCommission = await prisma.ride.aggregate({
      where: rideWhere,
      _sum: {
        safegoCommission: true,
      },
      _count: {
        id: true,
      },
    });

    // Get delivered parcels with optional filters
    const parcelWhere: any = { status: "delivered" };
    if (Object.keys(dateFilter).length > 0) {
      parcelWhere.deliveredAt = dateFilter;
    }
    if (country) {
      parcelWhere.driver = {
        user: {
          countryCode: country as string,
        },
      };
    }

    const parcelCommission = await prisma.delivery.aggregate({
      where: parcelWhere,
      _sum: {
        safegoCommission: true,
      },
      _count: {
        id: true,
      },
    });

    // Get delivered food orders with optional filters
    const foodWhere: any = { status: "delivered" };
    if (Object.keys(dateFilter).length > 0) {
      foodWhere.deliveredAt = dateFilter;
    }
    if (country) {
      foodWhere.driver = {
        user: {
          countryCode: country as string,
        },
      };
    }

    const foodCommission = await prisma.foodOrder.aggregate({
      where: foodWhere,
      _sum: {
        safegoCommission: true,
      },
      _count: {
        id: true,
      },
    });

    const totalCommission = 
      Number(rideCommission._sum.safegoCommission || 0) +
      Number(parcelCommission._sum.safegoCommission || 0) +
      Number(foodCommission._sum.safegoCommission || 0);

    res.json({
      totalCommission: totalCommission.toFixed(2),
      byService: {
        rides: {
          commission: Number(rideCommission._sum.safegoCommission || 0).toFixed(2),
          count: rideCommission._count.id,
        },
        parcels: {
          commission: Number(parcelCommission._sum.safegoCommission || 0).toFixed(2),
          count: parcelCommission._count.id,
        },
        food: {
          commission: Number(foodCommission._sum.safegoCommission || 0).toFixed(2),
          count: foodCommission._count.id,
        },
      },
      filters: {
        country: country || "all",
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    console.error("Get commission summary error:", error);
    res.status(500).json({ error: "Failed to fetch commission summary" });
  }
});

// ====================================================
// PARCEL (DELIVERY) MANAGEMENT ENDPOINTS
// ====================================================

// ====================================================
// GET /api/admin/stats/parcels
// Get parcel statistics for dashboard
// ====================================================
router.get("/stats/parcels", checkPermission(Permission.VIEW_PARCELS), async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Total parcels (all time)
    const totalParcels = await prisma.delivery.count();

    // Active parcels (statuses: requested, searching_driver, accepted, picked_up, on_the_way)
    const activeParcels = await prisma.delivery.count({
      where: {
        status: {
          in: ["requested", "searching_driver", "accepted", "picked_up", "on_the_way"]
        }
      }
    });

    // Delivered today (status: delivered AND deliveredAt is today)
    const deliveredToday = await prisma.delivery.count({
      where: {
        status: "delivered",
        deliveredAt: {
          gte: todayStart,
          lt: todayEnd
        }
      }
    });

    // Cancelled parcels (all time)
    const cancelledParcels = await prisma.delivery.count({
      where: {
        status: {
          in: ["cancelled_by_customer", "cancelled_by_driver"]
        }
      }
    });

    res.json({
      totalParcels,
      activeParcels,
      deliveredToday,
      cancelledParcels,
    });
  } catch (error) {
    console.error("Get parcel stats error:", error);
    res.status(500).json({ error: "Failed to fetch parcel statistics" });
  }
});

// ====================================================
// GET /api/admin/parcels
// Get parcel list with filters and pagination
// ====================================================
router.get("/parcels", checkPermission(Permission.VIEW_PARCELS), async (req: AuthRequest, res) => {
  try {
    const { 
      page = "1", 
      pageSize = "20", 
      status, 
      country,
      search 
    } = req.query;

    // Validate and sanitize pagination parameters
    let pageNum = parseInt(page as string);
    let limitNum = parseInt(pageSize as string);
    
    // Ensure valid positive integers, default to safe values if invalid
    if (isNaN(pageNum) || pageNum < 1) {
      pageNum = 1;
    }
    if (isNaN(limitNum) || limitNum < 1) {
      limitNum = 20;
    }
    
    // Clamp pageSize to max 100
    limitNum = Math.min(limitNum, 100);
    
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    
    // Validate and sanitize status filter
    const validStatusFilters = ["all", "active", "pending_pickup", "assigned", "in_transit", "delivered", "cancelled"];
    const statusFilter = typeof status === "string" && validStatusFilters.includes(status) ? status : "all";

    // Filter by status
    if (statusFilter !== "all") {
      if (statusFilter === "active") {
        where.status = {
          in: ["requested", "searching_driver", "accepted", "picked_up", "on_the_way"]
        };
      } else if (statusFilter === "pending_pickup") {
        where.status = {
          in: ["requested", "searching_driver"]
        };
      } else if (statusFilter === "assigned") {
        where.status = "accepted";
      } else if (statusFilter === "in_transit") {
        where.status = {
          in: ["picked_up", "on_the_way"]
        };
      } else if (statusFilter === "delivered") {
        where.status = "delivered";
      } else if (statusFilter === "cancelled") {
        where.status = {
          in: ["cancelled_by_customer", "cancelled_by_driver"]
        };
      }
    }

    // Validate and sanitize search parameter (limit length to prevent abuse)
    const searchQuery = typeof search === "string" && search.trim() ? search.trim().substring(0, 100) : null;
    if (searchQuery) {
      where.OR = [
        { id: { contains: searchQuery, mode: "insensitive" } },
        { customer: { user: { email: { contains: searchQuery, mode: "insensitive" } } } }
      ];
    }

    // Validate and sanitize country filter
    const validCountries = ["all", "BD", "US"];
    const countryFilter = typeof country === "string" && validCountries.includes(country) ? country : "all";
    
    // Filter by country (through customer)
    if (countryFilter !== "all") {
      where.customer = {
        user: {
          countryCode: countryFilter
        }
      };
    }

    // Get total count for pagination
    const total = await prisma.delivery.count({ where });

    // Get parcels
    const parcels = await prisma.delivery.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            user: {
              select: {
                email: true,
                countryCode: true
              }
            }
          }
        },
        driver: {
          select: {
            id: true,
            user: {
              select: {
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      skip,
      take: limitNum,
    });

    res.json({
      parcels: parcels.map(parcel => ({
        id: parcel.id,
        createdAt: parcel.createdAt,
        status: parcel.status,
        customerEmail: parcel.customer.user.email,
        country: parcel.customer.user.countryCode,
        pickupAddress: parcel.pickupAddress,
        dropoffAddress: parcel.dropoffAddress,
        serviceFare: Number(parcel.serviceFare),
        driverEmail: parcel.driver?.user.email || null,
        deliveredAt: parcel.deliveredAt,
      })),
      pagination: {
        page: pageNum,
        pageSize: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get parcels error:", error);
    res.status(500).json({ error: "Failed to fetch parcels" });
  }
});

// ====================================================
// GET /api/admin/parcels/:id
// Get detailed parcel information
// ====================================================
router.get("/parcels/:id", checkPermission(Permission.VIEW_PARCELS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const parcel = await prisma.delivery.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                email: true,
                countryCode: true,
                createdAt: true
              }
            }
          }
        },
        driver: {
          select: {
            id: true,
            isSuspended: true,
            user: {
              select: {
                id: true,
                email: true,
                countryCode: true,
                isBlocked: true
              }
            }
          }
        }
      }
    });

    if (!parcel) {
      return res.status(404).json({ error: "Parcel not found" });
    }

    res.json({
      id: parcel.id,
      createdAt: parcel.createdAt,
      updatedAt: parcel.updatedAt,
      deliveredAt: parcel.deliveredAt,
      status: parcel.status,
      // Customer info
      customer: {
        id: parcel.customer.id,
        userId: parcel.customer.user.id,
        email: parcel.customer.user.email,
        countryCode: parcel.customer.user.countryCode,
      },
      // Driver info
      driver: parcel.driver ? {
        id: parcel.driver.id,
        userId: parcel.driver.user.id,
        email: parcel.driver.user.email,
        countryCode: parcel.driver.user.countryCode,
        isSuspended: parcel.driver.isSuspended,
        isBlocked: parcel.driver.user.isBlocked,
      } : null,
      // Locations
      pickupAddress: parcel.pickupAddress,
      pickupLat: parcel.pickupLat,
      pickupLng: parcel.pickupLng,
      dropoffAddress: parcel.dropoffAddress,
      dropoffLat: parcel.dropoffLat,
      dropoffLng: parcel.dropoffLng,
      // Financials
      serviceFare: Number(parcel.serviceFare),
      safegoCommission: Number(parcel.safegoCommission),
      driverPayout: Number(parcel.driverPayout),
      paymentMethod: parcel.paymentMethod,
      // Feedback
      customerRating: parcel.customerRating,
      customerFeedback: parcel.customerFeedback,
    });
  } catch (error) {
    console.error("Get parcel details error:", error);
    res.status(500).json({ error: "Failed to fetch parcel details" });
  }
});

// ====================================================
// DOCUMENT CENTER ENDPOINTS
// ====================================================

// ====================================================
// GET /api/admin/documents/drivers
// List all drivers with document status for Document Center
// ====================================================
router.get("/documents/drivers", checkPermission(Permission.MANAGE_DOCUMENT_REVIEW), async (req: AuthRequest, res) => {
  try {
    const { search, country, status, page = "1", limit = "20" } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    const userFilters: any = {};

    // Search by email
    if (search) {
      userFilters.email = { contains: search as string, mode: "insensitive" };
    }

    // Filter by country
    if (country && country !== "all") {
      userFilters.countryCode = country as string;
    }

    // Filter by verification status (document status)
    if (status && status !== "all") {
      where.verificationStatus = status as string;
    }

    // Apply user filters if any exist
    if (Object.keys(userFilters).length > 0) {
      where.user = userFilters;
    }

    const [drivers, total] = await Promise.all([
      prisma.driverProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              countryCode: true,
            },
          },
          vehicles: true,
          vehicleDocuments: {
            select: {
              documentType: true,
              fileUrl: true,
              uploadedAt: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.driverProfile.count({ where }),
    ]);

    const formatted = await Promise.all(
      drivers.map(async (driver) => {
        // Check document completeness
        const kycValidation = await validateDriverKYC(driver, driver.user.countryCode);

        return {
          id: driver.id,
          userId: driver.user.id,
          email: driver.user.email,
          countryCode: driver.user.countryCode,
          verificationStatus: driver.verificationStatus,
          isVerified: driver.isVerified,
          hasProfilePhoto: !!driver.profilePhotoUrl,
          hasNID: !!(driver.nidEncrypted || driver.nidNumber),
          hasDMVLicense: !!driver.dmvLicenseImageUrl,
          hasTLCLicense: !!driver.tlcLicenseImageUrl,
          vehicleDocuments: driver.vehicleDocuments.length,
          isComplete: kycValidation.isComplete,
          missingFields: kycValidation.missingFields,
          lastUpdated: driver.updatedAt,
        };
      })
    );

    res.json({
      drivers: formatted,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("List drivers for document center error:", error);
    res.status(500).json({ error: "Failed to fetch drivers" });
  }
});

// ====================================================
// GET /api/admin/documents/customers
// List all customers with document status for Document Center
// ====================================================
router.get("/documents/customers", checkPermission(Permission.MANAGE_DOCUMENT_REVIEW), async (req: AuthRequest, res) => {
  try {
    const { search, country, status, page = "1", limit = "20" } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    const userFilters: any = {};

    // Search by email
    if (search) {
      userFilters.email = { contains: search as string, mode: "insensitive" };
    }

    // Filter by country
    if (country && country !== "all") {
      userFilters.countryCode = country as string;
    }

    // Filter by verification status (document status)
    if (status && status !== "all") {
      where.verificationStatus = status as string;
    }

    // Apply user filters if any exist
    if (Object.keys(userFilters).length > 0) {
      where.user = userFilters;
    }

    const [customers, total] = await Promise.all([
      prisma.customerProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              countryCode: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.customerProfile.count({ where }),
    ]);

    const formatted = customers.map((customer) => ({
      id: customer.id,
      userId: customer.user.id,
      email: customer.user.email,
      countryCode: customer.user.countryCode,
      verificationStatus: customer.verificationStatus,
      isVerified: customer.isVerified,
      hasNID: !!(customer.nidEncrypted || customer.nidNumber),
      hasNIDImages: !!(customer.nidFrontImageUrl && customer.nidBackImageUrl),
      fullName: customer.fullName,
      fatherName: customer.fatherName,
      phoneNumber: customer.phoneNumber,
      village: customer.village,
      postOffice: customer.postOffice,
      thana: customer.thana,
      district: customer.district,
      lastUpdated: customer.updatedAt,
    }));

    res.json({
      customers: formatted,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("List customers for document center error:", error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// ====================================================
// GET /api/admin/documents/restaurants
// List all restaurants with document status for Document Center
// ====================================================
router.get("/documents/restaurants", checkPermission(Permission.MANAGE_DOCUMENT_REVIEW), async (req: AuthRequest, res) => {
  try {
    const { search, country, status, page = "1", limit = "20" } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    const userFilters: any = {};

    // Search by email
    if (search) {
      userFilters.email = { contains: search as string, mode: "insensitive" };
    }

    // Filter by country
    if (country && country !== "all") {
      userFilters.countryCode = country as string;
    }

    // Filter by verification status (document status)
    if (status && status !== "all") {
      where.verificationStatus = status as string;
    }

    // Apply user filters if any exist
    if (Object.keys(userFilters).length > 0) {
      where.user = userFilters;
    }

    const [restaurants, total] = await Promise.all([
      prisma.restaurantProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              countryCode: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.restaurantProfile.count({ where }),
    ]);

    const formatted = restaurants.map((restaurant) => ({
      id: restaurant.id,
      userId: restaurant.user.id,
      email: restaurant.user.email,
      restaurantName: restaurant.restaurantName,
      address: restaurant.address,
      countryCode: restaurant.user.countryCode,
      verificationStatus: restaurant.verificationStatus,
      isVerified: restaurant.isVerified,
      lastUpdated: restaurant.updatedAt,
    }));

    res.json({
      restaurants: formatted,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("List restaurants for document center error:", error);
    res.status(500).json({ error: "Failed to fetch restaurants" });
  }
});

// ====================================================
// GET /api/admin/documents/drivers/:id/details
// Get detailed driver documents for review
// ====================================================
router.get("/documents/drivers/:id/details", checkPermission(Permission.MANAGE_DOCUMENT_REVIEW), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const driver = await prisma.driverProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
          },
        },
        vehicles: true,
        vehicleDocuments: true,
      },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    const kycValidation = await validateDriverKYC(driver, driver.user.countryCode);
    const primaryVehicle = driver.vehicles?.find((v: any) => v.isPrimary) || driver.vehicles?.[0];

    res.json({
      id: driver.id,
      userId: driver.user.id,
      email: driver.user.email,
      countryCode: driver.user.countryCode,
      verificationStatus: driver.verificationStatus,
      isVerified: driver.isVerified,
      rejectionReason: driver.rejectionReason,
      
      // Profile photo
      profilePhotoUrl: driver.profilePhotoUrl,
      
      // Bangladesh fields
      fullName: driver.fullName,
      fatherName: driver.fatherName,
      phoneNumber: driver.phoneNumber,
      village: driver.village,
      postOffice: driver.postOffice,
      postalCode: driver.postalCode,
      thana: driver.thana,
      district: driver.district,
      nidFrontImageUrl: driver.nidFrontImageUrl,
      nidBackImageUrl: driver.nidBackImageUrl,
      
      // US fields - Identity
      firstName: driver.firstName,
      middleName: driver.middleName,
      lastName: driver.lastName,
      usaFullLegalName: driver.usaFullLegalName,
      dateOfBirth: driver.dateOfBirth,
      usaPhoneNumber: driver.usaPhoneNumber,
      ssnMasked: driver.ssnEncrypted ? maskSSN(decrypt(driver.ssnEncrypted)) : null,
      backgroundCheckStatus: driver.backgroundCheckStatus,
      backgroundCheckDate: driver.backgroundCheckDate,
      
      // US fields - Residential Address
      usaStreet: driver.usaStreet,
      usaCity: driver.usaCity,
      usaState: driver.usaState,
      usaZipCode: driver.usaZipCode,
      
      // US fields - Emergency Contact
      emergencyContactName: driver.emergencyContactName,
      emergencyContactPhone: driver.emergencyContactPhone,
      emergencyContactRelationship: driver.emergencyContactRelationship,
      
      // US fields - DMV License (all states)
      dmvLicenseFrontUrl: driver.dmvLicenseFrontUrl,
      dmvLicenseBackUrl: driver.dmvLicenseBackUrl,
      dmvLicenseExpiry: driver.dmvLicenseExpiry,
      dmvLicenseNumber: driver.dmvLicenseNumber,
      dmvLicenseImageUrl: driver.dmvLicenseImageUrl, // Legacy field
      
      // US fields - TLC License (NY only)
      tlcLicenseFrontUrl: driver.tlcLicenseFrontUrl,
      tlcLicenseBackUrl: driver.tlcLicenseBackUrl,
      tlcLicenseExpiry: driver.tlcLicenseExpiry,
      tlcLicenseNumber: driver.tlcLicenseNumber,
      tlcLicenseImageUrl: driver.tlcLicenseImageUrl, // Legacy field
      
      // Vehicle documents (legacy)
      vehicleDocuments: driver.vehicleDocuments.map(doc => ({
        id: doc.id,
        documentType: doc.documentType,
        fileUrl: doc.fileUrl,
        description: doc.description,
        uploadedAt: doc.uploadedAt,
        expiresAt: doc.expiresAt,
      })),
      
      // Vehicle information (new fields)
      vehicle: primaryVehicle ? {
        id: primaryVehicle.id,
        vehicleType: primaryVehicle.vehicleType,
        make: primaryVehicle.make,
        model: primaryVehicle.model,
        year: primaryVehicle.year,
        color: primaryVehicle.color,
        licensePlate: primaryVehicle.licensePlate,
        registrationDocumentUrl: primaryVehicle.registrationDocumentUrl,
        registrationExpiry: primaryVehicle.registrationExpiry,
        insuranceDocumentUrl: primaryVehicle.insuranceDocumentUrl,
        insuranceExpiry: primaryVehicle.insuranceExpiry,
      } : null,
      
      // Validation
      isComplete: kycValidation.isComplete,
      missingFields: kycValidation.missingFields,
      
      lastUpdated: driver.updatedAt,
    });
  } catch (error) {
    console.error("Get driver document details error:", error);
    res.status(500).json({ error: "Failed to fetch driver details" });
  }
});

// ====================================================
// GET /api/admin/documents/customers/:id/details
// Get detailed customer documents for review
// ====================================================
router.get("/documents/customers/:id/details", checkPermission(Permission.MANAGE_DOCUMENT_REVIEW), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customerProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
          },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json({
      id: customer.id,
      userId: customer.user.id,
      email: customer.user.email,
      countryCode: customer.user.countryCode,
      verificationStatus: customer.verificationStatus,
      isVerified: customer.isVerified,
      rejectionReason: customer.rejectionReason,
      
      // Bangladesh fields
      fullName: customer.fullName,
      fatherName: customer.fatherName,
      phoneNumber: customer.phoneNumber,
      village: customer.village,
      postOffice: customer.postOffice,
      postalCode: customer.postalCode,
      thana: customer.thana,
      district: customer.district,
      nidFrontImageUrl: customer.nidFrontImageUrl,
      nidBackImageUrl: customer.nidBackImageUrl,
      
      lastUpdated: customer.updatedAt,
    });
  } catch (error) {
    console.error("Get customer document details error:", error);
    res.status(500).json({ error: "Failed to fetch customer details" });
  }
});

// ====================================================
// GET /api/admin/documents/restaurants/:id/details
// Get detailed restaurant documents for review
// ====================================================
router.get("/documents/restaurants/:id/details", checkPermission(Permission.MANAGE_DOCUMENT_REVIEW), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
          },
        },
      },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    res.json({
      id: restaurant.id,
      userId: restaurant.user.id,
      email: restaurant.user.email,
      restaurantName: restaurant.restaurantName,
      address: restaurant.address,
      countryCode: restaurant.user.countryCode,
      verificationStatus: restaurant.verificationStatus,
      isVerified: restaurant.isVerified,
      rejectionReason: restaurant.rejectionReason,
      lastUpdated: restaurant.updatedAt,
    });
  } catch (error) {
    console.error("Get restaurant document details error:", error);
    res.status(500).json({ error: "Failed to fetch restaurant details" });
  }
});

// ====================================================
// D7: GET /api/admin/documents/drivers/:id/summary
// Get driver document summary with individual status tracking
// ====================================================
router.get("/documents/drivers/:id/summary", checkPermission(Permission.MANAGE_DOCUMENT_REVIEW), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { getDriverDocumentSummary } = await import("../services/driverDocumentService");
    
    const summary = await getDriverDocumentSummary(id);
    
    if (!summary) {
      return res.status(404).json({ success: false, error: "Driver not found" });
    }

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error("Get driver document summary error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch document summary" });
  }
});

// ====================================================
// D7: POST /api/admin/documents/drivers/:id/status
// Update individual document status
// ====================================================
router.post("/documents/drivers/:id/status", checkPermission(Permission.MANAGE_DRIVER_KYC), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { documentType, status, rejectionReason } = req.body;
    const adminId = req.user!.userId;

    if (!documentType || !status) {
      return res.status(400).json({ 
        success: false, 
        error: "documentType and status are required" 
      });
    }

    const validStatuses = ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "NEEDS_UPDATE"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` 
      });
    }

    if (status === "REJECTED" && !rejectionReason) {
      return res.status(400).json({ 
        success: false, 
        error: "Rejection reason is required when rejecting a document" 
      });
    }

    const { updateDocumentStatus } = await import("../services/driverDocumentService");
    const result = await updateDocumentStatus(id, documentType, status, adminId, rejectionReason);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ 
      success: true, 
      message: `${documentType.replace(/_/g, " ")} status updated to ${status}` 
    });
  } catch (error) {
    console.error("Update document status error:", error);
    res.status(500).json({ success: false, error: "Failed to update document status" });
  }
});

// ====================================================
// D7: POST /api/admin/documents/drivers/:id/approve-all
// Approve all uploaded documents for a driver
// ====================================================
router.post("/documents/drivers/:id/approve-all", checkPermission(Permission.MANAGE_DRIVER_KYC), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.userId;

    const { approveAllDocuments } = await import("../services/driverDocumentService");
    const result = await approveAllDocuments(id, adminId);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ 
      success: true, 
      message: "All driver documents approved successfully" 
    });
  } catch (error) {
    console.error("Approve all documents error:", error);
    res.status(500).json({ success: false, error: "Failed to approve documents" });
  }
});

// ====================================================
// POST /api/admin/documents/drivers/:id/approve
// Approve driver documents
// ====================================================
router.post("/documents/drivers/:id/approve", checkPermission(Permission.MANAGE_DRIVER_KYC), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const driver = await prisma.driverProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
        vehicles: true,
        vehicleDocuments: true,
      },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Check if all required documents are present
    const kycValidation = await validateDriverKYC(driver, driver.user.countryCode);

    if (!kycValidation.isComplete) {
      return res.status(400).json({
        error: "Cannot approve: missing required documents",
        missingFields: kycValidation.missingFields,
      });
    }

    // Update verification status
    const updated = await prisma.driverProfile.update({
      where: { id },
      data: {
        verificationStatus: "approved",
        isVerified: true,
        rejectionReason: null,
      },
    });

    res.json({
      message: "Driver documents approved successfully",
      verificationStatus: updated.verificationStatus,
      isVerified: updated.isVerified,
    });
  } catch (error) {
    console.error("Approve driver documents error:", error);
    res.status(500).json({ error: "Failed to approve driver documents" });
  }
});

// ====================================================
// POST /api/admin/documents/drivers/:id/reject
// Reject driver documents
// ====================================================
router.post("/documents/drivers/:id/reject", checkPermission(Permission.MANAGE_DRIVER_KYC), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const driver = await prisma.driverProfile.findUnique({
      where: { id },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Update verification status
    const updated = await prisma.driverProfile.update({
      where: { id },
      data: {
        verificationStatus: "rejected",
        isVerified: false,
        rejectionReason: reason || "Documents rejected by admin",
      },
    });

    res.json({
      message: "Driver documents rejected",
      verificationStatus: updated.verificationStatus,
      isVerified: updated.isVerified,
    });
  } catch (error) {
    console.error("Reject driver documents error:", error);
    res.status(500).json({ error: "Failed to reject driver documents" });
  }
});

// ====================================================
// POST /api/admin/documents/customers/:id/approve
// Approve customer documents
// ====================================================
router.post("/documents/customers/:id/approve", checkPermission(Permission.MANAGE_CUSTOMER_KYC), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customerProfile.findUnique({
      where: { id },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Update verification status
    const updated = await prisma.customerProfile.update({
      where: { id },
      data: {
        verificationStatus: "approved",
        isVerified: true,
        rejectionReason: null,
      },
    });

    res.json({
      message: "Customer documents approved successfully",
      verificationStatus: updated.verificationStatus,
      isVerified: updated.isVerified,
    });
  } catch (error) {
    console.error("Approve customer documents error:", error);
    res.status(500).json({ error: "Failed to approve customer documents" });
  }
});

// ====================================================
// POST /api/admin/documents/customers/:id/reject
// Reject customer documents
// ====================================================
router.post("/documents/customers/:id/reject", checkPermission(Permission.MANAGE_CUSTOMER_KYC), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const customer = await prisma.customerProfile.findUnique({
      where: { id },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Update verification status
    const updated = await prisma.customerProfile.update({
      where: { id },
      data: {
        verificationStatus: "rejected",
        isVerified: false,
        rejectionReason: reason || "Documents rejected by admin",
      },
    });

    res.json({
      message: "Customer documents rejected",
      verificationStatus: updated.verificationStatus,
      isVerified: updated.isVerified,
    });
  } catch (error) {
    console.error("Reject customer documents error:", error);
    res.status(500).json({ error: "Failed to reject customer documents" });
  }
});

// ====================================================
// POST /api/admin/documents/restaurants/:id/approve
// Approve restaurant documents
// ====================================================
router.post("/documents/restaurants/:id/approve", checkPermission(Permission.MANAGE_RESTAURANT_KYC), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Update verification status
    const updated = await prisma.restaurantProfile.update({
      where: { id },
      data: {
        verificationStatus: "approved",
        isVerified: true,
        rejectionReason: null,
      },
    });

    res.json({
      message: "Restaurant documents approved successfully",
      verificationStatus: updated.verificationStatus,
      isVerified: updated.isVerified,
    });
  } catch (error) {
    console.error("Approve restaurant documents error:", error);
    res.status(500).json({ error: "Failed to approve restaurant documents" });
  }
});

// ====================================================
// POST /api/admin/documents/restaurants/:id/reject
// Reject restaurant documents
// ====================================================
router.post("/documents/restaurants/:id/reject", checkPermission(Permission.MANAGE_RESTAURANT_KYC), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Update verification status
    const updated = await prisma.restaurantProfile.update({
      where: { id },
      data: {
        verificationStatus: "rejected",
        isVerified: false,
        rejectionReason: reason || "Documents rejected by admin",
      },
    });

    res.json({
      message: "Restaurant documents rejected",
      verificationStatus: updated.verificationStatus,
      isVerified: updated.isVerified,
    });
  } catch (error) {
    console.error("Reject restaurant documents error:", error);
    res.status(500).json({ error: "Failed to reject restaurant documents" });
  }
});

// ====================================================
// GET /api/admin/restaurants/commission-summary
// Get restaurant commission summary with filters (efficient aggregation)
// ====================================================
router.get("/restaurants/commission-summary", checkPermission(Permission.VIEW_COMMISSION_ANALYTICS), async (req: AuthRequest, res) => {
  try {
    const { country, dateRange } = req.query;
    
    // Calculate date filter
    let dateFilter: any = undefined;
    if (dateRange === "7days") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      dateFilter = { gte: sevenDaysAgo };
    } else if (dateRange === "30days") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = { gte: thirtyDaysAgo };
    }

    // Build where clause for restaurants
    const restaurantWhere: any = {};
    if (country && country !== "all") {
      restaurantWhere.user = {
        countryCode: country,
      };
    }

    // Get all restaurants with their wallet info in a single query
    const restaurants = await prisma.restaurantProfile.findMany({
      where: restaurantWhere,
      include: {
        user: {
          select: {
            countryCode: true,
            email: true,
          },
        },
        restaurantWallet: {
          select: {
            balance: true,
            negativeBalance: true,
          },
        },
      },
    });

    // Get all food orders in a single aggregation query grouped by restaurant
    const ordersWhere: any = {
      status: "delivered",
      ...(dateFilter && { createdAt: dateFilter }),
    };

    if (country && country !== "all") {
      // Filter by restaurant country
      ordersWhere.restaurant = {
        user: {
          countryCode: country,
        },
      };
    }

    const orderStats = await prisma.foodOrder.groupBy({
      by: ['restaurantId'],
      where: ordersWhere,
      _sum: {
        serviceFare: true,
        restaurantPayout: true,
        safegoCommission: true,
      },
      _count: {
        id: true,
      },
    });

    // Create a map of restaurant order stats for quick lookup
    const orderStatsMap = new Map(
      orderStats.map(stat => [
        stat.restaurantId,
        {
          count: stat._count.id || 0,
          earnings: Number(stat._sum.restaurantPayout || 0),
          commission: Number(stat._sum.safegoCommission || 0),
        }
      ])
    );

    // Combine restaurant data with order stats
    const restaurantSummaries = restaurants.map(restaurant => {
      const stats = orderStatsMap.get(restaurant.id) || { count: 0, earnings: 0, commission: 0 };
      const walletBalance = Number(restaurant.restaurantWallet?.balance || 0);
      const negativeBalance = Number(restaurant.restaurantWallet?.negativeBalance || 0);

      // Commission Paid = Total Commission - Negative Balance (pending)
      const commissionPaid = Math.max(0, stats.commission - negativeBalance);
      const commissionPending = negativeBalance;

      return {
        restaurantId: restaurant.id,
        restaurantName: restaurant.restaurantName,
        email: restaurant.user.email,
        countryCode: restaurant.user.countryCode,
        totalOrders: stats.count,
        totalEarnings: stats.earnings,
        totalCommission: stats.commission,
        commissionPaid,
        commissionPending,
        walletBalance,
      };
    });

    res.json({ restaurants: restaurantSummaries });
  } catch (error) {
    console.error("Restaurant commission summary error:", error);
    res.status(500).json({ error: "Failed to fetch restaurant commission summary" });
  }
});

// ====================================================
// GET /api/admin/parcels/commission-summary  
// Get parcel commission summary with filters
// ====================================================
router.get("/parcels/commission-summary", checkPermission(Permission.VIEW_COMMISSION_ANALYTICS), async (req: AuthRequest, res) => {
  try {
    const { country, dateRange } = req.query;
    
    // Calculate date filter
    let dateFilter: any = undefined;
    if (dateRange === "7days") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      dateFilter = { gte: sevenDaysAgo };
    } else if (dateRange === "30days") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = { gte: thirtyDaysAgo };
    }

    // Get all completed deliveries
    const deliveryWhere: any = {
      status: "delivered",
      ...(dateFilter && { createdAt: dateFilter }),
    };

    // If country filter is specified, join with customer to filter by country
    let deliveries;
    if (country && country !== "all") {
      deliveries = await prisma.delivery.findMany({
        where: deliveryWhere,
        include: {
          customer: {
            include: {
              user: {
                select: {
                  countryCode: true,
                },
              },
            },
          },
        },
      });
      
      // Filter by country code
      deliveries = deliveries.filter(d => d.customer.user?.countryCode === country);
    } else {
      deliveries = await prisma.delivery.findMany({
        where: deliveryWhere,
        include: {
          customer: {
            include: {
              user: {
                select: {
                  countryCode: true,
                },
              },
            },
          },
        },
      });
    }

    // Calculate aggregates
    const totalParcels = deliveries.length;
    const totalParcelRevenue = deliveries.reduce(
      (sum, d) => sum + Number(d.serviceFare), 
      0
    );
    const totalParcelCommission = deliveries.reduce(
      (sum, d) => sum + Number(d.safegoCommission), 
      0
    );

    // For "commission collected", we need to check driver wallets
    // The negative balance represents commission not yet collected
    const driverIds = [...new Set(deliveries.map(d => d.driverId).filter(Boolean))];
    const driverWallets = await prisma.driverWallet.findMany({
      where: {
        driverId: {
          in: driverIds as string[],
        },
      },
      select: {
        negativeBalance: true,
      },
    });

    // Sum up all negative balances from these drivers
    // Note: This is an approximation as drivers might have negative balances from rides/food too
    // For a more accurate calculation, we'd need a transaction ledger system
    const totalNegativeBalance = driverWallets.reduce(
      (sum, w) => sum + Number(w.negativeBalance),
      0
    );

    // Commission collected = total commission - pending (approximation)
    const commissionCollected = Math.max(0, totalParcelCommission - totalNegativeBalance);
    const commissionPending = Math.min(totalNegativeBalance, totalParcelCommission);

    // Group by country
    const byCountry: Record<string, { parcels: number; revenue: number; commission: number }> = {};
    deliveries.forEach(d => {
      const countryCode = d.customer.user?.countryCode || "UNKNOWN";
      if (!byCountry[countryCode]) {
        byCountry[countryCode] = { parcels: 0, revenue: 0, commission: 0 };
      }
      byCountry[countryCode].parcels += 1;
      byCountry[countryCode].revenue += Number(d.serviceFare);
      byCountry[countryCode].commission += Number(d.safegoCommission);
    });

    res.json({
      summary: {
        totalParcels,
        totalParcelRevenue,
        totalParcelCommission,
        commissionCollected,
        commissionPending,
      },
      byCountry,
    });
  } catch (error) {
    console.error("Parcel commission summary error:", error);
    res.status(500).json({ error: "Failed to fetch parcel commission summary" });
  }
});

// ====================================================
// GET /api/admin/audit-summary/:userId
// Get lightweight audit event summary for a user (for profile indicators)
// ====================================================
router.get("/audit-summary/:userId", checkPermission(Permission.VIEW_ACTIVITY_LOG), async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;

    // Count security-relevant audit events for this user
    const [failedLogins, suspiciousActivity, documentRejections, accountSuspensions] = await Promise.all([
      // Failed login attempts in the last 30 days
      prisma.auditLog.count({
        where: {
          entityId: userId,
          actionType: ActionType.LOGIN_FAILED,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      // Suspicious activity (failed actions, unauthorized access)
      prisma.auditLog.count({
        where: {
          entityId: userId,
          success: false,
          actionType: { in: [ActionType.UPDATE_USER, ActionType.MANAGE_DRIVER_KYC, ActionType.UPDATE_WALLET] },
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      // Document rejections
      prisma.auditLog.count({
        where: {
          entityId: userId,
          actionType: ActionType.MANAGE_DRIVER_KYC,
          description: { contains: "rejected" },
          createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
      }),
      // Account suspensions
      prisma.auditLog.count({
        where: {
          entityId: userId,
          actionType: ActionType.SUSPEND_USER,
          createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const totalEvents = failedLogins + suspiciousActivity + documentRejections + accountSuspensions;
    const hasAuditEvents = totalEvents > 0;

    res.json({
      hasAuditEvents,
      eventCount: totalEvents,
      breakdown: {
        failedLogins,
        suspiciousActivity,
        documentRejections,
        accountSuspensions,
      },
    });
  } catch (error) {
    console.error("Audit summary error:", error);
    res.status(500).json({ error: "Failed to fetch audit summary" });
  }
});

// ====================================================
// GET /api/admin/audit-logs
// Fetch audit logs with pagination and filters
// ====================================================
router.get("/audit-logs", checkPermission(Permission.VIEW_ACTIVITY_LOG), async (req: AuthRequest, res) => {
  try {
    const {
      page = "1",
      pageSize = "50",
      actorEmail,
      actionType,
      entityType,
      dateFrom,
      dateTo,
      success,
    } = req.query;

    // Parse pagination params
    const pageNum = Math.max(1, parseInt(page as string));
    const limit = Math.min(100, Math.max(1, parseInt(pageSize as string))); // Max 100 per page
    const skip = (pageNum - 1) * limit;

    // Build where clause
    const where: any = {};

    if (actorEmail) {
      where.actorEmail = {
        contains: actorEmail as string,
        mode: "insensitive",
      };
    }

    if (actionType) {
      where.actionType = actionType as string;
    }

    if (entityType) {
      where.entityType = entityType as string;
    }

    if (success !== undefined) {
      where.success = success === "true";
    }

    // Date range filters
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo as string);
      }
    }

    // Fetch logs with pagination
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        pageSize: limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Fetch audit logs error:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

// ====================================================
// GET /api/admin/notifications
// Fetch admin notifications with pagination and filters
// ====================================================
router.get("/notifications", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const {
      page = "1",
      pageSize = "20",
      type,
      severity,
      isRead,
      countryCode,
      entityType,
      dateFrom,
      dateTo,
    } = req.query;

    // Parse pagination params
    const pageNum = Math.max(1, parseInt(page as string));
    const limit = Math.min(100, Math.max(1, parseInt(pageSize as string))); // Max 100 per page
    const skip = (pageNum - 1) * limit;

    // Build where clause
    const where: any = {};

    if (type) {
      where.type = type as string;
    }

    if (severity) {
      where.severity = severity as string;
    }

    if (isRead !== undefined) {
      where.isRead = isRead === "true";
    }

    if (countryCode) {
      where.countryCode = countryCode as string;
    }

    if (entityType) {
      where.entityType = entityType as string;
    }

    // Date range filters
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo as string);
      }
    }

    // Fetch notifications with pagination
    const [notifications, total] = await Promise.all([
      prisma.adminNotification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.adminNotification.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      notifications,
      pagination: {
        page: pageNum,
        pageSize: limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// ====================================================
// GET /api/admin/notifications/unread-count
// Get count of unread notifications for navbar badge
// ====================================================
router.get("/notifications/unread-count", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const count = await prisma.adminNotification.count({
      where: { isRead: false },
    });

    res.json({ count });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

// ====================================================
// PATCH /api/admin/notifications/:id/read
// Mark a single notification as read
// ====================================================
router.patch("/notifications/:id/read", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const notification = await prisma.adminNotification.findUnique({
      where: { id },
    });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    const updated = await prisma.adminNotification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({ 
      message: "Notification marked as read",
      notification: updated,
    });
  } catch (error) {
    console.error("Mark notification as read error:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

// ====================================================
// PATCH /api/admin/notifications/read-all
// Mark all notifications as read
// ====================================================
router.patch("/notifications/read-all", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const result = await prisma.adminNotification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });

    res.json({ 
      message: "All notifications marked as read",
      count: result.count,
    });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
});

// ====================================================
// Global Settings Endpoints
// ====================================================
import { SettingsService, validateSettingsPayload } from "../utils/settings";
import { getEnvironmentConfig, getEnvironmentIndicator, getEnvironmentConfigSummary } from "../config/environmentConfig";

// ====================================================
// GET /api/admin/access-governance
// Get RBAC roles, permissions, and scope data for visualization
// ====================================================
router.get("/access-governance", checkPermission(Permission.VIEW_DASHBOARD), async (_req: AuthRequest, res) => {
  try {
    const { AdminRole, Permission: PermissionEnum, getRolePermissions, roleHierarchy, getRoleDescription } = await import("../utils/permissions");
    
    const roles = Object.values(AdminRole).map(role => {
      const permissions = getRolePermissions(role);
      const hierarchy = roleHierarchy[role as keyof typeof roleHierarchy] || { level: 0, canManage: [], scope: 'global' };
      
      return {
        id: role,
        name: role,
        displayName: role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: getRoleDescription ? getRoleDescription(role) : `${role} role`,
        level: hierarchy.level,
        scope: hierarchy.scope,
        canManage: hierarchy.canManage,
        permissions: Array.from(permissions),
        permissionCount: permissions.size,
      };
    });

    const allPermissions = Object.values(PermissionEnum);
    
    const permissionCategories = [
      { name: "Dashboard & Analytics", permissions: allPermissions.filter(p => p.includes('VIEW_DASHBOARD') || p.includes('ANALYTICS') || p.includes('MONITORING')) },
      { name: "User Management", permissions: allPermissions.filter(p => p.includes('USER') || p.includes('DRIVER') || p.includes('CUSTOMER') || p.includes('RESTAURANT')) },
      { name: "KYC & Compliance", permissions: allPermissions.filter(p => p.includes('KYC') || p.includes('DOCUMENT') || p.includes('IDENTITY') || p.includes('DUPLICATE')) },
      { name: "Support", permissions: allPermissions.filter(p => p.includes('SUPPORT') || p.includes('TICKET') || p.includes('DISPUTE')) },
      { name: "Finance & Payouts", permissions: allPermissions.filter(p => p.includes('PAYOUT') || p.includes('WALLET') || p.includes('COMMISSION') || p.includes('SETTLEMENT') || p.includes('REFUND')) },
      { name: "Security & Audit", permissions: allPermissions.filter(p => p.includes('AUDIT') || p.includes('SECURITY') || p.includes('ROLE') || p.includes('ADMIN') || p.includes('PERMISSION') || p.includes('EMERGENCY') || p.includes('IMPERSONATE')) },
      { name: "Operations", permissions: allPermissions.filter(p => p.includes('PARCEL') || p.includes('DISPATCH') || p.includes('LIVE_MAP') || p.includes('REALTIME')) },
      { name: "Risk & Safety", permissions: allPermissions.filter(p => p.includes('RISK') || p.includes('SAFETY') || p.includes('FRAUD') || p.includes('SUSPICIOUS')) },
      { name: "Communication", permissions: allPermissions.filter(p => p.includes('BROADCAST') || p.includes('NOTIFICATION') || p.includes('MESSAGE')) },
      { name: "Feature Management", permissions: allPermissions.filter(p => p.includes('FEATURE') || p.includes('CONFIG') || p.includes('SETTING')) },
    ];

    const supportedCountries = await prisma.user.groupBy({
      by: ['country'],
      where: { country: { not: null } },
      _count: { id: true },
    });

    const adminsByRole = await prisma.adminProfile.groupBy({
      by: ['adminRole'],
      _count: { id: true },
    });

    const adminsByCountry = await prisma.adminProfile.groupBy({
      by: ['countryCode'],
      where: { countryCode: { not: null } },
      _count: { id: true },
    });

    res.json({
      roles: roles.sort((a, b) => a.level - b.level),
      allPermissions,
      permissionCategories,
      stats: {
        totalRoles: roles.length,
        totalPermissions: allPermissions.length,
        supportedCountries: supportedCountries.map(c => ({ code: c.country, userCount: c._count.id })),
        adminsByRole: adminsByRole.map(a => ({ role: a.adminRole, count: a._count.id })),
        adminsByCountry: adminsByCountry.map(a => ({ country: a.countryCode, count: a._count.id })),
      },
    });
  } catch (error) {
    console.error("Get access governance error:", error);
    res.status(500).json({ error: "Failed to fetch access governance data" });
  }
});

// ====================================================
// GET /api/admin/environment
// Get current environment configuration (for admin UI)
// ====================================================
router.get("/environment", checkPermission(Permission.VIEW_DASHBOARD), async (_req: AuthRequest, res) => {
  try {
    const config = getEnvironmentConfig();
    const indicator = getEnvironmentIndicator();
    const summary = getEnvironmentConfigSummary();
    
    res.json({
      name: config.name,
      displayName: config.displayName,
      indicator,
      isProduction: config.isProduction,
      isDevelopment: config.isDevelopment,
      isStaging: config.isStaging,
      features: config.features,
      limits: config.limits,
      summary,
    });
  } catch (error) {
    console.error("Get environment config error:", error);
    res.status(500).json({ error: "Failed to fetch environment configuration" });
  }
});

// ====================================================
// GET /api/admin/settings
// Get all platform settings
// ====================================================
router.get("/settings", checkPermission(Permission.VIEW_SETTINGS), async (req: AuthRequest, res) => {
  try {
    const settings = await SettingsService.getSettings();
    res.json(settings);
  } catch (error) {
    console.error("Get settings error:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// ====================================================
// PUT /api/admin/settings/:sectionKey
// Update specific settings section
// ====================================================
router.put("/settings/:sectionKey", checkPermission(Permission.EDIT_SETTINGS), async (req: AuthRequest, res) => {
  try {
    const { sectionKey } = req.params;
    const payload = req.body;

    // Validate section key
    if (!SettingsService.isValidSettingKey(sectionKey)) {
      return res.status(400).json({ 
        error: "Invalid section key",
        validKeys: ["general", "kyc", "commission", "settlement", "notifications", "security", "support", "welcomeMessage"],
      });
    }

    // Validate payload structure and types
    const validation = validateSettingsPayload(sectionKey as any, payload);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: "Invalid settings payload",
        details: validation.errors,
      });
    }

    // Update settings with validated payload
    const updated = await SettingsService.updateSection(
      sectionKey as any,
      validation.data!,
      req.user?.id
    );

    // Log audit event (with error handling)
    try {
      await logAuditEvent({
        actorId: req.user?.id || null,
        actorEmail: req.user?.email || "unknown",
        actorRole: req.user?.adminProfile?.adminRole || "unknown",
        ipAddress: getClientIp(req),
        actionType: ActionType.SETTINGS_UPDATED,
        entityType: EntityType.SETTINGS,
        entityId: sectionKey,
        description: `Updated ${sectionKey} settings`,
        metadata: {
          section: sectionKey,
          keys: Object.keys(payload),
        },
        success: true,
      });
    } catch (auditError) {
      // Log but don't fail the request
      console.error("Failed to log successful settings update:", auditError);
    }

    res.json({ 
      message: `${sectionKey} settings updated successfully`,
      settings: updated,
    });
  } catch (error: any) {
    console.error("Update settings error:", error);
    
    // Log failed audit event
    try {
      await logAuditEvent({
        actorId: req.user?.id || null,
        actorEmail: req.user?.email || "unknown",
        actorRole: req.user?.adminProfile?.adminRole || "unknown",
        ipAddress: getClientIp(req),
        actionType: ActionType.SETTINGS_UPDATED,
        entityType: EntityType.SETTINGS,
        entityId: req.params.sectionKey,
        description: `Failed to update ${req.params.sectionKey} settings`,
        metadata: { error: error.message },
        success: false,
      });
    } catch (auditError) {
      console.error("Failed to log audit event:", auditError);
    }
    
    res.status(500).json({ error: error.message || "Failed to update settings" });
  }
});

// ====================================================
// Payout Account Endpoints
// ====================================================
import * as payoutService from "../services/payoutService";

// ====================================================
// GET /api/admin/drivers/:driverId/payout-accounts
// List all payout accounts for a driver
// ====================================================
router.get("/drivers/:driverId/payout-accounts", checkPermission(Permission.MANAGE_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const { driverId } = req.params;

    const accounts = await payoutService.listPayoutAccounts("driver", driverId);
    res.json(accounts);
  } catch (error: any) {
    console.error("List driver payout accounts error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch payout accounts" });
  }
});

// ====================================================
// POST /api/admin/drivers/:driverId/payout-accounts
// Create a new payout account for a driver
// ====================================================
router.post("/drivers/:driverId/payout-accounts", checkPermission(Permission.MANAGE_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const { driverId } = req.params;

    const input = {
      ...req.body,
      ownerType: "driver" as const,
      ownerId: driverId,
    };

    const account = await payoutService.createPayoutAccount(input);

    await logAuditEvent({
      actorId: req.user?.id || null,
      actorEmail: req.user?.email || "unknown",
      actorRole: req.user?.adminProfile?.adminRole || "unknown",
      ipAddress: getClientIp(req),
      actionType: ActionType.PAYOUT_ACCOUNT_CREATED,
      entityType: EntityType.DRIVER,
      entityId: driverId,
      description: `Created payout account for driver ${driverId}`,
      metadata: {
        payoutAccountId: account.id,
        payoutType: account.payoutType,
        provider: account.provider,
        countryCode: account.countryCode,
        isDefault: account.isDefault,
      },
      success: true,
    });

    res.status(201).json(account);
  } catch (error: any) {
    console.error("Create driver payout account error:", error);

    try {
      await logAuditEvent({
        actorId: req.user?.id || null,
        actorEmail: req.user?.email || "unknown",
        actorRole: req.user?.adminProfile?.adminRole || "unknown",
        ipAddress: getClientIp(req),
        actionType: ActionType.PAYOUT_ACCOUNT_CREATED,
        entityType: EntityType.DRIVER,
        entityId: req.params.driverId,
        description: `Failed to create payout account for driver ${req.params.driverId}`,
        metadata: { error: error.message },
        success: false,
      });
    } catch (auditError) {
      console.error("Failed to log audit event:", auditError);
    }

    res.status(400).json({ error: error.message || "Failed to create payout account" });
  }
});

// ====================================================
// PATCH /api/admin/payout-accounts/:id
// Update a payout account
// ====================================================
router.patch("/payout-accounts/:id", checkPermission(Permission.MANAGE_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const account = await payoutService.updatePayoutAccount(id, req.body);

    await logAuditEvent({
      actorId: req.user?.id || null,
      actorEmail: req.user?.email || "unknown",
      actorRole: req.user?.adminProfile?.adminRole || "unknown",
      ipAddress: getClientIp(req),
      actionType: ActionType.PAYOUT_ACCOUNT_UPDATED,
      entityType: account.ownerType === "driver" ? EntityType.DRIVER : EntityType.RESTAURANT,
      entityId: account.ownerId,
      description: `Updated payout account ${id}`,
      metadata: {
        payoutAccountId: id,
        status: account.status,
        isDefault: account.isDefault,
      },
      success: true,
    });

    res.json(account);
  } catch (error: any) {
    console.error("Update payout account error:", error);

    try {
      await logAuditEvent({
        actorId: req.user?.id || null,
        actorEmail: req.user?.email || "unknown",
        actorRole: req.user?.adminProfile?.adminRole || "unknown",
        ipAddress: getClientIp(req),
        actionType: ActionType.PAYOUT_ACCOUNT_UPDATED,
        entityType: EntityType.DRIVER,
        entityId: req.params.id,
        description: `Failed to update payout account ${req.params.id}`,
        metadata: { error: error.message },
        success: false,
      });
    } catch (auditError) {
      console.error("Failed to log audit event:", auditError);
    }

    res.status(400).json({ error: error.message || "Failed to update payout account" });
  }
});

// ====================================================
// POST /api/admin/drivers/:driverId/payout-accounts/:id/set-default
// Set a payout account as default for a driver
// ====================================================
router.post("/drivers/:driverId/payout-accounts/:id/set-default", checkPermission(Permission.MANAGE_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const { driverId, id } = req.params;

    const account = await payoutService.setDefaultPayoutAccount("driver", driverId, id);

    await logAuditEvent({
      actorId: req.user?.id || null,
      actorEmail: req.user?.email || "unknown",
      actorRole: req.user?.adminProfile?.adminRole || "unknown",
      ipAddress: getClientIp(req),
      actionType: ActionType.PAYOUT_ACCOUNT_SET_DEFAULT,
      entityType: EntityType.DRIVER,
      entityId: driverId,
      description: `Set payout account ${id} as default for driver ${driverId}`,
      metadata: {
        payoutAccountId: id,
      },
      success: true,
    });

    res.json(account);
  } catch (error: any) {
    console.error("Set default payout account error:", error);
    res.status(400).json({ error: error.message || "Failed to set default payout account" });
  }
});

// ====================================================
// GET /api/admin/restaurants/:restaurantId/payout-accounts
// List all payout accounts for a restaurant
// ====================================================
router.get("/restaurants/:restaurantId/payout-accounts", checkPermission(Permission.MANAGE_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const { restaurantId } = req.params;

    const accounts = await payoutService.listPayoutAccounts("restaurant", restaurantId);
    res.json(accounts);
  } catch (error: any) {
    console.error("List restaurant payout accounts error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch payout accounts" });
  }
});

// ====================================================
// POST /api/admin/restaurants/:restaurantId/payout-accounts
// Create a new payout account for a restaurant
// ====================================================
router.post("/restaurants/:restaurantId/payout-accounts", checkPermission(Permission.MANAGE_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const { restaurantId } = req.params;

    const input = {
      ...req.body,
      ownerType: "restaurant" as const,
      ownerId: restaurantId,
    };

    const account = await payoutService.createPayoutAccount(input);

    await logAuditEvent({
      actorId: req.user?.id || null,
      actorEmail: req.user?.email || "unknown",
      actorRole: req.user?.adminProfile?.adminRole || "unknown",
      ipAddress: getClientIp(req),
      actionType: ActionType.PAYOUT_ACCOUNT_CREATED,
      entityType: EntityType.RESTAURANT,
      entityId: restaurantId,
      description: `Created payout account for restaurant ${restaurantId}`,
      metadata: {
        payoutAccountId: account.id,
        payoutType: account.payoutType,
        provider: account.provider,
        countryCode: account.countryCode,
        isDefault: account.isDefault,
      },
      success: true,
    });

    res.status(201).json(account);
  } catch (error: any) {
    console.error("Create restaurant payout account error:", error);

    try {
      await logAuditEvent({
        actorId: req.user?.id || null,
        actorEmail: req.user?.email || "unknown",
        actorRole: req.user?.adminProfile?.adminRole || "unknown",
        ipAddress: getClientIp(req),
        actionType: ActionType.PAYOUT_ACCOUNT_CREATED,
        entityType: EntityType.RESTAURANT,
        entityId: req.params.restaurantId,
        description: `Failed to create payout account for restaurant ${req.params.restaurantId}`,
        metadata: { error: error.message },
        success: false,
      });
    } catch (auditError) {
      console.error("Failed to log audit event:", auditError);
    }

    res.status(400).json({ error: error.message || "Failed to create payout account" });
  }
});

// ====================================================
// POST /api/admin/restaurants/:restaurantId/payout-accounts/:id/set-default
// Set a payout account as default for a restaurant
// ====================================================
router.post("/restaurants/:restaurantId/payout-accounts/:id/set-default", checkPermission(Permission.MANAGE_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const { restaurantId, id } = req.params;

    const account = await payoutService.setDefaultPayoutAccount("restaurant", restaurantId, id);

    await logAuditEvent({
      actorId: req.user?.id || null,
      actorEmail: req.user?.email || "unknown",
      actorRole: req.user?.adminProfile?.adminRole || "unknown",
      ipAddress: getClientIp(req),
      actionType: ActionType.PAYOUT_ACCOUNT_SET_DEFAULT,
      entityType: EntityType.RESTAURANT,
      entityId: restaurantId,
      description: `Set payout account ${id} as default for restaurant ${restaurantId}`,
      metadata: {
        payoutAccountId: id,
      },
      success: true,
    });

    res.json(account);
  } catch (error: any) {
    console.error("Set default payout account error:", error);
    res.status(400).json({ error: error.message || "Failed to set default payout account" });
  }
});

// ====================================================
// GET /api/admin/customers/:customerId/payment-methods
// List all payment methods for a customer (read-only)
// ====================================================
router.get("/customers/:customerId/payment-methods", checkPermission(Permission.VIEW_USER), async (req: AuthRequest, res) => {
  try {
    const { customerId } = req.params;

    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { customerId },
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });

    res.json(paymentMethods);
  } catch (error: any) {
    console.error("List payment methods error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch payment methods" });
  }
});

// ====================================================
// GET /api/admin/customers/:customerId/saved-places
// List all saved places for a customer (read-only)
// ====================================================
router.get("/customers/:customerId/saved-places", checkPermission(Permission.VIEW_USER), async (req: AuthRequest, res) => {
  try {
    const { customerId } = req.params;

    const customer = await prisma.customerProfile.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const savedPlaces = await prisma.customerSavedPlace.findMany({
      where: { customerId },
      orderBy: [
        { label: "asc" },
        { createdAt: "desc" },
      ],
    });

    res.json({
      savedPlaces: savedPlaces.map((place) => ({
        id: place.id,
        label: place.label,
        name: place.name,
        address: place.address,
        lat: Number(place.lat),
        lng: Number(place.lng),
        isDefaultPickup: place.isDefaultPickup,
        isDefaultDropoff: place.isDefaultDropoff,
        createdAt: place.createdAt,
        updatedAt: place.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error("List saved places error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch saved places" });
  }
});

// ====================================================
// GET /api/admin/customers/:customerId/ride-preferences
// Get ride preferences for a customer (read-only)
// ====================================================
router.get("/customers/:customerId/ride-preferences", checkPermission(Permission.VIEW_USER), async (req: AuthRequest, res) => {
  try {
    const { customerId } = req.params;

    const customer = await prisma.customerProfile.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const preferences = await prisma.customerRidePreferences.findUnique({
      where: { customerId },
    });

    if (!preferences) {
      return res.json({
        preferences: null,
        message: "No ride preferences set for this customer",
      });
    }

    res.json({
      preferences: {
        id: preferences.id,
        temperaturePreference: preferences.temperaturePreference,
        musicPreference: preferences.musicPreference,
        conversationLevel: preferences.conversationLevel,
        accessibilityNeeds: preferences.accessibilityNeeds,
        petFriendly: preferences.petFriendly,
        childSeatRequired: preferences.childSeatRequired,
        specialInstructions: preferences.specialInstructions,
        createdAt: preferences.createdAt,
        updatedAt: preferences.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Get ride preferences error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch ride preferences" });
  }
});

// ====================================================
// GET /api/admin/parcels/scheduled
// List all scheduled parcel pickups (admin view)
// ====================================================
router.get("/parcels/scheduled", checkPermission(Permission.VIEW_PARCELS), async (req: AuthRequest, res) => {
  try {
    const { status, countryCode, page = "1", pageSize = "20" } = req.query;
    
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const pageSizeNum = Math.min(Math.max(1, parseInt(pageSize as string) || 20), 100);
    const skip = (pageNum - 1) * pageSizeNum;

    const whereClause: any = {
      scheduledPickupTime: { not: null },
    };

    if (status) {
      whereClause.status = String(status);
    }

    if (countryCode) {
      whereClause.countryCode = String(countryCode).toUpperCase();
    }

    const [deliveries, total] = await Promise.all([
      prisma.delivery.findMany({
        where: whereClause,
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              user: {
                select: { email: true, phone: true },
              },
            },
          },
          driver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { scheduledPickupTime: "asc" },
        skip,
        take: pageSizeNum,
      }),
      prisma.delivery.count({ where: whereClause }),
    ]);

    res.json({
      scheduledParcels: deliveries.map((d) => ({
        id: d.id,
        status: d.status,
        pickupAddress: d.pickupAddress,
        dropoffAddress: d.dropoffAddress,
        scheduledPickupTime: d.scheduledPickupTime,
        fare: Number(d.serviceFare),
        paymentMethod: d.paymentMethod,
        customer: d.customer ? {
          id: d.customer.id,
          name: `${d.customer.firstName || ""} ${d.customer.lastName || ""}`.trim(),
          email: d.customer.user?.email,
          phone: d.customer.user?.phone,
        } : null,
        driver: d.driver ? {
          id: d.driver.id,
          name: `${d.driver.firstName || ""} ${d.driver.lastName || ""}`.trim(),
        } : null,
        createdAt: d.createdAt,
      })),
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total,
        totalPages: Math.ceil(total / pageSizeNum),
      },
    });
  } catch (error: any) {
    console.error("List scheduled parcels error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch scheduled parcels" });
  }
});

// ====================================================
// GET /api/admin/parcels/:deliveryId/proof-of-delivery
// View proof-of-delivery photos for a delivery (admin)
// ====================================================
router.get("/parcels/:deliveryId/proof-of-delivery", checkPermission(Permission.VIEW_PARCELS), async (req: AuthRequest, res) => {
  try {
    const { deliveryId } = req.params;

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        customer: {
          select: { firstName: true, lastName: true },
        },
        driver: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    const photos = await prisma.deliveryProofPhoto.findMany({
      where: { deliveryId },
      orderBy: { capturedAt: "asc" },
    });

    res.json({
      delivery: {
        id: delivery.id,
        status: delivery.status,
        pickupAddress: delivery.pickupAddress,
        dropoffAddress: delivery.dropoffAddress,
        customer: delivery.customer 
          ? `${delivery.customer.firstName || ""} ${delivery.customer.lastName || ""}`.trim()
          : null,
        driver: delivery.driver
          ? `${delivery.driver.firstName || ""} ${delivery.driver.lastName || ""}`.trim()
          : null,
      },
      photos: photos.map((p) => ({
        id: p.id,
        photoUrl: p.photoUrl,
        capturedAt: p.capturedAt,
        meta: p.meta,
      })),
    });
  } catch (error: any) {
    console.error("Get POD photos error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch proof of delivery photos" });
  }
});

// ====================================================
// Support Chat Admin Endpoints
// ====================================================
import * as supportService from "../services/supportService";

router.get("/support/conversations", checkPermission(Permission.VIEW_SUPPORT_CONVERSATIONS), async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as string | undefined;
    const userType = req.query.userType as string | undefined;
    const countryCode = req.query.countryCode as string | undefined;
    const assignedAdminId = req.query.assignedAdminId as string | undefined;
    const search = req.query.search as string | undefined;

    const result = await supportService.listConversations(
      {
        page,
        pageSize,
        status: status as any,
        userType: userType as any,
        countryCode: countryCode as any,
        assignedAdminId,
        search,
      },
      {
        userId: req.user!.id,
        userType: "admin",
        permissions: req.user!.permissions || [],
      }
    );

    res.json(result);
  } catch (error: any) {
    console.error("List support conversations error:", error);
    res.status(500).json({ error: error.message || "Failed to list conversations" });
  }
});

router.get("/support/conversations/:id", checkPermission(Permission.VIEW_SUPPORT_CONVERSATIONS), async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id;

    const conversation = await supportService.getConversation(
      conversationId,
      {
        userId: req.user!.id,
        userType: "admin",
        permissions: req.user!.permissions || [],
      },
      true
    );
    const userSummary = await supportService.getUserSummary(conversation.userId, conversation.userType);

    res.json({
      conversation,
      userSummary,
    });
  } catch (error: any) {
    console.error("Get support conversation error:", error);
    const statusCode = error.message?.includes("Unauthorized") ? 403 : 404;
    res.status(statusCode).json({ error: error.message || "Conversation not found" });
  }
});

router.post("/support/conversations/:id/messages", checkPermission(Permission.REPLY_SUPPORT_CONVERSATIONS), async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id;
    const { content } = req.body;
    const adminId = req.user!.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Message content is required" });
    }

    const message = await supportService.sendMessage(
      {
        conversationId,
        senderType: "admin",
        senderId: adminId,
        content,
      },
      {
        userId: adminId,
        userType: "admin",
        permissions: req.user!.permissions || [],
      }
    );

    await logAuditEvent({
      actorId: adminId,
      actorEmail: req.user!.email,
      actorRole: req.user!.adminProfile?.adminRole || "SUPER_ADMIN",
      actionType: ActionType.SUPPORT_MESSAGE_SENT,
      entityType: EntityType.SUPPORT_CONVERSATION,
      entityId: conversationId,
      description: `Admin replied to support conversation`,
      metadata: { messageId: message.id },
      success: true,
      ipAddress: getClientIp(req),
    });

    res.status(201).json(message);
  } catch (error: any) {
    console.error("Send support message error:", error);
    const statusCode = error.message?.includes("Unauthorized") ? 403 : 500;
    res.status(statusCode).json({ error: error.message || "Failed to send message" });
  }
});

router.patch("/support/conversations/:id", checkPermission(Permission.ASSIGN_SUPPORT_CONVERSATIONS), async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id;
    const { status, priority, assignedAdminId } = req.body;
    const adminId = req.user!.id;

    const conversation = await supportService.updateConversation(
      conversationId,
      {
        status,
        priority,
        assignedAdminId,
      },
      {
        userId: adminId,
        userType: "admin",
        permissions: req.user!.permissions || [],
      }
    );

    let actionType = ActionType.SUPPORT_CONVERSATION_UPDATED;
    let description = "Support conversation updated";

    if (status) {
      actionType = ActionType.SUPPORT_CONVERSATION_STATUS_CHANGED;
      description = `Support conversation status changed to ${status}`;
    } else if (assignedAdminId !== undefined) {
      actionType = ActionType.SUPPORT_CONVERSATION_ASSIGNED;
      description = assignedAdminId
        ? `Support conversation assigned to admin ${assignedAdminId}`
        : "Support conversation unassigned";
    }

    await logAuditEvent({
      actorId: adminId,
      actorEmail: req.user!.email,
      actorRole: req.user!.adminProfile?.adminRole || "SUPER_ADMIN",
      actionType,
      entityType: EntityType.SUPPORT_CONVERSATION,
      entityId: conversationId,
      description,
      metadata: { status, priority, assignedAdminId },
      success: true,
      ipAddress: getClientIp(req),
    });

    res.json(conversation);
  } catch (error: any) {
    console.error("Update support conversation error:", error);
    const statusCode = error.message?.includes("Unauthorized") ? 403 : 500;
    res.status(statusCode).json({ error: error.message || "Failed to update conversation" });
  }
});

// ====================================================
// WALLET MANAGEMENT API
// ====================================================

// Get wallet overview with filters - RBAC-aware
router.get("/wallets", checkPermission(Permission.VIEW_WALLET_SUMMARY), async (req: AuthRequest, res) => {
  try {
    const { walletType } = req.query;
    const adminProfile = req.user!.adminProfile;
    
    if (!adminProfile) {
      console.error("[Wallets API] No admin profile found for user:", req.user!.email);
      return res.status(403).json({ error: "Unauthorized: Admin profile required" });
    }

    const adminRole = adminProfile.adminRole;
    const adminContext = {
      adminRole,
      countryCode: adminProfile.countryCode || undefined,
      cityCode: adminProfile.cityCode || undefined,
      ownerType: walletType ? (walletType as "driver" | "customer" | "restaurant") : undefined,
    };

    console.log("[Wallets API] Fetching wallets with RBAC context:", {
      adminRole,
      countryCode: adminContext.countryCode,
      cityCode: adminContext.cityCode,
      ownerTypeFilter: adminContext.ownerType,
      adminEmail: req.user!.email,
    });

    const wallets = await walletService.listWalletsWithRBAC(adminContext);

    console.log("[Wallets API] RBAC filtering results:", {
      totalWallets: wallets.length,
      byOwnerType: {
        driver: wallets.filter(w => w.ownerType === 'driver').length,
        customer: wallets.filter(w => w.ownerType === 'customer').length,
        restaurant: wallets.filter(w => w.ownerType === 'restaurant').length,
      },
      adminRole,
    });

    res.json({
      wallets,
      total: wallets.length,
    });
  } catch (error: any) {
    console.error("[Wallets API] Error fetching wallets:", error);
    res.status(500).json({ error: error.message || "Failed to fetch wallets" });
  }
});

// Get specific wallet by ID
router.get("/wallets/:id", checkPermission(Permission.VIEW_WALLET_SUMMARY), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const wallet = await walletService.getWalletById(id);

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    res.json(wallet);
  } catch (error: any) {
    console.error("Get wallet error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch wallet" });
  }
});

// Get wallet transactions (ledger)
router.get("/wallets/:id/transactions", checkPermission(Permission.VIEW_WALLET_SUMMARY), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { page = "1", limit = "50", serviceType, direction, startDate, endDate } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const filters: any = { walletId: id };
    if (serviceType) filters.serviceType = serviceType;
    if (direction) filters.direction = direction;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const transactions = await walletService.listTransactions({
      ...filters,
      limit: limitNum,
      offset,
    });

    const total = await walletService.getTransactionCount(filters);

    res.json({
      transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error("Get wallet transactions error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch transactions" });
  }
});

// Process manual wallet settlement
router.post("/wallets/:id/settle", checkPermission(Permission.PROCESS_WALLET_SETTLEMENT), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;

    const result = await walletService.settleNegativeBalance(id, adminId);

    await logAuditEvent({
      actorId: adminId,
      actorEmail: req.user!.email,
      actorRole: req.user!.adminProfile?.adminRole || "SUPER_ADMIN",
      actionType: ActionType.WALLET_SETTLEMENT_PROCESSED,
      entityType: EntityType.WALLET,
      entityId: id,
      description: `Manual settlement of ${result.amountSettled} for wallet ${id}`,
      metadata: { amountSettled: result.amountSettled, remainingNegativeBalance: result.remainingNegativeBalance },
      success: true,
      ipAddress: getClientIp(req),
    });

    const updatedWallet = await walletService.getWalletById(id);
    res.json(updatedWallet);
  } catch (error: any) {
    console.error("Wallet settlement error:", error);
    res.status(400).json({ error: error.message || "Failed to process settlement" });
  }
});

// ====================================================
// DEPRECATED PAYOUT ROUTES - MOVED BELOW WITH RBAC
// ====================================================
// The payout routes are now implemented with proper RBAC filtering
// See PAYOUT MANAGEMENT API section below

// Update payout status (approve/reject) - DEPRECATED, use /approve or /reject endpoints below
router.patch("/payouts/:id/status", checkPermission(Permission.MANAGE_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status, failureReason, externalReferenceId } = req.body;
    const adminId = req.user!.id;

    if (!status || !["completed", "failed"].includes(status)) {
      return res.status(400).json({ error: "Status must be 'completed' or 'failed'" });
    }

    const updatedPayout = await walletPayoutService.updateWalletPayoutStatus({
      payoutId: id,
      status,
      failureReason,
      externalReferenceId,
      processedByAdminId: adminId,
    });

    await logAuditEvent({
      actorId: adminId,
      actorEmail: req.user!.email,
      actorRole: req.user!.adminProfile?.adminRole || "SUPER_ADMIN",
      actionType: ActionType.PAYOUT_STATUS_CHANGED,
      entityType: EntityType.PAYOUT,
      entityId: id,
      description: `Payout ${id} status changed to ${status}`,
      metadata: { status, failureReason, externalReferenceId },
      success: true,
      ipAddress: getClientIp(req),
    });

    res.json(updatedPayout);
  } catch (error: any) {
    console.error("Update payout status error:", error);
    res.status(400).json({ error: error.message || "Failed to update payout status" });
  }
});

// ====================================================
// PAYOUT BATCH MANAGEMENT API
// ====================================================

// Create a new payout batch
router.post("/payout-batches", checkPermission(Permission.PROCESS_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const { periodStart, periodEnd, ownerType, countryCode, minPayoutAmount } = req.body;
    const adminId = req.user!.id;

    if (!periodStart || !periodEnd) {
      return res.status(400).json({ error: "periodStart and periodEnd are required" });
    }

    const result = await walletPayoutService.createPayoutBatch({
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      ownerType: ownerType as "driver" | "restaurant" | undefined,
      countryCode,
      minPayoutAmount: minPayoutAmount ? parseFloat(minPayoutAmount) : undefined,
      createdByAdminId: adminId,
    });

    await logAuditEvent({
      actorId: adminId,
      actorEmail: req.user!.email,
      actorRole: req.user!.adminProfile?.adminRole || "SUPER_ADMIN",
      actionType: ActionType.PAYOUT_BATCH_CREATED,
      entityType: EntityType.PAYOUT,
      entityId: result.batch.id,
      description: `Created payout batch with ${result.payouts.length} payouts, total amount: ${result.batch.totalPayoutAmount}`,
      metadata: { 
        batchId: result.batch.id,
        payoutCount: result.payouts.length,
        totalAmount: result.batch.totalPayoutAmount,
        periodStart,
        periodEnd,
        ownerType,
        countryCode
      },
      success: true,
      ipAddress: getClientIp(req),
    });

    res.json(result);
  } catch (error: any) {
    console.error("Create payout batch error:", error);
    res.status(400).json({ error: error.message || "Failed to create payout batch" });
  }
});

// List all payout batches
router.get("/payout-batches", checkPermission(Permission.VIEW_PAYOUT_BATCHES), async (req: AuthRequest, res) => {
  try {
    const { status, page = "1", limit = "50", startDate, endDate } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const filters: any = {};
    if (status) filters.status = status as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const result = await walletPayoutService.listPayoutBatches({
      ...filters,
      limit: limitNum,
      offset,
    });

    res.json({
      batches: result.batches,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
      },
    });
  } catch (error: any) {
    console.error("List payout batches error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch payout batches" });
  }
});

// Get specific batch by ID
router.get("/payout-batches/:id", checkPermission(Permission.VIEW_PAYOUT_BATCHES), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const batch = await walletPayoutService.getPayoutBatch(id);

    if (!batch) {
      return res.status(404).json({ error: "Payout batch not found" });
    }

    res.json(batch);
  } catch (error: any) {
    console.error("Get payout batch error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch payout batch" });
  }
});

// Process a payout batch
router.post("/payout-batches/:id/process", checkPermission(Permission.PROCESS_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;

    const result = await walletPayoutService.processPayoutBatch(id, adminId);

    await logAuditEvent({
      actorId: adminId,
      actorEmail: req.user!.email,
      actorRole: req.user!.adminProfile?.adminRole || "SUPER_ADMIN",
      actionType: ActionType.PAYOUT_BATCH_PROCESSED,
      entityType: EntityType.PAYOUT,
      entityId: id,
      description: `Processed payout batch ${id}: ${result.completedCount} completed, ${result.failedCount} failed`,
      metadata: { 
        batchId: id,
        status: result.status,
        completedCount: result.completedCount,
        failedCount: result.failedCount
      },
      success: true,
      ipAddress: getClientIp(req),
    });

    res.json(result);
  } catch (error: any) {
    console.error("Process payout batch error:", error);
    res.status(400).json({ error: error.message || "Failed to process payout batch" });
  }
});

// ====================================================
// COMMISSION ANALYTICS API
// ====================================================

// Get commission analytics with aggregations
router.get("/earnings/analytics", checkPermission(Permission.VIEW_COMMISSION_ANALYTICS), async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, groupBy = "day", countryCode, ownerType } = req.query;

    const filters: any = {};
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    if (countryCode) filters.countryCode = countryCode as string;
    if (ownerType) filters.ownerType = ownerType as "driver" | "restaurant";

    const analytics = await walletService.getCommissionAnalytics({
      ...filters,
      groupBy: groupBy as "day" | "week" | "month",
    });

    res.json(analytics);
  } catch (error: any) {
    console.error("Get commission analytics error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch commission analytics" });
  }
});

// Get earnings summary
router.get("/earnings/summary", checkPermission(Permission.VIEW_COMMISSION_ANALYTICS), async (req: AuthRequest, res) => {
  try {
    const { countryCode, ownerType } = req.query;

    const filters: any = {};
    if (countryCode) filters.countryCode = countryCode as string;
    if (ownerType) filters.ownerType = ownerType as "driver" | "restaurant";

    const summary = await walletService.getEarningsSummary(filters);

    res.json(summary);
  } catch (error: any) {
    console.error("Get earnings summary error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch earnings summary" });
  }
});

// ====================================================
// WALLET MANAGEMENT API
// ====================================================

// Get all wallets with filters
router.get("/wallets", checkPermission(Permission.VIEW_WALLET_SUMMARY), async (req: AuthRequest, res) => {
  try {
    const { walletType, country } = req.query;

    const where: any = {};
    if (walletType && walletType !== "all") {
      where.ownerType = walletType as string;
    }
    if (country && country !== "all") {
      where.countryCode = country as string;
    }

    const wallets = await prisma.wallet.findMany({
      where,
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Enrich with owner information
    const enrichedWallets = await Promise.all(
      wallets.map(async (wallet) => {
        let owner: any = { email: "Unknown", countryCode: wallet.countryCode };

        if (wallet.ownerType === "driver") {
          const driver = await prisma.driverProfile.findFirst({
            where: { id: wallet.ownerId },
            include: { user: true },
          });
          if (driver) {
            owner = {
              email: driver.user.email,
              countryCode: driver.user.countryCode,
              fullName: driver.fullName || `${driver.firstName || ""} ${driver.lastName || ""}`.trim(),
            };
          }
        } else if (wallet.ownerType === "restaurant") {
          const restaurant = await prisma.restaurantProfile.findFirst({
            where: { id: wallet.ownerId },
            include: { user: true },
          });
          if (restaurant) {
            owner = {
              email: restaurant.user.email,
              countryCode: restaurant.user.countryCode,
              restaurantName: restaurant.restaurantName,
            };
          }
        }

        return {
          id: wallet.id,
          walletType: wallet.ownerType,
          driverId: wallet.ownerType === "driver" ? wallet.ownerId : null,
          restaurantId: wallet.ownerType === "restaurant" ? wallet.ownerId : null,
          currency: wallet.currency,
          availableBalance: wallet.availableBalance.toString(),
          negativeBalance: wallet.negativeBalance.toString(),
          lastTransactionDate: wallet.transactions[0]?.createdAt || null,
          createdAt: wallet.createdAt,
          owner,
        };
      })
    );

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.VIEW_WALLET_SUMMARY,
      entityType: EntityType.WALLET,
      description: `Viewed wallets list`,
      metadata: { filters: { walletType, country }, total: enrichedWallets.length },
    });

    res.json({ wallets: enrichedWallets, total: enrichedWallets.length });
  } catch (error: any) {
    console.error("Get wallets error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch wallets" });
  }
});

// Get wallet details by ID
router.get("/wallets/:id", checkPermission(Permission.VIEW_WALLET_SUMMARY), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const wallet = await prisma.wallet.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        payouts: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Get owner information
    let owner: any = { email: "Unknown", countryCode: wallet.countryCode };

    if (wallet.ownerType === "driver") {
      const driver = await prisma.driverProfile.findFirst({
        where: { id: wallet.ownerId },
        include: { user: true },
      });
      if (driver) {
        owner = {
          email: driver.user.email,
          countryCode: driver.user.countryCode,
          fullName: driver.fullName || `${driver.firstName || ""} ${driver.lastName || ""}`.trim(),
        };
      }
    } else if (wallet.ownerType === "restaurant") {
      const restaurant = await prisma.restaurantProfile.findFirst({
        where: { id: wallet.ownerId },
        include: { user: true },
      });
      if (restaurant) {
        owner = {
          email: restaurant.user.email,
          countryCode: restaurant.user.countryCode,
          restaurantName: restaurant.restaurantName,
        };
      }
    }

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.VIEW_WALLET_DETAILS,
      entityType: EntityType.WALLET,
      entityId: id,
      description: `Viewed wallet details for ${wallet.ownerType}`,
      metadata: { walletId: id, ownerType: wallet.ownerType, ownerId: wallet.ownerId },
    });

    res.json({
      ...wallet,
      availableBalance: wallet.availableBalance.toString(),
      negativeBalance: wallet.negativeBalance.toString(),
      owner,
      transactions: wallet.transactions.map(t => ({
        ...t,
        amount: t.amount.toString(),
        balanceSnapshot: t.balanceSnapshot.toString(),
        negativeBalanceSnapshot: t.negativeBalanceSnapshot.toString(),
      })),
      payouts: wallet.payouts.map(p => ({
        ...p,
        amount: p.amount.toString(),
      })),
    });
  } catch (error: any) {
    console.error("Get wallet details error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch wallet details" });
  }
});

// ====================================================
// PAYOUT MANAGEMENT API
// ====================================================

// Get all payouts with filters - RBAC-aware
router.get("/payouts", checkPermission(Permission.MANAGE_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const { status, walletType } = req.query;

    // Get RBAC filter using proven helper
    const rbacFilter = await getRBACFilter(req);

    console.log("[Payouts API] Fetching payouts with RBAC context:", {
      rbacFilter,
      statusFilter: status,
      walletTypeFilter: walletType,
      adminEmail: req.user!.email,
    });

    // Build base filter
    const where: any = {};
    if (status && status !== "all") {
      where.status = status as string;
    }
    if (walletType && walletType !== "all") {
      where.ownerType = walletType as string;
    }

    // Apply RBAC filtering based on admin role
    if (!rbacFilter.isUnrestricted) {
      if (rbacFilter.countryCode) {
        where.countryCode = rbacFilter.countryCode;
      }
      if (rbacFilter.cityCode) {
        where.cityCode = rbacFilter.cityCode;
      }
    }
    // SUPER_ADMIN (isUnrestricted=true): no additional filter (sees all)

    const payouts = await prisma.payout.findMany({
      where,
      include: {
        wallet: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100, // Limit for performance
    });

    // Batch fetch all users for drivers and customers (ownerId = user.id)
    const driverCustomerOwnerIds = payouts
      .filter(p => p.ownerType === "driver" || p.ownerType === "customer")
      .map(p => p.ownerId);

    const restaurantOwnerIds = payouts
      .filter(p => p.ownerType === "restaurant")
      .map(p => p.ownerId);

    const [users, restaurants] = await Promise.all([
      driverCustomerOwnerIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: driverCustomerOwnerIds } },
            include: {
              driverProfile: true,
              customerProfile: true,
            },
          })
        : [],
      restaurantOwnerIds.length > 0
        ? prisma.restaurantProfile.findMany({
            where: { id: { in: restaurantOwnerIds } },
            include: { user: true },
          })
        : [],
    ]);

    // Build owner lookup maps
    const userMap = new Map(users.map(u => [u.id, u]));
    const restaurantMap = new Map(restaurants.map(r => [r.id, r]));

    // Enrich payouts with owner information
    const enrichedPayouts = payouts
      .map((payout) => {
        let owner: any = null;

        if (payout.ownerType === "driver") {
          const user = userMap.get(payout.ownerId);
          if (user) {
            owner = {
              email: user.email,
              countryCode: user.countryCode || payout.countryCode,
              cityCode: user.cityCode,
              currency: payout.wallet.currency,
              fullName: user.driverProfile?.fullName || user.email,
            };
          }
        } else if (payout.ownerType === "customer") {
          const user = userMap.get(payout.ownerId);
          if (user) {
            owner = {
              email: user.email,
              countryCode: user.countryCode || payout.countryCode,
              cityCode: user.cityCode,
              currency: payout.wallet.currency,
              fullName: user.customerProfile?.fullName || user.email,
            };
          }
        } else if (payout.ownerType === "restaurant") {
          const restaurant = restaurantMap.get(payout.ownerId);
          if (restaurant) {
            owner = {
              email: restaurant.user?.email || "Unknown",
              countryCode: restaurant.user?.countryCode || payout.countryCode,
              cityCode: restaurant.user?.cityCode,
              currency: payout.wallet.currency,
              restaurantName: restaurant.restaurantName || "Unknown Restaurant",
            };
          }
        }

        // Skip if owner not found (RBAC filtered out or data issue)
        if (!owner) return null;

        return {
          id: payout.id,
          walletType: payout.ownerType,
          amount: payout.amount.toString(),
          status: payout.status,
          requestedAt: payout.createdAt,
          processedAt: payout.processedAt,
          processedByAdminId: payout.createdByAdminId,
          rejectionReason: payout.failureReason,
          owner,
          walletBalance: payout.wallet ? Number(payout.wallet.balance) : 0,
          negativeBalance: payout.wallet ? Number(payout.wallet.negativeBalance) : 0,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    console.log("[Payouts API] RBAC filtering results:", {
      totalPayouts: enrichedPayouts.length,
      byOwnerType: {
        driver: enrichedPayouts.filter(p => p.walletType === 'driver').length,
        customer: enrichedPayouts.filter(p => p.walletType === 'customer').length,
        restaurant: enrichedPayouts.filter(p => p.walletType === 'restaurant').length,
      },
      byStatus: {
        pending: enrichedPayouts.filter(p => p.status === 'pending').length,
        processing: enrichedPayouts.filter(p => p.status === 'processing').length,
        completed: enrichedPayouts.filter(p => p.status === 'completed').length,
        failed: enrichedPayouts.filter(p => p.status === 'failed').length,
      },
      rbacFilter,
    });

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.VIEW_PAYOUT_REQUESTS,
      entityType: EntityType.PAYOUT,
      description: `Viewed payouts list with RBAC filtering`,
      metadata: { 
        filters: { status, walletType }, 
        rbac: rbacFilter,
        total: enrichedPayouts.length 
      },
    });

    res.json({ payouts: enrichedPayouts, total: enrichedPayouts.length });
  } catch (error: any) {
    console.error("[Payouts API] Error fetching payouts:", error);
    res.status(500).json({ error: error.message || "Failed to fetch payouts" });
  }
});

// Approve a payout
router.put("/payouts/:id/approve", checkPermission(Permission.MANAGE_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;

    const payout = await prisma.payout.findUnique({
      where: { id },
      include: { wallet: true },
    });

    if (!payout) {
      return res.status(404).json({ error: "Payout not found" });
    }

    if (payout.status !== "pending") {
      return res.status(400).json({ error: `Payout is already ${payout.status}` });
    }

    const updatedPayout = await prisma.payout.update({
      where: { id },
      data: {
        status: "processing",
        processedAt: new Date(),
        createdByAdminId: adminId,
      },
    });

    await logAuditEvent({
      actorId: adminId,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.APPROVE_PAYOUT,
      entityType: EntityType.PAYOUT,
      entityId: id,
      description: `Approved payout of ${payout.amount} for ${payout.ownerType}`,
      metadata: {
        payoutId: id,
        amount: payout.amount.toString(),
        ownerType: payout.ownerType,
        ownerId: payout.ownerId,
      },
    });

    res.json({
      ...updatedPayout,
      amount: updatedPayout.amount.toString(),
    });
  } catch (error: any) {
    console.error("Approve payout error:", error);
    res.status(500).json({ error: error.message || "Failed to approve payout" });
  }
});

// Reject a payout
router.put("/payouts/:id/reject", checkPermission(Permission.MANAGE_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user!.id;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const payout = await prisma.payout.findUnique({
      where: { id },
      include: { wallet: true },
    });

    if (!payout) {
      return res.status(404).json({ error: "Payout not found" });
    }

    if (payout.status !== "pending") {
      return res.status(400).json({ error: `Payout is already ${payout.status}` });
    }

    const updatedPayout = await prisma.payout.update({
      where: { id },
      data: {
        status: "failed",
        failureReason: reason,
        processedAt: new Date(),
        createdByAdminId: adminId,
      },
    });

    await logAuditEvent({
      actorId: adminId,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.REJECT_PAYOUT,
      entityType: EntityType.PAYOUT,
      entityId: id,
      description: `Rejected payout of ${payout.amount} for ${payout.ownerType}: ${reason}`,
      metadata: {
        payoutId: id,
        amount: payout.amount.toString(),
        ownerType: payout.ownerType,
        ownerId: payout.ownerId,
        reason,
      },
    });

    res.json({
      ...updatedPayout,
      amount: updatedPayout.amount.toString(),
    });
  } catch (error: any) {
    console.error("Reject payout error:", error);
    res.status(500).json({ error: error.message || "Failed to reject payout" });
  }
});

// ====================================================
// STEP 47: PAYOUT SCHEDULING & RECONCILIATION API
// ====================================================

// Schedule automatic payouts
router.post("/payouts/schedule", checkPermission(Permission.CREATE_MANUAL_PAYOUT), async (req: AuthRequest, res) => {
  try {
    // Zod validation for request body
    const schedulePayoutSchema = z.object({
      ownerType: z.enum(["driver", "restaurant"]).optional(),
      countryCode: z.string().length(2).optional(),
      minAmount: z.number().positive().optional(),
      periodStart: z.string().datetime(),
      periodEnd: z.string().datetime(),
    });

    const validationResult = schedulePayoutSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid input", 
        details: validationResult.error.errors 
      });
    }

    const validatedData = validationResult.data;
    const adminId = req.user!.id;

    const result = await scheduleAutomaticPayouts({
      ownerType: validatedData.ownerType,
      countryCode: validatedData.countryCode,
      minAmount: validatedData.minAmount,
      periodStart: new Date(validatedData.periodStart),
      periodEnd: new Date(validatedData.periodEnd),
      adminId,
    });

    // Only log audit event if payouts were actually scheduled
    if (result.totalPayouts > 0) {
      await logAuditEvent({
        actorId: adminId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        ipAddress: getClientIp(req),
        actionType: ActionType.PAYOUT_SCHEDULED,
        entityType: EntityType.PAYOUT,
        entityId: result.batchId,
        description: `Scheduled ${result.totalPayouts} payouts totaling ${result.totalAmount}`,
        metadata: {
          batchId: result.batchId,
          totalPayouts: result.totalPayouts,
          totalAmount: result.totalAmount,
          ownerType: validatedData.ownerType || "all",
          countryCode: validatedData.countryCode || "all",
          periodStart: validatedData.periodStart,
          periodEnd: validatedData.periodEnd,
        },
      });
    }

    res.json(result);
  } catch (error: any) {
    console.error("Schedule payouts error:", error);
    res.status(500).json({ error: error.message || "Failed to schedule payouts" });
  }
});

// Run manual payout
router.post("/payouts/run-manual", checkPermission(Permission.CREATE_MANUAL_PAYOUT), async (req: AuthRequest, res) => {
  try {
    // Zod validation for request body
    const manualPayoutSchema = z.object({
      walletId: z.string().uuid(),
      amount: z.number().positive(),
      reason: z.string().optional(),
    });

    const validationResult = manualPayoutSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid input", 
        details: validationResult.error.errors 
      });
    }

    const validatedData = validationResult.data;
    const adminId = req.user!.id;

    const result = await runManualPayout({
      walletId: validatedData.walletId,
      amount: validatedData.amount,
      adminId,
      reason: validatedData.reason,
    });

    await logAuditEvent({
      actorId: adminId,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.PAYOUT_MANUAL_INITIATED,
      entityType: EntityType.PAYOUT,
      entityId: result.payoutId,
      description: `Initiated manual payout of ${result.amount}`,
      metadata: {
        payoutId: result.payoutId,
        walletId: validatedData.walletId,
        amount: result.amount,
        reason: validatedData.reason || "Manual admin payout",
      },
    });

    res.json(result);
  } catch (error: any) {
    console.error("Manual payout error:", error);
    res.status(500).json({ error: error.message || "Failed to process manual payout" });
  }
});

// Get reconciliation report
router.get("/payouts/reconciliation", checkPermission(Permission.VIEW_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    // Zod validation for query parameters
    const reconciliationQuerySchema = z.object({
      periodStart: z.string().datetime(),
      periodEnd: z.string().datetime(),
      ownerType: z.enum(["driver", "restaurant"]).optional(),
      countryCode: z.string().length(2).optional(),
    });

    const validationResult = reconciliationQuerySchema.safeParse(req.query);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid input", 
        details: validationResult.error.errors 
      });
    }

    const validatedQuery = validationResult.data;
    const adminId = req.user!.id;

    await logAuditEvent({
      actorId: adminId,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.RECONCILIATION_INITIATED,
      entityType: EntityType.ANALYTICS,
      entityId: null,
      description: `Initiated reconciliation for period ${validatedQuery.periodStart} to ${validatedQuery.periodEnd}`,
      metadata: {
        periodStart: validatedQuery.periodStart,
        periodEnd: validatedQuery.periodEnd,
        ownerType: validatedQuery.ownerType || "all",
        countryCode: validatedQuery.countryCode || "all",
      },
    });

    const report = await reconcileWalletTransactions({
      periodStart: new Date(validatedQuery.periodStart),
      periodEnd: new Date(validatedQuery.periodEnd),
      ownerType: validatedQuery.ownerType,
      countryCode: validatedQuery.countryCode,
    });

    await logAuditEvent({
      actorId: adminId,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.RECONCILIATION_COMPLETED,
      entityType: EntityType.ANALYTICS,
      entityId: null,
      description: `Reconciliation completed: ${report.totalMismatches} mismatches found`,
      metadata: {
        totalOrders: report.totalOrders,
        totalTransactions: report.totalTransactions,
        totalMismatches: report.totalMismatches,
        summary: report.summary,
      },
    });

    // Log individual mismatches if any found
    if (report.mismatches.length > 0) {
      for (const mismatch of report.mismatches.slice(0, 10)) {
        await logAuditEvent({
          actorId: adminId,
          actorEmail: req.user!.email,
          actorRole: req.user!.role,
          ipAddress: getClientIp(req),
          actionType: ActionType.RECONCILIATION_MISMATCH_FOUND,
          entityType: EntityType.ANALYTICS,
          entityId: mismatch.orderId,
          description: `Reconciliation mismatch: ${mismatch.details}`,
          metadata: {
            type: mismatch.type,
            severity: mismatch.severity,
            orderId: mismatch.orderId,
            orderType: mismatch.orderType,
            expectedAmount: mismatch.expectedAmount,
            actualAmount: mismatch.actualAmount,
          },
        });
      }
    }

    res.json(report);
  } catch (error: any) {
    console.error("Reconciliation error:", error);
    res.status(500).json({ error: error.message || "Failed to run reconciliation" });
  }
});

// ====================================================
// EARNINGS DASHBOARD API
// ====================================================

// Get global earnings summary
router.get("/earnings/dashboard/global", checkPermission(Permission.VIEW_EARNINGS_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    // Apply RBAC filtering (SUPER_ADMIN, COUNTRY_ADMIN, CITY_ADMIN)
    const rbacFilter = await getRBACFilter(req);

    const filters: any = { rbacFilter };
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);

    const summary = await earningsService.getGlobalSummary(filters);

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.VIEW_EARNINGS_DASHBOARD,
      entityType: EntityType.ANALYTICS,
      description: `Viewed global earnings dashboard`,
      metadata: { section: 'global', filters: { dateFrom, dateTo }, rbac: rbacFilter },
    });

    res.json(summary);
  } catch (error: any) {
    console.error("Get global earnings error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch global earnings" });
  }
});

// Get ride earnings
router.get("/earnings/dashboard/rides", checkPermission(Permission.VIEW_EARNINGS_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    // Apply RBAC filtering (SUPER_ADMIN, COUNTRY_ADMIN, CITY_ADMIN)
    const rbacFilter = await getRBACFilter(req);

    const filters: any = { rbacFilter };
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);

    const earnings = await earningsService.getRideEarnings(filters);

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.VIEW_EARNINGS_DASHBOARD,
      entityType: EntityType.ANALYTICS,
      description: `Viewed ride earnings analytics`,
      metadata: { section: 'rides', filters: { dateFrom, dateTo }, rbac: rbacFilter },
    });

    res.json(earnings);
  } catch (error: any) {
    console.error("Get ride earnings error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch ride earnings" });
  }
});

// Get food earnings
router.get("/earnings/dashboard/food", checkPermission(Permission.VIEW_EARNINGS_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    // Apply RBAC filtering (SUPER_ADMIN, COUNTRY_ADMIN, CITY_ADMIN)
    const rbacFilter = await getRBACFilter(req);

    const filters: any = { rbacFilter };
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);

    const earnings = await earningsService.getFoodEarnings(filters);

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.VIEW_EARNINGS_DASHBOARD,
      entityType: EntityType.ANALYTICS,
      description: `Viewed food earnings analytics`,
      metadata: { section: 'food', filters: { dateFrom, dateTo }, rbac: rbacFilter },
    });

    res.json(earnings);
  } catch (error: any) {
    console.error("Get food earnings error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch food earnings" });
  }
});

// ====================================================
// RESTAURANT ANALYTICS (Admin View)
// ====================================================

// GET /api/admin/restaurant-analytics
// Get platform-wide restaurant performance analytics (read-only admin view)
router.get("/restaurant-analytics", checkPermission(Permission.VIEW_EARNINGS_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to last 30 days if no dates provided
    const now = new Date();
    const defaultStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const defaultEndDate = now;

    const filters = {
      startDate: startDate ? new Date(startDate as string) : defaultStartDate,
      endDate: endDate ? new Date(endDate as string) : defaultEndDate,
    };

    const { getAdminRestaurantAnalytics } = await import("../analytics/restaurantAnalytics");
    const analytics = await getAdminRestaurantAnalytics(filters);

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.VIEW_EARNINGS_DASHBOARD,
      entityType: EntityType.ANALYTICS,
      description: `Viewed restaurant analytics dashboard`,
      metadata: { filters: { startDate: filters.startDate, endDate: filters.endDate } },
    });

    res.json(analytics);
  } catch (error: any) {
    console.error("Get restaurant analytics error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch restaurant analytics" });
  }
});

// POST /api/admin/restaurant-analytics/generate-insights
// Generate and send performance insights notifications to all KYC-verified restaurant owners
router.post("/restaurant-analytics/generate-insights", checkPermission(Permission.VIEW_EARNINGS_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    // Get all KYC-verified, non-demo restaurants
    const restaurants = await prisma.restaurantProfile.findMany({
      where: {
        isVerified: true,
        isDemo: false,
      },
      select: {
        id: true,
        restaurantName: true,
        userId: true,
      },
    });

    const results: {
      success: string[];
      failed: { restaurantId: string; error: string }[];
      skipped: string[];
    } = {
      success: [],
      failed: [],
      skipped: [],
    };

    const { getRestaurantPerformanceInsights, sendPerformanceNotification } = await import("../analytics/restaurantAnalytics");

    // Process each restaurant
    for (const restaurant of restaurants) {
      try {
        // Generate insights
        const insights = await getRestaurantPerformanceInsights(restaurant.id);

        // Skip if no orders in current period (nothing to report)
        if (insights.currentPeriod.orders === 0) {
          results.skipped.push(restaurant.id);
          continue;
        }

        // Send notification to restaurant owner
        await sendPerformanceNotification(insights);
        results.success.push(restaurant.id);
      } catch (error: any) {
        console.error(`Failed to generate insights for ${restaurant.id}:`, error);
        results.failed.push({
          restaurantId: restaurant.id,
          error: error.message || "Unknown error",
        });
      }
    }

    // Log audit event
    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.VIEW_EARNINGS_DASHBOARD,
      entityType: EntityType.ANALYTICS,
      description: `Generated performance insights for ${results.success.length} restaurants`,
      metadata: {
        totalRestaurants: restaurants.length,
        successCount: results.success.length,
        failedCount: results.failed.length,
        skippedCount: results.skipped.length,
      },
    });

    res.json({
      message: `Performance insights generated for ${results.success.length} of ${restaurants.length} restaurants`,
      results: {
        total: restaurants.length,
        notificationsSent: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
      },
      details: results,
    });
  } catch (error: any) {
    console.error("Generate insights error:", error);
    res.status(500).json({ error: error.message || "Failed to generate insights" });
  }
});

// ====================================================
// RESTAURANT PAYOUTS & SETTLEMENT MANAGEMENT (Phase 5)
// ====================================================

// GET /api/admin/payouts/restaurants
// List all restaurants with payout status and balances
router.get("/payouts/restaurants", checkPermission(Permission.VIEW_EARNINGS_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { hasNegativeBalance, hasPendingPayouts, countryCode } = req.query;

    const filters: any = {};
    if (hasNegativeBalance === "true") filters.hasNegativeBalance = true;
    if (hasPendingPayouts === "true") filters.hasPendingPayouts = true;
    if (countryCode) filters.countryCode = countryCode as string;

    const { getAllRestaurantPayouts } = await import("../payouts/restaurantPayouts");
    const restaurants = await getAllRestaurantPayouts(filters);

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.VIEW_EARNINGS_DASHBOARD,
      entityType: EntityType.PAYOUT,
      description: `Viewed restaurant payouts list`,
      metadata: { filters },
    });

    res.json({ restaurants });
  } catch (error: any) {
    console.error("Get restaurant payouts error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch restaurant payouts" });
  }
});

// GET /api/admin/payouts/pending
// Get all pending payout requests
router.get("/payouts/pending", checkPermission(Permission.MANAGE_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const pendingPayouts = await prisma.payout.findMany({
      where: {
        ownerType: "restaurant",
        status: "pending",
      },
      include: {
        wallet: {
          select: {
            ownerId: true,
            currency: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Enrich with restaurant details
    const enrichedPayouts = await Promise.all(
      pendingPayouts.map(async (payout) => {
        const restaurant = await prisma.restaurantProfile.findUnique({
          where: { id: payout.wallet.ownerId },
          select: {
            restaurantName: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        });

        return {
          ...payout,
          restaurantName: restaurant?.restaurantName || "Unknown",
          restaurantEmail: restaurant?.user.email || "Unknown",
        };
      })
    );

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.VIEW_EARNINGS_DASHBOARD,
      entityType: EntityType.PAYOUT,
      description: `Viewed pending payouts`,
      metadata: { count: pendingPayouts.length },
    });

    res.json({ payouts: enrichedPayouts });
  } catch (error: any) {
    console.error("Get pending payouts error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch pending payouts" });
  }
});

// POST /api/admin/payouts/:payoutId/approve
// Approve a payout request
router.post("/payouts/:payoutId/approve", checkPermission(Permission.MANAGE_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const { payoutId } = req.params;
    const { scheduledAt } = req.body;

    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
      include: {
        wallet: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!payout) {
      return res.status(404).json({ error: "Payout not found" });
    }

    if (payout.ownerType !== "restaurant") {
      return res.status(400).json({ error: "Invalid payout type" });
    }

    if (payout.status !== "pending") {
      return res.status(400).json({ error: `Cannot approve payout with status: ${payout.status}` });
    }

    // Update payout status
    const updatedPayout = await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: "processing",
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
        createdByAdminId: req.user!.id,
      },
    });

    // Create notification for restaurant owner
    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id: payout.wallet.ownerId },
      select: {
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (restaurant) {
      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: restaurant.user.id,
          type: "payout",
          title: "Payout Approved",
          body: `Your payout request of ${payout.amount} ${payout.countryCode === "BD" ? "BDT" : "USD"} has been approved and is being processed.`,
        },
      });
    }

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.APPROVE_PAYOUT,
      entityType: EntityType.PAYOUT,
      description: `Approved payout #${payoutId.substring(0, 8)} for ${payout.amount} ${payout.countryCode === "BD" ? "BDT" : "USD"}`,
      metadata: { payoutId, amount: payout.amount.toString(), restaurantId: payout.wallet.ownerId },
    });

    res.json({ message: "Payout approved successfully", payout: updatedPayout });
  } catch (error: any) {
    console.error("Approve payout error:", error);
    res.status(500).json({ error: error.message || "Failed to approve payout" });
  }
});

// POST /api/admin/payouts/:payoutId/reject
// Reject a payout request
router.post("/payouts/:payoutId/reject", checkPermission(Permission.MANAGE_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const { payoutId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
      include: {
        wallet: {
          select: {
            ownerId: true,
            id: true,
          },
        },
      },
    });

    if (!payout) {
      return res.status(404).json({ error: "Payout not found" });
    }

    if (payout.ownerType !== "restaurant") {
      return res.status(400).json({ error: "Invalid payout type" });
    }

    if (payout.status !== "pending") {
      return res.status(400).json({ error: `Cannot reject payout with status: ${payout.status}` });
    }

    // Refund the amount to wallet and reject payout atomically
    await prisma.$transaction(async (tx) => {
      // Update payout status
      await tx.payout.update({
        where: { id: payoutId },
        data: {
          status: "failed",
          failureReason: reason,
          createdByAdminId: req.user!.id,
        },
      });

      // Refund amount to wallet
      const updatedWallet = await tx.wallet.update({
        where: { id: payout.wallet.id },
        data: {
          availableBalance: { increment: payout.amount },
        },
      });

      // Create refund transaction
      await tx.walletTransaction.create({
        data: {
          walletId: payout.wallet.id,
          ownerType: "restaurant",
          countryCode: payout.countryCode,
          serviceType: "payout",
          direction: "credit",
          amount: payout.amount,
          balanceSnapshot: updatedWallet.availableBalance,
          negativeBalanceSnapshot: updatedWallet.negativeBalance,
          referenceType: "payout",
          referenceId: payoutId,
          description: `Payout rejected: ${reason}`,
          createdByAdminId: req.user!.id,
        },
      });
    });

    // Create notification for restaurant owner
    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id: payout.wallet.ownerId },
      select: {
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (restaurant) {
      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: restaurant.user.id,
          type: "alert",
          title: "Payout Rejected",
          body: `Your payout request of ${payout.amount} ${payout.countryCode === "BD" ? "BDT" : "USD"} was rejected. Reason: ${reason}. The amount has been refunded to your wallet.`,
        },
      });
    }

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.REJECT_PAYOUT,
      entityType: EntityType.PAYOUT,
      description: `Rejected payout #${payoutId.substring(0, 8)} - ${reason}`,
      metadata: { payoutId, amount: payout.amount.toString(), restaurantId: payout.wallet.ownerId, reason },
    });

    res.json({ message: "Payout rejected and amount refunded" });
  } catch (error: any) {
    console.error("Reject payout error:", error);
    res.status(500).json({ error: error.message || "Failed to reject payout" });
  }
});

// POST /api/admin/payouts/:payoutId/complete
// Mark payout as completed/paid
router.post("/payouts/:payoutId/complete", checkPermission(Permission.MANAGE_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const { payoutId } = req.params;
    const { externalReferenceId } = req.body;

    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
      include: {
        wallet: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!payout) {
      return res.status(404).json({ error: "Payout not found" });
    }

    if (payout.ownerType !== "restaurant") {
      return res.status(400).json({ error: "Invalid payout type" });
    }

    if (payout.status === "completed") {
      return res.status(400).json({ error: "Payout already completed" });
    }

    if (payout.status !== "processing") {
      return res.status(400).json({ error: `Cannot complete payout with status: ${payout.status}` });
    }

    // Update payout status
    const updatedPayout = await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: "completed",
        processedAt: new Date(),
        externalReferenceId,
      },
    });

    // Create notification for restaurant owner
    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id: payout.wallet.ownerId },
      select: {
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (restaurant) {
      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: restaurant.user.id,
          type: "payout",
          title: "Payout Completed",
          body: `Your payout of ${payout.amount} ${payout.countryCode === "BD" ? "BDT" : "USD"} has been successfully processed and transferred to your account.`,
        },
      });
    }

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.COMPLETE_PAYOUT,
      entityType: EntityType.PAYOUT,
      description: `Completed payout #${payoutId.substring(0, 8)} for ${payout.amount} ${payout.countryCode === "BD" ? "BDT" : "USD"}`,
      metadata: { payoutId, amount: payout.amount.toString(), restaurantId: payout.wallet.ownerId, externalReferenceId },
    });

    res.json({ message: "Payout marked as completed", payout: updatedPayout });
  } catch (error: any) {
    console.error("Complete payout error:", error);
    res.status(500).json({ error: error.message || "Failed to complete payout" });
  }
});

// POST /api/admin/payouts/adjust-balance
// Adjust restaurant wallet balance (admin override with audit logging)
router.post("/payouts/adjust-balance", checkPermission(Permission.MANAGE_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const { restaurantId, amount, reason, adjustmentType } = req.body;

    if (!restaurantId || amount === undefined || !reason || !adjustmentType) {
      return res.status(400).json({
        error: "restaurantId, amount, reason, and adjustmentType are required",
      });
    }

    if (!["credit", "debit"].includes(adjustmentType)) {
      return res.status(400).json({ error: "adjustmentType must be 'credit' or 'debit'" });
    }

    let amountDecimal: Prisma.Decimal;
    try {
      amountDecimal = new Prisma.Decimal(Math.abs(amount));
    } catch {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        restaurantName: true,
        countryCode: true,
      },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Get or create wallet
    let wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: restaurantId,
          ownerType: "restaurant",
        },
      },
    });

    if (!wallet) {
      return res.status(404).json({ error: "Restaurant wallet not found" });
    }

    // Perform adjustment
    const updatedWallet = await prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance:
            adjustmentType === "credit"
              ? { increment: amountDecimal }
              : { decrement: amountDecimal },
        },
      });

      // Create transaction record
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          ownerType: "restaurant",
          countryCode: wallet.countryCode,
          serviceType: "adjustment",
          direction: adjustmentType === "credit" ? "credit" : "debit",
          amount: amountDecimal,
          balanceSnapshot: updated.availableBalance,
          negativeBalanceSnapshot: updated.negativeBalance,
          referenceType: "admin_adjustment",
          description: `Admin adjustment: ${reason}`,
          createdByAdminId: req.user!.id,
        },
      });

      return updated;
    });

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.ADJUST_WALLET_BALANCE,
      entityType: EntityType.WALLET,
      description: `Adjusted restaurant wallet balance: ${adjustmentType} ${amountDecimal} ${wallet.currency}`,
      metadata: {
        restaurantId,
        restaurantName: restaurant.restaurantName,
        adjustmentType,
        amount: amountDecimal.toString(),
        reason,
        newBalance: updatedWallet.availableBalance.toString(),
      },
    });

    res.json({
      message: "Wallet balance adjusted successfully",
      newBalance: updatedWallet.availableBalance.toString(),
      currency: wallet.currency,
    });
  } catch (error: any) {
    console.error("Adjust balance error:", error);
    res.status(500).json({ error: error.message || "Failed to adjust balance" });
  }
});

// Get parcel earnings
router.get("/earnings/dashboard/parcels", checkPermission(Permission.VIEW_EARNINGS_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    // Apply RBAC filtering (SUPER_ADMIN, COUNTRY_ADMIN, CITY_ADMIN)
    const rbacFilter = await getRBACFilter(req);

    const filters: any = { rbacFilter };
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);

    const earnings = await earningsService.getParcelEarnings(filters);

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.VIEW_EARNINGS_DASHBOARD,
      entityType: EntityType.ANALYTICS,
      description: `Viewed parcel earnings analytics`,
      metadata: { section: 'parcels', filters: { dateFrom, dateTo }, rbac: rbacFilter },
    });

    res.json(earnings);
  } catch (error: any) {
    console.error("Get parcel earnings error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch parcel earnings" });
  }
});

// Get payout analytics
router.get("/earnings/dashboard/payouts", checkPermission(Permission.VIEW_EARNINGS_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    // Apply RBAC filtering (SUPER_ADMIN, COUNTRY_ADMIN, CITY_ADMIN)
    const rbacFilter = await getRBACFilter(req);

    const filters: any = { rbacFilter };
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);

    const analytics = await earningsService.getPayoutAnalytics(filters);

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.VIEW_EARNINGS_DASHBOARD,
      entityType: EntityType.ANALYTICS,
      description: `Viewed payout analytics`,
      metadata: { section: 'payouts', filters: { dateFrom, dateTo }, rbac: rbacFilter },
    });

    res.json(analytics);
  } catch (error: any) {
    console.error("Get payout analytics error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch payout analytics" });
  }
});

// ====================================================
// SECURITY EVENTS MONITORING
// ====================================================

router.get("/security-events", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { dateFrom, dateTo, category, actorEmail, severity, limit, offset } = req.query;

    const { getSecurityEvents } = await import('../services/securityEventsService');

    const query: any = {};
    if (dateFrom) query.dateFrom = new Date(dateFrom as string);
    if (dateTo) query.dateTo = new Date(dateTo as string);
    if (category) query.category = category as string;
    if (actorEmail) query.actorEmail = actorEmail as string;
    if (severity) query.severity = severity as string;
    if (limit) query.limit = parseInt(limit as string);
    if (offset) query.offset = parseInt(offset as string);

    const result = await getSecurityEvents(query);

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: 'SECURITY_EVENTS_VIEWED',
      entityType: 'security',
      description: `Viewed security events`,
      metadata: { filters: query }
    });

    res.json(result);
  } catch (error: any) {
    console.error("Get security events error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch security events" });
  }
});

router.get("/security-events/summary", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { hours } = req.query;
    const hoursNum = hours ? parseInt(hours as string) : 24;

    const { getSecurityEventsSummary } = await import('../services/securityEventsService');
    const summary = await getSecurityEventsSummary(hoursNum);

    res.json(summary);
  } catch (error: any) {
    console.error("Get security events summary error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch security summary" });
  }
});

// ====================================================
// GET /api/admin/security/threats
// Real-time threat monitoring dashboard data
// ====================================================
router.get("/security/threats", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

    // Get threat summary
    const [blockedLogins, suspiciousActivity] = await Promise.all([
      // Blocked logins (failed logins + suspended/blocked user attempts)
      prisma.auditLog.count({
        where: {
          actionType: ActionType.LOGIN_FAILED,
          createdAt: { gte: last24h },
        },
      }),
      // Suspicious activity
      prisma.auditLog.count({
        where: {
          success: false,
          actionType: { in: [ActionType.UPDATE_USER, ActionType.MANAGE_DRIVER_KYC, ActionType.UPDATE_WALLET] },
          createdAt: { gte: last24h },
        },
      }),
    ]);

    // Active threats (unresolved security issues)
    const activeThreats = await prisma.auditLog.count({
      where: {
        success: false,
        createdAt: { gte: last24h },
      },
    });

    // Calculate average API latency from recent queries
    const avgApiLatencyMs = 50; // Simplified - in production, track this via middleware

    // Get active sessions (users who logged in recently)
    const activeSessionsRaw = await prisma.auditLog.findMany({
      where: {
        actionType: ActionType.LOGIN_SUCCESS,
        createdAt: { gte: lastHour },
      },
      select: {
        actorId: true,
        actorEmail: true,
        createdAt: true,
        ipAddress: true,
        metadata: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const activeSessions = activeSessionsRaw.map((session) => {
      const metadata = session.metadata as any;
      return {
        userId: session.actorId || "unknown",
        email: session.actorEmail || "Unknown",
        role: metadata?.role || "unknown",
        loginAt: session.createdAt.toISOString(),
        ipAddress: session.ipAddress || "Unknown",
        userAgent: metadata?.userAgent || "",
      };
    });

    // Get recent threats (failed actions, suspicious patterns)
    const recentThreatsRaw = await prisma.auditLog.findMany({
      where: {
        OR: [
          { success: false },
          { actionType: { in: [ActionType.LOGIN_FAILED, ActionType.SUSPEND_USER, ActionType.BLOCK_USER] } },
        ],
        createdAt: { gte: last24h },
      },
      select: {
        id: true,
        actionType: true,
        description: true,
        actorId: true,
        actorEmail: true,
        createdAt: true,
        success: true,
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    const recentThreats = recentThreatsRaw.map((threat) => ({
      id: threat.id,
      type: threat.actionType,
      severity: threat.success ? "low" : 
                threat.actionType === ActionType.LOGIN_FAILED ? "medium" :
                threat.actionType === ActionType.BLOCK_USER ? "high" : "medium",
      description: threat.description,
      userId: threat.actorId,
      userEmail: threat.actorEmail,
      createdAt: threat.createdAt.toISOString(),
      resolved: threat.success,
    }));

    // Activity chart - hourly breakdown of last 24 hours
    const activityChart = [];
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      
      const [failedLogins, suspiciousActions, blockedAttempts] = await Promise.all([
        prisma.auditLog.count({
          where: {
            actionType: ActionType.LOGIN_FAILED,
            createdAt: { gte: hourStart, lt: hourEnd },
          },
        }),
        prisma.auditLog.count({
          where: {
            success: false,
            actionType: { notIn: [ActionType.LOGIN_FAILED] },
            createdAt: { gte: hourStart, lt: hourEnd },
          },
        }),
        prisma.auditLog.count({
          where: {
            actionType: { in: [ActionType.SUSPEND_USER, ActionType.BLOCK_USER] },
            createdAt: { gte: hourStart, lt: hourEnd },
          },
        }),
      ]);

      activityChart.push({
        hour: format(hourStart, "ha"),
        failedLogins,
        suspiciousActions,
        blockedAttempts,
      });
    }

    // API latency chart - simplified mock data
    const apiLatencyChart = [];
    for (let i = 11; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 5 * 60 * 1000);
      apiLatencyChart.push({
        timestamp: format(timestamp, "HH:mm"),
        latencyMs: Math.floor(Math.random() * 100) + 30, // Mock data
      });
    }

    res.json({
      summary: {
        blockedLoginsLast24h: blockedLogins,
        suspiciousActivityLast24h: suspiciousActivity,
        activeThreatsNow: activeThreats,
        avgApiLatencyMs,
      },
      activeSessions,
      recentThreats,
      activityChart,
      apiLatencyChart,
    });
  } catch (error) {
    console.error("Security threats error:", error);
    res.status(500).json({ error: "Failed to fetch threat data" });
  }
});

// ====================================================
// GET /api/admin/monitoring
// Get real-time monitoring data for admin dashboard
// ====================================================
router.get("/monitoring", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get summary statistics
    const [failedLogins, suspiciousActivity, blockedAttempts] = await Promise.all([
      // Failed logins in last 24h
      prisma.auditLog.count({
        where: {
          actionType: ActionType.LOGIN_FAILED,
          createdAt: { gte: last24h },
        },
      }),
      // Suspicious activity (failed sensitive actions)
      prisma.auditLog.count({
        where: {
          success: false,
          actionType: { in: [ActionType.UPDATE_USER, ActionType.MANAGE_DRIVER_KYC, ActionType.UPDATE_WALLET] },
          createdAt: { gte: last24h },
        },
      }),
      // Blocked attempts (suspended/blocked users)
      prisma.auditLog.count({
        where: {
          actionType: { in: [ActionType.SUSPEND_USER, ActionType.BLOCK_USER] },
          createdAt: { gte: last24h },
        },
      }),
    ]);

    // Get recent security events (limited fields for security)
    const recentEvents = await prisma.auditLog.findMany({
      where: {
        OR: [
          { success: false },
          { actionType: { in: [ActionType.LOGIN_FAILED, ActionType.SUSPEND_USER, ActionType.BLOCK_USER] } },
        ],
        createdAt: { gte: last24h },
      },
      select: {
        id: true,
        actorEmail: true,
        actionType: true,
        entityType: true,
        description: true,
        success: true,
        createdAt: true,
        ipAddress: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Simple active sessions estimate (users who logged in successfully in last hour)
    const activeSessions = await prisma.auditLog.count({
      where: {
        actionType: ActionType.LOGIN_SUCCESS,
        createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
      },
    });

    // System health check (simplified)
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const apiLatencyMs = Date.now() - startTime;

    res.json({
      summary: {
        failedLoginsLast24h: failedLogins,
        suspiciousActivityLast24h: suspiciousActivity,
        blockedAttemptsLast24h: blockedAttempts,
        activeSessionsNow: activeSessions,
      },
      recentEvents,
      systemHealth: {
        apiLatencyMs,
        databaseStatus: apiLatencyMs < 1000 ? "healthy" : "degraded",
        cacheStatus: "healthy",
      },
    });
  } catch (error) {
    console.error("Monitoring data error:", error);
    res.status(500).json({ error: "Failed to fetch monitoring data" });
  }
});

// ====================================================
// POST /api/admin/fraud/calculate-risk
// Calculate risk score for a user
// ====================================================
router.post("/fraud/calculate-risk", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { userId, deviceInfo } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const riskResult = await fraudDetectionService.calculateUserRiskScore(userId, deviceInfo);

    // Log fraud check
    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actionType: ActionType.VIEW_ACTIVITY_LOG,
      entityType: EntityType.USER,
      entityId: userId,
      description: `Fraud risk assessment: ${riskResult.riskLevel} (score: ${riskResult.riskScore})`,
      success: true,
      ipAddress: getClientIp(req),
      metadata: { riskResult },
    });

    res.json(riskResult);
  } catch (error) {
    console.error("Risk calculation error:", error);
    res.status(500).json({ error: "Failed to calculate risk score" });
  }
});

// ====================================================
// POST /api/admin/fraud/check-parcel
// Check parcel for fraud patterns
// ====================================================
router.post("/fraud/check-parcel", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { parcelId } = req.body;

    if (!parcelId) {
      return res.status(400).json({ error: "parcelId is required" });
    }

    const fraudResult = await fraudDetectionService.checkParcelFraud(parcelId);

    // Log fraud check
    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actionType: ActionType.VIEW_ACTIVITY_LOG,
      entityType: EntityType.PARCEL,
      entityId: parcelId,
      description: `Parcel fraud check: ${fraudResult.riskLevel} (score: ${fraudResult.riskScore})`,
      success: true,
      ipAddress: getClientIp(req),
      metadata: { fraudResult },
    });

    res.json(fraudResult);
  } catch (error) {
    console.error("Parcel fraud check error:", error);
    res.status(500).json({ error: "Failed to check parcel fraud" });
  }
});

// ====================================================
// POST /api/admin/fraud/check-multi-account
// Check for multi-account abuse
// ====================================================
router.post("/fraud/check-multi-account", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const abuseResult = await fraudDetectionService.checkMultiAccountAbuse(userId);

    // Log fraud check
    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actionType: ActionType.VIEW_ACTIVITY_LOG,
      entityType: EntityType.USER,
      entityId: userId,
      description: `Multi-account abuse check: ${abuseResult.riskLevel} (score: ${abuseResult.riskScore})`,
      success: true,
      ipAddress: getClientIp(req),
      metadata: { abuseResult },
    });

    res.json(abuseResult);
  } catch (error) {
    console.error("Multi-account check error:", error);
    res.status(500).json({ error: "Failed to check multi-account abuse" });
  }
});

// ====================================================
// TAX & FEES MANAGEMENT API
// ====================================================

// GET /api/admin/tax - List all tax rules with RBAC filtering
router.get("/tax", checkPermission(Permission.VIEW_SETTINGS), async (req: AuthRequest, res) => {
  try {
    const { serviceType, taxType, active, countryCode } = req.query;
    
    // Get RBAC filter
    const rbacFilter = await getRBACFilter(req);
    
    // Build where clause
    const where: any = {
      isDemo: false,
    };
    
    // Apply RBAC filtering - strict jurisdiction isolation
    if (!rbacFilter.isUnrestricted) {
      if (rbacFilter.countryCode) {
        where.countryCode = rbacFilter.countryCode;
        
        // CITY_ADMIN: Only see rules specific to their city (exclude country rules)
        if (rbacFilter.cityCode) {
          where.cityCode = rbacFilter.cityCode;
        } else {
          // COUNTRY_ADMIN: Only see country-level rules (exclude city-specific rules)
          where.cityCode = null;
        }
      }
    }
    
    // Apply optional filters from query params
    if (serviceType && serviceType !== "all") {
      where.serviceType = serviceType as string;
    }
    if (taxType && taxType !== "all") {
      where.taxType = taxType as string;
    }
    if (active === "true") {
      where.isActive = true;
    } else if (active === "false") {
      where.isActive = false;
    }
    if (countryCode && rbacFilter.isUnrestricted) {
      // Only SUPER_ADMIN can filter by specific country
      where.countryCode = countryCode as string;
    }
    
    const taxRules = await prisma.taxRule.findMany({
      where,
      orderBy: [
        { countryCode: "asc" },
        { createdAt: "desc" },
      ],
    });
    
    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.VIEW_SETTINGS,
      entityType: EntityType.TAX_RULE,
      description: `Viewed tax rules list`,
      metadata: { filters: { serviceType, taxType, active }, rbac: rbacFilter, total: taxRules.length },
    });
    
    res.json({
      taxRules: taxRules.map(rule => ({
        ...rule,
        percentRate: rule.percentRate?.toString() || null,
        flatFee: rule.flatFee?.toString() || null,
      })),
      total: taxRules.length,
    });
  } catch (error: any) {
    console.error("[Tax API] Error fetching tax rules:", error);
    res.status(500).json({ error: error.message || "Failed to fetch tax rules" });
  }
});

// POST /api/admin/tax - Create new tax rule
router.post("/tax", checkPermission(Permission.EDIT_SETTINGS), async (req: AuthRequest, res) => {
  try {
    const {
      countryCode,
      cityCode,
      taxType,
      serviceType,
      percentRate,
      flatFee,
      isActive,
    } = req.body;
    
    // Validate required fields
    if (!countryCode || !taxType || !serviceType) {
      return res.status(400).json({ error: "Missing required fields: countryCode, taxType, and serviceType are required" });
    }
    
    // Validate that at least one of percentRate or flatFee is provided
    if (percentRate === undefined && flatFee === undefined) {
      return res.status(400).json({ error: "At least one of percentRate or flatFee must be provided" });
    }
    
    // Get RBAC filter
    const rbacFilter = await getRBACFilter(req);
    
    // RBAC check: ensure admin can only create tax rules for their jurisdiction
    if (!rbacFilter.isUnrestricted) {
      if (rbacFilter.countryCode && countryCode !== rbacFilter.countryCode) {
        return res.status(403).json({ error: "You can only create tax rules for your assigned country" });
      }
      if (rbacFilter.cityCode && (!cityCode || cityCode !== rbacFilter.cityCode)) {
        return res.status(403).json({ error: "You can only create tax rules for your assigned city" });
      }
    }
    
    // Create tax rule
    const taxRule = await prisma.taxRule.create({
      data: {
        countryCode: safeString(countryCode),
        cityCode: cityCode ? safeString(cityCode) : null,
        taxType,
        serviceType,
        percentRate: percentRate !== undefined ? safeNumber(percentRate) : null,
        flatFee: flatFee !== undefined ? safeNumber(flatFee) : null,
        isActive: isActive !== undefined ? isActive : true,
        isDemo: false,
      },
    });
    
    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.EDIT_SETTINGS,
      entityType: EntityType.TAX_RULE,
      entityId: taxRule.id,
      description: `Created tax rule: ${taxType} for ${serviceType} in ${countryCode}${cityCode ? `/${cityCode}` : ''}`,
      metadata: { taxRule },
    });
    
    res.json({
      ...taxRule,
      percentRate: taxRule.percentRate?.toString() || null,
      flatFee: taxRule.flatFee?.toString() || null,
    });
  } catch (error: any) {
    console.error("[Tax API] Error creating tax rule:", error);
    res.status(500).json({ error: error.message || "Failed to create tax rule" });
  }
});

// PATCH /api/admin/tax/:id - Update tax rule
router.patch("/tax/:id", checkPermission(Permission.EDIT_SETTINGS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const {
      taxType,
      serviceType,
      percentRate,
      flatFee,
      isActive,
    } = req.body;
    
    // Get existing tax rule
    const existingRule = await prisma.taxRule.findUnique({
      where: { id },
    });
    
    if (!existingRule) {
      return res.status(404).json({ error: "Tax rule not found" });
    }
    
    // Get RBAC filter
    const rbacFilter = await getRBACFilter(req);
    
    // RBAC check: ensure admin can only update tax rules in their jurisdiction
    if (!rbacFilter.isUnrestricted) {
      if (rbacFilter.countryCode && existingRule.countryCode !== rbacFilter.countryCode) {
        return res.status(403).json({ error: "You can only update tax rules in your assigned country" });
      }
      if (rbacFilter.cityCode && (!existingRule.cityCode || existingRule.cityCode !== rbacFilter.cityCode)) {
        return res.status(403).json({ error: "You can only update tax rules in your assigned city" });
      }
    }
    
    // Build update data
    const updateData: any = {};
    if (taxType !== undefined) updateData.taxType = taxType;
    if (serviceType !== undefined) updateData.serviceType = serviceType;
    if (percentRate !== undefined) updateData.percentRate = safeNumber(percentRate);
    if (flatFee !== undefined) updateData.flatFee = safeNumber(flatFee);
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Validate that at least one of percentRate or flatFee will exist after update
    const finalPercentRate = percentRate !== undefined ? percentRate : existingRule.percentRate;
    const finalFlatFee = flatFee !== undefined ? flatFee : existingRule.flatFee;
    if (finalPercentRate === null && finalFlatFee === null) {
      return res.status(400).json({ error: "At least one of percentRate or flatFee must be set" });
    }
    
    // Update tax rule
    const taxRule = await prisma.taxRule.update({
      where: { id },
      data: updateData,
    });
    
    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.EDIT_SETTINGS,
      entityType: EntityType.TAX_RULE,
      entityId: taxRule.id,
      description: `Updated tax rule: ${taxRule.taxType} for ${taxRule.serviceType}`,
      metadata: { before: existingRule, after: taxRule },
    });
    
    res.json({
      ...taxRule,
      percentRate: taxRule.percentRate?.toString() || null,
      flatFee: taxRule.flatFee?.toString() || null,
    });
  } catch (error: any) {
    console.error("[Tax API] Error updating tax rule:", error);
    res.status(500).json({ error: error.message || "Failed to update tax rule" });
  }
});

// DELETE /api/admin/tax/:id - Delete tax rule
router.delete("/tax/:id", checkPermission(Permission.EDIT_SETTINGS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    // Get existing tax rule
    const existingRule = await prisma.taxRule.findUnique({
      where: { id },
    });
    
    if (!existingRule) {
      return res.status(404).json({ error: "Tax rule not found" });
    }
    
    // Get RBAC filter
    const rbacFilter = await getRBACFilter(req);
    
    // RBAC check: ensure admin can only delete tax rules in their jurisdiction
    if (!rbacFilter.isUnrestricted) {
      if (rbacFilter.countryCode && existingRule.countryCode !== rbacFilter.countryCode) {
        return res.status(403).json({ error: "You can only delete tax rules in your assigned country" });
      }
      if (rbacFilter.cityCode && (!existingRule.cityCode || existingRule.cityCode !== rbacFilter.cityCode)) {
        return res.status(403).json({ error: "You can only delete tax rules in your assigned city" });
      }
    }
    
    // Delete tax rule
    await prisma.taxRule.delete({
      where: { id },
    });
    
    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.EDIT_SETTINGS,
      entityType: EntityType.TAX_RULE,
      entityId: id,
      description: `Deleted tax rule: ${existingRule.taxType} for ${existingRule.serviceType}`,
      metadata: { deletedRule: existingRule },
    });
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Tax API] Error deleting tax rule:", error);
    res.status(500).json({ error: error.message || "Failed to delete tax rule" });
  }
});

// ====================================================
// SafeGo Points Management
// ====================================================

// GET /api/admin/points/tiers - Get all tiers (Blue → Gold → Premium → Diamond)
router.get("/points/tiers", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const tiers = await prisma.driverTier.findMany({
      orderBy: { displayOrder: "asc" }, // CRITICAL: ensures Premium before Diamond
      include: {
        benefits: {
          where: { isActive: true },
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    res.json(tiers);
  } catch (error) {
    console.error("Error fetching tiers:", error);
    res.status(500).json({ error: "Failed to fetch tiers" });
  }
});

// PUT /api/admin/points/tiers/:id - Update tier (displayOrder is read-only)
router.put("/points/tiers/:id", checkPermission(Permission.EDIT_SETTINGS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { requiredPoints, color, description, isActive } = req.body;

    const tier = await prisma.driverTier.update({
      where: { id },
      data: {
        requiredPoints,
        color,
        description,
        isActive,
        // displayOrder excluded to prevent manual reordering
      },
    });

    // Audit log
    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.EDIT_SETTINGS,
      entityType: EntityType.PLATFORM_SETTINGS,
      entityId: id,
      description: `Updated tier: ${tier.name}`,
      metadata: { changes: { requiredPoints, color, description, isActive } },
    });

    res.json(tier);
  } catch (error) {
    console.error("Error updating tier:", error);
    res.status(500).json({ error: "Failed to update tier" });
  }
});

// GET /api/admin/points/rules - Get all points rules
router.get("/points/rules", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const rules = await prisma.pointsRule.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.json(rules);
  } catch (error) {
    console.error("Error fetching points rules:", error);
    res.status(500).json({ error: "Failed to fetch points rules" });
  }
});

// GET /api/admin/points/drivers - Get all drivers with points
router.get("/points/drivers", checkPermission(Permission.VIEW_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    const [drivers, total] = await Promise.all([
      prisma.driverPoints.findMany({
        orderBy: { totalPoints: "desc" },
        take: limit,
        skip,
        include: {
          tier: true,
          driver: {
            include: {
              user: {
                select: {
                  email: true,
                  phoneNumber: true,
                },
              },
            },
          },
        },
      }),
      prisma.driverPoints.count(),
    ]);

    res.json({
      drivers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching driver points:", error);
    res.status(500).json({ error: "Failed to fetch driver points" });
  }
});

// ====================================================
// STAFF MANAGEMENT SYSTEM (Phase 6)
// ====================================================

// GET /api/admin/staff - Get all restaurant staff across platform
router.get("/staff", checkPermission(Permission.VIEW_RESTAURANT_PROFILES), async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;
    const restaurantId = req.query.restaurantId as string | undefined;
    const status = req.query.status as string | undefined;

    const where: any = {
      ownerRole: "STAFF",
    };

    if (restaurantId) {
      where.managedByOwnerId = restaurantId;
    }

    if (status === "active") {
      where.staffActive = true;
    } else if (status === "blocked") {
      where.staffActive = false;
    }

    const [staff, total] = await Promise.all([
      prisma.restaurantProfile.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              role: true,
              isDemo: true,
            },
          },
        },
      }),
      prisma.restaurantProfile.count({ where }),
    ]);

    res.json({
      staff,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Admin get staff error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch staff" });
  }
});

// GET /api/admin/staff/:id - Get specific staff member details
router.get("/staff/:id", checkPermission(Permission.VIEW_RESTAURANT_PROFILES), async (req: AuthRequest, res) => {
  try {
    const { id: staffId } = req.params;

    const staff = await prisma.restaurantProfile.findUnique({
      where: { id: staffId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            isDemo: true,
          },
        },
      },
    });

    if (!staff) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    if (staff.ownerRole !== "STAFF") {
      return res.status(400).json({ error: "User is not a staff member" });
    }

    // Get owner information
    let ownerInfo = null;
    if (staff.managedByOwnerId) {
      ownerInfo = await prisma.restaurantProfile.findUnique({
        where: { id: staff.managedByOwnerId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });
    }

    res.json({ staff, ownerInfo });
  } catch (error: any) {
    console.error("Admin get staff details error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch staff details" });
  }
});

// POST /api/admin/staff/:id/block - Block or unblock a staff member (admin action)
router.post(
  "/staff/:id/block",
  checkPermission(Permission.MANAGE_RESTAURANT_PROFILES),
  async (req: AuthRequest, res) => {
    try {
      const { id: staffId } = req.params;
      const { block, reason } = req.body;
      const adminId = req.user!.userId;

      const staff = await prisma.restaurantProfile.findUnique({
        where: { id: staffId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      if (!staff) {
        return res.status(404).json({ error: "Staff member not found" });
      }

      if (staff.ownerRole !== "STAFF") {
        return res.status(400).json({ error: "User is not a staff member" });
      }

      // Use ownerName from profile or email as fallback for staff name
      const staffName = staff.ownerName || staff.user.email.split("@")[0];

      // Update staff status
      const updatedStaff = await prisma.restaurantProfile.update({
        where: { id: staffId },
        data: {
          staffActive: !block,
        },
      });

      // Create notification for staff member
      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: updatedStaff.userId,
          type: "alert",
          title: block ? "Account Suspended by Admin" : "Account Activated by Admin",
          body: block
            ? `Your staff account has been suspended by administration. ${reason ? `Reason: ${reason}` : ""}`
            : "Your staff account has been activated by administration. You can now log in.",
        },
      });

      // Log admin action
      await logAudit({
        action: `${block ? "Blocked" : "Unblocked"} staff member ${staffName} (${staff.user.email})${reason ? `. Reason: ${reason}` : ""}`,
        actionType: block ? ActionType.BLOCK_STAFF : ActionType.UNBLOCK_STAFF,
        actorId: adminId,
        targetId: staffId,
        targetType: "staff",
        metadata: {
          staffId,
          staffName,
          staffEmail: staff.user.email,
          block,
          reason,
        },
      });

      res.json({
        message: `Staff member ${block ? "blocked" : "unblocked"} successfully`,
        staff: updatedStaff,
      });
    } catch (error: any) {
      console.error("Admin block staff error:", error);
      res.status(500).json({ error: error.message || "Failed to block/unblock staff member" });
    }
  }
);

// ====================================================
// PHASE 7: PROMOTION MODERATION ENDPOINTS
// ====================================================

// GET /api/admin/promotions - List all promotions
router.get(
  "/promotions",
  checkPermission(Permission.MODERATE_PROMOTIONS),
  async (req: AuthRequest, res) => {
    try {
      const { restaurantId, isActive, isFlagged, promoType, page = "1", limit = "50" } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};
      if (restaurantId) where.restaurantId = restaurantId as string;
      if (isActive !== undefined) where.isActive = isActive === "true";
      if (isFlagged !== undefined) where.isFlagged = isFlagged === "true";
      if (promoType) where.promoType = promoType as string;

      const [promotions, total] = await Promise.all([
        prisma.promotion.findMany({
          where,
          include: {
            restaurant: {
              select: {
                id: true,
                restaurantName: true,
                user: { select: { email: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
        }),
        prisma.promotion.count({ where }),
      ]);

      res.json({
        promotions: promotions.map(p => ({
          ...p,
          discountPercentage: p.discountPercentage ? Number(p.discountPercentage) : null,
          discountValue: p.discountValue ? Number(p.discountValue) : null,
          minOrderAmount: p.minOrderAmount ? Number(p.minOrderAmount) : null,
          maxDiscountCap: p.maxDiscountCap ? Number(p.maxDiscountCap) : null,
        })),
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      console.error("Get promotions error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch promotions" });
    }
  }
);

// POST /api/admin/promotions/:id/flag - Flag a promotion
router.post(
  "/promotions/:id/flag",
  checkPermission(Permission.MODERATE_PROMOTIONS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user!.userId;

      if (!reason) {
        return res.status(400).json({ error: "Reason is required" });
      }

      const promotion = await prisma.promotion.findUnique({
        where: { id },
        include: {
          restaurant: {
            include: { user: true },
          },
        },
      });

      if (!promotion) {
        return res.status(404).json({ error: "Promotion not found" });
      }

      const updatedPromotion = await prisma.promotion.update({
        where: { id },
        data: { isFlagged: true },
      });

      await logAuditEvent({
        actorId: adminId,
        actorEmail: req.user!.email,
        actorRole: "super_admin",
        ipAddress: getClientIp(req),
        actionType: ActionType.FLAG_PROMOTION,
        entityType: EntityType.PROMOTION,
        entityId: id,
        description: `Flagged promotion "${promotion.title}" from restaurant ${promotion.restaurant.restaurantName}. Reason: ${reason}`,
        metadata: {
          promotion_id: id,
          promotion_title: promotion.title,
          restaurant_id: promotion.restaurantId,
          restaurant_name: promotion.restaurant.restaurantName,
          reason,
        },
      });

      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: promotion.restaurant.userId,
          type: "alert",
          title: "Promotion Flagged by Admin",
          body: `Your promotion "${promotion.title}" has been flagged by administration. Reason: ${reason}`,
        },
      });

      res.json({
        message: "Promotion flagged successfully",
        promotion: updatedPromotion,
      });
    } catch (error: any) {
      console.error("Flag promotion error:", error);
      res.status(500).json({ error: error.message || "Failed to flag promotion" });
    }
  }
);

// POST /api/admin/promotions/:id/disable - Disable a promotion
router.post(
  "/promotions/:id/disable",
  checkPermission(Permission.MODERATE_PROMOTIONS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user!.userId;

      if (!reason) {
        return res.status(400).json({ error: "Reason is required" });
      }

      const promotion = await prisma.promotion.findUnique({
        where: { id },
        include: {
          restaurant: {
            include: { user: true },
          },
        },
      });

      if (!promotion) {
        return res.status(404).json({ error: "Promotion not found" });
      }

      const updatedPromotion = await prisma.promotion.update({
        where: { id },
        data: { isActive: false },
      });

      await logAuditEvent({
        actorId: adminId,
        actorEmail: req.user!.email,
        actorRole: "super_admin",
        ipAddress: getClientIp(req),
        actionType: ActionType.DISABLE_PROMOTION,
        entityType: EntityType.PROMOTION,
        entityId: id,
        description: `Disabled promotion "${promotion.title}" from restaurant ${promotion.restaurant.restaurantName}. Reason: ${reason}`,
        metadata: {
          promotion_id: id,
          promotion_title: promotion.title,
          restaurant_id: promotion.restaurantId,
          restaurant_name: promotion.restaurant.restaurantName,
          reason,
        },
      });

      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: promotion.restaurant.userId,
          type: "alert",
          title: "Promotion Disabled by Admin",
          body: `Your promotion "${promotion.title}" has been disabled by administration. Reason: ${reason}`,
        },
      });

      res.json({
        message: "Promotion disabled successfully",
        promotion: updatedPromotion,
      });
    } catch (error: any) {
      console.error("Disable promotion error:", error);
      res.status(500).json({ error: error.message || "Failed to disable promotion" });
    }
  }
);

// GET /api/admin/coupons - List all coupons
router.get(
  "/coupons",
  checkPermission(Permission.MODERATE_PROMOTIONS),
  async (req: AuthRequest, res) => {
    try {
      const { restaurantId, isActive, isFlagged, page = "1", limit = "50" } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};
      if (restaurantId) where.restaurantId = restaurantId as string;
      if (isActive !== undefined) where.isActive = isActive === "true";
      if (isFlagged !== undefined) where.isFlagged = isFlagged === "true";

      const [coupons, total] = await Promise.all([
        prisma.coupon.findMany({
          where,
          include: {
            restaurant: {
              select: {
                id: true,
                restaurantName: true,
                user: { select: { email: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
        }),
        prisma.coupon.count({ where }),
      ]);

      res.json({
        coupons: coupons.map(c => ({
          ...c,
          discountPercentage: c.discountPercentage ? Number(c.discountPercentage) : null,
          discountValue: c.discountValue ? Number(c.discountValue) : null,
          minOrderAmount: c.minOrderAmount ? Number(c.minOrderAmount) : null,
          maxDiscountCap: c.maxDiscountCap ? Number(c.maxDiscountCap) : null,
        })),
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      console.error("Get coupons error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch coupons" });
    }
  }
);

// POST /api/admin/coupons/:id/flag - Flag a coupon
router.post(
  "/coupons/:id/flag",
  checkPermission(Permission.MODERATE_PROMOTIONS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user!.userId;

      if (!reason) {
        return res.status(400).json({ error: "Reason is required" });
      }

      const coupon = await prisma.coupon.findUnique({
        where: { id },
        include: {
          restaurant: {
            include: { user: true },
          },
        },
      });

      if (!coupon) {
        return res.status(404).json({ error: "Coupon not found" });
      }

      const updatedCoupon = await prisma.coupon.update({
        where: { id },
        data: { isFlagged: true },
      });

      await logAuditEvent({
        actorId: adminId,
        actorEmail: req.user!.email,
        actorRole: "super_admin",
        ipAddress: getClientIp(req),
        actionType: ActionType.FLAG_COUPON,
        entityType: EntityType.COUPON,
        entityId: id,
        description: `Flagged coupon "${coupon.code}" from restaurant ${coupon.restaurant.restaurantName}. Reason: ${reason}`,
        metadata: {
          coupon_id: id,
          coupon_code: coupon.code,
          restaurant_id: coupon.restaurantId,
          restaurant_name: coupon.restaurant.restaurantName,
          reason,
        },
      });

      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: coupon.restaurant.userId,
          type: "alert",
          title: "Coupon Flagged by Admin",
          body: `Your coupon "${coupon.code}" has been flagged by administration. Reason: ${reason}`,
        },
      });

      res.json({
        message: "Coupon flagged successfully",
        coupon: updatedCoupon,
      });
    } catch (error: any) {
      console.error("Flag coupon error:", error);
      res.status(500).json({ error: error.message || "Failed to flag coupon" });
    }
  }
);

// ====================================================
// PHASE 8: Restaurant Review & Rating Management System
// ====================================================

// GET /api/admin/reviews - Get all reviews with filters
router.get(
  "/reviews",
  checkPermission(Permission.MODERATE_PROMOTIONS),
  async (req: AuthRequest, res) => {
    try {
      const { page = "1", limit = "20", restaurantId, rating, isHidden, isFlagged } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};
      if (restaurantId) where.restaurantId = restaurantId;
      if (rating) where.rating = parseInt(rating as string);
      if (isHidden !== undefined) where.isHidden = isHidden === "true";
      if (isFlagged !== undefined) where.isFlagged = isFlagged === "true";

      const [reviews, total] = await Promise.all([
        prisma.review.findMany({
          where,
          include: {
            restaurant: {
              select: {
                id: true,
                restaurantName: true,
                // No email included - only needed for moderation actions, not listing
              },
            },
            customer: {
              include: {
                user: { select: { email: true } },
              },
            },
            order: {
              select: {
                id: true,
                createdAt: true,
                deliveredAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
        }),
        prisma.review.count({ where }),
      ]);

      res.json({
        reviews: reviews.map((r: any) => ({
          id: r.id,
          orderId: r.orderId,
          orderDate: r.order.createdAt,
          deliveredAt: r.order.deliveredAt,
          restaurantId: r.restaurantId,
          restaurantName: r.restaurant.restaurantName,
          // JUSTIFICATION: Customer email required for admin moderation (audit logs, identifying problem users)
          customerId: r.customerId,
          customerEmail: r.customer.user.email,
          rating: r.rating,
          reviewText: r.reviewText,
          images: r.images,
          isHidden: r.isHidden,
          hiddenByAdminId: r.hiddenByAdminId,
          hiddenAt: r.hiddenAt,
          hideReason: r.hideReason,
          isFlagged: r.isFlagged,
          flaggedByAdminId: r.flaggedByAdminId,
          flaggedAt: r.flaggedAt,
          flagReason: r.flagReason,
          createdAt: r.createdAt,
        })),
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      console.error("Get reviews error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch reviews" });
    }
  }
);

// POST /api/admin/reviews/:id/hide - Hide a review
router.post(
  "/reviews/:id/hide",
  checkPermission(Permission.MODERATE_PROMOTIONS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user!.userId;

      if (!reason) {
        return res.status(400).json({ error: "Reason is required" });
      }

      const review = await prisma.review.findUnique({
        where: { id },
        include: {
          restaurant: {
            include: { user: true },
          },
          customer: {
            include: { user: true },
          },
        },
      });

      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }

      if (review.isHidden) {
        return res.status(400).json({ error: "Review is already hidden" });
      }

      const updatedReview = await prisma.review.update({
        where: { id },
        data: {
          isHidden: true,
          hiddenByAdminId: adminId,
          hiddenAt: new Date(),
          hideReason: reason,
        },
      });

      await logAuditEvent({
        actorId: adminId,
        actorEmail: req.user!.email,
        actorRole: "super_admin",
        ipAddress: getClientIp(req),
        actionType: ActionType.HIDE_REVIEW,
        entityType: EntityType.REVIEW,
        entityId: id,
        description: `Hid review from ${review.customer.user.email} for restaurant ${review.restaurant.restaurantName}. Reason: ${reason}`,
        metadata: {
          review_id: id,
          restaurant_id: review.restaurantId,
          restaurant_name: review.restaurant.restaurantName,
          customer_email: review.customer.user.email,
          rating: review.rating,
          reason,
        },
      });

      res.json({
        message: "Review hidden successfully",
        review: updatedReview,
      });
    } catch (error: any) {
      console.error("Hide review error:", error);
      res.status(500).json({ error: error.message || "Failed to hide review" });
    }
  }
);

// POST /api/admin/reviews/:id/restore - Restore a hidden review
router.post(
  "/reviews/:id/restore",
  checkPermission(Permission.MODERATE_PROMOTIONS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user!.userId;

      const review = await prisma.review.findUnique({
        where: { id },
        include: {
          restaurant: {
            include: { user: true },
          },
          customer: {
            include: { user: true },
          },
        },
      });

      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }

      if (!review.isHidden) {
        return res.status(400).json({ error: "Review is not hidden" });
      }

      const updatedReview = await prisma.review.update({
        where: { id },
        data: {
          isHidden: false,
          hiddenByAdminId: null,
          hiddenAt: null,
          hideReason: null,
        },
      });

      await logAuditEvent({
        actorId: adminId,
        actorEmail: req.user!.email,
        actorRole: "super_admin",
        ipAddress: getClientIp(req),
        actionType: ActionType.RESTORE_REVIEW,
        entityType: EntityType.REVIEW,
        entityId: id,
        description: `Restored review from ${review.customer.user.email} for restaurant ${review.restaurant.restaurantName}`,
        metadata: {
          review_id: id,
          restaurant_id: review.restaurantId,
          restaurant_name: review.restaurant.restaurantName,
          customer_email: review.customer.user.email,
          rating: review.rating,
        },
      });

      res.json({
        message: "Review restored successfully",
        review: updatedReview,
      });
    } catch (error: any) {
      console.error("Restore review error:", error);
      res.status(500).json({ error: error.message || "Failed to restore review" });
    }
  }
);

// POST /api/admin/reviews/:id/flag - Flag a review
router.post(
  "/reviews/:id/flag",
  checkPermission(Permission.MODERATE_PROMOTIONS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user!.userId;

      if (!reason) {
        return res.status(400).json({ error: "Reason is required" });
      }

      const review = await prisma.review.findUnique({
        where: { id },
        include: {
          restaurant: {
            include: { user: true },
          },
          customer: {
            include: { user: true },
          },
        },
      });

      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }

      const updatedReview = await prisma.review.update({
        where: { id },
        data: {
          isFlagged: true,
          flaggedByAdminId: adminId,
          flaggedAt: new Date(),
          flagReason: reason,
        },
      });

      await logAuditEvent({
        actorId: adminId,
        actorEmail: req.user!.email,
        actorRole: "super_admin",
        ipAddress: getClientIp(req),
        actionType: ActionType.FLAG_REVIEW,
        entityType: EntityType.REVIEW,
        entityId: id,
        description: `Flagged review from ${review.customer.user.email} for restaurant ${review.restaurant.restaurantName}. Reason: ${reason}`,
        metadata: {
          review_id: id,
          restaurant_id: review.restaurantId,
          restaurant_name: review.restaurant.restaurantName,
          customer_email: review.customer.user.email,
          rating: review.rating,
          reason,
        },
      });

      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: review.restaurant.userId,
          type: "alert",
          title: "Review Flagged by Admin",
          body: `A review for your restaurant has been flagged by administration. Reason: ${reason}`,
        },
      });

      res.json({
        message: "Review flagged successfully",
        review: updatedReview,
      });
    } catch (error: any) {
      console.error("Flag review error:", error);
      res.status(500).json({ error: error.message || "Failed to flag review" });
    }
  }
);

// ====================================================
// PHASE 9: Restaurant Media Gallery Moderation
// ====================================================

// GET /api/admin/media - Get all restaurant media with filters
router.get("/media", async (req: AuthRequest, res) => {
  try {
    const adminId = req.user!.userId;
    const { 
      category, 
      isHidden, 
      isFlagged, 
      restaurantId,
      page = "1", 
      limit = "20" 
    } = req.query;

    const where: any = {};

    if (category && category !== "all") {
      where.category = category;
    }
    
    if (isHidden === "hidden") {
      where.isHidden = true;
    } else if (isHidden === "visible") {
      where.isHidden = false;
    }

    if (isFlagged === "flagged") {
      where.isFlagged = true;
    } else if (isFlagged === "unflagged") {
      where.isFlagged = false;
    }

    if (restaurantId && restaurantId !== "all") {
      where.restaurantId = restaurantId;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [media, total] = await Promise.all([
      prisma.restaurantMedia.findMany({
        where,
        include: {
          restaurant: {
            include: {
              user: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.restaurantMedia.count({ where }),
    ]);

    const formattedMedia = media.map((m: any) => ({
      id: m.id,
      restaurantId: m.restaurantId,
      restaurantName: m.restaurant.restaurantName,
      restaurantEmail: m.restaurant.user.email,
      filePath: m.filePath,
      fileUrl: m.fileUrl,
      fileType: m.fileType,
      category: m.category,
      displayOrder: m.displayOrder,
      isHidden: m.isHidden,
      hiddenByAdminId: m.hiddenByAdminId,
      hiddenAt: m.hiddenAt,
      hideReason: m.hideReason,
      isFlagged: m.isFlagged,
      flaggedByAdminId: m.flaggedByAdminId,
      flaggedAt: m.flaggedAt,
      flagReason: m.flagReason,
      createdAt: m.createdAt,
    }));

    res.json({
      media: formattedMedia,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error("Get media error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch media" });
  }
});

// POST /api/admin/media/:id/hide - Hide media
router.post(
  "/media/:id/hide",
  async (req: AuthRequest, res) => {
    try {
      const adminId = req.user!.userId;
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({ error: "Hide reason is required" });
      }

      const media = await prisma.restaurantMedia.findUnique({
        where: { id },
        include: {
          restaurant: {
            include: { user: true },
          },
        },
      });

      if (!media) {
        return res.status(404).json({ error: "Media not found" });
      }

      const updatedMedia = await prisma.restaurantMedia.update({
        where: { id },
        data: {
          isHidden: true,
          hiddenByAdminId: adminId,
          hiddenAt: new Date(),
          hideReason: reason,
        },
      });

      await logAuditEvent({
        actorId: adminId,
        actorEmail: req.user!.email,
        actorRole: "super_admin",
        ipAddress: getClientIp(req),
        actionType: ActionType.MODERATE_CONTENT,
        entityType: EntityType.RESTAURANT,
        entityId: media.restaurantId,
        description: `Hid restaurant media (${media.category}) for ${media.restaurant.restaurantName}. Reason: ${reason}`,
        metadata: {
          media_id: id,
          restaurant_id: media.restaurantId,
          restaurant_name: media.restaurant.restaurantName,
          category: media.category,
          reason,
        },
      });

      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: media.restaurant.userId,
          type: "alert",
          title: "Media Hidden by Admin",
          body: `One of your gallery images has been hidden by administration. Reason: ${reason}`,
        },
      });

      res.json({
        message: "Media hidden successfully",
        media: updatedMedia,
      });
    } catch (error: any) {
      console.error("Hide media error:", error);
      res.status(500).json({ error: error.message || "Failed to hide media" });
    }
  }
);

// POST /api/admin/media/:id/unhide - Unhide media
router.post(
  "/media/:id/unhide",
  async (req: AuthRequest, res) => {
    try {
      const adminId = req.user!.userId;
      const { id } = req.params;

      const media = await prisma.restaurantMedia.findUnique({
        where: { id },
        include: {
          restaurant: {
            include: { user: true },
          },
        },
      });

      if (!media) {
        return res.status(404).json({ error: "Media not found" });
      }

      const updatedMedia = await prisma.restaurantMedia.update({
        where: { id },
        data: {
          isHidden: false,
          hiddenByAdminId: null,
          hiddenAt: null,
          hideReason: null,
        },
      });

      await logAuditEvent({
        actorId: adminId,
        actorEmail: req.user!.email,
        actorRole: "super_admin",
        ipAddress: getClientIp(req),
        actionType: ActionType.MODERATE_CONTENT,
        entityType: EntityType.RESTAURANT,
        entityId: media.restaurantId,
        description: `Restored restaurant media (${media.category}) for ${media.restaurant.restaurantName}`,
        metadata: {
          media_id: id,
          restaurant_id: media.restaurantId,
          restaurant_name: media.restaurant.restaurantName,
          category: media.category,
        },
      });

      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: media.restaurant.userId,
          type: "info",
          title: "Media Restored",
          body: `One of your gallery images has been restored and is now visible again.`,
        },
      });

      res.json({
        message: "Media restored successfully",
        media: updatedMedia,
      });
    } catch (error: any) {
      console.error("Unhide media error:", error);
      res.status(500).json({ error: error.message || "Failed to unhide media" });
    }
  }
);

// POST /api/admin/media/:id/flag - Flag media
router.post(
  "/media/:id/flag",
  async (req: AuthRequest, res) => {
    try {
      const adminId = req.user!.userId;
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({ error: "Flag reason is required" });
      }

      const media = await prisma.restaurantMedia.findUnique({
        where: { id },
        include: {
          restaurant: {
            include: { user: true },
          },
        },
      });

      if (!media) {
        return res.status(404).json({ error: "Media not found" });
      }

      const updatedMedia = await prisma.restaurantMedia.update({
        where: { id },
        data: {
          isFlagged: true,
          flaggedByAdminId: adminId,
          flaggedAt: new Date(),
          flagReason: reason,
        },
      });

      await logAuditEvent({
        actorId: adminId,
        actorEmail: req.user!.email,
        actorRole: "super_admin",
        ipAddress: getClientIp(req),
        actionType: ActionType.MODERATE_CONTENT,
        entityType: EntityType.RESTAURANT,
        entityId: media.restaurantId,
        description: `Flagged restaurant media (${media.category}) for ${media.restaurant.restaurantName}. Reason: ${reason}`,
        metadata: {
          media_id: id,
          restaurant_id: media.restaurantId,
          restaurant_name: media.restaurant.restaurantName,
          category: media.category,
          reason,
        },
      });

      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: media.restaurant.userId,
          type: "alert",
          title: "Media Flagged by Admin",
          body: `One of your gallery images has been flagged by administration. Reason: ${reason}`,
        },
      });

      res.json({
        message: "Media flagged successfully",
        media: updatedMedia,
      });
    } catch (error: any) {
      console.error("Flag media error:", error);
      res.status(500).json({ error: error.message || "Failed to flag media" });
    }
  }
);

// ====================================================
// Mount Analytics Routes
// ====================================================
router.use("/analytics", analyticsRouter);

// ====================================================
// Mount Performance Routes
// ====================================================
router.use("/performance", performanceRouter);

// ====================================================
// D5: DRIVER PROMOTIONS & INCENTIVES SYSTEM (Admin CRUD)
// ====================================================

const createPromotionSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  type: z.enum(["PER_TRIP_BONUS", "QUEST_TRIPS", "EARNINGS_THRESHOLD"]),
  serviceType: z.enum(["RIDES", "FOOD", "PARCEL", "ANY"]).default("ANY"),
  countryCode: z.string().length(2).optional().nullable(),
  cityCode: z.string().optional().nullable(),
  minDriverRating: z.number().min(0).max(5).optional().nullable(),
  requireKycApproved: z.boolean().default(true),
  startAt: z.string().refine((s) => !isNaN(Date.parse(s)), { message: "Invalid date format" }),
  endAt: z.string().refine((s) => !isNaN(Date.parse(s)), { message: "Invalid date format" }),
  rewardPerUnit: z.number().positive("Reward must be positive"),
  targetTrips: z.number().int().positive().optional().nullable(),
  targetEarnings: z.number().positive().optional().nullable(),
  maxRewardPerDriver: z.number().positive().optional().nullable(),
  globalBudget: z.number().positive().optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ENDED"]).default("DRAFT"),
});

const updatePromotionSchema = createPromotionSchema.partial();

function serializeDecimal(value: any): number {
  if (value === null || value === undefined) return 0;
  return parseFloat(value.toString());
}

function serializePromotion(promo: any) {
  return {
    ...promo,
    rewardPerUnit: serializeDecimal(promo.rewardPerUnit),
    targetEarnings: promo.targetEarnings ? serializeDecimal(promo.targetEarnings) : null,
    maxRewardPerDriver: promo.maxRewardPerDriver ? serializeDecimal(promo.maxRewardPerDriver) : null,
    globalBudget: promo.globalBudget ? serializeDecimal(promo.globalBudget) : null,
    currentSpend: serializeDecimal(promo.currentSpend),
    minDriverRating: promo.minDriverRating ? serializeDecimal(promo.minDriverRating) : null,
  };
}

// GET /api/admin/driver-promotions - List all driver promotions
router.get(
  "/driver-promotions",
  checkPermission(Permission.MANAGE_EARNINGS),
  async (req: AuthRequest, res) => {
    try {
      const { status, type, countryCode, page = "1", limit = "20" } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 100);

      const where: any = {};
      if (status) where.status = status;
      if (type) where.type = type;
      if (countryCode) where.countryCode = countryCode;

      const [promotions, total] = await Promise.all([
        prisma.driverPromotion.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
          include: {
            _count: {
              select: {
                progress: true,
                payouts: true,
              },
            },
          },
        }),
        prisma.driverPromotion.count({ where }),
      ]);

      res.json({
        promotions: promotions.map(serializePromotion),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      console.error("Error fetching driver promotions:", error);
      res.status(500).json({ error: error.message || "Failed to fetch promotions" });
    }
  }
);

// GET /api/admin/driver-promotions/:id - Get single promotion with stats
router.get(
  "/driver-promotions/:id",
  checkPermission(Permission.MANAGE_EARNINGS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const promotion = await prisma.driverPromotion.findUnique({
        where: { id },
        include: {
          progress: {
            orderBy: { totalBonusEarned: "desc" },
            take: 10,
            include: {
              driver: {
                select: {
                  id: true,
                  fullName: true,
                  firstName: true,
                  lastName: true,
                  profilePhotoUrl: true,
                  user: {
                    select: { email: true },
                  },
                },
              },
            },
          },
          payouts: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
          _count: {
            select: {
              progress: true,
              payouts: true,
            },
          },
        },
      });

      if (!promotion) {
        return res.status(404).json({ error: "Promotion not found" });
      }

      const stats = await prisma.driverPromotionPayout.aggregate({
        where: { promotionId: id },
        _sum: { amount: true },
        _count: true,
      });

      res.json({
        promotion: serializePromotion(promotion),
        stats: {
          totalPaidOut: serializeDecimal(stats._sum.amount),
          totalPayouts: stats._count,
          participatingDrivers: promotion._count.progress,
        },
      });
    } catch (error: any) {
      console.error("Error fetching driver promotion:", error);
      res.status(500).json({ error: error.message || "Failed to fetch promotion" });
    }
  }
);

// POST /api/admin/driver-promotions - Create new promotion
router.post(
  "/driver-promotions",
  checkPermission(Permission.MANAGE_EARNINGS),
  async (req: AuthRequest, res) => {
    try {
      const validation = createPromotionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validation.error.errors 
        });
      }

      const data = validation.data;
      const adminId = req.adminUser?.id;

      // Validate type-specific requirements
      if (data.type === "QUEST_TRIPS" && !data.targetTrips) {
        return res.status(400).json({ error: "QUEST_TRIPS type requires targetTrips" });
      }
      if (data.type === "EARNINGS_THRESHOLD" && !data.targetEarnings) {
        return res.status(400).json({ error: "EARNINGS_THRESHOLD type requires targetEarnings" });
      }

      const promotion = await prisma.driverPromotion.create({
        data: {
          name: data.name,
          description: data.description,
          type: data.type,
          serviceType: data.serviceType,
          countryCode: data.countryCode,
          cityCode: data.cityCode,
          minDriverRating: data.minDriverRating,
          requireKycApproved: data.requireKycApproved,
          startAt: new Date(data.startAt),
          endAt: new Date(data.endAt),
          rewardPerUnit: data.rewardPerUnit,
          targetTrips: data.targetTrips,
          targetEarnings: data.targetEarnings,
          maxRewardPerDriver: data.maxRewardPerDriver,
          globalBudget: data.globalBudget,
          status: data.status,
          createdByAdminId: adminId,
        },
      });

      await logAuditEvent({
        actorId: adminId || "",
        actorEmail: req.user!.email,
        actorRole: req.adminUser?.adminRole || "SUPER_ADMIN",
        ipAddress: getClientIp(req),
        actionType: ActionType.CREATE,
        entityType: EntityType.DRIVER,
        entityId: promotion.id,
        description: `Created driver promotion: ${promotion.name}`,
        metadata: { promotion_id: promotion.id, type: promotion.type },
      });

      res.status(201).json({ 
        message: "Promotion created successfully", 
        promotion: serializePromotion(promotion) 
      });
    } catch (error: any) {
      console.error("Error creating driver promotion:", error);
      res.status(500).json({ error: error.message || "Failed to create promotion" });
    }
  }
);

// PATCH /api/admin/driver-promotions/:id - Update promotion
router.patch(
  "/driver-promotions/:id",
  checkPermission(Permission.MANAGE_EARNINGS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const validation = updatePromotionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validation.error.errors 
        });
      }

      const existing = await prisma.driverPromotion.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: "Promotion not found" });
      }

      const data = validation.data;
      const adminId = req.adminUser?.id;

      const promotion = await prisma.driverPromotion.update({
        where: { id },
        data: {
          ...data,
          startAt: data.startAt ? new Date(data.startAt) : undefined,
          endAt: data.endAt ? new Date(data.endAt) : undefined,
          updatedByAdminId: adminId,
        },
      });

      await logAuditEvent({
        actorId: adminId || "",
        actorEmail: req.user!.email,
        actorRole: req.adminUser?.adminRole || "SUPER_ADMIN",
        ipAddress: getClientIp(req),
        actionType: ActionType.UPDATE,
        entityType: EntityType.DRIVER,
        entityId: promotion.id,
        description: `Updated driver promotion: ${promotion.name}`,
        metadata: { promotion_id: promotion.id, changes: Object.keys(data) },
      });

      res.json({ 
        message: "Promotion updated successfully", 
        promotion: serializePromotion(promotion) 
      });
    } catch (error: any) {
      console.error("Error updating driver promotion:", error);
      res.status(500).json({ error: error.message || "Failed to update promotion" });
    }
  }
);

// POST /api/admin/driver-promotions/:id/activate - Activate promotion
router.post(
  "/driver-promotions/:id/activate",
  checkPermission(Permission.MANAGE_EARNINGS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const adminId = req.adminUser?.id;

      const existing = await prisma.driverPromotion.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: "Promotion not found" });
      }

      if (existing.status === "ACTIVE") {
        return res.status(400).json({ error: "Promotion is already active" });
      }

      const promotion = await prisma.driverPromotion.update({
        where: { id },
        data: {
          status: "ACTIVE",
          updatedByAdminId: adminId,
        },
      });

      await logAuditEvent({
        actorId: adminId || "",
        actorEmail: req.user!.email,
        actorRole: req.adminUser?.adminRole || "SUPER_ADMIN",
        ipAddress: getClientIp(req),
        actionType: ActionType.UPDATE,
        entityType: EntityType.DRIVER,
        entityId: promotion.id,
        description: `Activated driver promotion: ${promotion.name}`,
        metadata: { promotion_id: promotion.id },
      });

      res.json({ 
        message: "Promotion activated successfully", 
        promotion: serializePromotion(promotion) 
      });
    } catch (error: any) {
      console.error("Error activating driver promotion:", error);
      res.status(500).json({ error: error.message || "Failed to activate promotion" });
    }
  }
);

// POST /api/admin/driver-promotions/:id/pause - Pause promotion
router.post(
  "/driver-promotions/:id/pause",
  checkPermission(Permission.MANAGE_EARNINGS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const adminId = req.adminUser?.id;

      const existing = await prisma.driverPromotion.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: "Promotion not found" });
      }

      const promotion = await prisma.driverPromotion.update({
        where: { id },
        data: {
          status: "PAUSED",
          updatedByAdminId: adminId,
        },
      });

      await logAuditEvent({
        actorId: adminId || "",
        actorEmail: req.user!.email,
        actorRole: req.adminUser?.adminRole || "SUPER_ADMIN",
        ipAddress: getClientIp(req),
        actionType: ActionType.UPDATE,
        entityType: EntityType.DRIVER,
        entityId: promotion.id,
        description: `Paused driver promotion: ${promotion.name}`,
        metadata: { promotion_id: promotion.id },
      });

      res.json({ 
        message: "Promotion paused successfully", 
        promotion: serializePromotion(promotion) 
      });
    } catch (error: any) {
      console.error("Error pausing driver promotion:", error);
      res.status(500).json({ error: error.message || "Failed to pause promotion" });
    }
  }
);

// POST /api/admin/driver-promotions/:id/end - End promotion
router.post(
  "/driver-promotions/:id/end",
  checkPermission(Permission.MANAGE_EARNINGS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const adminId = req.adminUser?.id;

      const existing = await prisma.driverPromotion.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: "Promotion not found" });
      }

      const promotion = await prisma.driverPromotion.update({
        where: { id },
        data: {
          status: "ENDED",
          updatedByAdminId: adminId,
        },
      });

      await logAuditEvent({
        actorId: adminId || "",
        actorEmail: req.user!.email,
        actorRole: req.adminUser?.adminRole || "SUPER_ADMIN",
        ipAddress: getClientIp(req),
        actionType: ActionType.UPDATE,
        entityType: EntityType.DRIVER,
        entityId: promotion.id,
        description: `Ended driver promotion: ${promotion.name}`,
        metadata: { promotion_id: promotion.id },
      });

      res.json({ 
        message: "Promotion ended successfully", 
        promotion: serializePromotion(promotion) 
      });
    } catch (error: any) {
      console.error("Error ending driver promotion:", error);
      res.status(500).json({ error: error.message || "Failed to end promotion" });
    }
  }
);

// DELETE /api/admin/driver-promotions/:id - Delete promotion (only if DRAFT)
router.delete(
  "/driver-promotions/:id",
  checkPermission(Permission.MANAGE_EARNINGS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const adminId = req.adminUser?.id;

      const existing = await prisma.driverPromotion.findUnique({
        where: { id },
        include: {
          _count: {
            select: { payouts: true },
          },
        },
      });

      if (!existing) {
        return res.status(404).json({ error: "Promotion not found" });
      }

      if (existing.status !== "DRAFT" && existing._count.payouts > 0) {
        return res.status(400).json({ 
          error: "Cannot delete a promotion that has been active and has payouts. Use 'End' instead." 
        });
      }

      await prisma.driverPromotion.delete({
        where: { id },
      });

      await logAuditEvent({
        actorId: adminId || "",
        actorEmail: req.user!.email,
        actorRole: req.adminUser?.adminRole || "SUPER_ADMIN",
        ipAddress: getClientIp(req),
        actionType: ActionType.DELETE,
        entityType: EntityType.DRIVER,
        entityId: id,
        description: `Deleted driver promotion: ${existing.name}`,
        metadata: { promotion_id: id },
      });

      res.json({ message: "Promotion deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting driver promotion:", error);
      res.status(500).json({ error: error.message || "Failed to delete promotion" });
    }
  }
);

// GET /api/admin/driver-promotions/:id/payouts - Get promotion payouts
router.get(
  "/driver-promotions/:id/payouts",
  checkPermission(Permission.MANAGE_EARNINGS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { page = "1", limit = "50" } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 100);

      const [payouts, total] = await Promise.all([
        prisma.driverPromotionPayout.findMany({
          where: { promotionId: id },
          orderBy: { createdAt: "desc" },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
          include: {
            driver: {
              select: {
                id: true,
                fullName: true,
                firstName: true,
                lastName: true,
                profilePhotoUrl: true,
                user: {
                  select: { email: true, countryCode: true },
                },
              },
            },
          },
        }),
        prisma.driverPromotionPayout.count({ where: { promotionId: id } }),
      ]);

      res.json({
        payouts: payouts.map((p: any) => ({
          ...p,
          amount: serializeDecimal(p.amount),
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      console.error("Error fetching promotion payouts:", error);
      res.status(500).json({ error: error.message || "Failed to fetch payouts" });
    }
  }
);

// ============================================
// RIDE PROMOTION MANAGEMENT (C6)
// ============================================

// GET /api/admin/ride-promotions - List all ride promotions
router.get(
  "/ride-promotions",
  checkPermission(Permission.VIEW_SETTINGS),
  async (req: AuthRequest, res) => {
    try {
      const { isActive, page = "1", limit = "50" } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 100);

      const where: any = {};
      if (isActive !== undefined) {
        where.isActive = isActive === "true";
      }

      const [promotions, total] = await Promise.all([
        prisma.ridePromotion.findMany({
          where,
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
          orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
          include: {
            _count: { select: { usages: true } },
          },
        }),
        prisma.ridePromotion.count({ where }),
      ]);

      res.json({
        promotions: promotions.map((p: any) => ({
          ...p,
          value: serializeDecimal(p.value),
          maxDiscountAmount: p.maxDiscountAmount ? serializeDecimal(p.maxDiscountAmount) : null,
          maxSurgeAllowed: p.maxSurgeAllowed ? serializeDecimal(p.maxSurgeAllowed) : null,
          usageCount: p._count.usages,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      console.error("Error fetching ride promotions:", error);
      res.status(500).json({ error: error.message || "Failed to fetch promotions" });
    }
  }
);

// POST /api/admin/ride-promotions - Create a new ride promotion
router.post(
  "/ride-promotions",
  checkPermission(Permission.MANAGE_SETTINGS),
  async (req: AuthRequest, res) => {
    try {
      const {
        name,
        description,
        discountType,
        value,
        maxDiscountAmount,
        appliesTo,
        targetCities,
        targetCategories,
        targetUserSegments,
        userRule,
        rideCountLimit,
        maxSurgeAllowed,
        startAt,
        endAt,
        globalUsageLimit,
        usagePerUserLimit,
        isActive,
        priority,
      } = req.body;

      if (!name || !discountType || value === undefined || !appliesTo || !userRule) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const promotion = await prisma.ridePromotion.create({
        data: {
          name,
          description,
          discountType,
          value,
          maxDiscountAmount: maxDiscountAmount || null,
          appliesTo,
          targetCities: targetCities || [],
          targetCategories: targetCategories || [],
          targetUserSegments: targetUserSegments || [],
          userRule,
          rideCountLimit: rideCountLimit || null,
          maxSurgeAllowed: maxSurgeAllowed || null,
          startAt: startAt ? new Date(startAt) : new Date(),
          endAt: endAt ? new Date(endAt) : null,
          globalUsageLimit: globalUsageLimit || null,
          usagePerUserLimit: usagePerUserLimit || null,
          isActive: isActive ?? true,
          priority: priority ?? 0,
          createdBy: req.user?.id,
        },
      });

      await logAudit({
        entityType: "ride_promotion",
        entityId: promotion.id,
        action: "CREATE",
        actorId: req.user?.id || "system",
        actorRole: "admin",
        changes: { created: promotion },
      });

      res.status(201).json({
        ...promotion,
        value: serializeDecimal(promotion.value),
        maxDiscountAmount: promotion.maxDiscountAmount ? serializeDecimal(promotion.maxDiscountAmount) : null,
        maxSurgeAllowed: promotion.maxSurgeAllowed ? serializeDecimal(promotion.maxSurgeAllowed) : null,
      });
    } catch (error: any) {
      console.error("Error creating ride promotion:", error);
      res.status(500).json({ error: error.message || "Failed to create promotion" });
    }
  }
);

// GET /api/admin/ride-promotions/:id - Get a specific ride promotion
router.get(
  "/ride-promotions/:id",
  checkPermission(Permission.VIEW_SETTINGS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const promotion = await prisma.ridePromotion.findUnique({
        where: { id },
        include: {
          usages: {
            take: 100,
            orderBy: { appliedAt: "desc" },
          },
          _count: { select: { usages: true } },
        },
      });

      if (!promotion) {
        return res.status(404).json({ error: "Promotion not found" });
      }

      res.json({
        ...promotion,
        value: serializeDecimal(promotion.value),
        maxDiscountAmount: promotion.maxDiscountAmount ? serializeDecimal(promotion.maxDiscountAmount) : null,
        maxSurgeAllowed: promotion.maxSurgeAllowed ? serializeDecimal(promotion.maxSurgeAllowed) : null,
        usageCount: promotion._count.usages,
        usages: promotion.usages.map((u: any) => ({
          ...u,
          discountApplied: serializeDecimal(u.discountApplied),
          originalFare: serializeDecimal(u.originalFare),
          finalFare: serializeDecimal(u.finalFare),
        })),
      });
    } catch (error: any) {
      console.error("Error fetching ride promotion:", error);
      res.status(500).json({ error: error.message || "Failed to fetch promotion" });
    }
  }
);

// PATCH /api/admin/ride-promotions/:id - Update a ride promotion
router.patch(
  "/ride-promotions/:id",
  checkPermission(Permission.MANAGE_SETTINGS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const existing = await prisma.ridePromotion.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: "Promotion not found" });
      }

      const data: any = {};
      if (updates.name !== undefined) data.name = updates.name;
      if (updates.description !== undefined) data.description = updates.description;
      if (updates.discountType !== undefined) data.discountType = updates.discountType;
      if (updates.value !== undefined) data.value = updates.value;
      if (updates.maxDiscountAmount !== undefined) data.maxDiscountAmount = updates.maxDiscountAmount;
      if (updates.appliesTo !== undefined) data.appliesTo = updates.appliesTo;
      if (updates.targetCities !== undefined) data.targetCities = updates.targetCities;
      if (updates.targetCategories !== undefined) data.targetCategories = updates.targetCategories;
      if (updates.targetUserSegments !== undefined) data.targetUserSegments = updates.targetUserSegments;
      if (updates.userRule !== undefined) data.userRule = updates.userRule;
      if (updates.rideCountLimit !== undefined) data.rideCountLimit = updates.rideCountLimit;
      if (updates.maxSurgeAllowed !== undefined) data.maxSurgeAllowed = updates.maxSurgeAllowed;
      if (updates.startAt !== undefined) data.startAt = new Date(updates.startAt);
      if (updates.endAt !== undefined) data.endAt = updates.endAt ? new Date(updates.endAt) : null;
      if (updates.globalUsageLimit !== undefined) data.globalUsageLimit = updates.globalUsageLimit;
      if (updates.usagePerUserLimit !== undefined) data.usagePerUserLimit = updates.usagePerUserLimit;
      if (updates.isActive !== undefined) data.isActive = updates.isActive;
      if (updates.priority !== undefined) data.priority = updates.priority;

      const promotion = await prisma.ridePromotion.update({
        where: { id },
        data,
      });

      await logAudit({
        entityType: "ride_promotion",
        entityId: promotion.id,
        action: "UPDATE",
        actorId: req.user?.id || "system",
        actorRole: "admin",
        changes: { before: existing, after: promotion },
      });

      res.json({
        ...promotion,
        value: serializeDecimal(promotion.value),
        maxDiscountAmount: promotion.maxDiscountAmount ? serializeDecimal(promotion.maxDiscountAmount) : null,
        maxSurgeAllowed: promotion.maxSurgeAllowed ? serializeDecimal(promotion.maxSurgeAllowed) : null,
      });
    } catch (error: any) {
      console.error("Error updating ride promotion:", error);
      res.status(500).json({ error: error.message || "Failed to update promotion" });
    }
  }
);

// DELETE /api/admin/ride-promotions/:id - Delete a ride promotion
router.delete(
  "/ride-promotions/:id",
  checkPermission(Permission.MANAGE_SETTINGS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const existing = await prisma.ridePromotion.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: "Promotion not found" });
      }

      if (existing.isDefault) {
        return res.status(400).json({ error: "Cannot delete default promotion" });
      }

      await prisma.ridePromotionUsage.deleteMany({ where: { promotionId: id } });
      await prisma.ridePromotion.delete({ where: { id } });

      await logAudit({
        entityType: "ride_promotion",
        entityId: id,
        action: "DELETE",
        actorId: req.user?.id || "system",
        actorRole: "admin",
        changes: { deleted: existing },
      });

      res.json({ success: true, message: "Promotion deleted" });
    } catch (error: any) {
      console.error("Error deleting ride promotion:", error);
      res.status(500).json({ error: error.message || "Failed to delete promotion" });
    }
  }
);

// GET /api/admin/ride-promotions/:id/stats - Get promotion statistics
router.get(
  "/ride-promotions/:id/stats",
  checkPermission(Permission.VIEW_SETTINGS),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const usages = await prisma.ridePromotionUsage.findMany({
        where: { promotionId: id },
      });

      const totalDiscountGiven = usages.reduce((sum: number, u: any) => sum + Number(u.discountApplied), 0);
      const totalOriginalFare = usages.reduce((sum: number, u: any) => sum + Number(u.originalFare), 0);
      const uniqueUsers = new Set(usages.map((u: any) => u.userId)).size;

      res.json({
        totalUsages: usages.length,
        uniqueUsers,
        totalDiscountGiven: Math.round(totalDiscountGiven * 100) / 100,
        totalOriginalFare: Math.round(totalOriginalFare * 100) / 100,
        averageDiscount: usages.length > 0 ? Math.round((totalDiscountGiven / usages.length) * 100) / 100 : 0,
      });
    } catch (error: any) {
      console.error("Error fetching promotion stats:", error);
      res.status(500).json({ error: error.message || "Failed to fetch stats" });
    }
  }
);

// POST /api/admin/ride-promotions/init-default - Initialize default promo
router.post(
  "/ride-promotions/init-default",
  checkPermission(Permission.MANAGE_SETTINGS),
  async (req: AuthRequest, res) => {
    try {
      const existingDefault = await prisma.ridePromotion.findFirst({
        where: { isDefault: true, isActive: true },
      });

      if (existingDefault) {
        return res.json({
          success: true,
          message: "Default promotion already exists",
          promotion: {
            ...existingDefault,
            value: serializeDecimal(existingDefault.value),
            maxDiscountAmount: existingDefault.maxDiscountAmount ? serializeDecimal(existingDefault.maxDiscountAmount) : null,
          },
        });
      }

      const promotion = await prisma.ridePromotion.create({
        data: {
          name: "SafeGo Everyday Saver",
          description: "15% SafeGo promo applied",
          discountType: "PERCENT",
          value: 15,
          maxDiscountAmount: 10,
          appliesTo: "ALL",
          userRule: "ALL_RIDES",
          isActive: true,
          isDefault: true,
          priority: 100,
          createdBy: req.user?.id,
        },
      });

      await logAudit({
        entityType: "ride_promotion",
        entityId: promotion.id,
        action: "CREATE",
        actorId: req.user?.id || "system",
        actorRole: "admin",
        changes: { created: promotion, isDefaultPromo: true },
      });

      res.status(201).json({
        success: true,
        message: "Default promotion created",
        promotion: {
          ...promotion,
          value: serializeDecimal(promotion.value),
          maxDiscountAmount: promotion.maxDiscountAmount ? serializeDecimal(promotion.maxDiscountAmount) : null,
        },
      });
    } catch (error: any) {
      console.error("Error initializing default promotion:", error);
      res.status(500).json({ error: error.message || "Failed to initialize default promotion" });
    }
  }
);

// ============================================================
// PHASE 4: ADMIN MONITORING, ANALYTICS, AND FRAUD DETECTION
// ============================================================

import * as adminMonitoringService from "../services/adminMonitoringService";
import { formatCurrency, formatCurrencyByCountry, formatCompactCurrency } from "../../shared/currencyFormatting";

// ====================================================
// GET /api/admin/monitoring/overview
// Real-time monitoring dashboard overview (Task 29)
// ====================================================
router.get("/monitoring/overview", checkPermission(Permission.VIEW_REALTIME_MONITORING), async (req: AuthRequest, res) => {
  try {
    const countryCode = req.query.countryCode as string | undefined;
    const overview = await adminMonitoringService.getMonitoringOverview(countryCode);
    
    res.json({
      success: true,
      data: overview,
    });
  } catch (error: any) {
    console.error("Monitoring overview error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch monitoring overview" });
  }
});

// ====================================================
// GET /api/admin/monitoring/live-map
// Live map data with driver locations and active trips (Task 29)
// ====================================================
router.get("/monitoring/live-map", checkPermission(Permission.VIEW_LIVE_MAP), async (req: AuthRequest, res) => {
  try {
    const countryCode = req.query.countryCode as string | undefined;
    const liveMapData = await adminMonitoringService.getLiveMapData(countryCode);
    
    res.json({
      success: true,
      data: liveMapData,
    });
  } catch (error: any) {
    console.error("Live map error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch live map data" });
  }
});

// ====================================================
// GET /api/admin/monitoring/snapshots
// Historical monitoring snapshots for trend analysis (Task 29)
// ====================================================
router.get("/monitoring/snapshots", checkPermission(Permission.VIEW_REALTIME_MONITORING), async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, countryCode, limit } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    const limitNum = Math.min(Math.max(1, parseInt(limit as string) || 100), 1000);
    
    const snapshots = await adminMonitoringService.getMonitoringSnapshots(
      start,
      end,
      countryCode as string | undefined,
      limitNum
    );
    
    res.json({
      success: true,
      data: snapshots,
      pagination: {
        startDate: start,
        endDate: end,
        count: snapshots.length,
      },
    });
  } catch (error: any) {
    console.error("Monitoring snapshots error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch monitoring snapshots" });
  }
});

// ====================================================
// GET /api/admin/analytics/daily
// Daily revenue analytics (Task 30)
// ====================================================
router.get("/analytics/daily", checkPermission(Permission.VIEW_REVENUE_ANALYTICS), async (req: AuthRequest, res) => {
  try {
    const { date, countryCode, serviceType } = req.query;
    
    const targetDate = date ? new Date(date as string) : new Date();
    targetDate.setUTCHours(0, 0, 0, 0);
    
    const whereClause: any = {
      date: targetDate,
    };
    
    if (countryCode) {
      whereClause.countryCode = String(countryCode).toUpperCase();
    }
    
    if (serviceType && ['ride', 'food', 'parcel'].includes(serviceType as string)) {
      whereClause.serviceType = serviceType;
    }
    
    const analytics = await prisma.analyticsDailyRevenue.findMany({
      where: whereClause,
      orderBy: { serviceType: 'asc' },
    });
    
    const currencyCode = (countryCode as string)?.toUpperCase() === 'BD' ? 'BDT' : 'USD';
    
    const totals = analytics.reduce((acc, a) => ({
      totalFare: acc.totalFare + Number(a.totalFare),
      totalCommission: acc.totalCommission + Number(a.totalCommission),
      totalPartnerPayout: acc.totalPartnerPayout + Number(a.totalPartnerPayout),
      totalOnlinePayments: acc.totalOnlinePayments + Number(a.totalOnlinePayments),
      totalCashCollected: acc.totalCashCollected + Number(a.totalCashCollected),
      totalTrips: acc.totalTrips + a.totalTrips,
      completedTrips: acc.completedTrips + a.completedTrips,
      cancelledTrips: acc.cancelledTrips + a.cancelledTrips,
      totalTips: acc.totalTips + Number(a.totalTips),
      totalRefunds: acc.totalRefunds + Number(a.totalRefunds),
      totalIncentivesPaid: acc.totalIncentivesPaid + Number(a.totalIncentivesPaid),
    }), {
      totalFare: 0,
      totalCommission: 0,
      totalPartnerPayout: 0,
      totalOnlinePayments: 0,
      totalCashCollected: 0,
      totalTrips: 0,
      completedTrips: 0,
      cancelledTrips: 0,
      totalTips: 0,
      totalRefunds: 0,
      totalIncentivesPaid: 0,
    });
    
    res.json({
      success: true,
      date: targetDate,
      countryCode: countryCode || 'ALL',
      currencyCode,
      analytics: analytics.map(a => ({
        ...a,
        totalFare: Number(a.totalFare),
        totalCommission: Number(a.totalCommission),
        totalPartnerPayout: Number(a.totalPartnerPayout),
        totalOnlinePayments: Number(a.totalOnlinePayments),
        totalCashCollected: Number(a.totalCashCollected),
        totalTips: Number(a.totalTips),
        totalRefunds: Number(a.totalRefunds),
        totalIncentivesPaid: Number(a.totalIncentivesPaid),
        totalFareFormatted: formatCurrency(Number(a.totalFare), currencyCode as 'BDT' | 'USD'),
        totalCommissionFormatted: formatCurrency(Number(a.totalCommission), currencyCode as 'BDT' | 'USD'),
      })),
      totals: {
        ...totals,
        totalFareFormatted: formatCurrency(totals.totalFare, currencyCode as 'BDT' | 'USD'),
        totalCommissionFormatted: formatCurrency(totals.totalCommission, currencyCode as 'BDT' | 'USD'),
        totalPartnerPayoutFormatted: formatCurrency(totals.totalPartnerPayout, currencyCode as 'BDT' | 'USD'),
      },
    });
  } catch (error: any) {
    console.error("Daily analytics error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch daily analytics" });
  }
});

// ====================================================
// GET /api/admin/analytics/summary
// Revenue summary for date range (Task 30)
// ====================================================
router.get("/analytics/summary", checkPermission(Permission.VIEW_REVENUE_ANALYTICS), async (req: AuthRequest, res) => {
  try {
    const { range = 'last_7_days', countryCode } = req.query;
    
    let startDate: Date;
    const endDate = new Date();
    endDate.setUTCHours(23, 59, 59, 999);
    
    switch (range) {
      case 'today':
        startDate = new Date();
        startDate.setUTCHours(0, 0, 0, 0);
        break;
      case 'last_7_days':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        startDate.setUTCHours(0, 0, 0, 0);
        break;
      case 'last_30_days':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        startDate.setUTCHours(0, 0, 0, 0);
        break;
      case 'this_month':
        startDate = new Date();
        startDate.setUTCDate(1);
        startDate.setUTCHours(0, 0, 0, 0);
        break;
      case 'last_month':
        startDate = new Date();
        startDate.setUTCMonth(startDate.getUTCMonth() - 1);
        startDate.setUTCDate(1);
        startDate.setUTCHours(0, 0, 0, 0);
        break;
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        startDate.setUTCHours(0, 0, 0, 0);
    }
    
    const whereClause: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };
    
    if (countryCode) {
      whereClause.countryCode = String(countryCode).toUpperCase();
    }
    
    const analytics = await prisma.analyticsDailyRevenue.findMany({
      where: whereClause,
      orderBy: { date: 'asc' },
    });
    
    const currencyCode = (countryCode as string)?.toUpperCase() === 'BD' ? 'BDT' : 'USD';
    
    const dailyData = analytics.reduce((acc: any, a) => {
      const dateKey = a.date.toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          totalFare: 0,
          totalCommission: 0,
          totalPartnerPayout: 0,
          totalTrips: 0,
          completedTrips: 0,
          byService: {},
        };
      }
      acc[dateKey].totalFare += Number(a.totalFare);
      acc[dateKey].totalCommission += Number(a.totalCommission);
      acc[dateKey].totalPartnerPayout += Number(a.totalPartnerPayout);
      acc[dateKey].totalTrips += a.totalTrips;
      acc[dateKey].completedTrips += a.completedTrips;
      acc[dateKey].byService[a.serviceType] = {
        fare: Number(a.totalFare),
        commission: Number(a.totalCommission),
        trips: a.totalTrips,
      };
      return acc;
    }, {});
    
    const totals = Object.values(dailyData).reduce((acc: any, day: any) => ({
      totalFare: acc.totalFare + day.totalFare,
      totalCommission: acc.totalCommission + day.totalCommission,
      totalPartnerPayout: acc.totalPartnerPayout + day.totalPartnerPayout,
      totalTrips: acc.totalTrips + day.totalTrips,
      completedTrips: acc.completedTrips + day.completedTrips,
    }), {
      totalFare: 0,
      totalCommission: 0,
      totalPartnerPayout: 0,
      totalTrips: 0,
      completedTrips: 0,
    });
    
    res.json({
      success: true,
      range,
      startDate,
      endDate,
      countryCode: countryCode || 'ALL',
      currencyCode,
      dailyData: Object.values(dailyData).map((day: any) => ({
        ...day,
        totalFareFormatted: formatCurrency(day.totalFare, currencyCode as 'BDT' | 'USD'),
        totalCommissionFormatted: formatCurrency(day.totalCommission, currencyCode as 'BDT' | 'USD'),
      })),
      totals: {
        ...totals,
        totalFareFormatted: formatCurrency(totals.totalFare, currencyCode as 'BDT' | 'USD'),
        totalCommissionFormatted: formatCurrency(totals.totalCommission, currencyCode as 'BDT' | 'USD'),
        totalPartnerPayoutFormatted: formatCurrency(totals.totalPartnerPayout, currencyCode as 'BDT' | 'USD'),
        averageDailyFare: Object.keys(dailyData).length > 0 
          ? formatCurrency(totals.totalFare / Object.keys(dailyData).length, currencyCode as 'BDT' | 'USD')
          : formatCurrency(0, currencyCode as 'BDT' | 'USD'),
      },
    });
  } catch (error: any) {
    console.error("Analytics summary error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch analytics summary" });
  }
});

// ====================================================
// GET /api/admin/analytics/service-breakdown
// Revenue breakdown by service type (Task 30)
// ====================================================
router.get("/analytics/service-breakdown", checkPermission(Permission.VIEW_REVENUE_ANALYTICS), async (req: AuthRequest, res) => {
  try {
    const { countryCode, startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    start.setUTCHours(0, 0, 0, 0);
    
    const end = endDate ? new Date(endDate as string) : new Date();
    end.setUTCHours(23, 59, 59, 999);
    
    const whereClause: any = {
      date: {
        gte: start,
        lte: end,
      },
    };
    
    if (countryCode) {
      whereClause.countryCode = String(countryCode).toUpperCase();
    }
    
    const analytics = await prisma.analyticsDailyRevenue.groupBy({
      by: ['serviceType'],
      where: whereClause,
      _sum: {
        totalFare: true,
        totalCommission: true,
        totalPartnerPayout: true,
        totalOnlinePayments: true,
        totalCashCollected: true,
        totalTrips: true,
        completedTrips: true,
        cancelledTrips: true,
        totalTips: true,
        totalRefunds: true,
        totalIncentivesPaid: true,
      },
    });
    
    const currencyCode = (countryCode as string)?.toUpperCase() === 'BD' ? 'BDT' : 'USD';
    
    const breakdown = analytics.map((a: any) => ({
      serviceType: a.serviceType,
      totalFare: Number(a._sum.totalFare || 0),
      totalCommission: Number(a._sum.totalCommission || 0),
      totalPartnerPayout: Number(a._sum.totalPartnerPayout || 0),
      totalOnlinePayments: Number(a._sum.totalOnlinePayments || 0),
      totalCashCollected: Number(a._sum.totalCashCollected || 0),
      totalTrips: a._sum.totalTrips || 0,
      completedTrips: a._sum.completedTrips || 0,
      cancelledTrips: a._sum.cancelledTrips || 0,
      totalTips: Number(a._sum.totalTips || 0),
      totalRefunds: Number(a._sum.totalRefunds || 0),
      totalIncentivesPaid: Number(a._sum.totalIncentivesPaid || 0),
      cashOnlineRatio: Number(a._sum.totalOnlinePayments || 0) > 0 
        ? (Number(a._sum.totalCashCollected || 0) / Number(a._sum.totalOnlinePayments || 0)).toFixed(2)
        : 'N/A',
      totalFareFormatted: formatCurrency(Number(a._sum.totalFare || 0), currencyCode as 'BDT' | 'USD'),
      totalCommissionFormatted: formatCurrency(Number(a._sum.totalCommission || 0), currencyCode as 'BDT' | 'USD'),
    }));
    
    const grandTotal = breakdown.reduce((acc: any, b: any) => ({
      totalFare: acc.totalFare + b.totalFare,
      totalCommission: acc.totalCommission + b.totalCommission,
      totalPartnerPayout: acc.totalPartnerPayout + b.totalPartnerPayout,
      totalTrips: acc.totalTrips + b.totalTrips,
    }), { totalFare: 0, totalCommission: 0, totalPartnerPayout: 0, totalTrips: 0 });
    
    res.json({
      success: true,
      startDate: start,
      endDate: end,
      countryCode: countryCode || 'ALL',
      currencyCode,
      breakdown,
      grandTotal: {
        ...grandTotal,
        totalFareFormatted: formatCurrency(grandTotal.totalFare, currencyCode as 'BDT' | 'USD'),
        totalCommissionFormatted: formatCurrency(grandTotal.totalCommission, currencyCode as 'BDT' | 'USD'),
      },
    });
  } catch (error: any) {
    console.error("Service breakdown error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch service breakdown" });
  }
});

// ====================================================
// GET /api/admin/fraud/alerts
// List fraud alerts with filtering (Task 31)
// ====================================================
router.get("/fraud/alerts", checkPermission(Permission.VIEW_FRAUD_ALERTS), async (req: AuthRequest, res) => {
  try {
    const { 
      status, 
      severity, 
      entityType, 
      alertType,
      page = "1", 
      pageSize = "20" 
    } = req.query;
    
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const pageSizeNum = Math.min(Math.max(1, parseInt(pageSize as string) || 20), 100);
    const skip = (pageNum - 1) * pageSizeNum;
    
    const whereClause: any = {};
    
    if (status) {
      whereClause.status = status;
    }
    
    if (severity) {
      whereClause.severity = severity;
    }
    
    if (entityType) {
      whereClause.entityType = entityType;
    }
    
    if (alertType) {
      whereClause.alertType = alertType;
    }
    
    const [alerts, total] = await Promise.all([
      prisma.fraudAlert.findMany({
        where: whereClause,
        orderBy: [
          { severity: 'desc' },
          { detectedAt: 'desc' },
        ],
        skip,
        take: pageSizeNum,
      }),
      prisma.fraudAlert.count({ where: whereClause }),
    ]);
    
    const statusCounts = await prisma.fraudAlert.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    
    const severityCounts = await prisma.fraudAlert.groupBy({
      by: ['severity'],
      where: { status: 'open' },
      _count: { id: true },
    });
    
    res.json({
      success: true,
      alerts: alerts.map(a => ({
        id: a.id,
        entityType: a.entityType,
        entityId: a.entityId,
        alertType: a.alertType,
        severity: a.severity,
        status: a.status,
        detectedReason: a.detectedReason,
        detectedMetrics: a.detectedMetrics,
        detectedAt: a.detectedAt,
        resolvedByAdminId: a.resolvedByAdminId,
        resolvedAt: a.resolvedAt,
        resolutionNotes: a.resolutionNotes,
      })),
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total,
        totalPages: Math.ceil(total / pageSizeNum),
      },
      summary: {
        byStatus: statusCounts.reduce((acc: any, s) => {
          acc[s.status] = s._count.id;
          return acc;
        }, {}),
        openBySeverity: severityCounts.reduce((acc: any, s) => {
          acc[s.severity] = s._count.id;
          return acc;
        }, {}),
      },
    });
  } catch (error: any) {
    console.error("List fraud alerts error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch fraud alerts" });
  }
});

// ====================================================
// GET /api/admin/fraud/alerts/:id
// Get single fraud alert details (Task 31)
// ====================================================
router.get("/fraud/alerts/:id", checkPermission(Permission.VIEW_FRAUD_ALERTS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const alert = await prisma.fraudAlert.findUnique({
      where: { id },
    });
    
    if (!alert) {
      return res.status(404).json({ error: "Fraud alert not found" });
    }
    
    let entityDetails = null;
    
    switch (alert.entityType) {
      case 'ride':
        entityDetails = await prisma.ride.findUnique({
          where: { id: alert.entityId },
          select: {
            id: true,
            status: true,
            serviceFare: true,
            paymentMethod: true,
            createdAt: true,
            customerId: true,
            driverId: true,
          },
        });
        break;
      case 'customer':
        entityDetails = await prisma.customerProfile.findUnique({
          where: { id: alert.entityId },
          select: {
            id: true,
            fullName: true,
            verificationStatus: true,
            isSuspended: true,
            createdAt: true,
          },
        });
        break;
      case 'driver':
        entityDetails = await prisma.driverProfile.findUnique({
          where: { id: alert.entityId },
          select: {
            id: true,
            fullName: true,
            verificationStatus: true,
            status: true,
            createdAt: true,
          },
        });
        break;
      case 'wallet':
        entityDetails = await prisma.driverWallet.findUnique({
          where: { id: alert.entityId },
          select: {
            id: true,
            driverId: true,
            balance: true,
            negativeBalance: true,
          },
        });
        break;
    }
    
    res.json({
      success: true,
      alert: {
        id: alert.id,
        entityType: alert.entityType,
        entityId: alert.entityId,
        alertType: alert.alertType,
        severity: alert.severity,
        status: alert.status,
        detectedReason: alert.detectedReason,
        detectedMetrics: alert.detectedMetrics,
        detectedAt: alert.detectedAt,
        resolvedByAdminId: alert.resolvedByAdminId,
        resolvedAt: alert.resolvedAt,
        resolutionNotes: alert.resolutionNotes,
        createdAt: alert.createdAt,
        updatedAt: alert.updatedAt,
      },
      entityDetails,
    });
  } catch (error: any) {
    console.error("Get fraud alert error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch fraud alert" });
  }
});

// ====================================================
// PATCH /api/admin/fraud/alerts/:id/resolve
// Resolve a fraud alert (Task 31)
// ====================================================
const resolveFraudAlertSchema = z.object({
  resolution: z.enum(['resolved_confirmed', 'resolved_false_positive', 'escalated']),
  notes: z.string().min(1, "Resolution notes are required").max(2000),
});

router.patch("/fraud/alerts/:id/resolve", checkPermission(Permission.RESOLVE_FRAUD_ALERTS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const validation = resolveFraudAlertSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Invalid request body",
        details: validation.error.errors,
      });
    }
    
    const { resolution, notes } = validation.data;
    
    const alert = await prisma.fraudAlert.findUnique({
      where: { id },
    });
    
    if (!alert) {
      return res.status(404).json({ error: "Fraud alert not found" });
    }
    
    if (['resolved_confirmed', 'resolved_false_positive'].includes(alert.status)) {
      return res.status(400).json({ error: "Alert is already resolved" });
    }
    
    const updatedAlert = await prisma.fraudAlert.update({
      where: { id },
      data: {
        status: resolution,
        resolvedByAdminId: req.user!.id,
        resolvedAt: new Date(),
        resolutionNotes: notes,
      },
    });
    
    await logAuditEvent({
      entityType: EntityType.FRAUD_ALERT || 'fraud_alert' as any,
      entityId: id,
      actionType: ActionType.UPDATE,
      actorId: req.user!.id,
      actorRole: 'admin',
      ipAddress: getClientIp(req),
      metadata: {
        previousStatus: alert.status,
        newStatus: resolution,
        resolutionNotes: notes,
      },
    });
    
    res.json({
      success: true,
      message: "Fraud alert resolved successfully",
      alert: {
        id: updatedAlert.id,
        status: updatedAlert.status,
        resolvedByAdminId: updatedAlert.resolvedByAdminId,
        resolvedAt: updatedAlert.resolvedAt,
        resolutionNotes: updatedAlert.resolutionNotes,
      },
    });
  } catch (error: any) {
    console.error("Resolve fraud alert error:", error);
    res.status(500).json({ error: error.message || "Failed to resolve fraud alert" });
  }
});

// ====================================================
// GET /api/admin/analytics/top-earners
// Top earning drivers and restaurants (Task 30)
// ====================================================
router.get("/analytics/top-earners", checkPermission(Permission.VIEW_REVENUE_ANALYTICS), async (req: AuthRequest, res) => {
  try {
    const { countryCode, limit = "10", range = "last_30_days" } = req.query;
    const limitNum = Math.min(Math.max(1, parseInt(limit as string) || 10), 50);
    
    let startDate: Date;
    const endDate = new Date();
    
    switch (range) {
      case 'last_7_days':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last_30_days':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'this_month':
        startDate = new Date();
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }
    
    const currencyCode = (countryCode as string)?.toUpperCase() === 'BD' ? 'BDT' : 'USD';
    
    const topDrivers = await prisma.ride.groupBy({
      by: ['driverId'],
      where: {
        completedAt: { gte: startDate, lte: endDate },
        driverId: { not: null },
        ...(countryCode ? { countryCode: String(countryCode).toUpperCase() } : {}),
      },
      _sum: {
        driverPayout: true,
        serviceFare: true,
      },
      _count: { id: true },
      orderBy: { _sum: { driverPayout: 'desc' } },
      take: limitNum,
    });
    
    const driverIds = topDrivers.map(d => d.driverId).filter(Boolean) as string[];
    const driverProfiles = await prisma.driverProfile.findMany({
      where: { id: { in: driverIds } },
      select: { id: true, fullName: true, firstName: true, lastName: true },
    });
    
    const driverMap = new Map(driverProfiles.map(d => [d.id, d]));
    
    const topRestaurants = await prisma.foodOrder.groupBy({
      by: ['restaurantId'],
      where: {
        deliveredAt: { gte: startDate, lte: endDate },
      },
      _sum: {
        restaurantPayout: true,
        serviceFare: true,
      },
      _count: { id: true },
      orderBy: { _sum: { restaurantPayout: 'desc' } },
      take: limitNum,
    });
    
    const restaurantIds = topRestaurants.map(r => r.restaurantId);
    const restaurantProfiles = await prisma.restaurantProfile.findMany({
      where: { id: { in: restaurantIds } },
      select: { id: true, restaurantName: true },
    });
    
    const restaurantMap = new Map(restaurantProfiles.map(r => [r.id, r]));
    
    res.json({
      success: true,
      range,
      startDate,
      endDate,
      currencyCode,
      topDrivers: topDrivers.map((d, index) => {
        const profile = driverMap.get(d.driverId!);
        return {
          rank: index + 1,
          driverId: d.driverId,
          name: profile?.fullName || profile?.firstName || 'Unknown Driver',
          totalEarnings: Number(d._sum.driverPayout || 0),
          totalEarningsFormatted: formatCurrency(Number(d._sum.driverPayout || 0), currencyCode as 'BDT' | 'USD'),
          totalFare: Number(d._sum.serviceFare || 0),
          totalTrips: d._count.id,
        };
      }),
      topRestaurants: topRestaurants.map((r, index) => {
        const profile = restaurantMap.get(r.restaurantId);
        return {
          rank: index + 1,
          restaurantId: r.restaurantId,
          name: profile?.restaurantName || 'Unknown Restaurant',
          totalEarnings: Number(r._sum.restaurantPayout || 0),
          totalEarningsFormatted: formatCurrency(Number(r._sum.restaurantPayout || 0), currencyCode as 'BDT' | 'USD'),
          totalOrders: r._count.id,
        };
      }),
    });
  } catch (error: any) {
    console.error("Top earners error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch top earners" });
  }
});

// ============================================================
// Phase 4 Part 2: Identity Verification Routes
// ============================================================

import { identityVerificationService } from "../services/identityVerificationService";
import { backgroundCheckService } from "../services/backgroundCheckService";
import { faceVerificationService } from "../services/faceVerificationService";
import { KycDocumentType, KycVerificationStatus, BackgroundCheckResult, MobileWalletBrand } from "@prisma/client";

// GET /api/admin/kyc/stats - Get KYC verification statistics
router.get("/kyc/stats", checkPermission(Permission.VIEW_ALL_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { countryCode } = req.query;
    const stats = await identityVerificationService.getVerificationStats(countryCode as string | undefined);
    res.json({ success: true, stats });
  } catch (error: any) {
    console.error("KYC stats error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch KYC stats" });
  }
});

// GET /api/admin/kyc/pending - Get pending KYC verifications
router.get("/kyc/pending", checkPermission(Permission.VIEW_ALL_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { countryCode } = req.query;
    const pending = await identityVerificationService.getPendingVerifications(countryCode as string | undefined);
    res.json({ success: true, verifications: pending });
  } catch (error: any) {
    console.error("KYC pending error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch pending verifications" });
  }
});

// POST /api/admin/kyc/verify - Trigger identity verification
router.post("/kyc/verify", checkPermission(Permission.APPROVE_REJECT_DOCUMENTS), async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      userType: z.enum(["customer", "driver", "restaurant"]),
      userId: z.string().uuid(),
      countryCode: z.string().length(2),
      documentType: z.nativeEnum(KycDocumentType),
      documentData: z.record(z.string()),
    });

    const data = schema.parse(req.body);

    const result = await identityVerificationService.verifyIdentity({
      ...data,
      triggeredByAdminId: req.adminUser?.id,
      autoTriggered: false,
    });

    await logAuditEvent({
      adminId: req.adminUser!.id,
      actionType: ActionType.UPDATE_STATUS,
      entityType: EntityType.DRIVER,
      entityId: data.userId,
      description: `Triggered KYC verification for ${data.userType} ${data.userId}`,
      clientIp: getClientIp(req),
    });

    res.json({ success: true, result });
  } catch (error: any) {
    console.error("KYC verify error:", error);
    res.status(500).json({ error: error.message || "Failed to trigger verification" });
  }
});

// GET /api/admin/kyc/history/:userType/:userId - Get verification history
router.get("/kyc/history/:userType/:userId", checkPermission(Permission.VIEW_ALL_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { userType, userId } = req.params;
    const history = await identityVerificationService.getVerificationHistory(userId, userType);
    res.json({ success: true, history });
  } catch (error: any) {
    console.error("KYC history error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch verification history" });
  }
});

// PUT /api/admin/kyc/:logId/review - Mark for or resolve manual review
router.put("/kyc/:logId/review", checkPermission(Permission.APPROVE_REJECT_DOCUMENTS), async (req: AuthRequest, res) => {
  try {
    const { logId } = req.params;
    const schema = z.object({
      action: z.enum(["mark_review", "resolve"]),
      decision: z.enum(["match", "mismatch"]).optional(),
      notes: z.string().min(1),
    });

    const data = schema.parse(req.body);

    if (data.action === "mark_review") {
      await identityVerificationService.markForManualReview(logId, req.adminUser!.id, data.notes);
    } else if (data.action === "resolve" && data.decision) {
      await identityVerificationService.resolveManualReview(logId, req.adminUser!.id, data.decision, data.notes);
    }

    await logAuditEvent({
      adminId: req.adminUser!.id,
      actionType: ActionType.UPDATE_STATUS,
      entityType: EntityType.DRIVER,
      entityId: logId,
      description: `KYC ${data.action} with decision: ${data.decision || 'N/A'}`,
      clientIp: getClientIp(req),
    });

    res.json({ success: true, message: "Review action completed" });
  } catch (error: any) {
    console.error("KYC review error:", error);
    res.status(500).json({ error: error.message || "Failed to process review" });
  }
});

// ============================================================
// Phase 4 Part 2: Background Check Routes
// ============================================================

// GET /api/admin/background-checks/stats - Get background check statistics
router.get("/background-checks/stats", checkPermission(Permission.VIEW_ALL_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { countryCode } = req.query;
    const stats = await backgroundCheckService.getStats(countryCode as string | undefined);
    res.json({ success: true, stats });
  } catch (error: any) {
    console.error("Background check stats error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch stats" });
  }
});

// GET /api/admin/background-checks/driver/:driverId - Get driver's background checks
router.get("/background-checks/driver/:driverId", checkPermission(Permission.VIEW_ALL_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { driverId } = req.params;
    const checks = await backgroundCheckService.getDriverChecks(driverId);
    res.json({ success: true, checks });
  } catch (error: any) {
    console.error("Background checks fetch error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch driver checks" });
  }
});

// POST /api/admin/background-checks/initiate - Initiate background check
router.post("/background-checks/initiate", checkPermission(Permission.APPROVE_REJECT_DOCUMENTS), async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      driverId: z.string().uuid(),
      countryCode: z.string().length(2),
    });

    const data = schema.parse(req.body);

    const result = await backgroundCheckService.initiateCheck({
      ...data,
      initiatedByAdminId: req.adminUser?.id,
    });

    if (result.success) {
      await logAuditEvent({
        adminId: req.adminUser!.id,
        actionType: ActionType.UPDATE_STATUS,
        entityType: EntityType.DRIVER,
        entityId: data.driverId,
        description: `Initiated background check for driver ${data.driverId}`,
        clientIp: getClientIp(req),
      });
    }

    res.json(result);
  } catch (error: any) {
    console.error("Background check initiate error:", error);
    res.status(500).json({ error: error.message || "Failed to initiate background check" });
  }
});

// PUT /api/admin/background-checks/:checkId/resolve - Manually resolve background check
router.put("/background-checks/:checkId/resolve", checkPermission(Permission.APPROVE_REJECT_DOCUMENTS), async (req: AuthRequest, res) => {
  try {
    const { checkId } = req.params;
    const schema = z.object({
      result: z.nativeEnum(BackgroundCheckResult),
      notes: z.string().min(1),
    });

    const data = schema.parse(req.body);

    await backgroundCheckService.manuallyResolve(checkId, req.adminUser!.id, data.result, data.notes);

    await logAuditEvent({
      adminId: req.adminUser!.id,
      actionType: ActionType.UPDATE_STATUS,
      entityType: EntityType.DRIVER,
      entityId: checkId,
      description: `Manually resolved background check with result: ${data.result}`,
      clientIp: getClientIp(req),
    });

    res.json({ success: true, message: "Background check resolved" });
  } catch (error: any) {
    console.error("Background check resolve error:", error);
    res.status(500).json({ error: error.message || "Failed to resolve background check" });
  }
});

// GET /api/admin/background-checks/expiring - Get expiring background checks
router.get("/background-checks/expiring", checkPermission(Permission.VIEW_ALL_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const expiring = await backgroundCheckService.getExpiringChecks(days);
    res.json({ success: true, expiring });
  } catch (error: any) {
    console.error("Expiring checks error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch expiring checks" });
  }
});

// ============================================================
// Phase 4 Part 2: Face Verification Routes
// ============================================================

// GET /api/admin/face-verification/stats - Get face verification statistics
router.get("/face-verification/stats", checkPermission(Permission.VIEW_ALL_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { countryCode } = req.query;
    const stats = await faceVerificationService.getStats(countryCode as string | undefined);
    res.json({ success: true, stats });
  } catch (error: any) {
    console.error("Face verification stats error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch stats" });
  }
});

// GET /api/admin/face-verification/pending - Get pending face verifications
router.get("/face-verification/pending", checkPermission(Permission.VIEW_ALL_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { countryCode } = req.query;
    const pending = await faceVerificationService.getPendingSessions(countryCode as string | undefined);
    res.json({ success: true, sessions: pending });
  } catch (error: any) {
    console.error("Face verification pending error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch pending sessions" });
  }
});

// GET /api/admin/face-verification/user/:userType/:userId - Get user's sessions
router.get("/face-verification/user/:userType/:userId", checkPermission(Permission.VIEW_ALL_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { userType, userId } = req.params;
    const sessions = await faceVerificationService.getUserSessions(userId, userType);
    res.json({ success: true, sessions });
  } catch (error: any) {
    console.error("Face verification sessions error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch sessions" });
  }
});

// PUT /api/admin/face-verification/:sessionId/review - Admin review session
router.put("/face-verification/:sessionId/review", checkPermission(Permission.APPROVE_REJECT_DOCUMENTS), async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;
    const schema = z.object({
      decision: z.enum(["match", "mismatch"]),
      notes: z.string().min(1),
    });

    const data = schema.parse(req.body);

    await faceVerificationService.adminReview(sessionId, req.adminUser!.id, data.decision, data.notes);

    await logAuditEvent({
      adminId: req.adminUser!.id,
      actionType: ActionType.UPDATE_STATUS,
      entityType: EntityType.DRIVER,
      entityId: sessionId,
      description: `Face verification review: ${data.decision}`,
      clientIp: getClientIp(req),
    });

    res.json({ success: true, message: "Review completed" });
  } catch (error: any) {
    console.error("Face verification review error:", error);
    res.status(500).json({ error: error.message || "Failed to complete review" });
  }
});

// POST /api/admin/face-verification/require - Require face verification for driver
router.post("/face-verification/require", checkPermission(Permission.APPROVE_REJECT_DOCUMENTS), async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      driverId: z.string().uuid(),
    });

    const { driverId } = schema.parse(req.body);

    await faceVerificationService.requireFaceVerification(driverId);

    await logAuditEvent({
      adminId: req.adminUser!.id,
      actionType: ActionType.UPDATE_STATUS,
      entityType: EntityType.DRIVER,
      entityId: driverId,
      description: `Required face verification for driver`,
      clientIp: getClientIp(req),
    });

    res.json({ success: true, message: "Face verification required" });
  } catch (error: any) {
    console.error("Require face verification error:", error);
    res.status(500).json({ error: error.message || "Failed to require verification" });
  }
});

// ============================================================
// Phase 4 Part 2: BD Mobile Wallet Configuration Routes
// ============================================================

// GET /api/admin/mobile-wallets/config - Get mobile wallet configurations
router.get("/mobile-wallets/config", checkPermission(Permission.VIEW_ALL_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { countryCode } = req.query;
    const configs = await prisma.mobileWalletConfig.findMany({
      where: countryCode ? { countryCode: countryCode as string } : undefined,
      orderBy: [{ countryCode: "asc" }, { provider: "asc" }],
    });
    res.json({ success: true, configs });
  } catch (error: any) {
    console.error("Mobile wallet config error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch configs" });
  }
});

// POST /api/admin/mobile-wallets/config - Create or update mobile wallet config
router.post("/mobile-wallets/config", checkPermission(Permission.MANAGE_SETTINGS), async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      countryCode: z.string().length(2),
      provider: z.nativeEnum(MobileWalletBrand),
      providerName: z.string().min(1),
      isEnabled: z.boolean().default(false),
      isDefault: z.boolean().default(false),
      enabledForRides: z.boolean().default(true),
      enabledForFood: z.boolean().default(true),
      enabledForParcels: z.boolean().default(true),
      merchantId: z.string().optional(),
      merchantName: z.string().optional(),
      callbackUrl: z.string().url().optional(),
      sandboxMode: z.boolean().default(true),
      displayName: z.string().optional(),
      logoUrl: z.string().url().optional(),
    });

    const data = schema.parse(req.body);

    const config = await prisma.mobileWalletConfig.upsert({
      where: {
        countryCode_provider: {
          countryCode: data.countryCode,
          provider: data.provider,
        },
      },
      update: {
        ...data,
        updatedAt: new Date(),
      },
      create: {
        ...data,
        createdByAdminId: req.adminUser?.id,
      },
    });

    await logAuditEvent({
      adminId: req.adminUser!.id,
      actionType: ActionType.UPDATE_STATUS,
      entityType: EntityType.RESTAURANT,
      entityId: config.id,
      description: `Updated mobile wallet config for ${data.provider} in ${data.countryCode}`,
      clientIp: getClientIp(req),
    });

    res.json({ success: true, config });
  } catch (error: any) {
    console.error("Mobile wallet config update error:", error);
    res.status(500).json({ error: error.message || "Failed to update config" });
  }
});

// DELETE /api/admin/mobile-wallets/config/:id - Delete mobile wallet config
router.delete("/mobile-wallets/config/:id", checkPermission(Permission.MANAGE_SETTINGS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.mobileWalletConfig.delete({
      where: { id },
    });

    await logAuditEvent({
      adminId: req.adminUser!.id,
      actionType: ActionType.DELETE,
      entityType: EntityType.RESTAURANT,
      entityId: id,
      description: `Deleted mobile wallet config`,
      clientIp: getClientIp(req),
    });

    res.json({ success: true, message: "Config deleted" });
  } catch (error: any) {
    console.error("Mobile wallet config delete error:", error);
    res.status(500).json({ error: error.message || "Failed to delete config" });
  }
});

// ============================================================
// ADMIN OVERSIGHT SYSTEM - Onboarding Overview Dashboard
// ============================================================

// GET /api/admin/onboarding/summary - Get aggregated onboarding stats across all partner types
router.get("/onboarding/summary", checkPermission(Permission.VIEW_ALL_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { countryCode } = req.query;
    const countryFilter = countryCode ? { user: { countryCode: countryCode as string } } : {};

    // Driver stats
    const driverStats = await prisma.driverProfile.groupBy({
      by: ['verificationStatus'],
      _count: { id: true },
      where: countryFilter,
    });

    // Restaurant stats
    const restaurantStats = await prisma.restaurantProfile.groupBy({
      by: ['verificationStatus'],
      _count: { id: true },
    });

    // Shop Partner stats (BD only)
    const shopStats = await prisma.shopPartner.groupBy({
      by: ['verificationStatus'],
      _count: { id: true },
    });

    // Ticket Operator stats (BD only)
    const ticketStats = await prisma.ticketOperator.groupBy({
      by: ['verificationStatus'],
      _count: { id: true },
    });

    // Helper to convert groupBy result to status counts
    const toStatusCounts = (stats: any[]) => {
      const counts = { pending: 0, approved: 0, rejected: 0, suspended: 0, total: 0 };
      stats.forEach((s) => {
        const status = s.verificationStatus?.toLowerCase() || 'pending';
        if (status === 'pending' || status === 'pending_review') counts.pending += s._count.id;
        else if (status === 'approved' || status === 'verified') counts.approved += s._count.id;
        else if (status === 'rejected') counts.rejected += s._count.id;
        else if (status === 'suspended') counts.suspended += s._count.id;
        counts.total += s._count.id;
      });
      return counts;
    };

    res.json({
      success: true,
      summary: {
        drivers: toStatusCounts(driverStats),
        restaurants: toStatusCounts(restaurantStats),
        shopPartners: toStatusCounts(shopStats),
        ticketOperators: toStatusCounts(ticketStats),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Onboarding summary error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch onboarding summary" });
  }
});

// GET /api/admin/onboarding/pending - Get all pending partner applications
router.get("/onboarding/pending", checkPermission(Permission.VIEW_ALL_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { type, limit = 50 } = req.query;
    const take = Math.min(parseInt(limit as string) || 50, 100);

    const pendingStatuses = ['pending', 'pending_review', 'PENDING', 'PENDING_REVIEW'];

    // Get pending drivers
    const pendingDrivers = (!type || type === 'driver') ? await prisma.driverProfile.findMany({
      where: { verificationStatus: { in: pendingStatuses } },
      include: {
        user: { select: { id: true, email: true, countryCode: true, createdAt: true } },
        vehicles: { take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take,
    }) : [];

    // Get pending restaurants
    const pendingRestaurants = (!type || type === 'restaurant') ? await prisma.restaurantProfile.findMany({
      where: { verificationStatus: { in: pendingStatuses } },
      include: {
        user: { select: { id: true, email: true, countryCode: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    }) : [];

    // Get pending shop partners
    const pendingShops = (!type || type === 'shop') ? await prisma.shopPartner.findMany({
      where: { verificationStatus: { in: pendingStatuses } },
      include: {
        user: { select: { id: true, email: true, countryCode: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    }) : [];

    // Get pending ticket operators
    const pendingTickets = (!type || type === 'ticket') ? await prisma.ticketOperator.findMany({
      where: { verificationStatus: { in: pendingStatuses } },
      include: {
        user: { select: { id: true, email: true, countryCode: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    }) : [];

    res.json({
      success: true,
      pending: {
        drivers: pendingDrivers.map(d => ({
          id: d.id,
          type: 'driver',
          driverType: d.driverType,
          name: d.fullName || `${d.firstName || ''} ${d.lastName || ''}`.trim() || d.user.email.split('@')[0],
          email: d.user.email,
          country: d.user.countryCode,
          status: d.verificationStatus,
          hasVehicle: d.vehicles.length > 0,
          createdAt: d.createdAt,
        })),
        restaurants: pendingRestaurants.map(r => ({
          id: r.id,
          type: 'restaurant',
          name: r.name,
          email: r.user.email,
          country: r.user.countryCode,
          status: r.verificationStatus,
          hasLogo: !!r.logoUrl,
          createdAt: r.createdAt,
        })),
        shopPartners: pendingShops.map(s => ({
          id: s.id,
          type: 'shop',
          name: s.shopName,
          email: s.user.email,
          country: 'BD',
          status: s.verificationStatus,
          createdAt: s.createdAt,
        })),
        ticketOperators: pendingTickets.map(t => ({
          id: t.id,
          type: 'ticket',
          name: t.operatorName,
          operatorType: t.operatorType,
          email: t.user.email,
          country: 'BD',
          status: t.verificationStatus,
          createdAt: t.createdAt,
        })),
      },
    });
  } catch (error: any) {
    console.error("Pending applications error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch pending applications" });
  }
});

// GET /api/admin/customers - Get all customers with filtering
router.get("/customers", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { search, page = 1, limit = 20, status, countryCode } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = Math.min(parseInt(limit as string) || 20, 100);

    const where: any = {
      role: 'customer',
    };

    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { fullName: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } },
      ];
    }

    if (status === 'blocked') {
      where.isBlocked = true;
    } else if (status === 'active') {
      where.isBlocked = false;
    }

    if (countryCode) {
      where.countryCode = countryCode as string;
    }

    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          countryCode: true,
          isBlocked: true,
          blockReason: true,
          createdAt: true,
          lastLoginAt: true,
          emailVerified: true,
          phoneVerified: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      customers,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    console.error("Customers list error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch customers" });
  }
});

// GET /api/admin/customers/:id - Get customer details
router.get("/customers/:id", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.user.findUnique({
      where: { id, role: 'customer' },
      include: {
        deliveryAddresses: true,
        savedPlaces: true,
        paymentMethods: { select: { id: true, type: true, lastFour: true, isDefault: true, createdAt: true } },
        rideRatings: { take: 5, orderBy: { createdAt: 'desc' } },
        _count: {
          select: {
            ridesAsCustomer: true,
            foodOrders: true,
            parcelsAsSender: true,
          },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json({ success: true, customer });
  } catch (error: any) {
    console.error("Customer details error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch customer details" });
  }
});

// PUT /api/admin/customers/:id/block - Block/unblock customer
router.put("/customers/:id/block", checkPermission(Permission.MANAGE_DRIVER_STATUS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { isBlocked, blockReason } = req.body;

    const customer = await prisma.user.update({
      where: { id, role: 'customer' },
      data: {
        isBlocked: !!isBlocked,
        blockReason: isBlocked ? blockReason : null,
      },
    });

    await logAuditEvent({
      adminId: req.adminUser!.id,
      actionType: isBlocked ? ActionType.BLOCK_USER : ActionType.UNBLOCK_USER,
      entityType: EntityType.CUSTOMER,
      entityId: id,
      description: isBlocked ? `Blocked customer: ${blockReason || 'No reason provided'}` : 'Unblocked customer',
      clientIp: getClientIp(req),
    });

    res.json({ success: true, customer });
  } catch (error: any) {
    console.error("Customer block error:", error);
    res.status(500).json({ error: error.message || "Failed to update customer" });
  }
});

// GET /api/admin/shop-partners - Get all shop partners with filtering
router.get("/shop-partners", checkPermission(Permission.VIEW_ALL_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { search, page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = Math.min(parseInt(limit as string) || 20, 100);

    const where: any = {};

    if (search) {
      where.OR = [
        { shopName: { contains: search as string, mode: 'insensitive' } },
        { ownerName: { contains: search as string, mode: 'insensitive' } },
        { user: { email: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    if (status) {
      where.verificationStatus = status as string;
    }

    const [shopPartners, total] = await Promise.all([
      prisma.shopPartner.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, isBlocked: true } },
          _count: { select: { products: true, orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.shopPartner.count({ where }),
    ]);

    res.json({
      success: true,
      shopPartners,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    console.error("Shop partners list error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch shop partners" });
  }
});

// GET /api/admin/shop-partners/:id - Get shop partner details
router.get("/shop-partners/:id", checkPermission(Permission.VIEW_ALL_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, isBlocked: true, createdAt: true, countryCode: true } },
        products: { 
          take: 20, 
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            price: true,
            images: true,
            isActive: true,
            isInStock: true,
            createdAt: true,
          }
        },
        orders: { 
          take: 10, 
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          }
        },
      },
    });

    if (!shopPartner) {
      return res.status(404).json({ error: "Shop partner not found" });
    }

    // Format response to match frontend expected interface
    const formattedShopPartner = {
      id: shopPartner.id,
      shopName: shopPartner.shopName,
      ownerName: shopPartner.ownerName || shopPartner.user.email.split('@')[0] || 'N/A',
      phoneNumber: shopPartner.contactPhone || '',
      verificationStatus: shopPartner.verificationStatus,
      rejectionReason: shopPartner.rejectionReason,
      commissionRate: Number(shopPartner.commissionRate),
      walletBalance: Number(shopPartner.walletBalance),
      negativeBalance: Number(shopPartner.negativeBalance),
      logoUrl: shopPartner.shopLogo,
      bannerUrl: shopPartner.shopBanner,
      category: shopPartner.shopType,
      address: shopPartner.shopAddress,
      nidNumber: shopPartner.nidNumber,
      nidFrontImage: shopPartner.nidFrontImage,
      nidBackImage: shopPartner.nidBackImage,
      tradeLicenseNumber: shopPartner.tradeLicenseNumber,
      tradeLicenseImage: shopPartner.tradeLicenseImage,
      fatherName: shopPartner.fatherName,
      dateOfBirth: shopPartner.dateOfBirth,
      presentAddress: shopPartner.presentAddress,
      permanentAddress: shopPartner.permanentAddress,
      emergencyContactName: shopPartner.emergencyContactName,
      emergencyContactPhone: shopPartner.emergencyContactPhone,
      emergencyContactRelation: shopPartner.emergencyContactRelation,
      countryCode: shopPartner.countryCode,
      createdAt: shopPartner.createdAt,
      verifiedAt: shopPartner.verifiedAt,
      user: shopPartner.user,
      products: shopPartner.products.map(p => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        imageUrl: Array.isArray(p.images) ? p.images[0] : null,
        isAvailable: p.isActive && p.isInStock,
        createdAt: p.createdAt,
      })),
      orders: shopPartner.orders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        totalAmount: Number(o.totalAmount),
        createdAt: o.createdAt,
      })),
    };

    res.json({ success: true, shopPartner: formattedShopPartner });
  } catch (error: any) {
    console.error("Shop partner details error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch shop partner details" });
  }
});

// PUT /api/admin/shop-partners/:id/status - Update shop partner verification status
router.put("/shop-partners/:id/status", checkPermission(Permission.APPROVE_REJECT_DOCUMENTS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const shopPartner = await prisma.shopPartner.update({
      where: { id },
      data: {
        verificationStatus: status,
        rejectionReason: status === 'rejected' ? rejectionReason : null,
        verifiedAt: status === 'approved' ? new Date() : null,
      },
      include: { user: true },
    });

    // Update user role if approved
    if (status === 'approved') {
      await prisma.user.update({
        where: { id: shopPartner.userId },
        data: { role: 'shop_partner' },
      });
    }

    await logAuditEvent({
      adminId: req.adminUser!.id,
      actionType: ActionType.UPDATE_STATUS,
      entityType: EntityType.RESTAURANT,
      entityId: id,
      description: `Shop partner ${status}: ${rejectionReason || 'Approved'}`,
      clientIp: getClientIp(req),
    });

    res.json({ success: true, shopPartner });
  } catch (error: any) {
    console.error("Shop partner status error:", error);
    res.status(500).json({ error: error.message || "Failed to update shop partner status" });
  }
});

// GET /api/admin/ticket-operators - Get all ticket operators with filtering
router.get("/ticket-operators", checkPermission(Permission.VIEW_ALL_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { search, page = 1, limit = 20, status, operatorType } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = Math.min(parseInt(limit as string) || 20, 100);

    const where: any = {};

    if (search) {
      where.OR = [
        { operatorName: { contains: search as string, mode: 'insensitive' } },
        { user: { email: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    if (status) {
      where.verificationStatus = status as string;
    }

    if (operatorType) {
      where.operatorType = operatorType as string;
    }

    const [ticketOperators, total] = await Promise.all([
      prisma.ticketOperator.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, isBlocked: true } },
          _count: { select: { ticketListings: true, rentalVehicles: true, ticketBookings: true, rentalBookings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.ticketOperator.count({ where }),
    ]);

    res.json({
      success: true,
      ticketOperators,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    console.error("Ticket operators list error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch ticket operators" });
  }
});

// GET /api/admin/ticket-operators/:id - Get ticket operator details
router.get("/ticket-operators/:id", checkPermission(Permission.VIEW_ALL_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const ticketOperator = await prisma.ticketOperator.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, isBlocked: true, createdAt: true, countryCode: true } },
        ticketListings: { 
          take: 20, 
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            routeName: true,
            originCity: true,
            destinationCity: true,
            basePrice: true,
            departureTime: true,
            isActive: true,
            createdAt: true,
          }
        },
        rentalVehicles: { 
          take: 20, 
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            vehicleType: true,
            registrationNumber: true,
            seatCapacity: true,
            dailyRate: true,
            isAvailable: true,
            createdAt: true,
          }
        },
        ticketBookings: { 
          take: 10, 
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            bookingNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          }
        },
        rentalBookings: { 
          take: 10, 
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            bookingNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          }
        },
      },
    });

    if (!ticketOperator) {
      return res.status(404).json({ error: "Ticket operator not found" });
    }

    // Format response to match frontend expected interface
    const formattedOperator = {
      id: ticketOperator.id,
      operatorName: ticketOperator.operatorName,
      operatorType: ticketOperator.operatorType,
      phoneNumber: ticketOperator.officePhone || ticketOperator.contactPhone || '',
      verificationStatus: ticketOperator.verificationStatus,
      rejectionReason: ticketOperator.rejectionReason,
      ticketCommissionRate: Number(ticketOperator.ticketCommissionRate),
      rentalCommissionRate: Number(ticketOperator.rentalCommissionRate),
      walletBalance: Number(ticketOperator.walletBalance),
      negativeBalance: Number(ticketOperator.negativeBalance),
      logoUrl: ticketOperator.logo,
      bannerUrl: null, // No banner field in schema
      nidNumber: ticketOperator.nidNumber,
      nidFrontImage: ticketOperator.nidFrontImage,
      nidBackImage: ticketOperator.nidBackImage,
      ownerName: ticketOperator.ownerName,
      fatherName: ticketOperator.fatherName,
      dateOfBirth: ticketOperator.dateOfBirth,
      presentAddress: ticketOperator.presentAddress,
      permanentAddress: ticketOperator.permanentAddress,
      routePermitNumber: ticketOperator.routePermitNumber,
      routePermitImage: ticketOperator.routePermitImage,
      routePermitExpiry: ticketOperator.routePermitExpiry,
      emergencyContactName: ticketOperator.emergencyContactName,
      emergencyContactPhone: ticketOperator.emergencyContactPhone,
      emergencyContactRelation: ticketOperator.emergencyContactRelation,
      officeAddress: ticketOperator.officeAddress,
      officeEmail: ticketOperator.officeEmail,
      countryCode: ticketOperator.countryCode,
      createdAt: ticketOperator.createdAt,
      verifiedAt: ticketOperator.verifiedAt,
      user: ticketOperator.user,
      // Map ticketListings to routes for frontend compatibility
      routes: ticketOperator.ticketListings.map(r => ({
        id: r.id,
        origin: r.originCity,
        destination: r.destinationCity,
        price: Number(r.basePrice),
        departureTime: r.departureTime,
        isActive: r.isActive,
        createdAt: r.createdAt,
      })),
      // Map rentalVehicles to vehicles for frontend compatibility
      vehicles: ticketOperator.rentalVehicles.map(v => ({
        id: v.id,
        vehicleType: v.vehicleType,
        registrationNumber: v.registrationNumber,
        seatCapacity: v.seatCapacity,
        dailyRate: v.dailyRate ? Number(v.dailyRate) : null,
        isAvailable: v.isAvailable,
        createdAt: v.createdAt,
      })),
      ticketBookings: ticketOperator.ticketBookings.map(b => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        status: b.status,
        totalAmount: Number(b.totalAmount),
        createdAt: b.createdAt,
      })),
      rentalBookings: ticketOperator.rentalBookings.map(b => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        status: b.status,
        totalAmount: Number(b.totalAmount),
        createdAt: b.createdAt,
      })),
    };

    res.json({ success: true, ticketOperator: formattedOperator });
  } catch (error: any) {
    console.error("Ticket operator details error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch ticket operator details" });
  }
});

// PUT /api/admin/ticket-operators/:id/status - Update ticket operator verification status
router.put("/ticket-operators/:id/status", checkPermission(Permission.APPROVE_REJECT_DOCUMENTS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const ticketOperator = await prisma.ticketOperator.update({
      where: { id },
      data: {
        verificationStatus: status,
        rejectionReason: status === 'rejected' ? rejectionReason : null,
        verifiedAt: status === 'approved' ? new Date() : null,
      },
      include: { user: true },
    });

    // Update user role if approved
    if (status === 'approved') {
      await prisma.user.update({
        where: { id: ticketOperator.userId },
        data: { role: 'ticket_operator' },
      });
    }

    await logAuditEvent({
      adminId: req.adminUser!.id,
      actionType: ActionType.UPDATE_STATUS,
      entityType: EntityType.RESTAURANT,
      entityId: id,
      description: `Ticket operator ${status}: ${rejectionReason || 'Approved'}`,
      clientIp: getClientIp(req),
    });

    res.json({ success: true, ticketOperator });
  } catch (error: any) {
    console.error("Ticket operator status error:", error);
    res.status(500).json({ error: error.message || "Failed to update ticket operator status" });
  }
});

// GET /api/admin/operations/rides - Get all rides with filtering
router.get("/operations/rides", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 20, status, dateFrom, dateTo } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = Math.min(parseInt(limit as string) || 20, 100);

    const where: any = {};
    if (status) where.status = status as string;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }

    const [rides, total] = await Promise.all([
      prisma.ride.findMany({
        where,
        include: {
          customer: { select: { id: true, fullName: true, email: true } },
          driver: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.ride.count({ where }),
    ]);

    res.json({
      success: true,
      rides,
      pagination: { page: parseInt(page as string), limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (error: any) {
    console.error("Operations rides error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch rides" });
  }
});

// GET /api/admin/operations/food-orders - Get all food orders with filtering
router.get("/operations/food-orders", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 20, status, dateFrom, dateTo } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = Math.min(parseInt(limit as string) || 20, 100);

    const where: any = {};
    if (status) where.status = status as string;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }

    const [orders, total] = await Promise.all([
      prisma.foodOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, fullName: true, email: true } },
          restaurant: { select: { id: true, name: true } },
          driver: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.foodOrder.count({ where }),
    ]);

    res.json({
      success: true,
      orders,
      pagination: { page: parseInt(page as string), limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (error: any) {
    console.error("Operations food orders error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch food orders" });
  }
});

// GET /api/admin/operations/deliveries - Get all parcel deliveries with filtering
router.get("/operations/deliveries", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 20, status, dateFrom, dateTo } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = Math.min(parseInt(limit as string) || 20, 100);

    const where: any = {};
    if (status) where.status = status as string;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }

    const [deliveries, total] = await Promise.all([
      prisma.parcel.findMany({
        where,
        include: {
          sender: { select: { id: true, fullName: true, email: true } },
          driver: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.parcel.count({ where }),
    ]);

    res.json({
      success: true,
      deliveries,
      pagination: { page: parseInt(page as string), limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (error: any) {
    console.error("Operations deliveries error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch deliveries" });
  }
});

export default router;
