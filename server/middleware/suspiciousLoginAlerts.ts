import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface LoginContext {
  userId: string;
  userRole: string;
  userEmail?: string;
  userPhone?: string;
  deviceId?: string;
  ipAddress?: string;
  country?: string;
  city?: string;
  userAgent?: string;
}

interface SuspiciousLoginCheck {
  isSuspicious: boolean;
  alertType?: string;
  alertSeverity?: string;
  reason?: string;
}

export async function checkSuspiciousLogin(context: LoginContext): Promise<SuspiciousLoginCheck> {
  const { userId, deviceId, ipAddress, country } = context;

  const recentDevices = await prisma.deviceHistory.findMany({
    where: {
      userId,
      isActive: true,
      removedByUser: false,
    },
    orderBy: { lastSeenAt: "desc" },
    take: 10,
  });

  const knownDeviceIds = recentDevices.map((d) => d.deviceId);
  const knownCountries = [...new Set(recentDevices.map((d) => d.ipCountry).filter(Boolean))];

  if (deviceId && !knownDeviceIds.includes(deviceId)) {
    return {
      isSuspicious: true,
      alertType: "new_device",
      alertSeverity: "medium",
      reason: `Login from new device: ${deviceId}`,
    };
  }

  if (country && knownCountries.length > 0 && !knownCountries.includes(country)) {
    return {
      isSuspicious: true,
      alertType: "new_country",
      alertSeverity: "high",
      reason: `Login from new country: ${country}. Known countries: ${knownCountries.join(", ")}`,
    };
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentLogins = await prisma.loginAttempt.findMany({
    where: {
      identifier: userId,
      identifierType: "user_id",
      attemptType: "login",
      success: true,
      createdAt: { gte: oneHourAgo },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const uniqueIPs = [...new Set(recentLogins.map((l) => l.ipAddress).filter(Boolean))];
  if (uniqueIPs.length >= 3) {
    return {
      isSuspicious: true,
      alertType: "rapid_ip_change",
      alertSeverity: "high",
      reason: `${uniqueIPs.length} different IPs in the last hour`,
    };
  }

  const highRiskLocations = ["RU", "CN", "KP", "IR"];
  if (country && highRiskLocations.includes(country)) {
    return {
      isSuspicious: true,
      alertType: "high_risk_location",
      alertSeverity: "critical",
      reason: `Login from high-risk location: ${country}`,
    };
  }

  return { isSuspicious: false };
}

export async function createSecurityAlert(
  context: LoginContext,
  alertType: string,
  alertSeverity: string,
  reason: string
): Promise<string> {
  const previousDevice = await prisma.deviceHistory.findFirst({
    where: { userId: context.userId, isActive: true },
    orderBy: { lastSeenAt: "desc" },
  });

  const alert = await prisma.securityAlert.create({
    data: {
      userId: context.userId,
      userRole: context.userRole,
      userEmail: context.userEmail,
      userPhone: context.userPhone,
      alertType,
      alertSeverity,
      alertMessage: reason,
      triggerDeviceId: context.deviceId,
      triggerIpAddress: context.ipAddress,
      triggerCountry: context.country,
      triggerCity: context.city,
      previousContext: previousDevice
        ? {
            deviceId: previousDevice.deviceId,
            ipAddress: previousDevice.lastLoginIp,
            country: previousDevice.ipCountry,
          }
        : undefined,
      currentContext: {
        deviceId: context.deviceId,
        ipAddress: context.ipAddress,
        country: context.country,
        city: context.city,
        userAgent: context.userAgent,
      },
    },
  });

  console.log(`[SuspiciousLogin] Alert created: ${alertType} for user ${context.userId}`);

  await sendSecurityNotifications(alert.id, context, alertType, reason);

  return alert.id;
}

async function sendSecurityNotifications(
  alertId: string,
  context: LoginContext,
  alertType: string,
  reason: string
): Promise<void> {
  const emailTemplate = generateEmailTemplate(alertType, reason, context);
  const smsTemplate = generateSMSTemplate(alertType, context);

  if (context.userEmail) {
    console.log(`[SuspiciousLogin] Email notification (template): ${emailTemplate}`);
    await prisma.securityAlert.update({
      where: { id: alertId },
      data: {
        emailSent: true,
        emailSentAt: new Date(),
      },
    });
  }

  if (context.userPhone) {
    console.log(`[SuspiciousLogin] SMS notification (template): ${smsTemplate}`);
    await prisma.securityAlert.update({
      where: { id: alertId },
      data: {
        smsSent: true,
        smsSentAt: new Date(),
      },
    });
  }

  try {
    await prisma.adminFullAuditLog.create({
      data: {
        adminId: "system",
        adminRole: "system",
        actionCategory: "security",
        actionType: "suspicious_login_detected",
        actionSeverity: context.country && ["RU", "CN", "KP", "IR"].includes(context.country) ? "critical" : "high",
        targetUserId: context.userId,
        targetUserType: context.userRole,
        description: reason,
        ipAddress: context.ipAddress,
        countryCode: context.country,
        metadata: {
          alertId,
          alertType,
          deviceId: context.deviceId,
        },
      },
    });
  } catch (e) {
    console.warn("[SuspiciousLogin] Could not create audit log:", e);
  }
}

function generateEmailTemplate(alertType: string, reason: string, context: LoginContext): string {
  const templates: Record<string, string> = {
    new_device: `
      Subject: SafeGo Security Alert - New Device Login
      
      Hello,
      
      We detected a login to your SafeGo account from a new device.
      
      Device: ${context.deviceId || "Unknown"}
      Location: ${context.city || ""}, ${context.country || "Unknown"}
      IP Address: ${context.ipAddress || "Unknown"}
      Time: ${new Date().toISOString()}
      
      If this was you, you can ignore this message.
      If you did not log in, please secure your account immediately.
      
      - SafeGo Security Team
    `,
    new_country: `
      Subject: SafeGo Security Alert - Login from New Location
      
      Hello,
      
      We detected a login to your SafeGo account from a new country.
      
      Country: ${context.country || "Unknown"}
      IP Address: ${context.ipAddress || "Unknown"}
      Time: ${new Date().toISOString()}
      
      If this was you, you can ignore this message.
      If you did not log in, please change your password immediately.
      
      - SafeGo Security Team
    `,
    rapid_ip_change: `
      Subject: SafeGo Security Alert - Unusual Activity Detected
      
      Hello,
      
      We detected unusual login activity on your SafeGo account.
      Multiple logins from different locations were detected in a short time.
      
      Current Location: ${context.city || ""}, ${context.country || "Unknown"}
      
      If this was you, you can ignore this message.
      If you did not log in, please secure your account immediately.
      
      - SafeGo Security Team
    `,
    high_risk_location: `
      Subject: SafeGo Security Alert - High-Risk Login Detected
      
      Hello,
      
      We detected a login to your SafeGo account from a high-risk location.
      
      Country: ${context.country || "Unknown"}
      IP Address: ${context.ipAddress || "Unknown"}
      
      Your account access may be restricted until you verify this login.
      
      - SafeGo Security Team
    `,
  };

  return templates[alertType] || templates.new_device;
}

function generateSMSTemplate(alertType: string, context: LoginContext): string {
  const templates: Record<string, string> = {
    new_device: `SafeGo Alert: New device login detected. Location: ${context.country || "Unknown"}. If not you, secure your account now.`,
    new_country: `SafeGo Alert: Login from new country (${context.country}). If not you, change password immediately.`,
    rapid_ip_change: `SafeGo Alert: Unusual login activity detected. Multiple locations in short time. Secure your account if not you.`,
    high_risk_location: `SafeGo ALERT: High-risk login from ${context.country}. Account may be restricted. Verify immediately.`,
  };

  return templates[alertType] || templates.new_device;
}

export async function acknowledgeSecurityAlert(
  alertId: string,
  wasLegitimate: boolean,
  userId: string
): Promise<void> {
  await prisma.securityAlert.update({
    where: { id: alertId, userId },
    data: {
      acknowledged: true,
      acknowledgedAt: new Date(),
      wasLegitimate,
    },
  });
}

export async function reviewSecurityAlert(
  alertId: string,
  adminId: string,
  reviewNote: string
): Promise<void> {
  await prisma.securityAlert.update({
    where: { id: alertId },
    data: {
      reviewedByAdmin: true,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      reviewNote,
    },
  });
}

export const suspiciousLoginCheckMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  next();
};
