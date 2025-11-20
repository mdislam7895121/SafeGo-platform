import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { requirePermission, Permission, AdminUser } from "../utils/permissions";

const JWT_SECRET = process.env.JWT_SECRET || "safego-secret-key-change-in-production";
const prisma = new PrismaClient();

export interface JWTPayload {
  userId: string;
  role: string;
  countryCode: string;
}

export interface AuthRequest extends Request {
  user?: JWTPayload;
  adminUser?: AdminUser;
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    req.user = payload;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}

export function loadAdminProfile(req: AuthRequest, res: Response, next: NextFunction) {
  return authenticateToken(req, res, async () => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { adminProfile: true },
      });

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      if (!user.adminProfile) {
        return res.status(403).json({ error: "Admin profile not found" });
      }

      if (!user.adminProfile.isActive) {
        return res.status(403).json({ error: "Your admin account has been deactivated. Please contact support." });
      }

      req.adminUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        adminProfile: user.adminProfile,
      };

      next();
    } catch (error) {
      console.error("Error loading admin profile:", error);
      return res.status(500).json({ error: "Failed to load admin profile" });
    }
  });
}

export function checkPermission(permission: Permission) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      requirePermission(req.adminUser, permission);
      next();
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({ error: error.message || "Permission denied" });
    }
  };
}
