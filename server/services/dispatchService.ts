/**
 * SafeGo Dispatch Service
 * Phase 1A: Core dispatch engine for ride/food/parcel assignment
 */

import { prisma } from '../db';
import { 
  DeliveryServiceType, 
  DispatchSessionStatus, 
  DispatchServiceMode 
} from '@prisma/client';
import { 
  getDispatchConfig, 
  getOfferTimeoutMs,
  DispatchConfig 
} from '../config/dispatchConfig';
import { 
  driverRealtimeStateService, 
  AvailableDriver 
} from './driverRealtimeStateService';

export interface CreateDispatchSessionInput {
  serviceType: DeliveryServiceType;
  entityId: string;
  customerId: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  countryCode?: string | null;
  cityCode?: string | null;
}

export interface DispatchSessionResult {
  sessionId: string;
  status: DispatchSessionStatus;
  candidateDrivers: AvailableDriver[];
  currentOfferId?: string;
  expiresAt?: Date;
}

export interface OfferResult {
  success: boolean;
  offerId?: string;
  driverId?: string;
  expiresAt?: Date;
  error?: string;
}

type DispatchLogEntry = {
  timestamp: string;
  event: string;
  details?: Record<string, unknown>;
};

export class DispatchService {
  private static instance: DispatchService;

  public static getInstance(): DispatchService {
    if (!DispatchService.instance) {
      DispatchService.instance = new DispatchService();
    }
    return DispatchService.instance;
  }

  async createDispatchSession(
    input: CreateDispatchSessionInput
  ): Promise<DispatchSessionResult> {
    const config = getDispatchConfig(input.countryCode, input.serviceType);
    
    const serviceMode = this.getServiceMode(input.serviceType);
    
    let candidates: AvailableDriver[] = [];
    
    if (input.pickupLat && input.pickupLng) {
      candidates = await driverRealtimeStateService.findNearestDriversForDispatch({
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        serviceMode,
        countryCode: input.countryCode || undefined,
        cityCode: input.cityCode || undefined,
        maxRadiusKm: config.maxRadiusKm,
        maxCandidates: config.maxCandidates,
      });
    }

    const sessionExpiresAt = new Date(
      Date.now() + config.sessionTimeoutMinutes * 60 * 1000
    );

    const session = await prisma.dispatchSession.create({
      data: {
        serviceType: input.serviceType,
        entityId: input.entityId,
        customerId: input.customerId,
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        dropoffLat: input.dropoffLat,
        dropoffLng: input.dropoffLng,
        pickupAddress: input.pickupAddress,
        dropoffAddress: input.dropoffAddress,
        countryCode: input.countryCode,
        cityCode: input.cityCode,
        status: candidates.length > 0 
          ? DispatchSessionStatus.searching_driver 
          : DispatchSessionStatus.no_driver_found,
        candidateDriverIds: candidates.map((c) => c.driverId),
        maxRadiusKm: config.maxRadiusKm,
        offerTimeoutSeconds: config.offerTimeoutSeconds,
        expiresAt: sessionExpiresAt,
        searchRound: 1,
        logs: [{
          timestamp: new Date().toISOString(),
          event: 'session_created',
          details: { candidateCount: candidates.length },
        }] as unknown as DispatchLogEntry[],
      },
    });

    if (input.serviceType === 'ride') {
      await prisma.ride.update({
        where: { id: input.entityId },
        data: {
          dispatchSessionId: session.id,
          dispatchStatus: session.status,
          requestedAt: new Date(),
        },
      });
    } else if (input.serviceType === 'food') {
      await prisma.foodOrder.update({
        where: { id: input.entityId },
        data: {
          dispatchSessionId: session.id,
        },
      });
    } else if (input.serviceType === 'parcel') {
      await prisma.delivery.update({
        where: { id: input.entityId },
        data: {
          dispatchSessionId: session.id,
        },
      });
    }

    return {
      sessionId: session.id,
      status: session.status,
      candidateDrivers: candidates,
    };
  }

  async sendOfferToNextDriver(sessionId: string): Promise<OfferResult> {
    const session = await prisma.dispatchSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.status === DispatchSessionStatus.driver_accepted) {
      return { success: false, error: 'Session already accepted' };
    }

    if (session.status === DispatchSessionStatus.no_driver_found) {
      return { success: false, error: 'No drivers available' };
    }

    const excludeIds = [
      ...session.rejectedDriverIds,
      ...session.expiredDriverIds,
    ];

    const nextDriverId = session.candidateDriverIds.find(
      (id) => !excludeIds.includes(id)
    );

    if (!nextDriverId) {
      await this.handleNoDriversLeft(session.id);
      return { success: false, error: 'No more candidate drivers' };
    }

    const offerTimeoutMs = getOfferTimeoutMs(
      session.countryCode,
      session.serviceType
    );
    const expiresAt = new Date(Date.now() + offerTimeoutMs);

    const driverState = await driverRealtimeStateService.getDriverState(
      nextDriverId
    );

    const offer = await prisma.dispatchOfferEvent.create({
      data: {
        dispatchSessionId: sessionId,
        driverId: nextDriverId,
        expiresAt,
        driverLat: driverState?.lastKnownLat,
        driverLng: driverState?.lastKnownLng,
        distanceKm: driverState?.lastKnownLat && session.pickupLat
          ? driverRealtimeStateService.calculateHaversineDistance(
              session.pickupLat,
              session.pickupLng!,
              driverState.lastKnownLat,
              driverState.lastKnownLng!
            )
          : undefined,
      },
    });

    await prisma.dispatchSession.update({
      where: { id: sessionId },
      data: {
        status: DispatchSessionStatus.offer_pending,
        currentOfferDriverId: nextDriverId,
        currentOfferExpiresAt: expiresAt,
        logs: {
          push: {
            timestamp: new Date().toISOString(),
            event: 'offer_sent',
            details: { driverId: nextDriverId, offerId: offer.id },
          },
        },
      },
    });

    if (session.serviceType === 'ride') {
      await prisma.ride.update({
        where: { id: session.entityId },
        data: { dispatchStatus: DispatchSessionStatus.offer_pending },
      });
    }

    return {
      success: true,
      offerId: offer.id,
      driverId: nextDriverId,
      expiresAt,
    };
  }

  async handleDriverAccept(
    sessionId: string,
    driverId: string
  ): Promise<{ success: boolean; error?: string }> {
    const session = await prisma.dispatchSession.findUnique({
      where: { id: sessionId },
      include: {
        offerEvents: {
          where: { driverId, response: null },
          orderBy: { offeredAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.currentOfferDriverId !== driverId) {
      return { success: false, error: 'Offer not for this driver' };
    }

    const offer = session.offerEvents[0];
    if (!offer) {
      return { success: false, error: 'No pending offer found' };
    }

    if (new Date() > offer.expiresAt) {
      return { success: false, error: 'Offer has expired' };
    }

    await prisma.$transaction([
      prisma.dispatchOfferEvent.update({
        where: { id: offer.id },
        data: { response: 'accept', respondedAt: new Date() },
      }),
      prisma.dispatchSession.update({
        where: { id: sessionId },
        data: {
          status: DispatchSessionStatus.driver_accepted,
          assignedDriverId: driverId,
          acceptedAt: new Date(),
          currentOfferDriverId: null,
          currentOfferExpiresAt: null,
          logs: {
            push: {
              timestamp: new Date().toISOString(),
              event: 'driver_accepted',
              details: { driverId },
            },
          },
        },
      }),
    ]);

    await driverRealtimeStateService.setDriverBusy(driverId, sessionId);

    if (session.serviceType === 'ride') {
      await prisma.ride.update({
        where: { id: session.entityId },
        data: {
          driverId,
          status: 'accepted',
          dispatchStatus: DispatchSessionStatus.driver_accepted,
          acceptedAt: new Date(),
        },
      });
    } else if (session.serviceType === 'food') {
      await prisma.foodOrder.update({
        where: { id: session.entityId },
        data: {
          driverId,
          status: 'driver_assigned',
        },
      });
    } else if (session.serviceType === 'parcel') {
      await prisma.delivery.update({
        where: { id: session.entityId },
        data: {
          driverId,
          status: 'driver_assigned',
        },
      });
    }

    return { success: true };
  }

  async handleDriverReject(
    sessionId: string,
    driverId: string,
    reason?: string
  ): Promise<{ success: boolean; nextOfferId?: string; error?: string }> {
    const session = await prisma.dispatchSession.findUnique({
      where: { id: sessionId },
      include: {
        offerEvents: {
          where: { driverId, response: null },
          orderBy: { offeredAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    const offer = session.offerEvents[0];
    if (offer) {
      await prisma.dispatchOfferEvent.update({
        where: { id: offer.id },
        data: { response: 'reject', respondedAt: new Date() },
      });
    }

    await prisma.dispatchSession.update({
      where: { id: sessionId },
      data: {
        rejectedDriverIds: { push: driverId },
        currentOfferDriverId: null,
        currentOfferExpiresAt: null,
        logs: {
          push: {
            timestamp: new Date().toISOString(),
            event: 'driver_rejected',
            details: { driverId, reason },
          },
        },
      },
    });

    const nextOffer = await this.sendOfferToNextDriver(sessionId);
    
    return {
      success: true,
      nextOfferId: nextOffer.offerId,
    };
  }

  async handleOfferExpired(
    sessionId: string,
    offerId: string
  ): Promise<{ success: boolean; nextOfferId?: string }> {
    const offer = await prisma.dispatchOfferEvent.findUnique({
      where: { id: offerId },
    });

    if (!offer || offer.response !== null) {
      return { success: false };
    }

    await prisma.dispatchOfferEvent.update({
      where: { id: offerId },
      data: { response: 'expired', respondedAt: new Date() },
    });

    await prisma.dispatchSession.update({
      where: { id: sessionId },
      data: {
        expiredDriverIds: { push: offer.driverId },
        currentOfferDriverId: null,
        currentOfferExpiresAt: null,
        logs: {
          push: {
            timestamp: new Date().toISOString(),
            event: 'offer_expired',
            details: { driverId: offer.driverId, offerId },
          },
        },
      },
    });

    const nextOffer = await this.sendOfferToNextDriver(sessionId);
    
    return {
      success: true,
      nextOfferId: nextOffer.offerId,
    };
  }

  async cancelDispatchSession(
    sessionId: string,
    cancelledBy: 'customer' | 'admin' | 'system'
  ): Promise<void> {
    const status =
      cancelledBy === 'customer'
        ? DispatchSessionStatus.cancelled_by_customer
        : DispatchSessionStatus.cancelled_by_admin;

    const session = await prisma.dispatchSession.update({
      where: { id: sessionId },
      data: {
        status,
        currentOfferDriverId: null,
        currentOfferExpiresAt: null,
        logs: {
          push: {
            timestamp: new Date().toISOString(),
            event: 'session_cancelled',
            details: { cancelledBy },
          },
        },
      },
    });

    if (session.serviceType === 'ride') {
      await prisma.ride.update({
        where: { id: session.entityId },
        data: {
          dispatchStatus: status,
          status: 'cancelled',
          cancelledAt: new Date(),
          whoCancelled: cancelledBy,
        },
      });
    }
  }

  async getDispatchSession(sessionId: string) {
    return prisma.dispatchSession.findUnique({
      where: { id: sessionId },
      include: {
        customer: {
          select: {
            id: true,
            userId: true,
            fullName: true,
          },
        },
        assignedDriver: {
          select: {
            id: true,
            userId: true,
            fullName: true,
            phoneNumber: true,
            vehicles: {
              where: { isPrimary: true, isActive: true },
              select: {
                make: true,
                vehicleModel: true,
                color: true,
                vehiclePlate: true,
                vehicleType: true,
              },
            },
          },
        },
        offerEvents: {
          orderBy: { offeredAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async getActiveDispatchSessionForRide(rideId: string) {
    return prisma.dispatchSession.findFirst({
      where: {
        entityId: rideId,
        serviceType: 'ride',
        status: {
          notIn: [
            DispatchSessionStatus.cancelled_by_customer,
            DispatchSessionStatus.cancelled_by_admin,
            DispatchSessionStatus.expired,
          ],
        },
      },
    });
  }

  async getActiveDispatchSessionForFoodOrder(orderId: string) {
    return prisma.dispatchSession.findFirst({
      where: {
        entityId: orderId,
        serviceType: 'food',
        status: {
          notIn: [
            DispatchSessionStatus.cancelled_by_customer,
            DispatchSessionStatus.cancelled_by_admin,
            DispatchSessionStatus.expired,
          ],
        },
      },
    });
  }

  async getActiveDispatchSessionForDelivery(deliveryId: string) {
    return prisma.dispatchSession.findFirst({
      where: {
        entityId: deliveryId,
        serviceType: 'parcel',
        status: {
          notIn: [
            DispatchSessionStatus.cancelled_by_customer,
            DispatchSessionStatus.cancelled_by_admin,
            DispatchSessionStatus.expired,
          ],
        },
      },
    });
  }

  async initiateDispatchForFoodOrder(orderId: string): Promise<DispatchSessionResult | null> {
    const order = await prisma.foodOrder.findUnique({
      where: { id: orderId },
      include: {
        restaurant: {
          select: {
            lat: true,
            lng: true,
            address: true,
            countryCode: true,
            cityCode: true,
          },
        },
        deliveryAddress: {
          select: {
            lat: true,
            lng: true,
            fullAddress: true,
          },
        },
      },
    });

    if (!order || !order.restaurant) {
      return null;
    }

    return this.createDispatchSession({
      serviceType: 'food',
      entityId: orderId,
      customerId: order.customerId,
      pickupLat: order.restaurant.lat,
      pickupLng: order.restaurant.lng,
      pickupAddress: order.restaurant.address,
      dropoffLat: order.deliveryAddress?.lat,
      dropoffLng: order.deliveryAddress?.lng,
      dropoffAddress: order.deliveryAddress?.fullAddress,
      countryCode: order.restaurant.countryCode,
      cityCode: order.restaurant.cityCode,
    });
  }

  async initiateDispatchForDelivery(deliveryId: string): Promise<DispatchSessionResult | null> {
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        customerId: true,
        pickupLat: true,
        pickupLng: true,
        dropoffLat: true,
        dropoffLng: true,
        pickupAddress: true,
        dropoffAddress: true,
        countryCode: true,
        cityCode: true,
      },
    });

    if (!delivery) {
      return null;
    }

    return this.createDispatchSession({
      serviceType: 'parcel',
      entityId: deliveryId,
      customerId: delivery.customerId,
      pickupLat: delivery.pickupLat,
      pickupLng: delivery.pickupLng,
      pickupAddress: delivery.pickupAddress,
      dropoffLat: delivery.dropoffLat,
      dropoffLng: delivery.dropoffLng,
      dropoffAddress: delivery.dropoffAddress,
      countryCode: delivery.countryCode,
      cityCode: delivery.cityCode,
    });
  }

  private async handleNoDriversLeft(sessionId: string): Promise<void> {
    const session = await prisma.dispatchSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) return;

    const config = getDispatchConfig(session.countryCode, session.serviceType);

    if (session.searchRound < config.maxSearchRounds) {
      const newRadius = session.maxRadiusKm! + config.radiusIncrementKm;
      
      const serviceMode = this.getServiceMode(session.serviceType);
      
      const newCandidates = session.pickupLat && session.pickupLng
        ? await driverRealtimeStateService.findNearestDriversForDispatch({
            pickupLat: session.pickupLat,
            pickupLng: session.pickupLng,
            serviceMode,
            countryCode: session.countryCode || undefined,
            cityCode: session.cityCode || undefined,
            maxRadiusKm: newRadius,
            maxCandidates: config.maxCandidates,
            excludeDriverIds: [
              ...session.rejectedDriverIds,
              ...session.expiredDriverIds,
            ],
          })
        : [];

      if (newCandidates.length > 0) {
        await prisma.dispatchSession.update({
          where: { id: sessionId },
          data: {
            searchRound: session.searchRound + 1,
            maxRadiusKm: newRadius,
            candidateDriverIds: newCandidates.map((c) => c.driverId),
            status: DispatchSessionStatus.searching_driver,
            logs: {
              push: {
                timestamp: new Date().toISOString(),
                event: 'search_round_expanded',
                details: {
                  round: session.searchRound + 1,
                  newRadius,
                  newCandidateCount: newCandidates.length,
                },
              },
            },
          },
        });
        return;
      }
    }

    await prisma.dispatchSession.update({
      where: { id: sessionId },
      data: {
        status: DispatchSessionStatus.no_driver_found,
        logs: {
          push: {
            timestamp: new Date().toISOString(),
            event: 'no_drivers_available',
            details: { searchRounds: session.searchRound },
          },
        },
      },
    });

    if (session.serviceType === 'ride') {
      await prisma.ride.update({
        where: { id: session.entityId },
        data: { dispatchStatus: DispatchSessionStatus.no_driver_found },
      });
    }
  }

  private getServiceMode(serviceType: DeliveryServiceType): DispatchServiceMode {
    switch (serviceType) {
      case 'ride':
        return DispatchServiceMode.ride;
      case 'food':
        return DispatchServiceMode.food;
      case 'parcel':
        return DispatchServiceMode.parcel;
      default:
        return DispatchServiceMode.ride;
    }
  }
}

export const dispatchService = DispatchService.getInstance();
