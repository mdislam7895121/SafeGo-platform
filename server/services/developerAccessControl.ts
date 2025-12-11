import { prisma } from '../db';
import { Request, Response, NextFunction } from 'express';

export interface RoutePolicy {
  routePattern: string;
  policyType: 'NO_DEV_ACCESS' | 'SIGNED_ACCESS' | 'AUDIT_REQUIRED';
  requiresSignedAccess: boolean;
  requiresAuditLog: boolean;
  allowedEnvironments?: string[];
}

export class DeveloperAccessControl {
  private static instance: DeveloperAccessControl;
  private policies: Map<string, RoutePolicy> = new Map();
  private lastRefresh: Date | null = null;
  private readonly cacheDurationMs = 120000;

  static getInstance(): DeveloperAccessControl {
    if (!this.instance) {
      this.instance = new DeveloperAccessControl();
    }
    return this.instance;
  }

  async addPolicy(data: {
    routePattern: string;
    policyType: 'NO_DEV_ACCESS' | 'SIGNED_ACCESS' | 'AUDIT_REQUIRED';
    description?: string;
    requiresSignedAccess?: boolean;
    requiresAuditLog?: boolean;
    allowedEnvironments?: string[];
    createdBy: string;
  }): Promise<string> {
    const policy = await prisma.developerRoutePolicy.create({
      data: {
        routePattern: data.routePattern,
        policyType: data.policyType,
        description: data.description,
        requiresSignedAccess: data.requiresSignedAccess ?? false,
        requiresAuditLog: data.requiresAuditLog ?? true,
        allowedEnvironments: data.allowedEnvironments,
        createdBy: data.createdBy,
        isActive: true
      }
    });

    this.lastRefresh = null;
    return policy.id;
  }

  async updatePolicy(
    id: string,
    data: {
      policyType?: 'NO_DEV_ACCESS' | 'SIGNED_ACCESS' | 'AUDIT_REQUIRED';
      description?: string;
      requiresSignedAccess?: boolean;
      requiresAuditLog?: boolean;
      allowedEnvironments?: string[];
      isActive?: boolean;
    }
  ): Promise<void> {
    await prisma.developerRoutePolicy.update({
      where: { id },
      data
    });
    this.lastRefresh = null;
  }

  async removePolicy(id: string): Promise<void> {
    await prisma.developerRoutePolicy.delete({
      where: { id }
    });
    this.lastRefresh = null;
  }

  async getPolicies(): Promise<any[]> {
    return prisma.developerRoutePolicy.findMany({
      orderBy: { routePattern: 'asc' }
    });
  }

  async checkAccess(
    routePath: string,
    accessorType: 'admin' | 'developer' | 'system',
    environment: string = 'development'
  ): Promise<{
    allowed: boolean;
    requiresSignedAccess: boolean;
    requiresAuditLog: boolean;
    blockReason?: string;
  }> {
    await this.refreshCacheIfNeeded();

    const matchingPolicy = this.findMatchingPolicy(routePath);

    if (!matchingPolicy) {
      return {
        allowed: true,
        requiresSignedAccess: false,
        requiresAuditLog: false
      };
    }

    if (accessorType === 'system') {
      return {
        allowed: true,
        requiresSignedAccess: false,
        requiresAuditLog: matchingPolicy.requiresAuditLog
      };
    }

    if (matchingPolicy.policyType === 'NO_DEV_ACCESS' && accessorType === 'developer') {
      return {
        allowed: false,
        requiresSignedAccess: false,
        requiresAuditLog: false,
        blockReason: `Route ${routePath} is marked NO_DEV_ACCESS`
      };
    }

    if (matchingPolicy.allowedEnvironments && matchingPolicy.allowedEnvironments.length > 0) {
      if (!matchingPolicy.allowedEnvironments.includes(environment)) {
        return {
          allowed: false,
          requiresSignedAccess: false,
          requiresAuditLog: false,
          blockReason: `Route ${routePath} not allowed in ${environment} environment`
        };
      }
    }

    return {
      allowed: true,
      requiresSignedAccess: matchingPolicy.requiresSignedAccess,
      requiresAuditLog: matchingPolicy.requiresAuditLog
    };
  }

  async initializeDefaultPolicies(): Promise<void> {
    const defaultPolicies = [
      {
        routePattern: '/api/admin/kyc/*',
        policyType: 'NO_DEV_ACCESS' as const,
        description: 'KYC routes are restricted from developer access',
        requiresAuditLog: true
      },
      {
        routePattern: '/api/admin/payout/*',
        policyType: 'NO_DEV_ACCESS' as const,
        description: 'Payout routes are restricted from developer access',
        requiresAuditLog: true
      },
      {
        routePattern: '/api/admin/wallet/*',
        policyType: 'SIGNED_ACCESS' as const,
        description: 'Wallet routes require signed access',
        requiresSignedAccess: true,
        requiresAuditLog: true
      },
      {
        routePattern: '/api/admin/users/*/block',
        policyType: 'AUDIT_REQUIRED' as const,
        description: 'User blocking requires audit logging',
        requiresAuditLog: true
      },
      {
        routePattern: '/api/admin/security/*',
        policyType: 'NO_DEV_ACCESS' as const,
        description: 'Security settings restricted from developer access',
        requiresAuditLog: true
      }
    ];

    for (const policy of defaultPolicies) {
      const existing = await prisma.developerRoutePolicy.findFirst({
        where: { routePattern: policy.routePattern }
      });

      if (!existing) {
        await prisma.developerRoutePolicy.create({
          data: {
            ...policy,
            createdBy: 'system',
            isActive: true
          }
        });
      }
    }

    this.lastRefresh = null;
  }

  createMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const accessorType = this.determineAccessorType(req);
      const environment = process.env.NODE_ENV || 'development';

      const accessResult = await this.checkAccess(
        req.path,
        accessorType,
        environment
      );

      if (!accessResult.allowed) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: accessResult.blockReason
        });
      }

      if (accessResult.requiresAuditLog) {
        (req as any).requiresAuditLog = true;
      }

      if (accessResult.requiresSignedAccess) {
        const signature = req.headers['x-access-signature'];
        if (!signature || !this.verifySignedAccess(signature as string, req)) {
          return res.status(403).json({
            success: false,
            error: 'Signed access required',
            message: 'This route requires a valid access signature'
          });
        }
      }

      next();
    };
  }

  private determineAccessorType(req: Request): 'admin' | 'developer' | 'system' {
    const user = (req as any).user;
    
    if (!user) {
      return 'developer';
    }

    if (user.role === 'admin' || user.role === 'super_admin') {
      return 'admin';
    }

    if (user.isSystem || user.role === 'system') {
      return 'system';
    }

    return 'developer';
  }

  private verifySignedAccess(signature: string, req: Request): boolean {
    return signature.length > 0;
  }

  private async refreshCacheIfNeeded(): Promise<void> {
    const now = new Date();
    
    if (
      this.lastRefresh &&
      now.getTime() - this.lastRefresh.getTime() < this.cacheDurationMs
    ) {
      return;
    }

    const policies = await prisma.developerRoutePolicy.findMany({
      where: { isActive: true }
    });

    this.policies.clear();
    for (const p of policies) {
      this.policies.set(p.routePattern, {
        routePattern: p.routePattern,
        policyType: p.policyType as 'NO_DEV_ACCESS' | 'SIGNED_ACCESS' | 'AUDIT_REQUIRED',
        requiresSignedAccess: p.requiresSignedAccess,
        requiresAuditLog: p.requiresAuditLog,
        allowedEnvironments: p.allowedEnvironments as string[] | undefined
      });
    }

    this.lastRefresh = now;
  }

  private findMatchingPolicy(routePath: string): RoutePolicy | null {
    for (const [pattern, policy] of this.policies) {
      if (this.matchesPattern(routePath, pattern)) {
        return policy;
      }
    }
    return null;
  }

  private matchesPattern(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\//g, '\\/');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  clearCache(): void {
    this.lastRefresh = null;
    this.policies.clear();
  }
}

export const developerAccessControl = DeveloperAccessControl.getInstance();
