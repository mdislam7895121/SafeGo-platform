import { prisma } from '../db';
import crypto from 'crypto';
import { SOSEscalationLevel, SOSAlertStatus } from '@prisma/client';

export interface SOSTriggerData {
  userId: string;
  rideId?: string;
  foodOrderId?: string;
  location: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  triggerReason: 'button_press' | 'voice_command' | 'auto_detected';
  additionalInfo?: string;
}

export interface SOSAlertResult {
  alertId: string;
  status: SOSAlertStatus;
  escalationLevel: SOSEscalationLevel;
  isHighRiskZone: boolean;
  streamingKey?: string;
}

export class SOSSafetyService {
  private static instance: SOSSafetyService;
  private readonly encryptionKey: Buffer;

  constructor() {
    const key = process.env.ENCRYPTION_KEY || 'default-32-char-encryption-key!!';
    this.encryptionKey = Buffer.from(key.slice(0, 32).padEnd(32, '0'));
  }

  static getInstance(): SOSSafetyService {
    if (!this.instance) {
      this.instance = new SOSSafetyService();
    }
    return this.instance;
  }

  async triggerSOS(data: SOSTriggerData): Promise<SOSAlertResult> {
    const isHighRiskZone = await this.checkHighRiskZone(data.location.lat, data.location.lng);
    
    const { encryptedStream, streamKey } = this.initializeEncryptedGpsStream();

    const alert = await prisma.sOSAlert.create({
      data: {
        userId: data.userId,
        rideId: data.rideId,
        foodOrderId: data.foodOrderId,
        triggerLocation: {
          lat: data.location.lat,
          lng: data.location.lng,
          accuracy: data.location.accuracy,
          timestamp: new Date().toISOString()
        },
        encryptedGpsStream: encryptedStream,
        gpsStreamKey: streamKey,
        highRiskZone: isHighRiskZone,
        triggerReason: data.triggerReason,
        additionalInfo: data.additionalInfo,
        escalationLevel: isHighRiskZone ? 'L2_ESCALATED' : 'L1_INITIAL',
        status: 'active'
      }
    });

    if (isHighRiskZone) {
      await this.createEscalationEvent(
        alert.id,
        'L1_INITIAL',
        'L2_ESCALATED',
        'system',
        'Auto-escalated due to high-risk zone'
      );
    }

    await this.sendSOSNotifications(alert.id, data.userId, isHighRiskZone);

    return {
      alertId: alert.id,
      status: alert.status,
      escalationLevel: alert.escalationLevel,
      isHighRiskZone,
      streamingKey: streamKey
    };
  }

  async updateGpsStream(
    alertId: string,
    locations: Array<{ lat: number; lng: number; timestamp: string }>
  ): Promise<void> {
    const alert = await prisma.sOSAlert.findUnique({
      where: { id: alertId },
      select: { encryptedGpsStream: true, gpsStreamKey: true, status: true }
    });

    if (!alert || alert.status !== 'active') {
      throw new Error('SOS alert not active');
    }

    const existingData = alert.encryptedGpsStream 
      ? this.decryptGpsData(alert.encryptedGpsStream, alert.gpsStreamKey!)
      : [];

    const updatedData = [...existingData, ...locations];
    const { encryptedStream } = this.encryptGpsData(updatedData, alert.gpsStreamKey!);

    await prisma.sOSAlert.update({
      where: { id: alertId },
      data: { encryptedGpsStream: encryptedStream }
    });
  }

  async escalateSOS(
    alertId: string,
    toLevel: SOSEscalationLevel,
    escalatedBy: string,
    reason: string
  ): Promise<void> {
    const alert = await prisma.sOSAlert.findUnique({
      where: { id: alertId },
      select: { escalationLevel: true, status: true }
    });

    if (!alert) {
      throw new Error('SOS alert not found');
    }

    if (alert.status !== 'active' && alert.status !== 'escalated') {
      throw new Error('Cannot escalate resolved/cancelled alert');
    }

    const levelOrder: SOSEscalationLevel[] = ['L1_INITIAL', 'L2_ESCALATED', 'L3_EMERGENCY'];
    const currentIndex = levelOrder.indexOf(alert.escalationLevel);
    const targetIndex = levelOrder.indexOf(toLevel);

    if (targetIndex <= currentIndex) {
      throw new Error('Can only escalate to a higher level');
    }

    await prisma.sOSAlert.update({
      where: { id: alertId },
      data: {
        escalationLevel: toLevel,
        status: 'escalated'
      }
    });

    await this.createEscalationEvent(
      alertId,
      alert.escalationLevel,
      toLevel,
      escalatedBy,
      reason
    );

    await this.sendEscalationNotifications(alertId, toLevel);
  }

  async resolveSOS(
    alertId: string,
    respondedBy: string,
    responseNotes: string,
    status: 'resolved' | 'false_alarm' | 'cancelled' = 'resolved'
  ): Promise<void> {
    await prisma.sOSAlert.update({
      where: { id: alertId },
      data: {
        status,
        respondedBy,
        responseNotes,
        resolvedAt: new Date()
      }
    });
  }

  async getActiveAlerts(filters?: {
    escalationLevel?: SOSEscalationLevel;
    highRiskZone?: boolean;
    limit?: number;
  }): Promise<any[]> {
    return prisma.sOSAlert.findMany({
      where: {
        status: { in: ['active', 'escalated'] },
        ...(filters?.escalationLevel && { escalationLevel: filters.escalationLevel }),
        ...(filters?.highRiskZone !== undefined && { highRiskZone: filters.highRiskZone })
      },
      include: {
        user: {
          select: { email: true }
        },
        ride: {
          select: { id: true, status: true, pickupAddress: true, dropoffAddress: true }
        },
        foodOrder: {
          select: { id: true, status: true, deliveryAddress: true }
        },
        escalations: {
          orderBy: { createdAt: 'desc' },
          take: 3
        }
      },
      orderBy: [
        { escalationLevel: 'desc' },
        { createdAt: 'asc' }
      ],
      take: filters?.limit || 50
    });
  }

  async getDecryptedGpsStream(alertId: string): Promise<any[]> {
    const alert = await prisma.sOSAlert.findUnique({
      where: { id: alertId },
      select: { encryptedGpsStream: true, gpsStreamKey: true }
    });

    if (!alert?.encryptedGpsStream || !alert.gpsStreamKey) {
      return [];
    }

    return this.decryptGpsData(alert.encryptedGpsStream, alert.gpsStreamKey);
  }

  async checkHighRiskZone(lat: number, lng: number): Promise<boolean> {
    const zones = await prisma.highRiskZone.findMany({
      where: { isActive: true }
    });

    for (const zone of zones) {
      const boundary = zone.boundary as any;
      if (this.isPointInPolygon({ lat, lng }, boundary)) {
        return true;
      }
    }

    return false;
  }

  async getHighRiskZoneWarning(lat: number, lng: number): Promise<{
    isHighRisk: boolean;
    zone?: { name: string; riskLevel: number; warningMessage: string | null };
  }> {
    const zones = await prisma.highRiskZone.findMany({
      where: { isActive: true }
    });

    for (const zone of zones) {
      const boundary = zone.boundary as any;
      if (this.isPointInPolygon({ lat, lng }, boundary)) {
        return {
          isHighRisk: true,
          zone: {
            name: zone.name,
            riskLevel: zone.riskLevel,
            warningMessage: zone.warningMessage
          }
        };
      }
    }

    return { isHighRisk: false };
  }

  async createHighRiskZone(data: {
    name: string;
    description?: string;
    countryCode: string;
    cityCode?: string;
    boundary: any;
    riskLevel: number;
    warningMessage?: string;
    createdBy: string;
  }): Promise<string> {
    const zone = await prisma.highRiskZone.create({
      data: {
        name: data.name,
        description: data.description,
        countryCode: data.countryCode,
        cityCode: data.cityCode,
        boundary: data.boundary,
        riskLevel: data.riskLevel,
        warningMessage: data.warningMessage,
        createdBy: data.createdBy
      }
    });
    return zone.id;
  }

  private async createEscalationEvent(
    sosAlertId: string,
    fromLevel: SOSEscalationLevel,
    toLevel: SOSEscalationLevel,
    escalatedBy: string,
    reason: string
  ): Promise<void> {
    await prisma.sOSEscalationEvent.create({
      data: {
        sosAlertId,
        fromLevel,
        toLevel,
        escalatedBy,
        reason,
        notificationsSent: []
      }
    });
  }

  private initializeEncryptedGpsStream(): { encryptedStream: string; streamKey: string } {
    const streamKey = crypto.randomBytes(32).toString('hex');
    const { encryptedStream } = this.encryptGpsData([], streamKey);
    return { encryptedStream, streamKey };
  }

  private encryptGpsData(data: any[], keyHex: string): { encryptedStream: string } {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(keyHex, 'hex');
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const jsonData = JSON.stringify(data);
    let encrypted = cipher.update(jsonData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    const encryptedStream = iv.toString('hex') + ':' + authTag + ':' + encrypted;
    
    return { encryptedStream };
  }

  private decryptGpsData(encryptedStream: string, keyHex: string): any[] {
    try {
      const [ivHex, authTagHex, encrypted] = encryptedStream.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const key = Buffer.from(keyHex, 'hex');
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('[SOSSafetyService] Failed to decrypt GPS data:', error);
      return [];
    }
  }

  private isPointInPolygon(
    point: { lat: number; lng: number },
    polygon: { type: string; coordinates: number[][][] }
  ): boolean {
    if (!polygon || polygon.type !== 'Polygon' || !polygon.coordinates) {
      return false;
    }

    const coords = polygon.coordinates[0];
    let inside = false;

    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const xi = coords[i][0], yi = coords[i][1];
      const xj = coords[j][0], yj = coords[j][1];

      const intersect = ((yi > point.lat) !== (yj > point.lat))
        && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }

    return inside;
  }

  private async sendSOSNotifications(alertId: string, userId: string, isHighRiskZone: boolean): Promise<void> {
    console.log(`[SOSSafetyService] Sending SOS notifications for alert ${alertId}, high risk: ${isHighRiskZone}`);
  }

  private async sendEscalationNotifications(alertId: string, level: SOSEscalationLevel): Promise<void> {
    console.log(`[SOSSafetyService] Sending escalation notifications for alert ${alertId} to level ${level}`);
  }
}

export const sosSafetyService = SOSSafetyService.getInstance();
