import crypto from 'crypto';
import { prisma } from '../db';
import { getClientIp } from '../utils/ip';
import { Request } from 'express';

export type AuditEventCategory = 
  | 'ADMIN_ACTION'
  | 'PAYOUT_CHANGE'
  | 'KYC_EVENT'
  | 'SUPPORT_EVENT'
  | 'AUTH_EVENT'
  | 'SECURITY_EVENT'
  | 'DATA_ACCESS';

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

interface TamperProofAuditEntry {
  id: string;
  sequence: number;
  timestamp: Date;
  category: AuditEventCategory;
  severity: AuditSeverity;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string;
  ipAddress: string;
  userAgent: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  metadata: Record<string, any>;
  previousHash: string;
  hash: string;
}

let auditLog: TamperProofAuditEntry[] = [];
let currentSequence = 0;
let lastHash = 'GENESIS_BLOCK';

const GENESIS_HASH = crypto.createHash('sha256').update('SAFEGO_AUDIT_GENESIS').digest('hex');

function initializeAuditLog(): void {
  lastHash = GENESIS_HASH;
  currentSequence = 0;
  
  console.log('[TamperProofAudit] Audit log initialized with genesis hash');
}

initializeAuditLog();

function computeEntryHash(entry: Omit<TamperProofAuditEntry, 'hash'>): string {
  const dataToHash = JSON.stringify({
    id: entry.id,
    sequence: entry.sequence,
    timestamp: entry.timestamp.toISOString(),
    category: entry.category,
    severity: entry.severity,
    actorId: entry.actorId,
    actorEmail: entry.actorEmail,
    actorRole: entry.actorRole,
    ipAddress: entry.ipAddress,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    description: entry.description,
    metadata: entry.metadata,
    previousHash: entry.previousHash
  });

  return crypto.createHash('sha256').update(dataToHash).digest('hex');
}

export function appendAuditEntry(params: {
  category: AuditEventCategory;
  severity: AuditSeverity;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string;
  ipAddress: string;
  userAgent?: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  metadata?: Record<string, any>;
}): TamperProofAuditEntry {
  currentSequence++;

  const entryWithoutHash: Omit<TamperProofAuditEntry, 'hash'> = {
    id: crypto.randomUUID(),
    sequence: currentSequence,
    timestamp: new Date(),
    category: params.category,
    severity: params.severity,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    actorRole: params.actorRole,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent || 'Unknown',
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId || null,
    description: params.description,
    metadata: params.metadata || {},
    previousHash: lastHash
  };

  const hash = computeEntryHash(entryWithoutHash);
  
  const entry: TamperProofAuditEntry = {
    ...entryWithoutHash,
    hash
  };

  auditLog.push(entry);
  lastHash = hash;

  if (params.severity === 'CRITICAL') {
    console.log(`[TamperProofAudit] CRITICAL: ${params.action} - ${params.description}`);
  }

  return entry;
}

export function verifyAuditLogIntegrity(): { 
  valid: boolean; 
  lastValidSequence: number;
  errors: string[];
} {
  const errors: string[] = [];
  let expectedPreviousHash = GENESIS_HASH;
  let lastValidSequence = 0;

  for (let i = 0; i < auditLog.length; i++) {
    const entry = auditLog[i];

    if (entry.sequence !== i + 1) {
      errors.push(`Sequence mismatch at index ${i}: expected ${i + 1}, got ${entry.sequence}`);
      break;
    }

    if (entry.previousHash !== expectedPreviousHash) {
      errors.push(`Chain broken at sequence ${entry.sequence}: previousHash mismatch`);
      break;
    }

    const { hash: _, ...entryWithoutHash } = entry;
    const recomputedHash = computeEntryHash(entryWithoutHash as Omit<TamperProofAuditEntry, 'hash'>);

    if (entry.hash !== recomputedHash) {
      errors.push(`Hash mismatch at sequence ${entry.sequence}: data may have been tampered`);
      break;
    }

    expectedPreviousHash = entry.hash;
    lastValidSequence = entry.sequence;
  }

  return {
    valid: errors.length === 0,
    lastValidSequence,
    errors
  };
}

export function queryAuditLog(params: {
  category?: AuditEventCategory;
  severity?: AuditSeverity;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  action?: string;
  limit?: number;
  offset?: number;
}): { entries: TamperProofAuditEntry[]; total: number } {
  let filtered = [...auditLog];

  if (params.category) {
    filtered = filtered.filter(e => e.category === params.category);
  }
  if (params.severity) {
    filtered = filtered.filter(e => e.severity === params.severity);
  }
  if (params.actorId) {
    filtered = filtered.filter(e => e.actorId === params.actorId);
  }
  if (params.entityType) {
    filtered = filtered.filter(e => e.entityType === params.entityType);
  }
  if (params.entityId) {
    filtered = filtered.filter(e => e.entityId === params.entityId);
  }
  if (params.action) {
    const action = params.action;
    filtered = filtered.filter(e => e.action.includes(action));
  }
  if (params.startDate) {
    filtered = filtered.filter(e => e.timestamp >= params.startDate!);
  }
  if (params.endDate) {
    filtered = filtered.filter(e => e.timestamp <= params.endDate!);
  }

  const total = filtered.length;

  filtered.sort((a, b) => b.sequence - a.sequence);

  const offset = params.offset || 0;
  const limit = params.limit || 100;
  filtered = filtered.slice(offset, offset + limit);

  return { entries: filtered, total };
}

export function getAuditLogStats(): {
  totalEntries: number;
  entriesByCategory: Record<AuditEventCategory, number>;
  entriesBySeverity: Record<AuditSeverity, number>;
  integrityStatus: { valid: boolean; lastValidSequence: number };
} {
  const entriesByCategory: Record<AuditEventCategory, number> = {
    ADMIN_ACTION: 0,
    PAYOUT_CHANGE: 0,
    KYC_EVENT: 0,
    SUPPORT_EVENT: 0,
    AUTH_EVENT: 0,
    SECURITY_EVENT: 0,
    DATA_ACCESS: 0
  };

  const entriesBySeverity: Record<AuditSeverity, number> = {
    INFO: 0,
    WARNING: 0,
    CRITICAL: 0
  };

  auditLog.forEach(entry => {
    entriesByCategory[entry.category]++;
    entriesBySeverity[entry.severity]++;
  });

  const integrity = verifyAuditLogIntegrity();

  return {
    totalEntries: auditLog.length,
    entriesByCategory,
    entriesBySeverity,
    integrityStatus: {
      valid: integrity.valid,
      lastValidSequence: integrity.lastValidSequence
    }
  };
}

export function logAdminAction(
  req: Request,
  actorId: string,
  actorEmail: string,
  action: string,
  entityType: string,
  entityId: string | null,
  description: string,
  metadata?: Record<string, any>
): TamperProofAuditEntry {
  return appendAuditEntry({
    category: 'ADMIN_ACTION',
    severity: 'WARNING',
    actorId,
    actorEmail,
    actorRole: 'admin',
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'],
    action,
    entityType,
    entityId,
    description,
    metadata
  });
}

export function logPayoutChange(
  req: Request,
  actorId: string,
  actorEmail: string,
  actorRole: string,
  action: string,
  methodId: string,
  description: string,
  metadata?: Record<string, any>
): TamperProofAuditEntry {
  return appendAuditEntry({
    category: 'PAYOUT_CHANGE',
    severity: 'CRITICAL',
    actorId,
    actorEmail,
    actorRole,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'],
    action,
    entityType: 'payout_method',
    entityId: methodId,
    description,
    metadata
  });
}

export function logKycEvent(
  req: Request,
  actorId: string,
  actorEmail: string,
  actorRole: string,
  action: string,
  userId: string,
  description: string,
  metadata?: Record<string, any>
): TamperProofAuditEntry {
  return appendAuditEntry({
    category: 'KYC_EVENT',
    severity: action.includes('REJECT') ? 'WARNING' : 'INFO',
    actorId,
    actorEmail,
    actorRole,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'],
    action,
    entityType: 'kyc_document',
    entityId: userId,
    description,
    metadata
  });
}

export function logSupportEvent(
  req: Request,
  actorId: string,
  actorEmail: string,
  actorRole: string,
  action: string,
  ticketId: string,
  description: string,
  metadata?: Record<string, any>
): TamperProofAuditEntry {
  return appendAuditEntry({
    category: 'SUPPORT_EVENT',
    severity: 'INFO',
    actorId,
    actorEmail,
    actorRole,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'],
    action,
    entityType: 'support_ticket',
    entityId: ticketId,
    description,
    metadata
  });
}

export function logAuthEvent(
  req: Request,
  actorId: string | null,
  actorEmail: string | null,
  actorRole: string,
  action: string,
  success: boolean,
  description: string,
  metadata?: Record<string, any>
): TamperProofAuditEntry {
  return appendAuditEntry({
    category: 'AUTH_EVENT',
    severity: success ? 'INFO' : 'WARNING',
    actorId,
    actorEmail,
    actorRole,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'],
    action,
    entityType: 'auth',
    entityId: actorId,
    description,
    metadata: { ...metadata, success }
  });
}

export function logSecurityEvent(
  req: Request,
  actorId: string | null,
  actorEmail: string | null,
  actorRole: string,
  action: string,
  severity: AuditSeverity,
  description: string,
  metadata?: Record<string, any>
): TamperProofAuditEntry {
  return appendAuditEntry({
    category: 'SECURITY_EVENT',
    severity,
    actorId,
    actorEmail,
    actorRole,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'],
    action,
    entityType: 'security',
    entityId: null,
    description,
    metadata
  });
}
