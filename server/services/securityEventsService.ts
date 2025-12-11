import { prisma } from '../db';

export enum SecurityEventCategory {
  AUTHENTICATION = 'authentication',
  ACCESS_CONTROL = 'access_control',
  DATA_ACCESS = 'data_access',
  ADMIN_OPERATIONS = 'admin_operations'
}

export enum SecurityEventSeverity {
  INFO = 'info',
  WARN = 'warn',
  HIGH = 'high'
}

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  category: SecurityEventCategory;
  severity: SecurityEventSeverity;
  actorEmail: string;
  actorRole: string;
  actionType: string;
  description: string;
  ipAddress: string | null;
  entityType: string;
  entityId: string | null;
  metadata: any;
  success: boolean;
}

export interface SecurityEventsQuery {
  dateFrom?: Date;
  dateTo?: Date;
  category?: SecurityEventCategory;
  actorEmail?: string;
  severity?: SecurityEventSeverity;
  limit?: number;
  offset?: number;
}

const SECURITY_ACTION_TYPES = {
  authentication: [
    'LOGIN_FAILED',
    'LOGIN_SUCCESS',
    'LOGIN_RATE_LIMITED',
    'ADMIN_2FA_FAILED',
    'ADMIN_2FA_RECOVERY_FAILED',
    'ADMIN_2FA_RECOVERY_USED',
    'LOGOUT'
  ],
  access_control: [
    'UNAUTHORIZED_ACCESS',
    'PERMISSION_DENIED',
    'RBAC_VIOLATION',
    'ADMIN_ACCESS_DENIED'
  ],
  data_access: [
    'DOCUMENT_DOWNLOAD',
    'SENSITIVE_DATA_ACCESS',
    'KYC_DOCUMENT_VIEW',
    'PAYOUT_ACCOUNT_VIEW'
  ],
  admin_operations: [
    'APPROVAL_REQUEST_CREATED',
    'APPROVAL_REQUEST_REJECTED',
    'PAYOUT_APPROVED',
    'PAYOUT_REJECTED',
    'WALLET_MANUAL_ADJUSTMENT',
    'SETTINGS_CHANGED',
    'ADMIN_2FA_DISABLED',
    'ADMIN_SESSION_REVOKED'
  ]
};

function categorizeEvent(actionType: string): SecurityEventCategory | null {
  for (const [category, types] of Object.entries(SECURITY_ACTION_TYPES)) {
    if (types.includes(actionType)) {
      return category as SecurityEventCategory;
    }
  }
  return null;
}

function determineSeverity(actionType: string, success: boolean): SecurityEventSeverity {
  if (!success) {
    if (actionType.includes('RATE_LIMITED') || actionType.includes('FAILED')) {
      return SecurityEventSeverity.WARN;
    }
    if (actionType.includes('DENIED') || actionType.includes('VIOLATION')) {
      return SecurityEventSeverity.HIGH;
    }
  }
  
  if (actionType.includes('MANUAL_ADJUSTMENT') || actionType.includes('SETTINGS_CHANGED')) {
    return SecurityEventSeverity.WARN;
  }
  
  if (actionType.includes('2FA_DISABLED') || actionType.includes('SESSION_REVOKED')) {
    return SecurityEventSeverity.HIGH;
  }

  return SecurityEventSeverity.INFO;
}

function buildSeverityFilter(severity: SecurityEventSeverity): any[] {
  const conditions: any[] = [];

  if (severity === SecurityEventSeverity.HIGH) {
    // Mirror determineSeverity logic exactly
    conditions.push(
      { AND: [{ success: false }, { actionType: { contains: 'DENIED' } }] },
      { AND: [{ success: false }, { actionType: { contains: 'VIOLATION' } }] },
      { actionType: { contains: '2FA_DISABLED' } },
      { actionType: { contains: 'SESSION_REVOKED' } }
    );
  } else if (severity === SecurityEventSeverity.WARN) {
    // Mirror determineSeverity logic exactly
    conditions.push(
      { AND: [{ success: false }, { actionType: { contains: 'RATE_LIMITED' } }] },
      { AND: [{ success: false }, { actionType: { contains: 'FAILED' } }] },
      { actionType: { contains: 'MANUAL_ADJUSTMENT' } },
      { actionType: { contains: 'SETTINGS_CHANGED' } }
    );
  } else if (severity === SecurityEventSeverity.INFO) {
    // INFO is everything that's NOT HIGH or WARN
    // Must exactly mirror the negation of determineSeverity's HIGH and WARN logic
    const notHighOrWarn = {
      AND: [
        // NOT HIGH conditions
        { NOT: { AND: [{ success: false }, { actionType: { contains: 'DENIED' } }] } },
        { NOT: { AND: [{ success: false }, { actionType: { contains: 'VIOLATION' } }] } },
        { NOT: { actionType: { contains: '2FA_DISABLED' } } },
        { NOT: { actionType: { contains: 'SESSION_REVOKED' } } },
        // NOT WARN conditions
        { NOT: { AND: [{ success: false }, { actionType: { contains: 'RATE_LIMITED' } }] } },
        { NOT: { AND: [{ success: false }, { actionType: { contains: 'FAILED' } }] } },
        { NOT: { actionType: { contains: 'MANUAL_ADJUSTMENT' } } },
        { NOT: { actionType: { contains: 'SETTINGS_CHANGED' } } }
      ]
    };
    conditions.push(notHighOrWarn);
  }

  return conditions;
}

export async function getSecurityEvents(query: SecurityEventsQuery): Promise<{
  events: SecurityEvent[];
  total: number;
}> {
  const where: any = {};

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {};
    if (query.dateFrom) {
      where.createdAt.gte = query.dateFrom;
    }
    if (query.dateTo) {
      where.createdAt.lte = query.dateTo;
    }
  }

  if (query.actorEmail) {
    where.actorEmail = query.actorEmail;
  }

  const allSecurityActionTypes = Object.values(SECURITY_ACTION_TYPES).flat();
  
  if (query.category) {
    const categoryTypes = SECURITY_ACTION_TYPES[query.category];
    where.actionType = { in: categoryTypes };
  } else {
    where.actionType = { in: allSecurityActionTypes };
  }

  // Apply severity filtering at database level for accurate pagination
  if (query.severity) {
    const severityConditions = buildSeverityFilter(query.severity);
    if (severityConditions.length > 0) {
      where.OR = severityConditions;
    }
  }

  const [auditLogs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit || 100,
      skip: query.offset || 0
    }),
    prisma.auditLog.count({ where })
  ]);

  const events: SecurityEvent[] = auditLogs
    .map(log => {
      const category = categorizeEvent(log.actionType);
      if (!category) return null;

      const severity = determineSeverity(log.actionType, log.success);

      return {
        id: log.id,
        timestamp: log.createdAt,
        category,
        severity,
        actorEmail: log.actorEmail,
        actorRole: log.actorRole,
        actionType: log.actionType,
        description: log.description,
        ipAddress: log.ipAddress,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata,
        success: log.success
      };
    })
    .filter((event): event is SecurityEvent => event !== null);

  // Now total accurately reflects the severity filter
  return {
    events,
    total
  };
}

export async function getSecurityEventsSummary(hours: number = 24): Promise<{
  highSeverityCount: number;
  loginFailuresCount: number;
  rateLimitedCount: number;
}> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const [highSeverityLogs, loginFailures, rateLimited] = await Promise.all([
    prisma.auditLog.count({
      where: {
        createdAt: { gte: since },
        success: false,
        OR: [
          { actionType: { contains: 'DENIED' } },
          { actionType: { contains: 'VIOLATION' } },
          { actionType: { contains: '2FA_DISABLED' } }
        ]
      }
    }),
    prisma.auditLog.count({
      where: {
        createdAt: { gte: since },
        actionType: 'LOGIN_FAILED'
      }
    }),
    prisma.auditLog.count({
      where: {
        createdAt: { gte: since },
        actionType: 'LOGIN_RATE_LIMITED'
      }
    })
  ]);

  return {
    highSeverityCount: highSeverityLogs,
    loginFailuresCount: loginFailures,
    rateLimitedCount: rateLimited
  };
}
