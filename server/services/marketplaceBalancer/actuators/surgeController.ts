/**
 * SafeGo AI Marketplace Balancer - Surge Controller Actuator
 * 
 * Automatically adjusts surge pricing based on AI predictions:
 * - Gradual increase when demand > supply
 * - Reduction when supply > demand
 * - Always below Uber surge (competitive advantage)
 * - Never exceeds SafeGo surge cap (1.90x)
 */

import {
  SurgeDecision,
  DemandForecast,
  SupplyForecast,
  SupplyGap,
  ZoneMetrics,
  SafetyGuardsConfig,
  DEFAULT_SAFETY_GUARDS,
} from '@shared/marketplace';
import { safetyGuards } from '../safetyGuards';
import { marketplaceState } from '../stateStore';

// ========================================
// SURGE ADJUSTMENT PARAMETERS
// ========================================

interface SurgeAdjustmentParams {
  maxStepUp: number;
  maxStepDown: number;
  baseThresholdRatio: number;
  criticalThresholdRatio: number;
  targetUberGap: number;
}

const DEFAULT_SURGE_PARAMS: SurgeAdjustmentParams = {
  maxStepUp: 0.10,
  maxStepDown: 0.15,
  baseThresholdRatio: 0.8,
  criticalThresholdRatio: 0.5,
  targetUberGap: 0.10,
};

// ========================================
// SURGE CONTROLLER CLASS
// ========================================

export class SurgeController {
  private params: SurgeAdjustmentParams;
  private guards: SafetyGuardsConfig;
  private estimatedUberSurge: Map<string, number> = new Map();

  constructor(
    params: SurgeAdjustmentParams = DEFAULT_SURGE_PARAMS,
    guards: SafetyGuardsConfig = DEFAULT_SAFETY_GUARDS
  ) {
    this.params = params;
    this.guards = guards;
  }

  // ========================================
  // MAIN DECISION LOGIC
  // ========================================

  calculateSurgeDecision(
    zoneMetrics: ZoneMetrics,
    demandForecast: DemandForecast,
    supplyForecast: SupplyForecast,
    supplyGap: SupplyGap
  ): SurgeDecision {
    const zoneId = zoneMetrics.zoneId;
    const currentSurge = marketplaceState.getActiveSurge(zoneId);
    
    // Calculate target surge based on supply/demand ratio
    const targetSurge = this.calculateTargetSurge(
      zoneMetrics,
      demandForecast,
      supplyForecast,
      supplyGap
    );
    
    // Apply gradual adjustment (no sudden jumps)
    const adjustedSurge = this.applyGradualAdjustment(currentSurge, targetSurge);
    
    // Ensure we stay below estimated Uber surge
    const uberSurge = this.estimateUberSurge(zoneMetrics, demandForecast);
    const competitiveSurge = Math.min(adjustedSurge, uberSurge - this.params.targetUberGap);
    
    // Apply safety guards
    const safeResult = safetyGuards.validateSurge(
      {
        zoneId,
        currentMultiplier: currentSurge,
        recommendedMultiplier: Math.max(1.0, competitiveSurge),
        reason: this.getSurgeReason(demandForecast, supplyForecast, supplyGap),
        factors: this.getSurgeFactors(demandForecast, supplyForecast, supplyGap),
        confidenceScore: demandForecast.confidenceScore,
      },
      uberSurge
    );
    
    return safeResult.corrected;
  }

  private calculateTargetSurge(
    zoneMetrics: ZoneMetrics,
    demandForecast: DemandForecast,
    supplyForecast: SupplyForecast,
    supplyGap: SupplyGap
  ): number {
    const ratio = zoneMetrics.supplyDemandRatio;
    
    // No surge needed if supply exceeds demand
    if (ratio >= 1.2) return 1.0;
    
    // Critical shortage - maximum allowed surge
    if (ratio < this.params.criticalThresholdRatio || supplyGap.severity === 'severe') {
      return this.guards.maxSurgeMultiplier;
    }
    
    // Moderate shortage - scaled surge
    if (ratio < this.params.baseThresholdRatio || supplyGap.severity === 'moderate') {
      const severity = 1 - (ratio / this.params.baseThresholdRatio);
      const maxIncrease = this.guards.maxSurgeMultiplier - 1;
      return 1 + (severity * maxIncrease * 0.7);
    }
    
    // Slight shortage - mild surge
    if (supplyGap.severity === 'minor') {
      return 1.15;
    }
    
    // Demand spike predicted
    if (demandForecast.predictedLevel === 'extreme') {
      return 1.5;
    }
    if (demandForecast.predictedLevel === 'high') {
      return 1.25;
    }
    
    return 1.0;
  }

  private applyGradualAdjustment(current: number, target: number): number {
    const diff = target - current;
    
    if (diff > 0) {
      // Increasing surge - be conservative
      return current + Math.min(diff, this.params.maxStepUp);
    } else if (diff < 0) {
      // Decreasing surge - can be faster
      return current + Math.max(diff, -this.params.maxStepDown);
    }
    
    return current;
  }

  private estimateUberSurge(
    zoneMetrics: ZoneMetrics,
    demandForecast: DemandForecast
  ): number {
    // Estimate what Uber's surge would be based on market conditions
    // This is a simplified model - in production would use actual competitor data
    
    const baseUberSurge = 1.0;
    const ratio = zoneMetrics.supplyDemandRatio;
    
    if (ratio >= 1.0) return baseUberSurge;
    
    // Uber typically surges more aggressively
    const severityMultiplier = 1 - ratio;
    const uberMaxSurge = 3.0; // Uber can go up to 3x or higher
    
    let estimatedSurge = baseUberSurge + (severityMultiplier * (uberMaxSurge - 1));
    
    // Adjust for demand level
    if (demandForecast.predictedLevel === 'extreme') {
      estimatedSurge *= 1.3;
    } else if (demandForecast.predictedLevel === 'high') {
      estimatedSurge *= 1.15;
    }
    
    // Store for later reference
    this.estimatedUberSurge.set(zoneMetrics.zoneId, estimatedSurge);
    
    return Math.min(estimatedSurge, 3.0);
  }

  private getSurgeReason(
    demandForecast: DemandForecast,
    supplyForecast: SupplyForecast,
    supplyGap: SupplyGap
  ): string {
    if (supplyGap.severity === 'severe') {
      return 'Critical driver shortage in zone';
    }
    if (supplyGap.severity === 'moderate') {
      return 'Moderate supply gap detected';
    }
    if (demandForecast.predictedLevel === 'extreme') {
      return 'Extreme demand predicted';
    }
    if (demandForecast.predictedLevel === 'high') {
      return 'High demand predicted';
    }
    if (supplyForecast.shortageRisk > 0.5) {
      return 'Supply shortage risk detected';
    }
    return 'Market conditions balanced';
  }

  private getSurgeFactors(
    demandForecast: DemandForecast,
    supplyForecast: SupplyForecast,
    supplyGap: SupplyGap
  ): string[] {
    const factors: string[] = [];
    
    if (demandForecast.predictedLevel === 'extreme' || demandForecast.predictedLevel === 'high') {
      factors.push(`${demandForecast.predictedLevel} demand`);
    }
    
    if (supplyForecast.predictedLevel === 'critical' || supplyForecast.predictedLevel === 'low') {
      factors.push(`${supplyForecast.predictedLevel} supply`);
    }
    
    if (supplyGap.severity !== 'none') {
      factors.push(`${supplyGap.severity} supply gap`);
    }
    
    for (const factor of demandForecast.factors) {
      factors.push(factor.description);
    }
    
    return factors;
  }

  // ========================================
  // BATCH PROCESSING
  // ========================================

  calculateAllSurgeDecisions(
    zones: ZoneMetrics[],
    demandForecasts: Map<string, DemandForecast>,
    supplyForecasts: Map<string, SupplyForecast>,
    supplyGaps: Map<string, SupplyGap>
  ): SurgeDecision[] {
    return zones.map(zone => {
      const demandForecast = demandForecasts.get(zone.zoneId);
      const supplyForecast = supplyForecasts.get(zone.zoneId);
      const supplyGap = supplyGaps.get(zone.zoneId);
      
      if (!demandForecast || !supplyForecast || !supplyGap) {
        return {
          zoneId: zone.zoneId,
          currentMultiplier: marketplaceState.getActiveSurge(zone.zoneId),
          recommendedMultiplier: 1.0,
          reason: 'Insufficient data for prediction',
          factors: [],
          confidenceScore: 0,
        };
      }
      
      return this.calculateSurgeDecision(zone, demandForecast, supplyForecast, supplyGap);
    });
  }

  // ========================================
  // APPLICATION
  // ========================================

  applySurgeDecision(decision: SurgeDecision): void {
    decision.appliedAt = new Date();
    marketplaceState.applySurgeDecision(decision);
  }

  applyAllSurgeDecisions(decisions: SurgeDecision[]): void {
    for (const decision of decisions) {
      this.applySurgeDecision(decision);
    }
  }

  // ========================================
  // UTILITIES
  // ========================================

  getEstimatedUberSurge(zoneId: string): number {
    return this.estimatedUberSurge.get(zoneId) ?? 1.0;
  }

  updateParams(params: Partial<SurgeAdjustmentParams>): void {
    this.params = { ...this.params, ...params };
  }
}

// Singleton instance
export const surgeController = new SurgeController();

export default surgeController;
