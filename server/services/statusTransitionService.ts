/**
 * SafeGo Phase 1B: Status Transition Service
 * Unified status management across ride, food, and parcel services
 */

import { prisma } from '../db';
import { DeliveryServiceType, DispatchSessionStatus } from '@prisma/client';

export type ServiceType = 'ride' | 'food' | 'parcel';
export type ActorType = 'customer' | 'driver' | 'restaurant' | 'admin' | 'system';

export interface StatusHistoryEntry {
  status: string;
  timestamp: string;
  actor: ActorType;
  actorId?: string;
  notes?: string;
}

export interface StatusTransitionResult {
  success: boolean;
  previousStatus: string;
  newStatus: string;
  error?: string;
}

const RIDE_STATUS_FLOW = [
  'requested',
  'searching_driver',
  'driver_accepted',
  'driver_arriving',
  'in_progress',
  'completed',
] as const;

const RIDE_CANCEL_STATUSES = [
  'cancelled_by_customer',
  'cancelled_by_driver',
  'cancelled_by_admin',
  'no_driver_found',
] as const;

const FOOD_STATUS_FLOW = [
  'placed',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'picked_up',
  'on_the_way',
  'delivered',
] as const;

const FOOD_CANCEL_STATUSES = [
  'cancelled_by_customer',
  'cancelled_by_restaurant',
  'cancelled_by_driver',
  'cancelled_by_admin',
] as const;

const PARCEL_STATUS_FLOW = [
  'requested',
  'searching_driver',
  'accepted',
  'picked_up',
  'on_the_way',
  'delivered',
] as const;

const PARCEL_CANCEL_STATUSES = [
  'cancelled_by_customer',
  'cancelled_by_driver',
  'cancelled_by_admin',
  'no_driver_found',
] as const;

class StatusTransitionService {
  private createHistoryEntry(
    status: string,
    actor: ActorType,
    actorId?: string,
    notes?: string
  ): StatusHistoryEntry {
    return {
      status,
      timestamp: new Date().toISOString(),
      actor,
      actorId,
      notes,
    };
  }

  private appendToHistory(
    existingHistory: unknown,
    newEntry: StatusHistoryEntry
  ): StatusHistoryEntry[] {
    const history = Array.isArray(existingHistory) ? existingHistory : [];
    return [...history, newEntry];
  }

  async transitionRideStatus(
    rideId: string,
    newStatus: string,
    actor: ActorType,
    actorId?: string,
    notes?: string
  ): Promise<StatusTransitionResult> {
    try {
      const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        select: { status: true, statusHistory: true, dispatchSessionId: true },
      });

      if (!ride) {
        return { success: false, previousStatus: '', newStatus, error: 'Ride not found' };
      }

      const previousStatus = ride.status;
      const historyEntry = this.createHistoryEntry(newStatus, actor, actorId, notes);
      const updatedHistory = this.appendToHistory(ride.statusHistory, historyEntry);

      const updateData: Record<string, unknown> = {
        status: newStatus,
        statusHistory: updatedHistory,
      };

      if (newStatus === 'driver_arriving') {
        updateData.arrivedAt = null;
      } else if (newStatus === 'in_progress') {
        updateData.tripStartedAt = new Date();
      } else if (newStatus === 'completed') {
        updateData.completedAt = new Date();
      } else if (newStatus.startsWith('cancelled')) {
        updateData.cancelledAt = new Date();
        updateData.whoCancelled = actor;
        if (notes) updateData.cancellationReason = notes;
      }

      await prisma.ride.update({
        where: { id: rideId },
        data: updateData,
      });

      if (ride.dispatchSessionId) {
        const dispatchStatus = this.mapRideStatusToDispatchStatus(newStatus);
        if (dispatchStatus) {
          await prisma.dispatchSession.update({
            where: { id: ride.dispatchSessionId },
            data: { status: dispatchStatus },
          });
        }
      }

      return { success: true, previousStatus, newStatus };
    } catch (error) {
      console.error('[StatusTransition] Error transitioning ride status:', error);
      return {
        success: false,
        previousStatus: '',
        newStatus,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async transitionFoodOrderStatus(
    orderId: string,
    newStatus: string,
    actor: ActorType,
    actorId?: string,
    notes?: string
  ): Promise<StatusTransitionResult> {
    try {
      const order = await prisma.foodOrder.findUnique({
        where: { id: orderId },
        select: { status: true, statusHistory: true, dispatchSessionId: true },
      });

      if (!order) {
        return { success: false, previousStatus: '', newStatus, error: 'Food order not found' };
      }

      const previousStatus = order.status;
      const historyEntry = this.createHistoryEntry(newStatus, actor, actorId, notes);
      const updatedHistory = this.appendToHistory(order.statusHistory, historyEntry);

      const updateData: Record<string, unknown> = {
        status: newStatus,
        statusHistory: updatedHistory,
      };

      if (newStatus === 'accepted') {
        updateData.acceptedAt = new Date();
      } else if (newStatus === 'preparing') {
        updateData.preparingAt = new Date();
      } else if (newStatus === 'ready_for_pickup') {
        updateData.readyAt = new Date();
      } else if (newStatus === 'picked_up') {
        updateData.pickedUpAt = new Date();
      } else if (newStatus === 'delivered') {
        updateData.deliveredAt = new Date();
      } else if (newStatus.startsWith('cancelled')) {
        updateData.cancelledAt = new Date();
        updateData.whoCancelled = actor;
        if (notes) updateData.cancellationReason = notes;
      }

      await prisma.foodOrder.update({
        where: { id: orderId },
        data: updateData,
      });

      if (order.dispatchSessionId) {
        const dispatchStatus = this.mapFoodStatusToDispatchStatus(newStatus);
        if (dispatchStatus) {
          await prisma.dispatchSession.update({
            where: { id: order.dispatchSessionId },
            data: { status: dispatchStatus },
          });
        }
      }

      return { success: true, previousStatus, newStatus };
    } catch (error) {
      console.error('[StatusTransition] Error transitioning food order status:', error);
      return {
        success: false,
        previousStatus: '',
        newStatus,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async transitionDeliveryStatus(
    deliveryId: string,
    newStatus: string,
    actor: ActorType,
    actorId?: string,
    notes?: string
  ): Promise<StatusTransitionResult> {
    try {
      const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
        select: { status: true, statusHistory: true, dispatchSessionId: true },
      });

      if (!delivery) {
        return { success: false, previousStatus: '', newStatus, error: 'Delivery not found' };
      }

      const previousStatus = delivery.status;
      const historyEntry = this.createHistoryEntry(newStatus, actor, actorId, notes);
      const updatedHistory = this.appendToHistory(delivery.statusHistory, historyEntry);

      const updateData: Record<string, unknown> = {
        status: newStatus,
        statusHistory: updatedHistory,
      };

      if (newStatus === 'accepted') {
        updateData.acceptedAt = new Date();
      } else if (newStatus === 'picked_up') {
        updateData.pickedUpAt = new Date();
      } else if (newStatus === 'delivered') {
        updateData.deliveredAt = new Date();
      }

      await prisma.delivery.update({
        where: { id: deliveryId },
        data: updateData,
      });

      if (delivery.dispatchSessionId) {
        const dispatchStatus = this.mapParcelStatusToDispatchStatus(newStatus);
        if (dispatchStatus) {
          await prisma.dispatchSession.update({
            where: { id: delivery.dispatchSessionId },
            data: { status: dispatchStatus },
          });
        }
      }

      return { success: true, previousStatus, newStatus };
    } catch (error) {
      console.error('[StatusTransition] Error transitioning delivery status:', error);
      return {
        success: false,
        previousStatus: '',
        newStatus,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private mapRideStatusToDispatchStatus(rideStatus: string): DispatchSessionStatus | null {
    const mapping: Record<string, DispatchSessionStatus> = {
      'requested': DispatchSessionStatus.requested,
      'searching_driver': DispatchSessionStatus.searching_driver,
      'driver_accepted': DispatchSessionStatus.driver_accepted,
      'driver_arriving': DispatchSessionStatus.driver_arriving,
      'in_progress': DispatchSessionStatus.in_progress,
      'completed': DispatchSessionStatus.completed,
      'cancelled_by_customer': DispatchSessionStatus.cancelled_by_customer,
      'cancelled_by_driver': DispatchSessionStatus.cancelled_by_driver,
      'cancelled_by_admin': DispatchSessionStatus.cancelled_by_admin,
      'no_driver_found': DispatchSessionStatus.no_driver_found,
    };
    return mapping[rideStatus] || null;
  }

  private mapFoodStatusToDispatchStatus(foodStatus: string): DispatchSessionStatus | null {
    const mapping: Record<string, DispatchSessionStatus> = {
      'driver_assigned': DispatchSessionStatus.driver_accepted,
      'picked_up': DispatchSessionStatus.in_progress,
      'on_the_way': DispatchSessionStatus.in_progress,
      'delivered': DispatchSessionStatus.completed,
      'cancelled_by_customer': DispatchSessionStatus.cancelled_by_customer,
      'cancelled_by_driver': DispatchSessionStatus.cancelled_by_driver,
      'cancelled_by_admin': DispatchSessionStatus.cancelled_by_admin,
    };
    return mapping[foodStatus] || null;
  }

  private mapParcelStatusToDispatchStatus(parcelStatus: string): DispatchSessionStatus | null {
    const mapping: Record<string, DispatchSessionStatus> = {
      'accepted': DispatchSessionStatus.driver_accepted,
      'picked_up': DispatchSessionStatus.in_progress,
      'on_the_way': DispatchSessionStatus.in_progress,
      'delivered': DispatchSessionStatus.completed,
      'cancelled_by_customer': DispatchSessionStatus.cancelled_by_customer,
      'cancelled_by_driver': DispatchSessionStatus.cancelled_by_driver,
      'cancelled_by_admin': DispatchSessionStatus.cancelled_by_admin,
      'no_driver_found': DispatchSessionStatus.no_driver_found,
    };
    return mapping[parcelStatus] || null;
  }

  isValidRideTransition(currentStatus: string, newStatus: string): boolean {
    if (RIDE_CANCEL_STATUSES.includes(newStatus as typeof RIDE_CANCEL_STATUSES[number])) {
      return !['completed', ...RIDE_CANCEL_STATUSES].includes(currentStatus);
    }
    
    const currentIndex = RIDE_STATUS_FLOW.indexOf(currentStatus as typeof RIDE_STATUS_FLOW[number]);
    const newIndex = RIDE_STATUS_FLOW.indexOf(newStatus as typeof RIDE_STATUS_FLOW[number]);
    
    if (currentIndex === -1 || newIndex === -1) return false;
    return newIndex === currentIndex + 1;
  }

  isValidFoodTransition(currentStatus: string, newStatus: string): boolean {
    if (FOOD_CANCEL_STATUSES.includes(newStatus as typeof FOOD_CANCEL_STATUSES[number])) {
      return !['delivered', ...FOOD_CANCEL_STATUSES].includes(currentStatus);
    }
    
    const currentIndex = FOOD_STATUS_FLOW.indexOf(currentStatus as typeof FOOD_STATUS_FLOW[number]);
    const newIndex = FOOD_STATUS_FLOW.indexOf(newStatus as typeof FOOD_STATUS_FLOW[number]);
    
    if (currentIndex === -1 || newIndex === -1) return false;
    return newIndex === currentIndex + 1;
  }

  isValidParcelTransition(currentStatus: string, newStatus: string): boolean {
    if (PARCEL_CANCEL_STATUSES.includes(newStatus as typeof PARCEL_CANCEL_STATUSES[number])) {
      return !['delivered', ...PARCEL_CANCEL_STATUSES].includes(currentStatus);
    }
    
    const currentIndex = PARCEL_STATUS_FLOW.indexOf(currentStatus as typeof PARCEL_STATUS_FLOW[number]);
    const newIndex = PARCEL_STATUS_FLOW.indexOf(newStatus as typeof PARCEL_STATUS_FLOW[number]);
    
    if (currentIndex === -1 || newIndex === -1) return false;
    return newIndex === currentIndex + 1;
  }
}

export const statusTransitionService = new StatusTransitionService();
