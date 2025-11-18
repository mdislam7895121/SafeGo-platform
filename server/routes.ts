import type { Express } from "express";
import { createServer, type Server } from "http";
import authRoutes from "./routes/auth";
import driverRoutes from "./routes/driver";
import adminRoutes from "./routes/admin";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register all API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/driver", driverRoutes);
  app.use("/api/admin", adminRoutes);

  const httpServer = createServer(app);

  return httpServer;
}
