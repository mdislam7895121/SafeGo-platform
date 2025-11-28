/**
 * SafeGo AI Marketplace Balancer - Safety Guards
 * 
 * Critical safety validations that MUST NEVER be violated:
 * - Maximum surge cap (1.90x)
 * - Maximum commission cap (18%)
 * - Minimum driver payout
 * - Price fairness rules
 * - Marketplace stability rules
 */

import {
  SafetyGuardsConfig,
  SafetyGuardViolation,
  SurgeDecision,
  CommissionDecision,
  IncentiveDecision,
  DEFAULT_SAFETY_GUARDS,
} from '@shared/marketplace';
import { marketplaceState } from './stateStore';

// ========================================
// SAFETY GUARD VALIDATOR
// ========================================

export class SafetyGuardValidator {
  private config: SafetyGuardsConfig;
  private violationCount: number = 0;

  constructor(config: SafetyGuardsConfig = DEFAULT_SAFETY_GUARDS) {
    this.config = config;
  }

  updateConfig(config: Partial<SafetyGuardsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SafetyGuardsConfig {
    return { ...this.config };
  }

  // ========================================
  // SURGE VALIDATION
  // ========================================

  validateSurge(decision: SurgeDecision, uberSurge?: number): {
    valid: boolean;
    corrected: SurgeDecision;
    violation?: SafetyGuardViolation;
  } {
    let correctedMultiplier = decision.recommendedMultiplier;
    let violation: SafetyGuardViolation | undefined;

    // Check maximum surge cap
    if (correctedMultiplier > this.config.maxSurgeMultiplier) {
      violation = {
        guardType: 'surge_cap',
        originalValue: correctedMultiplier,
        correctedValue: this.config.maxSurgeMultiplier,
        threshold: this.config.maxSurgeMultiplier,
        reason: `Surge ${correctedMultiplier.toFixed(2)}x exceeds maximum cap of ${this.config.maxSurgeMultiplier}x`,
        timestamp: new Date(),
      };
      correctedMultiplier = this.config.maxSurgeMultiplier;
    }

    // Check minimum surge
    if (correctedMultiplier < this.config.minSurgeMultiplier) {
      correctedMultiplier = this.config.minSurgeMultiplier;
    }

    // Ensure SafeGo surge is below Uber surge (competitive advantage)
    if (uberSurge !== undefined && correctedMultiplier >= uberSurge) {
      const targetSurge = Math.max(
        this.config.minSurgeMultiplier,
        uberSurge - this.config.surgeCapBelowUber
      );
      
      if (!violation) {
        violation = {
          guardType: 'stability',
          originalValue: correctedMultiplier,
          correctedValue: targetSurge,
          threshold: uberSurge,
          reason: `Surge ${correctedMultiplier.toFixed(2)}x must stay below Uber surge ${uberSurge.toFixed(2)}x`,
          timestamp: new Date(),
        };
      }
      correctedMultiplier = targetSurge;
    }

    if (violation) {
      this.recordViolation(violation);
    }

    return {
      valid: !violation,
      corrected: {
        ...decision,
        recommendedMultiplier: Math.round(correctedMultiplier * 100) / 100,
      },
      violation,
    };
  }

  // ========================================
  // COMMISSION VALIDATION
  // ========================================

  validateCommission(decision: CommissionDecision): {
    valid: boolean;
    corrected: CommissionDecision;
    violation?: SafetyGuardViolation;
  } {
    let correctedRate = decision.recommendedRate;
    let violation: SafetyGuardViolation | undefined;

    // Check maximum commission cap
    if (correctedRate > this.config.maxCommissionPercent) {
      violation = {
        guardType: 'commission_cap',
        originalValue: correctedRate,
        correctedValue: this.config.maxCommissionPercent,
        threshold: this.config.maxCommissionPercent,
        reason: `Commission ${correctedRate}% exceeds maximum cap of ${this.config.maxCommissionPercent}%`,
        timestamp: new Date(),
      };
      correctedRate = this.config.maxCommissionPercent;
    }

    // Check minimum commission
    if (correctedRate < this.config.minCommissionPercent) {
      if (!violation) {
        violation = {
          guardType: 'commission_cap',
          originalValue: correctedRate,
          correctedValue: this.config.minCommissionPercent,
          threshold: this.config.minCommissionPercent,
          reason: `Commission ${correctedRate}% below minimum of ${this.config.minCommissionPercent}%`,
          timestamp: new Date(),
        };
      }
      correctedRate = this.config.minCommissionPercent;
    }

    if (violation) {
      this.recordViolation(violation);
    }

    return {
      valid: !violation,
      corrected: {
        ...decision,
        recommendedRate: Math.round(correctedRate * 10) / 10,
      },
      violation,
    };
  }

  // ========================================
  // DRIVER PAYOUT VALIDATION
  // ========================================

  validateDriverPayout(
    baseFare: number,
    commission: number,
    incentives: number
  ): {
    valid: boolean;
    adjustedCommission: number;
    adjustedIncentives: number;
    violation?: SafetyGuardViolation;
  } {
    const driverPayout = baseFare * (1 - commission / 100) + incentives;
    
    if (driverPayout >= this.config.minDriverPayout) {
      return {
        valid: true,
        adjustedCommission: commission,
        adjustedIncentives: incentives,
      };
    }

    // Calculate adjustment needed
    const shortfall = this.config.minDriverPayout - driverPayout;
    
    // First try adding incentives
    const adjustedIncentives = incentives + shortfall;
    
    // If that's not enough, reduce commission
    let adjustedCommission = commission;
    if (baseFare * (1 - commission / 100) + adjustedIncentives < this.config.minDriverPayout) {
      // Calculate required commission reduction
      const requiredDriverShare = (this.config.minDriverPayout - adjustedIncentives) / baseFare;
      adjustedCommission = Math.max(
        this.config.minCommissionPercent,
        (1 - requiredDriverShare) * 100
      );
    }

    const violation: SafetyGuardViolation = {
      guardType: 'driver_payout',
      originalValue: driverPayout,
      correctedValue: this.config.minDriverPayout,
      threshold: this.config.minDriverPayout,
      reason: `Driver payout $${driverPayout.toFixed(2)} below minimum $${this.config.minDriverPayout.toFixed(2)}`,
      timestamp: new Date(),
    };

    this.recordViolation(violation);

    return {
      valid: false,
      adjustedCommission: Math.round(adjustedCommission * 10) / 10,
      adjustedIncentives: Math.round(adjustedIncentives * 100) / 100,
      violation,
    };
  }

  // ========================================
  // PRICE FAIRNESS VALIDATION
  // ========================================

  validatePriceFairness(
    originalFare: number,
    adjustedFare: number
  ): {
    valid: boolean;
    correctedFare: number;
    violation?: SafetyGuardViolation;
  } {
    const increasePercent = ((adjustedFare - originalFare) / originalFare) * 100;
    
    if (increasePercent <= this.config.maxPriceIncreasePercent) {
      return {
        valid: true,
        correctedFare: adjustedFare,
      };
    }

    const correctedFare = originalFare * (1 + this.config.maxPriceIncreasePercent / 100);

    const violation: SafetyGuardViolation = {
      guardType: 'price_fairness',
      originalValue: adjustedFare,
      correctedValue: correctedFare,
      threshold: this.config.maxPriceIncreasePercent,
      reason: `Price increase ${increasePercent.toFixed(1)}% exceeds max ${this.config.maxPriceIncreasePercent}%`,
      timestamp: new Date(),
    };

    this.recordViolation(violation);

    return {
      valid: false,
      correctedFare: Math.round(correctedFare * 100) / 100,
      violation,
    };
  }

  // ========================================
  // INCENTIVE BUDGET VALIDATION
  // ========================================

  validateIncentiveBudget(
    totalIncentivesThisHour: number,
    proposedIncentive: number
  ): {
    valid: boolean;
    allowedAmount: number;
    violation?: SafetyGuardViolation;
  } {
    const projectedTotal = totalIncentivesThisHour + proposedIncentive;
    
    if (projectedTotal <= this.config.maxIncentiveBudgetPerHour) {
      return {
        valid: true,
        allowedAmount: proposedIncentive,
      };
    }

    const allowedAmount = Math.max(0, this.config.maxIncentiveBudgetPerHour - totalIncentivesThisHour);

    const violation: SafetyGuardViolation = {
      guardType: 'stability',
      originalValue: proposedIncentive,
      correctedValue: allowedAmount,
      threshold: this.config.maxIncentiveBudgetPerHour,
      reason: `Incentive budget exceeded. Requested: $${proposedIncentive}, Allowed: $${allowedAmount}`,
      timestamp: new Date(),
    };

    this.recordViolation(violation);

    return {
      valid: false,
      allowedAmount: Math.round(allowedAmount * 100) / 100,
      violation,
    };
  }

  // ========================================
  // MARKETPLACE STABILITY
  // ========================================

  validateMarketplaceStability(
    balanceScore: number
  ): {
    stable: boolean;
    forceRebalance: boolean;
    violation?: SafetyGuardViolation;
  } {
    if (balanceScore >= this.config.forceBalanceThreshold) {
      return {
        stable: true,
        forceRebalance: false,
      };
    }

    const violation: SafetyGuardViolation = {
      guardType: 'stability',
      originalValue: balanceScore,
      correctedValue: this.config.forceBalanceThreshold,
      threshold: this.config.forceBalanceThreshold,
      reason: `Marketplace balance score ${balanceScore.toFixed(2)} below stability threshold`,
      timestamp: new Date(),
    };

    this.recordViolation(violation);

    return {
      stable: false,
      forceRebalance: true,
      violation,
    };
  }

  // ========================================
  // BATCH VALIDATION
  // ========================================

  validateAllDecisions(
    surgeDecisions: SurgeDecision[],
    commissionDecisions: CommissionDecision[],
    incentiveDecisions: IncentiveDecision[]
  ): {
    correctedSurge: SurgeDecision[];
    correctedCommission: CommissionDecision[];
    correctedIncentives: IncentiveDecision[];
    violations: SafetyGuardViolation[];
  } {
    const violations: SafetyGuardViolation[] = [];
    
    const correctedSurge = surgeDecisions.map(decision => {
      const result = this.validateSurge(decision);
      if (result.violation) violations.push(result.violation);
      return result.corrected;
    });

    const correctedCommission = commissionDecisions.map(decision => {
      const result = this.validateCommission(decision);
      if (result.violation) violations.push(result.violation);
      return result.corrected;
    });

    // Incentives are validated as-is (budget validation done separately)
    const correctedIncentives = [...incentiveDecisions];

    return {
      correctedSurge,
      correctedCommission,
      correctedIncentives,
      violations,
    };
  }

  // ========================================
  // VIOLATION TRACKING
  // ========================================

  private recordViolation(violation: SafetyGuardViolation): void {
    this.violationCount++;
    marketplaceState.recordViolation(violation);
  }

  getViolationCount(): number {
    return this.violationCount;
  }

  resetViolationCount(): void {
    this.violationCount = 0;
  }

  getRecentViolations(count: number = 10): SafetyGuardViolation[] {
    return marketplaceState.getRecentViolations(count);
  }
}

// Singleton instance
export const safetyGuards = new SafetyGuardValidator();

export default safetyGuards;
