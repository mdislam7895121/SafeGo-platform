/**
 * SafeGo AI Marketplace Balancer - Dispatch Optimizer Actuator
 * 
 * Smart driver dispatch based on multiple factors:
 * - Shortest arrival time (ETA)
 * - Highest acceptance rate
 * - Best rating
 * - Low cancellation history
 * - Fatigue score
 * - Proximity to demand zones
 * - Vehicle category eligibility (Step 2)
 */

import {
  DispatchDecision,
  DispatchFactor,
  DriverScoreInput,
  DriverScoreResult,
  DemandForecast,
  ZoneMetrics,
  GeoLocation,
} from '@shared/marketplace';

import {
  VehicleCategoryId,
  isValidVehicleCategoryId,
  canVehicleServeCategory,
  getEligibleDriverCategories,
  VEHICLE_CATEGORIES,
} from '@shared/vehicleCategories';

// ========================================
// SCORING WEIGHTS
// ========================================

interface DispatchWeights {
  eta: number;
  rating: number;
  acceptanceRate: number;
  cancellationRate: number;
  fatigue: number;
  zoneProximity: number;
}

const DEFAULT_WEIGHTS: DispatchWeights = {
  eta: 0.30,
  rating: 0.15,
  acceptanceRate: 0.20,
  cancellationRate: 0.15,
  fatigue: 0.10,
  zoneProximity: 0.10,
};

const PREMIUM_WEIGHTS: DispatchWeights = {
  eta: 0.20,
  rating: 0.30,
  acceptanceRate: 0.20,
  cancellationRate: 0.15,
  fatigue: 0.05,
  zoneProximity: 0.10,
};

// ========================================
// DISPATCH OPTIMIZER CLASS
// ========================================

export class DispatchOptimizer {
  private weights: DispatchWeights;
  private premiumWeights: DispatchWeights;
  private maxFatigueHours: number = 10;
  private maxFatigueTrips: number = 20;

  constructor(
    weights: DispatchWeights = DEFAULT_WEIGHTS,
    premiumWeights: DispatchWeights = PREMIUM_WEIGHTS
  ) {
    this.weights = weights;
    this.premiumWeights = premiumWeights;
  }

  // ========================================
  // DRIVER SCORING
  // ========================================

  scoreDriver(
    driver: DriverScoreInput,
    isPremiumTrip: boolean = false
  ): DriverScoreResult {
    const activeWeights = isPremiumTrip ? this.premiumWeights : this.weights;
    
    // Calculate individual scores (0-100 scale)
    const etaScore = this.calculateEtaScore(driver.etaMinutes);
    const ratingScore = this.calculateRatingScore(driver.rating);
    const acceptanceScore = this.calculateAcceptanceScore(driver.acceptanceRate);
    const cancellationScore = this.calculateCancellationScore(driver.cancellationRate);
    const fatigueScore = this.calculateFatigueScore(
      driver.hoursOnlineToday,
      driver.completedTripsToday
    );
    const zoneScore = this.calculateZoneScore(driver.isInDemandZone);
    
    // Calculate weighted total
    const totalScore = 
      (etaScore * activeWeights.eta) +
      (ratingScore * activeWeights.rating) +
      (acceptanceScore * activeWeights.acceptanceRate) +
      (cancellationScore * activeWeights.cancellationRate) +
      (fatigueScore * activeWeights.fatigue) +
      (zoneScore * activeWeights.zoneProximity);
    
    // Determine recommendation
    let recommendation: DriverScoreResult['recommendation'] = 'consider';
    if (totalScore >= 80) recommendation = 'dispatch';
    else if (totalScore < 50) recommendation = 'skip';
    
    return {
      driverId: driver.driverId,
      totalScore: Math.round(totalScore * 10) / 10,
      etaScore: Math.round(etaScore),
      ratingScore: Math.round(ratingScore),
      acceptanceScore: Math.round(acceptanceScore),
      cancellationScore: Math.round(cancellationScore),
      fatigueScore: Math.round(fatigueScore),
      zoneScore: Math.round(zoneScore),
      rank: 0, // Will be set during ranking
      recommendation,
    };
  }

  private calculateEtaScore(etaMinutes: number): number {
    // Best score for <3 min, decreases linearly
    if (etaMinutes <= 3) return 100;
    if (etaMinutes >= 15) return 20;
    return 100 - ((etaMinutes - 3) * (80 / 12));
  }

  private calculateRatingScore(rating: number): number {
    // 4.9+ = 100, 4.5 = 80, below 4.0 = poor
    if (rating >= 4.9) return 100;
    if (rating >= 4.8) return 95;
    if (rating >= 4.7) return 90;
    if (rating >= 4.5) return 80;
    if (rating >= 4.0) return 60;
    return 30;
  }

  private calculateAcceptanceScore(acceptanceRate: number): number {
    // 95%+ = 100, linear decrease
    return Math.min(100, Math.max(0, acceptanceRate * 105));
  }

  private calculateCancellationScore(cancellationRate: number): number {
    // 0% = 100, 10% = 50, 20%+ = 0
    if (cancellationRate <= 0.02) return 100;
    if (cancellationRate >= 0.20) return 0;
    return 100 - (cancellationRate * 500);
  }

  private calculateFatigueScore(hoursOnline: number, tripsCompleted: number): number {
    // Calculate fatigue based on hours and trips
    const hoursFatigue = Math.min(hoursOnline / this.maxFatigueHours, 1);
    const tripsFatigue = Math.min(tripsCompleted / this.maxFatigueTrips, 1);
    const fatigueFactor = Math.max(hoursFatigue, tripsFatigue);
    
    // Higher fatigue = lower score
    return Math.max(0, 100 - (fatigueFactor * 80));
  }

  private calculateZoneScore(isInDemandZone: boolean): number {
    return isInDemandZone ? 100 : 50;
  }

  // ========================================
  // DRIVER RANKING
  // ========================================

  rankDrivers(
    drivers: DriverScoreInput[],
    isPremiumTrip: boolean = false
  ): DriverScoreResult[] {
    const scored = drivers.map(d => this.scoreDriver(d, isPremiumTrip));
    
    // Sort by total score (descending)
    scored.sort((a, b) => b.totalScore - a.totalScore);
    
    // Assign ranks
    scored.forEach((result, index) => {
      result.rank = index + 1;
    });
    
    return scored;
  }

  // ========================================
  // DISPATCH DECISION
  // ========================================

  selectBestDriver(
    requestId: string,
    zoneId: string,
    availableDrivers: DriverScoreInput[],
    isPremiumTrip: boolean = false,
    demandForecast?: DemandForecast,
    requestedCategory?: VehicleCategoryId
  ): DispatchDecision | null {
    if (availableDrivers.length === 0) {
      return null;
    }

    // Step 2: Filter by vehicle category eligibility if a category is requested
    let eligibleDrivers = availableDrivers;
    if (requestedCategory) {
      eligibleDrivers = this.filterByVehicleEligibility(availableDrivers, requestedCategory);
      console.log(`[DispatchOptimizer] Filtered ${availableDrivers.length} drivers to ${eligibleDrivers.length} eligible for ${requestedCategory}`);
      
      if (eligibleDrivers.length === 0) {
        console.log(`[DispatchOptimizer] No eligible drivers for category ${requestedCategory}`);
        return null;
      }
    }
    
    // Rank all eligible drivers
    const rankedDrivers = this.rankDrivers(eligibleDrivers, isPremiumTrip);
    
    // Select the best driver
    const bestDriver = rankedDrivers[0];
    const alternatives = rankedDrivers.slice(1, 4).map(d => d.driverId);
    
    // Build dispatch factors
    const driverInput = eligibleDrivers.find(d => d.driverId === bestDriver.driverId)!;
    const factors = this.buildDispatchFactors(bestDriver, driverInput);
    
    // Determine priority reason
    const priorityReason = this.determinePriorityReason(bestDriver, isPremiumTrip);
    
    return {
      requestId,
      zoneId,
      selectedDriverId: bestDriver.driverId,
      alternativeDrivers: alternatives,
      dispatchScore: bestDriver.totalScore,
      priorityReason,
      factors,
    };
  }

  // ========================================
  // STEP 2: VEHICLE CATEGORY ELIGIBILITY
  // ========================================

  /**
   * Filter drivers by vehicle category eligibility and driver preferences
   * Implements the dispatch matching rules:
   * - X → X only
   * - Comfort → Comfort + X
   * - Comfort XL → Comfort XL + Comfort + X
   * - XL → XL + Comfort XL + Comfort + X
   * - Black → Black + Comfort + X (NOT XL, WAV)
   * - Black SUV → Black SUV + Black + Comfort + X
   * - WAV → WAV only
   * 
   * Also checks driver preferences (allowedCategories):
   * - If driver has allowedCategories set, only dispatch for categories they've enabled
   * - If allowedCategories is not set, defaults to all eligible categories
   */
  filterByVehicleEligibility(
    drivers: DriverScoreInput[],
    requestedCategory: VehicleCategoryId
  ): DriverScoreInput[] {
    return drivers.filter(driver => {
      // Driver must have an approved vehicle category
      if (!driver.vehicleCategory || !driver.vehicleCategoryApproved) {
        return false;
      }

      // Check if driver's vehicle category is valid
      if (!isValidVehicleCategoryId(driver.vehicleCategory)) {
        return false;
      }

      // Special handling for WAV - must be wheelchair accessible
      if (requestedCategory === 'WAV') {
        if (!driver.wheelchairAccessible || driver.vehicleCategory !== 'WAV') {
          return false;
        }
        // WAV is locked and cannot be disabled by drivers, so we don't check preferences for WAV
        return true;
      }

      // Check eligibility using the matrix
      const eligibility = canVehicleServeCategory(
        driver.vehicleCategory as VehicleCategoryId,
        requestedCategory
      );

      if (!eligibility.isEligible) {
        return false;
      }

      // Check driver preferences (allowedCategories)
      // If driver has set preferences, only dispatch for categories they've enabled
      if (driver.allowedCategories && driver.allowedCategories.length > 0) {
        const normalizedRequestedCategory = requestedCategory.startsWith('SAFEGO_') 
          ? requestedCategory 
          : `SAFEGO_${requestedCategory}`;
        
        const isAllowed = driver.allowedCategories.some(allowed => {
          const normalizedAllowed = allowed.startsWith('SAFEGO_') ? allowed : `SAFEGO_${allowed}`;
          return normalizedAllowed === normalizedRequestedCategory;
        });

        if (!isAllowed) {
          console.log(`[DispatchOptimizer] Driver ${driver.driverId} has disabled category ${requestedCategory} in preferences`);
          return false;
        }
      }
      // If allowedCategories is not set, driver accepts all eligible categories (default behavior)

      return true;
    });
  }

  /**
   * Check if a specific driver is eligible for a category
   * Also checks driver preferences (allowedCategories)
   */
  isDriverEligible(
    driver: DriverScoreInput,
    requestedCategory: VehicleCategoryId
  ): { eligible: boolean; reason?: string } {
    if (!driver.vehicleCategory || !driver.vehicleCategoryApproved) {
      return {
        eligible: false,
        reason: 'Driver does not have an approved vehicle category',
      };
    }

    if (!isValidVehicleCategoryId(driver.vehicleCategory)) {
      return {
        eligible: false,
        reason: 'Driver vehicle category is invalid',
      };
    }

    // Special WAV handling - WAV is locked and cannot be disabled
    if (requestedCategory === 'WAV') {
      if (!driver.wheelchairAccessible) {
        return {
          eligible: false,
          reason: 'WAV rides require wheelchair-accessible vehicles only',
        };
      }
      if (driver.vehicleCategory !== 'WAV') {
        return {
          eligible: false,
          reason: 'Driver vehicle is not registered as WAV',
        };
      }
      return { eligible: true };
    }

    const eligibility = canVehicleServeCategory(
      driver.vehicleCategory as VehicleCategoryId,
      requestedCategory
    );

    if (!eligibility.isEligible) {
      return {
        eligible: false,
        reason: eligibility.reason,
      };
    }

    // Check driver preferences (allowedCategories)
    if (driver.allowedCategories && driver.allowedCategories.length > 0) {
      const normalizedRequestedCategory = requestedCategory.startsWith('SAFEGO_') 
        ? requestedCategory 
        : `SAFEGO_${requestedCategory}`;
      
      const isAllowed = driver.allowedCategories.some(allowed => {
        const normalizedAllowed = allowed.startsWith('SAFEGO_') ? allowed : `SAFEGO_${allowed}`;
        return normalizedAllowed === normalizedRequestedCategory;
      });

      if (!isAllowed) {
        return {
          eligible: false,
          reason: 'Driver has disabled this category in their preferences',
        };
      }
    }

    return { eligible: true };
  }

  /**
   * Get count of available drivers per vehicle category
   */
  getDriverCountsByCategory(
    drivers: DriverScoreInput[]
  ): Record<VehicleCategoryId, number> {
    const counts: Record<VehicleCategoryId, number> = {
      X: 0,
      COMFORT: 0,
      COMFORT_XL: 0,
      XL: 0,
      BLACK: 0,
      BLACK_SUV: 0,
      WAV: 0,
    };

    for (const driver of drivers) {
      if (driver.vehicleCategory && 
          driver.vehicleCategoryApproved && 
          isValidVehicleCategoryId(driver.vehicleCategory)) {
        counts[driver.vehicleCategory as VehicleCategoryId]++;
      }
    }

    return counts;
  }

  /**
   * Get eligible driver count for a specific category
   */
  getEligibleDriverCount(
    drivers: DriverScoreInput[],
    requestedCategory: VehicleCategoryId
  ): number {
    return this.filterByVehicleEligibility(drivers, requestedCategory).length;
  }

  private buildDispatchFactors(
    scoreResult: DriverScoreResult,
    driverInput: DriverScoreInput
  ): DispatchFactor[] {
    const activeWeights = driverInput.isPremiumDriver ? this.premiumWeights : this.weights;
    
    return [
      {
        type: 'eta',
        value: driverInput.etaMinutes,
        weight: activeWeights.eta,
        score: scoreResult.etaScore,
      },
      {
        type: 'rating',
        value: driverInput.rating,
        weight: activeWeights.rating,
        score: scoreResult.ratingScore,
      },
      {
        type: 'acceptance_rate',
        value: driverInput.acceptanceRate,
        weight: activeWeights.acceptanceRate,
        score: scoreResult.acceptanceScore,
      },
      {
        type: 'cancellation_rate',
        value: driverInput.cancellationRate,
        weight: activeWeights.cancellationRate,
        score: scoreResult.cancellationScore,
      },
      {
        type: 'fatigue',
        value: driverInput.hoursOnlineToday,
        weight: activeWeights.fatigue,
        score: scoreResult.fatigueScore,
      },
      {
        type: 'zone_proximity',
        value: driverInput.isInDemandZone ? 1 : 0,
        weight: activeWeights.zoneProximity,
        score: scoreResult.zoneScore,
      },
    ];
  }

  private determinePriorityReason(
    scoreResult: DriverScoreResult,
    isPremiumTrip: boolean
  ): string {
    const reasons: string[] = [];
    
    if (scoreResult.etaScore >= 90) reasons.push('fastest arrival');
    if (scoreResult.ratingScore >= 95) reasons.push('top rated');
    if (scoreResult.acceptanceScore >= 95) reasons.push('high acceptance');
    if (scoreResult.cancellationScore >= 95) reasons.push('reliable');
    
    if (isPremiumTrip && scoreResult.ratingScore >= 90) {
      return 'Premium trip - prioritized rating and service quality';
    }
    
    if (reasons.length > 0) {
      return `Best match: ${reasons.join(', ')}`;
    }
    
    return 'Best available driver based on composite score';
  }

  // ========================================
  // SPECIALIZED DISPATCH
  // ========================================

  selectAirportDriver(
    requestId: string,
    zoneId: string,
    availableDrivers: DriverScoreInput[]
  ): DispatchDecision | null {
    // For airport pickups, prioritize drivers already in the airport queue
    const airportDrivers = availableDrivers.filter(d => 
      d.isInDemandZone && d.acceptanceRate >= 0.85
    );
    
    const candidates = airportDrivers.length > 0 ? airportDrivers : availableDrivers;
    return this.selectBestDriver(requestId, zoneId, candidates, false);
  }

  selectPremiumDriver(
    requestId: string,
    zoneId: string,
    availableDrivers: DriverScoreInput[]
  ): DispatchDecision | null {
    // For premium trips, filter to high-rated drivers first
    const premiumDrivers = availableDrivers.filter(d =>
      d.rating >= 4.8 && d.acceptanceRate >= 0.90
    );
    
    const candidates = premiumDrivers.length > 0 ? premiumDrivers : availableDrivers;
    return this.selectBestDriver(requestId, zoneId, candidates, true);
  }

  // ========================================
  // CANCELLATION PREVENTION
  // ========================================

  shouldAvoidDispatch(
    driver: DriverScoreInput,
    pickupLocation: GeoLocation,
    maxDistanceMiles: number = 5
  ): { avoid: boolean; reason: string } {
    // Avoid long-distance unwanted pickups
    if (driver.etaMinutes > 15) {
      return {
        avoid: true,
        reason: 'ETA too long - high cancellation risk',
      };
    }
    
    // Avoid drivers with high cancellation rates
    if (driver.cancellationRate > 0.15) {
      return {
        avoid: true,
        reason: 'High cancellation history',
      };
    }
    
    // Avoid fatigued drivers during peak times
    if (driver.hoursOnlineToday > 8 || driver.completedTripsToday > 15) {
      return {
        avoid: false,
        reason: 'Driver may be fatigued - consider alternatives',
      };
    }
    
    return { avoid: false, reason: '' };
  }

  // ========================================
  // UTILITIES
  // ========================================

  updateWeights(weights: Partial<DispatchWeights>): void {
    this.weights = { ...this.weights, ...weights };
  }

  updatePremiumWeights(weights: Partial<DispatchWeights>): void {
    this.premiumWeights = { ...this.premiumWeights, ...weights };
  }

  getWeights(): DispatchWeights {
    return { ...this.weights };
  }

  setMaxFatigue(hours: number, trips: number): void {
    this.maxFatigueHours = hours;
    this.maxFatigueTrips = trips;
  }
}

// Singleton instance
export const dispatchOptimizer = new DispatchOptimizer();

export default dispatchOptimizer;
