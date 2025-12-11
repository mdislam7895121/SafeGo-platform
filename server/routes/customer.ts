import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { validatePromotionForOrder, validateCouponCode } from "../promotions/validationUtils";
import { encrypt } from "../utils/encryption";

const router = Router();

// All routes require authentication and customer role
router.use(authenticateToken);
router.use(requireRole(["customer"]));

// ====================================================
// GET /api/customer/kyc-status
// Get customer KYC verification status for booking enforcement
// ====================================================
router.get("/kyc-status", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, countryCode: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    // If no profile exists, treat as unsubmitted
    if (!customerProfile) {
      return res.json({
        isVerified: false,
        verificationStatus: "unsubmitted",
        countryCode: user.countryCode,
        missingFields: user.countryCode === "BD" 
          ? ["nidNumber", "nidFrontImageUrl", "nidBackImageUrl", "dateOfBirth"]
          : ["governmentIdType", "governmentIdLast4", "homeAddress", "dateOfBirth"],
        requiresKycBeforeBooking: true,
        reason: "Please complete your profile verification to book rides and services.",
      });
    }

    // Determine missing fields based on country
    const missingFields: string[] = [];
    
    if (user.countryCode === "BD") {
      if (!customerProfile.nidNumber) missingFields.push("nidNumber");
      if (!customerProfile.nidFrontImageUrl) missingFields.push("nidFrontImageUrl");
      if (!customerProfile.nidBackImageUrl) missingFields.push("nidBackImageUrl");
      if (!customerProfile.dateOfBirth) missingFields.push("dateOfBirth");
    } else {
      // US
      if (!customerProfile.governmentIdType) missingFields.push("governmentIdType");
      if (!customerProfile.governmentIdLast4) missingFields.push("governmentIdLast4");
      if (!customerProfile.homeAddress) missingFields.push("homeAddress");
      if (!customerProfile.dateOfBirth) missingFields.push("dateOfBirth");
    }

    // Normalize verification status
    const verificationStatus = customerProfile.verificationStatus || "unsubmitted";
    const isVerified = customerProfile.isVerified === true && verificationStatus === "approved";

    // Determine if KYC is required before booking
    // BD: Strict KYC required
    // US: KYC required if not approved
    const requiresKycBeforeBooking = !isVerified;

    // Generate human-readable reason
    let reason = "";
    if (isVerified) {
      reason = "Your account is verified. You can book rides and services.";
    } else if (verificationStatus === "pending") {
      reason = "Your verification is pending review. Please wait for approval.";
    } else if (verificationStatus === "rejected") {
      reason = customerProfile.rejectionReason || "Your verification was rejected. Please resubmit your documents.";
    } else {
      reason = "Please complete your profile verification to book rides and services.";
    }

    res.json({
      isVerified,
      verificationStatus,
      countryCode: user.countryCode,
      missingFields,
      requiresKycBeforeBooking,
      reason,
    });
  } catch (error) {
    console.error("Get KYC status error:", error);
    res.status(500).json({ error: "Failed to get KYC status" });
  }
});

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
            vehicles: {
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc", // Most recent first
      },
    });

    res.json({
      rides: rides.map(ride => {
        const vehicle = ride.driver?.vehicles?.[0];
        return {
          id: ride.id,
          pickupAddress: ride.pickupAddress,
          dropoffAddress: ride.dropoffAddress,
          serviceFare: ride.serviceFare,
          paymentMethod: ride.paymentMethod,
          status: ride.status,
          driver: ride.driver ? {
            email: ride.driver.user.email,
            vehicle: vehicle ? {
              vehicleType: vehicle.vehicleType,
              vehicleModel: vehicle.vehicleModel,
              vehiclePlate: vehicle.vehiclePlate,
            } : null,
          } : null,
          customerRating: ride.customerRating,
          driverRating: ride.driverRating,
          createdAt: ride.createdAt,
          completedAt: ride.completedAt,
        };
      }),
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
        fullName: customerProfile.fullName,
        firstName: customerProfile.firstName,
        lastName: customerProfile.lastName,
        profilePhotoUrl: customerProfile.profilePhotoUrl,
        profilePhotoThumbnail: customerProfile.profilePhotoThumbnail,
        avatarUrl: customerProfile.avatarUrl,
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
        amount: -parseFloat(String(ride.serviceFare)), // Negative for debit
        createdAt: ride.completedAt || ride.createdAt,
        referenceId: ride.id,
      })),
      ...foodOrders.map(order => ({
        id: order.id,
        type: "food",
        description: "Food order payment",
        amount: -parseFloat(String(order.serviceFare)), // Negative for debit
        createdAt: order.deliveredAt || order.createdAt,
        referenceId: order.id,
      })),
      ...deliveries.map(delivery => ({
        id: delivery.id,
        type: "parcel",
        description: "Parcel delivery payment",
        amount: -parseFloat(String(delivery.serviceFare)), // Negative for debit
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
// GET /api/customer/wallet/balance
// Get customer wallet balance only (lightweight)
// Note: Customer wallet balance is currently calculated from order history
// For a production system, consider adding a dedicated CustomerWallet table
// ====================================================
router.get("/wallet/balance", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get customer profile
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // In this implementation, wallet balance starts at 0
    // Users would need to add funds through a payment integration
    // For demo purposes, we return 0 which means wallet payments are not available
    // until a proper wallet funding system is implemented
    const walletBalance = 0;

    res.json({
      balance: walletBalance,
      currency: "USD",
      isDemo: true, // Mark as demo until wallet funding is implemented
    });
  } catch (error) {
    console.error("Get wallet balance error:", error);
    res.status(500).json({ error: "Failed to fetch wallet balance" });
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

// ====================================================
// POST /api/customer/promotions/validate
// Validate a promotion or coupon for a specific order
// ====================================================
router.post("/promotions/validate", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Input validation
    const schema = z.object({
      couponCode: z.string().optional(),
      promotionId: z.string().uuid().optional(),
      restaurantId: z.string().uuid(),
      subtotal: z.number().positive(),
      itemIds: z.array(z.string().uuid()).optional(),
    }).refine(data => data.couponCode || data.promotionId, {
      message: "Either couponCode or promotionId must be provided",
    });

    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: validationResult.error.errors,
      });
    }

    const { couponCode, promotionId, restaurantId, subtotal, itemIds } = validationResult.data;

    let discountAmount = 0;
    let validationError: string | undefined;
    let appliedPromotionId: string | undefined;
    let appliedCouponCode: string | undefined;

    // Validate coupon if provided
    if (couponCode) {
      const couponResult = await validateCouponCode(
        couponCode,
        userId,
        new Prisma.Decimal(subtotal),
        restaurantId
      );

      if (couponResult.isValid) {
        discountAmount = Number(couponResult.discountAmount || 0);
        appliedCouponCode = couponCode;
      } else {
        validationError = couponResult.error;
      }
    }
    // Validate promotion if provided
    else if (promotionId) {
      const promotionResult = await validatePromotionForOrder(
        promotionId,
        userId,
        new Prisma.Decimal(subtotal),
        restaurantId,
        itemIds
      );

      if (promotionResult.isValid) {
        discountAmount = Number(promotionResult.discountAmount || 0);
        appliedPromotionId = promotionId;
      } else {
        validationError = promotionResult.error;
      }
    }

    // Return validation result
    if (validationError) {
      return res.status(400).json({
        valid: false,
        error: validationError,
      });
    }

    res.json({
      valid: true,
      discountAmount: Number(discountAmount.toFixed(2)),
      appliedPromotionId,
      appliedCouponCode,
      message: "Promotion applied successfully",
    });
  } catch (error: any) {
    console.error("Validate promotion error:", error);
    res.status(500).json({ error: error.message || "Failed to validate promotion" });
  }
});

// ====================================================
// PHASE 8: Restaurant Review & Rating Management System
// ====================================================

// ====================================================
// POST /api/customer/reviews
// Submit a review for a delivered order
// ====================================================
router.post("/reviews", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Input validation
    const schema = z.object({
      orderId: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      reviewText: z.string().optional(),
      images: z.array(z.string().url()).max(5).optional(),
    });

    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: validationResult.error.errors,
      });
    }

    const { orderId, rating, reviewText, images } = validationResult.data;

    // Get customer profile
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Verify order exists and belongs to this customer
    const order = await prisma.foodOrder.findUnique({
      where: { id: orderId },
      include: {
        review: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.customerId !== customerProfile.id) {
      return res.status(403).json({ error: "This order does not belong to you" });
    }

    // Verify order is delivered
    if (order.status !== "delivered") {
      return res.status(400).json({ error: "Can only review delivered orders" });
    }

    // Verify no existing review for this order
    if (order.review) {
      return res.status(400).json({ error: "This order has already been reviewed" });
    }

    // Create the review
    const review = await prisma.review.create({
      data: {
        orderId,
        restaurantId: order.restaurantId,
        customerId: customerProfile.id,
        rating,
        reviewText: reviewText || null,
        images: images || [],
      },
      include: {
        restaurant: {
          select: {
            restaurantName: true,
          },
        },
      },
    });

    res.status(201).json({
      id: review.id,
      orderId: review.orderId,
      restaurantId: review.restaurantId,
      restaurantName: review.restaurant.restaurantName,
      rating: review.rating,
      reviewText: review.reviewText,
      images: review.images,
      createdAt: review.createdAt,
      message: "Review submitted successfully",
    });
  } catch (error: any) {
    console.error("Submit review error:", error);
    res.status(500).json({ error: error.message || "Failed to submit review" });
  }
});

// ====================================================
// GET /api/customer/food-orders
// Get all food orders for this customer with review status
// ====================================================
router.get("/food-orders", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get customer profile
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Get all food orders for this customer
    const orders = await prisma.foodOrder.findMany({
      where: {
        customerId: customerProfile.id,
      },
      include: {
        restaurant: {
          select: {
            id: true,
            restaurantName: true,
            address: true,
            cuisineType: true,
          },
        },
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
            vehicles: {
              where: { isActive: true },
              take: 1,
              select: {
                make: true,
                vehicleModel: true,
                color: true,
                licensePlate: true,
                vehiclePlate: true,
              },
            },
          },
        },
        review: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get branding for all restaurants
    const restaurantIds = Array.from(new Set(orders.map((o: any) => o.restaurantId)));
    const brandings = await prisma.restaurantBranding.findMany({
      where: { restaurantId: { in: restaurantIds } },
      select: { restaurantId: true, logoUrl: true },
    });
    const brandingMap = new Map(brandings.map((b: any) => [b.restaurantId, b.logoUrl]));

    res.json({
      orders: orders.map((order: any) => {
        let items: any[] = [];
        try {
          if (order.items) {
            items = typeof order.items === "string" ? JSON.parse(order.items) : order.items;
          }
        } catch {
          items = [];
        }

        const activeVehicle = order.driver?.vehicles?.[0] || null;

        return {
          id: order.id,
          orderCode: order.orderCode,
          restaurantId: order.restaurantId,
          restaurantName: order.restaurant.restaurantName,
          restaurantAddress: order.restaurant.address,
          restaurantCuisine: order.restaurant.cuisineType,
          restaurantLogo: brandingMap.get(order.restaurantId) || null,
          deliveryAddress: order.deliveryAddress,
          items,
          itemsCount: order.itemsCount || items.length,
          subtotal: order.subtotal ? Number(order.subtotal) : null,
          deliveryFee: order.deliveryFee ? Number(order.deliveryFee) : null,
          serviceFare: Number(order.serviceFare),
          taxAmount: order.totalTaxAmount ? Number(order.totalTaxAmount) : null,
          tipAmount: order.tipAmount ? Number(order.tipAmount) : null,
          discountAmount: order.discountAmount ? Number(order.discountAmount) : null,
          promoCode: order.appliedCouponCode,
          status: order.status,
          paymentMethod: order.paymentMethod,
          createdAt: order.createdAt,
          acceptedAt: order.acceptedAt,
          preparingAt: order.preparingAt,
          readyAt: order.readyAt,
          pickedUpAt: order.pickedUpAt,
          deliveredAt: order.deliveredAt,
          cancelledAt: order.cancelledAt,
          hasReview: !!order.review,
          driver: order.driver ? {
            id: order.driver.id,
            firstName: order.driver.firstName,
            lastName: order.driver.lastName,
            photoUrl: order.driver.profilePhotoUrl,
            vehicle: activeVehicle ? {
              make: activeVehicle.make || activeVehicle.vehicleModel,
              model: activeVehicle.vehicleModel,
              color: activeVehicle.color,
              plate: activeVehicle.licensePlate || activeVehicle.vehiclePlate,
            } : null,
          } : null,
        };
      }),
      total: orders.length,
    });
  } catch (error: any) {
    console.error("Get food orders error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch food orders" });
  }
});

// ====================================================
// GET /api/customer/reviews/my
// Get all reviews submitted by this customer
// ====================================================
router.get("/reviews/my", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get customer profile
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Get all reviews by this customer
    const reviews = await prisma.review.findMany({
      where: {
        customerId: customerProfile.id,
      },
      include: {
        restaurant: {
          select: {
            id: true,
            restaurantName: true,
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
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      reviews: reviews.map((review: any) => ({
        id: review.id,
        orderId: review.orderId,
        orderDate: review.order.createdAt,
        deliveredAt: review.order.deliveredAt,
        restaurantId: review.restaurantId,
        restaurantName: review.restaurant.restaurantName,
        rating: review.rating,
        reviewText: review.reviewText,
        images: review.images,
        isHidden: review.isHidden,
        adminFlagged: review.adminFlagged,
        createdAt: review.createdAt,
        restaurantReplyText: review.restaurantReplyText,
        restaurantRepliedAt: review.restaurantRepliedAt,
      })),
    });
  } catch (error: any) {
    console.error("Get my reviews error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch reviews" });
  }
});

// ====================================================
// PAYMENT METHODS
// ====================================================

// Validation schema for adding payment method (test mode)
const addPaymentMethodSchema = z.object({
  brand: z.enum(["visa", "mastercard", "amex", "discover"]),
  last4: z.string().length(4).regex(/^\d{4}$/),
  expMonth: z.number().min(1).max(12),
  expYear: z.number().min(new Date().getFullYear()).max(new Date().getFullYear() + 20),
  makeDefault: z.boolean().optional().default(false),
});

// GET /api/customer/payment-methods - List all payment methods
router.get("/payment-methods", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const paymentMethods = await prisma.paymentMethod.findMany({
      where: {
        customerId: customerProfile.id,
        status: "active",
      },
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });

    res.json({
      paymentMethods: paymentMethods.map((pm: any) => ({
        id: pm.id,
        brand: pm.brand,
        last4: pm.last4,
        expMonth: pm.expMonth,
        expYear: pm.expYear,
        isDefault: pm.isDefault,
        createdAt: pm.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get payment methods error:", error);
    res.status(500).json({ error: "Failed to get payment methods" });
  }
});

// POST /api/customer/payment-methods - Add a new payment method (test mode)
router.post("/payment-methods", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const validation = addPaymentMethodSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Invalid payment method data",
        details: validation.error.errors,
      });
    }

    const { brand, last4, expMonth, expYear, makeDefault } = validation.data;

    // Generate a fake provider method ID for test mode
    const providerMethodId = `test_pm_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Check if this is the first payment method
    const existingMethods = await prisma.paymentMethod.count({
      where: {
        customerId: customerProfile.id,
        status: "active",
      },
    });

    const isFirstMethod = existingMethods === 0;
    const shouldBeDefault = makeDefault || isFirstMethod;

    // If setting as default, unset any existing default
    if (shouldBeDefault) {
      await prisma.paymentMethod.updateMany({
        where: {
          customerId: customerProfile.id,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    const newPaymentMethod = await prisma.paymentMethod.create({
      data: {
        customerId: customerProfile.id,
        provider: "test_stripe",
        providerMethodId,
        brand,
        last4,
        expMonth,
        expYear,
        isDefault: shouldBeDefault,
        status: "active",
      },
    });

    res.status(201).json({
      paymentMethod: {
        id: newPaymentMethod.id,
        brand: newPaymentMethod.brand,
        last4: newPaymentMethod.last4,
        expMonth: newPaymentMethod.expMonth,
        expYear: newPaymentMethod.expYear,
        isDefault: newPaymentMethod.isDefault,
        createdAt: newPaymentMethod.createdAt,
      },
    });
  } catch (error) {
    console.error("Add payment method error:", error);
    res.status(500).json({ error: "Failed to add payment method" });
  }
});

// PUT /api/customer/payment-methods/:id/default - Set as default
router.put("/payment-methods/:id/default", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Verify ownership
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id,
        customerId: customerProfile.id,
        status: "active",
      },
    });

    if (!paymentMethod) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    // Unset all defaults first
    await prisma.paymentMethod.updateMany({
      where: {
        customerId: customerProfile.id,
        isDefault: true,
      },
      data: { isDefault: false },
    });

    // Set new default
    await prisma.paymentMethod.update({
      where: { id },
      data: { isDefault: true },
    });

    res.json({ message: "Payment method set as default" });
  } catch (error) {
    console.error("Set default payment method error:", error);
    res.status(500).json({ error: "Failed to set default payment method" });
  }
});

// DELETE /api/customer/payment-methods/:id - Remove payment method
router.delete("/payment-methods/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Verify ownership
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id,
        customerId: customerProfile.id,
        status: "active",
      },
    });

    if (!paymentMethod) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    // Soft delete by setting status to inactive
    await prisma.paymentMethod.update({
      where: { id },
      data: { status: "inactive" },
    });

    // If this was the default, set another as default
    if (paymentMethod.isDefault) {
      const nextDefault = await prisma.paymentMethod.findFirst({
        where: {
          customerId: customerProfile.id,
          status: "active",
        },
        orderBy: { createdAt: "desc" },
      });

      if (nextDefault) {
        await prisma.paymentMethod.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        });
      }
    }

    res.json({ message: "Payment method removed" });
  } catch (error) {
    console.error("Delete payment method error:", error);
    res.status(500).json({ error: "Failed to remove payment method" });
  }
});

// GET /api/customer/payment-methods/default - Get default payment method
router.get("/payment-methods/default", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const defaultMethod = await prisma.paymentMethod.findFirst({
      where: {
        customerId: customerProfile.id,
        isDefault: true,
        status: "active",
      },
    });

    if (!defaultMethod) {
      return res.json({ paymentMethod: null });
    }

    res.json({
      paymentMethod: {
        id: defaultMethod.id,
        brand: defaultMethod.brand,
        last4: defaultMethod.last4,
        expMonth: defaultMethod.expMonth,
        expYear: defaultMethod.expYear,
        isDefault: defaultMethod.isDefault,
      },
    });
  } catch (error) {
    console.error("Get default payment method error:", error);
    res.status(500).json({ error: "Failed to get default payment method" });
  }
});

// ====================================================
// BANGLADESH MOBILE WALLET PAYMENT METHODS
// ====================================================

import { MobileWalletBrand } from "@prisma/client";

// Validation schema for adding BD mobile wallet
const addMobileWalletSchema = z.object({
  brand: z.nativeEnum(MobileWalletBrand),
  walletPhone: z.string().regex(/^01[3-9]\d{8}$/, "Invalid Bangladesh phone number"),
  accountName: z.string().min(2).optional(),
  makeDefault: z.boolean().optional().default(false),
});

// GET /api/customer/mobile-wallets - List all mobile wallets
router.get("/mobile-wallets", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    if (customerProfile.user.countryCode !== "BD") {
      return res.status(400).json({ error: "Mobile wallets are only available in Bangladesh" });
    }

    const wallets = await prisma.customerMobileWallet.findMany({
      where: {
        customerId: customerProfile.id,
        status: "active",
      },
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });

    res.json({
      wallets: wallets.map((w) => ({
        id: w.id,
        brand: w.brand,
        walletPhoneMasked: w.walletPhoneMasked,
        accountName: w.accountName,
        isDefault: w.isDefault,
        isVerified: w.isVerified,
        lastUsedAt: w.lastUsedAt,
        createdAt: w.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get mobile wallets error:", error);
    res.status(500).json({ error: "Failed to get mobile wallets" });
  }
});

// POST /api/customer/mobile-wallets - Add a new mobile wallet
router.post("/mobile-wallets", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    if (customerProfile.user.countryCode !== "BD") {
      return res.status(400).json({ error: "Mobile wallets are only available in Bangladesh" });
    }

    const validation = addMobileWalletSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Invalid mobile wallet data",
        details: validation.error.errors,
      });
    }

    const { brand, walletPhone, accountName, makeDefault } = validation.data;

    // Check if wallet already exists for this customer
    const existingWallet = await prisma.customerMobileWallet.findFirst({
      where: {
        customerId: customerProfile.id,
        brand,
        walletPhoneMasked: walletPhone.slice(0, 3) + "****" + walletPhone.slice(-4),
        status: "active",
      },
    });

    if (existingWallet) {
      return res.status(400).json({ error: "This wallet is already registered" });
    }

    // Check if this is the first wallet
    const existingWallets = await prisma.customerMobileWallet.count({
      where: {
        customerId: customerProfile.id,
        status: "active",
      },
    });

    const isFirstWallet = existingWallets === 0;
    const shouldBeDefault = makeDefault || isFirstWallet;

    // If setting as default, unset any existing default
    if (shouldBeDefault) {
      await prisma.customerMobileWallet.updateMany({
        where: {
          customerId: customerProfile.id,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    // Create masked phone number for storage
    const walletPhoneMasked = walletPhone.slice(0, 3) + "****" + walletPhone.slice(-4);
    
    // Encrypt the full phone number for secure storage
    const walletPhoneEncrypted = encrypt(walletPhone);

    const wallet = await prisma.customerMobileWallet.create({
      data: {
        customerId: customerProfile.id,
        brand,
        walletPhoneMasked,
        walletPhoneEncrypted,
        accountName,
        isDefault: shouldBeDefault,
        isVerified: false, // Requires OTP verification
        status: "active",
      },
    });

    res.status(201).json({
      wallet: {
        id: wallet.id,
        brand: wallet.brand,
        walletPhoneMasked: wallet.walletPhoneMasked,
        accountName: wallet.accountName,
        isDefault: wallet.isDefault,
        isVerified: wallet.isVerified,
        createdAt: wallet.createdAt,
      },
      message: "Mobile wallet added. Verification may be required for transactions.",
    });
  } catch (error) {
    console.error("Add mobile wallet error:", error);
    res.status(500).json({ error: "Failed to add mobile wallet" });
  }
});

// PUT /api/customer/mobile-wallets/:id/default - Set mobile wallet as default
router.put("/mobile-wallets/:id/default", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Verify ownership
    const wallet = await prisma.customerMobileWallet.findFirst({
      where: {
        id,
        customerId: customerProfile.id,
        status: "active",
      },
    });

    if (!wallet) {
      return res.status(404).json({ error: "Mobile wallet not found" });
    }

    // Unset all defaults first
    await prisma.customerMobileWallet.updateMany({
      where: {
        customerId: customerProfile.id,
        isDefault: true,
      },
      data: { isDefault: false },
    });

    // Set new default
    await prisma.customerMobileWallet.update({
      where: { id },
      data: { isDefault: true },
    });

    res.json({ message: "Mobile wallet set as default" });
  } catch (error) {
    console.error("Set default mobile wallet error:", error);
    res.status(500).json({ error: "Failed to set default mobile wallet" });
  }
});

// DELETE /api/customer/mobile-wallets/:id - Remove mobile wallet
router.delete("/mobile-wallets/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Verify ownership
    const wallet = await prisma.customerMobileWallet.findFirst({
      where: {
        id,
        customerId: customerProfile.id,
        status: "active",
      },
    });

    if (!wallet) {
      return res.status(404).json({ error: "Mobile wallet not found" });
    }

    // Soft delete by setting status to inactive
    await prisma.customerMobileWallet.update({
      where: { id },
      data: { status: "inactive" },
    });

    // If this was the default, set another as default
    if (wallet.isDefault) {
      const nextDefault = await prisma.customerMobileWallet.findFirst({
        where: {
          customerId: customerProfile.id,
          status: "active",
        },
        orderBy: { createdAt: "desc" },
      });

      if (nextDefault) {
        await prisma.customerMobileWallet.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        });
      }
    }

    res.json({ message: "Mobile wallet removed" });
  } catch (error) {
    console.error("Delete mobile wallet error:", error);
    res.status(500).json({ error: "Failed to remove mobile wallet" });
  }
});

// GET /api/customer/mobile-wallets/available-providers - Get available wallet providers
router.get("/mobile-wallets/available-providers", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { countryCode: true },
    });

    if (!user || user.countryCode !== "BD") {
      return res.status(400).json({ error: "Mobile wallets are only available in Bangladesh" });
    }

    // Get enabled providers for Bangladesh
    const configs = await prisma.mobileWalletConfig.findMany({
      where: {
        countryCode: "BD",
        isEnabled: true,
      },
      orderBy: { provider: "asc" },
    });

    res.json({
      providers: configs.map((c) => ({
        brand: c.provider,
        displayName: c.displayName || c.providerName,
        logoUrl: c.logoUrl,
        isDefault: c.isDefault,
        enabledForRides: c.enabledForRides,
        enabledForFood: c.enabledForFood,
        enabledForParcels: c.enabledForParcels,
      })),
    });
  } catch (error) {
    console.error("Get available providers error:", error);
    res.status(500).json({ error: "Failed to get available providers" });
  }
});

// ====================================================
// GET /api/customer/ride-options/availability (C5)
// Get driver availability and ETA per vehicle category
// ====================================================
import { driverAvailabilityService } from "../services/driverAvailabilityService";
import { VEHICLE_CATEGORIES, VehicleCategoryId } from "@shared/vehicleCategories";

const rideAvailabilitySchema = z.object({
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  useMockData: z.boolean().optional().default(true),
});

router.get("/ride-options/availability", async (req: AuthRequest, res) => {
  try {
    const query = rideAvailabilitySchema.parse({
      pickupLat: req.query.pickupLat ? parseFloat(req.query.pickupLat as string) : undefined,
      pickupLng: req.query.pickupLng ? parseFloat(req.query.pickupLng as string) : undefined,
      useMockData: req.query.useMockData === 'false' ? false : true,
    });

    const availability = await driverAvailabilityService.getCategoryAvailability(
      query.pickupLat,
      query.pickupLng,
      query.useMockData
    );

    const categoriesWithDetails = availability.categories.map(cat => ({
      ...cat,
      displayName: VEHICLE_CATEGORIES[cat.categoryId].displayName,
      description: VEHICLE_CATEGORIES[cat.categoryId].shortDescription,
      seatCount: VEHICLE_CATEGORIES[cat.categoryId].seatCount,
      iconType: VEHICLE_CATEGORIES[cat.categoryId].iconType,
      sortOrder: VEHICLE_CATEGORIES[cat.categoryId].sortOrder,
    }));

    res.json({
      categories: categoriesWithDetails,
      totalNearbyDrivers: availability.totalNearbyDrivers,
      timestamp: availability.timestamp.toISOString(),
      pickupLocation: availability.pickupLocation,
    });
  } catch (error) {
    console.error("Get ride availability error:", error);
    res.status(500).json({ error: "Failed to get ride availability" });
  }
});

// ====================================================
// GET /api/customer/ride-options/availability/:categoryId (C5)
// Get driver availability and ETA for a single category
// ====================================================
router.get("/ride-options/availability/:categoryId", async (req: AuthRequest, res) => {
  try {
    const { categoryId } = req.params;
    
    if (!(categoryId in VEHICLE_CATEGORIES)) {
      return res.status(400).json({ error: "Invalid vehicle category" });
    }

    const pickupLat = req.query.pickupLat ? parseFloat(req.query.pickupLat as string) : undefined;
    const pickupLng = req.query.pickupLng ? parseFloat(req.query.pickupLng as string) : undefined;
    const useMockData = req.query.useMockData === 'false' ? false : true;

    const availability = await driverAvailabilityService.getSingleCategoryAvailability(
      categoryId as VehicleCategoryId,
      pickupLat,
      pickupLng,
      useMockData
    );

    const categoryConfig = VEHICLE_CATEGORIES[categoryId as VehicleCategoryId];

    res.json({
      ...availability,
      displayName: categoryConfig.displayName,
      description: categoryConfig.shortDescription,
      seatCount: categoryConfig.seatCount,
      iconType: categoryConfig.iconType,
      sortOrder: categoryConfig.sortOrder,
    });
  } catch (error) {
    console.error("Get single category availability error:", error);
    res.status(500).json({ error: "Failed to get category availability" });
  }
});

// GET /api/customer/active-promotions - Get active ride promotions
router.get("/active-promotions", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const now = new Date();

    const promotions = await prisma.ridePromotion.findMany({
      where: {
        isActive: true,
        OR: [
          { startAt: { lte: now }, endAt: null },
          { startAt: { lte: now }, endAt: { gte: now } }
        ]
      },
      orderBy: [{ priority: "desc" }, { isDefault: "desc" }],
      take: 10
    });

    let userRideCount = 0;
    if (userId) {
      userRideCount = await prisma.ride.count({
        where: { customerId: userId, status: "completed" }
      });
    }

    const eligiblePromos = [];

    for (const promo of promotions) {
      let isEligible = true;

      switch (promo.userRule) {
        case "FIRST_RIDE":
          if (userRideCount > 0) isEligible = false;
          break;
        case "N_RIDES":
          if (promo.rideCountLimit && userRideCount >= promo.rideCountLimit) {
            isEligible = false;
          }
          break;
        case "ALL_RIDES":
        default:
          break;
      }

      if (isEligible) {
        eligiblePromos.push({
          id: promo.id,
          name: promo.name,
          description: promo.description,
          discountType: promo.discountType,
          value: Number(promo.value),
          maxDiscountAmount: promo.maxDiscountAmount ? Number(promo.maxDiscountAmount) : null,
          appliesTo: promo.appliesTo,
          targetCities: promo.targetCities,
          targetCategories: promo.targetCategories,
          userRule: promo.userRule,
          maxSurgeAllowed: promo.maxSurgeAllowed ? Number(promo.maxSurgeAllowed) : null,
          isDefault: promo.isDefault,
          priority: promo.priority
        });
      }
    }

    res.json({ promotions: eligiblePromos, userRideCount });
  } catch (error) {
    console.error("Get active promotions error:", error);
    res.status(500).json({ error: "Failed to get promotions" });
  }
});

// ====================================================
// GET /api/customer/account/lock-status
// Get current account lock status
// ====================================================
router.get("/account/lock-status", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isAccountLocked: true,
        accountLockedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      isAccountLocked: user.isAccountLocked,
      accountLockedAt: user.accountLockedAt,
    });
  } catch (error) {
    console.error("Get account lock status error:", error);
    res.status(500).json({ error: "Failed to get account status" });
  }
});

// ====================================================
// POST /api/customer/account/lock
// Lock customer account (user-initiated)
// Requires password verification and confirmation text "LOCK"
// ====================================================
router.post("/account/lock", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { confirmationText, password } = req.body;

    if (confirmationText !== "LOCK") {
      return res.status(400).json({ 
        error: "Invalid confirmation. Please type LOCK to confirm.",
        code: "CONFIRMATION_REQUIRED"
      });
    }

    if (!password) {
      return res.status(400).json({ 
        error: "Password is required to lock your account.",
        code: "PASSWORD_REQUIRED"
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAccountLocked: true, email: true, passwordHash: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: "Invalid password",
        code: "INVALID_PASSWORD"
      });
    }

    if (user.isAccountLocked) {
      return res.status(400).json({ 
        error: "Account is already locked",
        code: "ALREADY_LOCKED"
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        isAccountLocked: true,
        accountLockedAt: new Date(),
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        temporaryLockUntil: null,
      },
    });

    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        type: "account_security",
        title: "Account Locked",
        body: "Your SafeGo account has been locked. You can unlock it anytime from your profile.",
      },
    });

    res.json({
      message: "Your account is locked. You can unlock it from your profile at any time.",
      isAccountLocked: true,
      accountLockedAt: new Date(),
    });
  } catch (error) {
    console.error("Lock account error:", error);
    res.status(500).json({ error: "Failed to lock account" });
  }
});

// ====================================================
// POST /api/customer/account/unlock/request-otp
// Request OTP for unlocking account
// Requires password verification before sending OTP
// ====================================================
router.post("/account/unlock/request-otp", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ 
        error: "Password is required",
        code: "PASSWORD_REQUIRED"
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAccountLocked: true, email: true, passwordHash: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.isAccountLocked) {
      return res.status(400).json({ 
        error: "Account is not locked",
        code: "NOT_LOCKED"
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: "Invalid password",
        code: "INVALID_PASSWORD"
      });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otpCode, 10);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: {
        unlockOtpHash: otpHash,
        unlockOtpExpiry: otpExpiry,
      },
    });

    console.log(`[Account Unlock] OTP for ${user.email}: ${otpCode} (expires in 10 minutes)`);

    res.json({
      message: "Verification code sent to your registered email/phone",
      expiresIn: 600,
      email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
    });
  } catch (error) {
    console.error("Request unlock OTP error:", error);
    res.status(500).json({ error: "Failed to send verification code" });
  }
});

// ====================================================
// POST /api/customer/account/unlock
// Unlock customer account with password and OTP verification
// Requires both password and valid OTP code
// ====================================================
router.post("/account/unlock", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { password, otpCode } = req.body;

    if (!password) {
      return res.status(400).json({ 
        error: "Password is required",
        code: "PASSWORD_REQUIRED"
      });
    }

    if (!otpCode) {
      return res.status(400).json({ 
        error: "Verification code is required",
        code: "OTP_REQUIRED"
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        isAccountLocked: true, 
        passwordHash: true, 
        email: true,
        accountLockedAt: true,
        unlockOtpHash: true,
        unlockOtpExpiry: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.isAccountLocked) {
      return res.status(400).json({ 
        error: "Account is not locked",
        code: "NOT_LOCKED"
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: "Invalid password",
        code: "INVALID_PASSWORD"
      });
    }

    if (!user.unlockOtpHash || !user.unlockOtpExpiry) {
      return res.status(400).json({ 
        error: "No verification code was requested. Please request a new code.",
        code: "OTP_NOT_REQUESTED"
      });
    }

    if (new Date() > user.unlockOtpExpiry) {
      return res.status(400).json({ 
        error: "Verification code has expired. Please request a new code.",
        code: "OTP_EXPIRED"
      });
    }

    const isValidOtp = await bcrypt.compare(otpCode, user.unlockOtpHash);
    if (!isValidOtp) {
      return res.status(401).json({ 
        error: "Invalid verification code",
        code: "INVALID_OTP"
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        isAccountLocked: false,
        accountLockedAt: null,
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        temporaryLockUntil: null,
        unlockOtpHash: null,
        unlockOtpExpiry: null,
      },
    });

    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        type: "account_security",
        title: "Account Unlocked",
        body: "Your SafeGo account is now active again. Welcome back!",
      },
    });

    res.json({
      message: "Your account is active again.",
      isAccountLocked: false,
    });
  } catch (error) {
    console.error("Unlock account error:", error);
    res.status(500).json({ error: "Failed to unlock account" });
  }
});

// ============================================================
// PHASE 3: Customer Experience, Restaurant Flow & Parcel Features
// ============================================================

// Import Phase 3 feature flags
import { getPhase3Features } from "../config/phase3Features";

// ====================================================
// GET /api/customer/saved-places
// Get customer's saved places (home, work, other)
// ====================================================
router.get("/saved-places", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { countryCode: true } },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const countryCode = customer.user?.countryCode || "US";
    const features = await getPhase3Features(countryCode);

    if (!features.savedPlacesEnabled) {
      return res.status(403).json({ error: "Saved places feature is not enabled" });
    }

    const savedPlaces = await prisma.customerSavedPlace.findMany({
      where: { customerId: customer.id },
      orderBy: [
        { label: "asc" },
        { createdAt: "desc" },
      ],
    });

    res.json({ savedPlaces, maxAllowed: features.maxSavedPlaces });
  } catch (error: any) {
    console.error("[Customer] Error fetching saved places:", error);
    res.status(500).json({ error: error.message || "Failed to fetch saved places" });
  }
});

// Validation schemas for Phase 3
const savedPlaceSchema = z.object({
  label: z.enum(["home", "work", "other"]),
  customLabel: z.string().max(50).optional().nullable(),
  addressText: z.string().min(1).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  placeId: z.string().optional().nullable(),
  iconType: z.string().max(20).optional(),
  isDefaultPickup: z.boolean().optional(),
  isDefaultDropoff: z.boolean().optional(),
});

// ====================================================
// POST /api/customer/saved-places
// Add a new saved place
// ====================================================
router.post("/saved-places", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const validationResult = savedPlaceSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { countryCode: true } },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const countryCode = customer.user?.countryCode || "US";
    const features = await getPhase3Features(countryCode);

    if (!features.savedPlacesEnabled) {
      return res.status(403).json({ error: "Saved places feature is not enabled" });
    }

    const existingCount = await prisma.customerSavedPlace.count({
      where: { customerId: customer.id },
    });

    if (existingCount >= features.maxSavedPlaces) {
      return res.status(400).json({
        error: `Maximum ${features.maxSavedPlaces} saved places allowed`,
      });
    }

    // Enforce single home/work rule
    if (data.label === "home" || data.label === "work") {
      const existing = await prisma.customerSavedPlace.findFirst({
        where: {
          customerId: customer.id,
          label: data.label,
        },
      });

      if (existing) {
        return res.status(400).json({
          error: `A ${data.label} address already exists. Please update or delete it first.`,
        });
      }
    }

    // Clear existing defaults if setting new defaults
    if (data.isDefaultPickup) {
      await prisma.customerSavedPlace.updateMany({
        where: { customerId: customer.id, isDefaultPickup: true },
        data: { isDefaultPickup: false },
      });
    }

    if (data.isDefaultDropoff) {
      await prisma.customerSavedPlace.updateMany({
        where: { customerId: customer.id, isDefaultDropoff: true },
        data: { isDefaultDropoff: false },
      });
    }

    const savedPlace = await prisma.customerSavedPlace.create({
      data: {
        customerId: customer.id,
        label: data.label,
        customLabel: data.customLabel,
        addressText: data.addressText,
        latitude: data.latitude,
        longitude: data.longitude,
        placeId: data.placeId,
        iconType: data.iconType || (data.label === "home" ? "home" : data.label === "work" ? "work" : "star"),
        isDefaultPickup: data.isDefaultPickup || false,
        isDefaultDropoff: data.isDefaultDropoff || false,
      },
    });

    res.status(201).json({ savedPlace });
  } catch (error: any) {
    console.error("[Customer] Error creating saved place:", error);
    res.status(500).json({ error: error.message || "Failed to create saved place" });
  }
});

// ====================================================
// PATCH /api/customer/saved-places/:id
// Update a saved place
// ====================================================
router.patch("/saved-places/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const placeId = req.params.id;

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const existingPlace = await prisma.customerSavedPlace.findFirst({
      where: { id: placeId, customerId: customer.id },
    });

    if (!existingPlace) {
      return res.status(404).json({ error: "Saved place not found" });
    }

    const partialSchema = savedPlaceSchema.partial();
    const validationResult = partialSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    // Check home/work uniqueness if changing label
    if (data.label && (data.label === "home" || data.label === "work") && data.label !== existingPlace.label) {
      const existing = await prisma.customerSavedPlace.findFirst({
        where: {
          customerId: customer.id,
          label: data.label,
          id: { not: placeId },
        },
      });

      if (existing) {
        return res.status(400).json({
          error: `A ${data.label} address already exists`,
        });
      }
    }

    // Clear existing defaults if setting new defaults
    if (data.isDefaultPickup) {
      await prisma.customerSavedPlace.updateMany({
        where: { customerId: customer.id, isDefaultPickup: true, id: { not: placeId } },
        data: { isDefaultPickup: false },
      });
    }

    if (data.isDefaultDropoff) {
      await prisma.customerSavedPlace.updateMany({
        where: { customerId: customer.id, isDefaultDropoff: true, id: { not: placeId } },
        data: { isDefaultDropoff: false },
      });
    }

    const updated = await prisma.customerSavedPlace.update({
      where: { id: placeId },
      data: {
        ...(data.label && { label: data.label }),
        ...(data.customLabel !== undefined && { customLabel: data.customLabel }),
        ...(data.addressText && { addressText: data.addressText }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.placeId !== undefined && { placeId: data.placeId }),
        ...(data.iconType && { iconType: data.iconType }),
        ...(data.isDefaultPickup !== undefined && { isDefaultPickup: data.isDefaultPickup }),
        ...(data.isDefaultDropoff !== undefined && { isDefaultDropoff: data.isDefaultDropoff }),
      },
    });

    res.json({ savedPlace: updated });
  } catch (error: any) {
    console.error("[Customer] Error updating saved place:", error);
    res.status(500).json({ error: error.message || "Failed to update saved place" });
  }
});

// ====================================================
// DELETE /api/customer/saved-places/:id
// Delete a saved place
// ====================================================
router.delete("/saved-places/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const placeId = req.params.id;

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const existingPlace = await prisma.customerSavedPlace.findFirst({
      where: { id: placeId, customerId: customer.id },
    });

    if (!existingPlace) {
      return res.status(404).json({ error: "Saved place not found" });
    }

    await prisma.customerSavedPlace.delete({
      where: { id: placeId },
    });

    res.json({ success: true, message: "Saved place deleted" });
  } catch (error: any) {
    console.error("[Customer] Error deleting saved place:", error);
    res.status(500).json({ error: error.message || "Failed to delete saved place" });
  }
});

// ====================================================
// GET /api/customer/ride-preferences
// Get customer ride preferences
// ====================================================
router.get("/ride-preferences", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { countryCode: true } },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const countryCode = customer.user?.countryCode || "US";
    const features = await getPhase3Features(countryCode);

    if (!features.ridePreferencesEnabled) {
      return res.status(403).json({ error: "Ride preferences feature is not enabled" });
    }

    const ridePreferences = await prisma.customerRidePreferences.findUnique({
      where: { customerId: customer.id },
    });

    const preferences = ridePreferences || {
      preferredServiceTypes: ["ride"],
      preferredVehicleTypes: [],
      musicPreference: "no_preference",
      airConditioning: "no_preference",
      communicationPreference: "no_preference",
      accessibilityOptions: {},
      safetyPreferences: {},
    };

    res.json({ preferences });
  } catch (error: any) {
    console.error("[Customer] Error fetching ride preferences:", error);
    res.status(500).json({ error: error.message || "Failed to fetch ride preferences" });
  }
});

// Ride preferences validation schema
const ridePreferencesSchema = z.object({
  preferredServiceTypes: z.array(z.enum(["ride", "food", "parcel"])).optional(),
  preferredVehicleTypes: z.array(z.string()).optional(),
  musicPreference: z.enum(["no_preference", "quiet", "loud_ok"]).optional(),
  airConditioning: z.enum(["no_preference", "ac_on", "ac_off"]).optional(),
  communicationPreference: z.enum(["no_preference", "minimal_talk", "friendly"]).optional(),
  accessibilityOptions: z.object({
    wheelchair_support: z.boolean().optional(),
    hearing_impaired: z.boolean().optional(),
    vision_impaired: z.boolean().optional(),
  }).optional(),
  safetyPreferences: z.object({
    share_trip_automatically_with_contacts: z.boolean().optional(),
    require_mask: z.boolean().optional(),
  }).optional(),
});

// ====================================================
// PUT /api/customer/ride-preferences
// Update customer ride preferences
// ====================================================
router.put("/ride-preferences", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const validationResult = ridePreferencesSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { countryCode: true } },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const countryCode = customer.user?.countryCode || "US";
    const features = await getPhase3Features(countryCode);

    if (!features.ridePreferencesEnabled) {
      return res.status(403).json({ error: "Ride preferences feature is not enabled" });
    }

    const preferences = await prisma.customerRidePreferences.upsert({
      where: { customerId: customer.id },
      create: {
        customerId: customer.id,
        preferredServiceTypes: data.preferredServiceTypes || ["ride"],
        preferredVehicleTypes: data.preferredVehicleTypes || [],
        musicPreference: data.musicPreference || "no_preference",
        airConditioning: data.airConditioning || "no_preference",
        communicationPreference: data.communicationPreference || "no_preference",
        accessibilityOptions: data.accessibilityOptions || {},
        safetyPreferences: data.safetyPreferences || {},
      },
      update: {
        ...(data.preferredServiceTypes && { preferredServiceTypes: data.preferredServiceTypes }),
        ...(data.preferredVehicleTypes && { preferredVehicleTypes: data.preferredVehicleTypes }),
        ...(data.musicPreference && { musicPreference: data.musicPreference }),
        ...(data.airConditioning && { airConditioning: data.airConditioning }),
        ...(data.communicationPreference && { communicationPreference: data.communicationPreference }),
        ...(data.accessibilityOptions && { accessibilityOptions: data.accessibilityOptions }),
        ...(data.safetyPreferences && { safetyPreferences: data.safetyPreferences }),
      },
    });

    res.json({ preferences });
  } catch (error: any) {
    console.error("[Customer] Error updating ride preferences:", error);
    res.status(500).json({ error: error.message || "Failed to update ride preferences" });
  }
});


// ====================================================
// PATCH /api/customer/profile/preferences
// Update customer notification and language preferences
// ====================================================
router.patch("/profile/preferences", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const preferencesSchema = z.object({
      languagePreference: z.enum(["en", "bn", "es", "fr", "ar"]).optional(),
      notificationPreferences: z.object({
        ride_updates: z.boolean().optional(),
        food_updates: z.boolean().optional(),
        parcel_updates: z.boolean().optional(),
        marketing: z.boolean().optional(),
        promotions: z.boolean().optional(),
        safety_alerts: z.boolean().optional(),
      }).optional(),
    });

    const validationResult = preferencesSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const updateData: any = {};

    if (data.languagePreference) {
      updateData.languagePreference = data.languagePreference;
    }

    if (data.notificationPreferences) {
      const current = (customer.notificationPreferences as object) || {};
      updateData.notificationPreferences = { ...current, ...data.notificationPreferences };
    }

    const updated = await prisma.customerProfile.update({
      where: { id: customer.id },
      data: updateData,
    });

    res.json({
      success: true,
      preferences: {
        languagePreference: updated.languagePreference,
        notificationPreferences: updated.notificationPreferences,
      },
    });
  } catch (error: any) {
    console.error("[Customer] Error updating preferences:", error);
    res.status(500).json({ error: error.message || "Failed to update preferences" });
  }
});

// ====================================================
// PATCH /api/customer/profile/avatar
// Update customer avatar (legacy endpoint - use /api/profile/upload-photo for new uploads)
// Accepts both avatarUrl (legacy) and profilePhotoUrl (new) for backward compatibility
// ====================================================
router.patch("/profile/avatar", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const avatarSchema = z.object({
      avatarUrl: z.string().url().nullable().optional(),
      profilePhotoUrl: z.string().url().nullable().optional(),
    }).refine((data) => data.avatarUrl !== undefined || data.profilePhotoUrl !== undefined, {
      message: "Either avatarUrl or profilePhotoUrl must be provided",
    });

    const validationResult = avatarSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.issues,
      });
    }

    const photoUrl = validationResult.data.profilePhotoUrl ?? validationResult.data.avatarUrl ?? null;

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const updated = await prisma.customerProfile.update({
      where: { id: customer.id },
      data: { 
        profilePhotoUrl: photoUrl,
        avatarUrl: photoUrl,
      },
    });

    res.json({
      success: true,
      avatarUrl: updated.avatarUrl,
      profilePhotoUrl: updated.profilePhotoUrl,
    });
  } catch (error: any) {
    console.error("[Customer] Error updating avatar:", error);
    res.status(500).json({ error: error.message || "Failed to update avatar" });
  }
});

// ====================================================
// GET /api/customer/delivery-addresses
// Get customer's default delivery address for food orders
// ====================================================
router.get("/delivery-addresses", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Get saved places marked as default dropoff for delivery
    const savedPlaces = await prisma.customerSavedPlace.findMany({
      where: { customerId: customer.id },
      orderBy: [
        { isDefaultDropoff: "desc" },
        { label: "asc" },
        { createdAt: "desc" },
      ],
    });

    // Map to delivery address format
    const deliveryAddresses = savedPlaces.map((place) => ({
      id: place.id,
      label: place.label,
      customLabel: place.customLabel,
      addressText: place.addressText,
      latitude: place.latitude,
      longitude: place.longitude,
      placeId: place.placeId,
      isDefault: place.isDefaultDropoff,
    }));

    res.json({ deliveryAddresses });
  } catch (error: any) {
    console.error("[Customer] Error fetching delivery addresses:", error);
    res.status(500).json({ error: error.message || "Failed to fetch delivery addresses" });
  }
});

// ====================================================
// POST /api/customer/partner/initialize
// Initialize partner profile for role upgrade
// ====================================================
const partnerInitializeSchema = z.object({
  partnerType: z.enum(["ride_driver", "delivery_driver", "restaurant", "shop_partner", "ticket_operator"]),
});

router.post("/partner/initialize", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const body = partnerInitializeSchema.parse(req.body);
    const { partnerType } = body;

    // Get user with country code
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, countryCode: true, role: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify user is still a customer
    if (user.role !== "customer") {
      return res.status(400).json({ error: "Only customers can upgrade to partner roles" });
    }

    // Validate country-specific partner types
    const bdOnlyPartners = ["shop_partner", "ticket_operator"];
    if (bdOnlyPartners.includes(partnerType) && user.countryCode !== "BD") {
      return res.status(400).json({ 
        error: "This partner type is only available in Bangladesh",
        code: "COUNTRY_NOT_SUPPORTED" 
      });
    }

    // Create audit log for partner initialization attempt
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        actorEmail: user.email || "unknown",
        actorRole: user.role,
        actionType: "PARTNER_UPGRADE_INITIALIZED",
        entityType: "user",
        entityId: userId,
        description: `User initialized partner upgrade to ${partnerType}`,
        metadata: {
          partnerType,
          countryCode: user.countryCode,
          trustLevel: "customer_basic",
          step: "initialization",
        },
      },
    });

    // Return next steps based on partner type
    let nextStepUrl = "";
    let requiredDocuments: string[] = [];
    
    switch (partnerType) {
      case "ride_driver":
        nextStepUrl = "/driver/onboarding";
        requiredDocuments = user.countryCode === "BD" 
          ? ["NID", "Driver License", "Vehicle Registration", "Police Clearance"]
          : ["Driver License", "Vehicle Registration", "Insurance", "Background Check"];
        break;
      case "delivery_driver":
        nextStepUrl = "/driver/onboarding";
        requiredDocuments = user.countryCode === "BD"
          ? ["NID", "Driver License"]
          : ["Driver License", "Background Check"];
        break;
      case "restaurant":
        nextStepUrl = "/restaurant/onboarding";
        requiredDocuments = user.countryCode === "BD"
          ? ["Trade License", "NID", "Food Safety Certificate"]
          : ["Business License", "Food Handler Permit", "Tax ID"];
        break;
      case "shop_partner":
        nextStepUrl = "/shop-partner/onboarding";
        requiredDocuments = ["NID", "Trade License", "MFS Account"];
        break;
      case "ticket_operator":
        nextStepUrl = "/ticket-operator/onboarding";
        requiredDocuments = ["NID", "Trade License", "Operator License", "MFS Account"];
        break;
    }

    res.json({
      success: true,
      partnerType,
      countryCode: user.countryCode,
      nextStepUrl,
      requiredDocuments,
      message: "Partner upgrade initialized. Complete onboarding to activate your partner account.",
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid partner type", details: error.errors });
    }
    console.error("[Customer] Error initializing partner:", error);
    res.status(500).json({ error: error.message || "Failed to initialize partner upgrade" });
  }
});

// ====================================================
// GET /api/customer/partner/status
// Get current partner upgrade status
// ====================================================
router.get("/partner/status", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get user with country code
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, countryCode: true, role: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check for any existing partner profiles
    const [driverProfile, restaurantProfile, shopPartner, ticketOperator] = await Promise.all([
      prisma.driverProfile.findUnique({ where: { userId }, select: { id: true, verificationStatus: true } }),
      prisma.restaurantProfile.findFirst({ where: { userId }, select: { id: true, verificationStatus: true } }),
      prisma.shopPartner.findFirst({ where: { userId }, select: { id: true, verificationStatus: true } }),
      prisma.ticketOperator.findFirst({ where: { userId }, select: { id: true, verificationStatus: true } }),
    ]);

    // Determine available partner types based on country
    const availablePartnerTypes = user.countryCode === "BD"
      ? ["ride_driver", "delivery_driver", "restaurant", "shop_partner", "ticket_operator"]
      : ["ride_driver", "delivery_driver", "restaurant"];

    // Build existing partner status
    const existingPartners: { type: string; status: string }[] = [];
    if (driverProfile) {
      existingPartners.push({ type: "driver", status: driverProfile.verificationStatus });
    }
    if (restaurantProfile) {
      existingPartners.push({ type: "restaurant", status: restaurantProfile.verificationStatus });
    }
    if (shopPartner) {
      existingPartners.push({ type: "shop_partner", status: shopPartner.verificationStatus });
    }
    if (ticketOperator) {
      existingPartners.push({ type: "ticket_operator", status: ticketOperator.verificationStatus });
    }

    res.json({
      currentRole: user.role,
      countryCode: user.countryCode,
      availablePartnerTypes,
      existingPartners,
    });
  } catch (error: any) {
    console.error("[Customer] Error getting partner status:", error);
    res.status(500).json({ error: error.message || "Failed to get partner status" });
  }
});

export default router;
