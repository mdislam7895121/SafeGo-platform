/**
 * SafeGo Phase 1B: Fare Recalculation Service
 * Recalculates fares based on actual trip distance and duration
 */

import { prisma } from '../db';
import { getDispatchFeatureConfig } from '../config/dispatchFeatures';
import { rideTelemetryService } from './rideTelemetryService';

export interface FareBreakdown {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgeFare: number;
  tollsFare: number;
  discounts: number;
  taxes: number;
  total: number;
  currency: string;
}

export interface RecalculationResult {
  success: boolean;
  originalFare: number;
  newFare: number;
  breakdown: FareBreakdown;
  adjustmentReason?: string;
  error?: string;
}

interface PricingProfile {
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  minimumFare: number;
  surgeMultiplier: number;
  currency: string;
}

const DEFAULT_PRICING: Record<string, PricingProfile> = {
  US: {
    baseFare: 2.50,
    perKmRate: 1.25,
    perMinuteRate: 0.35,
    minimumFare: 5.00,
    surgeMultiplier: 1.0,
    currency: 'USD',
  },
  BD: {
    baseFare: 35,
    perKmRate: 15,
    perMinuteRate: 2,
    minimumFare: 50,
    surgeMultiplier: 1.0,
    currency: 'BDT',
  },
};

class FareRecalculationService {
  private getPricingProfile(countryCode: string): PricingProfile {
    return DEFAULT_PRICING[countryCode] || DEFAULT_PRICING['US'];
  }

  async recalculateFareForCompletedRide(
    rideId: string
  ): Promise<RecalculationResult> {
    const config = getDispatchFeatureConfig();

    if (!config.fareRecalculation.enabled) {
      return {
        success: false,
        originalFare: 0,
        newFare: 0,
        breakdown: this.emptyBreakdown(),
        error: 'Fare recalculation is disabled',
      };
    }

    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: {
        id: true,
        serviceFare: true,
        countryCode: true,
        surgeMultiplier: true,
        tollAmount: true,
        discountAmount: true,
        totalTaxAmount: true,
        rawDistanceMeters: true,
        rawDurationSeconds: true,
        fareRecalculated: true,
      },
    });

    if (!ride) {
      return {
        success: false,
        originalFare: 0,
        newFare: 0,
        breakdown: this.emptyBreakdown(),
        error: 'Ride not found',
      };
    }

    if (ride.fareRecalculated) {
      return {
        success: false,
        originalFare: Number(ride.serviceFare),
        newFare: Number(ride.serviceFare),
        breakdown: this.emptyBreakdown(),
        error: 'Fare has already been recalculated',
      };
    }

    const originalFare = Number(ride.serviceFare);

    let totalDistanceMeters = ride.rawDistanceMeters || 0;
    let totalDurationSeconds = ride.rawDurationSeconds || 0;
    let adjustmentReason: string | undefined;

    if (config.fareRecalculation.useActualDistance || config.fareRecalculation.useActualDuration) {
      try {
        const metrics = await rideTelemetryService.calculateActualTripMetrics(rideId);

        if (metrics.sampleCount >= 2) {
          if (config.fareRecalculation.useActualDistance && metrics.totalDistanceMeters > 0) {
            if (totalDistanceMeters > 0) {
              const distanceDiff = Math.abs(metrics.totalDistanceMeters - totalDistanceMeters);
              const distanceChangePercent = (distanceDiff / totalDistanceMeters) * 100;

              if (distanceChangePercent > 10) {
                totalDistanceMeters = metrics.totalDistanceMeters;
                adjustmentReason = `Distance adjusted by ${distanceChangePercent.toFixed(1)}% based on GPS data`;
              }
            } else {
              totalDistanceMeters = metrics.totalDistanceMeters;
              adjustmentReason = 'Distance calculated from GPS data';
            }
          }

          if (config.fareRecalculation.useActualDuration && metrics.totalDurationSeconds > 0) {
            if (totalDurationSeconds > 0) {
              const durationDiff = Math.abs(metrics.totalDurationSeconds - totalDurationSeconds);
              const durationChangePercent = (durationDiff / totalDurationSeconds) * 100;

              if (durationChangePercent > 15) {
                totalDurationSeconds = metrics.totalDurationSeconds;
                if (adjustmentReason) {
                  adjustmentReason += `, duration adjusted by ${durationChangePercent.toFixed(1)}%`;
                } else {
                  adjustmentReason = `Duration adjusted by ${durationChangePercent.toFixed(1)}% based on GPS data`;
                }
              }
            } else {
              totalDurationSeconds = metrics.totalDurationSeconds;
              if (adjustmentReason) {
                adjustmentReason += ', duration calculated from GPS data';
              } else {
                adjustmentReason = 'Duration calculated from GPS data';
              }
            }
          }
        }
      } catch (error) {
        console.error('[FareRecalculation] Error fetching telemetry metrics:', error);
      }
    }

    const pricing = this.getPricingProfile(ride.countryCode || 'US');
    const breakdown = this.calculateBreakdown(
      totalDistanceMeters,
      totalDurationSeconds,
      pricing,
      ride.surgeMultiplier ? Number(ride.surgeMultiplier) : 1.0,
      ride.tollAmount ? Number(ride.tollAmount) : 0,
      ride.discountAmount ? Number(ride.discountAmount) : 0,
      ride.totalTaxAmount ? Number(ride.totalTaxAmount) : 0
    );

    await prisma.ride.update({
      where: { id: rideId },
      data: {
        finalFareAmount: breakdown.total,
        fareBreakdown: breakdown as object,
        fareRecalculated: true,
        fareAdjustmentReason: adjustmentReason,
        actualDistanceMeters: totalDistanceMeters,
        actualDurationSeconds: totalDurationSeconds,
      },
    });

    return {
      success: true,
      originalFare,
      newFare: breakdown.total,
      breakdown,
      adjustmentReason,
    };
  }

  private calculateBreakdown(
    distanceMeters: number,
    durationSeconds: number,
    pricing: PricingProfile,
    surgeMultiplier: number,
    tolls: number,
    discounts: number,
    taxes: number
  ): FareBreakdown {
    const distanceKm = distanceMeters / 1000;
    const durationMinutes = durationSeconds / 60;

    const baseFare = pricing.baseFare;
    const distanceFare = distanceKm * pricing.perKmRate;
    const timeFare = durationMinutes * pricing.perMinuteRate;

    let subtotal = baseFare + distanceFare + timeFare;

    const surgeFare = surgeMultiplier > 1 ? subtotal * (surgeMultiplier - 1) : 0;
    subtotal += surgeFare;

    subtotal += tolls;
    subtotal -= discounts;

    if (subtotal < pricing.minimumFare) {
      subtotal = pricing.minimumFare;
    }

    const total = subtotal + taxes;

    return {
      baseFare: Math.round(baseFare * 100) / 100,
      distanceFare: Math.round(distanceFare * 100) / 100,
      timeFare: Math.round(timeFare * 100) / 100,
      surgeFare: Math.round(surgeFare * 100) / 100,
      tollsFare: Math.round(tolls * 100) / 100,
      discounts: Math.round(discounts * 100) / 100,
      taxes: Math.round(taxes * 100) / 100,
      total: Math.round(total * 100) / 100,
      currency: pricing.currency,
    };
  }

  private emptyBreakdown(): FareBreakdown {
    return {
      baseFare: 0,
      distanceFare: 0,
      timeFare: 0,
      surgeFare: 0,
      tollsFare: 0,
      discounts: 0,
      taxes: 0,
      total: 0,
      currency: 'USD',
    };
  }

  async estimateFare(
    distanceMeters: number,
    durationSeconds: number,
    countryCode: string,
    surgeMultiplier = 1.0
  ): Promise<FareBreakdown> {
    const pricing = this.getPricingProfile(countryCode);
    return this.calculateBreakdown(
      distanceMeters,
      durationSeconds,
      pricing,
      surgeMultiplier,
      0,
      0,
      0
    );
  }
}

export const fareRecalculationService = new FareRecalculationService();
