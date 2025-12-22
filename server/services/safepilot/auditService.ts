import { prisma } from "../../lib/prisma";
import { Role } from "./rbac";

export interface AuditLogEntry {
  id: string;
  actorUserId: string;
  actorRole: string;
  action: string;
  metadata: any;
  createdAt: Date;
}

export interface AuditLogFilters {
  actorUserId?: string;
  actorRole?: Role;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export async function getAuditLogs(filters: AuditLogFilters): Promise<{
  logs: AuditLogEntry[];
  total: number;
}> {
  const where: any = {};

  if (filters.actorUserId) where.actorUserId = filters.actorUserId;
  if (filters.actorRole) where.actorRole = filters.actorRole;
  if (filters.action) where.action = filters.action;
  
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.safePilotAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters.limit || 50,
      skip: filters.offset || 0,
    }),
    prisma.safePilotAuditLog.count({ where }),
  ]);

  return { logs, total };
}

export async function logAdminAction(
  adminId: string,
  action: "kb_upload" | "kb_disable" | "kb_reembed" | "kb_update" | "update_feature_flag" | "kill_switch_toggle",
  metadata: Record<string, any>
): Promise<void> {
  await prisma.safePilotAuditLog.create({
    data: {
      actorUserId: adminId,
      actorRole: "ADMIN",
      action,
      metadata,
    },
  });
}

export async function getAuditStats(days: number = 30): Promise<{
  totalQueries: number;
  totalAnswers: number;
  kbUploads: number;
  flaggedMessages: number;
  uniqueUsers: number;
}> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [queryCount, answerCount, kbCount, uniqueUserCount] = await Promise.all([
    prisma.safePilotAuditLog.count({
      where: {
        action: "ask",
        createdAt: { gte: since },
      },
    }),
    prisma.safePilotAuditLog.count({
      where: {
        action: "answer",
        createdAt: { gte: since },
      },
    }),
    prisma.safePilotAuditLog.count({
      where: {
        action: "kb_upload",
        createdAt: { gte: since },
      },
    }),
    prisma.safePilotAuditLog.groupBy({
      by: ["actorUserId"],
      where: {
        createdAt: { gte: since },
      },
    }),
  ]);

  const flaggedCount = await prisma.safePilotMessage.count({
    where: {
      createdAt: { gte: since },
      NOT: {
        moderationFlags: null,
      },
    },
  });

  return {
    totalQueries: queryCount,
    totalAnswers: answerCount,
    kbUploads: kbCount,
    flaggedMessages: flaggedCount,
    uniqueUsers: uniqueUserCount.length,
  };
}
