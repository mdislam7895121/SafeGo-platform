import { PrismaClient } from "@prisma/client";
import { logAuditEvent, ActionType, EntityType } from "../utils/audit";

const prisma = new PrismaClient();

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
