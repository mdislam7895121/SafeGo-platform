import type { Express, Request, Response } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { rateLimitPayout, rateLimitSupport, rateLimitSensitive } from "./middleware/rateLimit";
import { authenticateToken, AuthRequest } from "./middleware/auth";
import { prisma } from "./db";
import { initStripe } from "./services/stripeInit";
import { StripeWebhookHandler } from "./services/stripeWebhookHandler";
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
import adminPhase1Routes from "./routes/admin-phase1"; // Phase 1: People & KYC Center, Safety Center, Feature Flags
import adminPhase2Routes from "./routes/admin-phase2"; // Phase 2: RBAC v3, Global Audit v2, People & KYC v2
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
import phase6Routes from "./routes/phase6"; // Phase 6: Security Hardening & Deployment Readiness
import securityRoutes from "./routes/securityRoutes"; // Phase 6B: Customer Security Features
import adminSecurityRoutes from "./routes/adminSecurityRoutes"; // Phase 6B: Admin Security Features
import shopPartnerRoutes from "./routes/shop-partner"; // Bangladesh Expansion: Shop Partners
import ticketOperatorRoutes from "./routes/ticket-operator"; // Bangladesh Expansion: Ticket & Rental Operators
import customerTicketRoutes from "./routes/customer-ticket"; // Bangladesh Expansion: Customer ticket booking
import customerRentalRoutes from "./routes/customer-rental"; // Bangladesh Expansion: Customer rental booking
import adminBdExpansionRoutes from "./routes/admin-bd-expansion"; // Bangladesh Expansion: Admin management
import bdCustomerRoutes from "./routes/bd-customer"; // Bangladesh Expansion: Customer BD services
import partnerRegistrationRoutes from "./routes/partner-registration"; // Partner Registration for drivers & restaurants
import automationRoutes from "./routes/automation"; // Automation Systems API (Profit Automation)
import adminPhase3aRoutes from "./routes/admin-phase3a"; // Phase 3A: Enterprise Admin Features
import adminPhase3cRoutes from "./routes/admin-phase3c"; // Phase 3C: Enterprise Admin Intelligence Layer
import adminPhase4Routes from "./routes/admin-phase4"; // Phase 4: Enterprise Admin Features
import adminGlobalSettingsRoutes from "./routes/admin-global-settings"; // Global Admin Settings & Safety Locks
import complianceExportsRoutes from "./routes/compliance-exports"; // Legal & Compliance Data Export Center
import operationsConsoleRoutes from "./routes/operations-console"; // Operations Console: Jobs, Health, Errors
import backupDRRoutes from "./routes/backup-dr"; // Backup & Disaster Recovery
import accessReviewsRoutes from "./routes/access-reviews"; // Periodic Access Review (Governance)
import releasesRoutes from "./routes/releases"; // Release & Environment Promotion Console
import { setupSupportChatWebSocket } from "./websocket/supportChatWs";
import { setupRideChatWebSocket } from "./websocket/rideChatWs";
import { setupFoodOrderNotificationsWebSocket } from "./websocket/foodOrderNotificationsWs";
import { setupDispatchWebSocket } from "./websocket/dispatchWs";
import { setupAdminNotificationsWebSocket } from "./websocket/adminNotificationsWs";
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
  // Initialize Stripe integration (creates schema, webhooks, syncs data)
  const stripeInit = await initStripe();
  if (stripeInit.success && stripeInit.webhookUuid) {
    console.log('[Routes] Stripe initialized, registering webhook route');
    
    // Register Stripe webhook route - MUST be before express.json() middleware
    // The webhook needs raw body for signature verification
    app.post(
      `/api/stripe/webhook/${stripeInit.webhookUuid}`,
      express.raw({ type: 'application/json' }),
      async (req: Request, res: Response) => {
        const signature = req.headers['stripe-signature'];
        if (!signature) {
          return res.status(400).json({ error: 'Missing stripe-signature' });
        }

        try {
          const sig = Array.isArray(signature) ? signature[0] : signature;
          
          if (!Buffer.isBuffer(req.body)) {
            console.error('[StripeWebhook] req.body is not a Buffer');
            return res.status(500).json({ error: 'Webhook processing error' });
          }

          await StripeWebhookHandler.processWebhook(req.body, sig, stripeInit.webhookUuid!);
          res.status(200).json({ received: true });
        } catch (error: any) {
          console.error('[StripeWebhook] Error:', error.message);
          res.status(400).json({ error: 'Webhook processing error' });
        }
      }
    );
  }

  // Public routes (no authentication required)
  // Public Eats endpoint for restaurant browsing (no auth required)
  app.use("/api/eats", eatsRoutes);
  
  // Welcome message endpoint (authenticated - needs user role)
  const { SettingsService } = await import("./utils/settings");
  app.get("/api/welcome-message", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Get user's role
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Get welcome message settings
      const welcomeSettings = await SettingsService.getSection("welcomeMessage");
      
      // Map user role to welcome message role key
      type WelcomeRole = "customer" | "driver" | "restaurant" | "shop_partner" | "ticket_operator" | "admin";
      const roleMap: Record<string, WelcomeRole> = {
        "customer": "customer",
        "driver": "driver",
        "restaurant": "restaurant",
        "shop_partner": "shop_partner",
        "ticket_operator": "ticket_operator",
        "admin": "admin",
        "super_admin": "admin",
        // Pending roles map to their target role
        "pending_driver": "driver",
        "pending_restaurant": "restaurant",
        "pending_shop_partner": "shop_partner",
        "pending_ticket_operator": "ticket_operator",
      };
      
      const roleKey = roleMap[user.role] || "customer";
      const welcomeMessage = welcomeSettings[roleKey];
      
      if (!welcomeMessage || !welcomeMessage.enabled) {
        return res.json({ enabled: false });
      }
      
      res.json({
        enabled: true,
        title: welcomeMessage.title,
        message: welcomeMessage.message,
        ctaText: welcomeMessage.ctaText,
        ctaHref: welcomeMessage.ctaHref,
        variant: welcomeMessage.variant,
        role: roleKey,
      });
    } catch (error) {
      console.error("Get welcome message error:", error);
      res.status(500).json({ error: "Failed to fetch welcome message" });
    }
  });
  
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
  app.use("/api/admin", adminPhase1Routes); // Phase 1: People & KYC Center, Safety Center, Feature Flags
  app.use("/api/admin-phase2", adminPhase2Routes); // Phase 2: RBAC v3, Global Audit v2, People & KYC v2
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
  app.use("/api", phase6Routes); // Phase 6: Security Hardening & Deployment Readiness (includes /health)
  app.use("/api/security", securityRoutes); // Phase 6B: Customer Security Features (SOS, device trust, privacy)
  app.use("/api/admin/security", adminSecurityRoutes); // Phase 6B: Admin Security Features (2FA, IP whitelist, breach response)
  app.use("/api/admin/automation", automationRoutes); // Automation Systems API (Profit Automation)
  app.use("/api/admin/phase3a", adminPhase3aRoutes); // Phase 3A: Enterprise Admin Features
  app.use("/api/admin/phase3c", adminPhase3cRoutes); // Phase 3C: Enterprise Admin Intelligence Layer
  app.use("/api/admin/phase4", adminPhase4Routes); // Phase 4: Enterprise Admin Features
  app.use("/api/admin/global-settings", authenticateToken as any, adminGlobalSettingsRoutes); // Global Admin Settings & Safety Locks
  app.use("/api/admin/compliance-exports", authenticateToken as any, complianceExportsRoutes); // Legal & Compliance Data Export Center
  app.use("/api/admin/operations", operationsConsoleRoutes); // Operations Console: Jobs, Health, Errors
  app.use("/api/backup-dr", backupDRRoutes); // Backup & Disaster Recovery
  app.use("/api/admin/access-reviews", accessReviewsRoutes); // Periodic Access Review (Governance)
  app.use("/api/admin/releases", releasesRoutes); // Release & Environment Promotion Console

  // Bangladesh Expansion: BD-only roles (Shop Partners, Ticket/Rental Operators)
  app.use("/api/shop-partner", shopPartnerRoutes); // Shop Partner management (BD only)
  app.use("/api/ticket-operator", ticketOperatorRoutes); // Ticket & Rental Operator management (BD only)
  app.use("/api/tickets", customerTicketRoutes); // Customer ticket search & booking (BD only)
  app.use("/api/rentals", customerRentalRoutes); // Customer rental search & booking (BD only)
  app.use("/api/admin/bd-expansion", authenticateToken, (req: AuthRequest, res, next) => {
    (req as any).userId = req.user?.userId;
    next();
  }, adminBdExpansionRoutes); // Admin management for BD expansion
  app.use("/api/bd", bdCustomerRoutes); // Customer BD services (rentals, shops)
  app.use("/api", partnerRegistrationRoutes); // Partner Registration for drivers & restaurants

  // Partner Profile Endpoint - used by partner start pages
  app.get("/api/partner/profile", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const roleType = req.query.roleType as string || req.query["0"] as string;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, countryCode: true, role: true },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let profile: any = null;

      switch (roleType) {
        case "ride_driver":
        case "delivery_driver":
          const driverProfile = await prisma.driverProfile.findUnique({
            where: { userId },
            select: {
              id: true,
              verificationStatus: true,
            },
          });
          if (driverProfile) {
            profile = {
              id: driverProfile.id,
              role: roleType,
              country: user.countryCode,
              partnerStatus: driverProfile.verificationStatus,
              trustLevel: "partner_basic",
              onboardingStep: driverProfile.verificationStatus === "pending" ? 1 : 0,
            };
          }
          break;

        case "restaurant":
          const restaurantProfile = await prisma.restaurantProfile.findFirst({
            where: { userId },
            select: {
              id: true,
              verificationStatus: true,
            },
          });
          if (restaurantProfile) {
            profile = {
              id: restaurantProfile.id,
              role: "restaurant",
              country: user.countryCode,
              partnerStatus: restaurantProfile.verificationStatus,
              trustLevel: "partner_basic",
              onboardingStep: restaurantProfile.verificationStatus === "pending" ? 1 : 0,
            };
          }
          break;

        case "shop_partner":
          const shopPartner = await prisma.shopPartner.findUnique({
            where: { userId },
            select: {
              id: true,
              verificationStatus: true,
              shopName: true,
            },
          });
          if (shopPartner) {
            profile = {
              id: shopPartner.id,
              role: "shop_partner",
              country: user.countryCode,
              partnerStatus: shopPartner.verificationStatus,
              trustLevel: "partner_basic",
              onboardingStep: shopPartner.verificationStatus === "pending" ? 1 : 0,
              businessInfo: {
                businessName: shopPartner.shopName,
              },
            };
          }
          break;

        case "ticket_operator":
          const ticketOperator = await prisma.ticketOperator.findUnique({
            where: { userId },
            select: {
              id: true,
              verificationStatus: true,
              operatorName: true,
            },
          });
          if (ticketOperator) {
            profile = {
              id: ticketOperator.id,
              role: "ticket_operator",
              country: user.countryCode,
              partnerStatus: ticketOperator.verificationStatus,
              trustLevel: "partner_basic",
              onboardingStep: ticketOperator.verificationStatus === "pending" ? 1 : 0,
              businessInfo: {
                businessName: ticketOperator.operatorName,
              },
            };
          }
          break;
      }

      res.json({ profile });
    } catch (error: any) {
      console.error("[Partner] Error getting profile:", error);
      res.status(500).json({ error: error.message || "Failed to get partner profile" });
    }
  });

  const httpServer = createServer(app);
  
  setupSupportChatWebSocket(httpServer);
  setupRideChatWebSocket(httpServer);
  setupFoodOrderNotificationsWebSocket(httpServer);
  setupDispatchWebSocket(httpServer);
  setupAdminNotificationsWebSocket(httpServer);

  return httpServer;
}
