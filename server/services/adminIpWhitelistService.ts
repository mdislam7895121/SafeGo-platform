import { prisma } from '../db';

export interface IpWhitelistEntry {
  id: string;
  ipAddress?: string;
  ipRange?: string;
  description?: string;
  isActive: boolean;
  allowedRoles?: string[];
}

export class AdminIpWhitelistService {
  private static instance: AdminIpWhitelistService;
  private whitelist: IpWhitelistEntry[] = [];
  private lastRefresh: Date | null = null;
  private readonly cacheDurationMs = 60000;

  static getInstance(): AdminIpWhitelistService {
    if (!this.instance) {
      this.instance = new AdminIpWhitelistService();
    }
    return this.instance;
  }

  async addToWhitelist(data: {
    ipAddress?: string;
    ipRange?: string;
    description?: string;
    allowedRoles?: string[];
    createdBy: string;
  }): Promise<string> {
    if (!data.ipAddress && !data.ipRange) {
      throw new Error('Either ipAddress or ipRange must be provided');
    }

    const entry = await prisma.adminIpWhitelist.create({
      data: {
        ipAddress: data.ipAddress,
        ipRange: data.ipRange,
        description: data.description,
        allowedRoles: data.allowedRoles,
        createdBy: data.createdBy,
        isActive: true
      }
    });

    this.lastRefresh = null;
    return entry.id;
  }

  async removeFromWhitelist(id: string): Promise<void> {
    await prisma.adminIpWhitelist.delete({
      where: { id }
    });
    this.lastRefresh = null;
  }

  async updateWhitelistEntry(
    id: string,
    data: {
      ipAddress?: string;
      ipRange?: string;
      description?: string;
      allowedRoles?: string[];
      isActive?: boolean;
    }
  ): Promise<void> {
    await prisma.adminIpWhitelist.update({
      where: { id },
      data
    });
    this.lastRefresh = null;
  }

  async toggleWhitelistEntry(id: string, isActive: boolean): Promise<void> {
    await prisma.adminIpWhitelist.update({
      where: { id },
      data: { isActive }
    });
    this.lastRefresh = null;
  }

  async getWhitelist(): Promise<IpWhitelistEntry[]> {
    const entries = await prisma.adminIpWhitelist.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return entries.map(e => ({
      id: e.id,
      ipAddress: e.ipAddress || undefined,
      ipRange: e.ipRange || undefined,
      description: e.description || undefined,
      isActive: e.isActive,
      allowedRoles: e.allowedRoles as string[] | undefined
    }));
  }

  async isIpAllowed(ipAddress: string, adminRole?: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    await this.refreshCacheIfNeeded();

    if (this.whitelist.length === 0) {
      return { allowed: true, reason: 'No whitelist configured - all IPs allowed' };
    }

    for (const entry of this.whitelist) {
      if (!entry.isActive) continue;

      if (entry.allowedRoles && entry.allowedRoles.length > 0) {
        if (adminRole && !entry.allowedRoles.includes(adminRole)) {
          continue;
        }
      }

      if (entry.ipAddress && entry.ipAddress === ipAddress) {
        return { allowed: true };
      }

      if (entry.ipRange && this.isIpInRange(ipAddress, entry.ipRange)) {
        return { allowed: true };
      }
    }

    return {
      allowed: false,
      reason: `IP ${ipAddress} not in whitelist`
    };
  }

  async checkAdminAccess(
    ipAddress: string,
    adminId: string,
    adminRole: string
  ): Promise<{
    allowed: boolean;
    requiresWhitelist: boolean;
    reason?: string;
  }> {
    const criticalRoles = ['SUPER_ADMIN', 'FINANCE_ADMIN', 'COMPLIANCE_ADMIN'];
    const requiresWhitelist = criticalRoles.includes(adminRole);

    if (!requiresWhitelist) {
      return { allowed: true, requiresWhitelist: false };
    }

    const result = await this.isIpAllowed(ipAddress, adminRole);
    
    return {
      allowed: result.allowed,
      requiresWhitelist: true,
      reason: result.reason
    };
  }

  async getWhitelistStats(): Promise<{
    total: number;
    active: number;
    byType: { single: number; range: number };
  }> {
    const entries = await prisma.adminIpWhitelist.findMany();

    return {
      total: entries.length,
      active: entries.filter(e => e.isActive).length,
      byType: {
        single: entries.filter(e => e.ipAddress).length,
        range: entries.filter(e => e.ipRange).length
      }
    };
  }

  private async refreshCacheIfNeeded(): Promise<void> {
    const now = new Date();
    
    if (
      this.lastRefresh &&
      now.getTime() - this.lastRefresh.getTime() < this.cacheDurationMs
    ) {
      return;
    }

    const entries = await prisma.adminIpWhitelist.findMany({
      where: { isActive: true }
    });

    this.whitelist = entries.map(e => ({
      id: e.id,
      ipAddress: e.ipAddress || undefined,
      ipRange: e.ipRange || undefined,
      description: e.description || undefined,
      isActive: e.isActive,
      allowedRoles: e.allowedRoles as string[] | undefined
    }));

    this.lastRefresh = now;
  }

  private isIpInRange(ip: string, cidr: string): boolean {
    try {
      const [rangeIp, prefixLength] = cidr.split('/');
      const prefix = parseInt(prefixLength, 10);

      if (isNaN(prefix) || prefix < 0 || prefix > 32) {
        return false;
      }

      const ipNum = this.ipToNumber(ip);
      const rangeNum = this.ipToNumber(rangeIp);

      if (ipNum === null || rangeNum === null) {
        return false;
      }

      const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
      
      return (ipNum & mask) === (rangeNum & mask);
    } catch {
      return false;
    }
  }

  private ipToNumber(ip: string): number | null {
    const parts = ip.split('.');
    
    if (parts.length !== 4) {
      return null;
    }

    let result = 0;
    for (const part of parts) {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0 || num > 255) {
        return null;
      }
      result = (result << 8) + num;
    }

    return result >>> 0;
  }

  clearCache(): void {
    this.lastRefresh = null;
    this.whitelist = [];
  }
}

export const adminIpWhitelistService = AdminIpWhitelistService.getInstance();
