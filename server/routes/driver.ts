import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { randomUUID } from "crypto";
import { encrypt, decrypt, isValidBdNid, isValidBdPhone, maskNID, maskSSN } from "../utils/encryption";
import {
  uploadProfilePhoto,
  uploadLicenseImage,
  uploadVehicleDocument,
  getFileUrl,
} from "../middleware/upload";
import { getVehicleDocumentsPayload } from "../services/documentStatusService";

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

// All routes require authentication and driver role
router.use(authenticateToken);
router.use(requireRole(["driver"]));

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

    // Get vehicle
    const vehicle = await prisma.vehicle.findUnique({
      where: { driverId: driverProfile.id },
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
        vehicle: true,
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
      include: { vehicle: true },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    // Check if vehicle already exists
    if (driverProfile.vehicle) {
      return res.status(400).json({ error: "Vehicle already registered. Use PATCH to update." });
    }

    // Create vehicle
    const vehicle = await prisma.vehicle.create({
      data: {
        id: randomUUID(),
        driverId: driverProfile.id,
        vehicleType,
        vehicleModel,
        vehiclePlate,
        updatedAt: new Date(),
      },
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

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { vehicle: true },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    if (!driverProfile.vehicle) {
      return res.status(404).json({ error: "No vehicle registered. Use POST to register." });
    }

    // Update vehicle
    const updateData: any = {};
    if (vehicleType) updateData.vehicleType = vehicleType;
    if (vehicleModel) updateData.vehicleModel = vehicleModel;
    if (vehiclePlate) updateData.vehiclePlate = vehiclePlate;

    const updatedVehicle = await prisma.vehicle.update({
      where: { id: driverProfile.vehicle.id },
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
      if (profileData.governmentIdType) updateData.governmentIdType = profileData.governmentIdType;
      if (profileData.governmentIdLast4) updateData.governmentIdLast4 = profileData.governmentIdLast4;
      if (profileData.driverLicenseNumber) updateData.driverLicenseNumber = profileData.driverLicenseNumber;
      if (profileData.driverLicenseImageUrl) updateData.driverLicenseImageUrl = profileData.driverLicenseImageUrl;
      if (profileData.driverLicenseExpiry) updateData.driverLicenseExpiry = new Date(profileData.driverLicenseExpiry);
      if (profileData.ssnLast4) updateData.ssnLast4 = profileData.ssnLast4;
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

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { vehicle: true },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    if (!driverProfile.vehicle) {
      return res.status(400).json({ error: "Vehicle not registered. Please complete vehicle registration first." });
    }

    // Check if driver is verified
    if (!driverProfile.isVerified) {
      return res.status(403).json({ error: "Driver must be verified before going online" });
    }

    // Update vehicle online status
    const updatedVehicle = await prisma.vehicle.update({
      where: { id: driverProfile.vehicle.id },
      data: { isOnline },
    });

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
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileUrl = getFileUrl(req.file.filename);

    // Update driver profile with photo URL
    const updatedProfile = await prisma.driverProfile.update({
      where: { userId },
      data: { profilePhotoUrl: fileUrl },
    });

    res.json({
      message: "Profile photo uploaded successfully",
      profilePhotoUrl: fileUrl,
    });
  } catch (error) {
    console.error("Profile photo upload error:", error);
    res.status(500).json({ error: "Failed to upload profile photo" });
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

    // Get or create driver points using transaction for safety
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

    // If driver has no points record, create one with lowest tier atomically
    if (!driverPoints) {
      try {
        driverPoints = await prisma.$transaction(async (tx) => {
          // Get lowest tier (by required points) as fallback
          const lowestTier = await tx.driverTier.findFirst({
            where: { isActive: true },
            orderBy: { requiredPoints: "asc" },
            include: {
              benefits: {
                where: { isActive: true },
                orderBy: { displayOrder: "asc" },
              },
            },
          });

          if (!lowestTier) {
            throw new Error("No active tiers found. Please contact support.");
          }

          // Create driver points record
          const newDriverPoints = await tx.driverPoints.create({
            data: {
              driverId: driverProfile.id,
              currentTierId: lowestTier.id,
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

          // Create initial transaction record
          await tx.pointsTransaction.create({
            data: {
              driverPointsId: newDriverPoints.id,
              points: 0,
              reason: "Account initialized",
              referenceType: "system",
            },
          });

          return newDriverPoints;
        });
      } catch (error: any) {
        console.error("Error initializing driver points:", error);
        if (error.message?.includes("No active tiers")) {
          return res.status(503).json({ 
            error: "Loyalty program is currently unavailable. Please try again later." 
          });
        }
        // Handle unique constraint violation (race condition)
        if (error.code === "P2002") {
          // Retry fetching - another request created it
          driverPoints = await prisma.driverPoints.findUnique({
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
          if (!driverPoints) {
            return res.status(500).json({ error: "Failed to initialize points system" });
          }
        } else {
          return res.status(500).json({ error: "Failed to initialize points system" });
        }
      }
    }

    // Get all active tiers ordered by required points
    const allTiers = await prisma.driverTier.findMany({
      where: { isActive: true },
      orderBy: { requiredPoints: "asc" },
    });

    // Calculate next tier and progress
    const currentTierIndex = allTiers.findIndex(t => t.id === driverPoints.currentTierId);
    const nextTier = currentTierIndex < allTiers.length - 1 ? allTiers[currentTierIndex + 1] : null;
    
    let progressPercentage = 100;
    let pointsToNextTier = 0;
    
    if (nextTier) {
      const currentTierPoints = allTiers[currentTierIndex].requiredPoints;
      const nextTierPoints = nextTier.requiredPoints;
      const pointsInCurrentTier = driverPoints.totalPoints - currentTierPoints;
      const pointsNeededForNextTier = nextTierPoints - currentTierPoints;
      progressPercentage = Math.min(100, Math.round((pointsInCurrentTier / pointsNeededForNextTier) * 100));
      pointsToNextTier = Math.max(0, nextTierPoints - driverPoints.totalPoints);
    }

    res.json({
      currentTier: {
        id: driverPoints.tier.id,
        name: driverPoints.tier.name,
        color: driverPoints.tier.color,
        description: driverPoints.tier.description,
        requiredPoints: driverPoints.tier.requiredPoints,
        benefits: driverPoints.tier.benefits.map(b => ({
          id: b.id,
          text: b.benefitText,
        })),
      },
      totalPoints: driverPoints.totalPoints,
      lifetimePoints: driverPoints.lifetimePoints,
      lastEarnedAt: driverPoints.lastEarnedAt,
      nextTier: nextTier ? {
        name: nextTier.name,
        requiredPoints: nextTier.requiredPoints,
        color: nextTier.color,
      } : null,
      progressPercentage,
      pointsToNextTier,
      allTiers: allTiers.map(t => ({
        name: t.name,
        requiredPoints: t.requiredPoints,
        color: t.color,
        isCurrentTier: t.id === driverPoints.currentTierId,
        isUnlocked: driverPoints.totalPoints >= t.requiredPoints,
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

export default router;
