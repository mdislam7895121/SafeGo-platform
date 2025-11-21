import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { randomUUID } from "crypto";
import { encrypt, decrypt, isValidBdNid, isValidBdPhone } from "../utils/encryption";
import {
  uploadProfilePhoto,
  uploadLicenseImage,
  uploadVehicleDocument,
  getFileUrl,
} from "../middleware/upload";

const router = Router();
const prisma = new PrismaClient();

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
        // NID for encrypted check
        nidEncrypted: driverProfile.nidEncrypted,
      },
      vehicle: vehicle ? {
        id: vehicle.id,
        vehicleType: vehicle.vehicleType,
        vehicleModel: vehicle.vehicleModel,
        vehiclePlate: vehicle.vehiclePlate,
        isOnline: vehicle.isOnline,
        totalEarnings: vehicle.totalEarnings,
      } : null,
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

    // Validate document type
    if (!["registration", "insurance"].includes(documentType)) {
      return res.status(400).json({
        error: "Invalid document type. Must be 'registration' or 'insurance'",
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

export default router;
