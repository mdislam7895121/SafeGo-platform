import type { Express } from "express";
import { createServer, type Server } from "http";
import authRoutes from "./routes/auth";
import driverRoutes from "./routes/driver";
import customerRoutes from "./routes/customer";
import restaurantRoutes from "./routes/restaurant";
import adminRoutes from "./routes/admin";
import rideRoutes from "./routes/rides";
import foodOrderRoutes from "./routes/food-orders";
import deliveryRoutes from "./routes/deliveries";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register all API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/driver", driverRoutes);
  app.use("/api/customer", customerRoutes);
  app.use("/api/restaurant", restaurantRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/rides", rideRoutes);
  app.use("/api/food-orders", foodOrderRoutes);
  app.use("/api/deliveries", deliveryRoutes);

  const httpServer = createServer(app);

  return httpServer;
}
