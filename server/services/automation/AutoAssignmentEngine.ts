/**
 * SafeGo Auto Assignment Engine
 * Handles automatic partner assignment for rides, food_orders, deliveries, shop_orders, ticket bookings, rental bookings
 * Logic: nearest partner, verification_status, performance score, cancellation history
 */

import { prisma } from '../../db';
import { DeliveryServiceType, DispatchSessionStatus } from '@prisma/client';
import { driverRealtimeStateService, AvailableDriver } from '../driverRealtimeStateService';
import { getDispatchConfig } from '../../config/dispatchConfig';

export interface AssignmentCandidate {
  partnerId: string;
  partnerType: 'driver' | 'restaurant' | 'shop' | 'ticket_operator' | 'rental_operator';
  distanceKm: number;
  verificationStatus: string;
  performanceScore: number;
  cancellationRate: number;
  rating: number;
  isVerified: boolean;
  totalScore: number;
}

export interface AssignmentRequest {
  serviceType: 'ride' | 'food_order' | 'delivery' | 'shop_order' | 'ticket_booking' | 'rental_booking';
  entityId: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat?: number;
  dropoffLng?: number;
  countryCode?: string;
  cityCode?: string;
  customerId?: string;
  urgencyLevel?: 'normal' | 'high' | 'urgent';
}

export interface AssignmentResult {
  success: boolean;
  assignedPartnerId?: string;
  assignedPartnerType?: string;
  candidates: AssignmentCandidate[];
  assignmentReason?: string;
  logs: AssignmentLogEntry[];
  error?: string;
}

export interface AssignmentLogEntry {
  timestamp: string;
  event: string;
  details?: Record<string, unknown>;
}

interface ScoringWeights {
  distance: number;
  verification: number;
  performance: number;
  cancellation: number;
  rating: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  distance: 0.35,
  verification: 0.15,
  performance: 0.25,
  cancellation: 0.15,
  rating: 0.10,
};

export class AutoAssignmentEngine {
  private static instance: AutoAssignmentEngine;
  private weights: ScoringWeights;

  private constructor() {
    this.weights = DEFAULT_WEIGHTS;
  }

  public static getInstance(): AutoAssignmentEngine {
    if (!AutoAssignmentEngine.instance) {
      AutoAssignmentEngine.instance = new AutoAssignmentEngine();
    }
    return AutoAssignmentEngine.instance;
  }

  async findBestPartner(request: AssignmentRequest): Promise<AssignmentResult> {
    const logs: AssignmentLogEntry[] = [];
    logs.push({
      timestamp: new Date().toISOString(),
      event: 'assignment_started',
      details: { serviceType: request.serviceType, entityId: request.entityId },
    });

    try {
      let candidates: AssignmentCandidate[] = [];

      switch (request.serviceType) {
        case 'ride':
        case 'delivery':
        case 'food_order':
          candidates = await this.findDriverCandidates(request, logs);
          break;
        case 'shop_order':
          candidates = await this.findShopDriverCandidates(request, logs);
          break;
        case 'ticket_booking':
          candidates = await this.findTicketOperatorCandidates(request, logs);
          break;
        case 'rental_booking':
          candidates = await this.findRentalOperatorCandidates(request, logs);
          break;
      }

      if (candidates.length === 0) {
        logs.push({
          timestamp: new Date().toISOString(),
          event: 'no_candidates_found',
          details: { serviceType: request.serviceType },
        });
        await this.logAssignment(request, null, 'no_candidates', logs);
        return {
          success: false,
          candidates: [],
          logs,
          error: 'No available partners found',
        };
      }

      const scoredCandidates = this.scoreCandidates(candidates, request);
      scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);

      logs.push({
        timestamp: new Date().toISOString(),
        event: 'candidates_scored',
        details: { count: scoredCandidates.length, topScore: scoredCandidates[0]?.totalScore },
      });

      const bestCandidate = scoredCandidates[0];

      logs.push({
        timestamp: new Date().toISOString(),
        event: 'partner_selected',
        details: {
          partnerId: bestCandidate.partnerId,
          partnerType: bestCandidate.partnerType,
          score: bestCandidate.totalScore,
        },
      });

      await this.logAssignment(request, bestCandidate, 'success', logs);

      return {
        success: true,
        assignedPartnerId: bestCandidate.partnerId,
        assignedPartnerType: bestCandidate.partnerType,
        candidates: scoredCandidates,
        assignmentReason: `Selected based on score: ${bestCandidate.totalScore.toFixed(2)} (distance: ${bestCandidate.distanceKm.toFixed(2)}km, performance: ${bestCandidate.performanceScore}, rating: ${bestCandidate.rating})`,
        logs,
      };
    } catch (error) {
      logs.push({
        timestamp: new Date().toISOString(),
        event: 'assignment_error',
        details: { error: error instanceof Error ? error.message : String(error) },
      });
      await this.logAssignment(request, null, 'error', logs);
      return {
        success: false,
        candidates: [],
        logs,
        error: error instanceof Error ? error.message : 'Assignment failed',
      };
    }
  }

  private async findDriverCandidates(
    request: AssignmentRequest,
    logs: AssignmentLogEntry[]
  ): Promise<AssignmentCandidate[]> {
    const serviceType = request.serviceType === 'food_order' ? 'food' : 
                       request.serviceType === 'ride' ? 'ride' : 'parcel';
    
    const config = getDispatchConfig(request.countryCode, serviceType as DeliveryServiceType);

    const nearbyDrivers = await driverRealtimeStateService.findNearestDriversForDispatch({
      pickupLat: request.pickupLat,
      pickupLng: request.pickupLng,
      serviceMode: serviceType as any,
      countryCode: request.countryCode,
      cityCode: request.cityCode,
      maxRadiusKm: config.maxRadiusKm,
      maxCandidates: config.maxCandidates * 2,
    });

    logs.push({
      timestamp: new Date().toISOString(),
      event: 'drivers_found',
      details: { count: nearbyDrivers.length },
    });

    const candidates: AssignmentCandidate[] = [];

    for (const driver of nearbyDrivers) {
      const driverProfile = await prisma.driverProfile.findUnique({
        where: { id: driver.driverId },
        include: {
          driverStats: true,
        },
      });

      if (!driverProfile) continue;

      const stats = driverProfile.driverStats;
      const cancellationRate = stats 
        ? Number(stats.cancellationRate) 
        : 0.05;
      const rating = stats 
        ? Number(stats.rating) 
        : 5.0;
      const trustScore = stats?.trustScore ?? 75;

      candidates.push({
        partnerId: driver.driverId,
        partnerType: 'driver',
        distanceKm: driver.distanceKm,
        verificationStatus: driverProfile.verificationStatus,
        performanceScore: trustScore,
        cancellationRate,
        rating,
        isVerified: driverProfile.isVerified,
        totalScore: 0,
      });
    }

    return candidates.filter(c => c.isVerified && c.verificationStatus === 'approved');
  }

  private async findShopDriverCandidates(
    request: AssignmentRequest,
    logs: AssignmentLogEntry[]
  ): Promise<AssignmentCandidate[]> {
    return this.findDriverCandidates({ ...request, serviceType: 'delivery' }, logs);
  }

  private async findTicketOperatorCandidates(
    request: AssignmentRequest,
    logs: AssignmentLogEntry[]
  ): Promise<AssignmentCandidate[]> {
    const operators = await prisma.ticketOperatorProfile.findMany({
      where: {
        isVerified: true,
        verificationStatus: 'approved',
        isSuspended: false,
      },
      include: {
        user: true,
      },
    });

    logs.push({
      timestamp: new Date().toISOString(),
      event: 'ticket_operators_found',
      details: { count: operators.length },
    });

    return operators.map(op => ({
      partnerId: op.id,
      partnerType: 'ticket_operator' as const,
      distanceKm: 0,
      verificationStatus: op.verificationStatus,
      performanceScore: 80,
      cancellationRate: 0.02,
      rating: 4.5,
      isVerified: op.isVerified,
      totalScore: 0,
    }));
  }

  private async findRentalOperatorCandidates(
    request: AssignmentRequest,
    logs: AssignmentLogEntry[]
  ): Promise<AssignmentCandidate[]> {
    const operators = await prisma.ticketOperatorProfile.findMany({
      where: {
        isVerified: true,
        verificationStatus: 'approved',
        isSuspended: false,
      },
      include: {
        user: true,
      },
    });

    logs.push({
      timestamp: new Date().toISOString(),
      event: 'rental_operators_found',
      details: { count: operators.length },
    });

    return operators.map(op => ({
      partnerId: op.id,
      partnerType: 'rental_operator' as const,
      distanceKm: 0,
      verificationStatus: op.verificationStatus,
      performanceScore: 80,
      cancellationRate: 0.02,
      rating: 4.5,
      isVerified: op.isVerified,
      totalScore: 0,
    }));
  }

  private scoreCandidates(
    candidates: AssignmentCandidate[],
    request: AssignmentRequest
  ): AssignmentCandidate[] {
    const maxDistance = Math.max(...candidates.map(c => c.distanceKm), 1);
    const urgencyMultiplier = request.urgencyLevel === 'urgent' ? 1.5 : 
                              request.urgencyLevel === 'high' ? 1.2 : 1.0;

    return candidates.map(candidate => {
      const distanceScore = (1 - candidate.distanceKm / maxDistance) * 100;
      const verificationScore = candidate.isVerified ? 100 : 0;
      const performanceNormalized = candidate.performanceScore;
      const cancellationScore = (1 - candidate.cancellationRate) * 100;
      const ratingScore = (candidate.rating / 5) * 100;

      const totalScore = (
        distanceScore * this.weights.distance +
        verificationScore * this.weights.verification +
        performanceNormalized * this.weights.performance +
        cancellationScore * this.weights.cancellation +
        ratingScore * this.weights.rating
      ) * urgencyMultiplier;

      return {
        ...candidate,
        totalScore,
      };
    });
  }

  private async logAssignment(
    request: AssignmentRequest,
    candidate: AssignmentCandidate | null,
    status: string,
    logs: AssignmentLogEntry[]
  ): Promise<void> {
    try {
      await prisma.automationLog.create({
        data: {
          automationType: 'auto_assignment',
          entityType: request.serviceType,
          entityId: request.entityId,
          status,
          partnerId: candidate?.partnerId,
          partnerType: candidate?.partnerType,
          score: candidate?.totalScore,
          metadata: {
            countryCode: request.countryCode,
            cityCode: request.cityCode,
            logs,
          },
        },
      });
    } catch (error) {
      console.error('[AutoAssignmentEngine] Failed to log assignment:', error);
    }
  }

  async getAssignmentHistory(
    entityType: string,
    entityId: string
  ): Promise<any[]> {
    return prisma.automationLog.findMany({
      where: {
        automationType: 'auto_assignment',
        entityType,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async updateWeights(newWeights: Partial<ScoringWeights>): Promise<void> {
    this.weights = { ...this.weights, ...newWeights };
  }

  getWeights(): ScoringWeights {
    return { ...this.weights };
  }
}

export const autoAssignmentEngine = AutoAssignmentEngine.getInstance();
