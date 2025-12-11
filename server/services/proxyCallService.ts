import { prisma } from '../db';
import { contactMaskingService } from './contactMaskingService';

export interface ProxyCallSessionResult {
  sessionId: string;
  proxyNumber: string;
  expiresAt: Date;
  callerDisplayNumber: string;
  receiverDisplayNumber: string;
}

export class ProxyCallService {
  private static instance: ProxyCallService;
  private readonly sessionDurationMinutes = 60;

  static getInstance(): ProxyCallService {
    if (!this.instance) {
      this.instance = new ProxyCallService();
    }
    return this.instance;
  }

  async createProxySession(
    callerId: string,
    receiverId: string,
    sessionType: 'ride' | 'food' | 'parcel',
    referenceId: string
  ): Promise<ProxyCallSessionResult> {
    const existingSession = await this.getActiveSession(callerId, receiverId, sessionType);
    if (existingSession) {
      return existingSession;
    }

    const countryCode = await this.getUserCountryCode(callerId);
    
    const proxyNumber = await this.allocateProxyNumber(countryCode);
    
    if (!proxyNumber) {
      throw new Error('No available proxy numbers in pool');
    }

    const expiresAt = new Date(Date.now() + this.sessionDurationMinutes * 60 * 1000);
    
    const callerMaskedNumber = contactMaskingService.maskPhoneNumber(
      await this.getUserPhone(callerId)
    );
    const receiverMaskedNumber = contactMaskingService.maskPhoneNumber(
      await this.getUserPhone(receiverId)
    );

    const session = await prisma.proxyCallSession.create({
      data: {
        proxyNumberId: proxyNumber.id,
        callerId,
        receiverId,
        rideId: sessionType === 'ride' ? referenceId : null,
        foodOrderId: sessionType === 'food' ? referenceId : null,
        callerMaskedNumber,
        receiverMaskedNumber,
        sessionType,
        status: 'active',
        expiresAt,
        callCount: 0
      }
    });

    await prisma.proxyNumberPool.update({
      where: { id: proxyNumber.id },
      data: {
        status: 'in_use',
        lastUsedAt: new Date(),
        usageCount: { increment: 1 }
      }
    });

    return {
      sessionId: session.id,
      proxyNumber: proxyNumber.virtualNumber,
      expiresAt,
      callerDisplayNumber: callerMaskedNumber,
      receiverDisplayNumber: receiverMaskedNumber
    };
  }

  async getActiveSession(
    callerId: string,
    receiverId: string,
    sessionType: string
  ): Promise<ProxyCallSessionResult | null> {
    const session = await prisma.proxyCallSession.findFirst({
      where: {
        callerId,
        receiverId,
        sessionType,
        status: 'active',
        expiresAt: { gt: new Date() }
      },
      include: {
        proxyNumber: true
      }
    });

    if (!session) {
      return null;
    }

    return {
      sessionId: session.id,
      proxyNumber: session.proxyNumber.virtualNumber,
      expiresAt: session.expiresAt,
      callerDisplayNumber: session.callerMaskedNumber,
      receiverDisplayNumber: session.receiverMaskedNumber
    };
  }

  async recordCall(sessionId: string): Promise<void> {
    await prisma.proxyCallSession.update({
      where: { id: sessionId },
      data: { callCount: { increment: 1 } }
    });
  }

  async endSession(sessionId: string): Promise<void> {
    const session = await prisma.proxyCallSession.findUnique({
      where: { id: sessionId },
      select: { proxyNumberId: true }
    });

    if (session) {
      await prisma.$transaction([
        prisma.proxyCallSession.update({
          where: { id: sessionId },
          data: { 
            status: 'ended',
            endedAt: new Date()
          }
        }),
        prisma.proxyNumberPool.update({
          where: { id: session.proxyNumberId },
          data: { status: 'available' }
        })
      ]);
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    const expiredSessions = await prisma.proxyCallSession.findMany({
      where: {
        status: 'active',
        expiresAt: { lt: new Date() }
      },
      select: { id: true, proxyNumberId: true }
    });

    if (expiredSessions.length === 0) {
      return 0;
    }

    const proxyNumberIds = expiredSessions.map(s => s.proxyNumberId);
    const sessionIds = expiredSessions.map(s => s.id);

    await prisma.$transaction([
      prisma.proxyCallSession.updateMany({
        where: { id: { in: sessionIds } },
        data: { 
          status: 'expired',
          endedAt: new Date()
        }
      }),
      prisma.proxyNumberPool.updateMany({
        where: { id: { in: proxyNumberIds } },
        data: { status: 'available' }
      })
    ]);

    return expiredSessions.length;
  }

  async addProxyNumber(
    virtualNumber: string,
    provider: string,
    countryCode: string
  ): Promise<void> {
    await prisma.proxyNumberPool.create({
      data: {
        virtualNumber,
        provider,
        countryCode,
        status: 'available'
      }
    });
  }

  async getPoolStatus(countryCode?: string): Promise<{
    total: number;
    available: number;
    inUse: number;
    disabled: number;
  }> {
    const where = countryCode ? { countryCode } : {};

    const [total, available, inUse, disabled] = await Promise.all([
      prisma.proxyNumberPool.count({ where }),
      prisma.proxyNumberPool.count({ where: { ...where, status: 'available' } }),
      prisma.proxyNumberPool.count({ where: { ...where, status: 'in_use' } }),
      prisma.proxyNumberPool.count({ where: { ...where, status: 'disabled' } })
    ]);

    return { total, available, inUse, disabled };
  }

  private async allocateProxyNumber(countryCode: string) {
    return prisma.proxyNumberPool.findFirst({
      where: {
        countryCode,
        status: 'available'
      },
      orderBy: { usageCount: 'asc' }
    });
  }

  private async getUserCountryCode(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { countryCode: true }
    });
    return user?.countryCode || 'US';
  }

  private async getUserPhone(userId: string): Promise<string> {
    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
      select: { phone: true }
    });
    if (customer?.phone) return customer.phone;

    const driver = await prisma.driverProfile.findUnique({
      where: { userId },
      select: { phone: true }
    });
    return driver?.phone || '';
  }
}

export const proxyCallService = ProxyCallService.getInstance();
