import { prisma } from '../../db';

interface ComplianceViolation {
  id: string;
  entityType: 'DRIVER' | 'RESTAURANT' | 'CUSTOMER';
  entityId: string;
  entityName: string;
  country: 'BD' | 'US' | 'GLOBAL';
  violationType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  regulatoryReference: string;
  detectedAt: Date;
  recommendation: string;
  actionRequired: boolean;
}

interface InvestigationSummary {
  caseId: string;
  entityType: string;
  entityId: string;
  entityName: string;
  allegation: string;
  evidence: string[];
  timeline: Array<{ date: Date; event: string }>;
  riskAssessment: string;
  recommendedAction: string;
  legalConsiderations: string[];
}

interface ComplianceAction {
  id: string;
  type: 'IMMEDIATE' | 'SCHEDULED' | 'MONITORING';
  action: string;
  priority: number;
  deadline?: Date;
  responsibleTeam: string;
}

export const complianceGuard = {
  /**
   * Detect Bangladesh NID rule violations
   */
  async detectBDViolations(countryCode: string = 'BD'): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const bdDrivers = await prisma.driverProfile.findMany({
      where: {
        user: { countryCode: 'BD' },
        verificationStatus: 'approved',
      },
      include: {
        user: true,
        documents: true,
      },
    });

    for (const driver of bdDrivers) {
      const nidDoc = driver.documents.find(d => 
        d.documentType?.toLowerCase().includes('nid') || 
        d.documentType?.toLowerCase().includes('national id')
      );

      if (!nidDoc) {
        violations.push({
          id: `bd-nid-missing-${driver.userId}`,
          entityType: 'DRIVER',
          entityId: driver.userId,
          entityName: driver.user?.fullName || 'Unknown',
          country: 'BD',
          violationType: 'MISSING_NID',
          severity: 'CRITICAL',
          description: 'Driver approved without valid NID on file',
          regulatoryReference: 'Bangladesh Road Transport Authority Regulation 2019',
          detectedAt: new Date(),
          recommendation: 'Suspend driver operations until NID is verified',
          actionRequired: true,
        });
      }

      const drivingLicense = driver.documents.find(d =>
        d.documentType?.toLowerCase().includes('license') ||
        d.documentType?.toLowerCase().includes('driving')
      );

      if (!drivingLicense) {
        violations.push({
          id: `bd-license-missing-${driver.userId}`,
          entityType: 'DRIVER',
          entityId: driver.userId,
          entityName: driver.user?.fullName || 'Unknown',
          country: 'BD',
          violationType: 'MISSING_LICENSE',
          severity: 'CRITICAL',
          description: 'Driver operating without valid driving license on file',
          regulatoryReference: 'Motor Vehicles Ordinance 1983',
          detectedAt: new Date(),
          recommendation: 'Immediately suspend driver until license verified',
          actionRequired: true,
        });
      }

      if (drivingLicense?.expiryDate && new Date(drivingLicense.expiryDate) < new Date()) {
        violations.push({
          id: `bd-license-expired-${driver.userId}`,
          entityType: 'DRIVER',
          entityId: driver.userId,
          entityName: driver.user?.fullName || 'Unknown',
          country: 'BD',
          violationType: 'EXPIRED_LICENSE',
          severity: 'HIGH',
          description: 'Driver license has expired',
          regulatoryReference: 'Motor Vehicles Ordinance 1983 Section 4',
          detectedAt: new Date(),
          recommendation: 'Notify driver to renew license within 7 days or suspend',
          actionRequired: true,
        });
      }
    }

    const bdRestaurants = await prisma.restaurantProfile.findMany({
      where: {
        user: { countryCode: 'BD' },
        verificationStatus: 'approved',
      },
      include: {
        user: true,
        documents: true,
      },
    });

    for (const restaurant of bdRestaurants) {
      const tradeLicense = restaurant.documents.find(d =>
        d.documentType?.toLowerCase().includes('trade') ||
        d.documentType?.toLowerCase().includes('business')
      );

      if (!tradeLicense) {
        violations.push({
          id: `bd-trade-missing-${restaurant.userId}`,
          entityType: 'RESTAURANT',
          entityId: restaurant.userId,
          entityName: restaurant.restaurantName || restaurant.user?.fullName || 'Unknown',
          country: 'BD',
          violationType: 'MISSING_TRADE_LICENSE',
          severity: 'HIGH',
          description: 'Restaurant operating without trade license on file',
          regulatoryReference: 'Bangladesh Trade License Act',
          detectedAt: new Date(),
          recommendation: 'Request trade license within 14 days or delist',
          actionRequired: true,
        });
      }
    }

    return violations;
  },

  /**
   * Detect US compliance violations
   */
  async detectUSViolations(countryCode: string = 'US'): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const usDrivers = await prisma.driverProfile.findMany({
      where: {
        user: { countryCode: 'US' },
        verificationStatus: 'approved',
      },
      include: {
        user: true,
        documents: true,
      },
    });

    for (const driver of usDrivers) {
      const ssnDoc = driver.documents.find(d =>
        d.documentType?.toLowerCase().includes('ssn') ||
        d.documentType?.toLowerCase().includes('social security')
      );

      if (!ssnDoc && driver.taxFormStatus !== 'submitted') {
        violations.push({
          id: `us-tax-missing-${driver.userId}`,
          entityType: 'DRIVER',
          entityId: driver.userId,
          entityName: driver.user?.fullName || 'Unknown',
          country: 'US',
          violationType: 'MISSING_TAX_INFO',
          severity: 'HIGH',
          description: 'Driver missing W-9 or tax identification for 1099 reporting',
          regulatoryReference: 'IRS 1099 Reporting Requirements',
          detectedAt: new Date(),
          recommendation: 'Request W-9 form before next payout',
          actionRequired: true,
        });
      }

      const backgroundCheck = driver.documents.find(d =>
        d.documentType?.toLowerCase().includes('background')
      );

      if (!backgroundCheck) {
        violations.push({
          id: `us-background-missing-${driver.userId}`,
          entityType: 'DRIVER',
          entityId: driver.userId,
          entityName: driver.user?.fullName || 'Unknown',
          country: 'US',
          violationType: 'MISSING_BACKGROUND_CHECK',
          severity: 'CRITICAL',
          description: 'Driver operating without background check on file',
          regulatoryReference: 'State TNC Regulations',
          detectedAt: new Date(),
          recommendation: 'Immediately suspend until background check completed',
          actionRequired: true,
        });
      }

      const vehicleInspection = driver.documents.find(d =>
        d.documentType?.toLowerCase().includes('inspection')
      );

      if (!vehicleInspection) {
        violations.push({
          id: `us-inspection-missing-${driver.userId}`,
          entityType: 'DRIVER',
          entityId: driver.userId,
          entityName: driver.user?.fullName || 'Unknown',
          country: 'US',
          violationType: 'MISSING_VEHICLE_INSPECTION',
          severity: 'MEDIUM',
          description: 'Vehicle inspection certificate not on file',
          regulatoryReference: 'State Vehicle Safety Regulations',
          detectedAt: new Date(),
          recommendation: 'Request inspection certificate within 30 days',
          actionRequired: false,
        });
      }
    }

    const customersWithExcessiveData = await prisma.customerProfile.findMany({
      where: {
        user: { countryCode: 'US' },
      },
      include: {
        user: true,
      },
    });

    for (const customer of customersWithExcessiveData) {
      const last6m = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      const hasRecentActivity = await prisma.ride.findFirst({
        where: {
          customerId: customer.userId,
          createdAt: { gte: last6m },
        },
      });

      if (!hasRecentActivity) {
        const hasStoredPayment = await prisma.paymentMethod.findFirst({
          where: { userId: customer.userId },
        });

        if (hasStoredPayment) {
          violations.push({
            id: `us-data-retention-${customer.userId}`,
            entityType: 'CUSTOMER',
            entityId: customer.userId,
            entityName: customer.user?.fullName || 'Unknown',
            country: 'US',
            violationType: 'DATA_RETENTION_CONCERN',
            severity: 'LOW',
            description: 'Inactive customer with stored payment methods',
            regulatoryReference: 'CCPA Data Minimization Principle',
            detectedAt: new Date(),
            recommendation: 'Consider prompting customer for data review',
            actionRequired: false,
          });
        }
      }
    }

    return violations;
  },

  /**
   * Generate investigation summary
   */
  async generateInvestigationSummary(entityType: string, entityId: string): Promise<InvestigationSummary | null> {
    let entity: any = null;
    let entityName = 'Unknown';

    if (entityType === 'DRIVER') {
      entity = await prisma.driverProfile.findUnique({
        where: { userId: entityId },
        include: {
          user: true,
          documents: true,
        },
      });
      entityName = entity?.user?.fullName || 'Unknown Driver';
    } else if (entityType === 'RESTAURANT') {
      entity = await prisma.restaurantProfile.findUnique({
        where: { userId: entityId },
        include: {
          user: true,
          documents: true,
        },
      });
      entityName = entity?.restaurantName || entity?.user?.fullName || 'Unknown Restaurant';
    } else if (entityType === 'CUSTOMER') {
      entity = await prisma.customerProfile.findUnique({
        where: { userId: entityId },
        include: {
          user: true,
        },
      });
      entityName = entity?.user?.fullName || 'Unknown Customer';
    }

    if (!entity) return null;

    const [complaints, refunds, sosAlerts] = await Promise.all([
      prisma.supportTicket.findMany({
        where: {
          OR: [
            { userId: entityId },
            { relatedUserId: entityId },
          ],
          category: 'complaint',
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.refundRequest.findMany({
        where: {
          OR: [
            { customerId: entityId },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.sOSAlert.findMany({
        where: {
          ride: {
            OR: [
              { driverId: entityId },
              { customerId: entityId },
            ],
          },
        },
        orderBy: { triggeredAt: 'desc' },
        take: 5,
      }),
    ]);

    const evidence: string[] = [];
    const timeline: Array<{ date: Date; event: string }> = [];

    if (entity.createdAt) {
      timeline.push({ date: entity.createdAt, event: 'Account created' });
    }

    if (entity.verificationStatus === 'approved' && entity.verifiedAt) {
      timeline.push({ date: entity.verifiedAt, event: 'KYC approved' });
    }

    for (const complaint of complaints.slice(0, 5)) {
      timeline.push({
        date: complaint.createdAt,
        event: `Complaint filed: ${complaint.subject || 'No subject'}`,
      });
      evidence.push(`Complaint: ${complaint.description || complaint.subject}`);
    }

    for (const sos of sosAlerts) {
      timeline.push({
        date: sos.triggeredAt,
        event: `SOS Alert triggered (Status: ${sos.status})`,
      });
      evidence.push(`SOS Alert: ${sos.status}`);
    }

    timeline.sort((a, b) => a.date.getTime() - b.date.getTime());

    const riskFactors: string[] = [];
    if (complaints.length > 3) riskFactors.push('Multiple complaints on file');
    if (sosAlerts.length > 0) riskFactors.push('SOS alerts in history');
    if (refunds.length > 5) riskFactors.push('High refund rate');

    return {
      caseId: `INV-${entityType}-${entityId.slice(0, 8)}`,
      entityType,
      entityId,
      entityName,
      allegation: complaints.length > 0 
        ? complaints[0].subject || 'Multiple concerns reported'
        : 'Compliance review initiated',
      evidence,
      timeline,
      riskAssessment: riskFactors.length > 2 
        ? 'HIGH RISK - Immediate action recommended'
        : riskFactors.length > 0
          ? 'MEDIUM RISK - Monitoring recommended'
          : 'LOW RISK - Standard compliance',
      recommendedAction: riskFactors.length > 2
        ? 'Consider account suspension pending investigation'
        : 'Continue monitoring with enhanced oversight',
      legalConsiderations: [
        'Ensure due process before any adverse action',
        'Document all findings and decisions',
        'Provide entity opportunity to respond',
        'Retain records per data retention policy',
      ],
    };
  },

  /**
   * Generate compliance actions
   */
  async generateComplianceActions(countryCode?: string): Promise<ComplianceAction[]> {
    const actions: ComplianceAction[] = [];

    const [bdViolations, usViolations] = await Promise.all([
      countryCode === 'BD' || !countryCode ? this.detectBDViolations() : Promise.resolve([]),
      countryCode === 'US' || !countryCode ? this.detectUSViolations() : Promise.resolve([]),
    ]);

    const allViolations = [...bdViolations, ...usViolations];

    const criticalViolations = allViolations.filter(v => v.severity === 'CRITICAL');
    if (criticalViolations.length > 0) {
      actions.push({
        id: 'action-critical-review',
        type: 'IMMEDIATE',
        action: `Review and address ${criticalViolations.length} critical compliance violations`,
        priority: 100,
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        responsibleTeam: 'Compliance Team',
      });
    }

    const highViolations = allViolations.filter(v => v.severity === 'HIGH');
    if (highViolations.length > 0) {
      actions.push({
        id: 'action-high-review',
        type: 'SCHEDULED',
        action: `Review ${highViolations.length} high-priority compliance issues`,
        priority: 80,
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        responsibleTeam: 'Compliance Team',
      });
    }

    const missingDocs = allViolations.filter(v => 
      v.violationType.includes('MISSING')
    );
    if (missingDocs.length > 0) {
      actions.push({
        id: 'action-document-collection',
        type: 'SCHEDULED',
        action: `Collect missing documents from ${missingDocs.length} partners`,
        priority: 70,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        responsibleTeam: 'Partner Operations',
      });
    }

    actions.push({
      id: 'action-audit-schedule',
      type: 'MONITORING',
      action: 'Schedule quarterly compliance audit',
      priority: 50,
      responsibleTeam: 'Compliance Team',
    });

    return actions.sort((a, b) => b.priority - a.priority);
  },

  /**
   * Get compliance summary
   */
  async getComplianceSummary(countryCode?: string): Promise<{
    totalViolations: number;
    criticalViolations: number;
    bdViolations: number;
    usViolations: number;
    pendingActions: number;
    complianceScore: number;
  }> {
    const [bdViolations, usViolations, actions] = await Promise.all([
      this.detectBDViolations(),
      this.detectUSViolations(),
      this.generateComplianceActions(countryCode),
    ]);

    const allViolations = [...bdViolations, ...usViolations];
    const criticalCount = allViolations.filter(v => v.severity === 'CRITICAL').length;

    const baseScore = 100;
    const deductions = 
      (criticalCount * 10) + 
      (allViolations.filter(v => v.severity === 'HIGH').length * 5) +
      (allViolations.filter(v => v.severity === 'MEDIUM').length * 2);

    return {
      totalViolations: allViolations.length,
      criticalViolations: criticalCount,
      bdViolations: bdViolations.length,
      usViolations: usViolations.length,
      pendingActions: actions.length,
      complianceScore: Math.max(0, baseScore - deductions),
    };
  },
};
