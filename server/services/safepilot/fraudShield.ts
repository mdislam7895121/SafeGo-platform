import { prisma } from '../../db';

interface GhostTripAlert {
  rideId: string;
  driverId: string;
  driverName: string;
  suspicionScore: number;
  indicators: string[];
  estimatedLoss: number;
  recommendation: string;
}

interface GhostDeliveryAlert {
  orderId: string;
  driverId: string;
  restaurantId: string;
  suspicionScore: number;
  indicators: string[];
  estimatedLoss: number;
  recommendation: string;
}

interface CouponFraudAlert {
  customerId: string;
  customerName: string;
  fraudType: 'FAKE_CODE' | 'REUSE' | 'ACCOUNT_FARMING' | 'REFERRAL_ABUSE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidence: string[];
  estimatedLoss: number;
  recommendation: string;
}

interface CollusionAlert {
  type: 'DRIVER_CUSTOMER' | 'DRIVER_RESTAURANT' | 'MULTI_ACCOUNT';
  involvedParties: Array<{ type: string; id: string; name: string }>;
  pattern: string;
  frequency: number;
  suspicionScore: number;
  evidence: string[];
  recommendation: string;
}

interface SafetyIncident {
  incidentId: string;
  type: 'SOS' | 'ACCIDENT' | 'HARASSMENT' | 'ROUTE_DEVIATION' | 'UNSAFE_DRIVING';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  driverId?: string;
  customerId?: string;
  description: string;
  timestamp: Date;
  isRepeat: boolean;
  recommendation: string;
}

interface KYCFraudPattern {
  entityType: 'DRIVER' | 'CUSTOMER' | 'RESTAURANT';
  entityId: string;
  entityName: string;
  patternType: 'DUPLICATE_DOCUMENT' | 'FAKE_DOCUMENT' | 'IDENTITY_MISMATCH' | 'SUSPICIOUS_TIMING';
  confidence: number;
  evidence: string[];
  recommendation: string;
}

interface FraudAlert {
  id: string;
  category: 'GHOST_TRIP' | 'GHOST_DELIVERY' | 'COUPON_FRAUD' | 'COLLUSION' | 'SAFETY' | 'KYC_FRAUD';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  riskScore: number;
  estimatedLoss: number;
  timestamp: Date;
  recommendation: string;
  actionRequired: boolean;
}

export const fraudShield = {
  /**
   * Detect ghost trips (fake completed rides)
   */
  async detectGhostTrips(countryCode?: string, days: number = 7): Promise<GhostTripAlert[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const alerts: GhostTripAlert[] = [];

    const rides = await prisma.ride.findMany({
      where: {
        createdAt: { gte: since },
        status: 'completed',
        ...(countryCode ? { customer: { user: { countryCode } } } : {}),
      },
      include: {
        driver: {
          include: { user: true },
        },
        customer: {
          include: { user: true },
        },
      },
    });

    for (const ride of rides) {
      const indicators: string[] = [];
      let suspicionScore = 0;

      const duration = ride.completedAt && ride.startedAt 
        ? (ride.completedAt.getTime() - ride.startedAt.getTime()) / 1000 / 60 
        : 0;

      if (duration < 2 && (ride.fare?.toNumber() || 0) > 10) {
        indicators.push('Extremely short ride with high fare');
        suspicionScore += 30;
      }

      const pickupLat = ride.pickupLat?.toNumber() || 0;
      const pickupLng = ride.pickupLng?.toNumber() || 0;
      const dropoffLat = ride.dropoffLat?.toNumber() || 0;
      const dropoffLng = ride.dropoffLng?.toNumber() || 0;

      const distance = Math.sqrt(
        Math.pow(dropoffLat - pickupLat, 2) + 
        Math.pow(dropoffLng - pickupLng, 2)
      ) * 111;

      if (distance < 0.1 && (ride.fare?.toNumber() || 0) > 5) {
        indicators.push('Pickup and dropoff nearly identical');
        suspicionScore += 40;
      }

      if (!ride.ratingByCustomer) {
        suspicionScore += 5;
      }

      if (ride.paymentMethod === 'cash') {
        suspicionScore += 10;
      }

      const recentDriverRides = await prisma.ride.count({
        where: {
          driverId: ride.driverId,
          customerId: ride.customerId,
          createdAt: { gte: since },
        },
      });

      if (recentDriverRides > 5) {
        indicators.push(`${recentDriverRides} rides with same customer recently`);
        suspicionScore += 25;
      }

      if (suspicionScore >= 40) {
        alerts.push({
          rideId: ride.id,
          driverId: ride.driverId || '',
          driverName: ride.driver?.user?.fullName || 'Unknown',
          suspicionScore: Math.min(100, suspicionScore),
          indicators,
          estimatedLoss: ride.fare?.toNumber() || 0,
          recommendation: suspicionScore >= 70 
            ? 'Immediately suspend driver and investigate'
            : suspicionScore >= 50
              ? 'Flag for manual review within 24 hours'
              : 'Add to watchlist',
        });
      }
    }

    return alerts.sort((a, b) => b.suspicionScore - a.suspicionScore);
  },

  /**
   * Detect ghost deliveries (fake food deliveries)
   */
  async detectGhostDeliveries(countryCode?: string, days: number = 7): Promise<GhostDeliveryAlert[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const alerts: GhostDeliveryAlert[] = [];

    const orders = await prisma.foodOrder.findMany({
      where: {
        createdAt: { gte: since },
        status: 'delivered',
        ...(countryCode ? { customer: { user: { countryCode } } } : {}),
      },
      include: {
        driver: {
          include: { user: true },
        },
        restaurant: {
          include: { user: true },
        },
      },
    });

    for (const order of orders) {
      const indicators: string[] = [];
      let suspicionScore = 0;

      const prepTime = order.pickedUpAt && order.acceptedAt
        ? (order.pickedUpAt.getTime() - order.acceptedAt.getTime()) / 1000 / 60
        : 30;

      if (prepTime < 3 && (order.total?.toNumber() || 0) > 20) {
        indicators.push('Suspiciously fast preparation time');
        suspicionScore += 35;
      }

      const deliveryTime = order.deliveredAt && order.pickedUpAt
        ? (order.deliveredAt.getTime() - order.pickedUpAt.getTime()) / 1000 / 60
        : 20;

      if (deliveryTime < 2) {
        indicators.push('Instant delivery - likely fake');
        suspicionScore += 40;
      }

      if (!order.customerRating) {
        suspicionScore += 10;
      }

      const driverRestaurantOrders = await prisma.foodOrder.count({
        where: {
          driverId: order.driverId,
          restaurantId: order.restaurantId,
          createdAt: { gte: since },
          status: 'delivered',
        },
      });

      if (driverRestaurantOrders > 20) {
        indicators.push(`Driver has ${driverRestaurantOrders} deliveries from same restaurant`);
        suspicionScore += 20;
      }

      if (suspicionScore >= 40) {
        alerts.push({
          orderId: order.id,
          driverId: order.driverId || '',
          restaurantId: order.restaurantId,
          suspicionScore: Math.min(100, suspicionScore),
          indicators,
          estimatedLoss: order.total?.toNumber() || 0,
          recommendation: suspicionScore >= 70
            ? 'Investigate driver and restaurant partnership'
            : 'Monitor for patterns',
        });
      }
    }

    return alerts.sort((a, b) => b.suspicionScore - a.suspicionScore);
  },

  /**
   * Detect coupon fraud patterns
   */
  async detectCouponFraud(countryCode?: string, days: number = 30): Promise<CouponFraudAlert[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const alerts: CouponFraudAlert[] = [];

    const usages = await prisma.couponUsage.findMany({
      where: {
        usedAt: { gte: since },
      },
      include: {
        customer: {
          include: { user: true },
        },
        coupon: true,
      },
    });

    const customerUsages = new Map<string, typeof usages>();
    for (const usage of usages) {
      const list = customerUsages.get(usage.customerId) || [];
      list.push(usage);
      customerUsages.set(usage.customerId, list);
    }

    for (const [customerId, customerUsageList] of customerUsages) {
      const customer = customerUsageList[0]?.customer;

      const referralCodes = customerUsageList.filter(u => 
        u.coupon?.code?.startsWith('REF') || u.coupon?.type === 'referral'
      );

      if (referralCodes.length >= 3) {
        alerts.push({
          customerId,
          customerName: customer?.user?.fullName || 'Unknown',
          fraudType: 'REFERRAL_ABUSE',
          severity: referralCodes.length >= 5 ? 'CRITICAL' : 'HIGH',
          evidence: [
            `Used ${referralCodes.length} referral codes`,
            'Possible multi-account referral farming',
          ],
          estimatedLoss: referralCodes.reduce((sum, u) => 
            sum + (u.coupon?.discountAmount?.toNumber() || 0), 0
          ),
          recommendation: 'Investigate for multi-account abuse',
        });
      }

      if (customerUsageList.length >= 10) {
        alerts.push({
          customerId,
          customerName: customer?.user?.fullName || 'Unknown',
          fraudType: 'ACCOUNT_FARMING',
          severity: customerUsageList.length >= 15 ? 'CRITICAL' : 'HIGH',
          evidence: [
            `Used ${customerUsageList.length} coupons in ${days} days`,
            'Exceeds normal usage patterns',
          ],
          estimatedLoss: customerUsageList.reduce((sum, u) =>
            sum + (u.coupon?.discountAmount?.toNumber() || 0), 0
          ),
          recommendation: 'Block from future promotions',
        });
      }
    }

    return alerts;
  },

  /**
   * Detect driver-customer collusion
   */
  async detectCollusion(countryCode?: string, days: number = 30): Promise<CollusionAlert[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const alerts: CollusionAlert[] = [];

    const rides = await prisma.ride.findMany({
      where: {
        createdAt: { gte: since },
        status: 'completed',
      },
      include: {
        driver: { include: { user: true } },
        customer: { include: { user: true } },
      },
    });

    const pairCounts = new Map<string, {
      count: number;
      totalFare: number;
      driver: any;
      customer: any;
      cashRides: number;
    }>();

    for (const ride of rides) {
      if (!ride.driverId || !ride.customerId) continue;

      const key = `${ride.driverId}-${ride.customerId}`;
      const existing = pairCounts.get(key) || {
        count: 0,
        totalFare: 0,
        driver: ride.driver,
        customer: ride.customer,
        cashRides: 0,
      };

      existing.count++;
      existing.totalFare += ride.fare?.toNumber() || 0;
      if (ride.paymentMethod === 'cash') existing.cashRides++;

      pairCounts.set(key, existing);
    }

    for (const [, data] of pairCounts) {
      if (data.count >= 10 || (data.count >= 5 && data.cashRides >= 3)) {
        const suspicionScore = Math.min(100,
          (data.count * 5) +
          (data.cashRides * 10) +
          (data.totalFare / 100)
        );

        alerts.push({
          type: 'DRIVER_CUSTOMER',
          involvedParties: [
            { type: 'DRIVER', id: data.driver?.userId || '', name: data.driver?.user?.fullName || 'Unknown' },
            { type: 'CUSTOMER', id: data.customer?.userId || '', name: data.customer?.user?.fullName || 'Unknown' },
          ],
          pattern: 'Repeated rides between same driver and customer',
          frequency: data.count,
          suspicionScore,
          evidence: [
            `${data.count} rides together in ${days} days`,
            `${data.cashRides} cash payments`,
            `Total fare: $${data.totalFare.toFixed(2)}`,
          ],
          recommendation: suspicionScore >= 70
            ? 'Suspend both accounts pending investigation'
            : 'Flag for review',
        });
      }
    }

    return alerts.sort((a, b) => b.suspicionScore - a.suspicionScore);
  },

  /**
   * Detect repeated safety incidents
   */
  async detectSafetyIncidents(countryCode?: string, days: number = 30): Promise<SafetyIncident[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const incidents: SafetyIncident[] = [];

    const sosAlerts = await prisma.sOSAlert.findMany({
      where: {
        triggeredAt: { gte: since },
      },
      include: {
        ride: {
          include: {
            driver: { include: { user: true } },
            customer: { include: { user: true } },
          },
        },
      },
    });

    const driverIncidents = new Map<string, number>();
    
    for (const sos of sosAlerts) {
      const driverId = sos.ride?.driverId;
      if (driverId) {
        driverIncidents.set(driverId, (driverIncidents.get(driverId) || 0) + 1);
      }

      incidents.push({
        incidentId: sos.id,
        type: 'SOS',
        severity: sos.status === 'resolved' ? 'MEDIUM' : 'CRITICAL',
        driverId: sos.ride?.driverId || undefined,
        customerId: sos.ride?.customerId || undefined,
        description: `SOS triggered - Status: ${sos.status}`,
        timestamp: sos.triggeredAt,
        isRepeat: (driverId && (driverIncidents.get(driverId) || 0) > 1) || false,
        recommendation: sos.status !== 'resolved' 
          ? 'Immediate response required'
          : 'Review incident details',
      });
    }

    return incidents.sort((a, b) => {
      const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return order[b.severity] - order[a.severity];
    });
  },

  /**
   * Detect suspicious KYC patterns
   */
  async detectKYCFraud(countryCode?: string): Promise<KYCFraudPattern[]> {
    const patterns: KYCFraudPattern[] = [];
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recentDrivers = await prisma.driverProfile.findMany({
      where: {
        createdAt: { gte: last30d },
        ...(countryCode ? { user: { countryCode } } : {}),
      },
      include: {
        user: true,
        documents: true,
      },
    });

    const documentHashes = new Map<string, string[]>();

    for (const driver of recentDrivers) {
      for (const doc of driver.documents) {
        if (doc.fileUrl) {
          const hash = doc.fileUrl.split('/').pop() || '';
          const existing = documentHashes.get(hash) || [];
          existing.push(driver.userId);
          documentHashes.set(hash, existing);
        }
      }
    }

    for (const [hash, userIds] of documentHashes) {
      if (userIds.length > 1) {
        const driver = recentDrivers.find(d => d.userId === userIds[0]);
        patterns.push({
          entityType: 'DRIVER',
          entityId: userIds[0],
          entityName: driver?.user?.fullName || 'Unknown',
          patternType: 'DUPLICATE_DOCUMENT',
          confidence: 95,
          evidence: [
            `Document used by ${userIds.length} different accounts`,
            `Affected users: ${userIds.join(', ')}`,
          ],
          recommendation: 'Reject all applications with this document',
        });
      }
    }

    return patterns;
  },

  /**
   * Generate consolidated fraud alerts
   */
  async generateFraudAlerts(countryCode?: string): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = [];

    const [ghostTrips, ghostDeliveries, couponFraud, collusion, safety, kycFraud] = await Promise.all([
      this.detectGhostTrips(countryCode),
      this.detectGhostDeliveries(countryCode),
      this.detectCouponFraud(countryCode),
      this.detectCollusion(countryCode),
      this.detectSafetyIncidents(countryCode),
      this.detectKYCFraud(countryCode),
    ]);

    for (const trip of ghostTrips) {
      alerts.push({
        id: `ghost-trip-${trip.rideId}`,
        category: 'GHOST_TRIP',
        severity: trip.suspicionScore >= 70 ? 'CRITICAL' : trip.suspicionScore >= 50 ? 'HIGH' : 'MEDIUM',
        title: `Suspected Ghost Trip - ${trip.driverName}`,
        description: trip.indicators.join('; '),
        riskScore: trip.suspicionScore,
        estimatedLoss: trip.estimatedLoss,
        timestamp: new Date(),
        recommendation: trip.recommendation,
        actionRequired: trip.suspicionScore >= 50,
      });
    }

    for (const delivery of ghostDeliveries) {
      alerts.push({
        id: `ghost-delivery-${delivery.orderId}`,
        category: 'GHOST_DELIVERY',
        severity: delivery.suspicionScore >= 70 ? 'CRITICAL' : 'HIGH',
        title: `Suspected Ghost Delivery`,
        description: delivery.indicators.join('; '),
        riskScore: delivery.suspicionScore,
        estimatedLoss: delivery.estimatedLoss,
        timestamp: new Date(),
        recommendation: delivery.recommendation,
        actionRequired: true,
      });
    }

    for (const fraud of couponFraud) {
      alerts.push({
        id: `coupon-${fraud.customerId}-${fraud.fraudType}`,
        category: 'COUPON_FRAUD',
        severity: fraud.severity,
        title: `Coupon Fraud: ${fraud.fraudType.replace('_', ' ')}`,
        description: fraud.evidence.join('; '),
        riskScore: fraud.severity === 'CRITICAL' ? 90 : fraud.severity === 'HIGH' ? 70 : 50,
        estimatedLoss: fraud.estimatedLoss,
        timestamp: new Date(),
        recommendation: fraud.recommendation,
        actionRequired: fraud.severity === 'CRITICAL' || fraud.severity === 'HIGH',
      });
    }

    for (const col of collusion) {
      alerts.push({
        id: `collusion-${col.involvedParties.map(p => p.id).join('-')}`,
        category: 'COLLUSION',
        severity: col.suspicionScore >= 70 ? 'CRITICAL' : 'HIGH',
        title: `${col.type.replace('_', '-')} Collusion Detected`,
        description: col.evidence.join('; '),
        riskScore: col.suspicionScore,
        estimatedLoss: 0,
        timestamp: new Date(),
        recommendation: col.recommendation,
        actionRequired: col.suspicionScore >= 60,
      });
    }

    for (const incident of safety) {
      if (incident.severity === 'CRITICAL' || incident.isRepeat) {
        alerts.push({
          id: `safety-${incident.incidentId}`,
          category: 'SAFETY',
          severity: incident.severity,
          title: `Safety Incident: ${incident.type}`,
          description: incident.description,
          riskScore: incident.severity === 'CRITICAL' ? 95 : 70,
          estimatedLoss: 0,
          timestamp: incident.timestamp,
          recommendation: incident.recommendation,
          actionRequired: incident.severity === 'CRITICAL',
        });
      }
    }

    for (const kyc of kycFraud) {
      alerts.push({
        id: `kyc-${kyc.entityId}-${kyc.patternType}`,
        category: 'KYC_FRAUD',
        severity: kyc.confidence >= 90 ? 'CRITICAL' : 'HIGH',
        title: `KYC Fraud: ${kyc.patternType.replace(/_/g, ' ')}`,
        description: kyc.evidence.join('; '),
        riskScore: kyc.confidence,
        estimatedLoss: 0,
        timestamp: new Date(),
        recommendation: kyc.recommendation,
        actionRequired: true,
      });
    }

    return alerts.sort((a, b) => b.riskScore - a.riskScore);
  },

  /**
   * Get fraud shield summary
   */
  async getFraudSummary(countryCode?: string): Promise<{
    totalAlerts: number;
    criticalAlerts: number;
    highAlerts: number;
    estimatedTotalLoss: number;
    byCategory: Record<string, number>;
    topAlerts: FraudAlert[];
  }> {
    const alerts = await this.generateFraudAlerts(countryCode);

    const byCategory: Record<string, number> = {};
    for (const alert of alerts) {
      byCategory[alert.category] = (byCategory[alert.category] || 0) + 1;
    }

    return {
      totalAlerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'CRITICAL').length,
      highAlerts: alerts.filter(a => a.severity === 'HIGH').length,
      estimatedTotalLoss: alerts.reduce((sum, a) => sum + a.estimatedLoss, 0),
      byCategory,
      topAlerts: alerts.slice(0, 10),
    };
  },
};
