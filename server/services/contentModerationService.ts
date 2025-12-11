import { prisma } from '../db';
import { ModerationFlagType, ModerationStatus } from '@prisma/client';

export interface ContentModerationResult {
  flagged: boolean;
  flags: ModerationFlagType[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoModerated: boolean;
  moderationId?: string;
  reasons: string[];
}

export class ContentModerationService {
  private static instance: ContentModerationService;

  private readonly PROFANITY_PATTERNS = [
    /\b(fuck|shit|damn|ass|bitch|bastard)\b/gi
  ];

  private readonly HARASSMENT_PATTERNS = [
    /\b(kill|die|threat|attack|hurt|hate)\b.*\b(you|him|her|them)\b/gi,
    /\b(you|they|he|she)\b.*\b(should|must|deserve)\b.*\b(die|suffer|be\s*hurt)\b/gi
  ];

  private readonly SPAM_INDICATORS = {
    maxUrls: 3,
    maxRepeatedChars: 5,
    maxCapsRatio: 0.7
  };

  static getInstance(): ContentModerationService {
    if (!this.instance) {
      this.instance = new ContentModerationService();
    }
    return this.instance;
  }

  async moderateContent(params: {
    content: string;
    contentType: 'review' | 'message' | 'profile' | 'comment';
    authorId?: string;
    contextId?: string;
    contextType?: string;
  }): Promise<ContentModerationResult> {
    const flags: ModerationFlagType[] = [];
    const reasons: string[] = [];

    if (this.containsProfanity(params.content)) {
      flags.push('profanity');
      reasons.push('Profane language detected');
    }

    if (this.containsHarassment(params.content)) {
      flags.push('harassment');
      reasons.push('Potential harassment or threatening language');
    }

    if (this.isSpam(params.content)) {
      flags.push('spam');
      reasons.push('Content appears to be spam');
    }

    if (this.containsFraudIndicators(params.content)) {
      flags.push('fraud');
      reasons.push('Potential fraudulent content');
    }

    if (this.containsPII(params.content)) {
      flags.push('pii_exposure');
      reasons.push('Personal information detected');
    }

    const flagged = flags.length > 0;
    const severity = this.calculateSeverity(flags);
    const autoModerated = this.shouldAutoModerate(flags, severity);

    let moderationId: string | undefined;

    if (flagged) {
      const moderation = await prisma.contentModerationFlag.create({
        data: {
          contentType: params.contentType,
          contentId: params.contextId || 'unknown',
          authorId: params.authorId,
          flagType: flags[0],
          flagReason: reasons.join('; '),
          originalContent: params.content,
          severity,
          autoModerated,
          status: autoModerated ? 'auto_removed' : 'pending'
        }
      });
      moderationId = moderation.id;
    }

    return {
      flagged,
      flags,
      severity,
      autoModerated,
      moderationId,
      reasons
    };
  }

  async reviewModeration(
    moderationId: string,
    reviewedBy: string,
    decision: 'approve' | 'reject' | 'escalate',
    notes?: string
  ): Promise<void> {
    let status: ModerationStatus;
    switch (decision) {
      case 'approve':
        status = 'approved';
        break;
      case 'reject':
        status = 'rejected';
        break;
      case 'escalate':
        status = 'escalated';
        break;
    }

    await prisma.contentModerationFlag.update({
      where: { id: moderationId },
      data: {
        status,
        reviewedBy,
        reviewNotes: notes,
        reviewedAt: new Date()
      }
    });
  }

  async getPendingModerations(
    filters?: {
      contentType?: string;
      flagType?: ModerationFlagType;
      severity?: string;
      limit?: number;
    }
  ): Promise<any[]> {
    return prisma.contentModerationFlag.findMany({
      where: {
        status: 'pending',
        ...(filters?.contentType && { contentType: filters.contentType }),
        ...(filters?.flagType && { flagType: filters.flagType }),
        ...(filters?.severity && { severity: filters.severity })
      },
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'asc' }
      ],
      take: filters?.limit || 50
    });
  }

  async getModerationStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    autoModeratedCount: number;
    avgReviewTime: number;
  }> {
    const moderations = await prisma.contentModerationFlag.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        flagType: true,
        status: true,
        severity: true,
        autoModerated: true,
        createdAt: true,
        reviewedAt: true
      }
    });

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let autoModeratedCount = 0;
    let totalReviewTime = 0;
    let reviewedCount = 0;

    for (const m of moderations) {
      byType[m.flagType] = (byType[m.flagType] || 0) + 1;
      byStatus[m.status] = (byStatus[m.status] || 0) + 1;
      bySeverity[m.severity] = (bySeverity[m.severity] || 0) + 1;
      
      if (m.autoModerated) autoModeratedCount++;
      
      if (m.reviewedAt) {
        totalReviewTime += m.reviewedAt.getTime() - m.createdAt.getTime();
        reviewedCount++;
      }
    }

    return {
      total: moderations.length,
      byType,
      byStatus,
      bySeverity,
      autoModeratedCount,
      avgReviewTime: reviewedCount > 0 ? totalReviewTime / reviewedCount : 0
    };
  }

  async getAuthorModerationHistory(authorId: string): Promise<{
    totalFlags: number;
    recentFlags: any[];
    trustScore: number;
  }> {
    const flags = await prisma.contentModerationFlag.findMany({
      where: { authorId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const rejectedFlags = flags.filter(f => f.status === 'rejected');
    const approvedFlags = flags.filter(f => f.status === 'approved');

    let trustScore = 100;
    trustScore -= rejectedFlags.length * 10;
    trustScore += approvedFlags.length * 2;
    trustScore = Math.max(0, Math.min(100, trustScore));

    return {
      totalFlags: flags.length,
      recentFlags: flags.slice(0, 10),
      trustScore
    };
  }

  sanitizeContent(content: string): string {
    let sanitized = content;

    for (const pattern of this.PROFANITY_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match) => '*'.repeat(match.length));
    }

    sanitized = sanitized.replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      '[email removed]'
    );

    sanitized = sanitized.replace(
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      '[phone removed]'
    );

    return sanitized;
  }

  private containsProfanity(content: string): boolean {
    return this.PROFANITY_PATTERNS.some(pattern => pattern.test(content));
  }

  private containsHarassment(content: string): boolean {
    return this.HARASSMENT_PATTERNS.some(pattern => pattern.test(content));
  }

  private isSpam(content: string): boolean {
    const urlPattern = /https?:\/\/[^\s]+/gi;
    const urls = content.match(urlPattern) || [];
    if (urls.length > this.SPAM_INDICATORS.maxUrls) return true;

    const repeatedChars = /(.)\1{4,}/;
    if (repeatedChars.test(content)) return true;

    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length > 0) {
      const capsCount = (letters.match(/[A-Z]/g) || []).length;
      if (capsCount / letters.length > this.SPAM_INDICATORS.maxCapsRatio) return true;
    }

    return false;
  }

  private containsFraudIndicators(content: string): boolean {
    const fraudPatterns = [
      /\b(send|transfer|pay|wire)\b.*\b(money|cash|funds)\b.*\b(now|immediately|urgent)\b/gi,
      /\b(bank|account|routing)\b.*\b(number|details)\b/gi,
      /\b(won|winner|prize|lottery|inheritance)\b/gi
    ];

    return fraudPatterns.some(pattern => pattern.test(content));
  }

  private containsPII(content: string): boolean {
    const ssnPattern = /\b\d{3}[-]?\d{2}[-]?\d{4}\b/;
    if (ssnPattern.test(content)) return true;

    const creditCardPattern = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/;
    if (creditCardPattern.test(content)) return true;

    const passportPattern = /\b[A-Z]{1,2}\d{6,9}\b/;
    if (passportPattern.test(content)) return true;

    return false;
  }

  private calculateSeverity(flags: ModerationFlagType[]): 'low' | 'medium' | 'high' | 'critical' {
    if (flags.includes('harassment') || flags.includes('fraud')) {
      return 'critical';
    }
    if (flags.includes('pii_exposure')) {
      return 'high';
    }
    if (flags.includes('profanity')) {
      return 'medium';
    }
    if (flags.includes('spam')) {
      return 'low';
    }
    return 'low';
  }

  private shouldAutoModerate(flags: ModerationFlagType[], severity: string): boolean {
    if (flags.includes('harassment') && severity === 'critical') {
      return true;
    }
    if (flags.includes('pii_exposure')) {
      return true;
    }
    return false;
  }
}

export const contentModerationService = ContentModerationService.getInstance();
