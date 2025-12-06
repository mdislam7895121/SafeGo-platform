import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

let lastHashChain: string | null = null;

interface AuditLogData {
  adminId: string;
  adminEmail?: string;
  adminRole: string;
  actionCategory: string;
  actionType: string;
  actionSeverity?: string;
  resourceType?: string;
  resourceId?: string;
  targetUserId?: string;
  targetUserType?: string;
  targetUserName?: string;
  beforeValue?: any;
  afterValue?: any;
  changeDescription?: string;
  reason?: string;
  metadata?: any;
}

function calculateHashChain(data: AuditLogData, previousHash: string | null): string {
  const content = JSON.stringify({
    ...data,
    previousHash,
    timestamp: Date.now(),
  });

  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function createAdminAuditLog(
  data: AuditLogData,
  req?: Request
): Promise<string> {
  const hashChain = calculateHashChain(data, lastHashChain);

  const log = await prisma.adminFullAuditLog.create({
    data: {
      adminId: data.adminId,
      adminEmail: data.adminEmail,
      adminRole: data.adminRole,
      actionCategory: data.actionCategory,
      actionType: data.actionType,
      actionSeverity: data.actionSeverity || "normal",
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      targetUserId: data.targetUserId,
      targetUserType: data.targetUserType,
      targetUserName: data.targetUserName,
      beforeValue: data.beforeValue,
      afterValue: data.afterValue,
      changeDescription: data.changeDescription,
      reason: data.reason,
      metadata: data.metadata,
      ipAddress: req?.ip || req?.headers["x-forwarded-for"]?.toString().split(",")[0],
      userAgent: req?.headers["user-agent"],
      deviceFingerprint: req?.headers["x-device-fingerprint"]?.toString(),
      countryCode: req?.headers["cf-ipcountry"]?.toString(),
      requestPath: req?.path,
      requestMethod: req?.method,
      hashChain,
      isVerified: true,
    },
  });

  lastHashChain = hashChain;

  console.log(`[AdminAudit] ${data.actionCategory}:${data.actionType} by ${data.adminId}`);

  return log.id;
}

export async function logAdminLogin(
  adminId: string,
  adminEmail: string,
  adminRole: string,
  success: boolean,
  req?: Request,
  failureReason?: string
): Promise<string> {
  return createAdminAuditLog(
    {
      adminId,
      adminEmail,
      adminRole,
      actionCategory: "login",
      actionType: success ? "login_success" : "login_failed",
      actionSeverity: success ? "low" : "high",
      changeDescription: success ? "Admin logged in successfully" : `Login failed: ${failureReason}`,
      metadata: { success, failureReason },
    },
    req
  );
}

export async function logRoleChange(
  adminId: string,
  adminEmail: string,
  adminRole: string,
  targetUserId: string,
  targetUserType: string,
  oldRole: string,
  newRole: string,
  reason: string,
  req?: Request
): Promise<string> {
  return createAdminAuditLog(
    {
      adminId,
      adminEmail,
      adminRole,
      actionCategory: "user_management",
      actionType: "role_change",
      actionSeverity: "high",
      targetUserId,
      targetUserType,
      beforeValue: { role: oldRole },
      afterValue: { role: newRole },
      changeDescription: `Role changed from ${oldRole} to ${newRole}`,
      reason,
    },
    req
  );
}

export async function logKYCAction(
  adminId: string,
  adminEmail: string,
  adminRole: string,
  targetUserId: string,
  targetUserType: string,
  action: "approved" | "rejected" | "requested_update",
  reason: string,
  req?: Request
): Promise<string> {
  return createAdminAuditLog(
    {
      adminId,
      adminEmail,
      adminRole,
      actionCategory: "kyc",
      actionType: `kyc_${action}`,
      actionSeverity: action === "rejected" ? "high" : "normal",
      targetUserId,
      targetUserType,
      changeDescription: `KYC ${action}: ${reason}`,
      reason,
    },
    req
  );
}

export async function logPayoutAction(
  adminId: string,
  adminEmail: string,
  adminRole: string,
  payoutId: string,
  targetUserId: string,
  targetUserType: string,
  action: "approved" | "rejected" | "processed",
  amount: number,
  reason?: string,
  req?: Request
): Promise<string> {
  return createAdminAuditLog(
    {
      adminId,
      adminEmail,
      adminRole,
      actionCategory: "payout",
      actionType: `payout_${action}`,
      actionSeverity: action === "rejected" ? "normal" : "high",
      resourceType: "payout",
      resourceId: payoutId,
      targetUserId,
      targetUserType,
      changeDescription: `Payout ${action}: ${amount}`,
      reason,
      metadata: { amount },
    },
    req
  );
}

export async function logSettingChange(
  adminId: string,
  adminEmail: string,
  adminRole: string,
  settingKey: string,
  oldValue: any,
  newValue: any,
  reason?: string,
  req?: Request
): Promise<string> {
  return createAdminAuditLog(
    {
      adminId,
      adminEmail,
      adminRole,
      actionCategory: "settings",
      actionType: "setting_changed",
      actionSeverity: "high",
      resourceType: "setting",
      resourceId: settingKey,
      beforeValue: oldValue,
      afterValue: newValue,
      changeDescription: `Setting ${settingKey} changed`,
      reason,
    },
    req
  );
}

export async function logThresholdChange(
  adminId: string,
  adminEmail: string,
  adminRole: string,
  thresholdType: string,
  oldValue: number,
  newValue: number,
  reason?: string,
  req?: Request
): Promise<string> {
  return createAdminAuditLog(
    {
      adminId,
      adminEmail,
      adminRole,
      actionCategory: "settings",
      actionType: "threshold_changed",
      actionSeverity: "high",
      resourceType: "threshold",
      resourceId: thresholdType,
      beforeValue: { value: oldValue },
      afterValue: { value: newValue },
      changeDescription: `Threshold ${thresholdType} changed from ${oldValue} to ${newValue}`,
      reason,
    },
    req
  );
}

export async function logFraudOverride(
  adminId: string,
  adminEmail: string,
  adminRole: string,
  targetUserId: string,
  targetUserType: string,
  action: "cleared" | "restricted" | "score_adjusted",
  beforeScore: number,
  afterScore: number,
  reason: string,
  req?: Request
): Promise<string> {
  return createAdminAuditLog(
    {
      adminId,
      adminEmail,
      adminRole,
      actionCategory: "fraud",
      actionType: `fraud_${action}`,
      actionSeverity: "critical",
      targetUserId,
      targetUserType,
      beforeValue: { fraudScore: beforeScore },
      afterValue: { fraudScore: afterScore },
      changeDescription: `Fraud score ${action}: ${beforeScore} -> ${afterScore}`,
      reason,
    },
    req
  );
}

export async function logSettlementOverride(
  adminId: string,
  adminEmail: string,
  adminRole: string,
  settlementId: string,
  targetUserId: string,
  targetUserType: string,
  action: string,
  amount: number,
  reason: string,
  req?: Request
): Promise<string> {
  return createAdminAuditLog(
    {
      adminId,
      adminEmail,
      adminRole,
      actionCategory: "settlement",
      actionType: `settlement_${action}`,
      actionSeverity: "critical",
      resourceType: "settlement",
      resourceId: settlementId,
      targetUserId,
      targetUserType,
      changeDescription: `Settlement ${action}: ${amount}`,
      reason,
      metadata: { amount },
    },
    req
  );
}

export async function verifyAuditLogIntegrity(): Promise<{
  verified: boolean;
  totalLogs: number;
  issues: string[];
}> {
  const logs = await prisma.adminFullAuditLog.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      hashChain: true,
      adminId: true,
      actionType: true,
      createdAt: true,
    },
  });

  const issues: string[] = [];

  for (let i = 0; i < logs.length; i++) {
    if (!logs[i].hashChain) {
      issues.push(`Log ${logs[i].id} missing hash chain`);
    }
  }

  return {
    verified: issues.length === 0,
    totalLogs: logs.length,
    issues,
  };
}

export const adminAuditMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;

  if (user && req.path.startsWith("/api/admin")) {
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const sensitiveActions = ["approve", "reject", "delete", "update", "create", "block", "unblock"];
        const isSensitive = sensitiveActions.some((action) =>
          req.path.toLowerCase().includes(action) || req.method !== "GET"
        );

        if (isSensitive && req.method !== "GET") {
          createAdminAuditLog(
            {
              adminId: user.id,
              adminEmail: user.email,
              adminRole: user.role,
              actionCategory: "api_call",
              actionType: `${req.method.toLowerCase()}_${req.path.split("/").slice(-2).join("_")}`,
              actionSeverity: "normal",
              changeDescription: `API call: ${req.method} ${req.path}`,
              metadata: { statusCode: res.statusCode },
            },
            req
          ).catch((err) => console.warn("[AdminAudit] Failed to log:", err));
        }
      }

      return originalJson(body);
    };
  }

  next();
};
