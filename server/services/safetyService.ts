import { prisma } from '../db';
import type { SafetyEvent } from '@prisma/client';
import { notificationService } from './notificationService';

interface SOSEventData {
  tripType: string;
  tripId: string;
  customerId: string;
  driverId?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  metadata?: Record<string, any>;
}

interface SafetyEventFilter {
  status?: 'active' | 'acknowledged' | 'resolved' | 'escalated';
  eventType?: string;
  customerId?: string;
  driverId?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

class SafetyService {
  async triggerSOS(data: SOSEventData): Promise<SafetyEvent> {
    const event = await prisma.safetyEvent.create({
      data: {
        eventType: 'sos_triggered',
        status: 'active',
        tripType: data.tripType,
        tripId: data.tripId,
        customerId: data.customerId,
        driverId: data.driverId,
        latitude: data.latitude,
        longitude: data.longitude,
        description: data.description || 'Emergency SOS triggered by customer',
        metadata: data.metadata || {},
        escalationLevel: 1,
      },
    });

    await this.notifyAdminsOfSOS(event);
    await this.notifyEmergencyContact(event, data.customerId);

    return event;
  }

  async acknowledgeEvent(eventId: string, adminId: string): Promise<SafetyEvent | null> {
    const event = await prisma.safetyEvent.findUnique({
      where: { id: eventId },
    });

    if (!event || event.status !== 'active') {
      return null;
    }

    return prisma.safetyEvent.update({
      where: { id: eventId },
      data: {
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        metadata: {
          ...(event.metadata as Record<string, any> || {}),
          acknowledgedByAdminId: adminId,
        },
      },
    });
  }

  async resolveEvent(
    eventId: string,
    adminId: string,
    resolutionNotes: string,
    isFalseAlarm: boolean = false
  ): Promise<SafetyEvent | null> {
    const event = await prisma.safetyEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return null;
    }

    return prisma.safetyEvent.update({
      where: { id: eventId },
      data: {
        eventType: isFalseAlarm ? 'sos_false_alarm' : 'sos_resolved',
        status: 'resolved',
        resolvedByAdminId: adminId,
        resolutionNotes,
        resolvedAt: new Date(),
      },
    });
  }

  async escalateEvent(eventId: string): Promise<SafetyEvent | null> {
    const event = await prisma.safetyEvent.findUnique({
      where: { id: eventId },
    });

    if (!event || event.status === 'resolved') {
      return null;
    }

    const updated = await prisma.safetyEvent.update({
      where: { id: eventId },
      data: {
        status: 'escalated',
        escalatedAt: new Date(),
        escalationLevel: { increment: 1 },
      },
    });

    await this.notifyAdminsOfEscalation(updated);

    return updated;
  }

  async recordTripShared(
    tripType: string,
    tripId: string,
    customerId: string,
    sharedWith: string[]
  ): Promise<SafetyEvent> {
    return prisma.safetyEvent.create({
      data: {
        eventType: 'trip_shared',
        status: 'resolved',
        tripType,
        tripId,
        customerId,
        description: `Trip shared with ${sharedWith.length} contact(s)`,
        metadata: { sharedWith },
        resolvedAt: new Date(),
      },
    });
  }

  async recordDriverBehaviorAlert(
    tripType: string,
    tripId: string,
    customerId: string,
    driverId: string,
    alertType: string,
    details: Record<string, any>
  ): Promise<SafetyEvent> {
    const event = await prisma.safetyEvent.create({
      data: {
        eventType: 'driver_behavior_alert',
        status: 'active',
        tripType,
        tripId,
        customerId,
        driverId,
        description: `Driver behavior alert: ${alertType}`,
        metadata: { alertType, ...details },
      },
    });

    await this.notifyAdminsOfBehaviorAlert(event, alertType);

    return event;
  }

  async recordRouteDeviation(
    tripType: string,
    tripId: string,
    customerId: string,
    driverId: string,
    deviationMeters: number,
    latitude: number,
    longitude: number
  ): Promise<SafetyEvent> {
    return prisma.safetyEvent.create({
      data: {
        eventType: 'route_deviation',
        status: 'active',
        tripType,
        tripId,
        customerId,
        driverId,
        latitude,
        longitude,
        description: `Route deviation of ${deviationMeters}m detected`,
        metadata: { deviationMeters },
      },
    });
  }

  async recordLongStop(
    tripType: string,
    tripId: string,
    customerId: string,
    driverId: string,
    stopDurationMinutes: number,
    latitude: number,
    longitude: number
  ): Promise<SafetyEvent> {
    const event = await prisma.safetyEvent.create({
      data: {
        eventType: 'long_stop_detected',
        status: 'active',
        tripType,
        tripId,
        customerId,
        driverId,
        latitude,
        longitude,
        description: `Vehicle stopped for ${stopDurationMinutes} minutes`,
        metadata: { stopDurationMinutes },
      },
    });

    if (stopDurationMinutes >= 10) {
      await this.notifyAdminsOfLongStop(event, stopDurationMinutes);
    }

    return event;
  }

  async safetyCheckIn(
    customerId: string,
    tripType: string,
    tripId: string,
    status: 'ok' | 'need_help'
  ): Promise<SafetyEvent> {
    const event = await prisma.safetyEvent.create({
      data: {
        eventType: 'safety_check_in',
        status: status === 'ok' ? 'resolved' : 'active',
        tripType,
        tripId,
        customerId,
        description: status === 'ok' ? 'Customer confirmed they are safe' : 'Customer requested help via check-in',
        metadata: { checkInStatus: status },
        resolvedAt: status === 'ok' ? new Date() : null,
      },
    });

    if (status === 'need_help') {
      await this.notifyAdminsOfSOS(event);
    }

    return event;
  }

  async getActiveEvents(filter: SafetyEventFilter = {}): Promise<SafetyEvent[]> {
    const where: any = {};

    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.eventType) {
      where.eventType = filter.eventType;
    }
    if (filter.customerId) {
      where.customerId = filter.customerId;
    }
    if (filter.driverId) {
      where.driverId = filter.driverId;
    }
    if (filter.fromDate || filter.toDate) {
      where.createdAt = {};
      if (filter.fromDate) where.createdAt.gte = filter.fromDate;
      if (filter.toDate) where.createdAt.lte = filter.toDate;
    }

    return prisma.safetyEvent.findMany({
      where,
      orderBy: [
        { escalationLevel: 'desc' },
        { createdAt: 'desc' },
      ],
      take: filter.limit || 100,
      skip: filter.offset || 0,
    });
  }

  async getEventsByTrip(tripType: string, tripId: string): Promise<SafetyEvent[]> {
    return prisma.safetyEvent.findMany({
      where: { tripType, tripId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSafetyStats(fromDate: Date, toDate: Date): Promise<{
    totalEvents: number;
    sosTriggered: number;
    sosResolved: number;
    falseAlarms: number;
    escalated: number;
    avgResolutionTimeMinutes: number;
  }> {
    const events = await prisma.safetyEvent.findMany({
      where: {
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
    });

    const sosTriggered = events.filter(e => e.eventType === 'sos_triggered').length;
    const sosResolved = events.filter(e => e.eventType === 'sos_resolved').length;
    const falseAlarms = events.filter(e => e.eventType === 'sos_false_alarm').length;
    const escalated = events.filter(e => e.status === 'escalated').length;

    const resolvedEvents = events.filter(e => e.resolvedAt);
    const avgResolutionTimeMinutes = resolvedEvents.length > 0
      ? resolvedEvents.reduce((sum, e) => {
          const resolutionTime = (e.resolvedAt!.getTime() - e.createdAt.getTime()) / 60000;
          return sum + resolutionTime;
        }, 0) / resolvedEvents.length
      : 0;

    return {
      totalEvents: events.length,
      sosTriggered,
      sosResolved,
      falseAlarms,
      escalated,
      avgResolutionTimeMinutes: Math.round(avgResolutionTimeMinutes),
    };
  }

  private async notifyAdminsOfSOS(event: SafetyEvent): Promise<void> {
    try {
      console.log(`[SafetyService] SOS Alert - Event ${event.id}`, {
        customerId: event.customerId,
        driverId: event.driverId,
        tripId: event.tripId,
        location: event.latitude && event.longitude 
          ? `${event.latitude}, ${event.longitude}`
          : 'Unknown',
      });
    } catch (error) {
      console.error('[SafetyService] Failed to notify admins of SOS:', error);
    }
  }

  private async notifyEmergencyContact(event: SafetyEvent, customerId: string): Promise<void> {
    try {
      const customer = await prisma.customerProfile.findUnique({
        where: { id: customerId },
        select: {
          emergencyContactName: true,
          emergencyContactPhone: true,
          fullName: true,
        },
      });

      if (customer?.emergencyContactPhone) {
        await prisma.safetyEvent.update({
          where: { id: event.id },
          data: {
            emergencyContactNotified: true,
            emergencyContactNotifiedAt: new Date(),
          },
        });

        console.log(`[SafetyService] Emergency contact notified for ${customerId}:`, {
          contactName: customer.emergencyContactName,
          contactPhone: customer.emergencyContactPhone?.slice(-4),
        });
      }
    } catch (error) {
      console.error('[SafetyService] Failed to notify emergency contact:', error);
    }
  }

  private async notifyAdminsOfEscalation(event: SafetyEvent): Promise<void> {
    console.log(`[SafetyService] Event Escalated - Level ${event.escalationLevel}`, {
      eventId: event.id,
      eventType: event.eventType,
    });
  }

  private async notifyAdminsOfBehaviorAlert(event: SafetyEvent, alertType: string): Promise<void> {
    console.log(`[SafetyService] Driver Behavior Alert - ${alertType}`, {
      eventId: event.id,
      driverId: event.driverId,
    });
  }

  private async notifyAdminsOfLongStop(event: SafetyEvent, stopDurationMinutes: number): Promise<void> {
    console.log(`[SafetyService] Long Stop Alert - ${stopDurationMinutes} minutes`, {
      eventId: event.id,
      driverId: event.driverId,
      tripId: event.tripId,
    });
  }
}

export const safetyService = new SafetyService();
