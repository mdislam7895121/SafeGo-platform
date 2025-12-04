import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import jwt from 'jsonwebtoken';
import { AdminRole } from '../utils/permissions';

interface JWTPayload {
  userId: string;
  email: string;
  role: 'customer' | 'driver' | 'restaurant' | 'admin';
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    userId: string;
    email: string;
    role: 'customer' | 'driver' | 'restaurant' | 'admin';
    country?: string;
    permissions?: string[];
    adminRole?: string;
    adminProfile?: any;
  };
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // SECURITY: Fail fast if JWT_SECRET missing - no fallback allowed
    if (!process.env.JWT_SECRET) {
      throw new Error("FATAL: JWT_SECRET environment variable is not set.");
    }
    const jwtSecret = process.env.JWT_SECRET;

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        customerProfile: true,
        driverProfile: true,
        restaurantProfile: true,
        adminProfile: true
      }
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    let permissions: string[] = [];
    let adminRole: string | undefined;

    if (user.adminProfile) {
      adminRole = user.adminProfile.adminRole;
      const { getAdminCapabilities } = await import('../utils/permissions');
      permissions = getAdminCapabilities({
        id: user.id,
        email: user.email,
        role: decoded.role,
        adminProfile: {
          adminRole: user.adminProfile.adminRole as AdminRole,
          isActive: user.adminProfile.isActive
        }
      });
    }

    req.user = {
      id: user.id,
      userId: user.id,
      email: user.email,
      role: decoded.role,
      country: user.countryCode,
      permissions,
      adminRole,
      adminProfile: user.adminProfile
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(permissionKey?: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    if (permissionKey && req.user.permissions) {
      if (!req.user.permissions.includes(permissionKey)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
    }

    next();
  };
}

export function requireRole(...allowedRoles: Array<'customer' | 'driver' | 'restaurant' | 'admin'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ 
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}` 
      });
      return;
    }

    next();
  };
}

export function requireOwner(
  entityType: 'ride' | 'food_order' | 'parcel_delivery' | 'wallet' | 'payout' | 'document',
  entityIdParam: string = 'id'
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role === 'admin') {
      next();
      return;
    }

    const entityId = req.params[entityIdParam];
    if (!entityId) {
      res.status(400).json({ error: 'Entity ID required' });
      return;
    }

    try {
      let entity: any;
      let isOwner = false;

      switch (entityType) {
        case 'ride':
          entity = await prisma.ride.findUnique({
            where: { id: entityId }
          });
          isOwner = entity && (
            entity.customerId === req.user.id ||
            entity.driverId === req.user.id
          );
          break;

        case 'food_order':
          entity = await prisma.foodOrder.findUnique({
            where: { id: entityId }
          });
          isOwner = entity && (
            entity.customerId === req.user.id ||
            entity.restaurantId === req.user.id
          );
          break;

        case 'parcel_delivery':
          entity = await prisma.delivery.findUnique({
            where: { id: entityId }
          });
          isOwner = entity && (
            entity.customerId === req.user.id ||
            entity.driverId === req.user.id
          );
          break;

        case 'wallet':
          entity = await prisma.wallet.findUnique({
            where: { id: entityId }
          });
          isOwner = entity && entity.ownerId === req.user.id;
          break;

        case 'payout':
          entity = await prisma.payout.findUnique({
            where: { id: entityId },
            include: { wallet: true }
          });
          isOwner = entity && entity.wallet.ownerId === req.user.id;
          break;

        case 'document':
          entity = await prisma.document.findUnique({
            where: { id: entityId }
          });
          isOwner = entity && entity.userId === req.user.id;
          break;

        default:
          res.status(400).json({ error: 'Unknown entity type' });
          return;
      }

      if (!entity) {
        res.status(404).json({ error: `${entityType} not found` });
        return;
      }

      if (!isOwner) {
        res.status(403).json({ error: 'Access denied. You can only access your own resources' });
        return;
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({ error: 'Authorization check failed' });
    }
  };
}

export function requireCountryAccess() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role !== 'admin') {
      next();
      return;
    }

    if (req.user.adminRole === 'super_admin') {
      next();
      return;
    }

    if (!req.user.country) {
      res.status(403).json({ error: 'No country assigned to admin' });
      return;
    }

    next();
  };
}

export function filterByCountry<T extends { country?: string }>(
  items: T[],
  userCountry?: string,
  adminRole?: string
): T[] {
  if (adminRole === 'super_admin') {
    return items;
  }

  if (!userCountry) {
    return items;
  }

  return items.filter(item => item.country === userCountry);
}

/**
 * Middleware to check if authenticated admin user has required permission
 * Uses the new RBAC system from utils/permissions.ts
 */
export function checkPermission(permission: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    // Check if user has the required permission
    if (!req.user.permissions || !req.user.permissions.includes(permission)) {
      res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permission 
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to check if admin user has ALL of the specified permissions
 */
export function checkAllPermissions(...permissions: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const userPermissions = req.user.permissions || [];
    const missingPermissions = permissions.filter(p => !userPermissions.includes(p));

    if (missingPermissions.length > 0) {
      res.status(403).json({ 
        error: 'Insufficient permissions',
        missing: missingPermissions 
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to check if admin user has ANY of the specified permissions
 */
export function checkAnyPermission(...permissions: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const userPermissions = req.user.permissions || [];
    const hasAnyPermission = permissions.some(p => userPermissions.includes(p));

    if (!hasAnyPermission) {
      res.status(403).json({ 
        error: 'Insufficient permissions',
        requiredAny: permissions 
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to check if admin user has a specific admin role
 */
export function checkAdminRole(...allowedRoles: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    if (!req.user.adminRole || !allowedRoles.includes(req.user.adminRole)) {
      res.status(403).json({ 
        error: 'Insufficient role privileges',
        requiredRoles: allowedRoles 
      });
      return;
    }

    next();
  };
}

/**
 * Check permission in route handler (not middleware)
 * Returns true/false for conditional logic
 */
export function hasPermission(req: AuthenticatedRequest, permission: string): boolean {
  if (!req.user || req.user.role !== 'admin') {
    return false;
  }
  return req.user.permissions?.includes(permission) ?? false;
}

/**
 * Check any permission in route handler
 */
export function hasAnyPermission(req: AuthenticatedRequest, ...permissions: string[]): boolean {
  if (!req.user || req.user.role !== 'admin') {
    return false;
  }
  return permissions.some(p => req.user!.permissions?.includes(p) ?? false);
}

/**
 * Middleware to enforce VIEW_ONLY impersonation mode
 * Blocks all mutating HTTP methods (POST, PUT, PATCH, DELETE) when admin is impersonating in VIEW_ONLY mode
 */
export function enforceImpersonationViewOnly() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const impersonationSessionId = req.headers['x-impersonation-session'] as string;
    
    if (!impersonationSessionId) {
      next();
      return;
    }

    try {
      const session = await prisma.adminImpersonationSession.findUnique({
        where: { id: impersonationSessionId }
      });

      if (!session) {
        res.status(403).json({ error: 'Invalid impersonation session' });
        return;
      }

      if (!session.isActive) {
        res.status(403).json({ error: 'Impersonation session has ended' });
        return;
      }

      if (new Date() > session.expiresAt) {
        await prisma.adminImpersonationSession.update({
          where: { id: impersonationSessionId },
          data: { isActive: false, endedAt: new Date() }
        });
        res.status(403).json({ error: 'Impersonation session has expired' });
        return;
      }

      if (session.mode === 'VIEW_ONLY') {
        const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
        if (mutatingMethods.includes(req.method.toUpperCase())) {
          res.status(403).json({ 
            error: 'Write operations not permitted in VIEW_ONLY impersonation mode',
            impersonationMode: session.mode,
            allowedMethods: ['GET', 'HEAD', 'OPTIONS']
          });
          return;
        }
      }

      (req as any).impersonationSession = session;
      next();
    } catch (error) {
      console.error('Error checking impersonation session:', error);
      res.status(500).json({ error: 'Failed to validate impersonation session' });
    }
  };
}

/**
 * Check if emergency lockdown is active for the given scope
 * Blocks operations when lockdown is active for the user's country/service
 */
export function checkEmergencyLockdown(options?: { allowedRoles?: string[] }) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (options?.allowedRoles && req.user?.adminRole) {
        if (options.allowedRoles.includes(req.user.adminRole)) {
          next();
          return;
        }
      }

      const userCountry = req.user?.country || 'GLOBAL';
      
      const activeLockdowns = await prisma.emergencyLockdown.findMany({
        where: {
          isActive: true,
          OR: [
            { scope: 'GLOBAL' },
            { countryCode: userCountry },
            { countryCode: null }
          ]
        }
      });

      if (activeLockdowns.length > 0) {
        const lockdown = activeLockdowns[0];
        res.status(503).json({
          error: 'System is currently under emergency lockdown',
          lockdownId: lockdown.id,
          scope: lockdown.scope,
          reason: lockdown.reason,
          estimatedEndTime: lockdown.estimatedEndTime
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Error checking emergency lockdown:', error);
      next();
    }
  };
}
