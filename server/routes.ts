import type { Express } from "express";
import { createServer, type Server } from "http";
import authRoutes from "./routes/auth";
import driverRoutes from "./routes/driver";
import driverSupportRoutes from "./routes/driver-support"; // Phase 12
import customerRoutes from "./routes/customer";
import customerFoodRoutes from "./routes/customer-food";
import customerSupportRoutes from "./routes/customer-support"; // Phase 12
import restaurantRoutes from "./routes/restaurant";
import restaurantSupportRoutes from "./routes/restaurant-support"; // Phase 12
import adminRoutes from "./routes/admin";
import adminSupportRoutes from "./routes/admin-support"; // Phase 12
import rideRoutes from "./routes/rides";
import foodOrderRoutes from "./routes/food-orders";
import deliveryRoutes from "./routes/deliveries";
import supportChatRoutes from "./routes/supportChat";
import documentRoutes from "./routes/documents";
import twoFactorRoutes from "./routes/twoFactor";
import referralSettingsRoutes from "./routes/referral-settings";
import opportunitySettingsRoutes from "./routes/opportunity-settings";
import restaurantSettingsRoutes from "./routes/restaurant-settings"; // Phase 10
import adminRestaurantSettingsRoutes from "./routes/admin-restaurant-settings"; // Phase 10
import customerRestaurantStatusRoutes from "./routes/customer-restaurant-status"; // Phase 10
import customerRestaurantPricingRoutes from "./routes/customer-restaurant-pricing"; // Phase 11
import paymentConfigRoutes from "./routes/payment-config"; // Payment & Payout Configuration
import restaurantPayoutMethodsRoutes from "./routes/restaurant-payout-methods"; // Payment & Payout Configuration
import payoutRoutes from "./routes/payout"; // Unified Payout System
import couponRoutes from "./routes/coupons"; // R4: Coupon validation
import reviewRoutes from "./routes/reviews"; // R5: Reviews & Ratings
import earningsRoutes from "./routes/earnings"; // R6: Earnings & Commission Center
import { setupSupportChatWebSocket } from "./websocket/supportChatWs";
import { db } from "./db";

// Public Driver Profile Summary Type
type DriverPublicSummary = {
  driverId: string;
  displayName: string;
  pronouns?: string | null;
  profilePhotoUrl: string | null;
  vehicle: {
    make: string;
    model: string;
    color: string;
    licensePlate: string;
  } | null;
  stats: {
    totalTrips: number;
    averageRating: number;
    yearsOnPlatform: number;
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Public routes (no authentication required)
  app.get("/api/public/driver/:driverId/summary", async (req, res) => {
    try {
      const { driverId } = req.params;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(driverId)) {
        res.status(400).json({ message: "Invalid driver ID format" });
        return;
      }

      // Fetch driver profile with safe, non-sensitive fields only
      const driverProfile = await db.driverProfile.findUnique({
        where: { id: driverId },
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          profilePhotoUrl: true,
          createdAt: true,
        },
      });

      if (!driverProfile) {
        res.status(404).json({ message: "Driver not found" });
        return;
      }

      // Fetch driver stats
      const driverStats = await db.driverStats.findUnique({
        where: { driverId },
        select: {
          totalTrips: true,
          rating: true,
        },
      });

      // Fetch primary vehicle (safe fields only)
      const primaryVehicle = await db.vehicle.findFirst({
        where: {
          driverId,
          isPrimary: true,
          isActive: true,
        },
        select: {
          make: true,
          vehicleModel: true,
          color: true,
          licensePlate: true,
        },
      });

      // Fetch first completed ride to calculate years on platform
      const firstCompletedRide = await db.ride.findFirst({
        where: {
          driverId,
          status: "COMPLETED",
        },
        orderBy: {
          completedAt: "asc",
        },
        select: {
          completedAt: true,
        },
      });

      // Build display name from firstName + middleName + lastName
      const nameParts = [
        driverProfile.firstName,
        driverProfile.middleName,
        driverProfile.lastName,
      ].filter(Boolean);
      const displayName = nameParts.join(" ") || "Driver";

      // Calculate years on platform
      const yearsOnPlatform = firstCompletedRide?.completedAt
        ? Math.floor(
            (Date.now() - firstCompletedRide.completedAt.getTime()) /
              (1000 * 60 * 60 * 24 * 365)
          )
        : 0;

      // Build vehicle object
      const vehicle = primaryVehicle
        ? {
            make: primaryVehicle.make || "",
            model: primaryVehicle.vehicleModel || "",
            color: primaryVehicle.color || "",
            licensePlate: primaryVehicle.licensePlate || "",
          }
        : null;

      // Build response
      const summary: DriverPublicSummary = {
        driverId: driverProfile.id,
        displayName,
        pronouns: null, // Not yet in schema, reserved for future
        profilePhotoUrl: driverProfile.profilePhotoUrl,
        vehicle,
        stats: {
          totalTrips: driverStats?.totalTrips || 0,
          averageRating: driverStats?.rating ? parseFloat(driverStats.rating.toString()) : 5.0,
          yearsOnPlatform,
        },
      };

      res.json(summary);
    } catch (error: any) {
      console.error("Error fetching driver public summary:", error);
      res.status(500).json({ message: "Failed to fetch driver profile" });
    }
  });

  // Register all API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/driver", driverRoutes);
  app.use("/api/driver", driverSupportRoutes); // Phase 12
  app.use("/api/customer", customerRoutes);
  app.use("/api/customer", customerSupportRoutes); // Phase 12
  app.use("/api/customer/food", customerFoodRoutes);
  app.use("/api/customer/restaurants", customerRestaurantStatusRoutes); // Phase 10
  app.use("/api/customer/restaurants", customerRestaurantPricingRoutes); // Phase 11
  app.use("/api/restaurant", restaurantRoutes);
  app.use("/api/restaurant", restaurantSupportRoutes); // Phase 12
  app.use("/api/restaurant/settings", restaurantSettingsRoutes); // Phase 10
  app.use("/api/restaurants", restaurantPayoutMethodsRoutes); // Payment & Payout Configuration
  app.use("/api/config", paymentConfigRoutes); // Payment & Payout Configuration
  app.use("/api/payout", payoutRoutes); // Unified Payout System for all roles
  app.use("/api/admin", adminRoutes);
  app.use("/api/admin", adminSupportRoutes); // Phase 12
  app.use("/api/admin", adminRestaurantSettingsRoutes); // Phase 10
  app.use("/api/admin/referral-settings", referralSettingsRoutes);
  app.use("/api/admin/opportunity-settings", opportunitySettingsRoutes);
  app.use("/api/rides", rideRoutes);
  app.use("/api/food-orders", foodOrderRoutes);
  app.use("/api/deliveries", deliveryRoutes);
  app.use("/api/support", supportChatRoutes);
  app.use("/api", documentRoutes);
  app.use("/api/admin/auth/2fa", twoFactorRoutes);
  app.use("/api/coupons", couponRoutes); // R4: Coupon validation
  app.use("/api/reviews", reviewRoutes); // R5: Reviews & Ratings
  app.use("/api/restaurant/earnings", earningsRoutes); // R6: Earnings & Commission Center

  const httpServer = createServer(app);
  
  setupSupportChatWebSocket(httpServer);

  return httpServer;
}
