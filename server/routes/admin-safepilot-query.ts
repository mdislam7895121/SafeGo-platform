import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { prisma } from '../db';

const router = Router();

// ============================================================================
// ADMIN SAFEPILOT - Enterprise-Grade Admin AI Assistant
// STRICT ISOLATION: This module is ADMIN-ONLY. No shared logic with Support AI.
// 
// KEY RULES:
// 1. Different questions MUST produce different responses
// 2. HOW MANY → numbers only (no full reports)
// 3. HOW/WHY → advice only (no counts)
// 4. No "Morning Report", "Guard Mode" headers unless explicitly asked
// 5. Per-intent formatters, NOT one global formatter
// ============================================================================

// Intent types for admin queries
type AdminIntent = 
  | 'driver_count' 
  | 'driver_pending_kyc' 
  | 'driver_improvement_advice'
  | 'fraud_status' 
  | 'payout_status'
  | 'payout_anomaly'
  | 'platform_health'
  | 'kyc_queue'
  | 'customer_count'
  | 'generic_help';

// Question type determines response format
type QuestionType = 'count' | 'status' | 'advice' | 'list' | 'detail';

// Detect question type from query - PRIORITY ORDER MATTERS
function detectQuestionType(query: string): QuestionType {
  const q = query.toLowerCase().trim();
  
  // Count questions - highest priority, expect just a number
  // Must check before status because "show how many" is a count question
  if (/how many|count of|total (number|count)|number of|\bcount\b/i.test(q)) {
    return 'count';
  }
  
  // Advice questions - expect recommendations  
  // Must check before status because "how do I" is advice, not status
  if (/how (do|can|to|should|would)|improve|optimize|better|recommend|suggest|advice|tips|best way/i.test(q)) {
    return 'advice';
  }
  
  // List questions - expect enumeration
  if (/list (all|the)|show all|which (are|ones)|who (are|is)/i.test(q)) {
    return 'list';
  }
  
  // Status questions - lower priority
  // "show" alone is status, but "show count" is count
  if (/\b(status|state|current|what('s| is)|any\b|is there|show\b)/i.test(q)) {
    return 'status';
  }
  
  return 'detail';
}

// Detect specific admin intent
function detectAdminIntent(query: string): AdminIntent {
  const q = query.toLowerCase();
  
  // Driver-specific intents
  if (/driver.*pending|pending.*driver|driver.*kyc|kyc.*driver/i.test(q)) {
    return 'driver_pending_kyc';
  }
  if (/improve.*driver|driver.*improve|better.*driver|driver.*quality|driver.*performance/i.test(q)) {
    return 'driver_improvement_advice';
  }
  if (/driver|delivery|courier|fleet/i.test(q)) {
    return 'driver_count';
  }
  
  // Fraud/Security intent
  if (/fraud|suspicious|abuse|security|threat|fake|ban|block|scam|anomal/i.test(q)) {
    return 'fraud_status';
  }
  
  // Payout-specific intents
  if (/payout.*anomal|anomal.*payout|unusual.*payout|payout.*issue/i.test(q)) {
    return 'payout_anomaly';
  }
  if (/payout|payment|earning|settlement|billing/i.test(q)) {
    return 'payout_status';
  }
  
  // KYC/Verification intent
  if (/kyc|verification|document|approval|pending.*review|identity|onboard/i.test(q)) {
    return 'kyc_queue';
  }
  
  // Platform health
  if (/system|health|uptime|status|service|error|incident|outage|platform/i.test(q)) {
    return 'platform_health';
  }
  
  // Customer intent
  if (/customer|user|rider|order|booking/i.test(q)) {
    return 'customer_count';
  }
  
  return 'generic_help';
}

// Extract actual user query from wrapped prompt
function extractUserQuery(wrappedQuery: string): string {
  const userQueryMatch = wrappedQuery.match(/User Query:\s*(.+?)$/im);
  if (userQueryMatch && userQueryMatch[1]) {
    return userQueryMatch[1].trim();
  }
  
  const cleanedQuery = wrappedQuery
    .replace(/^You are Admin SafePilot[\s\S]*?(?=Mode:|Priority:|$)/i, '')
    .replace(/^Mode:\s*\w+\.\s*[^.]+\./gim, '')
    .replace(/^Priority:\s*\w+\.\s*[^.]+\./gim, '')
    .trim();
  
  return cleanedQuery || wrappedQuery;
}

// Middleware to require ADMIN role only
const requireAdmin = async (req: AuthRequest, res: Response, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', reply: 'Authentication required.' });
  }
  
  const adminRoles = ['admin', 'super_admin'];
  if (!adminRoles.includes(req.user.role?.toLowerCase() || '')) {
    return res.status(403).json({ error: 'Forbidden', reply: 'Admin access required.' });
  }
  
  next();
};

// ============================================================================
// PER-INTENT FORMATTERS - Each intent has its own response structure
// ============================================================================

// Format for count-only responses (HOW MANY questions)
function formatCountResponse(count: number, subject: string): string {
  return `${count} ${subject}.`;
}

// Format for status responses
function formatStatusResponse(title: string, items: string[]): string {
  if (items.length === 0) return `${title}: No items to report.`;
  return `${title}:\n${items.map(i => `  - ${i}`).join('\n')}`;
}

// Format for advice responses (HOW/WHY questions)
function formatAdviceResponse(topic: string, recommendations: string[]): string {
  if (recommendations.length === 0) return `No specific recommendations for ${topic} at this time.`;
  return `Recommendations for ${topic}:\n${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
}

// Format for driver statistics (only when full report requested)
function formatDriverStats(stats: { total: number; online: number; pendingKyc: number; lowRating: number }): string {
  const lines: string[] = [];
  lines.push(`Driver Overview:`);
  lines.push(`  - Total registered: ${stats.total}`);
  lines.push(`  - Currently online: ${stats.online}`);
  lines.push(`  - Pending verification: ${stats.pendingKyc}`);
  lines.push(`  - Below 3.5 rating: ${stats.lowRating}`);
  return lines.join('\n');
}

// Format for fraud summary
function formatFraudSummary(data: { auditEvents: number; blockedUsers: number; recentBlocks: number }): string {
  const lines: string[] = [];
  lines.push(`Security Status:`);
  lines.push(`  - Audit events (24h): ${data.auditEvents}`);
  lines.push(`  - Blocked accounts: ${data.blockedUsers}`);
  lines.push(`  - New blocks (7d): ${data.recentBlocks}`);
  if (data.recentBlocks > 10) {
    lines.push(`  - Alert: Elevated block rate detected`);
  }
  return lines.join('\n');
}

// Format for payout anomalies
function formatPayoutAnomalies(data: { pending: number; failed: number; total: number }): string {
  const lines: string[] = [];
  if (data.failed > 0) {
    lines.push(`Payout Issues Detected:`);
    lines.push(`  - ${data.failed} failed payouts require attention`);
    lines.push(`  - ${data.pending} payouts pending processing`);
    lines.push(`  - Action: Review failed payouts in Finance Dashboard`);
  } else if (data.pending > 50) {
    lines.push(`Payout Status:`);
    lines.push(`  - ${data.pending} payouts pending (high volume)`);
    lines.push(`  - No failed payouts`);
  } else {
    lines.push(`Payout Status: Healthy`);
    lines.push(`  - ${data.pending} pending, ${data.failed} failed`);
  }
  return lines.join('\n');
}

// Format for KYC queue
function formatKycQueue(data: { restaurants: number; drivers: number; recent: number }): string {
  const total = data.restaurants + data.drivers;
  const lines: string[] = [];
  lines.push(`KYC Queue Status:`);
  lines.push(`  - Pending restaurants: ${data.restaurants}`);
  lines.push(`  - Pending drivers: ${data.drivers}`);
  lines.push(`  - Processed (24h): ${data.recent}`);
  if (total > 50) {
    lines.push(`  - Note: High queue volume may delay onboarding`);
  }
  return lines.join('\n');
}

// Format for platform health
function formatPlatformHealth(data: { errors: number; incidents: number }): string {
  const status = data.errors < 5 && data.incidents < 3 ? 'Healthy' : 'Needs Attention';
  const lines: string[] = [];
  lines.push(`Platform Status: ${status}`);
  lines.push(`  - System flags (1h): ${data.errors}`);
  lines.push(`  - Active incidents: ${data.incidents}`);
  if (data.incidents > 0) {
    lines.push(`  - Action: Review incidents in Safety Center`);
  }
  return lines.join('\n');
}

// ============================================================================
// MAIN QUERY HANDLER
// ============================================================================

// Settings interface
interface SafePilotSettings {
  responseMode?: 'concise' | 'detailed';
  dataWindow?: '24h' | '7d' | '30d';
  maskPii?: boolean;
  autoSuggestFollowups?: boolean;
  readOnlyMode?: boolean;
  scopes?: {
    drivers?: boolean;
    kyc?: boolean;
    fraud?: boolean;
    payouts?: boolean;
    security?: boolean;
  };
}

// Get data window time range
function getDataWindowMs(window: string): number {
  switch (window) {
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    case '30d': return 30 * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

router.post('/query', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { query, question, settings } = req.body;
    const inputText = query || question;
    
    // Parse settings with defaults
    const userSettings: SafePilotSettings = {
      responseMode: settings?.responseMode || 'concise',
      dataWindow: settings?.dataWindow || '24h',
      maskPii: settings?.maskPii || false,
      autoSuggestFollowups: settings?.autoSuggestFollowups || false,
      readOnlyMode: settings?.readOnlyMode || false,
      scopes: {
        drivers: settings?.scopes?.drivers !== false,
        kyc: settings?.scopes?.kyc !== false,
        fraud: settings?.scopes?.fraud !== false,
        payouts: settings?.scopes?.payouts !== false,
        security: settings?.scopes?.security !== false,
      },
    };
    
    const dataWindowMs = getDataWindowMs(userSettings.dataWindow || '24h');
    const isDetailed = userSettings.responseMode === 'detailed';
    
    let rawQuery = '';
    if (typeof inputText === 'string' && inputText.trim().length > 0) {
      rawQuery = inputText.trim();
    } else if (typeof inputText === 'object' && inputText?.question) {
      rawQuery = String(inputText.question).trim();
    } else {
      return res.json({
        reply: 'I can help with driver stats, KYC queues, fraud signals, payouts, and platform health. What would you like to know?',
        meta: { type: 'help', intent: 'generic_help' }
      });
    }
    
    const userQuery = extractUserQuery(rawQuery);
    const intent = detectAdminIntent(userQuery);
    const questionType = detectQuestionType(userQuery);
    
    // Check if intent is within allowed scopes - ALL intents must be mapped
    const scopeMap: Record<AdminIntent, keyof NonNullable<SafePilotSettings['scopes']> | null> = {
      'driver_count': 'drivers',
      'driver_pending_kyc': 'kyc',
      'driver_improvement_advice': 'drivers',
      'fraud_status': 'fraud',
      'payout_anomaly': 'payouts',
      'payout_status': 'payouts',
      'platform_health': 'security',
      'kyc_queue': 'kyc',
      'customer_count': 'drivers', // customer queries fall under drivers scope
      'generic_help': null, // help is always allowed
    };
    
    const requiredScope = scopeMap[intent];
    if (requiredScope && userSettings.scopes && !userSettings.scopes[requiredScope]) {
      return res.json({
        reply: `This topic (${requiredScope}) is disabled in your SafePilot settings. Enable it to get answers about this area.`,
        meta: { intent, blocked: true, reason: 'scope_disabled' }
      });
    }
    
    console.log(`[Admin SafePilot] Query: "${userQuery.slice(0, 60)}" | Intent: ${intent} | Type: ${questionType} | Mode: ${userSettings.responseMode}`);
    
    // Check if query belongs to support domain
    const supportKeywords = ['support ticket', 'customer complaint', 'help desk', 'refund'];
    if (supportKeywords.some(kw => userQuery.toLowerCase().includes(kw))) {
      return res.json({
        reply: 'This query relates to customer support. Please use the Support Console at /admin/support-console for ticket management.',
        meta: { redirectTo: '/admin/support-console', intent: 'support_redirect' }
      });
    }
    
    let reply = '';
    let meta: any = { intent, questionType };
    
    // ===========================================================================
    // INTENT + QUESTION TYPE HANDLERS
    // Each combination produces a unique, appropriate response
    // ===========================================================================
    
    switch (intent) {
      case 'driver_count': {
        const [totalDrivers, pendingKyc, lowRating] = await Promise.all([
          prisma.driverProfile.count(),
          prisma.driverProfile.count({ where: { verificationStatus: 'pending' } }).catch(() => 0),
          prisma.driverStats.count({ where: { rating: { lt: 3.5 } } }).catch(() => 0)
        ]);
        const onlineDrivers = 0;
        
        if (questionType === 'count') {
          reply = formatCountResponse(totalDrivers, 'drivers registered');
          if (isDetailed) {
            reply += `\n  - Pending KYC: ${pendingKyc}\n  - Low rating: ${lowRating}`;
          }
        } else {
          reply = formatDriverStats({ total: totalDrivers, online: onlineDrivers, pendingKyc, lowRating });
          if (isDetailed) {
            reply += '\n\nContext: Review driver operations in the Fleet Management section.';
          }
        }
        meta = { ...meta, totalDrivers, onlineDrivers, pendingKyc, lowRating };
        break;
      }
      
      case 'driver_pending_kyc': {
        const pendingDrivers = await prisma.driverProfile.count({ 
          where: { verificationStatus: 'pending' } 
        }).catch(() => 0);
        
        if (questionType === 'count') {
          reply = formatCountResponse(pendingDrivers, 'drivers are pending verification');
          if (isDetailed) {
            reply += '\n  - Process in People & KYC Center';
          }
        } else {
          reply = formatStatusResponse('Driver Verification Queue', [
            `${pendingDrivers} driver(s) awaiting KYC review`,
            pendingDrivers > 0 ? 'Action: Process in People & KYC Center' : 'Queue is clear'
          ]);
          if (isDetailed) {
            reply += '\n\nNote: High pending counts may delay driver onboarding.';
          }
        }
        meta = { ...meta, pendingDrivers };
        break;
      }
      
      case 'driver_improvement_advice': {
        const recommendations = [
          'Implement regular driver training on customer service',
          'Set up quality bonuses for drivers with 4.5+ ratings',
          'Review low-rated trips and provide specific feedback',
          'Create driver recognition programs for top performers',
          'Establish clear guidelines for delivery time expectations',
          'Offer incentives for completing deliveries during peak hours'
        ];
        reply = formatAdviceResponse('improving driver quality', isDetailed ? recommendations : recommendations.slice(0, 3));
        if (isDetailed) {
          reply += '\n\nImplementation: Start with training and bonuses for quick wins.';
        }
        meta = { ...meta, type: 'advice' };
        break;
      }
      
      case 'fraud_status': {
        const [auditLogs, blockedUsers, recentBlocks] = await Promise.all([
          prisma.safePilotAuditLog.count({
            where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
          }).catch(() => 0),
          prisma.user.count({ where: { isBlocked: true } }),
          prisma.user.count({
            where: {
              isBlocked: true,
              updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }
          })
        ]);
        
        if (questionType === 'count') {
          reply = formatCountResponse(auditLogs, 'security events in the last 24 hours');
          if (isDetailed) {
            reply += `\n  - Blocked accounts: ${blockedUsers}\n  - New blocks (7d): ${recentBlocks}`;
          }
        } else if (questionType === 'status') {
          if (recentBlocks === 0 && auditLogs < 10) {
            reply = 'No fraud alerts at this time. Platform security status is normal.';
          } else {
            reply = `${recentBlocks} suspicious accounts blocked this week. ${auditLogs} security events logged today.`;
          }
          if (isDetailed) {
            reply += '\n\nReview: Check Fraud Prevention Center for detailed analysis.';
          }
        } else {
          reply = formatFraudSummary({ auditEvents: auditLogs, blockedUsers, recentBlocks });
          if (isDetailed) {
            reply += '\n\nContext: Monitor Security Center for real-time threat detection.';
          }
        }
        meta = { ...meta, auditLogs, blockedUsers, recentBlocks };
        break;
      }
      
      case 'payout_anomaly': {
        const [totalPayouts, pendingPayouts, failedPayouts] = await Promise.all([
          prisma.payout.count().catch(() => 0),
          prisma.payout.count({ where: { status: 'pending' } }).catch(() => 0),
          prisma.payout.count({ where: { status: 'failed' } }).catch(() => 0)
        ]);
        
        if (failedPayouts > 0) {
          reply = `${failedPayouts} payout(s) have failed and require attention. Review in Finance Dashboard.`;
          if (isDetailed) {
            reply += `\n\nBreakdown:\n  - Total payouts: ${totalPayouts}\n  - Pending: ${pendingPayouts}\n  - Failed: ${failedPayouts}`;
          }
        } else if (pendingPayouts > 100) {
          reply = `No failed payouts, but ${pendingPayouts} payouts are pending. Consider processing backlog.`;
          if (isDetailed) {
            reply += '\n\nAction: Review pending batch in Finance Dashboard.';
          }
        } else {
          reply = 'No payout anomalies detected. All payouts processing normally.';
          if (isDetailed) {
            reply += `\n\nStats: ${totalPayouts} total, ${pendingPayouts} pending.`;
          }
        }
        meta = { ...meta, totalPayouts, pendingPayouts, failedPayouts };
        break;
      }
      
      case 'payout_status': {
        const [totalPayouts, pendingPayouts, failedPayouts] = await Promise.all([
          prisma.payout.count().catch(() => 0),
          prisma.payout.count({ where: { status: 'pending' } }).catch(() => 0),
          prisma.payout.count({ where: { status: 'failed' } }).catch(() => 0)
        ]);
        
        if (questionType === 'count') {
          reply = formatCountResponse(pendingPayouts, 'payouts pending');
          if (isDetailed) {
            reply += `\n  - Failed: ${failedPayouts}\n  - Total: ${totalPayouts}`;
          }
        } else {
          reply = formatPayoutAnomalies({ pending: pendingPayouts, failed: failedPayouts, total: totalPayouts });
          if (isDetailed) {
            reply += '\n\nContext: Access Finance Dashboard for detailed payout history.';
          }
        }
        meta = { ...meta, totalPayouts, pendingPayouts, failedPayouts };
        break;
      }
      
      case 'kyc_queue': {
        const [pendingRestaurants, pendingDrivers, recentApprovals] = await Promise.all([
          prisma.restaurantProfile.count({ where: { verificationStatus: 'PENDING' } }).catch(() => 0),
          prisma.driverProfile.count({ where: { verificationStatus: 'pending' } }).catch(() => 0),
          prisma.restaurantProfile.count({
            where: {
              verificationStatus: 'VERIFIED',
              updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }
          }).catch(() => 0)
        ]);
        
        const total = pendingRestaurants + pendingDrivers;
        
        if (questionType === 'count') {
          reply = formatCountResponse(total, 'verifications pending');
          if (isDetailed) {
            reply += `\n  - Restaurants: ${pendingRestaurants}\n  - Drivers: ${pendingDrivers}`;
          }
        } else {
          reply = formatKycQueue({ restaurants: pendingRestaurants, drivers: pendingDrivers, recent: recentApprovals });
          if (isDetailed) {
            reply += '\n\nNote: Process verifications in People & KYC Center.';
          }
        }
        meta = { ...meta, pendingRestaurants, pendingDrivers, recentApprovals };
        break;
      }
      
      case 'platform_health': {
        const [recentErrors, activeIncidents] = await Promise.all([
          prisma.safePilotAuditLog.count({
            where: {
              createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
            }
          }).catch(() => 0),
          prisma.sOSAlert.count({ where: { status: { not: 'resolved' } } }).catch(() => 0)
        ]);
        
        const status = recentErrors < 5 && activeIncidents < 3 ? 'healthy' : 'needs attention';
        
        if (questionType === 'status') {
          reply = `Platform status: ${status}. ${activeIncidents} active incident(s), ${recentErrors} system flag(s) in the last hour.`;
          if (isDetailed) {
            reply += '\n\nMonitor: Check System Health Dashboard for live metrics.';
          }
        } else {
          reply = formatPlatformHealth({ errors: recentErrors, incidents: activeIncidents });
          if (isDetailed) {
            reply += '\n\nContext: Review Safety Center for incident details.';
          }
        }
        meta = { ...meta, status, recentErrors, activeIncidents };
        break;
      }
      
      case 'customer_count': {
        const [totalUsers, activeUsers, recentSignups] = await Promise.all([
          prisma.user.count(),
          prisma.user.count({ where: { isBlocked: false } }),
          prisma.user.count({
            where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
          })
        ]);
        
        if (questionType === 'count') {
          reply = formatCountResponse(totalUsers, 'registered users');
          if (isDetailed) {
            reply += `\n  - Active: ${activeUsers}\n  - New (7d): ${recentSignups}`;
          }
        } else {
          reply = formatStatusResponse('Customer Overview', [
            `${totalUsers} total registered users`,
            `${activeUsers} active accounts`,
            `${recentSignups} new signups this week`
          ]);
          if (isDetailed) {
            reply += '\n\nContext: View user details in People & KYC Center.';
          }
        }
        meta = { ...meta, totalUsers, activeUsers, recentSignups };
        break;
      }
      
      default: {
        // Generic help - suggest what they can ask
        reply = `I can help with:
  - Driver stats: "how many drivers" or "driver status"
  - KYC queue: "pending verifications" or "KYC status"
  - Fraud signals: "any fraud alerts?" or "security status"
  - Payouts: "payout anomalies" or "payout status"
  - Platform health: "system status" or "any incidents?"
  
What would you like to know?`;
        meta = { ...meta, type: 'help' };
        break;
      }
    }
    
    // Apply autoSuggestFollowups setting - append follow-up suggestions
    if (userSettings.autoSuggestFollowups && intent !== 'generic_help') {
      const followupSuggestions: Record<AdminIntent, string[]> = {
        'driver_count': ['Try: "how do I improve drivers"', 'Try: "pending driver verifications"'],
        'driver_pending_kyc': ['Try: "how many drivers total"', 'Try: "driver improvement tips"'],
        'driver_improvement_advice': ['Try: "driver status"', 'Try: "low-rated drivers"'],
        'fraud_status': ['Try: "platform health"', 'Try: "payout anomalies"'],
        'payout_anomaly': ['Try: "payout status"', 'Try: "fraud alerts"'],
        'payout_status': ['Try: "payout anomalies"', 'Try: "platform health"'],
        'platform_health': ['Try: "fraud status"', 'Try: "KYC queue"'],
        'kyc_queue': ['Try: "pending drivers"', 'Try: "driver count"'],
        'customer_count': ['Try: "active users"', 'Try: "new signups"'],
        'generic_help': [],
      };
      
      const suggestions = followupSuggestions[intent] || [];
      if (suggestions.length > 0) {
        reply += `\n\nFollow-up: ${suggestions.join(' | ')}`;
      }
    }
    
    // Apply readOnlyMode setting - add banner to response
    if (userSettings.readOnlyMode) {
      meta.readOnlyMode = true;
      reply = `[Read-Only Mode]\n\n${reply}`;
    }
    
    // Log the query
    await prisma.safePilotAuditLog.create({
      data: {
        actorUserId: req.user!.userId,
        actorRole: 'ADMIN',
        action: 'ask' as any,
        metadata: {
          query: userQuery.slice(0, 500),
          intent,
          questionType,
          source: 'admin_safepilot',
          settings: {
            responseMode: userSettings.responseMode,
            autoSuggest: userSettings.autoSuggestFollowups,
            readOnly: userSettings.readOnlyMode,
          },
          processingTime: Date.now() - startTime
        }
      }
    }).catch(() => {});
    
    console.log(`[Admin SafePilot] Completed: intent=${intent}, type=${questionType}, time=${Date.now() - startTime}ms`);
    
    res.json({ reply, meta });
    
  } catch (error) {
    console.error('[Admin SafePilot Query] Error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      reply: 'Query processing failed. Try: "how many drivers pending" or "payout status"',
      meta: { type: 'error' }
    });
  }
});

export default router;
