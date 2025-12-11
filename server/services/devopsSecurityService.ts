import { prisma } from "../lib/prisma";
import { logAuditEvent, ActionType, EntityType } from "../utils/audit";
import fs from "fs/promises";
import path from "path";

/**
 * Log Rotation Service
 * Automatically rotates audit logs to prevent database bloat
 */
export async function rotateAuditLogs(olderThanDays: number = 90): Promise<{
  archived: number;
  deleted: number;
  success: boolean;
}> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // Count logs to be archived
    const logsToArchive = await prisma.auditLog.count({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    // In production, export to archival storage (S3, etc.)
    // For now, just delete old logs
    const deleted = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    console.log(`Rotated ${deleted.count} audit logs older than ${olderThanDays} days`);

    return {
      archived: 0,
      deleted: deleted.count,
      success: true,
    };
  } catch (error) {
    console.error("Log rotation error:", error);
    return {
      archived: 0,
      deleted: 0,
      success: false,
    };
  }
}

/**
 * Background Job Failure Monitor
 * Tracks failed jobs and alerts admins
 */
interface JobFailure {
  jobName: string;
  error: string;
  timestamp: Date;
  retryCount: number;
}

const jobFailures: JobFailure[] = [];
const MAX_FAILURES_STORED = 100;

export function recordJobFailure(jobName: string, error: string, retryCount: number = 0): void {
  const failure: JobFailure = {
    jobName,
    error,
    timestamp: new Date(),
    retryCount,
  };

  jobFailures.unshift(failure);

  // Keep only last 100 failures
  if (jobFailures.length > MAX_FAILURES_STORED) {
    jobFailures.pop();
  }

  console.error(`[Job Failure] ${jobName}: ${error} (retry ${retryCount})`);

  // Send alert if critical job failed
  if (isCriticalJob(jobName)) {
    sendJobFailureAlert(failure);
  }
}

export function getRecentJobFailures(limit: number = 50): JobFailure[] {
  return jobFailures.slice(0, limit);
}

function isCriticalJob(jobName: string): boolean {
  const criticalJobs = [
    "wallet-sync",
    "payout-processing",
    "commission-calculation",
    "fraud-detection",
    "backup",
  ];
  return criticalJobs.some((critical) => jobName.includes(critical));
}

async function sendJobFailureAlert(failure: JobFailure): Promise<void> {
  try {
    // Create admin notification for job failure
    await prisma.adminNotification.create({
      data: {
        type: "SYSTEM_ALERT",
        priority: "high",
        title: `Critical Job Failure: ${failure.jobName}`,
        message: `Job "${failure.jobName}" failed with error: ${failure.error}. Retry count: ${failure.retryCount}`,
        data: {
          jobName: failure.jobName,
          error: failure.error,
          retryCount: failure.retryCount,
          timestamp: failure.timestamp.toISOString(),
        },
      },
    });

    console.log(`Alert sent for critical job failure: ${failure.jobName}`);
  } catch (error) {
    console.error("Failed to send job failure alert:", error);
  }
}

/**
 * Crash Alert Webhook
 * Sends alerts when application crashes or encounters critical errors
 */
export interface CrashAlert {
  severity: "low" | "medium" | "high" | "critical";
  errorMessage: string;
  stackTrace?: string;
  context?: Record<string, any>;
  timestamp: Date;
}

export async function sendCrashAlert(alert: CrashAlert): Promise<void> {
  try {
    // Log to audit trail
    await logAuditEvent({
      actorId: "system",
      actorEmail: "system@safego.com",
      actionType: ActionType.SYSTEM_EVENT,
      entityType: EntityType.SYSTEM,
      entityId: "crash-alert",
      description: `${alert.severity.toUpperCase()}: ${alert.errorMessage}`,
      success: false,
      metadata: {
        stackTrace: alert.stackTrace,
        context: alert.context,
      },
    });

    // Create admin notification
    await prisma.adminNotification.create({
      data: {
        type: "SYSTEM_ALERT",
        priority: alert.severity === "critical" || alert.severity === "high" ? "high" : "normal",
        title: `System Crash Alert: ${alert.severity.toUpperCase()}`,
        message: alert.errorMessage,
        data: {
          severity: alert.severity,
          errorMessage: alert.errorMessage,
          stackTrace: alert.stackTrace,
          context: alert.context,
          timestamp: alert.timestamp.toISOString(),
        },
      },
    });

    // In production, also send to external monitoring service (Sentry, etc.)
    console.error(`[CRASH ALERT] ${alert.severity}: ${alert.errorMessage}`);
    if (alert.stackTrace) {
      console.error(alert.stackTrace);
    }
  } catch (error) {
    console.error("Failed to send crash alert:", error);
  }
}

/**
 * Backup Encryption Service
 * Encrypts database backups before storage
 */
export async function encryptBackup(backupData: string, encryptionKey: string): Promise<string> {
  const crypto = await import("crypto");
  
  // Generate initialization vector
  const iv = crypto.randomBytes(16);
  
  // Create cipher
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(encryptionKey, "hex"),
    iv
  );
  
  // Encrypt data
  let encrypted = cipher.update(backupData, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  // Get auth tag
  const authTag = cipher.getAuthTag();
  
  // Combine IV, auth tag, and encrypted data
  const result = {
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    encryptedData: encrypted,
  };
  
  return JSON.stringify(result);
}

export async function decryptBackup(encryptedBackup: string, encryptionKey: string): Promise<string> {
  const crypto = await import("crypto");
  
  const { iv, authTag, encryptedData } = JSON.parse(encryptedBackup);
  
  // Create decipher
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(encryptionKey, "hex"),
    Buffer.from(iv, "hex")
  );
  
  // Set auth tag
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  
  // Decrypt data
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Auto-scaling Firewall Rules
 * Automatically blocks IPs with suspicious behavior
 */
interface FirewallRule {
  ipAddress: string;
  reason: string;
  blockedAt: Date;
  expiresAt: Date;
  permanent: boolean;
}

const blockedIPs = new Map<string, FirewallRule>();

export function blockIP(
  ipAddress: string,
  reason: string,
  durationMinutes: number = 60,
  permanent: boolean = false
): void {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

  const rule: FirewallRule = {
    ipAddress,
    reason,
    blockedAt: now,
    expiresAt,
    permanent,
  };

  blockedIPs.set(ipAddress, rule);

  console.log(
    `[Firewall] Blocked IP ${ipAddress} for ${permanent ? "permanent" : `${durationMinutes} minutes`}: ${reason}`
  );

  // Log to audit trail
  logAuditEvent({
    actorId: "system",
    actorEmail: "system@safego.com",
    actionType: ActionType.BLOCK_USER,
    entityType: EntityType.SYSTEM,
    entityId: ipAddress,
    description: `IP blocked: ${reason}`,
    success: true,
    ipAddress,
    metadata: { durationMinutes, permanent },
  });
}

export function unblockIP(ipAddress: string): boolean {
  const deleted = blockedIPs.delete(ipAddress);
  if (deleted) {
    console.log(`[Firewall] Unblocked IP ${ipAddress}`);
  }
  return deleted;
}

export function isIPBlocked(ipAddress: string): { blocked: boolean; rule?: FirewallRule } {
  const rule = blockedIPs.get(ipAddress);
  
  if (!rule) {
    return { blocked: false };
  }

  // Check if temporary block has expired
  if (!rule.permanent && rule.expiresAt < new Date()) {
    blockedIPs.delete(ipAddress);
    return { blocked: false };
  }

  return { blocked: true, rule };
}

export function getBlockedIPs(): FirewallRule[] {
  return Array.from(blockedIPs.values());
}

/**
 * Auto-detect and block suspicious IPs
 */
export async function autoBlockSuspiciousIPs(): Promise<number> {
  try {
    const now = new Date();
    const last10Minutes = new Date(now.getTime() - 10 * 60 * 1000);

    // Find IPs with multiple failed login attempts
    const failedLogins = await prisma.auditLog.groupBy({
      by: ["ipAddress"],
      where: {
        actionType: ActionType.LOGIN_FAILED,
        createdAt: { gte: last10Minutes },
        ipAddress: { not: null },
      },
      _count: {
        ipAddress: true,
      },
      having: {
        ipAddress: {
          _count: {
            gt: 5, // More than 5 failed attempts
          },
        },
      },
    });

    let blockedCount = 0;

    for (const { ipAddress, _count } of failedLogins) {
      if (ipAddress && !isIPBlocked(ipAddress).blocked) {
        blockIP(
          ipAddress,
          `${_count.ipAddress} failed login attempts in 10 minutes`,
          120 // Block for 2 hours
        );
        blockedCount++;
      }
    }

    return blockedCount;
  } catch (error) {
    console.error("Auto-block error:", error);
    return 0;
  }
}

/**
 * System Health Check
 */
export async function performSystemHealthCheck(): Promise<{
  healthy: boolean;
  issues: string[];
  metrics: Record<string, any>;
}> {
  const issues: string[] = [];
  const metrics: Record<string, any> = {};

  try {
    // Check database connection
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;
    metrics.databaseLatency = dbLatency;

    if (dbLatency > 1000) {
      issues.push(`Database latency high: ${dbLatency}ms`);
    }

    // Check recent job failures
    const recentFailures = getRecentJobFailures(10);
    metrics.recentJobFailures = recentFailures.length;

    if (recentFailures.length > 5) {
      issues.push(`${recentFailures.length} recent job failures detected`);
    }

    // Check blocked IPs
    const blockedIPCount = getBlockedIPs().length;
    metrics.blockedIPs = blockedIPCount;

    if (blockedIPCount > 50) {
      issues.push(`${blockedIPCount} IPs currently blocked`);
    }

    // Check failed logins in last hour
    const failedLogins = await prisma.auditLog.count({
      where: {
        actionType: ActionType.LOGIN_FAILED,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });
    metrics.failedLoginsLastHour = failedLogins;

    if (failedLogins > 100) {
      issues.push(`${failedLogins} failed logins in last hour`);
    }

    return {
      healthy: issues.length === 0,
      issues,
      metrics,
    };
  } catch (error) {
    console.error("Health check error:", error);
    return {
      healthy: false,
      issues: ["Health check failed: " + (error as Error).message],
      metrics: {},
    };
  }
}
