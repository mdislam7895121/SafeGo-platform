import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// All routes require authentication and customer role
router.use(authenticateToken);
router.use(requireRole(["customer"]));

// ====================================================
// GET /api/customer/profile
// Get customer profile
// ====================================================
router.get("/profile", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
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

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    res.json({
      id: customerProfile.id,
      userId: customerProfile.userId,
      email: customerProfile.user.email,
      countryCode: customerProfile.user.countryCode,
      verificationStatus: customerProfile.verificationStatus,
      isVerified: customerProfile.isVerified,
      rejectionReason: customerProfile.rejectionReason,
      dateOfBirth: customerProfile.dateOfBirth,
      emergencyContactName: customerProfile.emergencyContactName,
      emergencyContactPhone: customerProfile.emergencyContactPhone,
      // Bangladesh fields
      fatherName: customerProfile.fatherName,
      presentAddress: customerProfile.presentAddress,
      permanentAddress: customerProfile.permanentAddress,
      nidNumber: customerProfile.nidNumber,
      nidFrontImageUrl: customerProfile.nidFrontImageUrl,
      nidBackImageUrl: customerProfile.nidBackImageUrl,
      // US fields
      homeAddress: customerProfile.homeAddress,
      governmentIdType: customerProfile.governmentIdType,
      governmentIdLast4: customerProfile.governmentIdLast4,
      createdAt: customerProfile.createdAt,
      updatedAt: customerProfile.updatedAt,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

// ====================================================
// PATCH /api/customer/profile
// Update customer profile (KYC data)
// ====================================================
router.patch("/profile", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const profileData = req.body;

    // Get customer profile
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Prepare update data based on country
    const updateData: any = {};
    
    // Common fields
    if (profileData.fullName) updateData.fullName = profileData.fullName;
    if (profileData.phoneNumber) updateData.phoneNumber = profileData.phoneNumber;
    if (profileData.dateOfBirth) updateData.dateOfBirth = new Date(profileData.dateOfBirth);
    if (profileData.emergencyContactName) updateData.emergencyContactName = profileData.emergencyContactName;
    if (profileData.emergencyContactPhone) updateData.emergencyContactPhone = profileData.emergencyContactPhone;

    // Bangladesh-specific fields
    if (customerProfile.user.countryCode === "BD") {
      if (profileData.fatherName) updateData.fatherName = profileData.fatherName;
      if (profileData.presentAddress) updateData.presentAddress = profileData.presentAddress;
      if (profileData.permanentAddress) updateData.permanentAddress = profileData.permanentAddress;
      if (profileData.district) updateData.district = profileData.district;
      if (profileData.thana) updateData.thana = profileData.thana;
      if (profileData.postOffice) updateData.postOffice = profileData.postOffice;
      if (profileData.postalCode) updateData.postalCode = profileData.postalCode;
      if (profileData.village) updateData.village = profileData.village;
      if (profileData.nidNumber) updateData.nidNumber = profileData.nidNumber;
      if (profileData.nidFrontImageUrl) updateData.nidFrontImageUrl = profileData.nidFrontImageUrl;
      if (profileData.nidBackImageUrl) updateData.nidBackImageUrl = profileData.nidBackImageUrl;
    }

    // US-specific fields
    if (customerProfile.user.countryCode === "US") {
      if (profileData.homeAddress) updateData.homeAddress = profileData.homeAddress;
      if (profileData.governmentIdType) updateData.governmentIdType = profileData.governmentIdType;
      if (profileData.governmentIdLast4) updateData.governmentIdLast4 = profileData.governmentIdLast4;
    }

    // Update profile
    const updatedProfile = await prisma.customerProfile.update({
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
// GET /api/customer/rides
// Get customer's ride history
// ====================================================
router.get("/rides", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get customer profile
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Get all rides for this customer
    const rides = await prisma.ride.findMany({
      where: {
        customerId: customerProfile.id,
      },
      include: {
        driver: {
          include: {
            user: {
              select: {
                email: true,
              },
            },
            vehicle: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc", // Most recent first
      },
    });

    res.json({
      rides: rides.map(ride => ({
        id: ride.id,
        pickupAddress: ride.pickupAddress,
        dropoffAddress: ride.dropoffAddress,
        serviceFare: ride.serviceFare,
        driverPayout: ride.driverPayout,
        paymentMethod: ride.paymentMethod,
        status: ride.status,
        driver: ride.driver ? {
          email: ride.driver.user.email,
          vehicle: ride.driver.vehicle ? {
            vehicleType: ride.driver.vehicle.vehicleType,
            vehicleModel: ride.driver.vehicle.vehicleModel,
            vehiclePlate: ride.driver.vehicle.vehiclePlate,
          } : null,
        } : null,
        customerRating: ride.customerRating,
        driverRating: ride.driverRating,
        createdAt: ride.createdAt,
        completedAt: ride.completedAt,
      })),
    });
  } catch (error) {
    console.error("Get customer rides error:", error);
    res.status(500).json({ error: "Failed to fetch ride history" });
  }
});

// ====================================================
// GET /api/customer/home
// Get customer dashboard data
// ====================================================
router.get("/home", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get customer profile
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            countryCode: true,
            isBlocked: true,
          },
        },
      },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    res.json({
      profile: {
        id: customerProfile.id,
        email: customerProfile.user.email,
        countryCode: customerProfile.user.countryCode,
        verificationStatus: customerProfile.verificationStatus,
        isVerified: customerProfile.isVerified,
        rejectionReason: customerProfile.rejectionReason,
      },
    });
  } catch (error) {
    console.error("Customer home error:", error);
    res.status(500).json({ error: "Failed to fetch customer data" });
  }
});

// ====================================================
// GET /api/customer/wallet
// Get customer wallet balance and recent transactions
// ====================================================
router.get("/wallet", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get customer profile
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Get all transactions from rides, food orders, and deliveries
    const rides = await prisma.ride.findMany({
      where: { customerId: customerProfile.id, status: "completed" },
      select: {
        id: true,
        serviceFare: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { completedAt: "desc" },
      take: 50,
    });

    const foodOrders = await prisma.foodOrder.findMany({
      where: { customerId: customerProfile.id, status: "delivered" },
      select: {
        id: true,
        serviceFare: true,
        createdAt: true,
        deliveredAt: true,
      },
      orderBy: { deliveredAt: "desc" },
      take: 50,
    });

    const deliveries = await prisma.delivery.findMany({
      where: { customerId: customerProfile.id, status: "delivered" },
      select: {
        id: true,
        serviceFare: true,
        createdAt: true,
        deliveredAt: true,
      },
      orderBy: { deliveredAt: "desc" },
      take: 50,
    });

    // Combine and format transactions
    const transactions = [
      ...rides.map(ride => ({
        id: ride.id,
        type: "ride",
        description: "Ride payment",
        amount: -parseFloat(ride.serviceFare), // Negative for debit
        createdAt: ride.completedAt || ride.createdAt,
        referenceId: ride.id,
      })),
      ...foodOrders.map(order => ({
        id: order.id,
        type: "food",
        description: "Food order payment",
        amount: -parseFloat(order.serviceFare), // Negative for debit
        createdAt: order.deliveredAt || order.createdAt,
        referenceId: order.id,
      })),
      ...deliveries.map(delivery => ({
        id: delivery.id,
        type: "parcel",
        description: "Parcel delivery payment",
        amount: -parseFloat(delivery.serviceFare), // Negative for debit
        createdAt: delivery.deliveredAt || delivery.createdAt,
        referenceId: delivery.id,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Calculate total spent
    const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);

    res.json({
      wallet: {
        balance: Math.abs(totalSpent).toFixed(2), // Total spent as positive string for display
      },
      transactions: transactions.slice(0, 20).map(t => ({
        ...t,
        amount: t.amount.toFixed(2), // Format amount for display
      })),
    });
  } catch (error) {
    console.error("Get wallet error:", error);
    res.status(500).json({ error: "Failed to fetch wallet data" });
  }
});

// ====================================================
// GET /api/customer/notifications
// Get customer notifications
// ====================================================
router.get("/notifications", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get notifications for this user
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json({
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

export default router;
