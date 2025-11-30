import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { requirePermission, Permission, AdminUser } from "../utils/permissions";
import { prisma } from "../db";

// Defense in depth: Fail fast if JWT_SECRET missing in production
// In development, this is redundant with Environment Guard but provides extra safety
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("FATAL: JWT_SECRET environment variable is not set. Application cannot start without authentication secret.");
}
const JWT_SECRET = process.env.JWT_SECRET || "safego-secret-key-change-in-production";

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

export async function loadAdminProfile(req: AuthRequest, res: Response, next: NextFunction) {
  // Trust prior authenticateToken from authz.ts - DO NOT re-authenticate
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    // Load admin profile using userId from JWT payload (set by prior authenticateToken)
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

    // Get admin capabilities (permissions) from the permissions system
    const { getAdminCapabilities } = await import('../utils/permissions');
    const permissions = getAdminCapabilities({
      id: user.id,
      email: user.email,
      role: user.role as 'admin',
      adminProfile: {
        adminRole: user.adminProfile.adminRole as any,
        isActive: user.adminProfile.isActive
      }
    });

    // Set up req.adminUser with permissions array for checkPermission to use
    req.adminUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      adminProfile: {
        adminRole: user.adminProfile.adminRole as any,
        isActive: user.adminProfile.isActive
      },
      permissions  // CRITICAL: Include permissions array
    } as any;

    next();
  } catch (error) {
    console.error("Error loading admin profile:", error);
    return res.status(500).json({ error: "Failed to load admin profile" });
  }
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

/**
 * Middleware to check if a user's account is locked
 * Used for booking/payment endpoints where locked accounts should be blocked
 * Returns HTTP 423 (Locked) with error code ACCOUNT_LOCKED
 */
export async function requireUnlockedAccount(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { isAccountLocked: true, accountLockedAt: true },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (user.isAccountLocked) {
      return res.status(423).json({
        error: "Your account is locked. Go to Profile → Security & Account Lock to unlock.",
        code: "ACCOUNT_LOCKED",
        lockedAt: user.accountLockedAt,
      });
    }

    next();
  } catch (error) {
    console.error("Error checking account lock status:", error);
    return res.status(500).json({ error: "Failed to verify account status" });
  }
}

/**
 * Optional authentication - allows requests to proceed even without a valid token
 * If a valid token is provided, req.user will be populated
 * If no token or invalid token, req.user will be undefined and request proceeds
 */
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // No token provided, proceed without user
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    req.user = payload;
  } catch {
    // Invalid token, proceed without user (don't fail)
  }
  
  next();
}
