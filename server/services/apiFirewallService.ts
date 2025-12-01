import { prisma } from '../db';
import { Request, Response, NextFunction } from 'express';

export interface RateLimitRule {
  id: string;
  routePattern: string;
  maxRequests: number;
  windowSeconds: number;
  isActive: boolean;
}

export interface FirewallDecision {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
  requiresChallenge?: boolean;
}

export class ApiFirewallService {
  private static instance: ApiFirewallService;
  private rateLimitRules: Map<string, RateLimitRule> = new Map();
  private requestCounts: Map<string, { count: number; windowStart: number }> = new Map();
  private lastRefresh: Date | null = null;
  private readonly cacheDurationMs = 60000;

  static getInstance(): ApiFirewallService {
    if (!this.instance) {
      this.instance = new ApiFirewallService();
    }
    return this.instance;
  }

  async addRateLimitRule(data: {
    routePattern: string;
    maxRequests: number;
    windowSeconds: number;
    burstLimit?: number;
    bypassRoles?: string[];
    description?: string;
    createdBy: string;
  }): Promise<string> {
    const rule = await prisma.rateLimitRule.create({
      data: {
        routePattern: data.routePattern,
        maxRequests: data.maxRequests,
        windowSeconds: data.windowSeconds,
        burstLimit: data.burstLimit,
        bypassRoles: data.bypassRoles,
        description: data.description,
        createdBy: data.createdBy,
        isActive: true
      }
    });

    this.lastRefresh = null;
    return rule.id;
  }

  async updateRateLimitRule(
    id: string,
    data: {
      maxRequests?: number;
      windowSeconds?: number;
      burstLimit?: number;
      bypassRoles?: string[];
      isActive?: boolean;
    }
  ): Promise<void> {
    await prisma.rateLimitRule.update({
      where: { id },
      data
    });
    this.lastRefresh = null;
  }

  async removeRateLimitRule(id: string): Promise<void> {
    await prisma.rateLimitRule.delete({
      where: { id }
    });
    this.lastRefresh = null;
  }

  async getRateLimitRules(): Promise<any[]> {
    return prisma.rateLimitRule.findMany({
      orderBy: { routePattern: 'asc' }
    });
  }

  async checkRequest(params: {
    ipAddress: string;
    routePath: string;
    userId?: string;
    userRole?: string;
  }): Promise<FirewallDecision> {
    await this.refreshCacheIfNeeded();

    const isBlocked = await this.isIpBlocked(params.ipAddress);
    if (isBlocked) {
      return {
        allowed: false,
        reason: 'IP address is blocked'
      };
    }

    const matchingRule = this.findMatchingRule(params.routePath);
    if (!matchingRule) {
      return { allowed: true };
    }

    if (matchingRule.bypassRoles?.includes(params.userRole || '')) {
      return { allowed: true };
    }

    const rateLimitKey = `${params.ipAddress}:${matchingRule.routePattern}`;
    const now = Date.now();
    const windowMs = matchingRule.windowSeconds * 1000;

    let rateData = this.requestCounts.get(rateLimitKey);
    
    if (!rateData || now - rateData.windowStart > windowMs) {
      rateData = { count: 0, windowStart: now };
    }

    rateData.count++;
    this.requestCounts.set(rateLimitKey, rateData);

    if (rateData.count > matchingRule.maxRequests) {
      const retryAfter = Math.ceil((rateData.windowStart + windowMs - now) / 1000);
      
      await this.logRateLimitViolation(
        params.ipAddress,
        params.routePath,
        matchingRule.id,
        rateData.count
      );

      return {
        allowed: false,
        reason: 'Rate limit exceeded',
        retryAfter
      };
    }

    const burstLimit = matchingRule.burstLimit || matchingRule.maxRequests * 1.5;
    if (rateData.count > burstLimit * 0.8) {
      return {
        allowed: true,
        requiresChallenge: true
      };
    }

    return { allowed: true };
  }

  async recordThreatSignal(
    ipAddress: string,
    signals: {
      isTor?: boolean;
      isVpn?: boolean;
      isProxy?: boolean;
      isDatacenter?: boolean;
      countryCode?: string;
      reputationScore?: number;
    }
  ): Promise<void> {
    await prisma.apiThreatSignal.upsert({
      where: { ipAddress },
      create: {
        ipAddress,
        ...signals,
        lastSeenAt: new Date()
      },
      update: {
        ...signals,
        lastSeenAt: new Date()
      }
    });
  }

  async getThreatSignal(ipAddress: string) {
    return prisma.apiThreatSignal.findUnique({
      where: { ipAddress }
    });
  }

  async blockIp(
    ipAddress: string,
    reason?: string,
    expiresAt?: Date
  ): Promise<void> {
    await prisma.apiThreatSignal.upsert({
      where: { ipAddress },
      create: {
        ipAddress,
        isBlocked: true,
        reputationScore: 0,
        lastSeenAt: new Date()
      },
      update: {
        isBlocked: true,
        reputationScore: 0,
        lastSeenAt: new Date()
      }
    });

    console.log(`[ApiFirewallService] Blocked IP ${ipAddress}: ${reason || 'No reason specified'}`);
  }

  async unblockIp(ipAddress: string): Promise<void> {
    await prisma.apiThreatSignal.update({
      where: { ipAddress },
      data: { isBlocked: false }
    });
  }

  async isIpBlocked(ipAddress: string): Promise<boolean> {
    const signal = await prisma.apiThreatSignal.findUnique({
      where: { ipAddress },
      select: { isBlocked: true }
    });

    return signal?.isBlocked || false;
  }

  async getBlockedIps(): Promise<any[]> {
    return prisma.apiThreatSignal.findMany({
      where: { isBlocked: true },
      orderBy: { lastSeenAt: 'desc' }
    });
  }

  async getRateLimitViolations(
    startDate: Date,
    endDate: Date,
    limit: number = 100
  ): Promise<any[]> {
    return prisma.rateLimitViolation.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        rule: {
          select: {
            routePattern: true,
            maxRequests: true,
            windowSeconds: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  async getFirewallStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalViolations: number;
    uniqueIps: number;
    byRoute: Record<string, number>;
    topOffenders: Array<{ ipAddress: string; count: number }>;
  }> {
    const violations = await prisma.rateLimitViolation.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        ipAddress: true,
        routePath: true
      }
    });

    const byRoute: Record<string, number> = {};
    const byIp: Record<string, number> = {};
    const uniqueIps = new Set<string>();

    for (const v of violations) {
      byRoute[v.routePath] = (byRoute[v.routePath] || 0) + 1;
      byIp[v.ipAddress] = (byIp[v.ipAddress] || 0) + 1;
      uniqueIps.add(v.ipAddress);
    }

    const topOffenders = Object.entries(byIp)
      .map(([ipAddress, count]) => ({ ipAddress, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalViolations: violations.length,
      uniqueIps: uniqueIps.size,
      byRoute,
      topOffenders
    };
  }

  createMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const ipAddress = this.getClientIp(req);
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      const decision = await this.checkRequest({
        ipAddress,
        routePath: req.path,
        userId,
        userRole
      });

      if (!decision.allowed) {
        res.setHeader('X-RateLimit-Exceeded', 'true');
        if (decision.retryAfter) {
          res.setHeader('Retry-After', decision.retryAfter.toString());
        }

        return res.status(429).json({
          success: false,
          error: decision.reason,
          retryAfter: decision.retryAfter
        });
      }

      if (decision.requiresChallenge) {
        (req as any).requiresChallenge = true;
      }

      next();
    };
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = (forwarded as string).split(',');
      return ips[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  private async refreshCacheIfNeeded(): Promise<void> {
    const now = new Date();
    
    if (
      this.lastRefresh &&
      now.getTime() - this.lastRefresh.getTime() < this.cacheDurationMs
    ) {
      return;
    }

    const rules = await prisma.rateLimitRule.findMany({
      where: { isActive: true }
    });

    this.rateLimitRules.clear();
    for (const r of rules) {
      this.rateLimitRules.set(r.routePattern, {
        id: r.id,
        routePattern: r.routePattern,
        maxRequests: r.maxRequests,
        windowSeconds: r.windowSeconds,
        isActive: r.isActive,
        bypassRoles: r.bypassRoles as string[] | undefined
      } as any);
    }

    this.lastRefresh = now;
  }

  private findMatchingRule(routePath: string): RateLimitRule | null {
    for (const [pattern, rule] of this.rateLimitRules) {
      if (this.matchesPattern(routePath, pattern)) {
        return rule;
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

  private async logRateLimitViolation(
    ipAddress: string,
    routePath: string,
    ruleId: string,
    requestCount: number
  ): Promise<void> {
    await prisma.rateLimitViolation.create({
      data: {
        ipAddress,
        routePath,
        ruleId,
        requestCount
      }
    });
  }

  clearCache(): void {
    this.lastRefresh = null;
    this.rateLimitRules.clear();
    this.requestCounts.clear();
  }
}

export const apiFirewallService = ApiFirewallService.getInstance();
