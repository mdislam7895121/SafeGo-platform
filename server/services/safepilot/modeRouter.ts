import { runSafePilot, SafePilotMode, SafePilotResponse } from './aiEngine';
import { prisma } from '../../db';

const VALID_MODES: SafePilotMode[] = ['intel', 'context', 'chat', 'crisis', 'scan'];

export interface SafePilotScopes {
  drivers?: boolean;
  kyc?: boolean;
  fraud?: boolean;
  payouts?: boolean;
  security?: boolean;
}

export interface SafePilotSettings {
  responseMode?: 'concise' | 'detailed';
  dataWindow?: '1h' | '24h' | '7d' | '30d';
  maskPii?: boolean;
  autoSuggestFollowups?: boolean;
  readOnlyMode?: boolean;
  scopes?: SafePilotScopes;
}

export interface ModeRouterRequest {
  mode: string;
  question: string;
  userId: string;
  userRole: string;
  pageContext?: string;
  settings?: SafePilotSettings;
  ipAddress?: string;
  userAgent?: string;
}

export function isValidMode(mode: string): mode is SafePilotMode {
  return VALID_MODES.includes(mode as SafePilotMode);
}

const MODE_SCOPE_MAP: Record<SafePilotMode, keyof SafePilotScopes | null> = {
  'intel': 'fraud',
  'context': null,
  'chat': null,
  'crisis': 'security',
  'scan': 'security',
};

const SCOPE_KEYWORDS: Record<keyof SafePilotScopes, RegExp> = {
  drivers: /driver|vehicle|trip|ride|delivery|rating/i,
  kyc: /kyc|verification|identity|document|license|background/i,
  fraud: /fraud|suspicious|risk|alert|threat|chargeback|scam/i,
  payouts: /payout|payment|wallet|earning|commission|withdraw|settlement/i,
  security: /security|breach|incident|access|password|login|hack|emergency/i,
};

function checkQuestionAgainstScopes(question: string, scopes: SafePilotScopes): string | null {
  for (const [scope, pattern] of Object.entries(SCOPE_KEYWORDS)) {
    if (pattern.test(question) && scopes[scope as keyof SafePilotScopes] === false) {
      return scope;
    }
  }
  return null;
}

export async function handleSafePilotRequest(request: ModeRouterRequest): Promise<SafePilotResponse> {
  if (!isValidMode(request.mode)) {
    return {
      success: false,
      answer: '',
      traceId: `sp-invalid-${Date.now()}`,
      mode: 'chat',
      model: 'none',
      error: `Invalid mode: ${request.mode}. Valid modes are: ${VALID_MODES.join(', ')}`,
    };
  }

  const settings = request.settings || {};
  const scopes = settings.scopes || {};

  // Check mode-level scope restriction
  const requiredScope = MODE_SCOPE_MAP[request.mode];
  if (requiredScope && scopes[requiredScope] === false) {
    return {
      success: false,
      answer: `This mode (${request.mode}) requires the ${requiredScope} scope to be enabled in your SafePilot settings.`,
      traceId: `sp-scope-${Date.now()}`,
      mode: request.mode,
      model: 'none',
    };
  }

  // Check question content against disabled scopes
  const blockedScope = checkQuestionAgainstScopes(request.question, scopes);
  if (blockedScope) {
    return {
      success: false,
      answer: `Your question involves ${blockedScope} data which is currently disabled in your SafePilot settings. Please enable the ${blockedScope} scope to access this information.`,
      traceId: `sp-scope-${Date.now()}`,
      mode: request.mode,
      model: 'none',
    };
  }

  const enhancedQuestion = await enrichQuestionWithContext(request.mode, request.question);

  return runSafePilot({
    mode: request.mode,
    question: enhancedQuestion,
    userId: request.userId,
    userRole: request.userRole,
    pageContext: request.pageContext,
    ipAddress: request.ipAddress,
    userAgent: request.userAgent,
  });
}

async function enrichQuestionWithContext(mode: SafePilotMode, question: string): Promise<string> {
  const contextParts: string[] = [question];

  try {
    if (mode === 'intel' || mode === 'scan') {
      const [driverCount, pendingKyc, blockedUsers, activeIncidents] = await Promise.all([
        prisma.driverProfile.count().catch(() => 0),
        prisma.driverProfile.count({ where: { verificationStatus: 'pending' } }).catch(() => 0),
        prisma.user.count({ where: { isBlocked: true } }).catch(() => 0),
        prisma.sOSAlert.count({ where: { status: { not: 'resolved' } } }).catch(() => 0),
      ]);

      contextParts.push(`
[Real-time Platform Data]
- Total drivers: ${driverCount}
- Pending KYC verifications: ${pendingKyc}
- Blocked users: ${blockedUsers}
- Active SOS incidents: ${activeIncidents}`);
    }

    if (mode === 'crisis') {
      const [recentAlerts, activeIncidents] = await Promise.all([
        prisma.safePilotAuditLog.count({
          where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } }
        }).catch(() => 0),
        prisma.sOSAlert.count({ where: { status: { not: 'resolved' } } }).catch(() => 0),
      ]);

      contextParts.push(`
[Crisis Context]
- System alerts (last hour): ${recentAlerts}
- Active SOS incidents: ${activeIncidents}`);
    }

    if (mode === 'context') {
      const [totalUsers, totalOrders, totalRides] = await Promise.all([
        prisma.user.count().catch(() => 0),
        prisma.foodOrder.count().catch(() => 0),
        prisma.ride.count().catch(() => 0),
      ]);

      contextParts.push(`
[Platform Overview]
- Total users: ${totalUsers}
- Total food orders: ${totalOrders}
- Total rides: ${totalRides}`);
    }
  } catch (error) {
    console.error('[SafePilot] Context enrichment error:', error);
  }

  return contextParts.join('\n\n');
}

export function extractModeFromQuestion(question: string): SafePilotMode {
  const q = question.toLowerCase();
  
  if (/risk|fraud|suspicious|alert|threat|security/i.test(q)) {
    return 'intel';
  }
  if (/explain|why|what is|how does|understand|background/i.test(q)) {
    return 'context';
  }
  if (/emergency|crisis|urgent|incident|critical|outage/i.test(q)) {
    return 'crisis';
  }
  if (/audit|check|compliance|scan|verify|validate/i.test(q)) {
    return 'scan';
  }
  
  return 'chat';
}
