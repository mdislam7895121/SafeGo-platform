import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { validatePromotionForOrder, validateCouponCode } from "../promotions/validationUtils";

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

    res.json({
      orders: orders.map((order: any) => ({
        id: order.id,
        restaurantId: order.restaurantId,
        restaurantName: order.restaurant.restaurantName,
        deliveryAddress: order.deliveryAddress,
        items: order.items,
        serviceFare: Number(order.serviceFare),
        status: order.status,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        deliveredAt: order.deliveredAt,
        hasReview: !!order.review,
      })),
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
        createdAt: review.createdAt,
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

export default router;
