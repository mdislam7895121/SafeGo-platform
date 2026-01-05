import { Response, NextFunction } from "express";
import { prisma } from "../db";
import { AuthRequest } from "./auth";

export async function requireTripOwnership(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const tripId = req.params.tripId || req.params.id || req.body?.tripId;
  
  if (!tripId) {
    res.status(400).json({ error: "Trip ID required" });
    return;
  }

  try {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { 
        driverId: true, 
        customerId: true,
        status: true 
      },
    });

    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }

    const isDriver = trip.driverId === userId;
    const isCustomer = trip.customerId === userId;
    const isAdmin = userRole === "admin";

    if (!isDriver && !isCustomer && !isAdmin) {
      console.warn(`[OwnershipCheck] Access denied: User ${userId} attempted to access trip ${tripId}`);
      res.status(403).json({ error: "Access denied. You do not own this trip." });
      return;
    }

    (req as any).trip = trip;
    (req as any).isOwner = isDriver;
    (req as any).isCustomer = isCustomer;
    
    next();
  } catch (error) {
    console.error("[OwnershipCheck] Error checking trip ownership:", error);
    res.status(500).json({ error: "Failed to verify trip ownership" });
  }
}

export async function requireDriverTripOwnership(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (userRole !== "driver" && userRole !== "admin") {
    res.status(403).json({ error: "Driver access required" });
    return;
  }

  const tripId = req.params.tripId || req.params.id || req.body?.tripId;
  
  if (!tripId) {
    res.status(400).json({ error: "Trip ID required" });
    return;
  }

  try {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { driverId: true, status: true },
    });

    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }

    if (trip.driverId !== userId && userRole !== "admin") {
      console.warn(`[OwnershipCheck] Driver ${userId} attempted to access trip ${tripId} owned by ${trip.driverId}`);
      res.status(403).json({ error: "Access denied. This trip is not assigned to you." });
      return;
    }

    (req as any).trip = trip;
    next();
  } catch (error) {
    console.error("[OwnershipCheck] Error checking driver trip ownership:", error);
    res.status(500).json({ error: "Failed to verify trip ownership" });
  }
}

export async function requireChatOwnership(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const tripId = req.params.tripId || req.body?.tripId;
  
  if (!tripId) {
    res.status(400).json({ error: "Trip ID required for chat access" });
    return;
  }

  try {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { driverId: true, customerId: true },
    });

    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }

    const isParticipant = trip.driverId === userId || trip.customerId === userId;
    const isAdmin = userRole === "admin" || userRole === "support_admin";

    if (!isParticipant && !isAdmin) {
      console.warn(`[OwnershipCheck] User ${userId} attempted chat access for trip ${tripId}`);
      res.status(403).json({ error: "Access denied. You are not a participant in this trip." });
      return;
    }

    (req as any).chatTrip = trip;
    next();
  } catch (error) {
    console.error("[OwnershipCheck] Error checking chat ownership:", error);
    res.status(500).json({ error: "Failed to verify chat access" });
  }
}

export async function requireStripeAccountOwnership(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (userRole === "admin") {
    next();
    return;
  }

  const accountId = req.params.accountId || req.body?.stripeAccountId;

  if (!accountId) {
    next();
    return;
  }

  try {
    const account = await prisma.stripeConnectAccount.findUnique({
      where: { stripeAccountId: accountId },
      select: { userId: true },
    });

    if (!account) {
      res.status(404).json({ error: "Stripe account not found" });
      return;
    }

    if (account.userId !== userId) {
      console.warn(`[OwnershipCheck] User ${userId} attempted to access Stripe account owned by ${account.userId}`);
      res.status(403).json({ error: "Access denied. This is not your payout account." });
      return;
    }

    next();
  } catch (error) {
    console.error("[OwnershipCheck] Error checking Stripe account ownership:", error);
    res.status(500).json({ error: "Failed to verify account ownership" });
  }
}

export async function requireFoodOrderOwnership(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const orderId = req.params.orderId || req.params.id || req.body?.orderId;
  
  if (!orderId) {
    res.status(400).json({ error: "Order ID required" });
    return;
  }

  try {
    const order = await prisma.foodOrder.findUnique({
      where: { id: orderId },
      select: { 
        customerId: true, 
        driverId: true,
        restaurantId: true,
        status: true 
      },
    });

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const isCustomer = order.customerId === userId;
    const isDriver = order.driverId === userId;
    const isAdmin = userRole === "admin" || userRole === "support_admin";
    
    let isRestaurantOwner = false;
    if (userRole === "restaurant" && order.restaurantId) {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: order.restaurantId },
        select: { ownerId: true },
      });
      isRestaurantOwner = restaurant?.ownerId === userId;
    }

    if (!isCustomer && !isDriver && !isRestaurantOwner && !isAdmin) {
      console.warn(`[OwnershipCheck] User ${userId} attempted to access order ${orderId}`);
      res.status(403).json({ error: "Access denied. You do not have access to this order." });
      return;
    }

    (req as any).foodOrder = order;
    next();
  } catch (error) {
    console.error("[OwnershipCheck] Error checking food order ownership:", error);
    res.status(500).json({ error: "Failed to verify order ownership" });
  }
}
