import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";

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

    // Get driver profile
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            countryCode: true,
            isBlocked: true,
          },
        },
        vehicle: true,
        stats: true,
        driverWallet: true,
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    res.json({
      profile: {
        id: driverProfile.id,
        email: driverProfile.user.email,
        countryCode: driverProfile.user.countryCode,
        verificationStatus: driverProfile.verificationStatus,
        isVerified: driverProfile.isVerified,
        rejectionReason: driverProfile.rejectionReason,
      },
      vehicle: driverProfile.vehicle ? {
        id: driverProfile.vehicle.id,
        vehicleType: driverProfile.vehicle.vehicleType,
        vehicleModel: driverProfile.vehicle.vehicleModel,
        vehiclePlate: driverProfile.vehicle.vehiclePlate,
        isOnline: driverProfile.vehicle.isOnline,
        totalEarnings: driverProfile.vehicle.totalEarnings,
      } : null,
      stats: driverProfile.stats ? {
        rating: driverProfile.stats.rating,
        totalTrips: driverProfile.stats.totalTrips,
      } : null,
      wallet: driverProfile.driverWallet ? {
        balance: driverProfile.driverWallet.balance,
        negativeBalance: driverProfile.driverWallet.negativeBalance,
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
      include: { vehicle: true },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    if (!driverProfile.isVerified) {
      return res.status(403).json({ error: "Driver must be verified to view available rides" });
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
          user: {
            countryCode: driverCountryCode, // Same country as driver
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
        driverId: driverProfile.id,
        vehicleType,
        vehicleModel,
        vehiclePlate,
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

export default router;
