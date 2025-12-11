/**
 * SafeGo Inventory/Menu Error Automation Service
 * Detects and handles inventory/menu errors:
 * - Missing item images
 * - Missing/wrong prices
 * - Duplicate products
 * - Out-of-stock detection
 */

import { prisma } from '../../db';

interface MenuError {
  id: string;
  entityId: string;
  entityType: 'restaurant' | 'shop' | 'product';
  errorType: MenuErrorType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  autoFixed: boolean;
  fixedAt?: Date;
  fixedBy?: string;
  createdAt: Date;
}

type MenuErrorType = 
  | 'MISSING_IMAGE'
  | 'MISSING_PRICE'
  | 'INVALID_PRICE'
  | 'DUPLICATE_PRODUCT'
  | 'OUT_OF_STOCK'
  | 'LOW_STOCK'
  | 'PRICE_ANOMALY'
  | 'DESCRIPTION_MISSING';

interface InventoryMenuConfig {
  imageCheck: {
    enabled: boolean;
    autoHideOnMissing: boolean;
    reminderIntervalHours: number;
  };
  priceCheck: {
    enabled: boolean;
    minPrice: number;
    maxPrice: number;
    autoHideOnInvalid: boolean;
    priceAnomalyThreshold: number;
  };
  duplicateCheck: {
    enabled: boolean;
    similarityThreshold: number;
    autoMerge: boolean;
  };
  stockCheck: {
    enabled: boolean;
    lowStockThreshold: number;
    autoHideOnOutOfStock: boolean;
    restockReminderEnabled: boolean;
  };
}

class InventoryMenuErrorAutomation {
  private config: InventoryMenuConfig;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.config = {
      imageCheck: {
        enabled: true,
        autoHideOnMissing: false,
        reminderIntervalHours: 24,
      },
      priceCheck: {
        enabled: true,
        minPrice: 0.01,
        maxPrice: 100000,
        autoHideOnInvalid: true,
        priceAnomalyThreshold: 5,
      },
      duplicateCheck: {
        enabled: true,
        similarityThreshold: 0.85,
        autoMerge: false,
      },
      stockCheck: {
        enabled: true,
        lowStockThreshold: 5,
        autoHideOnOutOfStock: true,
        restockReminderEnabled: true,
      },
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.scanInterval = setInterval(async () => {
      await this.runFullScan();
    }, 6 * 60 * 60 * 1000);

    await this.logAutomation('INVENTORY_MENU', 'SYSTEM', 'started', { config: this.config });
    console.log('[InventoryMenu] Automation started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('[InventoryMenu] Automation stopped');
  }

  getStatus(): { isRunning: boolean; config: InventoryMenuConfig } {
    return { isRunning: this.isRunning, config: this.config };
  }

  updateConfig(updates: Partial<InventoryMenuConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): InventoryMenuConfig {
    return this.config;
  }

  async runFullScan(): Promise<{
    scanned: number;
    errorsFound: number;
    autoFixed: number;
  }> {
    const results = {
      scanned: 0,
      errorsFound: 0,
      autoFixed: 0,
    };

    try {
      const restaurantResults = await this.scanRestaurantMenus();
      results.scanned += restaurantResults.scanned;
      results.errorsFound += restaurantResults.errorsFound;
      results.autoFixed += restaurantResults.autoFixed;

      const shopResults = await this.scanShopProducts();
      results.scanned += shopResults.scanned;
      results.errorsFound += shopResults.errorsFound;
      results.autoFixed += shopResults.autoFixed;

      await this.logAutomation('INVENTORY_MENU', 'SYSTEM', 'full_scan', results);

    } catch (error) {
      console.error('[InventoryMenu] Full scan error:', error);
    }

    return results;
  }

  async scanRestaurantMenus(): Promise<{
    scanned: number;
    errorsFound: number;
    autoFixed: number;
  }> {
    const results = { scanned: 0, errorsFound: 0, autoFixed: 0 };

    try {
      const menuItems = await prisma.menuItem.findMany({
        where: { availabilityStatus: 'available' },
        include: { restaurant: true },
      });

      for (const item of menuItems) {
        results.scanned++;
        const errors = await this.checkMenuItem(item);
        results.errorsFound += errors.length;
        results.autoFixed += errors.filter(e => e.autoFixed).length;
      }

    } catch (error) {
      console.error('[InventoryMenu] Restaurant scan error:', error);
    }

    return results;
  }

  async scanShopProducts(): Promise<{
    scanned: number;
    errorsFound: number;
    autoFixed: number;
  }> {
    const results = { scanned: 0, errorsFound: 0, autoFixed: 0 };

    try {
      const products = await prisma.shopProduct.findMany({
        where: { isActive: true },
        include: { shopPartner: true },
      });

      for (const product of products) {
        results.scanned++;
        const errors = await this.checkShopProduct(product);
        results.errorsFound += errors.length;
        results.autoFixed += errors.filter(e => e.autoFixed).length;
      }

    } catch (error) {
      console.error('[InventoryMenu] Shop scan error:', error);
    }

    return results;
  }

  async checkMenuItem(item: any): Promise<MenuError[]> {
    const errors: MenuError[] = [];

    if (this.config.imageCheck.enabled && !item.itemImageUrl) {
      const error = await this.createMenuError(
        item.id,
        'restaurant',
        'MISSING_IMAGE',
        'medium',
        { itemName: item.name, restaurantId: item.restaurantId },
        this.config.imageCheck.autoHideOnMissing
      );
      errors.push(error);

      if (this.config.imageCheck.autoHideOnMissing) {
        await prisma.menuItem.update({
          where: { id: item.id },
          data: { availabilityStatus: 'unavailable' },
        });
      }
    }

    if (this.config.priceCheck.enabled) {
      const price = Number(item.basePrice);

      if (!price || price <= 0) {
        const error = await this.createMenuError(
          item.id,
          'restaurant',
          'MISSING_PRICE',
          'high',
          { itemName: item.name, currentPrice: price },
          this.config.priceCheck.autoHideOnInvalid
        );
        errors.push(error);

        if (this.config.priceCheck.autoHideOnInvalid) {
          await prisma.menuItem.update({
            where: { id: item.id },
            data: { availabilityStatus: 'unavailable' },
          });
        }
      } else if (price < this.config.priceCheck.minPrice || price > this.config.priceCheck.maxPrice) {
        const error = await this.createMenuError(
          item.id,
          'restaurant',
          'INVALID_PRICE',
          'high',
          { 
            itemName: item.name, 
            currentPrice: price,
            minPrice: this.config.priceCheck.minPrice,
            maxPrice: this.config.priceCheck.maxPrice,
          },
          this.config.priceCheck.autoHideOnInvalid
        );
        errors.push(error);
      }
    }

    return errors;
  }

  async checkShopProduct(product: any): Promise<MenuError[]> {
    const errors: MenuError[] = [];

    if (this.config.imageCheck.enabled && (!product.images || product.images.length === 0)) {
      const error = await this.createMenuError(
        product.id,
        'shop',
        'MISSING_IMAGE',
        'medium',
        { productName: product.name, shopPartnerId: product.shopPartnerId },
        this.config.imageCheck.autoHideOnMissing
      );
      errors.push(error);
    }

    if (this.config.priceCheck.enabled) {
      const price = Number(product.price);

      if (!price || price <= 0) {
        const error = await this.createMenuError(
          product.id,
          'shop',
          'MISSING_PRICE',
          'high',
          { productName: product.name, currentPrice: price },
          this.config.priceCheck.autoHideOnInvalid
        );
        errors.push(error);

        if (this.config.priceCheck.autoHideOnInvalid) {
          await prisma.shopProduct.update({
            where: { id: product.id },
            data: { isActive: false },
          });
        }
      }
    }

    if (this.config.stockCheck.enabled) {
      const stock = product.stockQuantity || 0;

      if (stock === 0) {
        const error = await this.createMenuError(
          product.id,
          'shop',
          'OUT_OF_STOCK',
          'high',
          { productName: product.name, shopPartnerId: product.shopPartnerId },
          this.config.stockCheck.autoHideOnOutOfStock
        );
        errors.push(error);

        if (this.config.stockCheck.autoHideOnOutOfStock) {
          await prisma.shopProduct.update({
            where: { id: product.id },
            data: { isActive: false },
          });
        }
      } else if (stock <= this.config.stockCheck.lowStockThreshold) {
        const error = await this.createMenuError(
          product.id,
          'shop',
          'LOW_STOCK',
          'low',
          { productName: product.name, currentStock: stock, threshold: this.config.stockCheck.lowStockThreshold },
          false
        );
        errors.push(error);
      }
    }

    return errors;
  }

  async checkDuplicates(entityType: 'restaurant' | 'shop', entityId: string): Promise<MenuError[]> {
    if (!this.config.duplicateCheck.enabled) return [];

    const errors: MenuError[] = [];

    try {
      if (entityType === 'restaurant') {
        const items = await prisma.menuItem.findMany({
          where: { restaurantId: entityId, availabilityStatus: 'available' },
        });

        const duplicates = this.findDuplicateItems(items);
        for (const dup of duplicates) {
          const error = await this.createMenuError(
            dup.ids[0],
            'restaurant',
            'DUPLICATE_PRODUCT',
            'medium',
            { duplicateIds: dup.ids, name: dup.name, similarity: dup.similarity },
            false
          );
          errors.push(error);
        }
      } else {
        const products = await prisma.shopProduct.findMany({
          where: { shopPartnerId: entityId, isActive: true },
        });

        const duplicates = this.findDuplicateItems(products);
        for (const dup of duplicates) {
          const error = await this.createMenuError(
            dup.ids[0],
            'shop',
            'DUPLICATE_PRODUCT',
            'medium',
            { duplicateIds: dup.ids, name: dup.name, similarity: dup.similarity },
            false
          );
          errors.push(error);
        }
      }
    } catch (error) {
      console.error('[InventoryMenu] Duplicate check error:', error);
    }

    return errors;
  }

  async getActiveErrors(limit: number = 50): Promise<any[]> {
    return await prisma.automationLog.findMany({
      where: {
        automationType: 'INVENTORY_MENU',
        status: { in: ['error', 'warning'] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async resolveError(errorId: string, adminId: string, resolution: string): Promise<void> {
    await prisma.automationLog.update({
      where: { id: errorId },
      data: {
        status: 'resolved',
        details: {
          resolution,
          resolvedBy: adminId,
          resolvedAt: new Date().toISOString(),
        },
      },
    });

    await this.logAutomation('INVENTORY_MENU', errorId, 'resolved', {
      adminId,
      resolution,
    });
  }

  async getStats(days: number = 30): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await prisma.automationLog.findMany({
      where: {
        automationType: 'INVENTORY_MENU',
        createdAt: { gte: startDate },
      },
    });

    const stats: Record<string, any> = {
      total: logs.length,
      byType: {},
      resolved: 0,
      pending: 0,
      autoFixed: 0,
    };

    logs.forEach(log => {
      const details = log.details as Record<string, any>;
      const errorType = details?.errorType || 'unknown';

      stats.byType[errorType] = (stats.byType[errorType] || 0) + 1;

      if (log.status === 'resolved') stats.resolved++;
      else if (log.status !== 'auto_fixed') stats.pending++;
      
      if (details?.autoFixed) stats.autoFixed++;
    });

    return stats;
  }

  private async createMenuError(
    entityId: string,
    entityType: 'restaurant' | 'shop' | 'product',
    errorType: MenuErrorType,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>,
    autoFixed: boolean
  ): Promise<MenuError> {
    const error: MenuError = {
      id: `menu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entityId,
      entityType,
      errorType,
      severity,
      details,
      autoFixed,
      createdAt: new Date(),
    };

    if (autoFixed) {
      error.fixedAt = new Date();
      error.fixedBy = 'SYSTEM';
    }

    await this.logAutomation('INVENTORY_MENU', entityId, autoFixed ? 'auto_fixed' : 'error', {
      errorId: error.id,
      errorType,
      severity,
      details,
      autoFixed,
    });

    return error;
  }

  private findDuplicateItems(items: any[]): Array<{ ids: string[]; name: string; similarity: number }> {
    const duplicates: Array<{ ids: string[]; name: string; similarity: number }> = [];
    const checked = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      if (checked.has(items[i].id)) continue;

      const similar: string[] = [items[i].id];

      for (let j = i + 1; j < items.length; j++) {
        if (checked.has(items[j].id)) continue;

        const similarity = this.calculateSimilarity(items[i].name, items[j].name);
        if (similarity >= this.config.duplicateCheck.similarityThreshold) {
          similar.push(items[j].id);
          checked.add(items[j].id);
        }
      }

      if (similar.length > 1) {
        checked.add(items[i].id);
        duplicates.push({
          ids: similar,
          name: items[i].name,
          similarity: this.config.duplicateCheck.similarityThreshold,
        });
      }
    }

    return duplicates;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
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
      console.error('[InventoryMenu] Log error:', error);
    }
  }
}

export const inventoryMenuErrorAutomation = new InventoryMenuErrorAutomation();
