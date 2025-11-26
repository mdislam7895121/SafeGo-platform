import { Router } from 'express';
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

const router = Router();

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

export default router;
