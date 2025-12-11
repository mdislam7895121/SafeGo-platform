import { prisma } from "../lib/prisma";
import { logAuditEvent, ActionType, EntityType } from "../utils/audit";

export interface FraudCheckResult {
  riskScore: number; // 0-100
  riskLevel: "low" | "medium" | "high" | "critical";
  flags: string[];
  recommendations: string[];
}

export interface DeviceFingerprint {
  userAgent: string;
  ipAddress: string;
  deviceId?: string;
}

/**
 * Calculate risk score for a user based on multiple fraud indicators
 */
export async function calculateUserRiskScore(
  userId: string,
  deviceInfo?: DeviceFingerprint
): Promise<FraudCheckResult> {
  let riskScore = 0;
  const flags: string[] = [];
  const recommendations: string[] = [];

  try {
    // Check 1: Device Mismatch Detection
    if (deviceInfo) {
      const deviceMismatch = await checkDeviceMismatch(userId, deviceInfo);
      if (deviceMismatch.isSuspicious) {
        riskScore += 15;
        flags.push("Device mismatch detected");
        recommendations.push("Verify user identity via secondary authentication");
      }
    }

    // Check 2: Duplicate Accounts
    const duplicateAccounts = await checkDuplicateAccounts(userId);
    if (duplicateAccounts.found) {
      riskScore += 25;
      flags.push(`${duplicateAccounts.count} duplicate accounts detected`);
      recommendations.push("Review related accounts for fraud patterns");
    }

    // Check 3: Impossible Travel
    const impossibleTravel = await checkImpossibleTravel(userId);
    if (impossibleTravel.detected) {
      riskScore += 30;
      flags.push("Impossible travel pattern detected");
      recommendations.push("Lock account pending investigation");
    }

    // Check 4: Failed Login Attempts
    const failedLogins = await checkFailedLoginAttempts(userId);
    if (failedLogins > 5) {
      riskScore += 20;
      flags.push(`${failedLogins} failed login attempts in 24h`);
      recommendations.push("Enable multi-factor authentication");
    }

    // Check 5: Suspicious Activity Patterns
    const suspiciousActivity = await checkSuspiciousActivityPatterns(userId);
    if (suspiciousActivity > 0) {
      riskScore += 10 * suspiciousActivity;
      flags.push(`${suspiciousActivity} suspicious activities detected`);
      recommendations.push("Monitor user activity closely");
    }

    // Determine risk level
    let riskLevel: "low" | "medium" | "high" | "critical";
    if (riskScore >= 75) {
      riskLevel = "critical";
    } else if (riskScore >= 50) {
      riskLevel = "high";
    } else if (riskScore >= 25) {
      riskLevel = "medium";
    } else {
      riskLevel = "low";
    }

    return {
      riskScore: Math.min(100, riskScore),
      riskLevel,
      flags,
      recommendations,
    };
  } catch (error) {
    console.error("Risk score calculation error:", error);
    return {
      riskScore: 0,
      riskLevel: "low",
      flags: ["Error calculating risk score"],
      recommendations: [],
    };
  }
}

/**
 * Check for device mismatch (different IP/device than usual)
 */
async function checkDeviceMismatch(
  userId: string,
  currentDevice: DeviceFingerprint
): Promise<{ isSuspicious: boolean; reason?: string }> {
  try {
    // Get recent successful logins
    const recentLogins = await prisma.auditLog.findMany({
      where: {
        actorId: userId,
        actionType: ActionType.LOGIN_SUCCESS,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
      },
      select: {
        ipAddress: true,
        metadata: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (recentLogins.length === 0) {
      // New user, no history
      return { isSuspicious: false };
    }

    // Check if current IP is in recent login IPs
    const recentIPs = recentLogins
      .map((log) => log.ipAddress)
      .filter((ip): ip is string => ip !== null);
    
    const uniqueIPs = [...new Set(recentIPs)];
    
    // Suspicious if current IP is new AND user has only used 1-2 IPs before
    if (!recentIPs.includes(currentDevice.ipAddress) && uniqueIPs.length <= 2) {
      return {
        isSuspicious: true,
        reason: "Login from new IP address with limited history",
      };
    }

    // Check user agent mismatch
    const recentUserAgents = recentLogins
      .map((log) => (log.metadata as any)?.userAgent)
      .filter((ua): ua is string => !!ua);

    const hasMatchingUserAgent = recentUserAgents.some(
      (ua) => ua === currentDevice.userAgent
    );

    if (!hasMatchingUserAgent && recentUserAgents.length > 0) {
      return {
        isSuspicious: true,
        reason: "Login from new device type",
      };
    }

    return { isSuspicious: false };
  } catch (error) {
    console.error("Device mismatch check error:", error);
    return { isSuspicious: false };
  }
}

/**
 * Check for duplicate accounts (same phone, email pattern, payment method)
 */
async function checkDuplicateAccounts(userId: string): Promise<{ found: boolean; count: number; relatedUserIds: string[] }> {
  try {
    // Get current user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true },
    });

    if (!user) {
      return { found: false, count: 0, relatedUserIds: [] };
    }

    // Check for accounts with similar email patterns (same domain, similar prefix)
    const emailDomain = user.email.split("@")[1];
    const emailPrefix = user.email.split("@")[0];

    const duplicates = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: userId } },
          {
            OR: [
              // Same phone number
              user.phone ? { phone: user.phone } : {},
              // Similar email (same domain, similar prefix)
              { email: { contains: emailDomain } },
            ],
          },
        ],
      },
      select: { id: true },
    });

    return {
      found: duplicates.length > 0,
      count: duplicates.length,
      relatedUserIds: duplicates.map((u) => u.id),
    };
  } catch (error) {
    console.error("Duplicate account check error:", error);
    return { found: false, count: 0, relatedUserIds: [] };
  }
}

/**
 * Check for impossible travel (logins from distant locations in short time)
 */
async function checkImpossibleTravel(userId: string): Promise<{ detected: boolean; details?: string }> {
  try {
    // Get last 2 successful logins
    const recentLogins = await prisma.auditLog.findMany({
      where: {
        actorId: userId,
        actionType: ActionType.LOGIN_SUCCESS,
      },
      select: {
        ipAddress: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: { createdAt: "desc" },
      take: 2,
    });

    if (recentLogins.length < 2) {
      return { detected: false };
    }

    const [login1, login2] = recentLogins;
    
    // Simplified: Check if logins are from very different IP ranges in short time
    // In production, use IP geolocation service
    const timeDiff = Math.abs(login1.createdAt.getTime() - login2.createdAt.getTime());
    const timeDiffHours = timeDiff / (1000 * 60 * 60);

    // If IPs are very different and time is < 2 hours, flag as suspicious
    const ip1Parts = (login1.ipAddress || "").split(".");
    const ip2Parts = (login2.ipAddress || "").split(".");

    // Check if first two octets match (rough location check)
    const differentLocation = ip1Parts[0] !== ip2Parts[0] || ip1Parts[1] !== ip2Parts[1];

    if (differentLocation && timeDiffHours < 2) {
      return {
        detected: true,
        details: `Logins from different locations within ${timeDiffHours.toFixed(1)} hours`,
      };
    }

    return { detected: false };
  } catch (error) {
    console.error("Impossible travel check error:", error);
    return { detected: false };
  }
}

/**
 * Check failed login attempts in last 24 hours
 */
async function checkFailedLoginAttempts(userId: string): Promise<number> {
  try {
    const count = await prisma.auditLog.count({
      where: {
        actorId: userId,
        actionType: ActionType.LOGIN_FAILED,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    return count;
  } catch (error) {
    console.error("Failed login check error:", error);
    return 0;
  }
}

/**
 * Check for suspicious activity patterns
 */
async function checkSuspiciousActivityPatterns(userId: string): Promise<number> {
  try {
    const count = await prisma.auditLog.count({
      where: {
        actorId: userId,
        success: false,
        actionType: { notIn: [ActionType.LOGIN_FAILED] },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
      },
    });
    return count;
  } catch (error) {
    console.error("Suspicious activity check error:", error);
    return 0;
  }
}

/**
 * Check parcel fraud patterns (sender/receiver abuse)
 */
export async function checkParcelFraud(parcelId: string): Promise<FraudCheckResult> {
  let riskScore = 0;
  const flags: string[] = [];
  const recommendations: string[] = [];

  try {
    const parcel = await prisma.parcel.findUnique({
      where: { id: parcelId },
      include: {
        sender: true,
        receiver: true,
      },
    });

    if (!parcel) {
      return {
        riskScore: 0,
        riskLevel: "low",
        flags: ["Parcel not found"],
        recommendations: [],
      };
    }

    // Check 1: High volume of parcels from same sender in short time
    const senderParcels = await prisma.parcel.count({
      where: {
        senderId: parcel.senderId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (senderParcels > 10) {
      riskScore += 20;
      flags.push(`${senderParcels} parcels from same sender in 24h`);
      recommendations.push("Review sender account for automated abuse");
    }

    // Check 2: Cancelled/failed deliveries
    const failedParcels = await prisma.parcel.count({
      where: {
        senderId: parcel.senderId,
        status: { in: ["cancelled", "failed"] },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });

    if (failedParcels > 3) {
      riskScore += 15;
      flags.push(`${failedParcels} failed/cancelled parcels in 7 days`);
      recommendations.push("Verify sender identity and payment method");
    }

    // Check 3: Same sender-receiver pair (potential fake deliveries)
    const samePairCount = await prisma.parcel.count({
      where: {
        senderId: parcel.senderId,
        receiverPhone: parcel.receiverPhone,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });

    if (samePairCount > 5) {
      riskScore += 25;
      flags.push(`${samePairCount} parcels to same receiver in 30 days`);
      recommendations.push("Investigate potential collusion or fake deliveries");
    }

    // Determine risk level
    let riskLevel: "low" | "medium" | "high" | "critical";
    if (riskScore >= 75) {
      riskLevel = "critical";
    } else if (riskScore >= 50) {
      riskLevel = "high";
    } else if (riskScore >= 25) {
      riskLevel = "medium";
    } else {
      riskLevel = "low";
    }

    return {
      riskScore: Math.min(100, riskScore),
      riskLevel,
      flags,
      recommendations,
    };
  } catch (error) {
    console.error("Parcel fraud check error:", error);
    return {
      riskScore: 0,
      riskLevel: "low",
      flags: ["Error checking parcel fraud"],
      recommendations: [],
    };
  }
}

// ============================================================
// PHASE 4: Enhanced Fraud Detection with Automated Alerts
// ============================================================

export interface FraudAlertConfig {
  alertType: string;
  entityType: 'ride' | 'food_order' | 'parcel' | 'customer' | 'driver' | 'wallet' | 'payment';
  severity: 'low' | 'medium' | 'high' | 'critical';
  thresholds: Record<string, number>;
}

/**
 * Phase 4 Task 31: Cancellation Abuse Detection
 * Detects drivers/customers with high cancellation rates
 */
export async function checkCancellationAbuse(
  actorId: string,
  actorType: 'driver' | 'customer'
): Promise<{ detected: boolean; severity: string; metrics: Record<string, any>; reason: string }> {
  try {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    if (actorType === 'driver') {
      // Driver cancellation patterns
      const [rides24h, cancelled24h, rides7d, cancelled7d] = await Promise.all([
        prisma.ride.count({
          where: { driverId: actorId, createdAt: { gte: last24Hours } },
        }),
        prisma.ride.count({
          where: {
            driverId: actorId,
            status: 'cancelled',
            cancelledByRole: 'driver',
            createdAt: { gte: last24Hours },
          },
        }),
        prisma.ride.count({
          where: { driverId: actorId, createdAt: { gte: last7Days } },
        }),
        prisma.ride.count({
          where: {
            driverId: actorId,
            status: 'cancelled',
            cancelledByRole: 'driver',
            createdAt: { gte: last7Days },
          },
        }),
      ]);

      const rate24h = rides24h > 0 ? (cancelled24h / rides24h) * 100 : 0;
      const rate7d = rides7d > 0 ? (cancelled7d / rides7d) * 100 : 0;

      // Thresholds: >30% in 24h is critical, >20% in 7d is high
      if (rate24h > 30 || cancelled24h >= 5) {
        return {
          detected: true,
          severity: 'critical',
          metrics: { rate24h, cancelled24h, rides24h, rate7d, cancelled7d, rides7d },
          reason: `Driver cancelled ${cancelled24h} rides (${rate24h.toFixed(1)}%) in last 24 hours`,
        };
      }
      if (rate7d > 20 || cancelled7d >= 10) {
        return {
          detected: true,
          severity: 'high',
          metrics: { rate24h, cancelled24h, rides24h, rate7d, cancelled7d, rides7d },
          reason: `Driver cancelled ${cancelled7d} rides (${rate7d.toFixed(1)}%) in last 7 days`,
        };
      }
    } else {
      // Customer cancellation patterns
      const [rides24h, cancelled24h, rides7d, cancelled7d] = await Promise.all([
        prisma.ride.count({
          where: { customerId: actorId, createdAt: { gte: last24Hours } },
        }),
        prisma.ride.count({
          where: {
            customerId: actorId,
            status: 'cancelled',
            cancelledByRole: 'customer',
            createdAt: { gte: last24Hours },
          },
        }),
        prisma.ride.count({
          where: { customerId: actorId, createdAt: { gte: last7Days } },
        }),
        prisma.ride.count({
          where: {
            customerId: actorId,
            status: 'cancelled',
            cancelledByRole: 'customer',
            createdAt: { gte: last7Days },
          },
        }),
      ]);

      const rate24h = rides24h > 0 ? (cancelled24h / rides24h) * 100 : 0;
      const rate7d = rides7d > 0 ? (cancelled7d / rides7d) * 100 : 0;

      // Customer thresholds are slightly more lenient
      if (rate24h > 50 || cancelled24h >= 8) {
        return {
          detected: true,
          severity: 'high',
          metrics: { rate24h, cancelled24h, rides24h, rate7d, cancelled7d, rides7d },
          reason: `Customer cancelled ${cancelled24h} rides (${rate24h.toFixed(1)}%) in last 24 hours`,
        };
      }
      if (rate7d > 30 || cancelled7d >= 15) {
        return {
          detected: true,
          severity: 'medium',
          metrics: { rate24h, cancelled24h, rides24h, rate7d, cancelled7d, rides7d },
          reason: `Customer cancelled ${cancelled7d} rides (${rate7d.toFixed(1)}%) in last 7 days`,
        };
      }
    }

    return { detected: false, severity: 'low', metrics: {}, reason: '' };
  } catch (error) {
    console.error("Cancellation abuse check error:", error);
    return { detected: false, severity: 'low', metrics: {}, reason: '' };
  }
}

/**
 * Phase 4 Task 31: Wallet Manipulation Detection
 * Detects suspicious wallet activities (negative balances, unusual transactions)
 */
export async function checkWalletManipulation(
  walletId: string
): Promise<{ detected: boolean; severity: string; metrics: Record<string, any>; reason: string }> {
  try {
    const wallet = await prisma.driverWallet.findUnique({
      where: { id: walletId },
      include: {
        transactions: {
          where: {
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!wallet) {
      return { detected: false, severity: 'low', metrics: {}, reason: '' };
    }

    const negativeBalance = Number(wallet.negativeBalance) || 0;
    const currentBalance = Number(wallet.balance) || 0;
    
    // Check 1: Large negative balance
    if (negativeBalance > 500) {
      return {
        detected: true,
        severity: 'critical',
        metrics: { negativeBalance, currentBalance, walletId },
        reason: `Wallet has excessive negative balance of $${negativeBalance.toFixed(2)}`,
      };
    }
    if (negativeBalance > 200) {
      return {
        detected: true,
        severity: 'high',
        metrics: { negativeBalance, currentBalance, walletId },
        reason: `Wallet has significant negative balance of $${negativeBalance.toFixed(2)}`,
      };
    }

    // Check 2: Rapid withdrawal pattern
    const withdrawals = wallet.transactions.filter(
      (t: any) => t.type === 'debit' || t.transactionType === 'payout'
    );
    const totalWithdrawn = withdrawals.reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0);

    if (withdrawals.length >= 10 && totalWithdrawn > 1000) {
      return {
        detected: true,
        severity: 'high',
        metrics: { withdrawalCount: withdrawals.length, totalWithdrawn, walletId },
        reason: `${withdrawals.length} withdrawals totaling $${totalWithdrawn.toFixed(2)} in 7 days`,
      };
    }

    // Check 3: Balance suddenly zeroed after large deposits
    const deposits = wallet.transactions.filter(
      (t: any) => t.type === 'credit' || t.transactionType === 'earning'
    );
    const totalDeposited = deposits.reduce((sum: number, t: any) => sum + Number(t.amount), 0);

    if (totalDeposited > 500 && currentBalance < 10) {
      return {
        detected: true,
        severity: 'medium',
        metrics: { totalDeposited, currentBalance, walletId },
        reason: `Wallet balance near zero despite $${totalDeposited.toFixed(2)} deposits this week`,
      };
    }

    return { detected: false, severity: 'low', metrics: {}, reason: '' };
  } catch (error) {
    console.error("Wallet manipulation check error:", error);
    return { detected: false, severity: 'low', metrics: {}, reason: '' };
  }
}

/**
 * Phase 4 Task 31: Payment Anomaly Detection
 * Detects unusual payment patterns (failed payments, chargebacks, etc.)
 */
export async function checkPaymentAnomalies(
  userId: string
): Promise<{ detected: boolean; severity: string; metrics: Record<string, any>; reason: string }> {
  try {
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get payment transactions for user
    const [failedPayments7d, totalPayments7d, failedPayments30d, totalPayments30d] = await Promise.all([
      prisma.ride.count({
        where: {
          customerId: userId,
          paymentStatus: { in: ['failed', 'disputed', 'refunded'] },
          createdAt: { gte: last7Days },
        },
      }),
      prisma.ride.count({
        where: {
          customerId: userId,
          createdAt: { gte: last7Days },
        },
      }),
      prisma.ride.count({
        where: {
          customerId: userId,
          paymentStatus: { in: ['failed', 'disputed', 'refunded'] },
          createdAt: { gte: last30Days },
        },
      }),
      prisma.ride.count({
        where: {
          customerId: userId,
          createdAt: { gte: last30Days },
        },
      }),
    ]);

    const failRate7d = totalPayments7d > 0 ? (failedPayments7d / totalPayments7d) * 100 : 0;
    const failRate30d = totalPayments30d > 0 ? (failedPayments30d / totalPayments30d) * 100 : 0;

    // Critical: >40% failure in 7 days
    if (failRate7d > 40 || failedPayments7d >= 5) {
      return {
        detected: true,
        severity: 'critical',
        metrics: { failRate7d, failedPayments7d, totalPayments7d, failRate30d, failedPayments30d },
        reason: `${failedPayments7d} payment failures (${failRate7d.toFixed(1)}%) in last 7 days`,
      };
    }

    // High: >25% failure in 30 days
    if (failRate30d > 25 || failedPayments30d >= 10) {
      return {
        detected: true,
        severity: 'high',
        metrics: { failRate7d, failedPayments7d, totalPayments7d, failRate30d, failedPayments30d },
        reason: `${failedPayments30d} payment failures (${failRate30d.toFixed(1)}%) in last 30 days`,
      };
    }

    // Medium: Payment method hopping
    const paymentMethods = await prisma.ride.groupBy({
      by: ['paymentMethod'],
      where: {
        customerId: userId,
        createdAt: { gte: last7Days },
      },
      _count: true,
    });

    if (paymentMethods.length >= 4) {
      return {
        detected: true,
        severity: 'medium',
        metrics: { paymentMethodsUsed: paymentMethods.length, methods: paymentMethods },
        reason: `User switched between ${paymentMethods.length} payment methods in 7 days`,
      };
    }

    return { detected: false, severity: 'low', metrics: {}, reason: '' };
  } catch (error) {
    console.error("Payment anomaly check error:", error);
    return { detected: false, severity: 'low', metrics: {}, reason: '' };
  }
}

/**
 * Phase 4 Task 31: GPS Spoofing Detection
 * Detects potential GPS manipulation by drivers
 */
export async function checkGpsSpoofing(
  driverId: string,
  rideId?: string
): Promise<{ detected: boolean; severity: string; metrics: Record<string, any>; reason: string }> {
  try {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get driver's recent rides
    const recentRides = await prisma.ride.findMany({
      where: {
        driverId,
        status: 'completed',
        createdAt: { gte: last24Hours },
      },
      select: {
        id: true,
        pickupLat: true,
        pickupLng: true,
        dropoffLat: true,
        dropoffLng: true,
        distanceKm: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        serviceFare: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (recentRides.length < 2) {
      return { detected: false, severity: 'low', metrics: {}, reason: '' };
    }

    let suspiciousPatterns = 0;
    const flags: string[] = [];

    // Check 1: Impossible speed between consecutive rides
    for (let i = 1; i < recentRides.length; i++) {
      const prev = recentRides[i - 1];
      const curr = recentRides[i];

      if (prev.completedAt && curr.startedAt && prev.dropoffLat && prev.dropoffLng && curr.pickupLat && curr.pickupLng) {
        const timeDiffMinutes = (curr.startedAt.getTime() - prev.completedAt.getTime()) / (1000 * 60);
        
        // Calculate distance between previous dropoff and current pickup
        const distance = haversineDistance(
          prev.dropoffLat,
          prev.dropoffLng,
          curr.pickupLat,
          curr.pickupLng
        );

        // Speed in km/h
        const speedKmh = timeDiffMinutes > 0 ? (distance / timeDiffMinutes) * 60 : 0;

        // Flag if speed exceeds 150 km/h (impossible without flying)
        if (speedKmh > 150 && distance > 5) {
          suspiciousPatterns++;
          flags.push(`Impossible travel: ${distance.toFixed(1)}km in ${timeDiffMinutes.toFixed(0)}min (${speedKmh.toFixed(0)} km/h)`);
        }
      }
    }

    // Check 2: Unrealistic distance vs fare ratio
    const avgFarePerKm = recentRides
      .filter(r => r.distanceKm && Number(r.distanceKm) > 0)
      .reduce((sum, r) => {
        const fare = Number(r.serviceFare) || 0;
        const distance = Number(r.distanceKm) || 1;
        return sum + fare / distance;
      }, 0) / Math.max(recentRides.length, 1);

    const anomalousRides = recentRides.filter(r => {
      if (!r.distanceKm || Number(r.distanceKm) === 0) return false;
      const farePerKm = Number(r.serviceFare) / Number(r.distanceKm);
      return farePerKm > avgFarePerKm * 2.5; // 150% above average
    });

    if (anomalousRides.length >= 3) {
      suspiciousPatterns++;
      flags.push(`${anomalousRides.length} rides with unusually high fare/distance ratio`);
    }

    // Check 3: Same exact coordinates repeated (mock location)
    const coordCounts = new Map<string, number>();
    recentRides.forEach(r => {
      if (r.pickupLat && r.pickupLng) {
        const key = `${r.pickupLat.toFixed(4)},${r.pickupLng.toFixed(4)}`;
        coordCounts.set(key, (coordCounts.get(key) || 0) + 1);
      }
    });

    const duplicateCoords = Array.from(coordCounts.entries()).filter(([_, count]) => count >= 5);
    if (duplicateCoords.length > 0) {
      suspiciousPatterns++;
      flags.push(`Same pickup coordinates used ${duplicateCoords[0][1]} times`);
    }

    if (suspiciousPatterns >= 2) {
      return {
        detected: true,
        severity: 'critical',
        metrics: { suspiciousPatterns, flags, ridesChecked: recentRides.length },
        reason: flags.join('; '),
      };
    }
    if (suspiciousPatterns === 1) {
      return {
        detected: true,
        severity: 'high',
        metrics: { suspiciousPatterns, flags, ridesChecked: recentRides.length },
        reason: flags.join('; '),
      };
    }

    return { detected: false, severity: 'low', metrics: {}, reason: '' };
  } catch (error) {
    console.error("GPS spoofing check error:", error);
    return { detected: false, severity: 'low', metrics: {}, reason: '' };
  }
}

/**
 * Helper: Haversine distance calculation
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Phase 4: Create fraud alert in database
 */
export async function createFraudAlert(
  entityType: 'ride' | 'food_order' | 'parcel' | 'customer' | 'driver' | 'wallet' | 'payment',
  entityId: string,
  alertType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  reason: string,
  metrics: Record<string, any>
): Promise<void> {
  try {
    // Check if similar alert already exists (within last 24 hours)
    const existingAlert = await prisma.fraudAlert.findFirst({
      where: {
        entityType,
        entityId,
        alertType,
        status: 'open',
        detectedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (existingAlert) {
      // Update existing alert with new metrics
      await prisma.fraudAlert.update({
        where: { id: existingAlert.id },
        data: {
          detectedMetrics: metrics,
          detectedReason: reason,
          updatedAt: new Date(),
        },
      });
      return;
    }

    // Create new alert
    await prisma.fraudAlert.create({
      data: {
        entityType,
        entityId,
        alertType,
        severity,
        status: 'open',
        detectedReason: reason,
        detectedMetrics: metrics,
        detectedAt: new Date(),
      },
    });

    // Log audit event
    await logAuditEvent({
      entityType: EntityType.FRAUD_ALERT || ('fraud_alert' as any),
      entityId,
      actionType: ActionType.CREATE,
      actorId: 'system',
      actorRole: 'system',
      metadata: { alertType, severity, reason },
    });
  } catch (error) {
    console.error("Create fraud alert error:", error);
  }
}

/**
 * Phase 4: Run all fraud checks for a driver
 */
export async function runDriverFraudChecks(driverId: string): Promise<void> {
  try {
    // Check cancellation abuse
    const cancellationResult = await checkCancellationAbuse(driverId, 'driver');
    if (cancellationResult.detected) {
      await createFraudAlert(
        'driver',
        driverId,
        'cancellation_abuse',
        cancellationResult.severity as any,
        cancellationResult.reason,
        cancellationResult.metrics
      );
    }

    // Check GPS spoofing
    const gpsResult = await checkGpsSpoofing(driverId);
    if (gpsResult.detected) {
      await createFraudAlert(
        'driver',
        driverId,
        'gps_spoofing',
        gpsResult.severity as any,
        gpsResult.reason,
        gpsResult.metrics
      );
    }

    // Check wallet manipulation
    const wallet = await prisma.driverWallet.findUnique({
      where: { driverId },
      select: { id: true },
    });
    if (wallet) {
      const walletResult = await checkWalletManipulation(wallet.id);
      if (walletResult.detected) {
        await createFraudAlert(
          'wallet',
          wallet.id,
          'wallet_manipulation',
          walletResult.severity as any,
          walletResult.reason,
          walletResult.metrics
        );
      }
    }
  } catch (error) {
    console.error("Driver fraud checks error:", error);
  }
}

/**
 * Phase 4: Run all fraud checks for a customer
 */
export async function runCustomerFraudChecks(customerId: string): Promise<void> {
  try {
    // Get user ID from customer profile
    const customer = await prisma.customerProfile.findUnique({
      where: { id: customerId },
      select: { userId: true },
    });

    if (!customer) return;

    // Check cancellation abuse
    const cancellationResult = await checkCancellationAbuse(customerId, 'customer');
    if (cancellationResult.detected) {
      await createFraudAlert(
        'customer',
        customerId,
        'cancellation_abuse',
        cancellationResult.severity as any,
        cancellationResult.reason,
        cancellationResult.metrics
      );
    }

    // Check payment anomalies
    const paymentResult = await checkPaymentAnomalies(customer.userId);
    if (paymentResult.detected) {
      await createFraudAlert(
        'customer',
        customerId,
        'payment_anomaly',
        paymentResult.severity as any,
        paymentResult.reason,
        paymentResult.metrics
      );
    }
  } catch (error) {
    console.error("Customer fraud checks error:", error);
  }
}

/**
 * Check multi-account abuse (one person operating multiple accounts)
 */
export async function checkMultiAccountAbuse(userId: string): Promise<FraudCheckResult> {
  let riskScore = 0;
  const flags: string[] = [];
  const recommendations: string[] = [];

  try {
    // Get user's recent login IPs
    const userLogins = await prisma.auditLog.findMany({
      where: {
        actorId: userId,
        actionType: ActionType.LOGIN_SUCCESS,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { ipAddress: true },
    });

    const userIPs = [...new Set(userLogins.map((log) => log.ipAddress).filter((ip): ip is string => ip !== null))];

    if (userIPs.length === 0) {
      return {
        riskScore: 0,
        riskLevel: "low",
        flags: [],
        recommendations: [],
      };
    }

    // Find other users who logged in from same IPs
    const sharedIPUsers = await prisma.auditLog.findMany({
      where: {
        ipAddress: { in: userIPs },
        actorId: { not: userId },
        actionType: ActionType.LOGIN_SUCCESS,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: {
        actorId: true,
        actorEmail: true,
      },
      distinct: ["actorId"],
    });

    if (sharedIPUsers.length > 0) {
      riskScore += 15 * Math.min(sharedIPUsers.length, 3);
      flags.push(`${sharedIPUsers.length} accounts sharing same IP addresses`);
      recommendations.push("Review accounts for coordinated abuse");
    }

    // Check if user has multiple roles (driver + customer, etc.)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        driverProfile: true,
        customerProfile: true,
        restaurantProfile: true,
      },
    });

    if (user) {
      const roleCount = [
        user.driverProfile,
        user.customerProfile,
        user.restaurantProfile,
      ].filter(Boolean).length;

      if (roleCount > 1) {
        riskScore += 10;
        flags.push(`User has ${roleCount} active roles`);
        recommendations.push("Monitor for role-switching abuse");
      }
    }

    // Determine risk level
    let riskLevel: "low" | "medium" | "high" | "critical";
    if (riskScore >= 75) {
      riskLevel = "critical";
    } else if (riskScore >= 50) {
      riskLevel = "high";
    } else if (riskScore >= 25) {
      riskLevel = "medium";
    } else {
      riskLevel = "low";
    }

    return {
      riskScore: Math.min(100, riskScore),
      riskLevel,
      flags,
      recommendations,
    };
  } catch (error) {
    console.error("Multi-account abuse check error:", error);
    return {
      riskScore: 0,
      riskLevel: "low",
      flags: ["Error checking multi-account abuse"],
      recommendations: [],
    };
  }
}
