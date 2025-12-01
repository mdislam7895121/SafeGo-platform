import type { Express } from "express";
import { createServer, type Server } from "http";
import { rateLimitPayout, rateLimitSupport, rateLimitSensitive } from "./middleware/rateLimit";
import authRoutes from "./routes/auth";
import driverRoutes from "./routes/driver";
import driverSupportRoutes from "./routes/driver-support"; // Phase 12
import driverWalletRoutes from "./routes/driver-wallet"; // D8: Country-specific payout configuration
import driverOnboardingRoutes from "./routes/driver-onboarding"; // D9: Driver onboarding & training
import driverTripsRoutes from "./routes/driver-trips"; // D17: Driver Trip History & Earnings Breakdown
import driverPerformanceRoutes from "./routes/driver-performance"; // D18: Driver Performance & Ratings Center
import driverIncentivesRoutes from "./routes/driver-incentives"; // D19: Driver Incentives & Milestones Center
import driverSafetyRoutes from "./routes/driver-safety"; // D20: Driver Safety Center & Incident Reporting
import driverTrustScoreRoutes from "./routes/driver-trust-score"; // D21: Driver Trust Score System
import driverFoodDeliveryRoutes from "./routes/driver-food-delivery"; // Step 46: Driver Food Delivery Flow
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
import adminPhase2aRoutes from "./routes/admin-phase2a"; // Phase 2A: Financial Integrity & Wallet System
import customerRestaurantStatusRoutes from "./routes/customer-restaurant-status"; // Phase 10
import customerRestaurantPricingRoutes from "./routes/customer-restaurant-pricing"; // Phase 11
import paymentConfigRoutes from "./routes/payment-config"; // Payment & Payout Configuration
import restaurantPayoutMethodsRoutes from "./routes/restaurant-payout-methods"; // Payment & Payout Configuration
import payoutRoutes from "./routes/payout"; // Unified Payout System
import couponRoutes from "./routes/coupons"; // R4: Coupon validation
import reviewRoutes from "./routes/reviews"; // R5: Reviews & Ratings
import earningsRoutes from "./routes/earnings"; // R6: Earnings & Commission Center
import secureAuditRoutes from "./routes/secure-audit"; // Security Hardening Phase 2
import mapsRoutes from "./routes/maps"; // Google Maps proxy endpoints
import faresRoutes from "./routes/fares"; // Multi-Route Fare Engine
import promosRoutes from "./routes/promos"; // Promotion Engine
import marketplaceBalancerRoutes from "./routes/marketplace-balancer"; // AI Marketplace Balancer
import loyaltyRoutes from "./routes/loyalty"; // SafeGo Loyalty Engine
import tlcRoutes from "./routes/tlc"; // NYC TLC HVFHV Minimum Pay Enforcement
import eatsRoutes from "./routes/eats"; // Public Eats endpoint for restaurant browsing
import paymentWebhooksRoutes from "./routes/payment-webhooks"; // Phase 2B: Payment webhooks
import devicesRoutes from "./routes/devices"; // Phase 2B: Device registration for FCM
import kitchenRoutes from "./routes/kitchen"; // Phase 3: Kitchen Ticket System
import parcelRoutes from "./routes/parcel"; // Phase 3: Parcel Pricing, Scheduling & POD
import phase5Routes from "./routes/phase5"; // Phase 5: Experience Intelligence & Real-Time Optimization
import { setupSupportChatWebSocket } from "./websocket/supportChatWs";
import { setupRideChatWebSocket } from "./websocket/rideChatWs";
import { setupFoodOrderNotificationsWebSocket } from "./websocket/foodOrderNotificationsWs";
import { setupDispatchWebSocket } from "./websocket/dispatchWs";
import { db } from "./db";

// Public Driver Profile Summary Type (D2 Spec)
type DriverPublicProfile = {
  name: string;
  pronouns: string | null;
  profilePhotoUrl: string | null;
  vehicle: {
    type: string;
    model: string;
    color: string;
    plateNumber: string;
  } | null;
  stats: {
    totalRides: number;
    rating: number;
    yearsActive: number;
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Public routes (no authentication required)
  // Public Eats endpoint for restaurant browsing (no auth required)
  app.use("/api/eats", eatsRoutes);
  
  // D2: Public Driver Profile endpoint - uses driver_profile_id
  app.get("/api/driver/public-profile/:driver_profile_id", async (req, res) => {
    try {
      const { driver_profile_id } = req.params;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(driver_profile_id)) {
        res.status(400).json({ message: "Invalid driver profile ID format" });
        return;
      }

      // Fetch driver profile with safe, non-sensitive fields only
      const driverProfile = await db.driverProfile.findUnique({
        where: { id: driver_profile_id },
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

      // Calculate total rides from completed rides table
      // Note: rides.driverId stores driver_profile_id
      const totalRides = await db.ride.count({
        where: {
          driverId: driver_profile_id,
          status: "COMPLETED",
        },
      });

      // Calculate rating from ride reviews
      const rideReviews = await db.ride.findMany({
        where: {
          driverId: driver_profile_id,
          status: "COMPLETED",
          customerRating: { not: null },
        },
        select: {
          customerRating: true,
        },
      });

      // Compute average rating from reviews
      const rating =
        rideReviews.length > 0
          ? rideReviews.reduce((sum, ride) => sum + (ride.customerRating || 0), 0) / rideReviews.length
          : 5.0;

      // Fetch primary vehicle (safe fields only)
      const primaryVehicle = await db.vehicle.findFirst({
        where: {
          driverId: driver_profile_id,
          isPrimary: true,
          isActive: true,
        },
        select: {
          vehicleType: true,
          make: true,
          vehicleModel: true,
          color: true,
          licensePlate: true,
        },
      });

      // Build display name from firstName + middleName + lastName
      const nameParts = [
        driverProfile.firstName,
        driverProfile.middleName,
        driverProfile.lastName,
      ].filter(Boolean);
      const name = nameParts.join(" ") || "Driver";

      // Calculate years active from driver account creation
      const yearsActive = driverProfile.createdAt
        ? parseFloat(
            ((Date.now() - driverProfile.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365)).toFixed(1)
          )
        : 0;

      // Build vehicle object
      const vehicle = primaryVehicle
        ? {
            type: primaryVehicle.vehicleType || "Car",
            model: `${primaryVehicle.make || ""} ${primaryVehicle.vehicleModel || ""}`.trim() || "Vehicle",
            color: primaryVehicle.color || "Black",
            plateNumber: primaryVehicle.licensePlate || "",
          }
        : null;

      // Build response matching D2 spec
      const profile: DriverPublicProfile = {
        name,
        pronouns: null, // Pronoun support reserved for future schema update
        profilePhotoUrl: driverProfile.profilePhotoUrl,
        vehicle,
        stats: {
          totalRides,
          rating: parseFloat(rating.toFixed(2)),
          yearsActive,
        },
      };

      res.json(profile);
    } catch (error: any) {
      console.error("Error fetching driver public summary:", error);
      res.status(500).json({ message: "Failed to fetch driver profile" });
    }
  });

  // Register all API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/driver", driverRoutes);
  app.use("/api/driver", driverSupportRoutes); // Phase 12
  app.use("/api/driver", rateLimitSensitive, driverWalletRoutes); // D8: Country-specific payout configuration - rate limited
  app.use("/api/driver", driverOnboardingRoutes); // D9: Driver onboarding & training
  app.use("/api/driver/trips", driverTripsRoutes); // D17: Driver Trip History & Earnings Breakdown
  app.use("/api/driver/performance", driverPerformanceRoutes); // D18: Driver Performance & Ratings Center
  app.use("/api/driver/incentives", driverIncentivesRoutes); // D19: Driver Incentives & Milestones Center
  app.use("/api/driver/safety", driverSafetyRoutes); // D20: Driver Safety Center & Incident Reporting
  app.use("/api/driver/trust-score", driverTrustScoreRoutes); // D21: Driver Trust Score System
  app.use("/api/driver/food-delivery", driverFoodDeliveryRoutes); // Step 46: Driver Food Delivery Flow
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
  app.use("/api/payout", rateLimitPayout, payoutRoutes); // Unified Payout System for all roles - rate limited
  app.use("/api/admin", adminRoutes);
  app.use("/api/admin", adminSupportRoutes); // Phase 12
  app.use("/api/admin", adminRestaurantSettingsRoutes); // Phase 10
  app.use("/api/admin", adminPhase2aRoutes); // Phase 2A: Financial Integrity & Wallet System
  app.use("/api/admin/referral-settings", referralSettingsRoutes);
  app.use("/api/admin/opportunity-settings", opportunitySettingsRoutes);
  app.use("/api/rides", rideRoutes);
  app.use("/api/food-orders", foodOrderRoutes);
  app.use("/api/deliveries", deliveryRoutes);
  app.use("/api/support", rateLimitSupport, supportChatRoutes); // Rate limited
  app.use("/api", documentRoutes);
  app.use("/api/admin/auth/2fa", twoFactorRoutes);
  app.use("/api/coupons", couponRoutes); // R4: Coupon validation
  app.use("/api/reviews", reviewRoutes); // R5: Reviews & Ratings
  app.use("/api/restaurant/earnings", earningsRoutes); // R6: Earnings & Commission Center
  app.use("/api/internal", secureAuditRoutes); // Security Hardening Phase 2 - internal admin endpoints
  app.use("/api/maps", mapsRoutes); // Google Maps proxy endpoints
  app.use("/api/fares", faresRoutes); // Multi-Route Fare Engine
  app.use("/api/promos", promosRoutes); // Promotion Engine
  app.use("/api/admin/marketplace", marketplaceBalancerRoutes); // AI Marketplace Balancer
  app.use("/api/loyalty", loyaltyRoutes); // SafeGo Loyalty Engine
  app.use("/api/tlc", tlcRoutes); // NYC TLC HVFHV Minimum Pay Enforcement
  app.use("/api/webhooks/payments", paymentWebhooksRoutes); // Phase 2B: Payment webhooks (no auth)
  app.use("/api/devices", devicesRoutes); // Phase 2B: Device registration for FCM
  app.use("/api/kitchen", kitchenRoutes); // Phase 3: Kitchen Ticket System
  app.use("/api/parcel", parcelRoutes); // Phase 3: Parcel Pricing, Scheduling & POD
  app.use("/api/phase5", phase5Routes); // Phase 5: Experience Intelligence & Real-Time Optimization

  const httpServer = createServer(app);
  
  setupSupportChatWebSocket(httpServer);
  setupRideChatWebSocket(httpServer);
  setupFoodOrderNotificationsWebSocket(httpServer);
  setupDispatchWebSocket(httpServer);

  return httpServer;
}
