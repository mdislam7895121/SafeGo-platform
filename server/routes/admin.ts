import { Router } from "express";
import { PrismaClient } from "@prisma/client";
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

const router = Router();
const prisma = new PrismaClient();

// All routes require authentication, admin role, and active admin status
router.use(authenticateToken);  // Step 1: Verify JWT token and set req.user
router.use(requireAdmin());      // Step 2: Verify user is admin
router.use(loadAdminProfile);    // Step 3: Load admin profile and capabilities

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
    const hasNewVehicleReg = driver.vehicle?.registrationDocumentUrl;
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
    const hasNewVehicleReg = driver.vehicle?.registrationDocumentUrl;
    const hasLegacyVehicleReg = driver.vehicleDocuments?.some((doc: any) => doc.documentType === "registration");
    if (!hasNewVehicleReg && !hasLegacyVehicleReg) {
      missing.push("Vehicle registration document");
    }

    // Check for DMV Inspection (type, date, expiry, and document)
    if (!driver.vehicle?.dmvInspectionType) {
      missing.push("DMV inspection type");
    }
    if (!driver.vehicle?.dmvInspectionDate) {
      missing.push("DMV inspection date");
    }
    if (!driver.vehicle?.dmvInspectionExpiry) {
      missing.push("DMV inspection expiry date");
    }
    if (!driver.vehicle?.dmvInspectionImageUrl) {
      missing.push("DMV inspection document");
    }
    // Check DMV inspection status: only "VALID" is acceptable, all others fail
    // (null, undefined, "MISSING", "EXPIRED", or any unexpected value should be rejected)
    if (driver.vehicle?.dmvInspectionStatus !== 'VALID') {
      if (driver.vehicle?.dmvInspectionStatus === 'EXPIRED') {
        missing.push("DMV inspection has expired");
      } else if (driver.vehicle?.dmvInspectionStatus === 'MISSING') {
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
            vehicle: true,
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
    } else {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Create notification
    if (userId) {
      await prisma.notification.create({
        data: {
          userId,
          type: "verification",
          title: "KYC Approved",
          body: "Your KYC has been approved. You can now use SafeGo services.",
        },
      });
    }

    res.json({
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
    } else {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Create notification
    if (userId) {
      await prisma.notification.create({
        data: {
          userId,
          type: "verification",
          title: "KYC Rejected",
          body: `Your KYC has been rejected. Reason: ${reason}`,
        },
      });
    }

    res.json({
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
          vehicle: onlineFilter ? { where: onlineFilter } : true,
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
    const formattedDrivers = drivers.map((driver) => ({
      id: driver.id,
      userId: driver.user.id,
      email: driver.user.email,
      countryCode: driver.user.countryCode,
      verificationStatus: driver.verificationStatus,
      isVerified: driver.isVerified,
      isSuspended: driver.isSuspended,
      suspensionReason: driver.suspensionReason,
      isBlocked: driver.user.isBlocked,
      isOnline: driver.vehicle?.isOnline || false,
      totalTrips: driver.driverStats?.totalTrips || 0,
      totalEarnings: driver.vehicle?.totalEarnings ? Number(driver.vehicle.totalEarnings) : 0,
      averageRating: driver.driverStats?.rating ? Number(driver.driverStats.rating) : 0,
      walletBalance: driver.driverWallet?.balance ? Number(driver.driverWallet.balance) : 0,
      negativeBalance: driver.driverWallet?.negativeBalance ? Number(driver.driverWallet.negativeBalance) : 0,
      commissionPaid: Number(commissionMap.get(driver.id) || 0).toFixed(2),
      vehicleType: driver.vehicle?.vehicleType,
      vehicleModel: driver.vehicle?.vehicleModel,
      vehiclePlate: driver.vehicle?.vehiclePlate,
      createdAt: driver.user.createdAt,
    }));

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
        vehicle: true,
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
        // Vehicle info
        vehicle: driver.vehicle
          ? {
              id: driver.vehicle.id,
              vehicleType: driver.vehicle.vehicleType,
              vehicleModel: driver.vehicle.vehicleModel,
              vehiclePlate: driver.vehicle.vehiclePlate,
              make: driver.vehicle.make,
              model: driver.vehicle.model,
              year: driver.vehicle.year,
              color: driver.vehicle.color,
              licensePlate: driver.vehicle.licensePlate,
              registrationDocumentUrl: driver.vehicle.registrationDocumentUrl,
              registrationExpiry: driver.vehicle.registrationExpiry,
              insuranceDocumentUrl: driver.vehicle.insuranceDocumentUrl,
              insuranceExpiry: driver.vehicle.insuranceExpiry,
              dmvInspectionType: driver.vehicle.dmvInspectionType,
              dmvInspectionDate: driver.vehicle.dmvInspectionDate,
              dmvInspectionExpiry: driver.vehicle.dmvInspectionExpiry,
              dmvInspectionImageUrl: driver.vehicle.dmvInspectionImageUrl,
              dmvInspectionStatus: driver.vehicle.dmvInspectionStatus,
              isOnline: driver.vehicle.isOnline,
              totalEarnings: Number(driver.vehicle.totalEarnings),
            }
          : null,
        // Stats
        totalTrips: driver.driverStats?.totalTrips || 0,
        totalEarnings: driver.vehicle?.totalEarnings ? Number(driver.vehicle.totalEarnings) : 0,
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
        vehicle: true,
        driverStats: true,
        driverWallet: true,
      },
    });

    // Return updated profile (exclude nidEncrypted)
    const { nidEncrypted, ...driverProfile } = updatedDriver as any;
    
    res.json({
      message: "Driver profile updated successfully",
      driver: {
        ...driverProfile,
        // Format vehicle totalEarnings as number
        vehicle: driverProfile.vehicle ? {
          ...driverProfile.vehicle,
          totalEarnings: Number(driverProfile.vehicle.totalEarnings),
        } : null,
        // Add computed fields
        totalTrips: driverProfile.driverStats?.totalTrips || 0,
        totalEarnings: driverProfile.vehicle?.totalEarnings ? Number(driverProfile.vehicle.totalEarnings) : 0,
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
        vehicle: true,
        driverStats: true,
        driverWallet: true,
      },
    });

    // Return updated profile (exclude ssnEncrypted)
    const { ssnEncrypted, ...driverProfile } = updatedDriver as any;
    
    res.json({
      message: "USA driver profile updated successfully",
      driver: {
        ...driverProfile,
        vehicle: driverProfile.vehicle ? {
          ...driverProfile.vehicle,
          totalEarnings: Number(driverProfile.vehicle.totalEarnings),
        } : null,
        totalTrips: driverProfile.driverStats?.totalTrips || 0,
        totalEarnings: driverProfile.vehicle?.totalEarnings ? Number(driverProfile.vehicle.totalEarnings) : 0,
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
        vehicle: true,
      },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    if (driver.user.countryCode !== "US") {
      return res.status(400).json({ error: "Vehicle updates only available for USA drivers" });
    }

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
      if (!data.dmvInspectionImageUrl && !driver.vehicle?.dmvInspectionImageUrl) {
        updateData.dmvInspectionStatus = 'MISSING';
      } else if (!data.dmvInspectionExpiry && !driver.vehicle?.dmvInspectionExpiry) {
        updateData.dmvInspectionStatus = 'MISSING';
      } else {
        const expiryDate = data.dmvInspectionExpiry 
          ? new Date(data.dmvInspectionExpiry) 
          : driver.vehicle?.dmvInspectionExpiry;
        
        if (expiryDate && expiryDate < new Date()) {
          updateData.dmvInspectionStatus = 'EXPIRED';
        } else {
          updateData.dmvInspectionStatus = 'VALID';
        }
      }
    }

    // Update or create vehicle
    let vehicle;
    if (driver.vehicle) {
      // Update existing vehicle
      vehicle = await prisma.vehicle.update({
        where: { id: driver.vehicle.id },
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
        complaints: {
          select: {
            id: true,
            reason: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
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

    const formattedRestaurant = {
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
      completedOrders: completedOrders.length,
      totalRevenue,
      totalCommission,
      recentOrders: restaurant.foodOrders,
      complaints: restaurant.complaints,
      createdAt: restaurant.createdAt,
      accountCreated: restaurant.user.createdAt,
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
        userId: customer.userId,
        type: "account_suspended",
        title: "Account Suspended",
        message: `Your account has been suspended. Reason: ${reason}`,
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
        userId: customer.userId,
        type: "account_active",
        title: "Account Unsuspended",
        message: "Your account suspension has been lifted. You can now use SafeGo services.",
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
        userId: customer.userId,
        type: "account_blocked",
        title: "Account Blocked",
        message: "Your account has been permanently blocked. Please contact support for more information.",
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
        userId: customer.userId,
        type: "account_active",
        title: "Account Unblocked",
        message: "Your account has been unblocked. You can now use SafeGo services.",
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
          vehicle: true,
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
        vehicle: true,
        vehicleDocuments: true,
      },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    const kycValidation = await validateDriverKYC(driver, driver.user.countryCode);

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
      vehicle: driver.vehicle ? {
        id: driver.vehicle.id,
        vehicleType: driver.vehicle.vehicleType,
        make: driver.vehicle.make,
        model: driver.vehicle.model,
        year: driver.vehicle.year,
        color: driver.vehicle.color,
        licensePlate: driver.vehicle.licensePlate,
        registrationDocumentUrl: driver.vehicle.registrationDocumentUrl,
        registrationExpiry: driver.vehicle.registrationExpiry,
        insuranceDocumentUrl: driver.vehicle.insuranceDocumentUrl,
        insuranceExpiry: driver.vehicle.insuranceExpiry,
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
        vehicle: true,
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
        validKeys: ["general", "kyc", "commission", "settlement", "notifications", "security"],
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

// Get wallet overview with filters
router.get("/wallets", checkPermission(Permission.VIEW_WALLET_SUMMARY), async (req: AuthRequest, res) => {
  try {
    const { ownerType, countryCode, page = "1", limit = "50", search } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const filters: any = {};
    if (ownerType) filters.ownerType = ownerType as "driver" | "restaurant";
    if (countryCode) filters.countryCode = countryCode as string;
    if (search) filters.search = search as string;

    const wallets = await walletService.listWallets({
      ...filters,
      limit: limitNum,
      offset,
    });

    const total = await walletService.getWalletCount(filters);

    res.json({
      wallets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error("Get wallets error:", error);
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
// PAYOUT MANAGEMENT API
// ====================================================

// Get all payouts with filters
router.get("/payouts", checkPermission(Permission.MANAGE_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const { ownerType, ownerId, status, countryCode, page = "1", limit = "50", startDate, endDate } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const filters: any = {};
    if (ownerType) filters.ownerType = ownerType as "driver" | "restaurant";
    if (ownerId) filters.ownerId = ownerId as string;
    if (status) filters.status = status;
    if (countryCode) filters.countryCode = countryCode as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const payouts = await walletPayoutService.listWalletPayouts({
      ...filters,
      limit: limitNum,
      offset,
    });

    const total = await walletPayoutService.getWalletPayoutCount(filters);

    res.json({
      payouts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error("Get payouts error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch payouts" });
  }
});

// Get specific payout by ID
router.get("/payouts/:id", checkPermission(Permission.MANAGE_PAYOUTS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const payout = await walletPayoutService.getWalletPayoutById(id);

    if (!payout) {
      return res.status(404).json({ error: "Payout not found" });
    }

    res.json(payout);
  } catch (error: any) {
    console.error("Get payout error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch payout" });
  }
});

// Update payout status (approve/reject)
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
// EARNINGS DASHBOARD API
// ====================================================

// Get global earnings summary
router.get("/earnings/dashboard/global", checkPermission(Permission.VIEW_EARNINGS_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { dateFrom, dateTo, country } = req.query;

    const filters: any = {};
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);
    if (country) filters.country = country as string;

    const summary = await earningsService.getGlobalSummary(filters);

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.VIEW_EARNINGS_DASHBOARD,
      entityType: EntityType.ANALYTICS,
      description: `Viewed global earnings dashboard`,
      metadata: { section: 'global', filters },
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
    const { dateFrom, dateTo, country } = req.query;

    const filters: any = {};
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);
    if (country) filters.country = country as string;

    const earnings = await earningsService.getRideEarnings(filters);

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.VIEW_EARNINGS_DASHBOARD,
      entityType: EntityType.ANALYTICS,
      description: `Viewed ride earnings analytics`,
      metadata: { section: 'rides', filters },
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
    const { dateFrom, dateTo, country } = req.query;

    const filters: any = {};
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);
    if (country) filters.country = country as string;

    const earnings = await earningsService.getFoodEarnings(filters);

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.VIEW_EARNINGS_DASHBOARD,
      entityType: EntityType.ANALYTICS,
      description: `Viewed food earnings analytics`,
      metadata: { section: 'food', filters },
    });

    res.json(earnings);
  } catch (error: any) {
    console.error("Get food earnings error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch food earnings" });
  }
});

// Get parcel earnings
router.get("/earnings/dashboard/parcels", checkPermission(Permission.VIEW_EARNINGS_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { dateFrom, dateTo, country } = req.query;

    const filters: any = {};
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);
    if (country) filters.country = country as string;

    const earnings = await earningsService.getParcelEarnings(filters);

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.VIEW_EARNINGS_DASHBOARD,
      entityType: EntityType.ANALYTICS,
      description: `Viewed parcel earnings analytics`,
      metadata: { section: 'parcels', filters },
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
    const { dateFrom, dateTo, country } = req.query;

    const filters: any = {};
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);
    if (country) filters.country = country as string;

    const analytics = await earningsService.getPayoutAnalytics(filters);

    await logAuditEvent({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: ActionType.VIEW_EARNINGS_DASHBOARD,
      entityType: EntityType.ANALYTICS,
      description: `Viewed payout analytics`,
      metadata: { section: 'payouts', filters },
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

export default router;
