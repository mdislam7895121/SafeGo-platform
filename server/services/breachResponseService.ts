import { prisma } from '../db';
import { BreachSeverity, BreachStatus, ContainmentAction } from '@prisma/client';
import crypto from 'crypto';

export interface BreachDetectionResult {
  detected: boolean;
  incidentId?: string;
  severity?: BreachSeverity;
  indicators: string[];
  autoContainmentApplied: boolean;
}

export interface ContainmentResult {
  action: ContainmentAction;
  success: boolean;
  affectedResources: string[];
  timestamp: Date;
}

export class BreachResponseService {
  private static instance: BreachResponseService;

  private readonly AUTO_CONTAINMENT_THRESHOLDS = {
    failed_logins: 10,
    unusual_data_access: 50,
    mass_export_attempt: 3
  };

  static getInstance(): BreachResponseService {
    if (!this.instance) {
      this.instance = new BreachResponseService();
    }
    return this.instance;
  }

  async detectAndRespond(params: {
    eventType: string;
    sourceIp?: string;
    userId?: string;
    affectedData?: string[];
    indicators: string[];
    metadata?: Record<string, any>;
  }): Promise<BreachDetectionResult> {
    const severity = this.assessSeverity(params.eventType, params.indicators);
    
    if (!severity) {
      return {
        detected: false,
        indicators: params.indicators,
        autoContainmentApplied: false
      };
    }

    const incident = await prisma.breachIncident.create({
      data: {
        incidentType: params.eventType,
        severity,
        status: 'detected',
        sourceIp: params.sourceIp,
        affectedUserId: params.userId,
        affectedData: params.affectedData,
        indicators: params.indicators,
        metadata: params.metadata,
        detectedAt: new Date()
      }
    });

    let autoContainmentApplied = false;

    if (severity === 'CRITICAL' || severity === 'HIGH') {
      autoContainmentApplied = await this.applyAutoContainment(incident.id, params);
    }

    if (severity === 'CRITICAL' || severity === 'HIGH') {
      await this.notifySecurityTeam(incident.id, severity, params.eventType);
    }

    return {
      detected: true,
      incidentId: incident.id,
      severity,
      indicators: params.indicators,
      autoContainmentApplied
    };
  }

  async applyContainment(
    incidentId: string,
    action: ContainmentAction,
    appliedBy: string,
    affectedResources: string[]
  ): Promise<ContainmentResult> {
    const containment = await prisma.breachContainment.create({
      data: {
        incidentId,
        action,
        appliedBy,
        affectedResources,
        status: 'applied'
      }
    });

    await prisma.breachIncident.update({
      where: { id: incidentId },
      data: {
        status: 'contained',
        containedAt: new Date()
      }
    });

    await this.executeContainmentAction(action, affectedResources);

    return {
      action,
      success: true,
      affectedResources,
      timestamp: containment.appliedAt
    };
  }

  async rollbackContainment(
    containmentId: string,
    rolledBackBy: string
  ): Promise<void> {
    const containment = await prisma.breachContainment.findUnique({
      where: { id: containmentId },
      include: { incident: true }
    });

    if (!containment) {
      throw new Error('Containment record not found');
    }

    await this.reverseContainmentAction(
      containment.action,
      containment.affectedResources as string[]
    );

    await prisma.breachContainment.update({
      where: { id: containmentId },
      data: {
        status: 'rolled_back',
        rolledBackAt: new Date(),
        rolledBackBy
      }
    });
  }

  async updateIncidentStatus(
    incidentId: string,
    status: BreachStatus,
    updatedBy: string,
    notes?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      investigationNotes: notes
    };

    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = updatedBy;
    }

    await prisma.breachIncident.update({
      where: { id: incidentId },
      data: updateData
    });
  }

  async getActiveIncidents(): Promise<any[]> {
    return prisma.breachIncident.findMany({
      where: {
        status: { notIn: ['resolved', 'closed'] }
      },
      include: {
        containments: true
      },
      orderBy: [
        { severity: 'desc' },
        { detectedAt: 'desc' }
      ]
    });
  }

  async getIncidentDetails(incidentId: string): Promise<any | null> {
    return prisma.breachIncident.findUnique({
      where: { id: incidentId },
      include: {
        containments: {
          orderBy: { appliedAt: 'desc' }
        },
        affectedUser: {
          select: { email: true }
        }
      }
    });
  }

  async searchIncidents(params: {
    severity?: BreachSeverity;
    status?: BreachStatus;
    startDate?: Date;
    endDate?: Date;
    incidentType?: string;
    limit?: number;
  }): Promise<any[]> {
    return prisma.breachIncident.findMany({
      where: {
        ...(params.severity && { severity: params.severity }),
        ...(params.status && { status: params.status }),
        ...(params.incidentType && { incidentType: params.incidentType }),
        ...(params.startDate || params.endDate) && {
          detectedAt: {
            ...(params.startDate && { gte: params.startDate }),
            ...(params.endDate && { lte: params.endDate })
          }
        }
      },
      include: {
        containments: {
          take: 1,
          orderBy: { appliedAt: 'desc' }
        }
      },
      orderBy: { detectedAt: 'desc' },
      take: params.limit || 50
    });
  }

  async getBreachStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalIncidents: number;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    avgTimeToContain: number;
    avgTimeToResolve: number;
  }> {
    const incidents = await prisma.breachIncident.findMany({
      where: {
        detectedAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalContainTime = 0;
    let containedCount = 0;
    let totalResolveTime = 0;
    let resolvedCount = 0;

    for (const i of incidents) {
      bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
      byStatus[i.status] = (byStatus[i.status] || 0) + 1;
      byType[i.incidentType] = (byType[i.incidentType] || 0) + 1;

      if (i.containedAt) {
        totalContainTime += i.containedAt.getTime() - i.detectedAt.getTime();
        containedCount++;
      }

      if (i.resolvedAt) {
        totalResolveTime += i.resolvedAt.getTime() - i.detectedAt.getTime();
        resolvedCount++;
      }
    }

    return {
      totalIncidents: incidents.length,
      bySeverity,
      byStatus,
      byType,
      avgTimeToContain: containedCount > 0 ? totalContainTime / containedCount : 0,
      avgTimeToResolve: resolvedCount > 0 ? totalResolveTime / resolvedCount : 0
    };
  }

  async generateIncidentReport(incidentId: string): Promise<{
    summary: string;
    timeline: Array<{ time: Date; event: string }>;
    affectedScope: string[];
    containmentActions: string[];
    recommendations: string[];
  }> {
    const incident = await this.getIncidentDetails(incidentId);

    if (!incident) {
      throw new Error('Incident not found');
    }

    const timeline: Array<{ time: Date; event: string }> = [
      { time: incident.detectedAt, event: 'Incident detected' }
    ];

    if (incident.containedAt) {
      timeline.push({ time: incident.containedAt, event: 'Containment applied' });
    }

    if (incident.resolvedAt) {
      timeline.push({ time: incident.resolvedAt, event: 'Incident resolved' });
    }

    for (const c of incident.containments) {
      timeline.push({
        time: c.appliedAt,
        event: `Containment action: ${c.action}`
      });
    }

    timeline.sort((a, b) => a.time.getTime() - b.time.getTime());

    return {
      summary: `${incident.severity} ${incident.incidentType} incident detected on ${incident.detectedAt.toISOString()}`,
      timeline,
      affectedScope: incident.affectedData || [],
      containmentActions: incident.containments.map((c: any) => c.action),
      recommendations: this.generateRecommendations(incident)
    };
  }

  private assessSeverity(eventType: string, indicators: string[]): BreachSeverity | null {
    const criticalEvents = [
      'mass_data_exfiltration',
      'admin_compromise',
      'payment_system_breach',
      'database_unauthorized_access'
    ];

    const highEvents = [
      'credential_stuffing',
      'privilege_escalation',
      'api_key_exposure',
      'pii_exposure'
    ];

    const mediumEvents = [
      'brute_force_attack',
      'suspicious_bulk_access',
      'unusual_admin_activity'
    ];

    if (criticalEvents.includes(eventType) || indicators.length > 5) {
      return 'CRITICAL';
    }

    if (highEvents.includes(eventType) || indicators.length > 3) {
      return 'HIGH';
    }

    if (mediumEvents.includes(eventType) || indicators.length > 1) {
      return 'MEDIUM';
    }

    if (indicators.length > 0) {
      return 'LOW';
    }

    return null;
  }

  private async applyAutoContainment(
    incidentId: string,
    params: { sourceIp?: string; userId?: string; eventType: string }
  ): Promise<boolean> {
    const actions: ContainmentAction[] = [];
    const affectedResources: string[] = [];

    if (params.sourceIp) {
      actions.push('block_ip');
      affectedResources.push(`ip:${params.sourceIp}`);

      await prisma.apiThreatSignal.upsert({
        where: { ipAddress: params.sourceIp },
        create: {
          ipAddress: params.sourceIp,
          isBlocked: true,
          reputationScore: 0,
          lastSeenAt: new Date()
        },
        update: {
          isBlocked: true,
          reputationScore: 0,
          lastSeenAt: new Date()
        }
      });
    }

    if (params.userId && ['credential_stuffing', 'account_takeover'].includes(params.eventType)) {
      actions.push('disable_account');
      affectedResources.push(`user:${params.userId}`);
    }

    if (actions.length > 0) {
      for (const action of actions) {
        await prisma.breachContainment.create({
          data: {
            incidentId,
            action,
            appliedBy: 'system',
            affectedResources,
            status: 'applied'
          }
        });
      }

      await prisma.breachIncident.update({
        where: { id: incidentId },
        data: {
          status: 'contained',
          containedAt: new Date()
        }
      });

      return true;
    }

    return false;
  }

  private async executeContainmentAction(
    action: ContainmentAction,
    affectedResources: string[]
  ): Promise<void> {
    console.log(`[BreachResponseService] Executing ${action} on resources:`, affectedResources);

    switch (action) {
      case 'block_ip':
        for (const resource of affectedResources) {
          if (resource.startsWith('ip:')) {
            const ip = resource.replace('ip:', '');
            await prisma.apiThreatSignal.upsert({
              where: { ipAddress: ip },
              create: {
                ipAddress: ip,
                isBlocked: true,
                reputationScore: 0,
                lastSeenAt: new Date()
              },
              update: {
                isBlocked: true,
                lastSeenAt: new Date()
              }
            });
          }
        }
        break;

      case 'disable_account':
        for (const resource of affectedResources) {
          if (resource.startsWith('user:')) {
            const userId = resource.replace('user:', '');
            await prisma.user.update({
              where: { id: userId },
              data: { isActive: false }
            });
          }
        }
        break;

      case 'revoke_sessions':
        console.log('[BreachResponseService] Session revocation would be implemented here');
        break;

      case 'rotate_keys':
        console.log('[BreachResponseService] Key rotation would be implemented here');
        break;

      case 'isolate_service':
        console.log('[BreachResponseService] Service isolation would be implemented here');
        break;
    }
  }

  private async reverseContainmentAction(
    action: ContainmentAction,
    affectedResources: string[]
  ): Promise<void> {
    console.log(`[BreachResponseService] Rolling back ${action} on resources:`, affectedResources);

    switch (action) {
      case 'block_ip':
        for (const resource of affectedResources) {
          if (resource.startsWith('ip:')) {
            const ip = resource.replace('ip:', '');
            await prisma.apiThreatSignal.update({
              where: { ipAddress: ip },
              data: { isBlocked: false }
            });
          }
        }
        break;

      case 'disable_account':
        for (const resource of affectedResources) {
          if (resource.startsWith('user:')) {
            const userId = resource.replace('user:', '');
            await prisma.user.update({
              where: { id: userId },
              data: { isActive: true }
            });
          }
        }
        break;
    }
  }

  private async notifySecurityTeam(
    incidentId: string,
    severity: BreachSeverity,
    eventType: string
  ): Promise<void> {
    console.log(`[BreachResponseService] SECURITY ALERT: ${severity} incident ${incidentId} - ${eventType}`);
  }

  private generateRecommendations(incident: any): string[] {
    const recommendations: string[] = [];

    switch (incident.incidentType) {
      case 'credential_stuffing':
        recommendations.push('Enforce password reset for affected accounts');
        recommendations.push('Implement stricter rate limiting on login endpoints');
        recommendations.push('Consider adding CAPTCHA to login flow');
        break;
      case 'api_key_exposure':
        recommendations.push('Rotate all exposed API keys immediately');
        recommendations.push('Audit access logs for unauthorized usage');
        recommendations.push('Review key storage practices');
        break;
      case 'pii_exposure':
        recommendations.push('Assess GDPR notification requirements');
        recommendations.push('Identify and notify affected users');
        recommendations.push('Review data access controls');
        break;
      default:
        recommendations.push('Conduct thorough post-incident review');
        recommendations.push('Update security monitoring rules');
        recommendations.push('Review and update incident response playbook');
    }

    return recommendations;
  }
}

export const breachResponseService = BreachResponseService.getInstance();
