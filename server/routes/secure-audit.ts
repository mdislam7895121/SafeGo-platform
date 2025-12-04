import { Router, Response } from 'express';
import { authenticateToken, requireRole, type AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import {
  queryAuditLog,
  getAuditLogStats,
  verifyAuditLogIntegrity,
  type AuditEventCategory,
  type AuditSeverity
} from '../services/tamperProofAuditService';
import { logAdminAction } from '../services/tamperProofAuditService';
import { format } from 'date-fns';

const router = Router();

function formatDateForExport(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}

function escapeCSVField(field: string | null | undefined): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function getAdminEmail(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  });
  return user?.email || 'unknown';
}

router.get(
  '/audit-log',
  authenticateToken,
  requireRole(['admin']),
  async (req: AuthRequest, res) => {
    try {
      const {
        category,
        severity,
        actorId,
        entityType,
        entityId,
        action,
        startDate,
        endDate,
        limit,
        offset
      } = req.query;

      const email = await getAdminEmail(req.user!.userId);

      logAdminAction(
        req,
        req.user!.userId,
        email,
        'VIEW_AUDIT_LOG',
        'audit_log',
        null,
        'Admin accessed tamper-proof audit log',
        { queryParams: req.query }
      );

      const result = queryAuditLog({
        category: category as AuditEventCategory | undefined,
        severity: severity as AuditSeverity | undefined,
        actorId: actorId as string | undefined,
        entityType: entityType as string | undefined,
        entityId: entityId as string | undefined,
        action: action as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string, 10) : 100,
        offset: offset ? parseInt(offset as string, 10) : 0
      });

      res.json({
        entries: result.entries,
        total: result.total,
        limit: limit ? parseInt(limit as string, 10) : 100,
        offset: offset ? parseInt(offset as string, 10) : 0
      });
    } catch (error: any) {
      console.error('Error querying audit log:', error);
      res.status(500).json({ error: 'Failed to query audit log' });
    }
  }
);

router.get(
  '/audit-log/stats',
  authenticateToken,
  requireRole(['admin']),
  async (req: AuthRequest, res) => {
    try {
      const email = await getAdminEmail(req.user!.userId);

      logAdminAction(
        req,
        req.user!.userId,
        email,
        'VIEW_AUDIT_STATS',
        'audit_log',
        null,
        'Admin viewed audit log statistics'
      );

      const stats = getAuditLogStats();

      res.json(stats);
    } catch (error: any) {
      console.error('Error getting audit stats:', error);
      res.status(500).json({ error: 'Failed to get audit statistics' });
    }
  }
);

router.get(
  '/audit-log/verify',
  authenticateToken,
  requireRole(['admin']),
  async (req: AuthRequest, res) => {
    try {
      const email = await getAdminEmail(req.user!.userId);

      logAdminAction(
        req,
        req.user!.userId,
        email,
        'VERIFY_AUDIT_INTEGRITY',
        'audit_log',
        null,
        'Admin verified audit log integrity'
      );

      const result = verifyAuditLogIntegrity();

      res.json({
        valid: result.valid,
        lastValidSequence: result.lastValidSequence,
        errors: result.errors,
        verifiedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error verifying audit integrity:', error);
      res.status(500).json({ error: 'Failed to verify audit log integrity' });
    }
  }
);

router.get(
  '/audit-log/categories',
  authenticateToken,
  requireRole(['admin']),
  async (_req: AuthRequest, res) => {
    res.json({
      categories: [
        'ADMIN_ACTION',
        'PAYOUT_CHANGE',
        'KYC_EVENT',
        'SUPPORT_EVENT',
        'AUTH_EVENT',
        'SECURITY_EVENT',
        'DATA_ACCESS'
      ],
      severities: ['INFO', 'WARNING', 'CRITICAL']
    });
  }
);

router.get(
  '/audit-log/db',
  authenticateToken,
  requireRole(['admin']),
  async (req: AuthRequest, res) => {
    try {
      const {
        actorEmail,
        actorRole,
        actionType,
        entityType,
        countryCode,
        environment,
        startDate,
        endDate,
        success,
        limit = '100',
        offset = '0'
      } = req.query;

      const email = await getAdminEmail(req.user!.userId);

      logAdminAction(
        req,
        req.user!.userId,
        email,
        'VIEW_DB_AUDIT_LOG',
        'audit_log',
        null,
        'Admin queried database audit logs',
        { queryParams: req.query }
      );

      const where: any = {};
      
      if (actorEmail) where.actorEmail = { contains: actorEmail as string, mode: 'insensitive' };
      if (actorRole) where.actorRole = actorRole as string;
      if (actionType) where.actionType = actionType as string;
      if (entityType) where.entityType = entityType as string;
      if (countryCode) where.countryCode = countryCode as string;
      if (environment) where.environment = environment as string;
      if (success !== undefined) where.success = success === 'true';
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      const [entries, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: parseInt(limit as string, 10),
          skip: parseInt(offset as string, 10),
        }),
        prisma.auditLog.count({ where })
      ]);

      res.json({
        entries,
        total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10)
      });
    } catch (error: any) {
      console.error('Error querying database audit log:', error);
      res.status(500).json({ error: 'Failed to query database audit log' });
    }
  }
);

router.get(
  '/audit-log/export',
  authenticateToken,
  requireRole(['admin']),
  async (req: AuthRequest, res) => {
    try {
      const {
        format: exportFormat = 'json',
        actorEmail,
        actorRole,
        actionType,
        entityType,
        countryCode,
        environment,
        startDate,
        endDate,
        success,
        limit = '10000'
      } = req.query;

      const email = await getAdminEmail(req.user!.userId);

      logAdminAction(
        req,
        req.user!.userId,
        email,
        'EXPORT_AUDIT_LOG',
        'audit_log',
        null,
        `Admin exported audit logs in ${exportFormat} format`,
        { queryParams: req.query }
      );

      const where: any = {};
      
      if (actorEmail) where.actorEmail = { contains: actorEmail as string, mode: 'insensitive' };
      if (actorRole) where.actorRole = actorRole as string;
      if (actionType) where.actionType = actionType as string;
      if (entityType) where.entityType = entityType as string;
      if (countryCode) where.countryCode = countryCode as string;
      if (environment) where.environment = environment as string;
      if (success !== undefined) where.success = success === 'true';
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      const entries = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string, 10),
      });

      if (exportFormat === 'csv') {
        const headers = [
          'ID', 'Created At', 'Actor ID', 'Actor Email', 'Actor Role',
          'IP Address', 'User Agent', 'Country Code', 'Action Type',
          'Entity Type', 'Entity ID', 'Description', 'Success', 'Environment'
        ];
        
        const rows = entries.map((entry: any) => [
          escapeCSVField(entry.id),
          formatDateForExport(entry.createdAt),
          escapeCSVField(entry.actorId),
          escapeCSVField(entry.actorEmail),
          escapeCSVField(entry.actorRole),
          escapeCSVField(entry.ipAddress),
          escapeCSVField(entry.userAgent),
          escapeCSVField(entry.countryCode),
          escapeCSVField(entry.actionType),
          escapeCSVField(entry.entityType),
          escapeCSVField(entry.entityId),
          escapeCSVField(entry.description),
          entry.success ? 'Yes' : 'No',
          escapeCSVField(entry.environment)
        ].join(','));

        const csv = [headers.join(','), ...rows].join('\n');
        const filename = `audit-log-export-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
      } else {
        const filename = `audit-log-export-${format(new Date(), 'yyyyMMdd-HHmmss')}.json`;
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.json({
          exportedAt: new Date().toISOString(),
          totalRecords: entries.length,
          entries
        });
      }
    } catch (error: any) {
      console.error('Error exporting audit log:', error);
      res.status(500).json({ error: 'Failed to export audit log' });
    }
  }
);

router.get(
  '/audit-log/summary',
  authenticateToken,
  requireRole(['admin']),
  async (req: AuthRequest, res) => {
    try {
      const email = await getAdminEmail(req.user!.userId);

      logAdminAction(
        req,
        req.user!.userId,
        email,
        'VIEW_AUDIT_SUMMARY',
        'audit_log',
        null,
        'Admin viewed audit log summary'
      );

      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [
        total,
        last24HoursCount,
        last7DaysCount,
        byActionType,
        failedActions
      ] = await Promise.all([
        prisma.auditLog.count(),
        prisma.auditLog.count({ where: { createdAt: { gte: last24Hours } } }),
        prisma.auditLog.count({ where: { createdAt: { gte: last7Days } } }),
        prisma.auditLog.groupBy({
          by: ['actionType'],
          _count: { _all: true },
          orderBy: { _count: { actionType: 'desc' } },
          take: 10
        }),
        prisma.auditLog.count({ where: { success: false } })
      ]);

      const byCountryRaw = await prisma.$queryRaw<Array<{countryCode: string | null, count: bigint}>>`
        SELECT "countryCode", COUNT(*) as count 
        FROM audit_logs 
        WHERE "countryCode" IS NOT NULL 
        GROUP BY "countryCode" 
        ORDER BY count DESC
      `;
      
      const byEnvironmentRaw = await prisma.$queryRaw<Array<{environment: string, count: bigint}>>`
        SELECT environment, COUNT(*) as count 
        FROM audit_logs 
        GROUP BY environment
      `;

      res.json({
        total,
        last24Hours: last24HoursCount,
        last7Days: last7DaysCount,
        failedActions,
        byActionType: byActionType.map((a: any) => ({
          actionType: a.actionType,
          count: a._count._all
        })),
        byCountry: byCountryRaw.map((c: any) => ({
          countryCode: c.countryCode || 'Unknown',
          count: Number(c.count)
        })),
        byEnvironment: byEnvironmentRaw.map((e: any) => ({
          environment: e.environment,
          count: Number(e.count)
        }))
      });
    } catch (error: any) {
      console.error('Error getting audit summary:', error);
      res.status(500).json({ error: 'Failed to get audit summary' });
    }
  }
);

export default router;
