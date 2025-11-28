/**
 * SafeGo AI Marketplace Balancer - Commission Controller Actuator
 * 
 * Dynamically adjusts SafeGo commission based on demand:
 * - Lower commission during low demand (incentivize drivers)
 * - Higher commission during high demand (maximize revenue)
 * - Always within safe limits (10-18%)
 * - Protects minimum driver payout
 */

import {
  CommissionDecision,
  DemandForecast,
  SupplyForecast,
  ZoneMetrics,
  DemandLevel,
  SafetyGuardsConfig,
  DEFAULT_SAFETY_GUARDS,
} from '@shared/marketplace';
import { safetyGuards } from '../safetyGuards';
import { marketplaceState } from '../stateStore';

// ========================================
// COMMISSION BANDS
// ========================================

interface CommissionBand {
  demandLevel: DemandLevel;
  minRate: number;
  maxRate: number;
  targetRate: number;
}

const COMMISSION_BANDS: CommissionBand[] = [
  { demandLevel: 'low', minRate: 10, maxRate: 12, targetRate: 10 },
  { demandLevel: 'normal', minRate: 12, maxRate: 15, targetRate: 14 },
  { demandLevel: 'high', minRate: 15, maxRate: 17, targetRate: 16 },
  { demandLevel: 'extreme', minRate: 16, maxRate: 18, targetRate: 17 },
];

// ========================================
// COMMISSION CONTROLLER CLASS
// ========================================

export class CommissionController {
  private guards: SafetyGuardsConfig;
  private adjustmentStep: number = 0.5;
  private maxDailyAdjustments: number = 10;
  private adjustmentCount: Map<string, number> = new Map();
  private lastResetDate: string = '';

  constructor(guards: SafetyGuardsConfig = DEFAULT_SAFETY_GUARDS) {
    this.guards = guards;
  }

  // ========================================
  // MAIN DECISION LOGIC
  // ========================================

  calculateCommissionDecision(
    zoneMetrics: ZoneMetrics,
    demandForecast: DemandForecast,
    supplyForecast: SupplyForecast
  ): CommissionDecision {
    const zoneId = zoneMetrics.zoneId;
    const currentRate = marketplaceState.getActiveCommission(zoneId);
    
    // Reset daily adjustment counter
    this.checkDailyReset();
    
    // Find appropriate commission band based on demand
    const band = this.getCommissionBand(demandForecast.predictedLevel);
    
    // Calculate target rate
    let targetRate = this.calculateTargetRate(
      band,
      demandForecast,
      supplyForecast,
      zoneMetrics
    );
    
    // Apply gradual adjustment
    targetRate = this.applyGradualAdjustment(currentRate, targetRate, zoneId);
    
    // Create decision
    const decision: CommissionDecision = {
      zoneId,
      currentRate,
      recommendedRate: targetRate,
      reason: this.getCommissionReason(demandForecast, band),
      demandLevel: demandForecast.predictedLevel,
      confidenceScore: demandForecast.confidenceScore,
    };
    
    // Apply safety guards
    const safeResult = safetyGuards.validateCommission(decision);
    
    return safeResult.corrected;
  }

  private getCommissionBand(demandLevel: DemandLevel): CommissionBand {
    return COMMISSION_BANDS.find(b => b.demandLevel === demandLevel) || COMMISSION_BANDS[1];
  }

  private calculateTargetRate(
    band: CommissionBand,
    demandForecast: DemandForecast,
    supplyForecast: SupplyForecast,
    zoneMetrics: ZoneMetrics
  ): number {
    let targetRate = band.targetRate;
    
    // Adjust based on supply situation
    if (supplyForecast.shortageRisk > 0.7) {
      // High shortage risk - reduce commission to attract drivers
      targetRate = Math.max(band.minRate, targetRate - 1);
    } else if (supplyForecast.predictedLevel === 'surplus') {
      // Surplus supply - can increase commission slightly
      targetRate = Math.min(band.maxRate, targetRate + 0.5);
    }
    
    // Adjust based on conversion rate
    if (zoneMetrics.demand.requestConversionRate < 0.7) {
      // Low conversion - reduce commission to improve driver availability
      targetRate = Math.max(band.minRate, targetRate - 0.5);
    }
    
    // Adjust based on confidence
    if (demandForecast.confidenceScore < 0.6) {
      // Low confidence - be more conservative
      targetRate = (targetRate + band.targetRate) / 2;
    }
    
    return Math.round(targetRate * 10) / 10;
  }

  private applyGradualAdjustment(
    current: number,
    target: number,
    zoneId: string
  ): number {
    // Check if we've hit daily adjustment limit
    const adjustments = this.adjustmentCount.get(zoneId) || 0;
    if (adjustments >= this.maxDailyAdjustments) {
      return current;
    }
    
    const diff = target - current;
    
    if (Math.abs(diff) < 0.1) {
      return current;
    }
    
    let adjusted: number;
    if (diff > 0) {
      adjusted = Math.min(current + this.adjustmentStep, target);
    } else {
      adjusted = Math.max(current - this.adjustmentStep, target);
    }
    
    // Track adjustment
    if (adjusted !== current) {
      this.adjustmentCount.set(zoneId, adjustments + 1);
    }
    
    return adjusted;
  }

  private getCommissionReason(
    demandForecast: DemandForecast,
    band: CommissionBand
  ): string {
    const demandLabel = {
      low: 'Low demand period - reduced commission to attract drivers',
      normal: 'Normal demand - standard commission rate',
      high: 'High demand detected - optimized commission',
      extreme: 'Extreme demand - maximum sustainable commission',
    };
    
    return demandLabel[demandForecast.predictedLevel];
  }

  private checkDailyReset(): void {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastResetDate) {
      this.adjustmentCount.clear();
      this.lastResetDate = today;
    }
  }

  // ========================================
  // BATCH PROCESSING
  // ========================================

  calculateAllCommissionDecisions(
    zones: ZoneMetrics[],
    demandForecasts: Map<string, DemandForecast>,
    supplyForecasts: Map<string, SupplyForecast>
  ): CommissionDecision[] {
    return zones.map(zone => {
      const demandForecast = demandForecasts.get(zone.zoneId);
      const supplyForecast = supplyForecasts.get(zone.zoneId);
      
      if (!demandForecast || !supplyForecast) {
        return {
          zoneId: zone.zoneId,
          currentRate: marketplaceState.getActiveCommission(zone.zoneId),
          recommendedRate: 15,
          reason: 'Insufficient data - using default rate',
          demandLevel: 'normal' as DemandLevel,
          confidenceScore: 0,
        };
      }
      
      return this.calculateCommissionDecision(zone, demandForecast, supplyForecast);
    });
  }

  // ========================================
  // APPLICATION
  // ========================================

  applyCommissionDecision(decision: CommissionDecision): void {
    decision.appliedAt = new Date();
    marketplaceState.applyCommissionDecision(decision);
  }

  applyAllCommissionDecisions(decisions: CommissionDecision[]): void {
    for (const decision of decisions) {
      this.applyCommissionDecision(decision);
    }
  }

  // ========================================
  // UTILITIES
  // ========================================

  getAdjustmentCount(zoneId: string): number {
    return this.adjustmentCount.get(zoneId) || 0;
  }

  getRemainingAdjustments(zoneId: string): number {
    return this.maxDailyAdjustments - this.getAdjustmentCount(zoneId);
  }

  setMaxDailyAdjustments(max: number): void {
    this.maxDailyAdjustments = max;
  }

  setAdjustmentStep(step: number): void {
    this.adjustmentStep = step;
  }
}

// Singleton instance
export const commissionController = new CommissionController();

export default commissionController;
