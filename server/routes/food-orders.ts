import { Router } from "express";
import { prisma } from "../db";
import { authenticateToken, AuthRequest, requireUnlockedAccount } from "../middleware/auth";
import { walletService } from "../services/walletService";
import {
  createEarningsTransaction,
  updateEarningsTransactionStatus,
} from "../services/earningsCommissionService";
import { promotionBonusService } from "../services/promotionBonusService";
import crypto from "crypto";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ====================================================
// POST /api/food-orders
// Create a new food order (customer only)
// Locked accounts cannot place food orders
// ====================================================
router.post("/", requireUnlockedAccount, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can create food orders" });
    }

    const {
      restaurantId,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      items,
      serviceFare,
      paymentMethod,
    } = req.body;

    // Validation
    if (!restaurantId || !deliveryAddress || !deliveryLat || !deliveryLng || !items || !serviceFare || !paymentMethod) {
      return res.status(400).json({ error: "All order details are required" });
    }

    if (!["cash", "online"].includes(paymentMethod)) {
      return res.status(400).json({ error: "paymentMethod must be 'cash' or 'online'" });
    }

    // Get customer profile
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    if (!customerProfile.isVerified) {
      return res.status(403).json({ error: "Customer must be verified to order food" });
    }

    // Verify restaurant exists and is verified
    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id: restaurantId },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    if (!restaurant.isVerified) {
      return res.status(403).json({ error: "Restaurant is not verified" });
    }

    // Stock validation - check if all items have sufficient stock
    const orderItems = Array.isArray(items) ? items : JSON.parse(items);
    const menuItemIds = orderItems.map((item: { menuItemId: string }) => item.menuItemId);
    
    const menuItems = await prisma.menuItem.findMany({
      where: { 
        id: { in: menuItemIds },
        restaurantId,
      },
      select: {
        id: true,
        name: true,
        stockTrackingEnabled: true,
        stockQuantity: true,
        availabilityStatus: true,
      },
    });

    // Create a map for quick lookup
    const menuItemMap = new Map(menuItems.map(item => [item.id, item]));

    // Check stock for each item
    const outOfStockItems: string[] = [];
    const insufficientStockItems: { name: string; available: number; requested: number }[] = [];

    for (const orderItem of orderItems) {
      const menuItem = menuItemMap.get(orderItem.menuItemId);
      
      if (!menuItem) {
        return res.status(400).json({ 
          error: `Menu item not found: ${orderItem.menuItemId}` 
        });
      }

      // Check if item is unavailable
      if (menuItem.availabilityStatus !== "available") {
        outOfStockItems.push(menuItem.name);
        continue;
      }

      // Check stock if tracking is enabled
      if (menuItem.stockTrackingEnabled && menuItem.stockQuantity !== null) {
        const requestedQty = orderItem.quantity || 1;
        if (menuItem.stockQuantity < requestedQty) {
          if (menuItem.stockQuantity === 0) {
            outOfStockItems.push(menuItem.name);
          } else {
            insufficientStockItems.push({
              name: menuItem.name,
              available: menuItem.stockQuantity,
              requested: requestedQty,
            });
          }
        }
      }
    }

    // Return stock errors if any
    if (outOfStockItems.length > 0 || insufficientStockItems.length > 0) {
      const errorMessages: string[] = [];
      
      if (outOfStockItems.length > 0) {
        errorMessages.push(`Out of stock: ${outOfStockItems.join(", ")}`);
      }
      
      if (insufficientStockItems.length > 0) {
        const insufficientMsgs = insufficientStockItems.map(
          item => `${item.name} (only ${item.available} available, requested ${item.requested})`
        );
        errorMessages.push(`Insufficient stock: ${insufficientMsgs.join(", ")}`);
      }

      return res.status(400).json({
        error: "STOCK_ERROR",
        message: errorMessages.join(". "),
        outOfStockItems,
        insufficientStockItems,
      });
    }

    // Calculate commission (15% for restaurant, 5% for driver delivery = 20% total)
    // Total fare = 100%
    // SafeGo commission = 20% (15% from restaurant + 5% from delivery)
    // Restaurant gets = 80% of fare minus delivery fee (5%)
    // Driver delivery fee = 5% of fare
    const fare = parseFloat(serviceFare);
    const totalCommissionRate = 0.20; // 20% total to SafeGo
    const restaurantCommissionRate = 0.15; // 15% from restaurant
    const deliveryFeeRate = 0.05; // 5% delivery fee
    
    const safegoCommission = fare * totalCommissionRate; // $20 on $100
    const deliveryPayout = fare * deliveryFeeRate; // $5 on $100
    const restaurantPayout = fare - safegoCommission - deliveryPayout; // $75 on $100 ($100 - $20 - $5)

    // Use transaction to ensure atomic order creation and stock decrement
    const orderId = crypto.randomUUID();
    const stockConflicts: string[] = [];
    
    const foodOrder = await prisma.$transaction(async (tx) => {
      // Atomically decrement stock with WHERE guard to prevent overselling
      for (const orderItem of orderItems) {
        const menuItem = menuItemMap.get(orderItem.menuItemId);
        if (menuItem?.stockTrackingEnabled && menuItem.stockQuantity !== null) {
          const requestedQty = orderItem.quantity || 1;
          
          // Atomic update with WHERE guard: only updates if stock >= requested
          const updateResult = await tx.menuItem.updateMany({
            where: { 
              id: orderItem.menuItemId,
              stockTrackingEnabled: true,
              stockQuantity: { gte: requestedQty },
            },
            data: {
              stockQuantity: {
                decrement: requestedQty,
              },
            },
          });
          
          // If no rows updated, stock was insufficient
          if (updateResult.count === 0) {
            stockConflicts.push(menuItem.name || orderItem.menuItemId);
          }
        }
      }
      
      // If any stock conflicts, throw to rollback transaction
      if (stockConflicts.length > 0) {
        throw new Error(`STOCK_CONFLICT:${stockConflicts.join(", ")}`);
      }

      // Create food order
      const newOrder = await tx.foodOrder.create({
        data: {
          id: orderId,
          customerId: customerProfile.id,
          restaurantId,
          deliveryAddress,
          deliveryLat: parseFloat(deliveryLat.toString()),
          deliveryLng: parseFloat(deliveryLng.toString()),
          items: JSON.stringify(orderItems),
          serviceFare: parseFloat(serviceFare),
          safegoCommission,
          restaurantPayout,
          driverPayout: deliveryPayout,
          deliveryPayout,
          paymentMethod,
          status: "placed",
          updatedAt: new Date(),
        },
      });

      return newOrder;
    });

    // R6: Create earnings transaction for commission tracking
    // NOTE: If this fails, the entire request fails to prevent order creation without earnings record
    await createEarningsTransaction({
      orderId: foodOrder.id,
      restaurantId,
      serviceFare: foodOrder.serviceFare,
      orderStatus: foodOrder.status,
      countryCode: restaurant.countryCode || 'US',
      currency: restaurant.countryCode === 'BD' ? 'BDT' : 'USD',
      isDemo: restaurant.isDemo || false,
    });

    // Notify restaurant
    const restaurantUser = await prisma.user.findFirst({
      where: { restaurantProfile: { id: restaurantId } },
    });

    if (restaurantUser) {
      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: restaurantUser.id,
          type: "food_order_update",
          title: "New Food Order",
          body: `You have received a new food order.`,
        },
      });
    }

    // Notify customer that order was placed successfully
    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId: userId,
        type: "food_order_update",
        title: "Order Placed Successfully",
        body: `Your order from ${restaurant.restaurantName || "the restaurant"} has been placed! We'll notify you when it's accepted.`,
      },
    });

    res.status(201).json({
      message: "Food order created successfully",
      order: {
        id: foodOrder.id,
        restaurantId: foodOrder.restaurantId,
        deliveryAddress: foodOrder.deliveryAddress,
        items: foodOrder.items ? JSON.parse(foodOrder.items) : [],
        serviceFare: foodOrder.serviceFare,
        paymentMethod: foodOrder.paymentMethod,
        status: foodOrder.status,
        createdAt: foodOrder.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Create food order error:", error);
    
    // Handle stock conflict errors with proper 409 status
    if (error.message?.startsWith("STOCK_CONFLICT:")) {
      const conflictItems = error.message.replace("STOCK_CONFLICT:", "");
      return res.status(409).json({
        error: "STOCK_CONFLICT",
        message: `Stock changed during order placement. Items affected: ${conflictItems}. Please refresh and try again.`,
        conflictItems: conflictItems.split(", "),
      });
    }
    
    res.status(500).json({ error: "Failed to create food order" });
  }
});

// ====================================================
// POST /api/food-orders/:id/cancel
// Cancel a food order with automatic refund
// Customer can only cancel before food is picked up
// Uses transaction for atomicity and prevents double refunds
// ====================================================
router.post("/:id/cancel", requireUnlockedAccount, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { reason } = req.body;

    // Only customers can cancel through this endpoint
    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can cancel orders through this endpoint" });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // First, find the order to check ownership and get details for refund calculation
    const foodOrder = await prisma.foodOrder.findUnique({
      where: { id },
      include: { restaurant: true },
    });

    if (!foodOrder) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Verify ownership
    if (foodOrder.customerId !== customerProfile.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Check if order can be cancelled
    const cancellableStatuses = ["placed", "accepted", "preparing"];
    if (!cancellableStatuses.includes(foodOrder.status)) {
      return res.status(400).json({ 
        error: "ORDER_NOT_CANCELLABLE",
        message: "This order cannot be cancelled. Orders can only be cancelled before food preparation is complete.",
        currentStatus: foodOrder.status,
      });
    }

    // Calculate refund amount based on order status
    let refundPercentage = 100;
    let refundReason = "Customer requested cancellation";

    if (foodOrder.status === "preparing") {
      refundPercentage = 80;
      refundReason = "Partial refund - order was already being prepared";
    }

    const refundAmount = (Number(foodOrder.serviceFare) * refundPercentage) / 100;

    // Use transaction with conditional update to prevent double cancellation
    const result = await prisma.$transaction(async (tx) => {
      // Atomic conditional update: only updates if status is still cancellable
      // This prevents double cancellation from concurrent requests
      const updateResult = await tx.foodOrder.updateMany({
        where: { 
          id,
          customerId: customerProfile.id,
          status: { in: cancellableStatuses },
        },
        data: {
          status: "cancelled",
          cancelledAt: new Date(),
          whoCancelled: "customer",
          cancellationReason: reason || "Customer cancelled order",
          refundStatus: foodOrder.paymentMethod === "online" ? "pending" : "not_applicable",
          refundAmount,
          refundReason: foodOrder.paymentMethod === "online" ? refundReason : "Cash order - no refund needed",
          updatedAt: new Date(),
        },
      });
      
      // If no rows updated, order was already cancelled by concurrent request
      if (updateResult.count === 0) {
        throw new Error("ALREADY_CANCELLED");
      }

      // Restore stock for cancelled items - only for items that have stock tracking
      const orderItems = foodOrder.items ? JSON.parse(foodOrder.items) : [];
      for (const item of orderItems) {
        if (item.menuItemId && (item.quantity || 1) > 0) {
          await tx.menuItem.updateMany({
            where: { 
              id: item.menuItemId,
              stockTrackingEnabled: true,
              stockQuantity: { not: null },
            },
            data: {
              stockQuantity: {
                increment: item.quantity || 1,
              },
            },
          });
        }
      }

      // Fetch the updated order for response
      const updatedOrder = await tx.foodOrder.findUnique({
        where: { id },
      });

      return {
        updatedOrder,
        refundAmount,
        refundPercentage,
        paymentMethod: foodOrder.paymentMethod,
        restaurantId: foodOrder.restaurantId,
      };
    });

    // Process wallet refund outside transaction if payment was online
    // Note: This code only executes if transaction succeeded (ALREADY_CANCELLED throws to catch block)
    if (result.paymentMethod === "online" && result.updatedOrder?.refundStatus === "pending") {
      try {
        // Atomically update refund status to "processing" to prevent double refund
        const refundGuard = await prisma.foodOrder.updateMany({
          where: { 
            id, 
            refundStatus: "pending",
          },
          data: {
            refundStatus: "processing",
          },
        });
        
        // Only process refund if we successfully claimed the pending status
        if (refundGuard.count === 1) {
          await walletService.processRefund(
            customerProfile.id,
            result.refundAmount,
            `Refund for cancelled order #${id.slice(-8)}`,
            id
          );

          await prisma.foodOrder.update({
            where: { id },
            data: {
              refundStatus: "completed",
              refundedAt: new Date(),
            },
          });
        }
      } catch (refundError) {
        console.error("Refund processing error:", refundError);
        // Revert to pending for manual processing
        await prisma.foodOrder.update({
          where: { id },
          data: {
            refundStatus: "pending",
          },
        }).catch(() => {}); // Ignore if this fails
      }
    }

    // Notify restaurant about cancellation
    const restaurantUser = await prisma.user.findFirst({
      where: { restaurantProfile: { id: result.restaurantId } },
    });

    if (restaurantUser) {
      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: restaurantUser.id,
          type: "food_order_update",
          title: "Order Cancelled",
          body: `Order #${id.slice(-8)} has been cancelled by the customer.${reason ? ` Reason: ${reason}` : ""}`,
        },
      });
    }

    // Notify customer
    await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        type: "food_order_update",
        title: "Order Cancelled",
        body: result.refundPercentage === 100 
          ? `Your order has been cancelled. A full refund of $${result.refundAmount.toFixed(2)} will be processed.`
          : `Your order has been cancelled. A ${result.refundPercentage}% refund of $${result.refundAmount.toFixed(2)} will be processed.`,
      },
    });

    res.json({
      message: "Order cancelled successfully",
      order: {
        id: result.updatedOrder.id,
        status: result.updatedOrder.status,
        cancelledAt: result.updatedOrder.cancelledAt,
        refundStatus: result.updatedOrder.refundStatus,
        refundAmount: result.refundAmount,
        refundPercentage: result.refundPercentage,
      },
    });
  } catch (error: any) {
    console.error("Cancel food order error:", error);
    
    // Handle double-cancellation attempt (concurrent request already cancelled)
    if (error.message === "ALREADY_CANCELLED") {
      return res.status(409).json({ 
        error: "ALREADY_CANCELLED",
        message: "This order has already been cancelled.",
      });
    }
    
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

// ====================================================
// GET /api/food-orders/:id
// Get food order details
// ====================================================
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const foodOrder = await prisma.foodOrder.findUnique({
      where: { id },
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
        restaurant: {
          include: {
            user: {
              select: {
                email: true,
              },
            },
          },
        },
        driver: {
          include: {
            user: {
              select: {
                email: true,
              },
            },
            vehicles: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!foodOrder) {
      return res.status(404).json({ error: "Food order not found" });
    }

    // Authorization check
    if (role === "customer") {
      const customerProfile = await prisma.customerProfile.findUnique({ where: { userId } });
      if (foodOrder.customerId !== customerProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role === "restaurant") {
      const restaurantProfile = await prisma.restaurantProfile.findUnique({ where: { userId } });
      if (foodOrder.restaurantId !== restaurantProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role === "driver") {
      const driverProfile = await prisma.driverProfile.findUnique({ where: { userId } });
      if (foodOrder.driverId !== driverProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({
      order: {
        id: foodOrder.id,
        customer: {
          email: foodOrder.customer.user.email,
        },
        restaurant: {
          email: foodOrder.restaurant.user.email,
          name: foodOrder.restaurant.restaurantName,
          address: foodOrder.restaurant.address,
        },
        driver: foodOrder.driver ? {
          id: foodOrder.driver.id, // driver_profile_id for public profile lookup
          email: foodOrder.driver.user.email,
          vehicle: foodOrder.driver.vehicles[0] || null,
        } : null,
        deliveryAddress: foodOrder.deliveryAddress,
        deliveryLat: foodOrder.deliveryLat,
        deliveryLng: foodOrder.deliveryLng,
        items: foodOrder.items ? JSON.parse(foodOrder.items) : [],
        serviceFare: foodOrder.serviceFare,
        safegoCommission: foodOrder.safegoCommission,
        restaurantPayout: foodOrder.restaurantPayout,
        deliveryPayout: foodOrder.deliveryPayout,
        paymentMethod: foodOrder.paymentMethod,
        status: foodOrder.status,
        customerRating: foodOrder.customerRating,
        customerFeedback: foodOrder.customerFeedback,
        restaurantRating: foodOrder.restaurantRating,
        restaurantFeedback: foodOrder.restaurantFeedback,
        createdAt: foodOrder.createdAt,
        completedAt: foodOrder.completedAt,
      },
    });
  } catch (error) {
    console.error("Get food order error:", error);
    res.status(500).json({ error: "Failed to fetch food order details" });
  }
});

// ====================================================
// PATCH /api/food-orders/:id/accept
// Restaurant accepts order
// ====================================================
router.patch("/:id/accept", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "restaurant") {
      return res.status(403).json({ error: "Only restaurants can accept food orders" });
    }

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (!restaurantProfile) {
      return res.status(404).json({ error: "Restaurant profile not found" });
    }

    if (!restaurantProfile.isVerified) {
      return res.status(403).json({ error: "Restaurant must be verified to accept orders" });
    }

    // Get food order
    const foodOrder = await prisma.foodOrder.findUnique({ where: { id } });

    if (!foodOrder) {
      return res.status(404).json({ error: "Food order not found" });
    }

    if (foodOrder.restaurantId !== restaurantProfile.id) {
      return res.status(403).json({ error: "This order is not for your restaurant" });
    }

    if (foodOrder.status !== "placed") {
      return res.status(400).json({ error: "Order cannot be accepted in current status" });
    }

    // Accept order
    const updatedOrder = await prisma.foodOrder.update({
      where: { id },
      data: { status: "accepted" },
    });

    // Notify customer
    const customerUser = await prisma.user.findFirst({
      where: { customerProfile: { id: foodOrder.customerId } },
    });

    if (customerUser) {
      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: customerUser.id,
          type: "food_order_update",
          title: "Order Accepted",
          body: `Restaurant has accepted your order and is preparing your food.`,
        },
      });
    }

    res.json({
      message: "Order accepted successfully",
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
      },
    });
  } catch (error) {
    console.error("Accept food order error:", error);
    res.status(500).json({ error: "Failed to accept food order" });
  }
});

// ====================================================
// PATCH /api/food-orders/:id/assign-driver
// Assign driver to food order
// ====================================================
router.patch("/:id/assign-driver", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "driver") {
      return res.status(403).json({ error: "Only drivers can accept delivery assignments" });
    }

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: { 
        vehicles: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!driverProfile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    if (!driverProfile.isVerified) {
      return res.status(403).json({ error: "Driver must be verified to accept deliveries" });
    }

    const activeVehicle = driverProfile.vehicles[0];
    if (!activeVehicle || !activeVehicle.isOnline) {
      return res.status(403).json({ error: "Driver must be online to accept deliveries" });
    }

    // Get food order
    const foodOrder = await prisma.foodOrder.findUnique({ where: { id } });

    if (!foodOrder) {
      return res.status(404).json({ error: "Food order not found" });
    }

    if (foodOrder.status !== "ready_for_pickup") {
      return res.status(400).json({ error: "Order must be ready for pickup to assign driver" });
    }

    if (foodOrder.driverId) {
      return res.status(400).json({ error: "Order already has a driver assigned" });
    }

    // Assign driver
    const updatedOrder = await prisma.foodOrder.update({
      where: { id },
      data: {
        driverId: driverProfile.id,
        status: "picked_up",
      },
    });

    // Notify customer
    const customerUser = await prisma.user.findFirst({
      where: { customerProfile: { id: foodOrder.customerId } },
    });

    if (customerUser) {
      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: customerUser.id,
          type: "food_order_update",
          title: "Driver Assigned",
          body: `Your order has been picked up and is on the way!`,
        },
      });
    }

    res.json({
      message: "Driver assigned successfully",
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
      },
    });
  } catch (error) {
    console.error("Assign driver error:", error);
    res.status(500).json({ error: "Failed to assign driver" });
  }
});

// ====================================================
// PATCH /api/food-orders/:id/status
// Update food order status
// ====================================================
router.patch("/:id/status", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const validStatuses = ["placed", "accepted", "preparing", "ready_for_pickup", "picked_up", "on_the_way", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const foodOrder = await prisma.foodOrder.findUnique({ where: { id } });

    if (!foodOrder) {
      return res.status(404).json({ error: "Food order not found" });
    }

    // Authorization check
    if (role === "restaurant") {
      const restaurantProfile = await prisma.restaurantProfile.findUnique({ where: { userId } });
      if (foodOrder.restaurantId !== restaurantProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role === "driver") {
      const driverProfile = await prisma.driverProfile.findUnique({ where: { userId } });
      if (foodOrder.driverId !== driverProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    // Update order status
    const updatedOrder = await prisma.foodOrder.update({
      where: { id },
      data: { status },
    });

    // R6: Update earnings transaction status when order status changes
    // NOTE: If this fails (e.g., wallet reversal fails), the entire request fails
    // to prevent order status and ledgers from diverging
    await updateEarningsTransactionStatus(id, status);

    // Create notification with status-specific messages
    const customerUser = await prisma.user.findFirst({
      where: { customerProfile: { id: foodOrder.customerId } },
    });

    if (customerUser) {
      const notificationMessages: Record<string, { title: string; body: string }> = {
        accepted: {
          title: "Order Accepted",
          body: "Great news! The restaurant has accepted your order and is getting it ready.",
        },
        preparing: {
          title: "Order Being Prepared",
          body: "Your food is now being prepared by the kitchen. We'll notify you when it's ready!",
        },
        ready_for_pickup: {
          title: "Order Ready for Pickup",
          body: "Your order is ready and waiting for a delivery driver. Almost there!",
        },
        picked_up: {
          title: "Driver Has Your Order",
          body: "Your food has been picked up and is on its way to you!",
        },
        on_the_way: {
          title: "Almost There!",
          body: "Your driver is approaching your delivery location. Get ready!",
        },
        delivered: {
          title: "Order Delivered",
          body: "Your food has been delivered. Enjoy your meal! Don't forget to rate your experience.",
        },
        cancelled: {
          title: "Order Cancelled",
          body: "Your food order has been cancelled. If you didn't request this, please contact support.",
        },
      };

      const message = notificationMessages[status] || {
        title: "Order Update",
        body: `Your food order status is now: ${status}`,
      };

      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: customerUser.id,
          type: "food_order_update",
          title: message.title,
          body: message.body,
        },
      });
    }

    res.json({
      message: "Food order status updated successfully",
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
      },
    });
  } catch (error) {
    console.error("Update food order status error:", error);
    res.status(500).json({ error: "Failed to update food order status" });
  }
});

// ====================================================
// POST /api/food-orders/:id/complete
// Complete food order with ratings and apply commission
// ====================================================
router.post("/:id/complete", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { rating, feedback } = req.body;
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const foodOrder = await prisma.foodOrder.findUnique({ where: { id } });

    if (!foodOrder) {
      return res.status(404).json({ error: "Food order not found" });
    }

    if (foodOrder.status !== "delivered") {
      return res.status(400).json({ error: "Food order must be delivered to complete" });
    }

    // Determine who is completing (customer or restaurant)
    let updateData: any = {};

    if (role === "customer") {
      const customerProfile = await prisma.customerProfile.findUnique({ where: { userId } });
      if (foodOrder.customerId !== customerProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      updateData.customerRating = rating;
      updateData.customerFeedback = feedback || null;
    } else if (role === "restaurant") {
      const restaurantProfile = await prisma.restaurantProfile.findUnique({ where: { userId } });
      if (foodOrder.restaurantId !== restaurantProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      updateData.restaurantRating = rating;
      updateData.restaurantFeedback = feedback || null;
    } else {
      return res.status(403).json({ error: "Only customer or restaurant can complete order" });
    }

    // If both have rated, mark as completed and apply commission logic
    if ((role === "customer" && foodOrder.restaurantRating) || (role === "restaurant" && foodOrder.customerRating)) {
      updateData.status = "completed";
      updateData.completedAt = new Date();

      // Record food order earning in restaurant wallet with full transaction logging
      await walletService.recordFoodOrderEarning(
        foodOrder.restaurantId,
        {
          id: foodOrder.id,
          serviceFare: foodOrder.serviceFare,
          restaurantPayout: foodOrder.restaurantPayout,
          safegoCommission: foodOrder.safegoCommission,
          paymentMethod: foodOrder.paymentMethod as "cash" | "online",
          deliveryAddress: foodOrder.deliveryAddress,
        }
      );

      // Apply commission logic for driver (if assigned)
      if (foodOrder.driverId) {
        const driver = await prisma.driverProfile.findUnique({
          where: { id: foodOrder.driverId },
          include: { 
            driverWallet: true, 
            vehicles: {
              where: { isActive: true },
              take: 1,
            },
          },
        });

        if (driver) {
          const activeVehicle = driver.vehicles[0];
          
          // Update vehicle earnings if we have an active vehicle
          if (activeVehicle && foodOrder.deliveryPayout) {
            await prisma.vehicle.update({
              where: { id: activeVehicle.id },
              data: {
                totalEarnings: { increment: parseFloat(foodOrder.deliveryPayout.toString()) },
              },
            });
          }

          // Record food delivery earning in driver wallet
          await walletService.recordFoodDeliveryEarning(
            foodOrder.driverId!,
            {
              id: foodOrder.id,
              deliveryPayout: foodOrder.deliveryPayout,
              paymentMethod: foodOrder.paymentMethod as "cash" | "online",
              deliveryAddress: foodOrder.deliveryAddress,
            }
          );

          // Evaluate and apply promotion bonuses for driver (D5)
          // Note: evaluateDriverBonuses is handled separately in the promotion bonus engine
          // and evaluates based on completed trips
        }
      }
    }

    // Update order
    const updatedOrder = await prisma.foodOrder.update({
      where: { id },
      data: updateData,
    });

    res.json({
      message: updateData.status === "completed" ? "Food order completed successfully" : "Rating submitted successfully",
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        customerRating: updatedOrder.customerRating,
        restaurantRating: updatedOrder.restaurantRating,
        completedAt: updatedOrder.completedAt,
      },
    });
  } catch (error) {
    console.error("Complete food order error:", error);
    res.status(500).json({ error: "Failed to complete food order" });
  }
});

// ====================================================
// GET /api/food-orders/:id/live-tracking
// Get live tracking data for food order (customer only)
// ====================================================
router.get("/:id/live-tracking", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const foodOrder = await prisma.foodOrder.findUnique({
      where: { id },
      include: {
        restaurant: {
          include: {
            branding: true,
          },
        },
        driver: {
          include: {
            vehicles: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
        customer: true,
      },
    });

    if (!foodOrder) {
      return res.status(404).json({ error: "Food order not found" });
    }

    // Authorization: Only customer who placed order, assigned driver, restaurant, or admin can view
    if (role === "customer") {
      const customerProfile = await prisma.customerProfile.findUnique({ where: { userId } });
      if (foodOrder.customerId !== customerProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role === "driver") {
      const driverProfile = await prisma.driverProfile.findUnique({ where: { userId } });
      if (foodOrder.driverId !== driverProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role === "restaurant") {
      const restaurantProfile = await prisma.restaurantProfile.findUnique({ where: { userId } });
      if (foodOrder.restaurantId !== restaurantProfile?.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get restaurant coordinates from branding or pickup address
    const restaurantLat = foodOrder.pickupLat || null;
    const restaurantLng = foodOrder.pickupLng || null;

    // Calculate ETAs based on status and driver location
    let etaToRestaurantSeconds: number | null = null;
    let etaToCustomerSeconds: number | null = null;
    let distanceToRestaurantMeters: number | null = null;
    let distanceToCustomerMeters: number | null = null;

    const driverLat = foodOrder.driver?.currentLat;
    const driverLng = foodOrder.driver?.currentLng;
    const customerLat = foodOrder.deliveryLat;
    const customerLng = foodOrder.deliveryLng;

    if (driverLat && driverLng) {
      const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      if (restaurantLat && restaurantLng) {
        distanceToRestaurantMeters = calculateDistance(driverLat, driverLng, restaurantLat, restaurantLng);
        etaToRestaurantSeconds = Math.ceil((distanceToRestaurantMeters / 1000) * 120);
      }

      if (customerLat && customerLng) {
        distanceToCustomerMeters = calculateDistance(driverLat, driverLng, customerLat, customerLng);
        etaToCustomerSeconds = Math.ceil((distanceToCustomerMeters / 1000) * 120);
      }
    }

    let items: any[] = [];
    try {
      if (foodOrder.items) {
        items = typeof foodOrder.items === "string" ? JSON.parse(foodOrder.items) : foodOrder.items;
      }
    } catch {
      items = [];
    }

    const activeVehicle = foodOrder.driver?.vehicles?.[0] || null;

    const trackingData = {
      orderId: foodOrder.id,
      orderCode: foodOrder.orderCode,
      status: foodOrder.status,
      isActive: !["delivered", "cancelled"].includes(foodOrder.status),

      restaurant: {
        id: foodOrder.restaurant.id,
        name: foodOrder.restaurant.restaurantName,
        address: foodOrder.restaurant.address,
        cuisineType: foodOrder.restaurant.cuisineType,
        logoUrl: foodOrder.restaurant.branding?.logoUrl || null,
        location: restaurantLat && restaurantLng ? { lat: restaurantLat, lng: restaurantLng } : null,
      },

      deliveryLocation: {
        address: foodOrder.deliveryAddress,
        lat: foodOrder.deliveryLat,
        lng: foodOrder.deliveryLng,
      },

      driver: foodOrder.driver ? {
        id: foodOrder.driver.id,
        firstName: foodOrder.driver.firstName,
        lastName: foodOrder.driver.lastName,
        rating: 4.9, // Default rating for food delivery drivers
        photoUrl: foodOrder.driver.profilePhotoUrl,
        vehicle: activeVehicle ? {
          make: activeVehicle.make || activeVehicle.vehicleModel,
          model: activeVehicle.vehicleModel,
          color: activeVehicle.color || "N/A",
          plate: activeVehicle.licensePlate || activeVehicle.vehiclePlate,
        } : null,
      } : null,

      driverLocation: foodOrder.driver ? {
        lat: foodOrder.driver.currentLat,
        lng: foodOrder.driver.currentLng,
        headingDeg: null,
        speedMps: null,
        updatedAt: null,
      } : null,

      // ETAs
      etaToRestaurantSeconds,
      etaToCustomerSeconds,
      distanceToRestaurantMeters,
      distanceToCustomerMeters,

      // Order details
      items,
      itemsCount: foodOrder.itemsCount,
      subtotal: foodOrder.subtotal?.toString(),
      deliveryFee: foodOrder.deliveryFee?.toString(),
      serviceFare: foodOrder.serviceFare.toString(),
      paymentMethod: foodOrder.paymentMethod,

      // Timestamps
      timestamps: {
        placedAt: foodOrder.createdAt.toISOString(),
        acceptedAt: foodOrder.acceptedAt?.toISOString() || null,
        preparingAt: foodOrder.preparingAt?.toISOString() || null,
        readyAt: foodOrder.readyAt?.toISOString() || null,
        pickedUpAt: foodOrder.pickedUpAt?.toISOString() || null,
        deliveredAt: foodOrder.deliveredAt?.toISOString() || null,
        cancelledAt: foodOrder.cancelledAt?.toISOString() || null,
      },

      // Cancellation info
      cancellation: foodOrder.status === "cancelled" ? {
        cancelledBy: foodOrder.whoCancelled,
        reason: foodOrder.cancellationReason,
      } : null,
    };

    res.json(trackingData);
  } catch (error) {
    console.error("Get food order live tracking error:", error);
    res.status(500).json({ error: "Failed to get tracking data" });
  }
});

// ====================================================
// GET /api/food-orders/active
// Get customer's active food orders (customer only)
// ====================================================
router.get("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { active } = req.query;

    if (role !== "customer") {
      return res.status(403).json({ error: "Access denied" });
    }

    const customerProfile = await prisma.customerProfile.findUnique({ where: { userId } });
    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const whereClause: any = { customerId: customerProfile.id };
    
    if (active === "true") {
      whereClause.status = {
        notIn: ["delivered", "cancelled"],
      };
    }

    const orders = await prisma.foodOrder.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        restaurant: {
          include: {
            branding: true,
          },
        },
      },
      take: active === "true" ? 10 : 50,
    });

    const formattedOrders = orders.map((order) => {
      let items: any[] = [];
      try {
        if (order.items) {
          items = typeof order.items === "string" ? JSON.parse(order.items) : order.items;
        }
      } catch {
        items = [];
      }

      return {
        id: order.id,
        orderCode: order.orderCode,
        status: order.status,
        restaurantName: order.restaurant.restaurantName,
        restaurantLogo: order.restaurant.branding?.logoUrl || null,
        items,
        itemsCount: order.itemsCount,
        serviceFare: order.serviceFare.toString(),
        deliveryAddress: order.deliveryAddress,
        createdAt: order.createdAt.toISOString(),
        isActive: !["delivered", "cancelled"].includes(order.status),
      };
    });

    res.json({ orders: formattedOrders });
  } catch (error) {
    console.error("Get food orders error:", error);
    res.status(500).json({ error: "Failed to get food orders" });
  }
});

export default router;
