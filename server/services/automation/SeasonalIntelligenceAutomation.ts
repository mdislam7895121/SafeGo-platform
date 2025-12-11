/**
 * SafeGo Seasonal Intelligence Automation Service (Module 10)
 * Detects seasonal patterns and suggests partner offers
 * - Detect seasonal patterns (Eid, Puja, Winter, Summer, Christmas, Ramadan)
 * - Suggest partner offers based on season
 * - Generate insights for marketing and operations
 */

import { prisma } from '../../db';

interface SeasonDefinition {
  key: string;
  name: string;
  type: 'religious' | 'weather' | 'holiday' | 'cultural';
  countryCodes: string[];
  getDateRange: (year: number) => { start: Date; end: Date };
  demandMultiplier: number;
  popularCategories: string[];
  suggestedOffers: string[];
}

interface SeasonalInsightConfig {
  enabled: boolean;
  scanIntervalMs: number;
  seasons: SeasonDefinition[];
  insights: {
    generatePartnerOffers: boolean;
    generatePricingSuggestions: boolean;
    generateMarketingInsights: boolean;
  };
  notifications: {
    notifyPartnersBeforeDays: number;
    notifyAdminBeforeDays: number;
  };
  demandAdjustment: {
    enabled: boolean;
    maxMultiplier: number;
    minMultiplier: number;
  };
}

class SeasonalIntelligenceAutomation {
  private static instance: SeasonalIntelligenceAutomation;
  private config: SeasonalInsightConfig;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = {
      enabled: true,
      scanIntervalMs: 86400000, // 24 hours
      seasons: this.getDefaultSeasons(),
      insights: {
        generatePartnerOffers: true,
        generatePricingSuggestions: true,
        generateMarketingInsights: true,
      },
      notifications: {
        notifyPartnersBeforeDays: 14,
        notifyAdminBeforeDays: 30,
      },
      demandAdjustment: {
        enabled: true,
        maxMultiplier: 2.5,
        minMultiplier: 0.7,
      },
    };
  }

  private getDefaultSeasons(): SeasonDefinition[] {
    return [
      {
        key: 'eid_ul_fitr',
        name: 'Eid ul-Fitr',
        type: 'religious',
        countryCodes: ['BD', 'PK', 'IN', 'MY', 'ID'],
        getDateRange: (year) => {
          const dates: Record<number, { start: string; end: string }> = {
            2024: { start: '2024-04-09', end: '2024-04-12' },
            2025: { start: '2025-03-30', end: '2025-04-02' },
            2026: { start: '2026-03-20', end: '2026-03-23' },
          };
          const range = dates[year] || dates[2025];
          return { start: new Date(range.start), end: new Date(range.end) };
        },
        demandMultiplier: 2.0,
        popularCategories: ['food', 'fashion', 'gifts', 'grocery'],
        suggestedOffers: ['Eid Special Discount', 'Family Feast Bundle', 'Gift Wrapping Service'],
      },
      {
        key: 'eid_ul_adha',
        name: 'Eid ul-Adha',
        type: 'religious',
        countryCodes: ['BD', 'PK', 'IN', 'MY', 'ID'],
        getDateRange: (year) => {
          const dates: Record<number, { start: string; end: string }> = {
            2024: { start: '2024-06-16', end: '2024-06-19' },
            2025: { start: '2025-06-06', end: '2025-06-09' },
            2026: { start: '2026-05-27', end: '2026-05-30' },
          };
          const range = dates[year] || dates[2025];
          return { start: new Date(range.start), end: new Date(range.end) };
        },
        demandMultiplier: 1.8,
        popularCategories: ['food', 'meat', 'grocery', 'ride'],
        suggestedOffers: ['Meat Delivery Special', 'Family Gathering Transport', 'Bulk Order Discount'],
      },
      {
        key: 'ramadan',
        name: 'Ramadan',
        type: 'religious',
        countryCodes: ['BD', 'PK', 'IN', 'MY', 'ID', 'AE', 'SA'],
        getDateRange: (year) => {
          const dates: Record<number, { start: string; end: string }> = {
            2024: { start: '2024-03-10', end: '2024-04-08' },
            2025: { start: '2025-02-28', end: '2025-03-29' },
            2026: { start: '2026-02-17', end: '2026-03-19' },
          };
          const range = dates[year] || dates[2025];
          return { start: new Date(range.start), end: new Date(range.end) };
        },
        demandMultiplier: 1.6,
        popularCategories: ['food', 'grocery', 'iftar_items'],
        suggestedOffers: ['Iftar Special Menu', 'Suhoor Delivery', 'Ramadan Bundle'],
      },
      {
        key: 'durga_puja',
        name: 'Durga Puja',
        type: 'religious',
        countryCodes: ['BD', 'IN'],
        getDateRange: (year) => {
          const dates: Record<number, { start: string; end: string }> = {
            2024: { start: '2024-10-09', end: '2024-10-13' },
            2025: { start: '2025-09-29', end: '2025-10-03' },
            2026: { start: '2026-10-17', end: '2026-10-21' },
          };
          const range = dates[year] || dates[2025];
          return { start: new Date(range.start), end: new Date(range.end) };
        },
        demandMultiplier: 1.7,
        popularCategories: ['food', 'sweets', 'fashion', 'ride'],
        suggestedOffers: ['Puja Special Thali', 'Sweet Box Combo', 'Pandal Hopping Rides'],
      },
      {
        key: 'christmas',
        name: 'Christmas',
        type: 'holiday',
        countryCodes: ['US', 'UK', 'CA', 'AU', 'IN', 'BD'],
        getDateRange: (year) => ({
          start: new Date(`${year}-12-20`),
          end: new Date(`${year}-12-26`),
        }),
        demandMultiplier: 1.9,
        popularCategories: ['food', 'gifts', 'bakery', 'decorations'],
        suggestedOffers: ['Christmas Feast', 'Gift Delivery Express', 'Holiday Party Platter'],
      },
      {
        key: 'new_year',
        name: 'New Year',
        type: 'holiday',
        countryCodes: ['US', 'UK', 'CA', 'AU', 'IN', 'BD'],
        getDateRange: (year) => ({
          start: new Date(`${year}-12-30`),
          end: new Date(`${year + 1}-01-02`),
        }),
        demandMultiplier: 1.8,
        popularCategories: ['food', 'party_supplies', 'ride', 'alcohol'],
        suggestedOffers: ['New Year Party Pack', 'Late Night Safe Rides', 'Celebration Bundle'],
      },
      {
        key: 'winter',
        name: 'Winter Season',
        type: 'weather',
        countryCodes: ['BD', 'IN', 'US', 'UK', 'CA'],
        getDateRange: (year) => ({
          start: new Date(`${year}-12-01`),
          end: new Date(`${year + 1}-02-28`),
        }),
        demandMultiplier: 1.3,
        popularCategories: ['food', 'hot_drinks', 'comfort_food', 'winter_wear'],
        suggestedOffers: ['Hot Soup Special', 'Winter Warmer Bundle', 'Cozy Meal Deals'],
      },
      {
        key: 'summer',
        name: 'Summer Season',
        type: 'weather',
        countryCodes: ['BD', 'IN', 'US', 'UK'],
        getDateRange: (year) => ({
          start: new Date(`${year}-04-01`),
          end: new Date(`${year}-06-30`),
        }),
        demandMultiplier: 1.2,
        popularCategories: ['cold_drinks', 'ice_cream', 'light_meals', 'ride'],
        suggestedOffers: ['Summer Cooler Combo', 'Ice Cream Festival', 'AC Ride Premium'],
      },
      {
        key: 'independence_day_bd',
        name: 'Independence Day (Bangladesh)',
        type: 'holiday',
        countryCodes: ['BD'],
        getDateRange: (year) => ({
          start: new Date(`${year}-03-26`),
          end: new Date(`${year}-03-26`),
        }),
        demandMultiplier: 1.4,
        popularCategories: ['food', 'sweets', 'ride'],
        suggestedOffers: ['Victory Day Special', 'National Pride Bundle'],
      },
      {
        key: 'independence_day_us',
        name: 'Independence Day (USA)',
        type: 'holiday',
        countryCodes: ['US'],
        getDateRange: (year) => ({
          start: new Date(`${year}-07-04`),
          end: new Date(`${year}-07-04`),
        }),
        demandMultiplier: 1.6,
        popularCategories: ['food', 'bbq', 'party_supplies', 'ride'],
        suggestedOffers: ['July 4th BBQ Pack', 'Fireworks Night Rides'],
      },
      {
        key: 'thanksgiving',
        name: 'Thanksgiving',
        type: 'holiday',
        countryCodes: ['US', 'CA'],
        getDateRange: (year) => {
          const nov = new Date(year, 10, 1);
          const day = nov.getDay();
          const thanksgiving = new Date(year, 10, 22 + ((4 - day + 7) % 7));
          return {
            start: new Date(thanksgiving.getTime() - 24 * 60 * 60 * 1000),
            end: new Date(thanksgiving.getTime() + 3 * 24 * 60 * 60 * 1000),
          };
        },
        demandMultiplier: 1.8,
        popularCategories: ['food', 'turkey', 'grocery', 'ride'],
        suggestedOffers: ['Thanksgiving Feast', 'Family Dinner Bundle', 'Airport Shuttle'],
      },
    ];
  }

  static getInstance(): SeasonalIntelligenceAutomation {
    if (!SeasonalIntelligenceAutomation.instance) {
      SeasonalIntelligenceAutomation.instance = new SeasonalIntelligenceAutomation();
    }
    return SeasonalIntelligenceAutomation.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    await this.runSeasonalScan();

    this.scanInterval = setInterval(() => {
      this.runSeasonalScan();
    }, this.config.scanIntervalMs);

    await this.logAutomation('SEASONAL_INTELLIGENCE', 'SYSTEM', 'started', {
      config: { ...this.config, seasons: this.config.seasons.map(s => s.key) },
    });
    console.log('[SeasonalIntelligence] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('[SeasonalIntelligence] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: Omit<SeasonalInsightConfig, 'seasons'> & { seasonCount: number } } {
    return {
      isRunning: this.isRunning,
      config: {
        ...this.config,
        seasons: undefined as any,
        seasonCount: this.config.seasons.length,
      },
    };
  }

  updateConfig(updates: Partial<SeasonalInsightConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): SeasonalInsightConfig {
    return this.config;
  }

  async runSeasonalScan(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const currentYear = new Date().getFullYear();
      const now = new Date();

      for (const season of this.config.seasons) {
        const dateRange = season.getDateRange(currentYear);

        for (const countryCode of season.countryCodes) {
          await this.upsertSeasonalInsight(season, countryCode, dateRange, now);
        }

        const nextYearRange = season.getDateRange(currentYear + 1);
        if (nextYearRange.start.getTime() - now.getTime() < 60 * 24 * 60 * 60 * 1000) {
          for (const countryCode of season.countryCodes) {
            await this.upsertSeasonalInsight(season, countryCode, nextYearRange, now);
          }
        }
      }

      await this.updateActiveSeasons();
      await this.generatePartnerNotifications();

      await this.logAutomation('SEASONAL_INTELLIGENCE', 'SYSTEM', 'scan_completed', {
        seasonsProcessed: this.config.seasons.length,
      });
    } catch (error) {
      console.error('[SeasonalIntelligence] Scan error:', error);
      await this.logAutomation('SEASONAL_INTELLIGENCE', 'SYSTEM', 'scan_error', {
        error: String(error),
      });
    }
  }

  private async upsertSeasonalInsight(
    season: SeasonDefinition,
    countryCode: string,
    dateRange: { start: Date; end: Date },
    now: Date
  ): Promise<void> {
    const isActive = now >= dateRange.start && now <= dateRange.end;

    const recommendedOffers = this.config.insights.generatePartnerOffers
      ? season.suggestedOffers.map(offer => ({
          title: offer,
          category: season.popularCategories[0],
          suggestedDiscount: Math.round(10 + Math.random() * 15),
        }))
      : null;

    const suggestedPricing = this.config.insights.generatePricingSuggestions
      ? {
          multiplier: season.demandMultiplier,
          peakDays: this.getSeasonPeakDays(dateRange),
          suggestedSurge: season.demandMultiplier > 1.5 ? 'high' : 'moderate',
        }
      : null;

    const partnerInsights = {
      prepareInventory: season.popularCategories,
      expectedDemandIncrease: `${Math.round((season.demandMultiplier - 1) * 100)}%`,
      marketingTips: this.generateMarketingTips(season),
    };

    const customerInsights = {
      topCategories: season.popularCategories,
      promotionOpportunities: season.suggestedOffers,
      targetSegments: this.getTargetSegments(season),
    };

    const existing = await prisma.seasonalInsight.findUnique({
      where: {
        seasonKey_countryCode_cityCode: {
          seasonKey: season.key,
          countryCode,
          cityCode: '',
        },
      },
    });

    const data = {
      seasonKey: season.key,
      seasonName: season.name,
      seasonType: season.type,
      countryCode,
      cityCode: '',
      startDate: dateRange.start,
      endDate: dateRange.end,
      isActive,
      demandMultiplier: season.demandMultiplier,
      expectedDemandChange: (season.demandMultiplier - 1) * 100,
      popularCategories: season.popularCategories,
      recommendedOffers,
      suggestedPricing,
      partnerInsights,
      customerInsights,
      generatedAt: now,
    };

    if (existing) {
      await prisma.seasonalInsight.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.seasonalInsight.create({
        data,
      });
    }
  }

  private getSeasonPeakDays(dateRange: { start: Date; end: Date }): string[] {
    const peaks: string[] = [];
    const duration = dateRange.end.getTime() - dateRange.start.getTime();
    const days = Math.ceil(duration / (24 * 60 * 60 * 1000));

    if (days <= 3) {
      const current = new Date(dateRange.start);
      while (current <= dateRange.end) {
        peaks.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    } else {
      peaks.push(dateRange.start.toISOString().split('T')[0]);
      peaks.push(dateRange.end.toISOString().split('T')[0]);
    }

    return peaks;
  }

  private generateMarketingTips(season: SeasonDefinition): string[] {
    const tips: string[] = [];

    if (season.type === 'religious') {
      tips.push('Use culturally appropriate messaging');
      tips.push('Highlight family-oriented offers');
    }

    if (season.type === 'weather') {
      tips.push('Promote weather-appropriate items');
      tips.push('Consider delivery timing preferences');
    }

    if (season.demandMultiplier > 1.5) {
      tips.push('Prepare for high order volume');
      tips.push('Consider limited-time offers');
    }

    tips.push(`Focus on ${season.popularCategories.slice(0, 2).join(' and ')} categories`);

    return tips;
  }

  private getTargetSegments(season: SeasonDefinition): string[] {
    const segments: string[] = [];

    if (season.type === 'religious') {
      segments.push('religious_observers');
      segments.push('family_shoppers');
    }

    if (season.popularCategories.includes('food')) {
      segments.push('food_enthusiasts');
    }

    if (season.popularCategories.includes('gifts')) {
      segments.push('gift_givers');
    }

    segments.push('regular_customers');

    return segments;
  }

  private async updateActiveSeasons(): Promise<void> {
    const now = new Date();

    await prisma.seasonalInsight.updateMany({
      where: {
        startDate: { lte: now },
        endDate: { gte: now },
        isActive: false,
      },
      data: { isActive: true },
    });

    await prisma.seasonalInsight.updateMany({
      where: {
        OR: [
          { startDate: { gt: now } },
          { endDate: { lt: now } },
        ],
        isActive: true,
      },
      data: { isActive: false },
    });
  }

  private async generatePartnerNotifications(): Promise<void> {
    const notifyDate = new Date(Date.now() + this.config.notifications.notifyPartnersBeforeDays * 24 * 60 * 60 * 1000);

    const upcomingSeasons = await prisma.seasonalInsight.findMany({
      where: {
        startDate: { lte: notifyDate },
        isActive: false,
        endDate: { gte: new Date() },
      },
    });

    for (const season of upcomingSeasons) {
      await this.logAutomation('SEASONAL_INTELLIGENCE', season.seasonKey, 'partner_notification_due', {
        seasonName: season.seasonName,
        startDate: season.startDate,
        countryCode: season.countryCode,
      });
    }
  }

  async getActiveSeasons(countryCode?: string): Promise<any[]> {
    const where: any = { isActive: true };
    if (countryCode) {
      where.countryCode = countryCode;
    }

    return await prisma.seasonalInsight.findMany({
      where,
      orderBy: { startDate: 'asc' },
    });
  }

  async getUpcomingSeasons(days: number = 30, countryCode?: string): Promise<any[]> {
    const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const where: any = {
      startDate: { lte: futureDate, gte: new Date() },
      isActive: false,
    };

    if (countryCode) {
      where.countryCode = countryCode;
    }

    return await prisma.seasonalInsight.findMany({
      where,
      orderBy: { startDate: 'asc' },
    });
  }

  async getSeasonalStats(): Promise<Record<string, any>> {
    const activeCount = await prisma.seasonalInsight.count({
      where: { isActive: true },
    });

    const totalCount = await prisma.seasonalInsight.count();

    const byType = await prisma.seasonalInsight.groupBy({
      by: ['seasonType'],
      _count: { id: true },
    });

    return {
      totalSeasons: totalCount,
      activeSeasons: activeCount,
      byType: Object.fromEntries(byType.map(t => [t.seasonType, t._count.id])),
      configuredSeasons: this.config.seasons.length,
    };
  }

  private async logAutomation(
    automationType: string,
    entityId: string,
    action: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.automationLog.create({
        data: {
          automationType,
          entityId,
          action,
          metadata,
        },
      });
    } catch (error) {
      console.error('[SeasonalIntelligence] Failed to log automation:', error);
    }
  }
}

export const seasonalIntelligenceAutomation = SeasonalIntelligenceAutomation.getInstance();
export { SeasonalIntelligenceAutomation };
