/**
 * SafeGo Inventory Forecasting Automation Service (Module 7)
 * Predicts inventory needs for shops and restaurants:
 * - Detect trending items based on sales patterns
 * - Predict stock-out risks
 * - Auto-send restock alerts to partners
 * Uses InventoryForecast model from schema
 */

import { prisma } from '../../db';

interface ItemSalesData {
  itemId: string;
  itemName: string;
  itemType: 'product' | 'menu_item';
  currentStock: number;
  salesLast7Days: number;
  salesLast30Days: number;
  avgDailySales: number;
  salesTrend: 'trending_up' | 'stable' | 'trending_down';
  trendPercentage: number;
}

interface ForecastResult {
  itemId: string;
  itemName: string;
  expectedDepletion: Date | null;
  stockoutRisk: 'low' | 'medium' | 'high' | 'critical';
  stockoutProbability: number;
  restockRecommendation: number;
  restockUrgency: 'normal' | 'soon' | 'urgent' | 'critical';
  isTrendingItem: boolean;
}

interface InventoryForecastingConfig {
  enabled: boolean;
  scanIntervalMs: number;
  forecastHorizon: {
    defaultDays: number;
    maxDays: number;
  };
  stockoutThresholds: {
    criticalDays: number;
    urgentDays: number;
    soonDays: number;
  };
  trending: {
    minSalesForTrending: number;
    trendingGrowthPercent: number;
    trendingWindowDays: number;
  };
  restockMultipliers: {
    safetyStockDays: number;
    trendingMultiplier: number;
    normalMultiplier: number;
  };
  alerts: {
    enabled: boolean;
    alertOnCritical: boolean;
    alertOnUrgent: boolean;
    alertOnTrending: boolean;
    maxAlertsPerDay: number;
  };
  scan: {
    maxItemsPerScan: number;
    prioritizeLowStock: boolean;
  };
}

class InventoryForecastingAutomation {
  private static instance: InventoryForecastingAutomation;
  private config: InventoryForecastingConfig;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private alertsSentToday: Map<string, number> = new Map();

  private constructor() {
    this.config = {
      enabled: true,
      scanIntervalMs: 3600000,
      forecastHorizon: {
        defaultDays: 7,
        maxDays: 30,
      },
      stockoutThresholds: {
        criticalDays: 1,
        urgentDays: 3,
        soonDays: 7,
      },
      trending: {
        minSalesForTrending: 10,
        trendingGrowthPercent: 30,
        trendingWindowDays: 7,
      },
      restockMultipliers: {
        safetyStockDays: 5,
        trendingMultiplier: 1.5,
        normalMultiplier: 1.2,
      },
      alerts: {
        enabled: true,
        alertOnCritical: true,
        alertOnUrgent: true,
        alertOnTrending: true,
        maxAlertsPerDay: 10,
      },
      scan: {
        maxItemsPerScan: 500,
        prioritizeLowStock: true,
      },
    };
  }

  static getInstance(): InventoryForecastingAutomation {
    if (!InventoryForecastingAutomation.instance) {
      InventoryForecastingAutomation.instance = new InventoryForecastingAutomation();
    }
    return InventoryForecastingAutomation.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    setInterval(() => {
      this.alertsSentToday.clear();
    }, 24 * 60 * 60 * 1000);

    this.scanInterval = setInterval(() => {
      this.runForecastScan();
    }, this.config.scanIntervalMs);

    await this.logAutomation('INVENTORY_FORECASTING', 'SYSTEM', 'started', {
      config: this.config,
    });
    console.log('[InventoryForecasting] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('[InventoryForecasting] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: InventoryForecastingConfig } {
    return { isRunning: this.isRunning, config: this.config };
  }

  updateConfig(updates: Partial<InventoryForecastingConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): InventoryForecastingConfig {
    return this.config;
  }

  async forecastShopInventory(shopId: string): Promise<ForecastResult[]> {
    const products = await prisma.shopProduct.findMany({
      where: {
        shopId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        stockQuantity: true,
      },
    });

    const forecasts: ForecastResult[] = [];

    for (const product of products) {
      const salesData = await this.getProductSalesData(product.id, product.name, product.stockQuantity);
      const forecast = this.calculateForecast(salesData, shopId, null);
      forecasts.push(forecast);

      await this.saveForecast(shopId, null, forecast, salesData);
    }

    return forecasts;
  }

  async forecastRestaurantInventory(restaurantId: string): Promise<ForecastResult[]> {
    const menuItems = await prisma.menuItem.findMany({
      where: {
        restaurantId,
        isAvailable: true,
      },
      select: {
        id: true,
        name: true,
      },
    });

    const forecasts: ForecastResult[] = [];

    for (const item of menuItems) {
      const salesData = await this.getMenuItemSalesData(item.id, item.name);
      const forecast = this.calculateForecast(salesData, null, restaurantId);
      forecasts.push(forecast);

      await this.saveForecast(null, restaurantId, forecast, salesData);
    }

    return forecasts;
  }

  private async getProductSalesData(
    productId: string,
    productName: string,
    currentStock: number
  ): Promise<ItemSalesData> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const orderItems30Days = await prisma.productOrderItem.findMany({
      where: {
        productId,
        order: {
          status: 'delivered',
          createdAt: { gte: thirtyDaysAgo },
        },
      },
      select: {
        quantity: true,
        order: { select: { createdAt: true } },
      },
    });

    const salesLast30Days = orderItems30Days.reduce((sum, item) => sum + item.quantity, 0);

    const orderItems7Days = orderItems30Days.filter(
      item => item.order.createdAt >= sevenDaysAgo
    );
    const salesLast7Days = orderItems7Days.reduce((sum, item) => sum + item.quantity, 0);

    const avgDailySales = salesLast30Days / 30;

    const avg7DaySales = salesLast7Days / 7;
    const avgPrev7DaySales = (salesLast30Days - salesLast7Days) / 23;

    let salesTrend: 'trending_up' | 'stable' | 'trending_down' = 'stable';
    let trendPercentage = 0;

    if (avgPrev7DaySales > 0) {
      trendPercentage = ((avg7DaySales - avgPrev7DaySales) / avgPrev7DaySales) * 100;
      if (trendPercentage >= this.config.trending.trendingGrowthPercent) {
        salesTrend = 'trending_up';
      } else if (trendPercentage <= -this.config.trending.trendingGrowthPercent) {
        salesTrend = 'trending_down';
      }
    }

    return {
      itemId: productId,
      itemName: productName,
      itemType: 'product',
      currentStock,
      salesLast7Days,
      salesLast30Days,
      avgDailySales,
      salesTrend,
      trendPercentage,
    };
  }

  private async getMenuItemSalesData(
    itemId: string,
    itemName: string
  ): Promise<ItemSalesData> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const orderItems30Days = await prisma.orderItem.findMany({
      where: {
        menuItemId: itemId,
        foodOrder: {
          status: 'delivered',
          createdAt: { gte: thirtyDaysAgo },
        },
      },
      select: {
        quantity: true,
        foodOrder: { select: { createdAt: true } },
      },
    });

    const salesLast30Days = orderItems30Days.reduce((sum, item) => sum + item.quantity, 0);

    const orderItems7Days = orderItems30Days.filter(
      item => item.foodOrder.createdAt >= sevenDaysAgo
    );
    const salesLast7Days = orderItems7Days.reduce((sum, item) => sum + item.quantity, 0);

    const avgDailySales = salesLast30Days / 30;

    const avg7DaySales = salesLast7Days / 7;
    const avgPrev7DaySales = (salesLast30Days - salesLast7Days) / 23;

    let salesTrend: 'trending_up' | 'stable' | 'trending_down' = 'stable';
    let trendPercentage = 0;

    if (avgPrev7DaySales > 0) {
      trendPercentage = ((avg7DaySales - avgPrev7DaySales) / avgPrev7DaySales) * 100;
      if (trendPercentage >= this.config.trending.trendingGrowthPercent) {
        salesTrend = 'trending_up';
      } else if (trendPercentage <= -this.config.trending.trendingGrowthPercent) {
        salesTrend = 'trending_down';
      }
    }

    return {
      itemId,
      itemName,
      itemType: 'menu_item',
      currentStock: 999,
      salesLast7Days,
      salesLast30Days,
      avgDailySales,
      salesTrend,
      trendPercentage,
    };
  }

  private calculateForecast(
    salesData: ItemSalesData,
    shopId: string | null,
    restaurantId: string | null
  ): ForecastResult {
    const { itemId, itemName, currentStock, avgDailySales, salesTrend, trendPercentage } = salesData;

    const isTrendingItem =
      salesTrend === 'trending_up' &&
      salesData.salesLast7Days >= this.config.trending.minSalesForTrending;

    let expectedDepletion: Date | null = null;
    let daysUntilDepletion = Infinity;

    if (avgDailySales > 0 && currentStock < 999) {
      daysUntilDepletion = currentStock / avgDailySales;
      expectedDepletion = new Date(Date.now() + daysUntilDepletion * 24 * 60 * 60 * 1000);
    }

    let stockoutRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let stockoutProbability = 0;

    if (daysUntilDepletion <= this.config.stockoutThresholds.criticalDays) {
      stockoutRisk = 'critical';
      stockoutProbability = 0.95;
    } else if (daysUntilDepletion <= this.config.stockoutThresholds.urgentDays) {
      stockoutRisk = 'high';
      stockoutProbability = 0.75;
    } else if (daysUntilDepletion <= this.config.stockoutThresholds.soonDays) {
      stockoutRisk = 'medium';
      stockoutProbability = 0.45;
    } else {
      stockoutProbability = Math.max(0, 0.3 - (daysUntilDepletion / 100));
    }

    if (isTrendingItem) {
      stockoutProbability = Math.min(stockoutProbability * 1.3, 1);
    }

    const restockMultiplier = isTrendingItem
      ? this.config.restockMultipliers.trendingMultiplier
      : this.config.restockMultipliers.normalMultiplier;

    const safetyStock = avgDailySales * this.config.restockMultipliers.safetyStockDays;
    const forecastDemand = avgDailySales * this.config.forecastHorizon.defaultDays * restockMultiplier;
    const restockRecommendation = Math.max(0, Math.ceil(forecastDemand + safetyStock - currentStock));

    let restockUrgency: 'normal' | 'soon' | 'urgent' | 'critical' = 'normal';
    if (stockoutRisk === 'critical') {
      restockUrgency = 'critical';
    } else if (stockoutRisk === 'high') {
      restockUrgency = 'urgent';
    } else if (stockoutRisk === 'medium') {
      restockUrgency = 'soon';
    }

    return {
      itemId,
      itemName,
      expectedDepletion,
      stockoutRisk,
      stockoutProbability,
      restockRecommendation,
      restockUrgency,
      isTrendingItem,
    };
  }

  private async saveForecast(
    shopId: string | null,
    restaurantId: string | null,
    forecast: ForecastResult,
    salesData: ItemSalesData
  ): Promise<void> {
    try {
      const existing = await prisma.inventoryForecast.findFirst({
        where: {
          itemId: forecast.itemId,
          ...(shopId ? { shopId } : {}),
          ...(restaurantId ? { restaurantId } : {}),
        },
      });

      const data = {
        shopId,
        restaurantId,
        itemId: forecast.itemId,
        itemName: forecast.itemName,
        itemType: salesData.itemType,
        currentStock: salesData.currentStock,
        avgDailySales: salesData.avgDailySales,
        salesTrend: salesData.salesTrend,
        trendPercentage: salesData.trendPercentage,
        forecastHorizon: this.config.forecastHorizon.defaultDays,
        expectedDepletion: forecast.expectedDepletion,
        expectedDemand: salesData.avgDailySales * this.config.forecastHorizon.defaultDays,
        stockoutRisk: forecast.stockoutRisk,
        stockoutProbability: forecast.stockoutProbability,
        restockRecommendation: forecast.restockRecommendation,
        restockUrgency: forecast.restockUrgency,
        isTrendingItem: forecast.isTrendingItem,
        generatedAt: new Date(),
      };

      if (existing) {
        await prisma.inventoryForecast.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await prisma.inventoryForecast.create({ data });
      }

      if (this.shouldSendAlert(forecast, shopId || restaurantId || 'unknown')) {
        await this.sendRestockAlert(shopId, restaurantId, forecast, salesData);
      }
    } catch (error) {
      console.error('[InventoryForecasting] Failed to save forecast:', error);
    }
  }

  private shouldSendAlert(forecast: ForecastResult, partnerId: string): boolean {
    if (!this.config.alerts.enabled) return false;

    const alertsToday = this.alertsSentToday.get(partnerId) || 0;
    if (alertsToday >= this.config.alerts.maxAlertsPerDay) return false;

    if (forecast.stockoutRisk === 'critical' && this.config.alerts.alertOnCritical) {
      return true;
    }
    if (forecast.stockoutRisk === 'high' && this.config.alerts.alertOnUrgent) {
      return true;
    }
    if (forecast.isTrendingItem && this.config.alerts.alertOnTrending) {
      return true;
    }

    return false;
  }

  private async sendRestockAlert(
    shopId: string | null,
    restaurantId: string | null,
    forecast: ForecastResult,
    salesData: ItemSalesData
  ): Promise<void> {
    const partnerId = shopId || restaurantId || 'unknown';

    await prisma.inventoryForecast.updateMany({
      where: {
        itemId: forecast.itemId,
        ...(shopId ? { shopId } : {}),
        ...(restaurantId ? { restaurantId } : {}),
      },
      data: {
        alertSent: true,
        alertSentAt: new Date(),
      },
    });

    const currentAlerts = this.alertsSentToday.get(partnerId) || 0;
    this.alertsSentToday.set(partnerId, currentAlerts + 1);

    await this.logAutomation('INVENTORY_FORECASTING', partnerId, 'restock_alert_sent', {
      itemId: forecast.itemId,
      itemName: forecast.itemName,
      stockoutRisk: forecast.stockoutRisk,
      restockRecommendation: forecast.restockRecommendation,
      restockUrgency: forecast.restockUrgency,
      isTrending: forecast.isTrendingItem,
      expectedDepletion: forecast.expectedDepletion,
      currentStock: salesData.currentStock,
      avgDailySales: salesData.avgDailySales,
    });

    console.log(
      `[InventoryForecasting] Alert sent for ${forecast.itemName} ` +
        `(${forecast.stockoutRisk} risk, restock: ${forecast.restockRecommendation})`
    );
  }

  private async runForecastScan(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      let shopsForecast = 0;
      let restaurantsForecast = 0;
      let itemsForecast = 0;
      let criticalItems = 0;
      let trendingItems = 0;

      const activeShops = await prisma.shopPartner.findMany({
        where: { isActive: true },
        select: { id: true },
        take: 50,
      });

      for (const shop of activeShops) {
        const forecasts = await this.forecastShopInventory(shop.id);
        shopsForecast++;
        itemsForecast += forecasts.length;
        criticalItems += forecasts.filter(f => f.stockoutRisk === 'critical').length;
        trendingItems += forecasts.filter(f => f.isTrendingItem).length;
      }

      const activeRestaurants = await prisma.restaurantProfile.findMany({
        where: { isActive: true },
        select: { id: true },
        take: 50,
      });

      for (const restaurant of activeRestaurants) {
        const forecasts = await this.forecastRestaurantInventory(restaurant.id);
        restaurantsForecast++;
        itemsForecast += forecasts.length;
        trendingItems += forecasts.filter(f => f.isTrendingItem).length;
      }

      await this.cleanupOldForecasts();

      await this.logAutomation('INVENTORY_FORECASTING', 'SYSTEM', 'scan_completed', {
        shopsForecast,
        restaurantsForecast,
        itemsForecast,
        criticalItems,
        trendingItems,
      });
    } catch (error) {
      console.error('[InventoryForecasting] Scan error:', error);
      await this.logAutomation('INVENTORY_FORECASTING', 'SYSTEM', 'scan_error', {
        error: String(error),
      });
    }
  }

  private async cleanupOldForecasts(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await prisma.inventoryForecast.deleteMany({
        where: {
          generatedAt: { lt: thirtyDaysAgo },
        },
      });
    } catch (error) {
      console.error('[InventoryForecasting] Cleanup error:', error);
    }
  }

  async getTrendingItems(limit: number = 20): Promise<any[]> {
    return prisma.inventoryForecast.findMany({
      where: {
        isTrendingItem: true,
        generatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { trendPercentage: 'desc' },
      take: limit,
    });
  }

  async getCriticalStockItems(limit: number = 20): Promise<any[]> {
    return prisma.inventoryForecast.findMany({
      where: {
        stockoutRisk: { in: ['critical', 'high'] },
        generatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { stockoutProbability: 'desc' },
      take: limit,
    });
  }

  async getPartnerForecasts(
    partnerId: string,
    partnerType: 'shop' | 'restaurant'
  ): Promise<any[]> {
    return prisma.inventoryForecast.findMany({
      where: {
        ...(partnerType === 'shop' ? { shopId: partnerId } : { restaurantId: partnerId }),
        generatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: [
        { stockoutRisk: 'desc' },
        { isTrendingItem: 'desc' },
      ],
    });
  }

  async getInventoryStats(days: number = 7): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const forecasts = await prisma.inventoryForecast.findMany({
      where: { generatedAt: { gte: startDate } },
    });

    const logs = await prisma.automationLog.findMany({
      where: {
        automationType: 'INVENTORY_FORECASTING',
        createdAt: { gte: startDate },
      },
    });

    return {
      totalForecasts: forecasts.length,
      byStockoutRisk: {
        low: forecasts.filter(f => f.stockoutRisk === 'low').length,
        medium: forecasts.filter(f => f.stockoutRisk === 'medium').length,
        high: forecasts.filter(f => f.stockoutRisk === 'high').length,
        critical: forecasts.filter(f => f.stockoutRisk === 'critical').length,
      },
      trendingItems: forecasts.filter(f => f.isTrendingItem).length,
      alertsSent: forecasts.filter(f => f.alertSent).length,
      avgStockoutProbability:
        forecasts.length > 0
          ? forecasts.reduce((sum, f) => sum + (f.stockoutProbability || 0), 0) / forecasts.length
          : 0,
      avgRestockRecommendation:
        forecasts.length > 0
          ? forecasts.reduce((sum, f) => sum + (f.restockRecommendation || 0), 0) / forecasts.length
          : 0,
      scansCompleted: logs.filter(l => l.status === 'scan_completed').length,
      restockAlertsSent: logs.filter(l => l.status === 'restock_alert_sent').length,
    };
  }

  private async logAutomation(
    automationType: string,
    entityId: string,
    status: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.automationLog.create({
        data: {
          automationType,
          entityType: 'inventory',
          entityId,
          status,
          metadata: details,
        },
      });
    } catch (error) {
      console.error('[InventoryForecasting] Log error:', error);
    }
  }
}

export const inventoryForecastingAutomation = InventoryForecastingAutomation.getInstance();
