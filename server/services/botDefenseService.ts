import { prisma } from '../db';
import { ChallengeType, BotChallengeStatus } from '@prisma/client';
import crypto from 'crypto';

export interface BotDetectionResult {
  isBot: boolean;
  confidence: number;
  signals: string[];
  requiresChallenge: boolean;
  challengeType?: ChallengeType;
}

export interface ChallengeResult {
  challengeId: string;
  challengeType: ChallengeType;
  challengeData: any;
  expiresAt: Date;
}

export class BotDefenseService {
  private static instance: BotDefenseService;
  private readonly BOT_CONFIDENCE_THRESHOLD = 70;
  private readonly RATE_LIMIT_WINDOW_MS = 60000;

  static getInstance(): BotDefenseService {
    if (!this.instance) {
      this.instance = new BotDefenseService();
    }
    return this.instance;
  }

  async analyzeRequest(params: {
    ipAddress: string;
    userAgent: string;
    requestPath: string;
    fingerprint?: string;
    userId?: string;
    headers: Record<string, string | undefined>;
  }): Promise<BotDetectionResult> {
    const signals: string[] = [];
    let botScore = 0;

    if (this.isKnownBotUserAgent(params.userAgent)) {
      signals.push('known_bot_user_agent');
      botScore += 80;
    }

    if (this.hasSuspiciousHeaders(params.headers)) {
      signals.push('suspicious_headers');
      botScore += 30;
    }

    const requestRate = await this.getRequestRate(params.ipAddress);
    if (requestRate > 100) {
      signals.push('high_request_rate');
      botScore += Math.min(50, (requestRate - 100) / 2);
    }

    const threatSignal = await this.getIpThreatSignal(params.ipAddress);
    if (threatSignal) {
      if (threatSignal.isDatacenter) {
        signals.push('datacenter_ip');
        botScore += 25;
      }
      if (threatSignal.isTor) {
        signals.push('tor_exit_node');
        botScore += 40;
      }
      if (threatSignal.isProxy) {
        signals.push('proxy_ip');
        botScore += 20;
      }
    }

    if (!params.fingerprint) {
      signals.push('missing_fingerprint');
      botScore += 15;
    }

    const confidence = Math.min(100, botScore);
    const isBot = confidence >= this.BOT_CONFIDENCE_THRESHOLD;

    let requiresChallenge = false;
    let challengeType: ChallengeType | undefined;

    if (confidence >= 50 && confidence < this.BOT_CONFIDENCE_THRESHOLD) {
      requiresChallenge = true;
      challengeType = 'proof_of_work';
    } else if (confidence >= this.BOT_CONFIDENCE_THRESHOLD && confidence < 90) {
      requiresChallenge = true;
      challengeType = 'captcha';
    }

    if (signals.length > 0) {
      await this.logBotDetection(
        params.ipAddress,
        params.userAgent,
        params.requestPath,
        signals,
        confidence
      );
    }

    return {
      isBot,
      confidence,
      signals,
      requiresChallenge,
      challengeType
    };
  }

  async createChallenge(
    ipAddress: string,
    userAgent: string,
    challengeType: ChallengeType
  ): Promise<ChallengeResult> {
    const challengeData = this.generateChallengeData(challengeType);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const challenge = await prisma.botChallengeLog.create({
      data: {
        ipAddress,
        userAgent,
        challengeType,
        challengeData,
        status: 'issued',
        expiresAt
      }
    });

    return {
      challengeId: challenge.id,
      challengeType,
      challengeData: this.getPublicChallengeData(challengeType, challengeData),
      expiresAt
    };
  }

  async verifyChallenge(
    challengeId: string,
    response: any
  ): Promise<{
    valid: boolean;
    expired: boolean;
    reason?: string;
  }> {
    const challenge = await prisma.botChallengeLog.findUnique({
      where: { id: challengeId }
    });

    if (!challenge) {
      return { valid: false, expired: false, reason: 'Challenge not found' };
    }

    if (challenge.status !== 'issued') {
      return { valid: false, expired: false, reason: 'Challenge already processed' };
    }

    if (challenge.expiresAt && challenge.expiresAt < new Date()) {
      await prisma.botChallengeLog.update({
        where: { id: challengeId },
        data: { status: 'expired' }
      });
      return { valid: false, expired: true, reason: 'Challenge expired' };
    }

    const isValid = this.verifyChallengeResponse(
      challenge.challengeType,
      challenge.challengeData as any,
      response
    );

    await prisma.botChallengeLog.update({
      where: { id: challengeId },
      data: {
        status: isValid ? 'passed' : 'failed',
        response,
        verifiedAt: new Date()
      }
    });

    return {
      valid: isValid,
      expired: false,
      reason: isValid ? undefined : 'Invalid challenge response'
    };
  }

  async blockIp(
    ipAddress: string,
    reason: string,
    durationMinutes?: number
  ): Promise<void> {
    const expiresAt = durationMinutes 
      ? new Date(Date.now() + durationMinutes * 60 * 1000)
      : undefined;

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

    console.log(`[BotDefenseService] Blocked IP ${ipAddress}: ${reason}`);
  }

  async isIpBlocked(ipAddress: string): Promise<boolean> {
    const signal = await prisma.apiThreatSignal.findUnique({
      where: { ipAddress },
      select: { isBlocked: true }
    });

    return signal?.isBlocked || false;
  }

  async getChallengeStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    passRate: number;
  }> {
    const challenges = await prisma.botChallengeLog.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        challengeType: true,
        status: true
      }
    });

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let passed = 0;
    let total = 0;

    for (const c of challenges) {
      byType[c.challengeType] = (byType[c.challengeType] || 0) + 1;
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      
      if (c.status === 'passed' || c.status === 'failed') {
        total++;
        if (c.status === 'passed') passed++;
      }
    }

    return {
      total: challenges.length,
      byType,
      byStatus,
      passRate: total > 0 ? (passed / total) * 100 : 0
    };
  }

  private isKnownBotUserAgent(userAgent: string): boolean {
    const botPatterns = [
      /bot/i,
      /spider/i,
      /crawler/i,
      /scraper/i,
      /headless/i,
      /phantom/i,
      /selenium/i,
      /puppeteer/i,
      /playwright/i,
      /wget/i,
      /curl/i,
      /python-requests/i,
      /axios/i,
      /node-fetch/i
    ];

    return botPatterns.some(pattern => pattern.test(userAgent));
  }

  private hasSuspiciousHeaders(headers: Record<string, string | undefined>): boolean {
    if (!headers['accept-language']) return true;
    if (!headers['accept-encoding']) return true;
    
    if (headers['x-forwarded-for']) {
      const ips = headers['x-forwarded-for'].split(',');
      if (ips.length > 5) return true;
    }

    return false;
  }

  private async getRequestRate(ipAddress: string): Promise<number> {
    const windowStart = new Date(Date.now() - this.RATE_LIMIT_WINDOW_MS);
    
    const count = await prisma.botChallengeLog.count({
      where: {
        ipAddress,
        createdAt: { gte: windowStart }
      }
    });

    return count;
  }

  private async getIpThreatSignal(ipAddress: string) {
    return prisma.apiThreatSignal.findUnique({
      where: { ipAddress }
    });
  }

  private async logBotDetection(
    ipAddress: string,
    userAgent: string,
    requestPath: string,
    signals: string[],
    confidence: number
  ): Promise<void> {
    await prisma.botChallengeLog.create({
      data: {
        ipAddress,
        userAgent,
        challengeType: 'invisible',
        challengeData: { requestPath, signals, confidence },
        status: confidence >= this.BOT_CONFIDENCE_THRESHOLD ? 'failed' : 'issued'
      }
    });
  }

  private generateChallengeData(type: ChallengeType): any {
    switch (type) {
      case 'proof_of_work':
        return {
          difficulty: 4,
          prefix: crypto.randomBytes(8).toString('hex'),
          targetZeros: 4
        };
      case 'captcha':
        return {
          imageId: crypto.randomBytes(16).toString('hex'),
          answer: crypto.randomBytes(3).toString('hex').toUpperCase()
        };
      case 'invisible':
        return {
          token: crypto.randomBytes(32).toString('hex')
        };
      default:
        return {};
    }
  }

  private getPublicChallengeData(type: ChallengeType, data: any): any {
    switch (type) {
      case 'proof_of_work':
        return {
          difficulty: data.difficulty,
          prefix: data.prefix,
          targetZeros: data.targetZeros
        };
      case 'captcha':
        return {
          imageId: data.imageId
        };
      case 'invisible':
        return {};
      default:
        return {};
    }
  }

  private verifyChallengeResponse(
    type: ChallengeType,
    challengeData: any,
    response: any
  ): boolean {
    switch (type) {
      case 'proof_of_work':
        if (!response.nonce) return false;
        const hash = crypto
          .createHash('sha256')
          .update(challengeData.prefix + response.nonce)
          .digest('hex');
        return hash.startsWith('0'.repeat(challengeData.targetZeros));
      
      case 'captcha':
        return response.answer?.toUpperCase() === challengeData.answer;
      
      case 'invisible':
        return response.token === challengeData.token;
      
      default:
        return false;
    }
  }
}

export const botDefenseService = BotDefenseService.getInstance();
