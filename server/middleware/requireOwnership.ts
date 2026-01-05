import { Response, NextFunction } from "express";
import { prisma } from "../db";
import { AuthRequest } from "./auth";

export async function requireRideOwnership(
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

  const rideId = req.params.rideId || req.params.id || req.body?.rideId;
  
  if (!rideId) {
    res.status(400).json({ error: "Ride ID required" });
    return;
  }

  try {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: { 
        driverId: true, 
        customerId: true,
        status: true 
      },
    });

    if (!ride) {
      res.status(404).json({ error: "Ride not found" });
      return;
    }

    const isDriver = ride.driverId === userId;
    const isCustomer = ride.customerId === userId;
    const isAdmin = userRole === "admin";

    if (!isDriver && !isCustomer && !isAdmin) {
      console.warn(`[OwnershipCheck] Access denied: User ${userId} attempted to access ride ${rideId}`);
      res.status(403).json({ error: "Access denied. You do not own this ride." });
      return;
    }

    (req as any).ride = ride;
    (req as any).isOwner = isDriver;
    (req as any).isCustomer = isCustomer;
    
    next();
  } catch (error) {
    console.error("[OwnershipCheck] Error checking ride ownership:", error);
    res.status(500).json({ error: "Failed to verify ride ownership" });
  }
}

export async function requireDriverRideOwnership(
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

  const rideId = req.params.rideId || req.params.id || req.body?.rideId;
  
  if (!rideId) {
    res.status(400).json({ error: "Ride ID required" });
    return;
  }

  try {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: { driverId: true, status: true },
    });

    if (!ride) {
      res.status(404).json({ error: "Ride not found" });
      return;
    }

    if (ride.driverId !== userId && userRole !== "admin") {
      console.warn(`[OwnershipCheck] Driver ${userId} attempted to access ride ${rideId} owned by ${ride.driverId}`);
      res.status(403).json({ error: "Access denied. This ride is not assigned to you." });
      return;
    }

    (req as any).ride = ride;
    next();
  } catch (error) {
    console.error("[OwnershipCheck] Error checking driver ride ownership:", error);
    res.status(500).json({ error: "Failed to verify ride ownership" });
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

  const rideId = req.params.rideId || req.body?.rideId;
  
  if (!rideId) {
    res.status(400).json({ error: "Ride ID required for chat access" });
    return;
  }

  try {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: { driverId: true, customerId: true },
    });

    if (!ride) {
      res.status(404).json({ error: "Ride not found" });
      return;
    }

    const isParticipant = ride.driverId === userId || ride.customerId === userId;
    const isAdmin = userRole === "admin" || userRole === "support_admin";

    if (!isParticipant && !isAdmin) {
      console.warn(`[OwnershipCheck] User ${userId} attempted chat access for ride ${rideId}`);
      res.status(403).json({ error: "Access denied. You are not a participant in this ride." });
      return;
    }

    (req as any).chatRide = ride;
    next();
  } catch (error) {
    console.error("[OwnershipCheck] Error checking chat ownership:", error);
    res.status(500).json({ error: "Failed to verify chat access" });
  }
}

export async function requirePayoutOwnership(
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

  const payoutId = req.params.payoutId || req.body?.payoutId;

  if (!payoutId) {
    next();
    return;
  }

  try {
    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
      select: { ownerId: true, ownerType: true },
    });

    if (!payout) {
      res.status(404).json({ error: "Payout not found" });
      return;
    }

    if (payout.ownerId !== userId) {
      console.warn(`[OwnershipCheck] User ${userId} attempted to access payout owned by ${payout.ownerId}`);
      res.status(403).json({ error: "Access denied. This is not your payout." });
      return;
    }

    next();
  } catch (error) {
    console.error("[OwnershipCheck] Error checking payout ownership:", error);
    res.status(500).json({ error: "Failed to verify payout ownership" });
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
      const restaurant = await prisma.restaurantProfile.findUnique({
        where: { id: order.restaurantId },
        select: { userId: true },
      });
      isRestaurantOwner = restaurant?.userId === userId;
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
