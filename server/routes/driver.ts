import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { encrypt, decrypt, isValidBdNid, isValidBdPhone, maskNID, maskSSN } from "../utils/encryption";
import {
  uploadProfilePhoto,
  uploadLicenseImage,
  uploadVehicleDocument,
  getFileUrl,
} from "../middleware/upload";
import { getVehicleDocumentsPayload } from "../services/documentStatusService";
import {
  VehicleCategoryId,
  VEHICLE_CATEGORIES,
  VEHICLE_CATEGORY_ORDER,
  isValidVehicleCategoryId,
  getVehicleCategory,
  canVehicleServeCategory,
  getEligibleDriverCategories,
} from "@shared/vehicleCategories";
import { driverVehicleService } from "../services/driverVehicleService";

const router = Router();
const prisma = new PrismaClient();

// Helper functions to serialize Prisma Decimal fields to numbers
function serializeDecimal(value: any): number {
  if (value === null || value === undefined) return 0;
  return parseFloat(value.toString());
}

function serializeWallet(wallet: any) {
  return {
    ...wallet,
    availableBalance: serializeDecimal(wallet.availableBalance),
    totalEarnings: serializeDecimal(wallet.totalEarnings),
    totalPaidOut: serializeDecimal(wallet.totalPaidOut),
    negativeBalance: serializeDecimal(wallet.negativeBalance),
  };
}

function serializeTransaction(txn: any) {
  return {
    ...txn,
    amount: serializeDecimal(txn.amount),
    balanceSnapshot: txn.balanceSnapshot ? serializeDecimal(txn.balanceSnapshot) : undefined,
    negativeBalanceSnapshot: txn.negativeBalanceSnapshot ? serializeDecimal(txn.negativeBalanceSnapshot) : undefined,
  };
}

function serializePayout(payout: any) {
  return {
    ...payout,
    amount: serializeDecimal(payout.amount),
  };
}

// Zod validation schemas for account management and preferences
const updateNameSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
}).or(z.object({
  fullName: z.string().min(1, "Full name is required").max(100),
}));

const updateEmailSchema = z.object({
  email: z.string().email("Invalid email format"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required for account deletion"),
});

const navigationPreferenceSchema = z.object({
  preferredNavigationApp: z.enum(["google", "waze", "apple", "builtin"]),
});

const workPreferencesSchema = z.object({
  autoAcceptRides: z.boolean().optional(),
  acceptLongTrips: z.boolean().optional(),
  acceptSharedRides: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one preference must be provided",
});

const privacyPreferencesSchema = z.object({
  shareLocationHistory: z.boolean().optional(),
  shareUsageAnalytics: z.boolean().optional(),
  personalizedExperience: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one preference must be provided",
});

const notificationPreferencesSchema = z.object({
  notifyRideRequests: z.boolean().optional(),
  notifyPromotions: z.boolean().optional(),
  notifyEarnings: z.boolean().optional(),
  notifySupport: z.boolean().optional(),
  notifyEmailWeekly: z.boolean().optional(),
  notifyEmailTips: z.boolean().optional(),
  notifySms: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one preference must be provided",
});

const languagePreferenceSchema = z.object({
  preferredLanguage: z.enum(["en", "bn", "es", "fr", "ar"]),
});

const themePreferenceSchema = z.object({
  themePreference: z.enum(["light", "dark", "system"]),
});

// D14: Extended Preference Schemas
const tripPreferencesSchema = z.object({
  preferShortTrips: z.boolean().optional(),
  avoidHighways: z.boolean().optional(),
  acceptLongTrips: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one preference must be provided",
});

const earningsPreferencesSchema = z.object({
  weeklyPayoutDay: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday"]).optional(),
  instantPayoutEnabled: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one preference must be provided",
});

const safetyPreferencesSchema = z.object({
  shareTripStatus: z.boolean().optional(),
  emergencyShortcutEnabled: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one preference must be provided",
});

const regionPreferenceSchema = z.object({
  regionPreference: z.enum(["auto", "us", "bd", "in", "pk", "gb"]),
});

// Service Preferences Schema for driver service selection (SafeGo services)
const servicePreferencesSchema = z.object({
  rideTypes: z.object({
    safego_go: z.boolean().optional(),
    safego_x: z.boolean().optional(),
    safego_comfort: z.boolean().optional(),
    safego_xl: z.boolean().optional(),
    safego_comfort_xl: z.boolean().optional(),
    safego_black: z.boolean().optional(),
    safego_black_suv: z.boolean().optional(),
    safego_premium: z.boolean().optional(),
    safego_bike: z.boolean().optional(),
    safego_cng: z.boolean().optional(),
    safego_moto: z.boolean().optional(),
    safego_pet: z.boolean().optional(),
  }).optional(),
  foodEnabled: z.boolean().optional(),
  parcelEnabled: z.boolean().optional(),
});

// Default service preferences for new drivers (all US types ON by default)
const defaultServicePreferences = {
  rideTypes: {
    safego_go: true,
    safego_x: true,
    safego_comfort: true,
    safego_xl: true,
    safego_comfort_xl: true,
    safego_black: true,
    safego_black_suv: true,
    safego_premium: true,
    safego_bike: true,
    safego_cng: true,
    safego_moto: true,
    safego_pet: true,
  },
  foodEnabled: true,
  parcelEnabled: true,
};

// ====================================================
// PUBLIC ENDPOINT - GET /api/driver/public-profile/:driverProfileId
// Get driver public profile for customer-facing views (no auth required)
// ====================================================
router.get("/public-profile/:driverProfileId", async (req, res) => {
  try {
    const { driverProfileId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(driverProfileId)) {
      return res.status(400).json({ error: "Invalid driver profile ID format" });
    }

    // Get driver profile with user and primary vehicle
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { id: driverProfileId },
      include: {
        user: {
          select: {
            email: true,
            countryCode: true,
            createdAt: true,
          },
        },
        vehicles: {
          where: { isActive: true },
          orderBy: [
            { isPrimary: 'desc' },
            { createdAt: 'desc' },
          ],
          take: 1,
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Only show verified drivers
    if (!driverProfile.isVerified) {
      return res.status(404).json({ error: "Driver not found" });
    }

    const vehicle = driverProfile.vehicles[0] || null;

    // Calculate stats from actual data (not driverStats table)
    const completedRidesCount = await prisma.ride.count({
      where: {
        driverId: driverProfile.id,
        status: 'completed',
      },
    });

    // Get average rating from customer reviews
    const reviews = await prisma.review.findMany({
      where: {
        entityId: driverProfile.id,
        entityType: 'driver',
      },
      select: {
        rating: true,
      },
    });

    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + Number(r.rating), 0) / reviews.length
      : 0;

    // Calculate years active from account creation
    const accountCreatedAt = driverProfile.user.createdAt;
    const yearsActive = (Date.now() - new Date(accountCreatedAt).getTime()) / (1000 * 60 * 60 * 24 * 365);

    // Build name from country-specific fields
    let driverName = '';
    if (driverProfile.user.countryCode === 'US') {
      const parts = [
        driverProfile.firstName,
        driverProfile.middleName,
        driverProfile.lastName
      ].filter(Boolean);
      driverName = parts.join(' ') || driverProfile.usaFullLegalName || 'Driver';
    } else {
      driverName = driverProfile.fullName || 'Driver';
    }

    // Return public profile (safe, non-sensitive fields only)
    return res.json({
      name: driverName,
      pronouns: null, // Reserved for future schema update
      profilePhotoUrl: driverProfile.profilePhotoUrl,
      vehicle: vehicle ? {
        type: vehicle.vehicleType || 'car',
        make: vehicle.make || null, // Vehicle brand/manufacturer
        model: vehicle.vehicleModel || 'Vehicle', // Combined "Brand Model" for display
        color: vehicle.color || 'Gray',
        plateNumber: vehicle.licensePlate || vehicle.vehiclePlate || '',
      } : null,
      stats: {
        totalRides: completedRidesCount,
        rating: Math.round(averageRating * 100) / 100,
        yearsActive: Math.max(0.1, Math.round(yearsActive * 10) / 10),
      },
    });
  } catch (error) {
    console.error("Get driver public profile error:", error);
    res.status(500).json({ error: "Failed to fetch driver profile" });
  }
});

// All routes below require authentication and driver role
router.use(authenticateToken);
router.use(requireRole(["driver"]));

// ====================================================
// GET /api/driver/notifications
// Get driver notifications with unread count
// ====================================================
router.get("/notifications", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    // Get notifications for this user
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Get unread count
    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    // Get total count for pagination
    const totalCount = await prisma.notification.count({
      where: { userId },
    });

    res.json({
      notifications,
      unreadCount,
      totalCount,
      hasMore: offset + limit < totalCount,
    });
  } catch (error) {
    console.error("Get driver notifications error:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// ====================================================
// PATCH /api/driver/notifications/:id/read
// Mark a notification as read
// ====================================================
router.patch("/notifications/:id/read", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const notificationId = req.params.id;

    // Verify notification belongs to user
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    // Mark as read
    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    res.json({ success: true, notification: updated });
  } catch (error) {
    console.error("Mark notification read error:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

// ====================================================
// PATCH /api/driver/notifications/read-all
// Mark all notifications as read
// ====================================================
router.patch("/notifications/read-all", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    res.status(500).json({ error: "Failed to update notifications" });
  }
});

// ====================================================
// GET /api/driver/home
// Get driver dashboard data
// ====================================================
router.get("/home", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get driver profile with all relationships
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Get user data separately
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        countryCode: true,
        isBlocked: true,
      },
    });

    // Get primary vehicle (or first active vehicle)
    const vehicle = await prisma.vehicle.findFirst({
      where: { 
        driverId: driverProfile.id,
        isActive: true,
      },
      orderBy: [
        { isPrimary: 'desc' }, // Primary first
        { createdAt: 'desc' },  // Then newest
      ],
    });

    // Get stats
    const stats = await prisma.driverStats.findUnique({
      where: { driverId: driverProfile.id },
    });

    // Get wallet
    const wallet = await prisma.driverWallet.findUnique({
      where: { driverId: driverProfile.id },
    });

    // Get vehicle documents payload with calculated statuses
    const vehicleDocuments = getVehicleDocumentsPayload(vehicle, driverProfile);

    res.json({
      profile: {
        id: driverProfile.id,
        email: user?.email,
        countryCode: user?.countryCode,
        verificationStatus: driverProfile.verificationStatus,
        isVerified: driverProfile.isVerified,
        rejectionReason: driverProfile.rejectionReason,
        createdAt: driverProfile.createdAt,
        // Personal info
        phoneNumber: driverProfile.phoneNumber,
        dateOfBirth: driverProfile.dateOfBirth,
        // Common KYC fields
        profilePhotoUrl: driverProfile.profilePhotoUrl,
        // USA structured name fields
        firstName: driverProfile.firstName,
        middleName: driverProfile.middleName,
        lastName: driverProfile.lastName,
        fullName: driverProfile.fullName,
        // License images
        dmvLicenseImageUrl: driverProfile.dmvLicenseImageUrl,
        tlcLicenseImageUrl: driverProfile.tlcLicenseImageUrl,
        driverLicenseImageUrl: driverProfile.driverLicenseImageUrl,
        // USA state (for TLC requirement check)
        usaState: driverProfile.usaState,
        usaCity: driverProfile.usaCity,
        // Identity documents (Bangladesh)
        nidNumber: driverProfile.nidEncrypted ? maskNID(decrypt(driverProfile.nidEncrypted)) : null,
        nidImageUrl: driverProfile.nidImageUrl,
        nidFrontImageUrl: driverProfile.nidFrontImageUrl,
        nidBackImageUrl: driverProfile.nidBackImageUrl,
        hasNID: !!driverProfile.nidEncrypted,
        // Identity documents (USA)
        ssnLast4: driverProfile.ssnLast4,
        ssnMasked: driverProfile.ssnEncrypted ? maskSSN(decrypt(driverProfile.ssnEncrypted)) : null,
        ssnCardImageUrl: driverProfile.ssnCardImageUrl,
        hasSSN: !!driverProfile.ssnEncrypted,
      },
      vehicle: vehicle ? {
        id: vehicle.id,
        vehicleType: vehicle.vehicleType,
        vehicleModel: vehicle.vehicleModel,
        vehiclePlate: vehicle.vehiclePlate,
        make: vehicle.make,
        year: vehicle.year,
        color: vehicle.color,
        licensePlate: vehicle.licensePlate,
        isOnline: vehicle.isOnline,
        totalEarnings: vehicle.totalEarnings,
      } : null,
      vehicleDocuments,
      stats: stats ? {
        rating: stats.rating,
        totalTrips: stats.totalTrips,
      } : null,
      wallet: wallet ? {
        balance: wallet.balance,
        negativeBalance: wallet.negativeBalance,
      } : null,
    });
  } catch (error) {
    console.error("Driver home error:", error);
    res.status(500).json({ error: "Failed to fetch driver data" });
  }
});

// ====================================================
// GET /api/driver/available-rides
// Get available rides in driver's country (no GPS matching)
// ====================================================
router.get("/available-rides", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const driverCountryCode = req.user!.countryCode;

    console.log(`[DEBUG] Driver ${userId} requesting available rides. Country: ${driverCountryCode}`);

    // Get driver profile to check verification status
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: true,
        vehicles: {
          where: { isActive: true },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    if (!driverProfile.isVerified) {
      return res.status(403).json({ error: "Driver must be verified to view available rides" });
    }

    // Check if driver is suspended
    if (driverProfile.isSuspended) {
      return res.status(403).json({
        error: "Your account is suspended. You cannot view or accept ride requests.",
        reason: driverProfile.suspensionReason,
      });
    }

    // Check if driver's account is blocked
    if (driverProfile.user.isBlocked) {
      return res.status(403).json({ error: "Your account is blocked. Please contact support." });
    }

    // Get all available rides in the driver's country
    // Match by country only - no GPS dependency
    const availableRides = await prisma.ride.findMany({
      where: {
        driverId: null, // No driver assigned yet
        status: {
          in: ["requested", "searching_driver"], // Available for acceptance
        },
        customer: {
          is: {
            user: {
              is: {
                countryCode: driverCountryCode, // Same country as driver
              },
            },
          },
        },
      },
      include: {
        customer: {
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
      orderBy: {
        createdAt: "asc", // FIFO - oldest requests first
      },
    });

    console.log(`[DEBUG] Found ${availableRides.length} available rides for driver in country ${driverCountryCode}`);
    availableRides.forEach(ride => {
      console.log(`[DEBUG] Ride ${ride.id}: Customer country = ${ride.customer.user.countryCode}, Pickup = ${ride.pickupAddress}`);
    });

    res.json({
      rides: availableRides.map(ride => ({
        id: ride.id,
        pickupAddress: ride.pickupAddress,
        dropoffAddress: ride.dropoffAddress,
        serviceFare: ride.serviceFare,
        driverPayout: ride.driverPayout,
        paymentMethod: ride.paymentMethod,
        status: ride.status,
        createdAt: ride.createdAt,
        customerEmail: ride.customer.user.email,
        customerCountry: ride.customer.user.countryCode,
      })),
    });
  } catch (error) {
    console.error("Get available rides error:", error);
    res.status(500).json({ error: "Failed to fetch available rides" });
  }
});

// ====================================================
// POST /api/driver/vehicle
// Register vehicle for driver
// ====================================================
router.post("/vehicle", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { vehicleType, vehicleModel, vehiclePlate } = req.body;

    if (!vehicleType || !vehicleModel || !vehiclePlate) {
      return res.status(400).json({ error: "vehicleType, vehicleModel, and vehiclePlate are required" });
    }

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { 
        vehicles: {
          where: { isActive: true },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Note: Multi-vehicle support - drivers can now have multiple vehicles
    // This endpoint is deprecated; use POST /api/driver/vehicles instead
    
    // Backward compatibility: Set isPrimary true if this is the first vehicle
    const isFirstVehicle = driverProfile.vehicles.length === 0;

    // Atomic transaction: Create vehicle and manage primary status
    const vehicle = await prisma.$transaction(async (tx) => {
      // If this is the first vehicle, mark it as primary
      // If driver has other vehicles, unset their primary status first
      if (!isFirstVehicle) {
        await tx.vehicle.updateMany({
          where: {
            driverId: driverProfile.id,
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
      }
      
      // Create the new vehicle (always set as primary for legacy endpoint)
      return await tx.vehicle.create({
        data: {
          id: randomUUID(),
          driverId: driverProfile.id,
          vehicleType,
          vehicleModel,
          vehiclePlate,
          isPrimary: true,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    });

    res.status(201).json({
      message: "Vehicle registered successfully",
      vehicle: {
        id: vehicle.id,
        vehicleType: vehicle.vehicleType,
        vehicleModel: vehicle.vehicleModel,
        vehiclePlate: vehicle.vehiclePlate,
        isOnline: vehicle.isOnline,
        totalEarnings: vehicle.totalEarnings,
      },
    });
  } catch (error) {
    console.error("Vehicle registration error:", error);
    res.status(500).json({ error: "Failed to register vehicle" });
  }
});

// ====================================================
// PATCH /api/driver/vehicle
// Update vehicle information
// ====================================================
router.patch("/vehicle", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { vehicleType, vehicleModel, vehiclePlate } = req.body;

    // Get driver profile with primary vehicle
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { 
        vehicles: {
          where: { isActive: true, isPrimary: true },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    let primaryVehicle = driverProfile.vehicles[0];
    
    // Backward compatibility: If no primary vehicle found, promote first active vehicle
    if (!primaryVehicle) {
      // Check if driver has ANY active vehicle (not marked as primary)
      const anyVehicle = await prisma.vehicle.findFirst({
        where: {
          driverId: driverProfile.id,
          isActive: true,
        },
      });
      
      if (!anyVehicle) {
        // No vehicle exists - should use POST, but be graceful
        return res.status(404).json({ 
          error: "No vehicle registered. Please use the registration form first." 
        });
      }
      
      // Atomic transaction: Promote this vehicle to primary
      primaryVehicle = await prisma.$transaction(async (tx) => {
        // Unset any existing primaries (defensive, shouldn't exist)
        await tx.vehicle.updateMany({
          where: {
            driverId: driverProfile.id,
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
        
        // Set this vehicle as primary
        return await tx.vehicle.update({
          where: { id: anyVehicle.id },
          data: { isPrimary: true },
        });
      });
    }

    // Prepare update data
    const updateData: any = {};
    if (vehicleType) updateData.vehicleType = vehicleType;
    if (vehicleModel) updateData.vehicleModel = vehicleModel;
    if (vehiclePlate) updateData.vehiclePlate = vehiclePlate;
    updateData.updatedAt = new Date();

    // Update the primary vehicle
    const updatedVehicle = await prisma.vehicle.update({
      where: { id: primaryVehicle.id },
      data: updateData,
    });

    res.json({
      message: "Vehicle updated successfully",
      vehicle: {
        id: updatedVehicle.id,
        vehicleType: updatedVehicle.vehicleType,
        vehicleModel: updatedVehicle.vehicleModel,
        vehiclePlate: updatedVehicle.vehiclePlate,
        isOnline: updatedVehicle.isOnline,
        totalEarnings: updatedVehicle.totalEarnings,
      },
    });
  } catch (error) {
    console.error("Vehicle update error:", error);
    res.status(500).json({ error: "Failed to update vehicle" });
  }
});

// ====================================================
// D1-A: MULTI-VEHICLE MANAGEMENT ENDPOINTS
// ====================================================

// Helper: Validate UUID format
function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// Helper: Get driver profile with KYC verification
async function getVerifiedDriverProfile(userId: string) {
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId },
    include: {
      vehicles: {
        where: { isActive: true },
      },
    },
  });

  if (!driverProfile) {
    return { error: "Driver profile not found", status: 404 };
  }

  if (!driverProfile.isVerified) {
    return { 
      error: "KYC verification required", 
      status: 403,
      kyc_required: true 
    };
  }

  return { profile: driverProfile };
}

// Helper: Verify vehicle ownership
async function verifyVehicleOwnership(vehicleId: string, driverId: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      driverId,
      isActive: true,
    },
  });

  if (!vehicle) {
    return { error: "Vehicle not found or you don't have permission", status: 404 };
  }

  return { vehicle };
}

// Zod schemas for vehicle validation
const createVehicleSchema = z.object({
  vehicleType: z.string().min(1, "Vehicle type is required"),
  make: z.string().min(1, "Make is required").max(50),
  model: z.string().min(1, "Model is required").max(100),
  year: z.number().int().min(1900).max(new Date().getFullYear()), // No future years
  color: z.string().min(1, "Color is required").max(30),
  plateNumber: z.string().min(1, "Plate number is required").max(20),
  insurancePolicyNumber: z.string().max(50).optional(),
  isPrimary: z.boolean().optional(),
});

const updateVehicleSchema = z.object({
  vehicleType: z.string().min(1).optional(),
  make: z.string().min(1).max(50).optional(),
  model: z.string().min(1).max(100).optional(),
  year: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
  color: z.string().min(1).max(30).optional(),
  plateNumber: z.string().min(1).max(20).optional(),
  insurancePolicyNumber: z.string().max(50).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update",
});

// ====================================================
// GET /api/driver/vehicles
// List all active vehicles for the authenticated driver
// ====================================================
router.get("/vehicles", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Get all active vehicles, ordered by primary first
    const vehicles = await prisma.vehicle.findMany({
      where: {
        driverId: driverProfile.id,
        isActive: true,
      },
      orderBy: [
        { isPrimary: 'desc' }, // Primary vehicle first
        { createdAt: 'desc' }, // Then newest
      ],
    });

    res.json({
      vehicles: vehicles.map(v => ({
        id: v.id,
        vehicleType: v.vehicleType,
        make: v.make,
        model: v.model,
        year: v.year,
        color: v.color,
        plateNumber: v.licensePlate || v.vehiclePlate,
        insurancePolicyNumber: v.insurancePolicyNumber,
        isPrimary: v.isPrimary,
        isOnline: v.isOnline,
        totalEarnings: v.totalEarnings,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Get vehicles error:", error);
    res.status(500).json({ error: "Failed to fetch vehicles" });
  }
});

// ====================================================
// POST /api/driver/vehicles
// Create a new vehicle for the authenticated driver
// Requires: KYC verification
// ====================================================
router.post("/vehicles", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Validate request body
    const validationResult = createVehicleSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validationResult.error.errors 
      });
    }

    const { vehicleType, make, model, year, color, plateNumber, insurancePolicyNumber, isPrimary } = validationResult.data;

    // Get verified driver profile using helper
    const profileResult = await getVerifiedDriverProfile(userId);
    if ('error' in profileResult) {
      return res.status(profileResult.status).json({ 
        error: profileResult.error,
        ...(profileResult.kyc_required && { kyc_required: true })
      });
    }

    const driverProfile = profileResult.profile;

    // Determine if this should be primary vehicle
    const existingVehicles = driverProfile.vehicles;
    const shouldBePrimary = isPrimary !== undefined ? isPrimary : existingVehicles.length === 0;

    // Atomic operation: Unset other primary vehicles, then create new one
    const vehicle = await prisma.$transaction(async (tx) => {
      // If setting as primary, unset all other vehicles' isPrimary
      if (shouldBePrimary) {
        await tx.vehicle.updateMany({
          where: {
            driverId: driverProfile.id,
            isActive: true,
          },
          data: { isPrimary: false },
        });
      }

      // Create vehicle
      return await tx.vehicle.create({
        data: {
          driverId: driverProfile.id,
          vehicleType,
          make,
          vehicleModel: model,
          year,
          color,
          vehiclePlate: plateNumber,
          licensePlate: plateNumber,
          insurancePolicyNumber: insurancePolicyNumber || null,
          isPrimary: shouldBePrimary,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    });

    res.status(201).json({
      message: "Vehicle created successfully",
      vehicle: {
        id: vehicle.id,
        vehicleType: vehicle.vehicleType,
        make: vehicle.make,
        model: vehicle.vehicleModel,
        year: vehicle.year,
        color: vehicle.color,
        plateNumber: vehicle.licensePlate,
        insurancePolicyNumber: vehicle.insurancePolicyNumber,
        isPrimary: vehicle.isPrimary,
        isOnline: vehicle.isOnline,
        totalEarnings: vehicle.totalEarnings,
        createdAt: vehicle.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Create vehicle error:", error);
    
    // Handle unique constraint violations (P2002)
    if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
      return res.status(409).json({ 
        error: "Constraint violation",
        message: "A conflicting vehicle record already exists"
      });
    }
    
    // Handle transaction errors from ownership verification
    if (error.message === "Vehicle not found, inactive, or permission denied") {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: "Failed to create vehicle" });
  }
});

// ====================================================
// PATCH /api/driver/vehicles/:id
// Update an existing vehicle (ownership enforced)
// Requires: KYC verification
// ====================================================
router.patch("/vehicles/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id: vehicleId } = req.params;

    // Validate UUID format using helper
    if (!isValidUUID(vehicleId)) {
      return res.status(400).json({ error: "Invalid vehicle ID format" });
    }

    // Validate request body
    const validationResult = updateVehicleSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validationResult.error.errors 
      });
    }

    // Get verified driver profile using helper
    const profileResult = await getVerifiedDriverProfile(userId);
    if ('error' in profileResult) {
      return res.status(profileResult.status).json({ 
        error: profileResult.error,
        ...(profileResult.kyc_required && { kyc_required: true })
      });
    }

    const driverProfile = profileResult.profile;

    // Prepare update data
    const { vehicleType, make, model, year, color, plateNumber, insurancePolicyNumber } = validationResult.data;
    const updateData: any = { updatedAt: new Date() };
    
    if (vehicleType) updateData.vehicleType = vehicleType;
    if (make) updateData.make = make;
    if (model) updateData.vehicleModel = model;
    if (year) updateData.year = year;
    if (color) updateData.color = color;
    if (plateNumber) {
      updateData.vehiclePlate = plateNumber;
      updateData.licensePlate = plateNumber;
    }
    if (insurancePolicyNumber !== undefined) updateData.insurancePolicyNumber = insurancePolicyNumber;

    // Update vehicle with ownership verification inside transaction
    const updatedVehicle = await prisma.$transaction(async (tx) => {
      // Re-verify ownership inside transaction to prevent race conditions
      const vehicle = await tx.vehicle.findFirst({
        where: {
          id: vehicleId,
          driverId: driverProfile.id,
          isActive: true,
        },
      });

      if (!vehicle) {
        throw new Error("Vehicle not found, inactive, or permission denied");
      }

      return await tx.vehicle.update({
        where: { id: vehicleId },
        data: updateData,
      });
    });

    res.json({
      message: "Vehicle updated successfully",
      vehicle: {
        id: updatedVehicle.id,
        vehicleType: updatedVehicle.vehicleType,
        make: updatedVehicle.make,
        model: updatedVehicle.vehicleModel,
        year: updatedVehicle.year,
        color: updatedVehicle.color,
        plateNumber: updatedVehicle.licensePlate,
        insurancePolicyNumber: updatedVehicle.insurancePolicyNumber,
        isPrimary: updatedVehicle.isPrimary,
        isOnline: updatedVehicle.isOnline,
        totalEarnings: updatedVehicle.totalEarnings,
        updatedAt: updatedVehicle.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Update vehicle error:", error);
    
    // Handle transaction errors from ownership verification
    if (error.message === "Vehicle not found, inactive, or permission denied") {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: "Failed to update vehicle" });
  }
});

// ====================================================
// DELETE /api/driver/vehicles/:id
// Soft delete a vehicle (ownership enforced)
// Requires: KYC verification
// Business rule: If deleting primary vehicle, auto-assign another
// ====================================================
router.delete("/vehicles/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id: vehicleId } = req.params;

    // Validate UUID format using helper
    if (!isValidUUID(vehicleId)) {
      return res.status(400).json({ error: "Invalid vehicle ID format" });
    }

    // Get verified driver profile using helper
    const profileResult = await getVerifiedDriverProfile(userId);
    if ('error' in profileResult) {
      return res.status(profileResult.status).json({ 
        error: profileResult.error,
        ...(profileResult.kyc_required && { kyc_required: true })
      });
    }

    const driverProfile = profileResult.profile;

    // Verify vehicle ownership
    const vehicle = driverProfile.vehicles.find(v => v.id === vehicleId);
    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found or you don't have permission to delete it" });
    }

    // Atomic operation: Soft delete, reassign primary if needed
    await prisma.$transaction(async (tx) => {
      // Soft delete the vehicle
      await tx.vehicle.update({
        where: { id: vehicleId },
        data: { 
          isActive: false,
          isPrimary: false,
          isOnline: false,
          updatedAt: new Date(),
        },
      });

      // If this was the primary vehicle, re-query remaining active vehicles 
      // and promote the newest one to primary
      if (vehicle.isPrimary) {
        const remainingVehicles = await tx.vehicle.findMany({
          where: {
            driverId: driverProfile.id,
            isActive: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        });
        
        if (remainingVehicles.length > 0) {
          await tx.vehicle.update({
            where: { id: remainingVehicles[0].id },
            data: { isPrimary: true, updatedAt: new Date() },
          });
        }
        // If no remaining vehicles, driver has zero vehicles - no primary needed
      }
    });

    res.json({
      success: true,
      message: "Vehicle deleted successfully",
    });
  } catch (error) {
    console.error("Delete vehicle error:", error);
    res.status(500).json({ error: "Failed to delete vehicle" });
  }
});

// ====================================================
// PATCH /api/driver/vehicles/:id/set-primary
// Set a vehicle as primary (ownership enforced)
// Requires: KYC verification
// Business rule: Automatically unset isPrimary on all other vehicles
// ====================================================
router.patch("/vehicles/:id/set-primary", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id: vehicleId } = req.params;

    // Validate UUID format using helper
    if (!isValidUUID(vehicleId)) {
      return res.status(400).json({ error: "Invalid vehicle ID format" });
    }

    // Get verified driver profile using helper
    const profileResult = await getVerifiedDriverProfile(userId);
    if ('error' in profileResult) {
      return res.status(profileResult.status).json({ 
        error: profileResult.error,
        ...(profileResult.kyc_required && { kyc_required: true })
      });
    }

    const driverProfile = profileResult.profile;

    // Atomic operation: Verify ownership inside transaction, unset all others, set this one
    const updatedVehicle = await prisma.$transaction(async (tx) => {
      // Re-verify ownership inside transaction to prevent race conditions
      const vehicle = await tx.vehicle.findFirst({
        where: {
          id: vehicleId,
          driverId: driverProfile.id,
          isActive: true,
        },
      });

      if (!vehicle) {
        throw new Error("Vehicle not found, inactive, or permission denied");
      }

      // Unset primary on all driver's vehicles
      await tx.vehicle.updateMany({
        where: {
          driverId: driverProfile.id,
          isActive: true,
        },
        data: { isPrimary: false },
      });
      
      // Set this vehicle as primary
      return await tx.vehicle.update({
        where: { id: vehicleId },
        data: { 
          isPrimary: true,
          updatedAt: new Date(),
        },
      });
    });

    res.json({
      message: "Primary vehicle updated successfully",
      vehicle: {
        id: updatedVehicle.id,
        vehicleType: updatedVehicle.vehicleType,
        make: updatedVehicle.make,
        model: updatedVehicle.vehicleModel,
        isPrimary: updatedVehicle.isPrimary,
      },
    });
  } catch (error: any) {
    console.error("Set primary vehicle error:", error);
    
    // Handle transaction errors from ownership verification
    if (error.message === "Vehicle not found, inactive, or permission denied") {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: "Failed to set primary vehicle" });
  }
});

// ====================================================
// D2: VEHICLE CATEGORY MANAGEMENT ENDPOINTS
// Implements Uber-style 7-category dispatch eligibility
// ====================================================

// Zod schema for vehicle category request
const vehicleCategoryRequestSchema = z.object({
  vehicleCategory: z.enum(['X', 'COMFORT', 'COMFORT_XL', 'XL', 'BLACK', 'BLACK_SUV', 'WAV']),
  wheelchairAccessible: z.boolean().optional(),
  exteriorColor: z.string().max(30).optional(),
  interiorColor: z.string().max(30).optional(),
  seatCapacity: z.number().int().min(1).max(15).optional(),
});

// ====================================================
// GET /api/driver/vehicle-categories
// Get all vehicle categories and their requirements
// ====================================================
router.get("/vehicle-categories", async (_req, res) => {
  try {
    const categories = Object.entries(VEHICLE_CATEGORIES).map(([id, cat]) => ({
      id,
      ...cat,
    }));

    res.json({
      categories,
      categoryIds: VEHICLE_CATEGORY_ORDER,
    });
  } catch (error) {
    console.error("Get vehicle categories error:", error);
    res.status(500).json({ error: "Failed to fetch vehicle categories" });
  }
});

// ====================================================
// GET /api/driver/vehicles/:id/category-eligibility
// Check what categories a vehicle can serve based on its category
// ====================================================
router.get("/vehicles/:id/category-eligibility", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id: vehicleId } = req.params;

    if (!isValidUUID(vehicleId)) {
      return res.status(400).json({ error: "Invalid vehicle ID format" });
    }

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        driverId: driverProfile.id,
        isActive: true,
      },
    });

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    const vehicleCategory = (vehicle as any).vehicleCategory as VehicleCategoryId | null;
    const vehicleCategoryStatus = (vehicle as any).vehicleCategoryStatus as string | null;

    if (!vehicleCategory || !isValidVehicleCategoryId(vehicleCategory)) {
      return res.json({
        vehicleId: vehicle.id,
        hasCategory: false,
        message: "Vehicle has no category assigned. Please request a category.",
        eligibleToServe: [],
      });
    }

    const eligibleCategories = getEligibleDriverCategories(vehicleCategory);
    const categoryInfo = getVehicleCategory(vehicleCategory);

    res.json({
      vehicleId: vehicle.id,
      hasCategory: true,
      vehicleCategory,
      categoryStatus: vehicleCategoryStatus || 'pending',
      categoryInfo,
      eligibleToServe: eligibleCategories.map(catId => ({
        categoryId: catId,
        ...getVehicleCategory(catId),
      })),
      wheelchairAccessible: (vehicle as any).wheelchairAccessible || false,
      wavEligible: vehicleCategory === 'WAV',
    });
  } catch (error) {
    console.error("Get category eligibility error:", error);
    res.status(500).json({ error: "Failed to fetch category eligibility" });
  }
});

// ====================================================
// POST /api/driver/vehicles/:id/request-category
// Request a vehicle category for dispatch eligibility
// Requires admin approval
// ====================================================
router.post("/vehicles/:id/request-category", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id: vehicleId } = req.params;

    if (!isValidUUID(vehicleId)) {
      return res.status(400).json({ error: "Invalid vehicle ID format" });
    }

    const validationResult = vehicleCategoryRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.errors,
      });
    }

    const { vehicleCategory, wheelchairAccessible, exteriorColor, interiorColor, seatCapacity } = validationResult.data;

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        driverId: driverProfile.id,
        isActive: true,
      },
    });

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    const categoryInfo = getVehicleCategory(vehicleCategory);
    if (!categoryInfo) {
      return res.status(400).json({ error: "Invalid vehicle category" });
    }

    if (vehicle.year) {
      const currentYear = new Date().getFullYear();
      const vehicleAge = currentYear - vehicle.year;
      if (vehicleAge > categoryInfo.maxVehicleAge) {
        return res.status(400).json({
          error: `Vehicle too old for ${categoryInfo.name}. Max age: ${categoryInfo.maxVehicleAge} years, your vehicle: ${vehicleAge} years.`,
        });
      }
    }

    if (vehicleCategory === 'WAV' && !wheelchairAccessible) {
      return res.status(400).json({
        error: "WAV category requires wheelchair accessibility. Please confirm your vehicle is wheelchair accessible.",
      });
    }

    const updateData: any = {
      vehicleCategory,
      vehicleCategoryStatus: 'pending',
      updatedAt: new Date(),
    };

    if (wheelchairAccessible !== undefined) {
      updateData.wheelchairAccessible = wheelchairAccessible;
    }
    if (exteriorColor) {
      updateData.exteriorColor = exteriorColor;
    }
    if (interiorColor) {
      updateData.interiorColor = interiorColor;
    }
    if (seatCapacity !== undefined) {
      updateData.seatCapacity = seatCapacity;
    }

    const updatedVehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: updateData,
    });

    res.json({
      success: true,
      message: `Category ${categoryInfo.name} requested successfully. Pending admin approval.`,
      vehicle: {
        id: updatedVehicle.id,
        vehicleType: updatedVehicle.vehicleType,
        make: updatedVehicle.make,
        model: updatedVehicle.vehicleModel,
        vehicleCategory: (updatedVehicle as any).vehicleCategory,
        categoryStatus: (updatedVehicle as any).vehicleCategoryStatus,
        categoryInfo,
      },
    });
  } catch (error) {
    console.error("Request category error:", error);
    res.status(500).json({ error: "Failed to request vehicle category" });
  }
});

// ====================================================
// GET /api/driver/category-preferences
// Get driver's category preferences for ride dispatch
// ====================================================
router.get("/category-preferences", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const result = await driverVehicleService.getDriverCategoryPreferences(driverProfile.id);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Get category preferences error:", error);
    res.status(500).json({ error: "Failed to get category preferences" });
  }
});

// ====================================================
// PUT /api/driver/category-preferences
// Update driver's allowed categories for ride dispatch
// ====================================================
const categoryPreferencesSchema = z.object({
  allowedCategories: z.array(z.string()).min(1, "At least one category must be enabled"),
});

router.put("/category-preferences", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const validationResult = categoryPreferencesSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.errors,
      });
    }

    const { allowedCategories } = validationResult.data;

    // Validate all categories are valid VehicleCategoryIds
    const invalidCategories = allowedCategories.filter(c => !isValidVehicleCategoryId(c));
    if (invalidCategories.length > 0) {
      return res.status(400).json({
        error: `Invalid categories: ${invalidCategories.join(", ")}`,
      });
    }

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const result = await driverVehicleService.updateDriverCategoryPreferences(
      driverProfile.id,
      allowedCategories as VehicleCategoryId[]
    );

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        validationErrors: (result as any).validationErrors,
        validationWarnings: (result as any).validationWarnings,
      });
    }

    res.json({
      success: true,
      message: "Category preferences updated successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("Update category preferences error:", error);
    res.status(500).json({ error: "Failed to update category preferences" });
  }
});

// ====================================================
// GET /api/driver/dispatch-eligibility
// Get the driver's current dispatch eligibility based on primary vehicle
// ====================================================
router.get("/dispatch-eligibility", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        vehicles: {
          where: { isActive: true, isPrimary: true },
          take: 1,
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const primaryVehicle = driverProfile.vehicles[0];

    if (!primaryVehicle) {
      return res.json({
        hasEligibility: false,
        message: "No primary vehicle registered. Please register a vehicle first.",
        eligibleCategories: [],
      });
    }

    const vehicleCategory = (primaryVehicle as any).vehicleCategory as VehicleCategoryId | null;
    const vehicleCategoryStatus = (primaryVehicle as any).vehicleCategoryStatus as string | null;

    if (!vehicleCategory || !isValidVehicleCategoryId(vehicleCategory)) {
      return res.json({
        hasEligibility: false,
        message: "Vehicle category not set. Please request a category for your vehicle.",
        eligibleCategories: [],
        vehicle: {
          id: primaryVehicle.id,
          make: primaryVehicle.make,
          model: primaryVehicle.vehicleModel,
        },
      });
    }

    if (vehicleCategoryStatus !== 'approved') {
      return res.json({
        hasEligibility: false,
        message: `Category ${vehicleCategory} is pending approval. You'll be eligible for dispatch once approved.`,
        pendingCategory: vehicleCategory,
        categoryStatus: vehicleCategoryStatus,
        eligibleCategories: [],
        vehicle: {
          id: primaryVehicle.id,
          make: primaryVehicle.make,
          model: primaryVehicle.vehicleModel,
        },
      });
    }

    const eligibleCategories = getEligibleDriverCategories(vehicleCategory);

    res.json({
      hasEligibility: true,
      vehicleCategory,
      categoryInfo: getVehicleCategoryInfo(vehicleCategory),
      eligibleCategories: eligibleCategories.map(catId => ({
        categoryId: catId,
        ...getVehicleCategory(catId),
      })),
      wheelchairAccessible: (primaryVehicle as any).wheelchairAccessible || false,
      wavEligible: vehicleCategory === 'WAV',
      vehicle: {
        id: primaryVehicle.id,
        make: primaryVehicle.make,
        model: primaryVehicle.vehicleModel,
        year: primaryVehicle.year,
        color: primaryVehicle.color,
      },
    });
  } catch (error) {
    console.error("Get dispatch eligibility error:", error);
    res.status(500).json({ error: "Failed to fetch dispatch eligibility" });
  }
});

// ====================================================
// PATCH /api/driver/profile
// Update driver profile (KYC data)
// ====================================================
router.patch("/profile", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const profileData = req.body;

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Prepare update data based on country
    const updateData: any = {};
    
    // Common fields
    if (profileData.dateOfBirth) updateData.dateOfBirth = new Date(profileData.dateOfBirth);
    if (profileData.emergencyContactName) updateData.emergencyContactName = profileData.emergencyContactName;
    if (profileData.emergencyContactPhone) updateData.emergencyContactPhone = profileData.emergencyContactPhone;

    // Bangladesh-specific fields
    if (driverProfile.user.countryCode === "BD") {
      if (profileData.fatherName) updateData.fatherName = profileData.fatherName;
      if (profileData.presentAddress) updateData.presentAddress = profileData.presentAddress;
      if (profileData.permanentAddress) updateData.permanentAddress = profileData.permanentAddress;
      if (profileData.nidNumber) updateData.nidNumber = profileData.nidNumber;
      if (profileData.nidFrontImageUrl) updateData.nidFrontImageUrl = profileData.nidFrontImageUrl;
      if (profileData.nidBackImageUrl) updateData.nidBackImageUrl = profileData.nidBackImageUrl;
    }

    // US-specific fields
    if (driverProfile.user.countryCode === "US") {
      if (profileData.homeAddress) updateData.homeAddress = profileData.homeAddress;
      if (profileData.usaStreet) updateData.usaStreet = profileData.usaStreet;
      if (profileData.usaCity) updateData.usaCity = profileData.usaCity;
      if (profileData.usaState) updateData.usaState = profileData.usaState;
      if (profileData.usaZipCode) updateData.usaZipCode = profileData.usaZipCode;
      if (profileData.governmentIdType) updateData.governmentIdType = profileData.governmentIdType;
      if (profileData.governmentIdLast4) updateData.governmentIdLast4 = profileData.governmentIdLast4;
      if (profileData.driverLicenseNumber) updateData.driverLicenseNumber = profileData.driverLicenseNumber;
      if (profileData.driverLicenseImageUrl) updateData.driverLicenseImageUrl = profileData.driverLicenseImageUrl;
      if (profileData.driverLicenseExpiry) updateData.driverLicenseExpiry = new Date(profileData.driverLicenseExpiry);
      if (profileData.ssnLast4) updateData.ssnLast4 = profileData.ssnLast4;
    }
    
    // International address fields (for non-US, non-BD drivers)
    if (driverProfile.user.countryCode !== "US" && driverProfile.user.countryCode !== "BD") {
      if (profileData.streetAddress) updateData.streetAddress = profileData.streetAddress;
      if (profileData.city) updateData.city = profileData.city;
      if (profileData.state) updateData.state = profileData.state;
      if (profileData.zipCode) updateData.zipCode = profileData.zipCode;
    }

    // Update profile
    const updatedProfile = await prisma.driverProfile.update({
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
// PATCH /api/driver/status
// Update driver online/offline status
// ====================================================
router.patch("/status", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { isOnline } = req.body;

    if (typeof isOnline !== "boolean") {
      return res.status(400).json({ error: "isOnline must be a boolean" });
    }

    // Get driver profile with primary vehicle and user data
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { 
        vehicles: {
          where: { isActive: true, isPrimary: true },
        },
        user: {
          select: { isBlocked: true },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const primaryVehicle = driverProfile.vehicles[0];
    if (!primaryVehicle) {
      return res.status(400).json({ error: "Vehicle not registered. Please complete vehicle registration first." });
    }

    // Check if driver is verified (required to go online)
    if (isOnline && !driverProfile.isVerified) {
      return res.status(403).json({ error: "Driver must be verified before going online" });
    }

    // Check if user is blocked by admin (cannot go online)
    if (isOnline && driverProfile.user.isBlocked) {
      return res.status(403).json({ error: "Your account is blocked. Please contact support." });
    }

    // Check for active trips - drivers with active trips cannot toggle status
    // Check for active rides
    const activeRide = await prisma.ride.findFirst({
      where: {
        driverId: driverProfile.id,
        status: { in: ["accepted", "driver_arriving", "arrived", "in_progress"] },
      },
    });

    if (activeRide) {
      const action = isOnline ? "go online" : "go offline";
      return res.status(400).json({ 
        error: `Cannot ${action} with an active ride. Please complete or cancel your current ride first.`,
        hasActiveTrip: true,
        tripType: "ride",
      });
    }

    // Check for active food deliveries
    const activeFoodOrder = await prisma.foodOrder.findFirst({
      where: {
        deliveryDriverId: driverProfile.id,
        status: { in: ["assigned_driver", "driver_picking_up", "picked_up", "delivering"] },
      },
    });

    if (activeFoodOrder) {
      const action = isOnline ? "go online" : "go offline";
      return res.status(400).json({ 
        error: `Cannot ${action} with an active food delivery. Please complete your current delivery first.`,
        hasActiveTrip: true,
        tripType: "food",
      });
    }

    // Check for active parcel deliveries
    const activeParcelDelivery = await prisma.delivery.findFirst({
      where: {
        driverId: driverProfile.id,
        status: { in: ["accepted", "picked_up", "in_transit"] },
      },
    });

    if (activeParcelDelivery) {
      const action = isOnline ? "go online" : "go offline";
      return res.status(400).json({ 
        error: `Cannot ${action} with an active parcel delivery. Please complete your current delivery first.`,
        hasActiveTrip: true,
        tripType: "parcel",
      });
    }

    // Update vehicle online status
    const updatedVehicle = await prisma.vehicle.update({
      where: { id: primaryVehicle.id },
      data: { isOnline },
    });

    // Update driver's lastActive timestamp when going online
    if (isOnline) {
      await prisma.driverProfile.update({
        where: { id: driverProfile.id },
        data: { lastActive: new Date() },
      });
    }

    res.json({
      message: `Driver is now ${isOnline ? "online" : "offline"}`,
      vehicle: {
        id: updatedVehicle.id,
        isOnline: updatedVehicle.isOnline,
      },
    });
  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// ====================================================
// Phase A: POST /api/driver/location
// Update driver's live GPS location
// ====================================================
const locationUpdateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().optional(),
  speed: z.number().optional(),
  accuracy: z.number().optional(),
});

router.post("/location", authenticateToken, requireRole(["driver"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const validatedData = locationUpdateSchema.parse(req.body);

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        vehicles: {
          where: { isActive: true, isPrimary: true, isOnline: true },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Only update location if driver is online
    if (driverProfile.vehicles.length === 0) {
      return res.status(403).json({ error: "Driver must be online to broadcast location" });
    }

    // Update driver's current location in profile
    await prisma.driverProfile.update({
      where: { id: driverProfile.id },
      data: {
        currentLat: validatedData.lat,
        currentLng: validatedData.lng,
        lastLocationUpdate: new Date(),
        lastActive: new Date(),
      },
    });

    // If driver has an active ride, also store in RideLiveLocation for tracking history
    const activeRide = await prisma.ride.findFirst({
      where: {
        driverId: driverProfile.id,
        status: {
          in: ["accepted", "driver_arriving", "arrived", "in_progress"],
        },
      },
    });

    if (activeRide) {
      await prisma.rideLiveLocation.create({
        data: {
          rideId: activeRide.id,
          driverId: driverProfile.id,
          lat: validatedData.lat,
          lng: validatedData.lng,
          heading: validatedData.heading,
          speed: validatedData.speed,
          accuracy: validatedData.accuracy,
        },
      });
    }

    res.json({
      message: "Location updated",
      location: {
        lat: validatedData.lat,
        lng: validatedData.lng,
        updatedAt: new Date().toISOString(),
      },
      activeRideId: activeRide?.id || null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid location data", details: error.errors });
    }
    console.error("Location update error:", error);
    res.status(500).json({ error: "Failed to update location" });
  }
});

// ====================================================
// Phase A: GET /api/driver/active-ride
// Get driver's currently active ride
// ====================================================
router.get("/active-ride", authenticateToken, requireRole(["driver"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const activeRide = await prisma.ride.findFirst({
      where: {
        driverId: driverProfile.id,
        status: {
          in: ["accepted", "driver_arriving", "arrived", "in_progress"],
        },
      },
      include: {
        customer: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!activeRide) {
      return res.json({ activeRide: null });
    }

    res.json({
      activeRide: {
        id: activeRide.id,
        status: activeRide.status,
        currentLeg: activeRide.currentLeg || "to_pickup",
        pickupAddress: activeRide.pickupAddress,
        pickupLat: activeRide.pickupLat,
        pickupLng: activeRide.pickupLng,
        dropoffAddress: activeRide.dropoffAddress,
        dropoffLat: activeRide.dropoffLat,
        dropoffLng: activeRide.dropoffLng,
        routePolyline: activeRide.routePolyline,
        distanceMiles: activeRide.distanceMiles,
        durationMinutes: activeRide.durationMinutes,
        trafficEtaSeconds: activeRide.trafficEtaSeconds,
        serviceFare: serializeDecimal(activeRide.serviceFare),
        driverPayout: serializeDecimal(activeRide.driverPayout),
        paymentMethod: activeRide.paymentMethod,
        createdAt: activeRide.createdAt,
        acceptedAt: activeRide.acceptedAt,
        arrivedAt: activeRide.arrivedAt,
        tripStartedAt: activeRide.tripStartedAt,
        customer: {
          fullName: activeRide.customer.fullName || "Customer",
          phoneNumber: activeRide.customer.phoneNumber,
        },
      },
    });
  } catch (error) {
    console.error("Get active ride error:", error);
    res.status(500).json({ error: "Failed to get active ride" });
  }
});

// ====================================================
// Phase A: GET /api/driver/pending-requests
// Get pending ride requests for online drivers
// ====================================================
router.get("/pending-requests", authenticateToken, requireRole(["driver"]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        vehicles: {
          where: { isActive: true, isPrimary: true, isOnline: true },
        },
        user: {
          select: { countryCode: true },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    if (!driverProfile.isVerified) {
      return res.status(403).json({ error: "Driver must be verified to receive ride requests" });
    }

    if (driverProfile.vehicles.length === 0) {
      return res.json({ requests: [], message: "Driver is offline" });
    }

    // Check if driver already has an active ride
    const existingActiveRide = await prisma.ride.findFirst({
      where: {
        driverId: driverProfile.id,
        status: { in: ["accepted", "driver_arriving", "arrived", "in_progress"] },
      },
    });

    if (existingActiveRide) {
      return res.json({ requests: [], message: "Driver already has an active ride" });
    }

    // Get pending ride requests in the same country
    const pendingRides = await prisma.ride.findMany({
      where: {
        status: { in: ["requested", "searching_driver"] },
        driverId: null,
        countryCode: driverProfile.user.countryCode,
        isDemo: false,
      },
      include: {
        customer: {
          select: {
            fullName: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 5,
    });

    res.json({
      requests: pendingRides.map((ride) => ({
        id: ride.id,
        pickupAddress: ride.pickupAddress,
        pickupLat: ride.pickupLat,
        pickupLng: ride.pickupLng,
        dropoffAddress: ride.dropoffAddress,
        dropoffLat: ride.dropoffLat,
        dropoffLng: ride.dropoffLng,
        distanceMiles: ride.distanceMiles,
        durationMinutes: ride.durationMinutes,
        serviceFare: serializeDecimal(ride.serviceFare),
        driverPayout: serializeDecimal(ride.driverPayout),
        paymentMethod: ride.paymentMethod,
        createdAt: ride.createdAt,
        customer: {
          fullName: ride.customer.fullName || "Customer",
        },
      })),
    });
  } catch (error) {
    console.error("Get pending requests error:", error);
    res.status(500).json({ error: "Failed to get pending requests" });
  }
});

// ====================================================
// GET /api/driver/bd-identity
// Get driver's own Bangladesh identity profile
// ====================================================
router.get("/bd-identity", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Check if driver is from Bangladesh
    if (driverProfile.user.countryCode !== "BD") {
      return res.status(400).json({ 
        error: "Bangladesh identity information is only available for Bangladesh drivers" 
      });
    }

    // Return BD identity fields (exclude nidEncrypted)
    res.json({
      fullName: driverProfile.fullName || "",
      fatherName: driverProfile.fatherName || "",
      phoneNumber: driverProfile.phoneNumber || "",
      village: driverProfile.village || "",
      postOffice: driverProfile.postOffice || "",
      thana: driverProfile.thana || "",
      district: driverProfile.district || "",
      presentAddress: driverProfile.presentAddress || "",
      permanentAddress: driverProfile.permanentAddress || "",
      nidFrontImageUrl: driverProfile.nidFrontImageUrl || "",
      nidBackImageUrl: driverProfile.nidBackImageUrl || "",
      // NID is fetched separately via /nid endpoint for security
    });
  } catch (error) {
    console.error("Get BD identity error:", error);
    res.status(500).json({ error: "Failed to fetch Bangladesh identity" });
  }
});

// ====================================================
// PUT /api/driver/bd-identity
// Update driver's own Bangladesh identity profile
// NID is REQUIRED for Bangladesh drivers
// ====================================================
const bdIdentitySchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
  fatherName: z.string().min(2, "Father's name must be at least 2 characters").max(100),
  phoneNumber: z.string().refine(isValidBdPhone, {
    message: "Invalid Bangladesh phone number format (must be 01XXXXXXXXX)",
  }),
  village: z.string().min(2).max(100),
  postOffice: z.string().min(2).max(100),
  thana: z.string().min(2).max(100),
  district: z.string().min(2).max(100),
  presentAddress: z.string().min(5).max(500),
  permanentAddress: z.string().min(5).max(500),
  // NID is optional - only update if provided (allows editing other fields without re-entering NID)
  nid: z.string().refine((val) => !val || isValidBdNid(val), {
    message: "Invalid Bangladesh NID format (must be 10, 13, or 17 digits)",
  }).optional(),
  nidFrontImageUrl: z.string().url().optional(),
  nidBackImageUrl: z.string().url().optional(),
});

router.put("/bd-identity", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Check if driver is from Bangladesh
    if (driverProfile.user.countryCode !== "BD") {
      return res.status(400).json({ 
        error: "Bangladesh identity information is only available for Bangladesh drivers" 
      });
    }

    // Validate request body
    const validation = bdIdentitySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.errors 
      });
    }

    const data = validation.data;

    // Prepare update data
    const updateData: any = {
      fullName: data.fullName.trim(),
      fatherName: data.fatherName.trim(),
      phoneNumber: data.phoneNumber.trim(),
      village: data.village.trim(),
      postOffice: data.postOffice.trim(),
      thana: data.thana.trim(),
      district: data.district.trim(),
      presentAddress: data.presentAddress.trim(),
      permanentAddress: data.permanentAddress.trim(),
    };

    // Only encrypt and update NID if provided (allows editing other fields without re-entering NID)
    if (data.nid && data.nid.trim()) {
      updateData.nidEncrypted = encrypt(data.nid.trim());
      // Also update legacy nidNumber field for backward compatibility
      updateData.nidNumber = data.nid.trim();
    }

    // Add image URLs if provided
    if (data.nidFrontImageUrl) {
      updateData.nidFrontImageUrl = data.nidFrontImageUrl;
    }
    if (data.nidBackImageUrl) {
      updateData.nidBackImageUrl = data.nidBackImageUrl;
    }

    // Update driver profile
    const updatedProfile = await prisma.driverProfile.update({
      where: { userId },
      data: updateData,
    });

    res.json({
      message: "Bangladesh identity updated successfully",
      identity: {
        fullName: updatedProfile.fullName,
        fatherName: updatedProfile.fatherName,
        phoneNumber: updatedProfile.phoneNumber,
        village: updatedProfile.village,
        postOffice: updatedProfile.postOffice,
        thana: updatedProfile.thana,
        district: updatedProfile.district,
        presentAddress: updatedProfile.presentAddress,
        permanentAddress: updatedProfile.permanentAddress,
        nidFrontImageUrl: updatedProfile.nidFrontImageUrl,
        nidBackImageUrl: updatedProfile.nidBackImageUrl,
      },
    });
  } catch (error) {
    console.error("Update BD identity error:", error);
    res.status(500).json({ error: "Failed to update Bangladesh identity" });
  }
});

// ====================================================
// GET /api/driver/nid
// Decrypt and return driver's own NID
// ====================================================
router.get("/nid", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Check if driver is from Bangladesh
    if (driverProfile.user.countryCode !== "BD") {
      return res.status(400).json({ 
        error: "NID information is only available for Bangladesh drivers" 
      });
    }

    // Decrypt NID if exists
    let nid = "";
    if (driverProfile.nidEncrypted) {
      try {
        nid = decrypt(driverProfile.nidEncrypted);
      } catch (decryptError) {
        console.error("NID decryption failed:", decryptError);
        return res.status(500).json({ error: "Failed to decrypt NID" });
      }
    } else if (driverProfile.nidNumber) {
      // Fallback to legacy plaintext NID
      nid = driverProfile.nidNumber;
    }

    if (!nid) {
      return res.status(404).json({ error: "NID not found" });
    }

    res.json({ nid });
  } catch (error) {
    console.error("Get NID error:", error);
    res.status(500).json({ error: "Failed to fetch NID" });
  }
});

// ====================================================
// POST /api/driver/upload/profile-photo
// Upload driver profile photo
// ====================================================
router.post("/upload/profile-photo", uploadProfilePhoto, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: "No file uploaded" 
      });
    }

    // Verify driver profile exists
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ 
        success: false,
        error: "Driver profile not found" 
      });
    }

    const fileUrl = getFileUrl(req.file.filename);

    // Update driver profile with photo URL
    await prisma.driverProfile.update({
      where: { userId },
      data: { profilePhotoUrl: fileUrl },
    });

    res.json({
      success: true,
      message: "Profile photo uploaded successfully",
      profilePhotoUrl: fileUrl,
    });
  } catch (error) {
    console.error("Profile photo upload error:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to upload profile photo" 
    });
  }
});

// ====================================================
// POST /api/driver/upload/dmv-license
// Upload DMV driver license image (USA drivers only)
// ====================================================
router.post("/upload/dmv-license", uploadLicenseImage, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Verify driver is from USA
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    if (driverProfile.user.countryCode !== "US") {
      return res.status(400).json({
        error: "DMV license upload is only available for USA drivers",
      });
    }

    const fileUrl = getFileUrl(req.file.filename);

    // Update driver profile with DMV license URL
    await prisma.driverProfile.update({
      where: { userId },
      data: { dmvLicenseImageUrl: fileUrl },
    });

    res.json({
      message: "DMV license uploaded successfully",
      dmvLicenseImageUrl: fileUrl,
    });
  } catch (error) {
    console.error("DMV license upload error:", error);
    res.status(500).json({ error: "Failed to upload DMV license" });
  }
});

// ====================================================
// POST /api/driver/upload/tlc-license
// Upload TLC license image (NY state drivers only)
// ====================================================
router.post("/upload/tlc-license", uploadLicenseImage, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Verify driver is from NY state
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    if (driverProfile.user.countryCode !== "US") {
      return res.status(400).json({
        error: "TLC license upload is only available for USA drivers",
      });
    }

    if (driverProfile.usaState !== "NY") {
      return res.status(400).json({
        error: "TLC license is only required for NY state drivers",
      });
    }

    const fileUrl = getFileUrl(req.file.filename);

    // Update driver profile with TLC license URL
    await prisma.driverProfile.update({
      where: { userId },
      data: { tlcLicenseImageUrl: fileUrl },
    });

    res.json({
      message: "TLC license uploaded successfully",
      tlcLicenseImageUrl: fileUrl,
    });
  } catch (error) {
    console.error("TLC license upload error:", error);
    res.status(500).json({ error: "Failed to upload TLC license" });
  }
});

// ====================================================
// POST /api/driver/upload/nid-image
// Upload NID (National ID) image (Bangladesh drivers only)
// ====================================================
router.post("/upload/nid-image", uploadLicenseImage, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Verify driver is from Bangladesh
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    if (driverProfile.user.countryCode !== "BD") {
      return res.status(400).json({
        error: "NID image upload is only available for Bangladesh drivers",
      });
    }

    const fileUrl = getFileUrl(req.file.filename);

    // Update driver profile with NID image URL
    await prisma.driverProfile.update({
      where: { userId },
      data: { nidImageUrl: fileUrl },
    });

    res.json({
      message: "NID image uploaded successfully",
      nidImageUrl: fileUrl,
    });
  } catch (error) {
    console.error("NID image upload error:", error);
    res.status(500).json({ error: "Failed to upload NID image" });
  }
});

// ====================================================
// POST /api/driver/upload/ssn-card
// Upload SSN card image (USA drivers only)
// ====================================================
router.post("/upload/ssn-card", uploadLicenseImage, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Verify driver is from USA
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    if (driverProfile.user.countryCode !== "US") {
      return res.status(400).json({
        error: "SSN card upload is only available for USA drivers",
      });
    }

    const fileUrl = getFileUrl(req.file.filename);

    // Update driver profile with SSN card image URL
    await prisma.driverProfile.update({
      where: { userId },
      data: { ssnCardImageUrl: fileUrl },
    });

    res.json({
      message: "SSN card uploaded successfully",
      ssnCardImageUrl: fileUrl,
    });
  } catch (error) {
    console.error("SSN card upload error:", error);
    res.status(500).json({ error: "Failed to upload SSN card" });
  }
});

// ====================================================
// PUT /api/driver/usa-name
// Update USA driver structured name fields
// ====================================================
const usaNameSchema = z.object({
  firstName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional(),
  lastName: z.string().min(1).max(100),
});

router.put("/usa-name", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Check if driver is from USA
    if (driverProfile.user.countryCode !== "US") {
      return res.status(400).json({
        error: "Name structure update is only available for USA drivers",
      });
    }

    // Validate request body
    const validation = usaNameSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.errors,
      });
    }

    const data = validation.data;

    // Update driver profile
    const updatedProfile = await prisma.driverProfile.update({
      where: { userId },
      data: {
        firstName: data.firstName.trim(),
        middleName: data.middleName?.trim() || null,
        lastName: data.lastName.trim(),
      },
    });

    res.json({
      message: "Name updated successfully",
      profile: {
        firstName: updatedProfile.firstName,
        middleName: updatedProfile.middleName,
        lastName: updatedProfile.lastName,
      },
    });
  } catch (error) {
    console.error("USA name update error:", error);
    res.status(500).json({ error: "Failed to update name" });
  }
});

// ====================================================
// PUT /api/driver/identity/nid
// Update NID number (Bangladesh drivers only)
// ====================================================
const nidSchema = z.object({
  nidNumber: z.string().min(10).max(17),
});

router.put("/identity/nid", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Check if driver is from Bangladesh
    if (driverProfile.user.countryCode !== "BD") {
      return res.status(400).json({
        error: "NID number update is only available for Bangladesh drivers",
      });
    }

    // Validate request body
    const validation = nidSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.errors,
      });
    }

    const { nidNumber } = validation.data;

    // Validate NID format
    if (!isValidBdNid(nidNumber)) {
      return res.status(400).json({
        error: "Invalid NID format. Must be 10-17 digits.",
      });
    }

    // Encrypt and store NID
    const nidEncrypted = encrypt(nidNumber);

    // Update driver profile
    await prisma.driverProfile.update({
      where: { userId },
      data: {
        nidEncrypted,
        nidNumber: nidNumber, // Store masked version in nidNumber field
      },
    });

    res.json({
      message: "NID number updated successfully",
    });
  } catch (error) {
    console.error("NID update error:", error);
    res.status(500).json({ error: "Failed to update NID number" });
  }
});

// ====================================================
// PUT /api/driver/identity/ssn
// Update SSN (USA drivers only)
// ====================================================
const ssnSchema = z.object({
  ssn: z.string().min(9).max(11), // Accepts XXX-XX-XXXX or XXXXXXXXX
});

router.put("/identity/ssn", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Check if driver is from USA
    if (driverProfile.user.countryCode !== "US") {
      return res.status(400).json({
        error: "SSN update is only available for USA drivers",
      });
    }

    // Validate request body
    const validation = ssnSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.errors,
      });
    }

    const { ssn } = validation.data;

    // Validate SSN format
    const { isValidSSN } = await import("../utils/encryption");
    if (!isValidSSN(ssn)) {
      return res.status(400).json({
        error: "Invalid SSN format. Must be XXX-XX-XXXX or 9 digits.",
      });
    }

    // Get last 4 digits for display
    const cleaned = ssn.replace(/\D/g, "");
    const ssnLast4 = cleaned.substring(5, 9);

    // Encrypt and store SSN
    const ssnEncrypted = encrypt(cleaned);

    // Update driver profile
    await prisma.driverProfile.update({
      where: { userId },
      data: {
        ssnEncrypted,
        ssnLast4,
      },
    });

    res.json({
      message: "SSN updated successfully",
    });
  } catch (error) {
    console.error("SSN update error:", error);
    res.status(500).json({ error: "Failed to update SSN" });
  }
});

// ====================================================
// PUT /api/driver/tax-info
// Update driver tax information
// ====================================================
const taxInfoSchema = z.object({
  fullLegalName: z.string().min(1),
  taxId: z.string().optional(),
  taxClassification: z.string().min(1),
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  w9Status: z.string().optional(),
  taxCertificationAccepted: z.boolean().optional(),
});

router.put("/tax-info", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Validate request body
    const validation = taxInfoSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.errors,
      });
    }

    const { fullLegalName, taxId, taxClassification, street, city, state, postalCode, w9Status, taxCertificationAccepted } = validation.data;

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const updateData: any = {
      usaFullLegalName: fullLegalName,
      taxClassification,
      usaStreet: street,
      usaCity: city,
      usaState: state,
      usaZipCode: postalCode,
      w9Status: w9Status || "pending",
      w9SubmittedAt: w9Status === "submitted" || w9Status === "approved" ? new Date() : null,
      taxCertificationAccepted: taxCertificationAccepted || false,
      taxCertificationDate: taxCertificationAccepted ? new Date() : null,
      taxYear: taxCertificationAccepted ? new Date().getFullYear() : null,
    };

    // If taxId is provided and not masked, encrypt and store it
    if (taxId && !taxId.includes("*")) {
      const cleaned = taxId.replace(/\D/g, "");
      
      // Validate based on country
      if (driverProfile.user.countryCode === "US") {
        const { isValidSSN } = await import("../utils/encryption");
        if (!isValidSSN(taxId)) {
          return res.status(400).json({
            error: "Invalid SSN format. Must be XXX-XX-XXXX or 9 digits.",
          });
        }
        
        const ssnLast4 = cleaned.substring(5, 9);
        updateData.ssnEncrypted = encrypt(cleaned);
        updateData.ssnLast4 = ssnLast4;
      } else if (driverProfile.user.countryCode === "BD") {
        const { isValidBdNid } = await import("../utils/encryption");
        if (!isValidBdNid(taxId)) {
          return res.status(400).json({
            error: "Invalid NID format. Must be 10-17 digits.",
          });
        }
        
        updateData.nidEncrypted = encrypt(cleaned);
      }
    }

    // Update driver profile
    await prisma.driverProfile.update({
      where: { userId },
      data: updateData,
    });

    res.json({
      message: "Tax information updated successfully",
    });
  } catch (error) {
    console.error("Tax info update error:", error);
    res.status(500).json({ error: "Failed to update tax information" });
  }
});

// ====================================================
// POST /api/driver/upload/vehicle-document
// Upload vehicle document (registration or insurance)
// ====================================================
router.post("/upload/vehicle-document", uploadVehicleDocument, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { documentType, vehicleId, description, expiresAt } = req.body;

    // Validate document type - expanded to include all required vehicle documents
    const validDocTypes = [
      "registration",
      "insurance",
      "vehicleInspection",
      "driverLicenseVehicle",
      "licensePlate",
      "tlcLicense",
      "tlcDiamond",
    ];

    if (!validDocTypes.includes(documentType)) {
      return res.status(400).json({
        error: `Invalid document type. Must be one of: ${validDocTypes.join(", ")}`,
      });
    }

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // If vehicleId provided, verify it belongs to this driver
    if (vehicleId) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
      });

      if (!vehicle || vehicle.driverId !== driverProfile.id) {
        return res.status(400).json({
          error: "Invalid vehicle ID or vehicle does not belong to you",
        });
      }
    }

    const fileUrl = getFileUrl(req.file.filename);

    // Create vehicle document record
    const document = await prisma.vehicleDocument.create({
      data: {
        id: randomUUID(),
        driverId: driverProfile.id,
        vehicleId: vehicleId || null,
        documentType,
        fileUrl,
        description: description || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        updatedAt: new Date(),
      },
    });

    res.json({
      message: "Vehicle document uploaded successfully",
      document,
    });
  } catch (error) {
    console.error("Vehicle document upload error:", error);
    res.status(500).json({ error: "Failed to upload vehicle document" });
  }
});

// ====================================================
// GET /api/driver/vehicle-documents
// Get all vehicle documents for the driver
// ====================================================
router.get("/vehicle-documents", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Get all vehicle documents for this driver
    const documents = await prisma.vehicleDocument.findMany({
      where: { driverId: driverProfile.id },
      include: {
        vehicle: {
          select: {
            id: true,
            make: true,
            vehicleModel: true,
            year: true,
            vehiclePlate: true,
          },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });

    res.json({ documents });
  } catch (error) {
    console.error("Get vehicle documents error:", error);
    res.status(500).json({ error: "Failed to fetch vehicle documents" });
  }
});

// ====================================================
// DELETE /api/driver/vehicle-documents/:id
// Delete a vehicle document
// ====================================================
router.delete("/vehicle-documents/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Get document and verify ownership
    const document = await prisma.vehicleDocument.findUnique({
      where: { id },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (document.driverId !== driverProfile.id) {
      return res.status(403).json({ error: "Not authorized to delete this document" });
    }

    // Delete document record
    await prisma.vehicleDocument.delete({
      where: { id },
    });

    res.json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Delete vehicle document error:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// ====================================================
// D7: DRIVER DOCUMENT CENTER ENDPOINTS
// ====================================================

// GET /api/driver/documents/summary
// Get comprehensive document status summary for the driver
// ====================================================
router.get("/documents/summary", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ 
        success: false, 
        error: "Driver profile not found" 
      });
    }

    const { getDriverDocumentSummary } = await import("../services/driverDocumentService");
    const summary = await getDriverDocumentSummary(driverProfile.id);

    if (!summary) {
      return res.status(404).json({ 
        success: false, 
        error: "Document summary not found" 
      });
    }

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Get document summary error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch document summary" 
    });
  }
});

// POST /api/driver/documents/upload/:documentType
// Upload a specific document type
// ====================================================
router.post("/documents/upload/:documentType", uploadVehicleDocument, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { documentType } = req.params;
    const { vehicleId, expiresAt } = req.body;

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: "No file uploaded" 
      });
    }

    const validDocTypes = [
      "profile_photo",
      "driver_license",
      "tlc_license", 
      "nid",
      "insurance",
      "registration",
      "vehicle_inspection",
    ];

    if (!validDocTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid document type. Must be one of: ${validDocTypes.join(", ")}`,
      });
    }

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { countryCode: true } },
        vehicles: { where: { isPrimary: true }, take: 1 },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ 
        success: false, 
        error: "Driver profile not found" 
      });
    }

    const fileUrl = getFileUrl(req.file.filename);
    const primaryVehicle = driverProfile.vehicles[0];

    // Update the appropriate field based on document type
    switch (documentType) {
      case "profile_photo":
        await prisma.driverProfile.update({
          where: { id: driverProfile.id },
          data: { 
            profilePhotoUrl: fileUrl,
            profilePhotoStatus: "UNDER_REVIEW" as any,
          },
        });
        break;

      case "driver_license":
        await prisma.driverProfile.update({
          where: { id: driverProfile.id },
          data: { 
            dmvLicenseFrontUrl: fileUrl,
            dmvLicenseExpiry: expiresAt ? new Date(expiresAt) : undefined,
            driverLicenseStatus: "UNDER_REVIEW" as any,
          },
        });
        break;

      case "tlc_license":
        await prisma.driverProfile.update({
          where: { id: driverProfile.id },
          data: { 
            tlcLicenseFrontUrl: fileUrl,
            tlcLicenseExpiry: expiresAt ? new Date(expiresAt) : undefined,
            tlcLicenseDocStatus: "UNDER_REVIEW" as any,
          },
        });
        break;

      case "nid":
        await prisma.driverProfile.update({
          where: { id: driverProfile.id },
          data: { 
            nidFrontImageUrl: fileUrl,
            nidStatus: "UNDER_REVIEW" as any,
          },
        });
        break;

      case "insurance":
        if (!primaryVehicle) {
          return res.status(400).json({ 
            success: false, 
            error: "No primary vehicle found. Please add a vehicle first." 
          });
        }
        await prisma.vehicle.update({
          where: { id: primaryVehicle.id },
          data: {
            insuranceDocumentUrl: fileUrl,
            insuranceExpiry: expiresAt ? new Date(expiresAt) : undefined,
            insuranceStatus: "UNDER_REVIEW",
            insuranceLastUpdated: new Date(),
          },
        });
        break;

      case "registration":
        if (!primaryVehicle) {
          return res.status(400).json({ 
            success: false, 
            error: "No primary vehicle found. Please add a vehicle first." 
          });
        }
        await prisma.vehicle.update({
          where: { id: primaryVehicle.id },
          data: {
            registrationDocumentUrl: fileUrl,
            registrationExpiry: expiresAt ? new Date(expiresAt) : undefined,
            registrationStatus: "UNDER_REVIEW",
            registrationLastUpdated: new Date(),
          },
        });
        break;

      case "vehicle_inspection":
        if (!primaryVehicle) {
          return res.status(400).json({ 
            success: false, 
            error: "No primary vehicle found. Please add a vehicle first." 
          });
        }
        await prisma.vehicle.update({
          where: { id: primaryVehicle.id },
          data: {
            dmvInspectionImageUrl: fileUrl,
            dmvInspectionExpiry: expiresAt ? new Date(expiresAt) : undefined,
            inspectionStatus: "UNDER_REVIEW",
            inspectionLastUpdated: new Date(),
          },
        });
        break;
    }

    res.json({
      success: true,
      message: `${documentType.replace(/_/g, " ")} uploaded successfully`,
      fileUrl,
    });
  } catch (error) {
    console.error("Document upload error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to upload document" 
    });
  }
});

// ====================================================
// PUT /api/driver/vehicle-kyc-details
// Update vehicle KYC text fields (color, model, license plate)
// ====================================================
router.put("/vehicle-kyc-details", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { vehicleMake, vehicleColor, vehicleModel, vehicleDisplayName, licensePlateNumber } = req.body;

    // Get driver profile with vehicles and user
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        vehicles: {
          where: { isActive: true, isPrimary: true },
        },
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const isUSA = driverProfile.user.countryCode === "US";

    // Validation for USA drivers - trim first, then check for emptiness
    if (isUSA) {
      const colorTrimmed = vehicleColor?.trim();
      const modelTrimmed = vehicleModel?.trim();
      const plateTrimmed = licensePlateNumber?.trim();
      
      if (!colorTrimmed) {
        return res.status(400).json({ error: "Vehicle color is required for USA drivers" });
      }
      if (!modelTrimmed) {
        return res.status(400).json({ error: "Vehicle model is required for USA drivers" });
      }
      if (!plateTrimmed) {
        return res.status(400).json({ error: "License plate number is required for USA drivers" });
      }
    }

    // Find or create primary vehicle
    let primaryVehicle = driverProfile.vehicles[0];

    // Use vehicleDisplayName for legacy vehicleModel field (backward compatibility)
    // vehicleDisplayName = "Brand Model" combined, vehicleModel = model-only
    const legacyVehicleModel = vehicleDisplayName || vehicleModel || "Not specified";
    
    if (!primaryVehicle) {
      // Create a new primary vehicle with provided details
      primaryVehicle = await prisma.vehicle.create({
        data: {
          id: randomUUID(),
          driverId: driverProfile.id,
          vehicleType: "car", // Default type
          make: vehicleMake || null,
          vehicleModel: legacyVehicleModel, // Store combined "Brand Model" for backward compatibility
          vehiclePlate: licensePlateNumber || "Not specified",
          color: vehicleColor || null,
          licensePlate: licensePlateNumber || null,
          isPrimary: true,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    } else {
      // Update existing primary vehicle
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (vehicleMake) updateData.make = vehicleMake.trim();
      if (vehicleColor) updateData.color = vehicleColor.trim();
      // Always use vehicleDisplayName for the combined "Brand Model" format
      if (vehicleDisplayName) {
        updateData.vehicleModel = vehicleDisplayName.trim(); // Combined "Brand Model" for backward compatibility
      } else if (vehicleModel) {
        updateData.vehicleModel = vehicleModel.trim(); // Fallback to model-only
      }
      if (licensePlateNumber) {
        updateData.licensePlate = licensePlateNumber.trim();
        updateData.vehiclePlate = licensePlateNumber.trim(); // Also update vehiclePlate for consistency
      }

      primaryVehicle = await prisma.vehicle.update({
        where: { id: primaryVehicle.id },
        data: updateData,
      });
    }

    res.json({
      message: "Vehicle KYC details updated successfully",
      vehicle: {
        id: primaryVehicle.id,
        make: primaryVehicle.make,
        color: primaryVehicle.color,
        vehicleModel: primaryVehicle.vehicleModel, // Combined "Brand Model" for display
        licensePlate: primaryVehicle.licensePlate,
      },
    });
  } catch (error) {
    console.error("Vehicle KYC details update error:", error);
    res.status(500).json({ error: "Failed to update vehicle KYC details" });
  }
});

// ====================================================
// PATCH /api/driver/documents/license-plate
// Update license plate number (text-based document)
// ====================================================
const updateLicensePlateSchema = z.object({
  licensePlateNumber: z.string().min(1, "License plate number is required").max(20, "License plate too long"),
  plateCountry: z.string().optional(),
  plateState: z.string().optional(),
});

router.patch("/documents/license-plate", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Validate request body with Zod
    const validationResult = updateLicensePlateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const { licensePlateNumber, plateCountry, plateState } = validationResult.data;

    // Get driver profile with primary vehicle
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        vehicles: {
          where: { isActive: true, isPrimary: true },
        },
        user: {
          select: { countryCode: true },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    let primaryVehicle = driverProfile.vehicles[0];

    if (!primaryVehicle) {
      // Create a new primary vehicle with license plate
      primaryVehicle = await prisma.vehicle.create({
        data: {
          id: randomUUID(),
          driverId: driverProfile.id,
          vehicleType: "car",
          vehicleModel: "Not specified",
          vehiclePlate: licensePlateNumber.trim(),
          licensePlate: licensePlateNumber.trim(),
          plateCountry: plateCountry || driverProfile.user.countryCode || null,
          plateState: plateState || null,
          plateStatus: "UNDER_REVIEW",
          licensePlateLastUpdated: new Date(),
          licensePlateVerificationStatus: "pending_review",
          isPrimary: true,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    } else {
      // Update existing primary vehicle with license plate
      primaryVehicle = await prisma.vehicle.update({
        where: { id: primaryVehicle.id },
        data: {
          licensePlate: licensePlateNumber.trim(),
          vehiclePlate: licensePlateNumber.trim(),
          plateCountry: plateCountry || driverProfile.user.countryCode || primaryVehicle.plateCountry,
          plateState: plateState || primaryVehicle.plateState,
          plateStatus: "UNDER_REVIEW",
          licensePlateLastUpdated: new Date(),
          licensePlateVerificationStatus: "pending_review",
          licensePlateRejectionReason: null, // Clear any previous rejection
          updatedAt: new Date(),
        },
      });
    }

    res.json({
      success: true,
      message: "License plate number submitted successfully",
      plate: {
        plateNumber: primaryVehicle.licensePlate,
        country: primaryVehicle.plateCountry,
        state: primaryVehicle.plateState,
        status: primaryVehicle.plateStatus,
        lastUpdated: primaryVehicle.licensePlateLastUpdated,
      },
    });
  } catch (error) {
    console.error("License plate update error:", error);
    res.status(500).json({ error: "Failed to update license plate" });
  }
});

// ====================================================
// WALLET & PAYOUT API
// ====================================================

// GET /api/driver/wallet
// Get driver wallet details
router.get("/wallet", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: driverProfile.id,
          ownerType: "driver",
        },
      },
    });

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    res.json(wallet);
  } catch (error) {
    console.error("Get wallet error:", error);
    res.status(500).json({ error: "Failed to fetch wallet" });
  }
});

// GET /api/driver/wallet/transactions
// Get driver wallet transaction history
router.get("/wallet/transactions", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: driverProfile.id,
          ownerType: "driver",
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

// POST /api/driver/payout/request
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

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: driverProfile.id,
          ownerType: "driver",
        },
      },
    });

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Check if driver has negative balance
    if (!wallet.negativeBalance.isZero()) {
      return res.status(400).json({
        error: `Cannot request payout while debt exists. Outstanding commission: ${wallet.negativeBalance} ${wallet.currency}`,
      });
    }

    // Check if driver has sufficient available balance
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
          ownerType: "driver",
          ownerId: driverProfile.id,
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
          ownerType: "driver",
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

// GET /api/driver/payouts
// Get driver payout history
router.get("/payouts", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const where: any = {
      ownerType: "driver",
      ownerId: driverProfile.id,
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
// GET /api/driver/opportunity-bonuses
// Get all effective opportunity bonuses for driver
// ====================================================
router.get("/opportunity-bonuses", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get driver's country code
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { countryCode: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const countryCode = user.countryCode || "US";
    const now = new Date();

    // Fetch all active opportunity settings for this country
    const settings = await prisma.opportunitySetting.findMany({
      where: {
        countryCode,
        isActive: true,
        isDemo: false,
      },
    });

    // Calculate effective bonus for each bonus type
    const bonuses = settings.map((setting) => {
      const isWithinDateRange =
        (!setting.startAt || new Date(setting.startAt) <= now) &&
        (!setting.endAt || new Date(setting.endAt) >= now);

      let effectiveBonus = setting.baseAmount;
      let isPromoActive = false;

      if (isWithinDateRange) {
        if (setting.promoAmount && setting.promoAmount.gt(setting.baseAmount)) {
          effectiveBonus = setting.promoAmount;
          isPromoActive = true;
        } else if (setting.promoMultiplier) {
          effectiveBonus = setting.baseAmount.mul(setting.promoMultiplier);
          isPromoActive = true;
        }
      }

      const currencySymbol = setting.currency === "BDT" ? "৳" : "$";

      return {
        bonusType: setting.bonusType,
        baseAmount: setting.baseAmount.toString(),
        effectiveBonus: effectiveBonus.toString(),
        currency: setting.currency,
        currencySymbol,
        isPromoActive,
        zoneId: setting.zoneId,
        startAt: setting.startAt,
        endAt: setting.endAt,
      };
    });

    res.json({ bonuses });
  } catch (error) {
    console.error("Error fetching opportunity bonuses:", error);
    res.status(500).json({ error: "Failed to fetch opportunity bonuses" });
  }
});

// ====================================================
// GET /api/driver/referral-bonus
// Get current effective referral bonus for driver
// ====================================================
router.get("/referral-bonus", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get driver's country code
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { countryCode: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const countryCode = user.countryCode || "US";
    const now = new Date();

    // Fetch active referral setting for this country and driver type
    const setting = await prisma.referralSetting.findFirst({
      where: {
        countryCode,
        userType: "driver",
        isActive: true,
        isDemo: false,
      },
    });

    // Default fallback if no setting exists
    if (!setting) {
      const defaultAmount = countryCode === "BD" ? 500 : 50;
      const defaultCurrency = countryCode === "BD" ? "BDT" : "USD";
      return res.json({
        baseAmount: defaultAmount.toString(),
        effectiveBonus: defaultAmount.toString(),
        currency: defaultCurrency,
        currencySymbol: countryCode === "BD" ? "৳" : "$",
        isPromoActive: false,
        promoLabel: null,
        promoEndDate: null,
      });
    }

    // Calculate effective bonus
    const isWithinDateRange =
      (!setting.startAt || new Date(setting.startAt) <= now) &&
      (!setting.endAt || new Date(setting.endAt) >= now);

    let effectiveBonus = setting.baseAmount;
    let isPromoActive = false;

    if (isWithinDateRange) {
      if (setting.promoAmount && setting.promoAmount.gt(setting.baseAmount)) {
        effectiveBonus = setting.promoAmount;
        isPromoActive = true;
      } else if (setting.promoMultiplier) {
        effectiveBonus = setting.baseAmount.mul(setting.promoMultiplier);
        isPromoActive = true;
      }
    }

    const currencySymbol = setting.currency === "BDT" ? "৳" : "$";

    res.json({
      baseAmount: setting.baseAmount.toString(),
      effectiveBonus: effectiveBonus.toString(),
      currency: setting.currency,
      currencySymbol,
      isPromoActive,
      promoLabel: isPromoActive ? setting.promoLabel : null,
      promoEndDate: isPromoActive && setting.endAt ? setting.endAt : null,
    });
  } catch (error) {
    console.error("Error fetching referral bonus:", error);
    res.status(500).json({ error: "Failed to fetch referral bonus" });
  }
});

// ====================================================
// GET /api/driver/points
// Get driver's current points, tier, and progress
// Updated to support "no tier yet" state for drivers < 500 points
// Ensures Premium always appears before Diamond via displayOrder
// ====================================================
router.get("/points", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Get or create driver points
    let driverPoints = await prisma.driverPoints.findUnique({
      where: { driverId: driverProfile.id },
      include: {
        tier: {
          include: {
            benefits: {
              where: { isActive: true },
              orderBy: { displayOrder: "asc" },
            },
          },
        },
      },
    });

    // If no record exists, create one with NO TIER (null) since new drivers have 0 points
    if (!driverPoints) {
      driverPoints = await prisma.driverPoints.create({
        data: {
          driverId: driverProfile.id,
          currentTierId: undefined, // Explicitly undefined - drivers need 500 points to unlock Blue tier
          totalPoints: 0,
          lifetimePoints: 0,
        },
        include: {
          tier: {
            include: {
              benefits: {
                where: { isActive: true },
                orderBy: { displayOrder: "asc" },
              },
            },
          },
        },
      });
    }

    // Safety check after creation
    if (!driverPoints) {
      return res.status(500).json({ error: "Failed to create driver points record" });
    }

    // Get all active tiers ordered by displayOrder (CRITICAL: ensures Blue→Gold→Premium→Diamond order)
    const allTiers = await prisma.driverTier.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      include: {
        benefits: {
          where: { isActive: true },
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    const totalPoints = driverPoints.totalPoints;
    const hasNoTier = totalPoints < 500;

    // Build response based on tier status
    if (hasNoTier) {
      // Driver has no tier yet (< 500 points)
      const blueTier = allTiers.find(t => t.displayOrder === 1);
      const pointsToBlue = blueTier ? blueTier.requiredPoints - totalPoints : 500;
      const progressPercentage = blueTier ? (totalPoints / blueTier.requiredPoints) * 100 : 0;

      return res.json({
        hasNoTier: true,
        currentTier: null,
        totalPoints,
        lifetimePoints: driverPoints.lifetimePoints,
        lastEarnedAt: driverPoints.lastEarnedAt,
        nextTier: blueTier ? {
          id: blueTier.id,
          name: blueTier.name,
          requiredPoints: blueTier.requiredPoints,
          color: blueTier.color,
          description: blueTier.description,
        } : null,
        progressPercentage: Math.min(progressPercentage, 100),
        pointsToNextTier: pointsToBlue,
        allTiers: allTiers.map(t => ({
          id: t.id,
          name: t.name,
          requiredPoints: t.requiredPoints,
          color: t.color,
          description: t.description,
          displayOrder: t.displayOrder,
          isCurrentTier: false,
          isUnlocked: false,
          benefits: t.benefits.map(b => ({
            id: b.id,
            text: b.benefitText,
          })),
        })),
      });
    }

    // Driver has a tier (>= 500 points)
    const currentTier = driverPoints.tier;
    const currentTierIndex = allTiers.findIndex(t => t.id === currentTier?.id);
    const nextTier = currentTierIndex < allTiers.length - 1 ? allTiers[currentTierIndex + 1] : null;
    
    let progressPercentage = 100;
    let pointsToNextTier = 0;
    
    if (nextTier && currentTier) {
      const pointsInCurrentTier = totalPoints - currentTier.requiredPoints;
      const pointsNeededForNextTier = nextTier.requiredPoints - currentTier.requiredPoints;
      progressPercentage = Math.min(100, (pointsInCurrentTier / pointsNeededForNextTier) * 100);
      pointsToNextTier = Math.max(0, nextTier.requiredPoints - totalPoints);
    }

    res.json({
      hasNoTier: false,
      currentTier: currentTier ? {
        id: currentTier.id,
        name: currentTier.name,
        color: currentTier.color,
        description: currentTier.description,
        requiredPoints: currentTier.requiredPoints,
        displayOrder: currentTier.displayOrder,
        benefits: currentTier.benefits.map(b => ({
          id: b.id,
          text: b.benefitText,
        })),
      } : null,
      totalPoints,
      lifetimePoints: driverPoints.lifetimePoints,
      lastEarnedAt: driverPoints.lastEarnedAt,
      nextTier: nextTier ? {
        id: nextTier.id,
        name: nextTier.name,
        requiredPoints: nextTier.requiredPoints,
        color: nextTier.color,
        description: nextTier.description,
      } : null,
      progressPercentage,
      pointsToNextTier,
      allTiers: allTiers.map(t => ({
        id: t.id,
        name: t.name,
        requiredPoints: t.requiredPoints,
        color: t.color,
        description: t.description,
        displayOrder: t.displayOrder,
        isCurrentTier: t.id === currentTier?.id,
        isUnlocked: totalPoints >= t.requiredPoints,
        benefits: t.benefits.map(b => ({
          id: b.id,
          text: b.benefitText,
        })),
      })),
    });
  } catch (error) {
    console.error("Error fetching driver points:", error);
    res.status(500).json({ error: "Failed to fetch driver points" });
  }
});

// ====================================================
// GET /api/driver/points/history
// Get points transaction history with pagination
// ====================================================
router.get("/points/history", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    // Parse and sanitize pagination parameters
    const pageParam = parseInt(req.query.page as string);
    const limitParam = parseInt(req.query.limit as string);
    
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit = Number.isInteger(limitParam) && limitParam > 0 
      ? Math.min(100, limitParam) 
      : 50;
    const skip = (page - 1) * limit;

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Get driver points
    const driverPoints = await prisma.driverPoints.findUnique({
      where: { driverId: driverProfile.id },
    });

    if (!driverPoints) {
      return res.json({ 
        transactions: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        }
      });
    }

    // Get points transaction history with pagination and deterministic ordering
    const [transactions, total] = await Promise.all([
      prisma.pointsTransaction.findMany({
        where: { driverPointsId: driverPoints.id },
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" }, // Secondary sort for deterministic ordering
        ],
        skip,
        take: limit,
      }),
      prisma.pointsTransaction.count({
        where: { driverPointsId: driverPoints.id },
      }),
    ]);

    res.json({
      transactions: transactions.map(t => ({
        id: t.id,
        points: t.points,
        reason: t.reason,
        referenceType: t.referenceType,
        referenceId: t.referenceId,
        createdAt: t.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching points history:", error);
    res.status(500).json({ error: "Failed to fetch points history" });
  }
});

// ====================================================
// WALLET APIs
// ====================================================

// ====================================================
// GET /api/driver/wallet/summary
// Get wallet summary for driver home page
// ====================================================
router.get("/wallet/summary", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const countryCode = req.user!.countryCode;
    
    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Get or create wallet using the walletService
    const { walletService } = await import("../services/walletService");
    const currency = countryCode === "BD" ? "BDT" : "USD";
    
    const wallet = await walletService.getOrCreateWallet({
      ownerId: driverProfile.id,
      ownerType: "driver",
      countryCode,
      currency,
    });

    // Get next scheduled weekly payout
    const nextScheduledPayout = await prisma.payout.findFirst({
      where: {
        ownerId: driverProfile.id,
        ownerType: "driver",
        method: "auto_weekly",
        status: "pending",
        scheduledAt: {
          gte: new Date(),
        },
      },
      orderBy: { scheduledAt: "asc" },
    });

    // Get pending payouts total
    const pendingPayouts = await prisma.payout.aggregate({
      where: {
        ownerId: driverProfile.id,
        ownerType: "driver",
        status: {
          in: ["pending", "processing"],
        },
      },
      _sum: {
        amount: true,
      },
    });

    res.json({
      currentBalance: serializeDecimal(wallet.availableBalance),
      negativeBalance: serializeDecimal(wallet.negativeBalance),
      pendingBalance: serializeDecimal(pendingPayouts._sum.amount),
      nextScheduledPayoutDate: nextScheduledPayout?.scheduledAt || null,
      currency: wallet.currency,
    });
  } catch (error) {
    console.error("Error fetching wallet summary:", error);
    res.status(500).json({ error: "Failed to fetch wallet summary" });
  }
});

// ====================================================
// GET /api/driver/wallet/payouts
// Get recent payouts with pagination
// ====================================================
router.get("/wallet/payouts", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    // Parse pagination
    const limitParam = parseInt(req.query.limit as string);
    const offsetParam = parseInt(req.query.offset as string);
    
    const limit = Number.isInteger(limitParam) && limitParam > 0 
      ? Math.min(100, limitParam) 
      : 10;
    const offset = Number.isInteger(offsetParam) && offsetParam >= 0 
      ? offsetParam 
      : 0;
    
    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Get payouts
    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where: {
          ownerId: driverProfile.id,
          ownerType: "driver",
        },
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
        skip: offset,
        take: limit,
      }),
      prisma.payout.count({
        where: {
          ownerId: driverProfile.id,
          ownerType: "driver",
        },
      }),
    ]);

    res.json({
      payouts: payouts.map(p => ({
        id: p.id,
        amount: serializeDecimal(p.amount),
        method: p.method,
        status: p.status,
        initiatedAt: p.createdAt,
        completedAt: p.processedAt,
        scheduledAt: p.scheduledAt,
        failureReason: p.failureReason,
      })),
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Error fetching payouts:", error);
    res.status(500).json({ error: "Failed to fetch payouts" });
  }
});

// ====================================================
// GET /api/driver/wallet/balance
// Get transaction timeline with filters
// ====================================================
router.get("/wallet/balance", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const countryCode = req.user!.countryCode;
    
    // Parse filters
    const fromDate = req.query.from ? new Date(req.query.from as string) : undefined;
    const toDate = req.query.to ? new Date(req.query.to as string) : undefined;
    const type = req.query.type as string | undefined;
    
    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Get or create wallet
    const { walletService } = await import("../services/walletService");
    const currency = countryCode === "BD" ? "BDT" : "USD";
    
    const wallet = await walletService.getOrCreateWallet({
      ownerId: driverProfile.id,
      ownerType: "driver",
      countryCode,
      currency,
    });

    // Build where clause for transactions
    const where: any = {
      walletId: wallet.id,
    };

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }

    if (type && type !== "all") {
      // Map type filter to serviceType
      const serviceTypeMap: Record<string, string[]> = {
        trips: ["ride", "food", "parcel"],
        bonuses: ["adjustment"], // Bonuses typically come as adjustments
        adjustments: ["adjustment"],
        payouts: ["payout"],
      };
      
      if (serviceTypeMap[type]) {
        where.serviceType = { in: serviceTypeMap[type] };
      }
    }

    // Get transactions
    const transactions = await prisma.walletTransaction.findMany({
      where,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: 100, // Limit to last 100 transactions
    });

    // Calculate summary
    const summary = transactions.reduce(
      (acc, t) => {
        const amount = serializeDecimal(t.amount);
        
        if (t.direction === "credit") {
          if (t.serviceType === "ride" || t.serviceType === "food" || t.serviceType === "parcel") {
            acc.totalEarnings += amount;
          } else if (t.serviceType === "adjustment") {
            acc.bonuses += amount;
          }
        } else if (t.direction === "debit") {
          if (t.serviceType === "payout") {
            // Don't count payouts in fees
          } else if (t.serviceType === "commission") {
            acc.platformFees += amount;
          } else {
            acc.adjustments += amount;
          }
        }
        
        return acc;
      },
      {
        totalEarnings: 0,
        bonuses: 0,
        adjustments: 0,
        platformFees: 0,
      }
    );

    // Group transactions by date
    const groupedByDate: Record<string, any[]> = {};
    transactions.forEach(t => {
      const date = t.createdAt.toISOString().split('T')[0];
      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }
      groupedByDate[date].push({
        id: t.id,
        type: t.serviceType,
        direction: t.direction,
        amount: serializeDecimal(t.amount),
        description: t.description,
        referenceType: t.referenceType,
        referenceId: t.referenceId,
        createdAt: t.createdAt,
      });
    });

    res.json({
      currentBalance: serializeDecimal(wallet.availableBalance),
      negativeBalance: serializeDecimal(wallet.negativeBalance),
      currency: wallet.currency,
      summary: {
        totalEarnings: summary.totalEarnings,
        bonuses: summary.bonuses,
        adjustments: summary.adjustments,
        platformFees: summary.platformFees,
        netPayout: summary.totalEarnings + summary.bonuses - summary.adjustments - summary.platformFees,
      },
      transactionsByDate: Object.entries(groupedByDate).map(([date, txns]) => ({
        date,
        transactions: txns,
      })),
    });
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    res.status(500).json({ error: "Failed to fetch wallet balance" });
  }
});

// ====================================================
// GET /api/driver/wallet/transaction/:id
// Get single transaction details
// ====================================================
router.get("/wallet/transaction/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const transactionId = req.params.id;
    
    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Get transaction with wallet check
    const transaction = await prisma.walletTransaction.findFirst({
      where: {
        id: transactionId,
        wallet: {
          ownerId: driverProfile.id,
          ownerType: "driver",
        },
      },
      include: {
        wallet: true,
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Get related entity details if available
    let relatedDetails = null;
    if (transaction.referenceId) {
      if (transaction.referenceType === "ride") {
        const ride = await prisma.ride.findUnique({
          where: { id: transaction.referenceId },
          select: {
            id: true,
            pickupAddress: true,
            dropoffAddress: true,
            serviceFare: true,
            safegoCommission: true,
            driverPayout: true,
            completedAt: true,
          },
        });
        relatedDetails = ride;
      } else if (transaction.referenceType === "food_order") {
        const foodOrder = await prisma.foodOrder.findUnique({
          where: { id: transaction.referenceId },
          select: {
            id: true,
            deliveryAddress: true,
            driverPayout: true,
            deliveredAt: true,
          },
        });
        relatedDetails = foodOrder;
      } else if (transaction.referenceType === "delivery") {
        const delivery = await prisma.delivery.findUnique({
          where: { id: transaction.referenceId },
          select: {
            id: true,
            pickupAddress: true,
            dropoffAddress: true,
            driverPayout: true,
            deliveredAt: true,
          },
        });
        relatedDetails = delivery;
      }
    }

    res.json({
      id: transaction.id,
      type: transaction.serviceType,
      direction: transaction.direction,
      amount: serializeDecimal(transaction.amount),
      balanceAfter: serializeDecimal(transaction.balanceSnapshot),
      negativeBalanceAfter: serializeDecimal(transaction.negativeBalanceSnapshot),
      description: transaction.description,
      referenceType: transaction.referenceType,
      referenceId: transaction.referenceId,
      createdAt: transaction.createdAt,
      relatedDetails: relatedDetails ? {
        ...relatedDetails,
        serviceFare: relatedDetails.serviceFare ? serializeDecimal(relatedDetails.serviceFare) : undefined,
        safegoCommission: relatedDetails.safegoCommission ? serializeDecimal(relatedDetails.safegoCommission) : undefined,
        driverPayout: relatedDetails.driverPayout ? serializeDecimal(relatedDetails.driverPayout) : undefined,
      } : null,
    });
  } catch (error) {
    console.error("Error fetching transaction details:", error);
    res.status(500).json({ error: "Failed to fetch transaction details" });
  }
});

// ====================================================
// GET /api/driver/payout-method
// Get driver's default payout method
// ====================================================
router.get("/payout-method", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Get default payout account
    const payoutAccount = await prisma.payoutAccount.findFirst({
      where: {
        ownerId: driverProfile.id,
        ownerType: "driver",
        isDefault: true,
        status: "active",
      },
    });

    if (!payoutAccount) {
      return res.json({
        hasPayoutMethod: false,
        method: null,
      });
    }

    res.json({
      hasPayoutMethod: true,
      method: {
        id: payoutAccount.id,
        type: payoutAccount.payoutType,
        provider: payoutAccount.provider,
        displayName: payoutAccount.displayName,
        maskedAccount: payoutAccount.maskedAccount,
        accountHolderName: payoutAccount.accountHolderName,
      },
    });
  } catch (error) {
    console.error("Error fetching payout method:", error);
    res.status(500).json({ error: "Failed to fetch payout method" });
  }
});

// ====================================================
// GET /api/driver/payout-methods
// List all payout methods for driver
// ====================================================
router.get("/payout-methods", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const countryCode = req.user!.countryCode;

    const { listPayoutMethods } = await import("../services/payoutMethodService");
    const methods = await listPayoutMethods(userId, countryCode);

    res.json({ methods });
  } catch (error: any) {
    console.error("Error listing payout methods:", error);
    res.status(500).json({ error: error.message || "Failed to list payout methods" });
  }
});

// ====================================================
// POST /api/driver/payout-methods
// Create a new payout method with Zod validation
// ====================================================
router.post("/payout-methods", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const countryCode = req.user!.countryCode;

    // Import Zod schema
    const { createPayoutMethodSchema, createPayoutMethod } = await import("../services/payoutMethodService");
    
    // Validate input with Zod
    const validationResult = createPayoutMethodSchema.safeParse({
      userId,
      countryCode,
      ...req.body,
    });

    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    const method = await createPayoutMethod(validationResult.data);

    res.status(201).json(method);
  } catch (error: any) {
    console.error("Error creating payout method:", error);
    res.status(500).json({ error: error.message || "Failed to create payout method" });
  }
});

// ====================================================
// PATCH /api/driver/payout-methods/:id/set-default
// Set a payout method as default
// ====================================================
router.patch("/payout-methods/:id/set-default", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const { setDefaultPayoutMethod } = await import("../services/payoutMethodService");
    await setDefaultPayoutMethod(id, userId);

    res.json({ success: true, message: "Default payout method updated" });
  } catch (error: any) {
    console.error("Error setting default payout method:", error);
    res.status(500).json({ error: error.message || "Failed to set default payout method" });
  }
});

// ====================================================
// DELETE /api/driver/payout-methods/:id
// Delete a payout method
// ====================================================
router.delete("/payout-methods/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const { deletePayoutMethod } = await import("../services/payoutMethodService");
    await deletePayoutMethod(id, userId);

    res.json({ success: true, message: "Payout method deleted" });
  } catch (error: any) {
    console.error("Error deleting payout method:", error);
    res.status(500).json({ error: error.message || "Failed to delete payout method" });
  }
});

// ====================================================
// POST /api/driver/wallet/cash-out
// Request instant payout (manual payout)
// ====================================================
router.post("/wallet/cash-out", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const countryCode = req.user!.countryCode;
    
    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Get wallet
    const { walletService } = await import("../services/walletService");
    const currency = countryCode === "BD" ? "BDT" : "USD";
    
    const wallet = await walletService.getOrCreateWallet({
      ownerId: driverProfile.id,
      ownerType: "driver",
      countryCode,
      currency,
    });

    const availableBalance = serializeDecimal(wallet.availableBalance);
    const negativeBalance = serializeDecimal(wallet.negativeBalance);

    // Check if there's negative balance
    if (negativeBalance > 0) {
      return res.status(400).json({
        error: "Cannot cash out with outstanding commission debt",
        negativeBalance,
      });
    }

    // Check minimum balance
    const minCashout = countryCode === "BD" ? 100 : 5;
    if (availableBalance < minCashout) {
      return res.status(400).json({
        error: `Minimum cash out amount is ${currency} ${minCashout}`,
        currentBalance: availableBalance,
      });
    }

    // Check if driver has a payout method
    const payoutAccount = await prisma.payoutAccount.findFirst({
      where: {
        ownerId: driverProfile.id,
        ownerType: "driver",
        isDefault: true,
        status: "active",
      },
    });

    if (!payoutAccount) {
      return res.status(400).json({
        error: "Please add a payout method before requesting cash out",
      });
    }

    // Create manual payout request using WalletPayoutService
    const { WalletPayoutService } = await import("../services/payoutService");
    const payoutService = new WalletPayoutService();

    const payout = await payoutService.createWalletPayout({
      ownerId: driverProfile.id,
      ownerType: "driver",
      amount: availableBalance,
      method: "manual_request",
    });

    res.json({
      success: true,
      payout: {
        id: payout.id,
        amount: serializeDecimal(payout.amount),
        status: payout.status,
        createdAt: payout.createdAt,
      },
      message: "Cash out request submitted successfully. Funds will be processed within 1-2 business days.",
    });
  } catch (error: any) {
    console.error("Error processing cash out:", error);
    
    // Handle specific errors from payout service
    if (error.message?.includes("Insufficient balance")) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message?.includes("Outstanding commission debt")) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: "Failed to process cash out request" });
  }
});

// ====================================================
// GET /api/driver/tax-summary
// Get year-to-date tax summary (1099-K and 1099-NEC totals)
// ====================================================
router.get("/tax-summary", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Import tax service
    const { taxService } = await import("../services/taxService");

    // Get tax summary
    const summary = await taxService.getTaxSummary(driverProfile.id, year);

    res.json({
      year,
      tripRevenue1099K: summary.tripRevenue1099K,
      nonTripIncome1099NEC: summary.nonTripIncome1099NEC,
      totalEarnings: summary.totalEarnings,
      requires1099K: summary.requires1099K,
      requires1099NEC: summary.requires1099NEC,
      driverInfo: {
        fullLegalName: summary.driverInfo?.usaFullLegalName,
        address: summary.driverInfo?.usaStreet
          ? `${summary.driverInfo.usaStreet}, ${summary.driverInfo.usaCity}, ${summary.driverInfo.usaState} ${summary.driverInfo.usaZipCode}`
          : null,
        ssnLast4: summary.driverInfo?.ssnLast4,
        taxClassification: summary.driverInfo?.taxClassification,
        w9Status: summary.driverInfo?.w9Status,
        taxCertificationAccepted: summary.driverInfo?.taxCertificationAccepted,
      },
    });
  } catch (error) {
    console.error("Tax summary error:", error);
    res.status(500).json({ error: "Failed to get tax summary" });
  }
});

// ====================================================
// GET /api/driver/tax-documents/:type
// Get tax document (1099-K, 1099-NEC, or year-to-date summary)
// type: '1099-K', '1099-NEC', or 'ytd-summary'
// ====================================================
router.get("/tax-documents/:type", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { type } = req.params;
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

    // Validate document type
    if (!["1099-K", "1099-NEC", "ytd-summary"].includes(type)) {
      return res.status(400).json({ error: "Invalid document type" });
    }

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            countryCode: true,
          },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // US drivers only
    if (driverProfile.user.countryCode !== "US") {
      return res.status(403).json({ error: "Tax documents are only available for US drivers" });
    }

    // Import tax service
    const { taxService } = await import("../services/taxService");

    // Get tax summary and transactions
    const summary = await taxService.getTaxSummary(driverProfile.id, year);
    const transactions = await taxService.getYearTransactions(driverProfile.id, year);

    // For now, return JSON data (later can be converted to PDF)
    // This provides all the data needed to generate proper 1099 forms
    res.json({
      documentType: type,
      year,
      generatedAt: new Date(),
      driver: {
        name: summary.driverInfo?.usaFullLegalName || `${driverProfile.firstName || ""} ${driverProfile.lastName || ""}`.trim(),
        address: summary.driverInfo?.usaStreet
          ? `${summary.driverInfo.usaStreet}, ${summary.driverInfo.usaCity}, ${summary.driverInfo.usaState} ${summary.driverInfo.usaZipCode}`
          : null,
        ssnLast4: summary.driverInfo?.ssnLast4,
        taxClassification: summary.driverInfo?.taxClassification,
        email: driverProfile.user.email,
      },
      payer: {
        name: "SafeGo Inc.",
        address: "123 SafeGo Street, New York, NY 10001",
        ein: "XX-XXXXXXX", // Placeholder - should be real EIN
      },
      earnings: {
        tripRevenue1099K: summary.tripRevenue1099K,
        nonTripIncome1099NEC: summary.nonTripIncome1099NEC,
        totalEarnings: summary.totalEarnings,
      },
      transactions:
        type === "ytd-summary"
          ? transactions
          : transactions.filter((tx) => tx.category === type),
      thresholdMet: type === "1099-K" ? summary.requires1099K : type === "1099-NEC" ? summary.requires1099NEC : true,
      notes:
        type === "ytd-summary"
          ? "This is a year-to-date summary of all earnings. Official 1099 forms will be available after year-end."
          : `This document shows ${type} income. You will receive an official ${type} form if you meet IRS reporting requirements.`,
    });
  } catch (error) {
    console.error("Tax document error:", error);
    res.status(500).json({ error: "Failed to generate tax document" });
  }
});

// ====================================================
// Bangladesh Tax Endpoints
// ====================================================

// ====================================================
// GET /api/driver/bd-tax-summary
// Get Bangladesh tax summary for current year and available years
// ====================================================
router.get("/bd-tax-summary", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // BD drivers only
    if (driverProfile.user.countryCode !== "BD") {
      return res.status(403).json({ error: "BD tax summary is only available for Bangladesh drivers" });
    }

    // Import BD tax service
    const { bdTaxService } = await import("../services/bdTaxService");

    // Get current year summary (use userId for wallet lookup)
    const currentYear = new Date().getFullYear();
    const currentYearSummary = await bdTaxService.getBDTaxSummary(userId, currentYear);

    // Get available tax years
    const availableYears = await bdTaxService.getAvailableTaxYears(userId);

    res.json({
      currentYear: currentYearSummary,
      availableYears,
    });
  } catch (error) {
    console.error("BD tax summary error:", error);
    res.status(500).json({ error: "Failed to get BD tax summary" });
  }
});

// ====================================================
// GET /api/driver/bd-tax-documents/:year
// Download Bangladesh tax document for a specific year
// ====================================================
router.get("/bd-tax-documents/:year", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const year = parseInt(req.params.year);

    // Validate year
    if (isNaN(year) || year < 2020 || year > new Date().getFullYear()) {
      return res.status(400).json({ error: "Invalid year" });
    }

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            countryCode: true,
          },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // BD drivers only
    if (driverProfile.user.countryCode !== "BD") {
      return res.status(403).json({ error: "BD tax documents are only available for Bangladesh drivers" });
    }

    // Import BD tax service
    const { bdTaxService } = await import("../services/bdTaxService");

    // Get tax summary for the year (use userId for wallet lookup)
    const summary = await bdTaxService.getBDTaxSummary(userId, year);

    // Return JSON document (can be converted to PDF later)
    res.json({
      documentType: "BD Tax Summary",
      country: "BD",
      year,
      generatedAt: new Date(),
      driver: {
        name: `${driverProfile.firstName || ""} ${driverProfile.lastName || ""}`.trim(),
        email: driverProfile.user.email,
        driverId: driverProfile.id,
      },
      payer: {
        name: "SafeGo Bangladesh",
        company: "SafeGo Inc.",
      },
      earnings: {
        totalTripEarnings: summary.total_trip_earnings,
        safegoCommissionTotal: summary.safego_commission_total,
        driverNetPayout: summary.driver_net_payout,
        anyWithheldTax: summary.any_withheld_tax,
      },
      currency: "BDT",
      notes: [
        "This is an annual income summary provided by SafeGo to assist with your personal tax reporting in Bangladesh.",
        "SafeGo does not file or submit tax returns on your behalf.",
        "For exact tax calculations and filing, please consult a local tax professional or follow NBR (National Board of Revenue) guidelines.",
        "All amounts are in Bangladesh Taka (BDT).",
      ],
      taxInfo: {
        country: "Bangladesh",
        taxpayerType: "Self-employed / Independent Driver",
        nbrDisclaimer: "SafeGo provides annual income summaries to help with your personal tax reporting in Bangladesh. SafeGo does not file or submit tax returns on your behalf. For exact tax calculations and filing, please consult a local tax professional or follow NBR (National Board of Revenue) guidelines.",
      },
      disclaimer: "SafeGo provides this summary for informational purposes only. The driver is responsible for all tax reporting and compliance with Bangladesh tax laws.",
    });
  } catch (error) {
    console.error("BD tax document error:", error);
    res.status(500).json({ error: "Failed to generate BD tax document" });
  }
});

// ====================================================
// PATCH /api/driver/profile/name
// Update driver name
// ====================================================
router.patch("/profile/name", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Validate request body with Zod
    const validationResult = updateNameSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Prepare update data
    const updateData: any = {};

    // For US drivers, use structured name fields
    if ("firstName" in data && "lastName" in data) {
      if (driverProfile.user.countryCode !== "US") {
        return res.status(400).json({ error: "Use fullName for non-US drivers" });
      }
      updateData.firstName = data.firstName.trim();
      updateData.lastName = data.lastName.trim();
      if ((data as any).middleName) updateData.middleName = (data as any).middleName.trim();
      // Also update fullName for consistency
      updateData.fullName = updateData.middleName 
        ? `${updateData.firstName} ${updateData.middleName} ${updateData.lastName}` 
        : `${updateData.firstName} ${updateData.lastName}`;
    } else if ("fullName" in data) {
      if (driverProfile.user.countryCode === "US") {
        return res.status(400).json({ error: "Use firstName and lastName for US drivers" });
      }
      updateData.fullName = data.fullName.trim();
    }

    // Update profile
    const updatedProfile = await prisma.driverProfile.update({
      where: { userId },
      data: updateData,
    });

    res.json({
      message: "Name updated successfully",
      profile: {
        firstName: updatedProfile.firstName,
        middleName: updatedProfile.middleName,
        lastName: updatedProfile.lastName,
        fullName: updatedProfile.fullName,
      },
    });
  } catch (error) {
    console.error("Name update error:", error);
    res.status(500).json({ error: "Failed to update name" });
  }
});

// ====================================================
// PATCH /api/driver/email
// Update driver email
// ====================================================
router.patch("/email", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Validate request body with Zod
    const validationResult = updateEmailSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const { email } = validationResult.data;

    // Check if email is already taken
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser && existingUser.id !== userId) {
      return res.status(400).json({ error: "Email is already in use" });
    }

    // Update user email
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { email },
    });

    res.json({
      message: "Email updated successfully",
      email: updatedUser.email,
    });
  } catch (error) {
    console.error("Email update error:", error);
    res.status(500).json({ error: "Failed to update email" });
  }
});

// ====================================================
// PATCH /api/driver/profile/phone
// Update driver phone number with E.164 format validation
// ====================================================

// E.164 phone validation patterns by country
const PHONE_PATTERNS: Record<string, { pattern: RegExp; example: string; minLength: number; maxLength: number }> = {
  US: { 
    pattern: /^\+1[2-9]\d{9}$/, 
    example: "+1XXXXXXXXXX (10 digits after +1)",
    minLength: 12,
    maxLength: 12
  },
  BD: { 
    pattern: /^\+880[1-9]\d{9}$/, 
    example: "+880XXXXXXXXXX (10 digits after +880)",
    minLength: 14,
    maxLength: 14
  },
};

// General E.164 pattern for unsupported countries
const GENERAL_E164_PATTERN = /^\+[1-9]\d{6,14}$/;

function validatePhoneNumber(phone: string, countryCode?: string): { valid: boolean; error?: string } {
  // Remove any spaces or dashes for validation
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  
  // Must start with +
  if (!cleanPhone.startsWith('+')) {
    return { valid: false, error: "Phone number must start with + and include country code (E.164 format)" };
  }
  
  // Country-specific validation
  if (countryCode && PHONE_PATTERNS[countryCode]) {
    const pattern = PHONE_PATTERNS[countryCode];
    if (!pattern.pattern.test(cleanPhone)) {
      return { 
        valid: false, 
        error: `Invalid phone format for ${countryCode}. Expected: ${pattern.example}` 
      };
    }
    return { valid: true };
  }
  
  // General E.164 validation for other countries
  if (!GENERAL_E164_PATTERN.test(cleanPhone)) {
    return { valid: false, error: "Invalid phone number format. Use E.164 format: +[country code][number]" };
  }
  
  return { valid: true };
}

const updatePhoneSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
});

router.patch("/profile/phone", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Validate request body with Zod
    const validationResult = updatePhoneSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const { phoneNumber } = validationResult.data;
    
    // Get driver profile to check country code for validation
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      select: { usaState: true, district: true },
    });
    
    // Determine country code from profile
    const countryCode = driverProfile?.usaState ? "US" : (driverProfile?.district ? "BD" : undefined);
    
    // Validate phone number format
    const phoneValidation = validatePhoneNumber(phoneNumber, countryCode);
    if (!phoneValidation.valid) {
      return res.status(400).json({ error: phoneValidation.error });
    }
    
    // Store clean phone number (with + prefix)
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');

    // Update driver profile phone number
    const updatedProfile = await prisma.driverProfile.update({
      where: { userId },
      data: { phoneNumber: cleanPhone },
    });

    res.json({
      message: "Phone number updated successfully",
      phoneNumber: updatedProfile.phoneNumber,
    });
  } catch (error) {
    console.error("Phone update error:", error);
    res.status(500).json({ error: "Failed to update phone number" });
  }
});

// ====================================================
// PATCH /api/driver/profile/dob
// Update driver date of birth with age validation
// ====================================================

// Minimum age requirement for drivers
const MINIMUM_DRIVER_AGE = 18;
const MAXIMUM_DRIVER_AGE = 100;

function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

function validateDateOfBirth(dateString: string): { valid: boolean; error?: string; parsedDate?: Date } {
  const parsedDate = new Date(dateString);
  
  // Check if valid date
  if (isNaN(parsedDate.getTime())) {
    return { valid: false, error: "Invalid date format. Please use YYYY-MM-DD format." };
  }
  
  // Check if date is in the future
  if (parsedDate > new Date()) {
    return { valid: false, error: "Date of birth cannot be in the future." };
  }
  
  // Calculate and validate age
  const age = calculateAge(parsedDate);
  
  if (age < MINIMUM_DRIVER_AGE) {
    return { valid: false, error: `You must be at least ${MINIMUM_DRIVER_AGE} years old to drive with SafeGo.` };
  }
  
  if (age > MAXIMUM_DRIVER_AGE) {
    return { valid: false, error: "Please enter a valid date of birth." };
  }
  
  return { valid: true, parsedDate };
}

const updateDobSchema = z.object({
  dateOfBirth: z.string().min(1, "Date of birth is required"),
});

router.patch("/profile/dob", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Validate request body with Zod
    const validationResult = updateDobSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const { dateOfBirth } = validationResult.data;

    // Validate date of birth with age requirements
    const dobValidation = validateDateOfBirth(dateOfBirth);
    if (!dobValidation.valid) {
      return res.status(400).json({ error: dobValidation.error });
    }

    // Update driver profile date of birth
    const updatedProfile = await prisma.driverProfile.update({
      where: { userId },
      data: { dateOfBirth: dobValidation.parsedDate },
    });

    res.json({
      message: "Date of birth updated successfully",
      dateOfBirth: updatedProfile.dateOfBirth,
    });
  } catch (error) {
    console.error("DOB update error:", error);
    res.status(500).json({ error: "Failed to update date of birth" });
  }
});

// ====================================================
// PATCH /api/driver/password
// Change driver password
// ====================================================
router.patch("/password", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Validate request body with Zod
    const validationResult = changePasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const { currentPassword, newPassword } = validationResult.data;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// ====================================================
// DELETE /api/driver/account
// Delete driver account (soft delete)
// ====================================================
router.delete("/account", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Validate request body with Zod
    const validationResult = deleteAccountSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const { password } = validationResult.data;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    // Soft delete: block the account instead of hard delete
    await prisma.user.update({
      where: { id: userId },
      data: { 
        isBlocked: true,
      },
    });

    // Also suspend the driver profile
    await prisma.driverProfile.update({
      where: { userId },
      data: {
        isSuspended: true,
        suspendedAt: new Date(),
        suspensionReason: "Account deletion requested by driver",
      },
    });

    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Account deletion error:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

// ====================================================
// GET /api/driver/preferences
// Get all driver preferences
// ====================================================
router.get("/preferences", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      select: {
        preferredNavigationApp: true,
        autoAcceptRides: true,
        acceptLongTrips: true,
        acceptSharedRides: true,
        shareLocationHistory: true,
        shareUsageAnalytics: true,
        personalizedExperience: true,
        notifyRideRequests: true,
        notifyPromotions: true,
        notifyEarnings: true,
        notifySupport: true,
        notifyEmailWeekly: true,
        notifyEmailTips: true,
        notifySms: true,
        notifyPush: true,
        preferredLanguage: true,
        themePreference: true,
        preferShortTrips: true,
        avoidHighways: true,
        weeklyPayoutDay: true,
        instantPayoutEnabled: true,
        shareTripStatus: true,
        emergencyShortcutEnabled: true,
        regionPreference: true,
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    res.json(driverProfile);
  } catch (error) {
    console.error("Get preferences error:", error);
    res.status(500).json({ error: "Failed to get preferences" });
  }
});

// ====================================================
// PATCH /api/driver/preferences/navigation
// Update navigation app preference
// ====================================================
router.patch("/preferences/navigation", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Validate request body with Zod
    const validationResult = navigationPreferenceSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const { preferredNavigationApp } = validationResult.data;

    const updatedProfile = await prisma.driverProfile.update({
      where: { userId },
      data: { preferredNavigationApp },
    });

    res.json({ message: "Navigation preference updated successfully", preferredNavigationApp: updatedProfile.preferredNavigationApp });
  } catch (error) {
    console.error("Update navigation error:", error);
    res.status(500).json({ error: "Failed to update navigation preference" });
  }
});

// ====================================================
// PATCH /api/driver/preferences/work
// Update work hub preferences
// ====================================================
router.patch("/preferences/work", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Validate request body with Zod
    const validationResult = workPreferencesSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;
    const updateData: any = {};
    if (data.autoAcceptRides !== undefined) updateData.autoAcceptRides = data.autoAcceptRides;
    if (data.acceptLongTrips !== undefined) updateData.acceptLongTrips = data.acceptLongTrips;
    if (data.acceptSharedRides !== undefined) updateData.acceptSharedRides = data.acceptSharedRides;

    const updatedProfile = await prisma.driverProfile.update({
      where: { userId },
      data: updateData,
    });

    res.json({
      message: "Work preferences updated successfully",
      autoAcceptRides: updatedProfile.autoAcceptRides,
      acceptLongTrips: updatedProfile.acceptLongTrips,
      acceptSharedRides: updatedProfile.acceptSharedRides,
    });
  } catch (error) {
    console.error("Update work preferences error:", error);
    res.status(500).json({ error: "Failed to update work preferences" });
  }
});

// ====================================================
// PATCH /api/driver/preferences/privacy
// Update privacy preferences
// ====================================================
router.patch("/preferences/privacy", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Validate request body with Zod
    const validationResult = privacyPreferencesSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;
    const updateData: any = {};
    if (data.shareLocationHistory !== undefined) updateData.shareLocationHistory = data.shareLocationHistory;
    if (data.shareUsageAnalytics !== undefined) updateData.shareUsageAnalytics = data.shareUsageAnalytics;
    if (data.personalizedExperience !== undefined) updateData.personalizedExperience = data.personalizedExperience;

    const updatedProfile = await prisma.driverProfile.update({
      where: { userId },
      data: updateData,
    });

    res.json({
      message: "Privacy preferences updated successfully",
      shareLocationHistory: updatedProfile.shareLocationHistory,
      shareUsageAnalytics: updatedProfile.shareUsageAnalytics,
      personalizedExperience: updatedProfile.personalizedExperience,
    });
  } catch (error) {
    console.error("Update privacy preferences error:", error);
    res.status(500).json({ error: "Failed to update privacy preferences" });
  }
});

// ====================================================
// PATCH /api/driver/preferences/notifications
// Update notification preferences
// ====================================================
router.patch("/preferences/notifications", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Validate request body with Zod
    const validationResult = notificationPreferencesSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;
    const updateData: any = {};
    if (data.notifyRideRequests !== undefined) updateData.notifyRideRequests = data.notifyRideRequests;
    if (data.notifyPromotions !== undefined) updateData.notifyPromotions = data.notifyPromotions;
    if (data.notifyEarnings !== undefined) updateData.notifyEarnings = data.notifyEarnings;
    if (data.notifySupport !== undefined) updateData.notifySupport = data.notifySupport;
    if (data.notifyEmailWeekly !== undefined) updateData.notifyEmailWeekly = data.notifyEmailWeekly;
    if (data.notifyEmailTips !== undefined) updateData.notifyEmailTips = data.notifyEmailTips;

    const updatedProfile = await prisma.driverProfile.update({
      where: { userId },
      data: updateData,
    });

    res.json({
      message: "Notification preferences updated successfully",
      notifyRideRequests: updatedProfile.notifyRideRequests,
      notifyPromotions: updatedProfile.notifyPromotions,
      notifyEarnings: updatedProfile.notifyEarnings,
      notifySupport: updatedProfile.notifySupport,
      notifyEmailWeekly: updatedProfile.notifyEmailWeekly,
      notifyEmailTips: updatedProfile.notifyEmailTips,
    });
  } catch (error) {
    console.error("Update notification preferences error:", error);
    res.status(500).json({ error: "Failed to update notification preferences" });
  }
});

// ====================================================
// PATCH /api/driver/preferences/language
// Update language preference
// ====================================================
router.patch("/preferences/language", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Validate request body with Zod
    const validationResult = languagePreferenceSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const { preferredLanguage } = validationResult.data;

    const updatedProfile = await prisma.driverProfile.update({
      where: { userId },
      data: { preferredLanguage },
    });

    res.json({ message: "Language preference updated successfully", preferredLanguage: updatedProfile.preferredLanguage });
  } catch (error) {
    console.error("Update language error:", error);
    res.status(500).json({ error: "Failed to update language preference" });
  }
});

// ====================================================
// PATCH /api/driver/preferences/theme
// Update theme preference
// ====================================================
router.patch("/preferences/theme", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Validate request body with Zod
    const validationResult = themePreferenceSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const { themePreference } = validationResult.data;

    const updatedProfile = await prisma.driverProfile.update({
      where: { userId },
      data: { themePreference },
    });

    res.json({ message: "Theme preference updated successfully", themePreference: updatedProfile.themePreference });
  } catch (error) {
    console.error("Update theme error:", error);
    res.status(500).json({ error: "Failed to update theme preference" });
  }
});

// ====================================================
// D14: PATCH /api/driver/preferences/trip
// Update trip preferences
// ====================================================
router.patch("/preferences/trip", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const validationResult = tripPreferencesSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const updatedProfile = await prisma.driverProfile.update({
      where: { userId },
      data: validationResult.data,
    });

    res.json({
      message: "Trip preferences updated successfully",
      preferShortTrips: updatedProfile.preferShortTrips,
      avoidHighways: updatedProfile.avoidHighways,
      acceptLongTrips: updatedProfile.acceptLongTrips,
    });
  } catch (error) {
    console.error("Update trip preferences error:", error);
    res.status(500).json({ error: "Failed to update trip preferences" });
  }
});

// ====================================================
// D14: PATCH /api/driver/preferences/earnings
// Update earnings preferences
// ====================================================
router.patch("/preferences/earnings", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const validationResult = earningsPreferencesSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const updatedProfile = await prisma.driverProfile.update({
      where: { userId },
      data: validationResult.data,
    });

    res.json({
      message: "Earnings preferences updated successfully",
      weeklyPayoutDay: updatedProfile.weeklyPayoutDay,
      instantPayoutEnabled: updatedProfile.instantPayoutEnabled,
    });
  } catch (error) {
    console.error("Update earnings preferences error:", error);
    res.status(500).json({ error: "Failed to update earnings preferences" });
  }
});

// ====================================================
// D14: PATCH /api/driver/preferences/safety
// Update safety preferences
// ====================================================
router.patch("/preferences/safety", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const validationResult = safetyPreferencesSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const updatedProfile = await prisma.driverProfile.update({
      where: { userId },
      data: validationResult.data,
    });

    res.json({
      message: "Safety preferences updated successfully",
      shareTripStatus: updatedProfile.shareTripStatus,
      emergencyShortcutEnabled: updatedProfile.emergencyShortcutEnabled,
    });
  } catch (error) {
    console.error("Update safety preferences error:", error);
    res.status(500).json({ error: "Failed to update safety preferences" });
  }
});

// ====================================================
// D14: PATCH /api/driver/preferences/region
// Update region preference
// ====================================================
router.patch("/preferences/region", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const validationResult = regionPreferenceSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const { regionPreference } = validationResult.data;

    const updatedProfile = await prisma.driverProfile.update({
      where: { userId },
      data: { regionPreference },
    });

    res.json({
      message: "Region preference updated successfully",
      regionPreference: updatedProfile.regionPreference,
    });
  } catch (error) {
    console.error("Update region preference error:", error);
    res.status(500).json({ error: "Failed to update region preference" });
  }
});

// ====================================================
// GET /api/driver/preferences/services
// Get driver's current service preferences
// ====================================================
router.get("/preferences/services", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      select: {
        servicePreferences: true,
        servicePreferencesLocked: true,
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Return current preferences or defaults
    const preferences = driverProfile.servicePreferences || defaultServicePreferences;
    const lockedPreferences = driverProfile.servicePreferencesLocked || {};

    res.json({
      preferences,
      lockedPreferences,
    });
  } catch (error) {
    console.error("Get service preferences error:", error);
    res.status(500).json({ error: "Failed to get service preferences" });
  }
});

// ====================================================
// PATCH /api/driver/preferences/services
// Update driver's service preferences (respects admin locks)
// ====================================================
router.patch("/preferences/services", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Validate request body
    const validationResult = servicePreferencesSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    // Get current profile with locked preferences
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      select: {
        servicePreferences: true,
        servicePreferencesLocked: true,
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const currentPrefs = (driverProfile.servicePreferences as any) || defaultServicePreferences;
    const lockedPrefs = (driverProfile.servicePreferencesLocked as any) || {};
    const newPrefs = validationResult.data;

    // Merge new preferences with current, respecting locks
    const mergedPrefs = {
      rideTypes: { ...currentPrefs.rideTypes },
      foodEnabled: currentPrefs.foodEnabled,
      parcelEnabled: currentPrefs.parcelEnabled,
    };

    // Update ride types (check locks)
    if (newPrefs.rideTypes) {
      for (const [key, value] of Object.entries(newPrefs.rideTypes)) {
        if (value !== undefined) {
          // Check if this specific ride type is locked by admin
          const isLocked = lockedPrefs.rideTypes?.[key]?.locked === true;
          if (!isLocked) {
            (mergedPrefs.rideTypes as any)[key] = value;
          }
        }
      }
    }

    // Update food preference (check lock)
    if (newPrefs.foodEnabled !== undefined) {
      if (!lockedPrefs.foodLocked) {
        mergedPrefs.foodEnabled = newPrefs.foodEnabled;
      }
    }

    // Update parcel preference (check lock)
    if (newPrefs.parcelEnabled !== undefined) {
      if (!lockedPrefs.parcelLocked) {
        mergedPrefs.parcelEnabled = newPrefs.parcelEnabled;
      }
    }

    // Check if at least one service is enabled
    const hasRideEnabled = Object.values(mergedPrefs.rideTypes).some(v => v === true);
    const hasAnyService = hasRideEnabled || mergedPrefs.foodEnabled || mergedPrefs.parcelEnabled;

    // Save updated preferences
    const updatedProfile = await prisma.driverProfile.update({
      where: { userId },
      data: {
        servicePreferences: mergedPrefs,
      },
      select: {
        servicePreferences: true,
      },
    });

    res.json({
      message: "Service preferences updated successfully",
      preferences: updatedProfile.servicePreferences,
      warning: !hasAnyService ? "No services enabled. You won't receive any trip requests." : null,
    });
  } catch (error) {
    console.error("Update service preferences error:", error);
    res.status(500).json({ error: "Failed to update service preferences" });
  }
});

// ====================================================
// GET /api/driver/blocked-riders
// Get list of riders blocked by this driver
// ====================================================
router.get("/blocked-riders", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Get all blocked riders
    const blockedRiders = await prisma.blockedRider.findMany({
      where: { driverId: driverProfile.id },
      include: {
        driver: {
          include: {
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
      orderBy: { blockedAt: "desc" },
    });

    // Get customer details for each blocked rider
    const blockedRidersWithDetails = await Promise.all(
      blockedRiders.map(async (blocked) => {
        const customer = await prisma.customerProfile.findUnique({
          where: { id: blocked.customerId },
          include: {
            user: {
              select: {
                email: true,
              },
            },
          },
        });

        return {
          id: blocked.id,
          customerId: blocked.customerId,
          customerEmail: customer?.user.email || "Unknown",
          customerName: customer?.fullName || "Unknown Rider",
          reason: blocked.reason,
          blockedAt: blocked.blockedAt,
        };
      })
    );

    res.json({ blockedRiders: blockedRidersWithDetails });
  } catch (error) {
    console.error("Get blocked riders error:", error);
    res.status(500).json({ error: "Failed to fetch blocked riders" });
  }
});

// ====================================================
// POST /api/driver/blocked-riders
// Block a rider (customer)
// ====================================================
const blockRiderSchema = z.object({
  customerId: z.string().uuid("Invalid customer ID"),
  reason: z.string().max(500).optional(),
});

router.post("/blocked-riders", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Validate request body
    const validation = blockRiderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
    }

    const { customerId, reason } = validation.data;

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Verify customer exists
    const customer = await prisma.customerProfile.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Check if already blocked
    const existingBlock = await prisma.blockedRider.findUnique({
      where: {
        driverId_customerId: {
          driverId: driverProfile.id,
          customerId,
        },
      },
    });

    if (existingBlock) {
      return res.status(400).json({ error: "Rider is already blocked" });
    }

    // Create blocked rider record
    const blockedRider = await prisma.blockedRider.create({
      data: {
        driverId: driverProfile.id,
        customerId,
        reason: reason || null,
      },
    });

    res.status(201).json({
      message: "Rider blocked successfully",
      blockedRider: {
        id: blockedRider.id,
        customerId: blockedRider.customerId,
        reason: blockedRider.reason,
        blockedAt: blockedRider.blockedAt,
      },
    });
  } catch (error) {
    console.error("Block rider error:", error);
    res.status(500).json({ error: "Failed to block rider" });
  }
});

// ====================================================
// DELETE /api/driver/blocked-riders/:id
// Unblock a rider
// ====================================================
router.delete("/blocked-riders/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Verify the blocked rider record exists and belongs to this driver
    const blockedRider = await prisma.blockedRider.findUnique({
      where: { id },
    });

    if (!blockedRider) {
      return res.status(404).json({ error: "Blocked rider not found" });
    }

    if (blockedRider.driverId !== driverProfile.id) {
      return res.status(403).json({ error: "You can only unblock riders you have blocked" });
    }

    // Delete the blocked rider record
    await prisma.blockedRider.delete({
      where: { id },
    });

    res.json({ message: "Rider unblocked successfully" });
  } catch (error) {
    console.error("Unblock rider error:", error);
    res.status(500).json({ error: "Failed to unblock rider" });
  }
});

// ====================================================
// D4: DRIVER EARNINGS & PAYOUT SYSTEM
// ====================================================

// GET /api/driver/earnings-summary
// Get driver's earnings summary (wallet balance, pending payouts, totals)
// ====================================================
router.get("/earnings-summary", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        driverWallet: true,
        user: { select: { countryCode: true } },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Get or initialize wallet
    let wallet = driverProfile.driverWallet;
    if (!wallet) {
      wallet = await prisma.driverWallet.create({
        data: { driverId: driverProfile.id },
      });
    }

    const countryCode = driverProfile.user.countryCode || "US";
    const currency = countryCode === "BD" ? "BDT" : "USD";

    // Calculate date ranges
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Get pending payouts total
    const pendingPayouts = await prisma.payout.aggregate({
      where: {
        ownerId: driverProfile.id,
        ownerType: "driver",
        status: "pending",
      },
      _sum: { amount: true },
    });

    // Calculate all-time earnings from completed trips
    const [allTimeRides, allTimeFood, allTimeParcel] = await Promise.all([
      prisma.ride.aggregate({
        where: { driverId: driverProfile.id, status: "completed" },
        _sum: { driverPayout: true },
      }),
      prisma.foodOrder.aggregate({
        where: { driverId: driverProfile.id, status: "delivered" },
        _sum: { driverPayout: true },
      }),
      prisma.delivery.aggregate({
        where: { driverId: driverProfile.id, status: "delivered" },
        _sum: { driverPayout: true },
      }),
    ]);

    const totalEarnedAllTime =
      Number(allTimeRides._sum.driverPayout || 0) +
      Number(allTimeFood._sum.driverPayout || 0) +
      Number(allTimeParcel._sum.driverPayout || 0);

    // Calculate this week's earnings
    const [weekRides, weekFood, weekParcel] = await Promise.all([
      prisma.ride.aggregate({
        where: {
          driverId: driverProfile.id,
          status: "completed",
          completedAt: { gte: startOfWeek },
        },
        _sum: { driverPayout: true },
      }),
      prisma.foodOrder.aggregate({
        where: {
          driverId: driverProfile.id,
          status: "delivered",
          deliveredAt: { gte: startOfWeek },
        },
        _sum: { driverPayout: true },
      }),
      prisma.delivery.aggregate({
        where: {
          driverId: driverProfile.id,
          status: "delivered",
          deliveredAt: { gte: startOfWeek },
        },
        _sum: { driverPayout: true },
      }),
    ]);

    const thisWeekEarnings =
      Number(weekRides._sum.driverPayout || 0) +
      Number(weekFood._sum.driverPayout || 0) +
      Number(weekParcel._sum.driverPayout || 0);

    // Get trip counts for this week
    const [weekRideCount, weekFoodCount, weekParcelCount] = await Promise.all([
      prisma.ride.count({
        where: {
          driverId: driverProfile.id,
          status: "completed",
          completedAt: { gte: startOfWeek },
        },
      }),
      prisma.foodOrder.count({
        where: {
          driverId: driverProfile.id,
          status: "delivered",
          deliveredAt: { gte: startOfWeek },
        },
      }),
      prisma.delivery.count({
        where: {
          driverId: driverProfile.id,
          status: "delivered",
          deliveredAt: { gte: startOfWeek },
        },
      }),
    ]);

    res.json({
      currency,
      availableBalance: serializeDecimal(wallet.balance),
      negativeBalance: serializeDecimal(wallet.negativeBalance),
      pendingPayouts: Number(pendingPayouts._sum.amount || 0),
      totalEarnedAllTime,
      thisWeekEarnings,
      thisWeekTrips: weekRideCount + weekFoodCount + weekParcelCount,
      breakdown: {
        rides: Number(weekRides._sum.driverPayout || 0),
        food: Number(weekFood._sum.driverPayout || 0),
        parcel: Number(weekParcel._sum.driverPayout || 0),
      },
    });
  } catch (error) {
    console.error("Get earnings summary error:", error);
    res.status(500).json({ error: "Failed to fetch earnings summary" });
  }
});

// ====================================================
// GET /api/driver/earnings
// Get driver's earnings with type filter (rides, food, parcel, all)
// ====================================================
router.get("/earnings", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { type = "all", page = "1", limit = "20" } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: { select: { countryCode: true } } },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const currency = driverProfile.user.countryCode === "BD" ? "BDT" : "USD";

    interface EarningItem {
      id: string;
      type: "ride" | "food" | "parcel";
      date: Date;
      grossAmount: number;
      commission: number;
      netEarning: number;
      paymentMethod: string;
      status: string;
    }

    let earnings: EarningItem[] = [];
    let total = 0;

    if (type === "rides" || type === "all") {
      const rides = await prisma.ride.findMany({
        where: { driverId: driverProfile.id, status: "completed" },
        select: {
          id: true,
          serviceFare: true,
          safegoCommission: true,
          driverPayout: true,
          paymentMethod: true,
          status: true,
          completedAt: true,
          createdAt: true,
        },
        orderBy: { completedAt: "desc" },
        skip: type === "rides" ? skip : undefined,
        take: type === "rides" ? limitNum : undefined,
      });

      earnings.push(
        ...rides.map((r) => ({
          id: r.id,
          type: "ride" as const,
          date: r.completedAt || r.createdAt,
          grossAmount: Number(r.serviceFare),
          commission: Number(r.safegoCommission),
          netEarning: Number(r.driverPayout),
          paymentMethod: r.paymentMethod,
          status: r.status,
        }))
      );

      if (type === "rides") {
        total = await prisma.ride.count({
          where: { driverId: driverProfile.id, status: "completed" },
        });
      }
    }

    if (type === "food" || type === "all") {
      const foodOrders = await prisma.foodOrder.findMany({
        where: { driverId: driverProfile.id, status: "delivered" },
        select: {
          id: true,
          serviceFare: true,
          safegoCommission: true,
          driverPayout: true,
          paymentMethod: true,
          status: true,
          deliveredAt: true,
          createdAt: true,
        },
        orderBy: { deliveredAt: "desc" },
        skip: type === "food" ? skip : undefined,
        take: type === "food" ? limitNum : undefined,
      });

      earnings.push(
        ...foodOrders.map((f) => ({
          id: f.id,
          type: "food" as const,
          date: f.deliveredAt || f.createdAt,
          grossAmount: Number(f.serviceFare),
          commission: Number(f.safegoCommission),
          netEarning: Number(f.driverPayout),
          paymentMethod: f.paymentMethod,
          status: f.status,
        }))
      );

      if (type === "food") {
        total = await prisma.foodOrder.count({
          where: { driverId: driverProfile.id, status: "delivered" },
        });
      }
    }

    if (type === "parcel" || type === "all") {
      const deliveries = await prisma.delivery.findMany({
        where: { driverId: driverProfile.id, status: "delivered" },
        select: {
          id: true,
          serviceFare: true,
          safegoCommission: true,
          driverPayout: true,
          paymentMethod: true,
          status: true,
          deliveredAt: true,
          createdAt: true,
        },
        orderBy: { deliveredAt: "desc" },
        skip: type === "parcel" ? skip : undefined,
        take: type === "parcel" ? limitNum : undefined,
      });

      earnings.push(
        ...deliveries.map((d) => ({
          id: d.id,
          type: "parcel" as const,
          date: d.deliveredAt || d.createdAt,
          grossAmount: Number(d.serviceFare),
          commission: Number(d.safegoCommission),
          netEarning: Number(d.driverPayout),
          paymentMethod: d.paymentMethod,
          status: d.status,
        }))
      );

      if (type === "parcel") {
        total = await prisma.delivery.count({
          where: { driverId: driverProfile.id, status: "delivered" },
        });
      }
    }

    // For "all" type, sort by date and paginate
    if (type === "all") {
      earnings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      total = earnings.length;
      earnings = earnings.slice(skip, skip + limitNum);
    }

    res.json({
      earnings,
      currency,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get earnings error:", error);
    res.status(500).json({ error: "Failed to fetch earnings" });
  }
});

// ====================================================
// GET /api/driver/transactions
// Get driver's wallet transactions
// ====================================================
router.get("/transactions", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { page = "1", limit = "20" } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: { select: { countryCode: true } } },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const currency = driverProfile.user.countryCode === "BD" ? "BDT" : "USD";

    // Get wallet from the new Wallet system
    const wallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: driverProfile.id,
          ownerType: "driver",
        },
      },
    });

    if (!wallet) {
      return res.json({
        transactions: [],
        currency,
        pagination: { page: 1, limit: limitNum, total: 0, totalPages: 0 },
      });
    }

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.walletTransaction.count({
        where: { walletId: wallet.id },
      }),
    ]);

    res.json({
      transactions: transactions.map(serializeTransaction),
      currency,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// ====================================================
// GET /api/driver/payouts
// Get driver's payout history
// ====================================================
router.get("/payouts", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { status, page = "1", limit = "20" } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: { select: { countryCode: true } } },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const currency = driverProfile.user.countryCode === "BD" ? "BDT" : "USD";

    const where: any = {
      ownerId: driverProfile.id,
      ownerType: "driver",
    };

    if (status && ["pending", "processing", "completed", "failed"].includes(status as string)) {
      where.status = status;
    }

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.payout.count({ where }),
    ]);

    res.json({
      payouts: payouts.map(serializePayout),
      currency,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get payouts error:", error);
    res.status(500).json({ error: "Failed to fetch payouts" });
  }
});

// ====================================================
// POST /api/driver/payouts/request
// Request a payout
// ====================================================
const payoutRequestSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  payoutAccountId: z.string().uuid("Invalid payout account ID").optional(),
});

router.post("/payouts/request", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const validation = payoutRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues,
      });
    }

    const { amount, payoutAccountId } = validation.data;

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        driverWallet: true,
        user: { select: { countryCode: true, email: true } },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Check if driver is verified
    if (!driverProfile.isVerified) {
      return res.status(403).json({ error: "Your account must be verified before requesting payouts" });
    }

    const wallet = driverProfile.driverWallet;
    if (!wallet) {
      return res.status(400).json({ error: "Wallet not found. Complete some trips first." });
    }

    const balance = Number(wallet.balance);
    const negativeBalance = Number(wallet.negativeBalance);

    // Cannot request if negative balance exists
    if (negativeBalance > 0) {
      return res.status(400).json({
        error: `Cannot request payout while commission debt exists. Outstanding: $${negativeBalance.toFixed(2)}`,
      });
    }

    // Amount must be <= available balance
    if (amount > balance) {
      return res.status(400).json({
        error: `Insufficient balance. Available: $${balance.toFixed(2)}, Requested: $${amount.toFixed(2)}`,
      });
    }

    // Minimum payout amount
    const countryCode = driverProfile.user.countryCode || "US";
    const minAmount = countryCode === "BD" ? 500 : 10; // BDT 500 or USD 10
    if (amount < minAmount) {
      const currency = countryCode === "BD" ? "BDT" : "USD";
      return res.status(400).json({
        error: `Minimum payout amount is ${currency} ${minAmount}`,
      });
    }

    // Verify payout account if provided
    if (payoutAccountId) {
      const account = await prisma.payoutAccount.findUnique({
        where: { id: payoutAccountId },
      });

      if (!account || account.ownerId !== driverProfile.id) {
        return res.status(400).json({ error: "Payout account not found or access denied" });
      }

      if (account.status !== "active") {
        return res.status(400).json({ error: "Payout account must be verified before use" });
      }
    }

    // Get or create unified wallet for the new system
    let unifiedWallet = await prisma.wallet.findUnique({
      where: {
        ownerId_ownerType: {
          ownerId: driverProfile.id,
          ownerType: "driver",
        },
      },
    });

    if (!unifiedWallet) {
      const currency = countryCode === "BD" ? "BDT" : "USD";
      unifiedWallet = await prisma.wallet.create({
        data: {
          ownerId: driverProfile.id,
          ownerType: "driver",
          countryCode,
          currency,
          availableBalance: balance,
          negativeBalance: negativeBalance,
        },
      });
    }

    // Create payout request in transaction
    const payout = await prisma.$transaction(async (tx) => {
      // Deduct from driver wallet
      await tx.driverWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: amount },
        },
      });

      // Also update unified wallet if exists
      if (unifiedWallet) {
        await tx.wallet.update({
          where: { id: unifiedWallet.id },
          data: {
            availableBalance: { decrement: amount },
          },
        });
      }

      // Create payout record
      const newPayout = await tx.payout.create({
        data: {
          walletId: unifiedWallet!.id,
          ownerId: driverProfile.id,
          ownerType: "driver",
          countryCode,
          amount,
          method: "manual_request",
          status: "pending",
        },
      });

      // Record transaction
      await tx.walletTransaction.create({
        data: {
          walletId: unifiedWallet!.id,
          ownerType: "driver",
          countryCode,
          serviceType: "payout",
          direction: "debit",
          amount,
          balanceSnapshot: balance - amount,
          negativeBalanceSnapshot: negativeBalance,
          referenceType: "payout",
          referenceId: newPayout.id,
          description: `Payout request - ${newPayout.id}`,
        },
      });

      // Create notification
      await tx.notification.create({
        data: {
          id: randomUUID(),
          userId: driverProfile.userId,
          type: "payout",
          title: "Payout Request Submitted",
          body: `Your payout request for $${amount.toFixed(2)} has been submitted and is pending approval.`,
        },
      });

      return newPayout;
    });

    res.status(201).json({
      message: "Payout request submitted successfully",
      payout: serializePayout(payout),
    });
  } catch (error) {
    console.error("Payout request error:", error);
    res.status(500).json({ error: "Failed to submit payout request" });
  }
});

// ====================================================
// D5: DRIVER PROMOTIONS & INCENTIVES (Driver-facing)
// ====================================================

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

// Helper function to get promotion status for driver
function getPromotionStatusForDriver(promo: any, progress: any, selectedDate: Date): {
  status: 'eligible' | 'in_progress' | 'completed' | 'expired';
  rewardSummary: string;
} {
  const now = new Date();
  const promoEnd = new Date(promo.endAt);
  
  // Check if expired
  if (promoEnd < now) {
    return { status: 'expired', rewardSummary: '' };
  }
  
  // Build reward summary
  let rewardSummary = '';
  const reward = parseFloat(promo.rewardPerUnit) || 0;
  
  if (promo.type === 'PER_TRIP_BONUS') {
    rewardSummary = `+$${reward.toFixed(2)} per trip`;
    if (promo.maxRewardPerDriver) {
      const maxTrips = Math.floor(parseFloat(promo.maxRewardPerDriver) / reward);
      rewardSummary += ` (up to ${maxTrips} trips)`;
    }
  } else if (promo.type === 'QUEST_TRIPS') {
    rewardSummary = `Complete ${promo.targetTrips} trips for $${reward.toFixed(2)} bonus`;
  } else if (promo.type === 'EARNINGS_THRESHOLD') {
    const target = parseFloat(promo.targetEarnings) || 0;
    rewardSummary = `Earn $${target.toFixed(2)} to get $${reward.toFixed(2)} bonus`;
  }
  
  // Determine status based on progress
  if (!progress) {
    return { status: 'eligible', rewardSummary };
  }
  
  // Check if quest is completed
  if (promo.type === 'QUEST_TRIPS' && promo.targetTrips && progress.currentTrips >= promo.targetTrips) {
    return { status: 'completed', rewardSummary };
  }
  if (promo.type === 'EARNINGS_THRESHOLD' && promo.targetEarnings && parseFloat(progress.currentEarnings) >= parseFloat(promo.targetEarnings)) {
    return { status: 'completed', rewardSummary };
  }
  
  // Has progress but not completed
  if (progress.currentTrips > 0 || parseFloat(progress.currentEarnings) > 0) {
    return { status: 'in_progress', rewardSummary };
  }
  
  return { status: 'eligible', rewardSummary };
}

// GET /api/driver/promotions/active - Get active promotions for current driver
// Supports optional ?date=YYYY-MM-DD query parameter to filter promotions active on that date
router.get(
  "/promotions/active",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { date } = req.query;

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        include: {
          user: { select: { countryCode: true } },
        },
      });

      if (!driverProfile) {
        return res.status(404).json({ error: "Driver profile not found" });
      }

      const countryCode = driverProfile.user.countryCode || "US";
      
      // Parse and validate date parameter (YYYY-MM-DD format)
      let dayStart: Date;
      let dayEnd: Date;
      
      if (date && typeof date === 'string') {
        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
          return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
        }
        
        // Parse date parts and validate
        const [year, month, day] = date.split('-').map(Number);
        if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
          return res.status(400).json({ error: "Invalid date values" });
        }
        
        // Create UTC date and validate it represents the intended day (catches Feb 31 -> Mar 3, etc.)
        const testDate = new Date(Date.UTC(year, month - 1, day));
        if (testDate.getUTCFullYear() !== year || testDate.getUTCMonth() !== month - 1 || testDate.getUTCDate() !== day) {
          return res.status(400).json({ error: "Invalid calendar date" });
        }
        
        // Create UTC-based dates for timezone-agnostic day boundaries
        dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      } else {
        // Default to today in UTC for consistency
        const now = new Date();
        dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        dayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      }

      // Fetch promotions that overlap with the selected date
      const promotions = await prisma.driverPromotion.findMany({
        where: {
          status: "ACTIVE",
          // Promotion overlaps with the selected day: startAt <= dayEnd AND endAt >= dayStart
          startAt: { lte: dayEnd },
          endAt: { gte: dayStart },
          OR: [
            { countryCode: null },
            { countryCode: countryCode },
          ],
        },
        orderBy: [
          { startAt: 'asc' },
          { createdAt: 'desc' }
        ],
      });

      const filteredPromotions = promotions.filter(promo => {
        if (promo.requireKycApproved && driverProfile.verificationStatus !== "approved") return false;
        return true;
      });

      const result = await Promise.all(
        filteredPromotions.map(async (promo) => {
          const progress = await prisma.driverPromotionProgress.findUnique({
            where: {
              promotionId_driverId: {
                promotionId: promo.id,
                driverId: driverProfile.id,
              },
            },
          });

          const { status, rewardSummary } = getPromotionStatusForDriver(promo, progress, dayStart);

          return {
            ...serializePromotion(promo),
            status,
            rewardSummary,
            progress: progress ? {
              currentTrips: progress.currentTrips,
              currentEarnings: serializeDecimal(progress.currentEarnings),
              totalBonusEarned: serializeDecimal(progress.totalBonusEarned),
              lastUpdatedAt: progress.lastUpdatedAt,
            } : null,
          };
        })
      );

      res.json({ 
        date: dayStart.toISOString().split('T')[0],
        promotions: result 
      });
    } catch (error) {
      console.error("Error fetching active promotions:", error);
      res.status(500).json({ error: "Failed to fetch active promotions" });
    }
  }
);

// GET /api/driver/promotions/completed - Get completed and expired promotions for driver
router.get(
  "/promotions/completed",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        include: {
          user: { select: { countryCode: true } },
        },
      });

      if (!driverProfile) {
        return res.status(404).json({ error: "Driver profile not found" });
      }

      const countryCode = driverProfile.user.countryCode || "US";
      const now = new Date();

      // Get all progress records for this driver with promotion details
      const progressRecords = await prisma.driverPromotionProgress.findMany({
        where: { driverId: driverProfile.id },
        include: {
          promotion: true,
        },
        orderBy: { lastUpdatedAt: "desc" },
      });

      const completed: any[] = [];
      const expired: any[] = [];

      for (const record of progressRecords) {
        const promo = record.promotion;
        const isExpired = new Date(promo.endAt) < now;
        const isCompleted = 
          (promo.type === "QUEST_TRIPS" && promo.targetTrips && record.currentTrips >= promo.targetTrips) ||
          (promo.type === "EARNINGS_THRESHOLD" && promo.targetEarnings && 
           parseFloat(record.currentEarnings.toString()) >= parseFloat(promo.targetEarnings.toString()));

        const promoData = {
          ...serializePromotion(promo),
          progress: {
            currentTrips: record.currentTrips,
            currentEarnings: serializeDecimal(record.currentEarnings),
            totalBonusEarned: serializeDecimal(record.totalBonusEarned),
            lastUpdatedAt: record.lastUpdatedAt,
          },
        };

        if (isCompleted) {
          completed.push(promoData);
        } else if (isExpired) {
          expired.push(promoData);
        }
      }

      res.json({ completed, expired });
    } catch (error) {
      console.error("Error fetching completed promotions:", error);
      res.status(500).json({ error: "Failed to fetch completed promotions" });
    }
  }
);

// GET /api/driver/promotions/stats - Get driver's promotion statistics
router.get(
  "/promotions/stats",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
      });

      if (!driverProfile) {
        return res.status(404).json({ error: "Driver profile not found" });
      }

      const [totalPayouts, currentMonth, activeProgress] = await Promise.all([
        prisma.driverPromotionPayout.aggregate({
          where: { driverId: driverProfile.id },
          _sum: { amount: true },
          _count: true,
        }),

        prisma.driverPromotionPayout.aggregate({
          where: {
            driverId: driverProfile.id,
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
          _sum: { amount: true },
          _count: true,
        }),

        prisma.driverPromotionProgress.findMany({
          where: {
            driverId: driverProfile.id,
            promotion: {
              status: "ACTIVE",
              endAt: { gte: new Date() },
            },
          },
          include: {
            promotion: true,
          },
        }),
      ]);

      res.json({
        totalBonusEarned: serializeDecimal(totalPayouts._sum.amount),
        totalBonusCount: totalPayouts._count,
        monthlyBonusEarned: serializeDecimal(currentMonth._sum.amount),
        monthlyBonusCount: currentMonth._count,
        activePromotions: activeProgress.length,
        inProgressQuests: activeProgress.filter((p: any) =>
          p.promotion.type === "QUEST_TRIPS" &&
          p.currentTrips < (p.promotion.targetTrips || 0)
        ).length,
      });
    } catch (error) {
      console.error("Error fetching promotion stats:", error);
      res.status(500).json({ error: "Failed to fetch promotion stats" });
    }
  }
);

// GET /api/driver/promotions/history - Get driver's promotion payout history
router.get(
  "/promotions/history",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { page = "1", limit = "20" } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 100);

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
      });

      if (!driverProfile) {
        return res.status(404).json({ error: "Driver profile not found" });
      }

      const [payouts, total] = await Promise.all([
        prisma.driverPromotionPayout.findMany({
          where: { driverId: driverProfile.id },
          include: {
            promotion: {
              select: {
                id: true,
                name: true,
                type: true,
                serviceType: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
        prisma.driverPromotionPayout.count({
          where: { driverId: driverProfile.id },
        }),
      ]);

      res.json({
        payouts: payouts.map((p: any) => ({
          id: p.id,
          promotionId: p.promotionId,
          promotionName: p.promotion.name,
          promotionType: p.promotion.type,
          serviceType: p.promotion.serviceType,
          amount: serializeDecimal(p.amount),
          tripType: p.tripType,
          tripId: p.tripId,
          createdAt: p.createdAt,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error("Error fetching promotion history:", error);
      res.status(500).json({ error: "Failed to fetch promotion history" });
    }
  }
);

// GET /api/driver/promotions/calendar - Get dates with active promotions for calendar indicators (D7)
router.get(
  "/promotions/calendar",
  authenticateToken,
  requireRole(["driver"]),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { startDate, endDate } = req.query;

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        include: {
          user: { select: { countryCode: true } },
        },
      });

      if (!driverProfile) {
        return res.status(404).json({ error: "Driver profile not found" });
      }

      const countryCode = driverProfile.user.countryCode || "US";
      
      // Parse date range from query or default to 14 days around today
      const rangeStart = startDate 
        ? new Date(startDate as string)
        : new Date(new Date().setDate(new Date().getDate() - 3));
      const rangeEnd = endDate 
        ? new Date(endDate as string)
        : new Date(new Date().setDate(new Date().getDate() + 11));
      
      // Set to start/end of day for proper comparison
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd.setHours(23, 59, 59, 999);

      // Get all active promotions that overlap with the date range
      const promotions = await prisma.driverPromotion.findMany({
        where: {
          status: "ACTIVE",
          // Promotion overlaps with range: promotion.startAt <= rangeEnd AND promotion.endAt >= rangeStart
          startAt: { lte: rangeEnd },
          endAt: { gte: rangeStart },
          OR: [
            { countryCode: null },
            { countryCode: countryCode },
          ],
        },
        select: {
          id: true,
          startAt: true,
          endAt: true,
          type: true,
        },
      });

      // Filter by KYC if required
      const filteredPromotions = promotions.filter(promo => {
        // Note: For calendar view, we show all eligible promotions
        // KYC check is handled at the actual promotion display level
        return true;
      });

      // Build a map of dates that have at least one promotion
      const datesWithPromotions: Record<string, { count: number; types: string[] }> = {};
      
      for (const promo of filteredPromotions) {
        const promoStart = new Date(promo.startAt);
        const promoEnd = new Date(promo.endAt);
        
        // Clamp to our range
        const effectiveStart = promoStart < rangeStart ? rangeStart : promoStart;
        const effectiveEnd = promoEnd > rangeEnd ? rangeEnd : promoEnd;
        
        // Iterate through each day in the promotion's effective range
        const currentDate = new Date(effectiveStart);
        while (currentDate <= effectiveEnd) {
          const dateKey = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
          
          if (!datesWithPromotions[dateKey]) {
            datesWithPromotions[dateKey] = { count: 0, types: [] };
          }
          datesWithPromotions[dateKey].count++;
          if (!datesWithPromotions[dateKey].types.includes(promo.type)) {
            datesWithPromotions[dateKey].types.push(promo.type);
          }
          
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      res.json({
        calendar: datesWithPromotions,
        range: {
          startDate: rangeStart.toISOString().split('T')[0],
          endDate: rangeEnd.toISOString().split('T')[0],
        },
      });
    } catch (error) {
      console.error("Error fetching promotion calendar:", error);
      res.status(500).json({ error: "Failed to fetch promotion calendar" });
    }
  }
);

export default router;
