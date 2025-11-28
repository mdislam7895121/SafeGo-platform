/**
 * FareCalculationService - Multi-Route Fare Engine (USA)
 * 
 * Implements Uber-level commercial fare logic with:
 * - Per-route fare calculation for all route alternatives
 * - Regulatory fee detection (BCF, Airport, Congestion, Local Tax)
 * - Toll segment detection and pricing
 * - Traffic and surge adjustments
 * - Driver payout calculation
 * - Full fare breakdown for transparency
 */

import { PrismaClient } from "@prisma/client";

// Create dedicated Prisma client for fare calculation
const prisma = new PrismaClient();

// Type definitions for fare engine models
export type RideTypeCode = "SAVER" | "STANDARD" | "COMFORT" | "XL" | "PREMIUM";

interface RideType {
  id: string;
  code: RideTypeCode;
  name: string;
  description: string | null;
  iconType: string;
  capacity: number;
  isActive: boolean;
  sortOrder: number;
}

interface RideFareConfig {
  id: string;
  rideTypeId: string;
  countryCode: string;
  cityCode: string | null;
  baseFare: any; // Decimal
  perMileRate: any;
  perMinuteRate: any;
  minimumFare: any;
  driverPerMileRate: any;
  driverPerMinuteRate: any;
  serviceFeePercent: any;
  serviceFeeMinimum: any;
  serviceFeeMaximum: any;
  maxSurgeMultiplier: any;
  surgeEnabled: boolean;
  trafficMultiplierLight: any;
  trafficMultiplierModerate: any;
  trafficMultiplierHeavy: any;
  isActive: boolean;
  version: number;
}

interface RegulatoryZone {
  id: string;
  name: string;
  zoneType: string;
  countryCode: string;
  stateCode: string | null;
  cityCode: string | null;
  polygonCoordinates: any;
  boundingBoxMinLat: number | null;
  boundingBoxMaxLat: number | null;
  boundingBoxMinLng: number | null;
  boundingBoxMaxLng: number | null;
  isActive: boolean;
}

interface RegulatoryFeeConfig {
  id: string;
  zoneId: string;
  feeType: string;
  flatFeeAmount: any | null;
  percentFeeRate: any | null;
  appliesToPickup: boolean;
  appliesToDropoff: boolean;
  displayName: string;
  description: string | null;
  isActive: boolean;
  version: number;
}

interface TollConfig {
  id: string;
  name: string;
  countryCode: string;
  stateCode: string | null;
  segmentIdentifier: string;
  alternateIdentifiers: string[];
  tollRateSaver: any;
  tollRateStandard: any;
  tollRateComfort: any;
  tollRateXL: any;
  tollRatePremium: any;
  tollPaidToDriver: boolean;
  isActive: boolean;
}

interface FeeRule {
  id: string;
  feeType: string;
  countryCode: string;
  cityCode: string | null;
  flatAmount: any | null;
  perUnitAmount: any | null;
  unitType: string | null;
  freeUnits: number | null;
  minimumFee: any | null;
  maximumFee: any | null;
  requiresDriverAssigned: boolean;
  minimumMinutesAfterAccept: number | null;
  displayName: string;
  description: string | null;
  isActive: boolean;
  version: number;
}

// ============================================
// Type Definitions
// ============================================

export interface RouteInfo {
  routeId: string;
  distanceMiles: number;
  durationMinutes: number;
  trafficDurationMinutes?: number;
  polyline?: string;
  summary?: string;
  avoidsHighways?: boolean;
  avoidsTolls?: boolean;
  tollSegments?: string[]; // Names of toll roads detected on route
}

export interface FareCalculationRequest {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  rideTypeCode: RideTypeCode;
  routes: RouteInfo[];
  countryCode?: string;
  cityCode?: string;
  surgeMultiplier?: number;
  promoCode?: string;
  customerId?: string;
}

export interface FeeBreakdownItem {
  id: string;
  name: string;
  amount: number;
  type: "flat" | "percent" | "per_unit";
  description?: string;
  isRegulatory?: boolean;
  paidToDriver?: boolean;
}

export interface RouteFareBreakdown {
  routeId: string;
  routeSummary?: string;
  distanceMiles: number;
  durationMinutes: number;
  trafficDurationMinutes?: number;
  
  // Core fare components
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  
  // Adjustments
  trafficAdjustment: number;
  surgeAmount: number;
  surgeMultiplier: number;
  
  // Fees
  tollsTotal: number;
  tollsBreakdown: FeeBreakdownItem[];
  regulatoryFeesTotal: number;
  regulatoryFeesBreakdown: FeeBreakdownItem[];
  additionalFeesTotal: number;
  additionalFeesBreakdown: FeeBreakdownItem[];
  serviceFee: number;
  
  // Discounts
  discountAmount: number;
  promoCode?: string;
  
  // Totals
  subtotal: number;
  totalFare: number;
  
  // Driver payout
  driverPayout: number;
  safegoCommission: number;
  
  // Matched zones for logging
  matchedZoneIds: string[];
  
  // Display helpers
  isCheapest?: boolean;
  isFastest?: boolean;
}

export interface FareCalculationResult {
  success: boolean;
  rideType: {
    code: RideTypeCode;
    name: string;
    description?: string;
    capacity: number;
  };
  routeFares: RouteFareBreakdown[];
  cheapestRouteId?: string;
  fastestRouteId?: string;
  currency: string;
  calculatedAt: Date;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Point-in-polygon detection using ray casting algorithm
 */
function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: { lat: number; lng: number }[]
): boolean {
  if (!polygon || polygon.length < 3) return false;
  
  let inside = false;
  const x = point.lng;
  const y = point.lat;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    
    const intersect = ((yi > y) !== (yj > y)) && 
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
}

/**
 * Quick bounding box check before polygon detection
 */
function isInBoundingBox(
  point: { lat: number; lng: number },
  zone: RegulatoryZone
): boolean {
  if (
    zone.boundingBoxMinLat === null ||
    zone.boundingBoxMaxLat === null ||
    zone.boundingBoxMinLng === null ||
    zone.boundingBoxMaxLng === null
  ) {
    return true; // No bounding box, need full polygon check
  }
  
  return (
    point.lat >= zone.boundingBoxMinLat &&
    point.lat <= zone.boundingBoxMaxLat &&
    point.lng >= zone.boundingBoxMinLng &&
    point.lng <= zone.boundingBoxMaxLng
  );
}

/**
 * Determine traffic level based on ratio of traffic duration to normal duration
 */
function getTrafficLevel(
  normalDuration: number,
  trafficDuration?: number
): "light" | "moderate" | "heavy" {
  if (!trafficDuration || trafficDuration <= normalDuration) {
    return "light";
  }
  
  const ratio = trafficDuration / normalDuration;
  if (ratio < 1.15) return "light";
  if (ratio < 1.35) return "moderate";
  return "heavy";
}

/**
 * Round to 2 decimal places for currency
 */
function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

// ============================================
// Main Service Class
// ============================================

export class FareCalculationService {
  private static instance: FareCalculationService;
  
  // Cache for ride types and configs (refresh every 5 minutes)
  private rideTypesCache: Map<RideTypeCode, RideType> = new Map();
  private fareConfigsCache: Map<string, RideFareConfig> = new Map();
  private zonesCache: RegulatoryZone[] = [];
  private feeRulesCache: FeeRule[] = [];
  private tollConfigsCache: TollConfig[] = [];
  private cacheExpiry: Date = new Date(0);
  
  public static getInstance(): FareCalculationService {
    if (!FareCalculationService.instance) {
      FareCalculationService.instance = new FareCalculationService();
    }
    return FareCalculationService.instance;
  }
  
  /**
   * Refresh configuration cache from database
   */
  private async refreshCache(): Promise<void> {
    const now = new Date();
    if (now < this.cacheExpiry) return;
    
    console.log("[FareCalculation] Refreshing configuration cache...");
    
    // Use type assertions for new Prisma models (LSP may not have refreshed types yet)
    const db = prisma as any;
    
    // Load ride types
    const rideTypes: RideType[] = await db.rideType.findMany({
      where: { isActive: true },
    });
    this.rideTypesCache.clear();
    rideTypes.forEach((rt: RideType) => this.rideTypesCache.set(rt.code, rt));
    
    // Load fare configs
    const fareConfigs: RideFareConfig[] = await db.rideFareConfig.findMany({
      where: { isActive: true, effectiveTo: null },
    });
    this.fareConfigsCache.clear();
    fareConfigs.forEach((fc: RideFareConfig) => {
      const key = `${fc.rideTypeId}:${fc.countryCode}:${fc.cityCode || "default"}`;
      this.fareConfigsCache.set(key, fc);
    });
    
    // Load regulatory zones with their fee configs
    this.zonesCache = await db.regulatoryZone.findMany({
      where: { isActive: true },
      include: { feeConfigs: { where: { isActive: true, effectiveTo: null } } },
    });
    
    // Load fee rules
    this.feeRulesCache = await db.feeRule.findMany({
      where: { isActive: true, effectiveTo: null },
    });
    
    // Load toll configs
    this.tollConfigsCache = await db.tollConfig.findMany({
      where: { isActive: true },
    });
    
    // Set cache expiry to 5 minutes from now
    this.cacheExpiry = new Date(now.getTime() + 5 * 60 * 1000);
    console.log(`[FareCalculation] Cache refreshed: ${rideTypes.length} ride types, ${fareConfigs.length} fare configs, ${this.zonesCache.length} zones`);
  }
  
  /**
   * Get fare config for a ride type and location
   */
  private async getFareConfig(
    rideTypeId: string,
    countryCode: string,
    cityCode?: string
  ): Promise<RideFareConfig | null> {
    await this.refreshCache();
    
    // Try city-specific first
    if (cityCode) {
      const cityKey = `${rideTypeId}:${countryCode}:${cityCode}`;
      const cityConfig = this.fareConfigsCache.get(cityKey);
      if (cityConfig) return cityConfig;
    }
    
    // Fall back to country default
    const countryKey = `${rideTypeId}:${countryCode}:default`;
    return this.fareConfigsCache.get(countryKey) || null;
  }
  
  /**
   * Detect which regulatory zones a point falls into
   */
  private async detectZones(
    point: { lat: number; lng: number },
    isPickup: boolean
  ): Promise<Array<{ zone: RegulatoryZone; fees: RegulatoryFeeConfig[] }>> {
    await this.refreshCache();
    
    const matchedZones: Array<{ zone: RegulatoryZone; fees: RegulatoryFeeConfig[] }> = [];
    
    for (const zone of this.zonesCache) {
      // Quick bounding box check
      if (!isInBoundingBox(point, zone)) continue;
      
      // Full polygon check
      const polygon = zone.polygonCoordinates as { lat: number; lng: number }[];
      if (!isPointInPolygon(point, polygon)) continue;
      
      // Get applicable fees
      const fees = (zone as any).feeConfigs?.filter((fc: RegulatoryFeeConfig) => 
        isPickup ? fc.appliesToPickup : fc.appliesToDropoff
      ) || [];
      
      if (fees.length > 0) {
        matchedZones.push({ zone, fees });
      }
    }
    
    return matchedZones;
  }
  
  /**
   * Detect tolls on a route based on toll segment names
   */
  private async detectTolls(
    tollSegments: string[],
    rideTypeCode: RideTypeCode
  ): Promise<FeeBreakdownItem[]> {
    await this.refreshCache();
    
    const tolls: FeeBreakdownItem[] = [];
    
    for (const segmentName of tollSegments) {
      const normalizedName = segmentName.toLowerCase();
      
      // Find matching toll config
      const tollConfig = this.tollConfigsCache.find(tc => {
        if (tc.segmentIdentifier.toLowerCase().includes(normalizedName)) return true;
        if (normalizedName.includes(tc.segmentIdentifier.toLowerCase())) return true;
        // Check alternate identifiers
        return tc.alternateIdentifiers.some(alt => 
          alt.toLowerCase().includes(normalizedName) || 
          normalizedName.includes(alt.toLowerCase())
        );
      });
      
      if (tollConfig) {
        // Get rate for ride type
        let rate = 0;
        switch (rideTypeCode) {
          case "SAVER": rate = Number(tollConfig.tollRateSaver); break;
          case "STANDARD": rate = Number(tollConfig.tollRateStandard); break;
          case "COMFORT": rate = Number(tollConfig.tollRateComfort); break;
          case "XL": rate = Number(tollConfig.tollRateXL); break;
          case "PREMIUM": rate = Number(tollConfig.tollRatePremium); break;
        }
        
        if (rate > 0) {
          tolls.push({
            id: tollConfig.id,
            name: tollConfig.name,
            amount: rate,
            type: "flat",
            description: `Toll for ${tollConfig.name}`,
            paidToDriver: tollConfig.tollPaidToDriver,
          });
        }
      }
    }
    
    return tolls;
  }
  
  /**
   * Get additional fees (booking, safety, eco) for a location
   */
  private async getAdditionalFees(
    countryCode: string,
    cityCode?: string
  ): Promise<FeeRule[]> {
    await this.refreshCache();
    
    return this.feeRulesCache.filter(fr => {
      if (fr.countryCode !== countryCode) return false;
      // City-specific or default
      if (fr.cityCode && cityCode && fr.cityCode !== cityCode) return false;
      // Only include base fees, not cancellation/waiting
      return ["BOOKING_FEE", "SAFETY_FEE", "CLEAN_AIR_FEE", "ECO_FEE", "INSURANCE_SURCHARGE"].includes(fr.feeType);
    });
  }
  
  /**
   * Calculate fare for a single route
   */
  private async calculateRouteFare(
    route: RouteInfo,
    fareConfig: RideFareConfig,
    rideType: RideType,
    pickup: { lat: number; lng: number },
    dropoff: { lat: number; lng: number },
    surgeMultiplier: number,
    countryCode: string,
    cityCode?: string
  ): Promise<RouteFareBreakdown> {
    // 1. Calculate base fare components
    const baseFare = Number(fareConfig.baseFare);
    const distanceFare = roundCurrency(route.distanceMiles * Number(fareConfig.perMileRate));
    const timeFare = roundCurrency(route.durationMinutes * Number(fareConfig.perMinuteRate));
    
    // 2. Calculate traffic adjustment
    const trafficLevel = getTrafficLevel(route.durationMinutes, route.trafficDurationMinutes);
    let trafficMultiplier = 1;
    switch (trafficLevel) {
      case "light": trafficMultiplier = Number(fareConfig.trafficMultiplierLight); break;
      case "moderate": trafficMultiplier = Number(fareConfig.trafficMultiplierModerate); break;
      case "heavy": trafficMultiplier = Number(fareConfig.trafficMultiplierHeavy); break;
    }
    
    const tripCost = baseFare + distanceFare + timeFare;
    const trafficAdjusted = roundCurrency(tripCost * trafficMultiplier);
    const trafficAdjustment = roundCurrency(trafficAdjusted - tripCost);
    
    // 3. Apply surge multiplier (capped at max)
    const effectiveSurge = Math.min(surgeMultiplier, Number(fareConfig.maxSurgeMultiplier));
    const surgeAdjusted = roundCurrency(trafficAdjusted * effectiveSurge);
    const surgeAmount = roundCurrency(surgeAdjusted - trafficAdjusted);
    
    // 4. Detect tolls
    const tollsBreakdown = await this.detectTolls(route.tollSegments || [], rideType.code);
    const tollsTotal = roundCurrency(tollsBreakdown.reduce((sum, t) => sum + t.amount, 0));
    
    // 5. Detect regulatory zones and calculate fees
    const pickupZones = await this.detectZones(pickup, true);
    const dropoffZones = await this.detectZones(dropoff, false);
    
    // Combine unique zones
    const allZoneIds = new Set<string>();
    const matchedZoneIds: string[] = [];
    const regulatoryFeesBreakdown: FeeBreakdownItem[] = [];
    
    const processZoneFees = (zones: Array<{ zone: RegulatoryZone; fees: RegulatoryFeeConfig[] }>) => {
      for (const { zone, fees } of zones) {
        if (allZoneIds.has(zone.id)) continue;
        allZoneIds.add(zone.id);
        matchedZoneIds.push(zone.id);
        
        for (const fee of fees) {
          let amount = 0;
          if (fee.flatFeeAmount) {
            amount = Number(fee.flatFeeAmount);
          } else if (fee.percentFeeRate) {
            // Percent fee applied to subtotal before regulatory fees
            amount = roundCurrency(surgeAdjusted * Number(fee.percentFeeRate) / 100);
          }
          
          if (amount > 0) {
            regulatoryFeesBreakdown.push({
              id: fee.id,
              name: fee.displayName,
              amount,
              type: fee.flatFeeAmount ? "flat" : "percent",
              description: fee.description || undefined,
              isRegulatory: true,
            });
          }
        }
      }
    };
    
    processZoneFees(pickupZones);
    processZoneFees(dropoffZones);
    
    const regulatoryFeesTotal = roundCurrency(
      regulatoryFeesBreakdown.reduce((sum, f) => sum + f.amount, 0)
    );
    
    // 6. Get additional fees
    const additionalFeeRules = await this.getAdditionalFees(countryCode, cityCode);
    const additionalFeesBreakdown: FeeBreakdownItem[] = additionalFeeRules.map(rule => ({
      id: rule.id,
      name: rule.displayName,
      amount: Number(rule.flatAmount) || 0,
      type: "flat" as const,
      description: rule.description || undefined,
    }));
    const additionalFeesTotal = roundCurrency(
      additionalFeesBreakdown.reduce((sum, f) => sum + f.amount, 0)
    );
    
    // 7. Calculate subtotal (before service fee)
    const subtotal = roundCurrency(
      surgeAdjusted + tollsTotal + regulatoryFeesTotal + additionalFeesTotal
    );
    
    // 8. Calculate service fee
    let serviceFee = roundCurrency(subtotal * Number(fareConfig.serviceFeePercent) / 100);
    serviceFee = Math.max(serviceFee, Number(fareConfig.serviceFeeMinimum));
    serviceFee = Math.min(serviceFee, Number(fareConfig.serviceFeeMaximum));
    
    // 9. Calculate total fare
    const totalFare = roundCurrency(subtotal + serviceFee);
    
    // 10. Apply minimum fare
    const minimumFare = Number(fareConfig.minimumFare);
    const finalFare = Math.max(totalFare, minimumFare);
    
    // 11. Calculate driver payout (excludes regulatory fees, taxes, and SafeGo commission)
    const driverDistanceEarnings = roundCurrency(route.distanceMiles * Number(fareConfig.driverPerMileRate));
    const driverTimeEarnings = roundCurrency(route.durationMinutes * Number(fareConfig.driverPerMinuteRate));
    const driverTolls = tollsBreakdown
      .filter(t => t.paidToDriver)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const driverPayout = roundCurrency(driverDistanceEarnings + driverTimeEarnings + driverTolls);
    const safegoCommission = roundCurrency(finalFare - driverPayout - regulatoryFeesTotal);
    
    return {
      routeId: route.routeId,
      routeSummary: route.summary,
      distanceMiles: route.distanceMiles,
      durationMinutes: route.durationMinutes,
      trafficDurationMinutes: route.trafficDurationMinutes,
      
      baseFare,
      distanceFare,
      timeFare,
      
      trafficAdjustment,
      surgeAmount,
      surgeMultiplier: effectiveSurge,
      
      tollsTotal,
      tollsBreakdown,
      regulatoryFeesTotal,
      regulatoryFeesBreakdown,
      additionalFeesTotal,
      additionalFeesBreakdown,
      serviceFee,
      
      discountAmount: 0, // TODO: Implement promo codes
      
      subtotal,
      totalFare: finalFare,
      
      driverPayout,
      safegoCommission,
      
      matchedZoneIds,
    };
  }
  
  /**
   * Calculate fares for all route alternatives
   */
  async calculateFares(request: FareCalculationRequest): Promise<FareCalculationResult> {
    const startTime = Date.now();
    
    try {
      await this.refreshCache();
      
      // Get ride type
      const rideType = this.rideTypesCache.get(request.rideTypeCode);
      if (!rideType) {
        throw new Error(`Invalid ride type: ${request.rideTypeCode}`);
      }
      
      // Get fare config
      const fareConfig = await this.getFareConfig(
        rideType.id,
        request.countryCode || "US",
        request.cityCode
      );
      if (!fareConfig) {
        throw new Error(`No fare configuration found for ${request.rideTypeCode} in ${request.countryCode}`);
      }
      
      const pickup = { lat: request.pickupLat, lng: request.pickupLng };
      const dropoff = { lat: request.dropoffLat, lng: request.dropoffLng };
      const surgeMultiplier = request.surgeMultiplier || 1;
      
      // Calculate fare for each route
      const routeFares: RouteFareBreakdown[] = [];
      
      for (const route of request.routes) {
        const fare = await this.calculateRouteFare(
          route,
          fareConfig,
          rideType,
          pickup,
          dropoff,
          surgeMultiplier,
          request.countryCode || "US",
          request.cityCode
        );
        routeFares.push(fare);
      }
      
      // Determine cheapest and fastest
      let cheapestRouteId: string | undefined;
      let fastestRouteId: string | undefined;
      let minFare = Infinity;
      let minDuration = Infinity;
      
      for (const fare of routeFares) {
        if (fare.totalFare < minFare) {
          minFare = fare.totalFare;
          cheapestRouteId = fare.routeId;
        }
        if (fare.durationMinutes < minDuration) {
          minDuration = fare.durationMinutes;
          fastestRouteId = fare.routeId;
        }
      }
      
      // Mark cheapest and fastest
      for (const fare of routeFares) {
        fare.isCheapest = fare.routeId === cheapestRouteId;
        fare.isFastest = fare.routeId === fastestRouteId;
      }
      
      const elapsed = Date.now() - startTime;
      console.log(`[FareCalculation] Calculated ${routeFares.length} route fares in ${elapsed}ms`);
      
      return {
        success: true,
        rideType: {
          code: rideType.code,
          name: rideType.name,
          description: rideType.description || undefined,
          capacity: rideType.capacity,
        },
        routeFares,
        cheapestRouteId,
        fastestRouteId,
        currency: "USD",
        calculatedAt: new Date(),
      };
    } catch (error) {
      console.error("[FareCalculation] Error calculating fares:", error);
      throw error;
    }
  }
  
  /**
   * Calculate fares for all ride types and all routes
   * Returns a comprehensive fare matrix
   */
  async calculateAllFares(
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number,
    routes: RouteInfo[],
    surgeMultiplier?: number,
    countryCode?: string,
    cityCode?: string
  ): Promise<Map<RideTypeCode, FareCalculationResult>> {
    await this.refreshCache();
    
    const results = new Map<RideTypeCode, FareCalculationResult>();
    const rideTypeCodes: RideTypeCode[] = ["SAVER", "STANDARD", "COMFORT", "XL", "PREMIUM"];
    
    for (const code of rideTypeCodes) {
      if (!this.rideTypesCache.has(code)) continue;
      
      try {
        const result = await this.calculateFares({
          pickupLat,
          pickupLng,
          dropoffLat,
          dropoffLng,
          rideTypeCode: code,
          routes,
          countryCode,
          cityCode,
          surgeMultiplier,
        });
        results.set(code, result);
      } catch (error) {
        console.error(`[FareCalculation] Error calculating fares for ${code}:`, error);
      }
    }
    
    return results;
  }
  
  /**
   * Log fare calculation for audit trail
   */
  async logFareCalculation(
    result: FareCalculationResult,
    request: FareCalculationRequest,
    selectedRouteId?: string,
    customerId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    const selectedFare = result.routeFares.find(f => f.routeId === selectedRouteId) || result.routeFares[0];
    
    // Use type assertion for new Prisma model
    const db = prisma as any;
    const log = await db.fareCalculationLog.create({
      data: {
        customerId,
        pickupLat: request.pickupLat,
        pickupLng: request.pickupLng,
        dropoffLat: request.dropoffLat,
        dropoffLng: request.dropoffLng,
        routeId: selectedRouteId,
        distanceMiles: selectedFare.distanceMiles,
        durationMinutes: selectedFare.durationMinutes,
        trafficDurationMinutes: selectedFare.trafficDurationMinutes,
        rideTypeCode: request.rideTypeCode,
        selectedRouteType: selectedRouteId,
        fareBreakdown: selectedFare as any,
        baseFare: selectedFare.baseFare,
        distanceFare: selectedFare.distanceFare,
        timeFare: selectedFare.timeFare,
        trafficAdjustment: selectedFare.trafficAdjustment,
        surgeAmount: selectedFare.surgeAmount,
        surgeMultiplier: selectedFare.surgeMultiplier,
        tollsTotal: selectedFare.tollsTotal,
        regulatoryFeesTotal: selectedFare.regulatoryFeesTotal,
        serviceFee: selectedFare.serviceFee,
        discountAmount: selectedFare.discountAmount,
        totalFare: selectedFare.totalFare,
        driverPayout: selectedFare.driverPayout,
        safegoCommission: selectedFare.safegoCommission,
        matchedZones: selectedFare.matchedZoneIds,
        appliedFees: {
          tolls: selectedFare.tollsBreakdown,
          regulatory: selectedFare.regulatoryFeesBreakdown,
          additional: selectedFare.additionalFeesBreakdown,
        },
        routeAlternatives: result.routeFares,
        ipAddress,
        userAgent,
      },
    });
    
    return log.id;
  }
}

// Export singleton instance
export const fareCalculationService = FareCalculationService.getInstance();
