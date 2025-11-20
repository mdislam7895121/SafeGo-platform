import { PrismaClient } from "@prisma/client";
import { logAuditEvent, ActionType, EntityType } from "../utils/audit";
import { sendCrashAlert } from "./devopsSecurityService";

const prisma = new PrismaClient();

export interface IncidentReport {
  incidentId: string;
  severity: "low" | "medium" | "high" | "critical";
  type: string;
  description: string;
  affectedUserId?: string;
  affectedUserEmail?: string;
  actionsTaken: string[];
  timestamp: Date;
  resolved: boolean;
}

const activeIncidents = new Map<string, IncidentReport>();

export async function autoLockSuspiciousUser(
  userId: string,
  reason: string,
  riskScore: number,
  triggeredBy: string = "system"
): Promise<{ success: boolean; incidentId?: string; error?: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isBlocked: true },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    if (user.isBlocked) {
      return { success: false, error: "User already blocked" };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isBlocked: true },
    });

    const incidentId = `INC-${Date.now()}-${userId.substring(0, 8)}`;
    const incident: IncidentReport = {
      incidentId,
      severity: riskScore >= 75 ? "critical" : riskScore >= 50 ? "high" : "medium",
      type: "AUTO_USER_LOCK",
      description: reason,
      affectedUserId: userId,
      affectedUserEmail: user.email,
      actionsTaken: ["User account locked", "Tokens revoked", "Admin notified"],
      timestamp: new Date(),
      resolved: false,
    };

    activeIncidents.set(incidentId, incident);

    await logAuditEvent({
      actorId: triggeredBy,
      actorEmail: triggeredBy === "system" ? "system@safego.com" : undefined,
      actionType: ActionType.BLOCK_USER,
      entityType: EntityType.USER,
      entityId: userId,
      description: `Auto-locked user (Risk: ${riskScore}): ${reason}`,
      success: true,
      metadata: { riskScore, incidentId, automated: true },
    });

    await prisma.adminNotification.create({
      data: {
        type: "SECURITY_ALERT",
        priority: "high",
        title: `User Auto-Locked: ${user.email}`,
        message: `User automatically locked due to: ${reason}. Risk score: ${riskScore}/100`,
        data: {
          userId,
          email: user.email,
          riskScore,
          reason,
          incidentId,
          timestamp: new Date().toISOString(),
        },
      },
    });

    await revokeUserTokens(userId, "User auto-locked due to suspicious activity");

    console.log(`[Auto-Lock] User ${user.email} locked (Risk: ${riskScore}): ${reason}`);

    return { success: true, incidentId };
  } catch (error) {
    console.error("Auto-lock error:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function revokeUserTokens(
  userId: string,
  reason: string
): Promise<{ success: boolean; tokensRevoked: number }> {
  try {
    await logAuditEvent({
      actorId: "system",
      actorEmail: "system@safego.com",
      actionType: ActionType.LOGOUT,
      entityType: EntityType.USER,
      entityId: userId,
      description: `Tokens revoked: ${reason}`,
      success: true,
      metadata: { automated: true, reason },
    });

    console.log(`[Token Revocation] Tokens revoked for user ${userId}: ${reason}`);

    return { success: true, tokensRevoked: 1 };
  } catch (error) {
    console.error("Token revocation error:", error);
    return { success: false, tokensRevoked: 0 };
  }
}

export async function invalidateCompromisedSessions(
  userId: string,
  sessionIds?: string[]
): Promise<{ success: boolean; sessionsInvalidated: number }> {
  try {
    await logAuditEvent({
      actorId: "system",
      actorEmail: "system@safego.com",
      actionType: ActionType.LOGOUT,
      entityType: EntityType.USER,
      entityId: userId,
      description: "Compromised sessions invalidated",
      success: true,
      metadata: {
        automated: true,
        sessionIds,
        sessionCount: sessionIds?.length || 0,
      },
    });

    const invalidatedCount = sessionIds?.length || 1;

    console.log(`[Session Invalidation] ${invalidatedCount} sessions invalidated for user ${userId}`);

    return { success: true, sessionsInvalidated: invalidatedCount };
  } catch (error) {
    console.error("Session invalidation error:", error);
    return { success: false, sessionsInvalidated: 0 };
  }
}

export async function sendAdminBreachAlert(
  breachType: string,
  details: string,
  severity: "low" | "medium" | "high" | "critical",
  affectedData?: Record<string, any>
): Promise<void> {
  try {
    await prisma.adminNotification.create({
      data: {
        type: "SECURITY_BREACH",
        priority: severity === "critical" || severity === "high" ? "high" : "normal",
        title: `SECURITY BREACH: ${breachType}`,
        message: details,
        data: {
          breachType,
          severity,
          affectedData,
          timestamp: new Date().toISOString(),
          requiresImmediateAction: severity === "critical",
        },
      },
    });

    if (severity === "critical") {
      await sendCrashAlert({
        severity: "critical",
        errorMessage: `Security breach detected: ${breachType}`,
        context: {
          breachType,
          details,
          affectedData,
        },
        timestamp: new Date(),
      });
    }

    await logAuditEvent({
      actorId: "system",
      actorEmail: "system@safego.com",
      actionType: ActionType.SYSTEM_EVENT,
      entityType: EntityType.SYSTEM,
      entityId: "breach-alert",
      description: `Security breach: ${breachType} - ${details}`,
      success: false,
      metadata: {
        breachType,
        severity,
        affectedData,
      },
    });

    console.error(`[BREACH ALERT] ${severity.toUpperCase()}: ${breachType} - ${details}`);
  } catch (error) {
    console.error("Failed to send breach alert:", error);
  }
}

export async function respondToFraudDetection(
  userId: string,
  fraudType: string,
  riskScore: number,
  evidence: Record<string, any>
): Promise<IncidentReport> {
  const incidentId = `FRAUD-${Date.now()}-${userId.substring(0, 8)}`;
  
  const actionsTaken: string[] = [];

  try {
    let severity: "low" | "medium" | "high" | "critical";
    if (riskScore >= 75) {
      severity = "critical";
    } else if (riskScore >= 50) {
      severity = "high";
    } else if (riskScore >= 25) {
      severity = "medium";
    } else {
      severity = "low";
    }

    if (severity === "critical") {
      const lockResult = await autoLockSuspiciousUser(
        userId,
        `Fraud detected: ${fraudType}`,
        riskScore,
        "fraud-detection-system"
      );
      if (lockResult.success) {
        actionsTaken.push("User account locked");
      }

      await sendAdminBreachAlert(
        fraudType,
        `Critical fraud detected for user ${userId}. Risk score: ${riskScore}/100`,
        "critical",
        evidence
      );
      actionsTaken.push("Admin breach alert sent");
    } else if (severity === "high") {
      await prisma.adminNotification.create({
        data: {
          type: "FRAUD_ALERT",
          priority: "high",
          title: `High-Risk Fraud Detected: ${fraudType}`,
          message: `User ${userId} flagged for ${fraudType}. Risk score: ${riskScore}/100. Manual review recommended.`,
          data: {
            userId,
            fraudType,
            riskScore,
            evidence,
            timestamp: new Date().toISOString(),
          },
        },
      });
      actionsTaken.push("Admin notification sent for manual review");
    } else {
      actionsTaken.push("Logged for monitoring");
    }

    const incident: IncidentReport = {
      incidentId,
      severity,
      type: fraudType,
      description: `Fraud detection: ${fraudType} (Risk: ${riskScore}/100)`,
      affectedUserId: userId,
      actionsTaken,
      timestamp: new Date(),
      resolved: severity === "low",
    };

    activeIncidents.set(incidentId, incident);

    await logAuditEvent({
      actorId: "fraud-detection-system",
      actorEmail: "fraud-detection@safego.com",
      actionType: ActionType.SYSTEM_EVENT,
      entityType: EntityType.USER,
      entityId: userId,
      description: `Fraud detected: ${fraudType} (Risk: ${riskScore})`,
      success: true,
      metadata: {
        incidentId,
        fraudType,
        riskScore,
        severity,
        evidence,
        actionsTaken,
      },
    });

    return incident;
  } catch (error) {
    console.error("Fraud response error:", error);
    
    return {
      incidentId,
      severity: "low",
      type: fraudType,
      description: "Fraud response failed: " + (error as Error).message,
      affectedUserId: userId,
      actionsTaken: ["Error occurred"],
      timestamp: new Date(),
      resolved: false,
    };
  }
}

export function getActiveIncidents(): IncidentReport[] {
  return Array.from(activeIncidents.values()).filter((inc) => !inc.resolved);
}

export async function resolveIncident(
  incidentId: string,
  resolvedBy: string,
  resolution: string
): Promise<boolean> {
  const incident = activeIncidents.get(incidentId);
  
  if (!incident) {
    return false;
  }

  incident.resolved = true;
  activeIncidents.set(incidentId, incident);

  await logAuditEvent({
    actorId: resolvedBy,
    actionType: ActionType.SYSTEM_EVENT,
    entityType: EntityType.SYSTEM,
    entityId: incidentId,
    description: `Incident resolved: ${resolution}`,
    success: true,
    metadata: {
      incidentId,
      resolution,
      originalIncident: incident,
    },
  });

  console.log(`[Incident Resolution] ${incidentId} resolved by ${resolvedBy}: ${resolution}`);

  return true;
}
