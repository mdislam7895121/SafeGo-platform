/**
 * SafeGo AI Marketplace Balancer - Incentive Controller Actuator
 * 
 * Intelligently activates driver incentives only where needed:
 * - Boost zones in shortage areas
 * - Weather bonuses during bad weather
 * - Late night bonuses when supply drops
 * - Airport bonuses for queue management
 * - Supply boost for critical shortages
 */

import {
  IncentiveDecision,
  DemandForecast,
  SupplyForecast,
  SupplyGap,
  ZoneMetrics,
  WeatherCondition,
  SafetyGuardsConfig,
  DEFAULT_SAFETY_GUARDS,
} from '@shared/marketplace';
import { marketplaceState } from '../stateStore';

// ========================================
// INCENTIVE PARAMETERS
// ========================================

interface IncentiveParams {
  boostZoneThreshold: number;
  weatherBonusAmount: number;
  lateNightBonusAmount: number;
  airportBonusAmount: number;
  supplyBoostAmount: number;
  supplyBoostDuration: number;
  maxIncentivesPerZone: number;
}

const DEFAULT_INCENTIVE_PARAMS: IncentiveParams = {
  boostZoneThreshold: 0.4,
  weatherBonusAmount: 2.00,
  lateNightBonusAmount: 3.00,
  airportBonusAmount: 4.00,
  supplyBoostAmount: 5.00,
  supplyBoostDuration: 30,
  maxIncentivesPerZone: 3,
};

// ========================================
// INCENTIVE CONTROLLER CLASS
// ========================================

export class IncentiveController {
  private params: IncentiveParams;
  private guards: SafetyGuardsConfig;
  private totalIncentivesThisHour: number = 0;
  private lastHourReset: number = 0;

  constructor(
    params: IncentiveParams = DEFAULT_INCENTIVE_PARAMS,
    guards: SafetyGuardsConfig = DEFAULT_SAFETY_GUARDS
  ) {
    this.params = params;
    this.guards = guards;
  }

  // ========================================
  // MAIN DECISION LOGIC
  // ========================================

  calculateIncentiveDecisions(
    zoneMetrics: ZoneMetrics,
    demandForecast: DemandForecast,
    supplyForecast: SupplyForecast,
    supplyGap: SupplyGap,
    weather: WeatherCondition
  ): IncentiveDecision[] {
    const decisions: IncentiveDecision[] = [];
    const zoneId = zoneMetrics.zoneId;
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    
    // Reset hourly budget tracking
    this.checkHourlyReset();
    
    // Check existing active incentives
    const activeIncentives = marketplaceState.getActiveIncentives(zoneId);
    const activeTypes = new Set(activeIncentives.map(i => i.incentiveType));
    
    // 1. Boost Zone Decision
    const boostDecision = this.evaluateBoostZone(
      zoneId, zoneMetrics, supplyGap, activeTypes.has('boost_zone')
    );
    if (boostDecision) decisions.push(boostDecision);
    
    // 2. Weather Bonus Decision
    const weatherDecision = this.evaluateWeatherBonus(
      zoneId, weather, supplyGap, activeTypes.has('weather_bonus')
    );
    if (weatherDecision) decisions.push(weatherDecision);
    
    // 3. Late Night Bonus Decision
    const lateNightDecision = this.evaluateLateNightBonus(
      zoneId, currentHour, supplyForecast, activeTypes.has('late_night')
    );
    if (lateNightDecision) decisions.push(lateNightDecision);
    
    // 4. Airport Bonus Decision
    const airportDecision = this.evaluateAirportBonus(
      zoneId, demandForecast, supplyGap, activeTypes.has('airport')
    );
    if (airportDecision) decisions.push(airportDecision);
    
    // 5. Supply Boost Decision (emergency)
    const supplyBoostDecision = this.evaluateSupplyBoost(
      zoneId, supplyGap, supplyForecast, activeTypes.has('supply_boost')
    );
    if (supplyBoostDecision) decisions.push(supplyBoostDecision);
    
    // Limit incentives per zone
    return decisions.slice(0, this.params.maxIncentivesPerZone);
  }

  // ========================================
  // INDIVIDUAL INCENTIVE EVALUATIONS
  // ========================================

  private evaluateBoostZone(
    zoneId: string,
    zoneMetrics: ZoneMetrics,
    supplyGap: SupplyGap,
    isActive: boolean
  ): IncentiveDecision | null {
    const shouldActivate = supplyGap.severity === 'moderate' || supplyGap.severity === 'severe';
    const shouldDeactivate = isActive && supplyGap.severity === 'none';
    
    if (shouldActivate && !isActive) {
      const boostPercent = supplyGap.severity === 'severe' ? 30 : 20;
      return {
        zoneId,
        incentiveType: 'boost_zone',
        activate: true,
        amount: boostPercent,
        durationMinutes: 60,
        reason: `Supply gap ${supplyGap.severity} - activating ${boostPercent}% boost`,
        expectedSupplyIncrease: Math.ceil(supplyGap.gap * 0.3),
      };
    }
    
    if (shouldDeactivate) {
      return {
        zoneId,
        incentiveType: 'boost_zone',
        activate: false,
        amount: 0,
        durationMinutes: 0,
        reason: 'Supply balanced - deactivating boost zone',
        expectedSupplyIncrease: 0,
      };
    }
    
    return null;
  }

  private evaluateWeatherBonus(
    zoneId: string,
    weather: WeatherCondition,
    supplyGap: SupplyGap,
    isActive: boolean
  ): IncentiveDecision | null {
    const badWeather = weather.severity === 'moderate' || weather.severity === 'severe';
    const extremeCold = weather.temperatureFahrenheit < 30;
    
    const shouldActivate = (badWeather || extremeCold) && supplyGap.severity !== 'none';
    const shouldDeactivate = isActive && !badWeather && !extremeCold;
    
    if (shouldActivate && !isActive) {
      return {
        zoneId,
        incentiveType: 'weather_bonus',
        activate: true,
        amount: this.params.weatherBonusAmount,
        durationMinutes: 120,
        reason: `Weather: ${weather.type} (${weather.temperatureFahrenheit}°F) - activating bonus`,
        expectedSupplyIncrease: 2,
      };
    }
    
    if (shouldDeactivate) {
      return {
        zoneId,
        incentiveType: 'weather_bonus',
        activate: false,
        amount: 0,
        durationMinutes: 0,
        reason: 'Weather improved - deactivating bonus',
        expectedSupplyIncrease: 0,
      };
    }
    
    return null;
  }

  private evaluateLateNightBonus(
    zoneId: string,
    currentHour: number,
    supplyForecast: SupplyForecast,
    isActive: boolean
  ): IncentiveDecision | null {
    const isLateNight = currentHour >= 0 && currentHour < 3;
    const lowSupply = supplyForecast.predictedLevel === 'low' || supplyForecast.predictedLevel === 'critical';
    
    const shouldActivate = isLateNight && lowSupply;
    const shouldDeactivate = isActive && (!isLateNight || !lowSupply);
    
    if (shouldActivate && !isActive) {
      return {
        zoneId,
        incentiveType: 'late_night',
        activate: true,
        amount: this.params.lateNightBonusAmount,
        durationMinutes: 180,
        reason: 'Late night low supply - activating bonus',
        expectedSupplyIncrease: 3,
      };
    }
    
    if (shouldDeactivate) {
      return {
        zoneId,
        incentiveType: 'late_night',
        activate: false,
        amount: 0,
        durationMinutes: 0,
        reason: 'Late night period ended - deactivating bonus',
        expectedSupplyIncrease: 0,
      };
    }
    
    return null;
  }

  private evaluateAirportBonus(
    zoneId: string,
    demandForecast: DemandForecast,
    supplyGap: SupplyGap,
    isActive: boolean
  ): IncentiveDecision | null {
    const isAirport = zoneId.includes('airport');
    if (!isAirport) return null;
    
    const highDemand = demandForecast.predictedLevel === 'high' || demandForecast.predictedLevel === 'extreme';
    const hasGap = supplyGap.severity !== 'none';
    
    const shouldActivate = highDemand && hasGap;
    const shouldDeactivate = isActive && !highDemand && !hasGap;
    
    if (shouldActivate && !isActive) {
      return {
        zoneId,
        incentiveType: 'airport',
        activate: true,
        amount: this.params.airportBonusAmount,
        durationMinutes: 60,
        reason: 'Airport demand spike - activating pickup bonus',
        expectedSupplyIncrease: 4,
      };
    }
    
    if (shouldDeactivate) {
      return {
        zoneId,
        incentiveType: 'airport',
        activate: false,
        amount: 0,
        durationMinutes: 0,
        reason: 'Airport demand normalized - deactivating bonus',
        expectedSupplyIncrease: 0,
      };
    }
    
    return null;
  }

  private evaluateSupplyBoost(
    zoneId: string,
    supplyGap: SupplyGap,
    supplyForecast: SupplyForecast,
    isActive: boolean
  ): IncentiveDecision | null {
    const criticalShortage = supplyGap.severity === 'severe' && supplyForecast.shortageRisk > 0.7;
    
    const shouldActivate = criticalShortage;
    const shouldDeactivate = isActive && supplyGap.severity !== 'severe';
    
    if (shouldActivate && !isActive) {
      return {
        zoneId,
        incentiveType: 'supply_boost',
        activate: true,
        amount: this.params.supplyBoostAmount,
        durationMinutes: this.params.supplyBoostDuration,
        reason: 'Critical supply shortage - emergency boost activated',
        expectedSupplyIncrease: Math.ceil(supplyGap.gap * 0.5),
      };
    }
    
    if (shouldDeactivate) {
      return {
        zoneId,
        incentiveType: 'supply_boost',
        activate: false,
        amount: 0,
        durationMinutes: 0,
        reason: 'Supply improved - emergency boost deactivated',
        expectedSupplyIncrease: 0,
      };
    }
    
    return null;
  }

  // ========================================
  // BUDGET MANAGEMENT
  // ========================================

  private checkHourlyReset(): void {
    const currentHour = Math.floor(Date.now() / 3600000);
    if (currentHour !== this.lastHourReset) {
      this.totalIncentivesThisHour = 0;
      this.lastHourReset = currentHour;
    }
  }

  trackIncentiveSpend(amount: number): void {
    this.totalIncentivesThisHour += amount;
  }

  getRemainingBudget(): number {
    return Math.max(0, this.guards.maxIncentiveBudgetPerHour - this.totalIncentivesThisHour);
  }

  // ========================================
  // BATCH PROCESSING
  // ========================================

  calculateAllIncentiveDecisions(
    zones: ZoneMetrics[],
    demandForecasts: Map<string, DemandForecast>,
    supplyForecasts: Map<string, SupplyForecast>,
    supplyGaps: Map<string, SupplyGap>,
    weather: WeatherCondition
  ): IncentiveDecision[] {
    const allDecisions: IncentiveDecision[] = [];
    
    for (const zone of zones) {
      const demandForecast = demandForecasts.get(zone.zoneId);
      const supplyForecast = supplyForecasts.get(zone.zoneId);
      const supplyGap = supplyGaps.get(zone.zoneId);
      
      if (!demandForecast || !supplyForecast || !supplyGap) continue;
      
      const decisions = this.calculateIncentiveDecisions(
        zone, demandForecast, supplyForecast, supplyGap, weather
      );
      
      allDecisions.push(...decisions);
    }
    
    return allDecisions;
  }

  // ========================================
  // APPLICATION
  // ========================================

  applyIncentiveDecision(decision: IncentiveDecision): void {
    decision.appliedAt = new Date();
    marketplaceState.applyIncentiveDecision(decision);
    
    if (decision.activate) {
      this.trackIncentiveSpend(decision.amount);
    }
  }

  applyAllIncentiveDecisions(decisions: IncentiveDecision[]): void {
    for (const decision of decisions) {
      this.applyIncentiveDecision(decision);
    }
  }

  // ========================================
  // UTILITIES
  // ========================================

  updateParams(params: Partial<IncentiveParams>): void {
    this.params = { ...this.params, ...params };
  }

  getParams(): IncentiveParams {
    return { ...this.params };
  }
}

// Singleton instance
export const incentiveController = new IncentiveController();

export default incentiveController;
