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

export async function registerRoutes(app: Express): Promise<Server> {
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
