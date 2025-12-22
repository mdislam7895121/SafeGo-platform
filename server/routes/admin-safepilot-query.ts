import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { prisma } from '../db';

const router = Router();

// ============================================================================
// ADMIN SAFEPILOT - Enterprise-Grade Admin AI Assistant
// STRICT ISOLATION: This module is ADMIN-ONLY. No shared logic with Support AI.
// ============================================================================

// Intent types for admin queries
type AdminIntent = 'guard' | 'kyc' | 'metrics' | 'operations' | 'finance' | 'drivers' | 'customers' | 'general';

// Detect query intent - ADMIN ONLY
function detectAdminIntent(query: string): AdminIntent {
  const q = query.toLowerCase();
  
  // Guard/Security intent
  if (/fraud|suspicious|abuse|security|threat|fake|gps.?spoof|ban|block|scam|manipulation|anomal/i.test(q)) {
    return 'guard';
  }
  // KYC/Verification intent
  if (/kyc|verification|document|approval|pending.*review|identity|onboard/i.test(q)) {
    return 'kyc';
  }
  // Metrics/Analytics intent
  if (/metric|analytic|kpi|performance|stat|dashboard|trend|growth/i.test(q)) {
    return 'metrics';
  }
  // Operations/System intent
  if (/system|health|uptime|status|service|error|incident|outage/i.test(q)) {
    return 'operations';
  }
  // Finance intent
  if (/revenue|payout|payment|commission|earning|cost|expense|settlement|billing/i.test(q)) {
    return 'finance';
  }
  // Drivers intent
  if (/driver|delivery|fleet|vehicle|courier/i.test(q)) {
    return 'drivers';
  }
  // Customers intent
  if (/customer|user|rider|order|booking/i.test(q)) {
    return 'customers';
  }
  
  return 'general';
}

// Dynamic response variations to avoid static answers
function getTimestampVariation(): string {
  const now = new Date();
  const hour = now.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

// Enterprise response formatter - ADMIN ONLY
function formatEnterpriseResponse(
  title: string,
  keyFindings: string[],
  dataSnapshot?: { label: string; value: string | number }[],
  risks?: string[],
  actions?: string[]
): string {
  const lines: string[] = [];
  
  // Title (1 line)
  lines.push(title);
  lines.push('');
  
  // Key Findings (bullets)
  if (keyFindings.length > 0) {
    lines.push('Key Findings:');
    keyFindings.forEach(f => lines.push(`  - ${f}`));
    lines.push('');
  }
  
  // Data Snapshot (optional)
  if (dataSnapshot && dataSnapshot.length > 0) {
    lines.push('Data Snapshot:');
    dataSnapshot.forEach(d => {
      const val = typeof d.value === 'number' ? formatNumber(d.value) : d.value;
      lines.push(`  - ${d.label}: ${val}`);
    });
    lines.push('');
  }
  
  // Risks / Notes (only if applicable)
  if (risks && risks.length > 0) {
    lines.push('Risks:');
    risks.forEach(r => lines.push(`  - ${r}`));
    lines.push('');
  }
  
  // Recommended Actions (actionable, admin-level)
  if (actions && actions.length > 0) {
    lines.push('Recommended Actions:');
    actions.forEach(a => lines.push(`  - ${a}`));
  }
  
  return lines.join('\n').trim();
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

// POST /api/admin/safepilot/query
// Admin SafePilot - Enterprise Admin AI Assistant
router.post('/query', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { query } = req.body;
    
    // Graceful validation - extract question even if malformed
    let userQuery = '';
    if (typeof query === 'string' && query.trim().length > 0) {
      userQuery = query.trim();
    } else if (typeof query === 'object' && query?.question) {
      userQuery = String(query.question).trim();
    } else {
      // Fallback: return help response instead of error
      return res.json({
        reply: formatEnterpriseResponse(
          'Admin SafePilot Ready',
          ['I can help you analyze platform data and operations.'],
          undefined,
          undefined,
          ['Ask about KPIs, KYC queues, fraud signals, payouts, or driver operations']
        ),
        meta: { type: 'help', intent: 'general' }
      });
    }
    
    const lowerQuery = userQuery.toLowerCase();
    const intent = detectAdminIntent(userQuery);
    const timeVariant = getTimestampVariation();
    const queryTime = new Date().toISOString();
    
    console.log(`[Admin SafePilot] Processing query: intent=${intent}, time=${timeVariant}`);
    
    // Check if query belongs to support domain
    const supportKeywords = ['support ticket', 'customer complaint', 'help desk', 'customer service'];
    if (supportKeywords.some(kw => lowerQuery.includes(kw))) {
      return res.json({
        reply: 'This query relates to customer support operations. Please use the Support Console for ticket and conversation management.',
        meta: { redirectTo: '/admin/support-console', queryType: 'support_domain', intent }
      });
    }
    
    let reply = '';
    let meta: any = { intent, queryTime };
    
    // ===========================================================================
    // INTENT-BASED HANDLERS - Each produces distinct, data-aware responses
    // ===========================================================================
    
    switch (intent) {
      case 'guard': {
        // Fraud/Security analysis
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
        
        const keyFindings = [
          `${auditLogs} security events logged in the last 24 hours`,
          `${blockedUsers} accounts currently blocked platform-wide`,
          `${recentBlocks} new blocks applied this week`
        ];
        
        const risks: string[] = [];
        if (recentBlocks > 10) {
          risks.push('Elevated block rate may indicate coordinated abuse');
        }
        if (auditLogs > 100) {
          risks.push('High audit volume requires manual review');
        }
        
        const actions = [
          'Review Security Center for detailed threat breakdown',
          'Check Fraud Prevention Center for active cases',
          recentBlocks > 0 ? 'Audit recent blocks for false positives' : 'Monitor for emerging threats'
        ];
        
        reply = formatEnterpriseResponse(
          `Security Status (${timeVariant} check)`,
          keyFindings,
          [
            { label: 'Audit Events (24h)', value: auditLogs },
            { label: 'Total Blocked', value: blockedUsers },
            { label: 'New Blocks (7d)', value: recentBlocks }
          ],
          risks.length > 0 ? risks : undefined,
          actions
        );
        meta = { ...meta, type: 'guard', auditLogs, blockedUsers, recentBlocks };
        break;
      }
      
      case 'kyc': {
        // KYC/Verification queues
        const [pendingRestaurants, pendingDrivers, recentApprovals] = await Promise.all([
          prisma.restaurant.count({ where: { verificationStatus: 'PENDING' } }).catch(() => 0),
          prisma.driverProfile.count({ where: { verificationStatus: 'pending' } }).catch(() => 0),
          prisma.restaurant.count({
            where: {
              verificationStatus: 'VERIFIED',
              updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }
          }).catch(() => 0)
        ]);
        
        const totalPending = pendingRestaurants + pendingDrivers;
        
        const keyFindings = [
          `${pendingRestaurants} restaurant verifications pending`,
          `${pendingDrivers} driver verifications pending`,
          `${recentApprovals} approvals processed in last 24 hours`
        ];
        
        const risks: string[] = [];
        if (totalPending > 50) {
          risks.push('High queue volume may delay partner onboarding');
        }
        if (pendingDrivers > 20) {
          risks.push('Driver backlog impacts delivery capacity');
        }
        
        const actions = [
          totalPending > 0 ? 'Process pending verifications in People & KYC Center' : 'Queue is clear',
          pendingRestaurants > 0 ? `Review ${pendingRestaurants} restaurant applications` : undefined,
          pendingDrivers > 0 ? `Review ${pendingDrivers} driver applications` : undefined
        ].filter(Boolean) as string[];
        
        reply = formatEnterpriseResponse(
          `KYC Queue Status (${queryTime.split('T')[0]})`,
          keyFindings,
          [
            { label: 'Pending Restaurants', value: pendingRestaurants },
            { label: 'Pending Drivers', value: pendingDrivers },
            { label: 'Approvals (24h)', value: recentApprovals }
          ],
          risks.length > 0 ? risks : undefined,
          actions
        );
        meta = { ...meta, type: 'kyc', pendingRestaurants, pendingDrivers, recentApprovals };
        break;
      }
      
      case 'metrics': {
        // KPIs and analytics
        const [totalUsers, totalRides, recentRides, activeDrivers] = await Promise.all([
          prisma.user.count(),
          prisma.ride.count().catch(() => 0),
          prisma.ride.count({
            where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
          }).catch(() => 0),
          prisma.driverProfile.count({ where: { isOnline: true } }).catch(() => 0)
        ]);
        
        const avgDailyRides = totalRides > 0 ? Math.round(totalRides / 30) : 0;
        const rideGrowth = recentRides > avgDailyRides ? 'above average' : 'at or below average';
        
        const keyFindings = [
          `${formatNumber(totalUsers)} registered users on platform`,
          `${formatNumber(totalRides)} total rides completed`,
          `${formatNumber(recentRides)} rides in last 24 hours (${rideGrowth})`,
          `${formatNumber(activeDrivers)} drivers currently online`
        ];
        
        const actions = [
          'View Admin Dashboard for real-time trends',
          'Export detailed analytics from Data Export Center',
          recentRides < avgDailyRides ? 'Investigate demand patterns for optimization' : 'Current metrics healthy'
        ];
        
        reply = formatEnterpriseResponse(
          `Platform KPIs (${timeVariant} snapshot)`,
          keyFindings,
          [
            { label: 'Total Users', value: totalUsers },
            { label: 'Total Rides', value: totalRides },
            { label: 'Rides (24h)', value: recentRides },
            { label: 'Online Drivers', value: activeDrivers }
          ],
          undefined,
          actions
        );
        meta = { ...meta, type: 'metrics', totalUsers, totalRides, recentRides, activeDrivers };
        break;
      }
      
      case 'operations': {
        // System health
        const [recentErrors, activeIncidents] = await Promise.all([
          prisma.safePilotAuditLog.count({
            where: {
              action: { in: ['flag', 'override'] },
              createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
            }
          }).catch(() => 0),
          prisma.sOSAlert.count({ where: { status: { not: 'resolved' } } }).catch(() => 0)
        ]);
        
        const systemStatus = recentErrors < 5 && activeIncidents < 3 ? 'Healthy' : 'Needs Attention';
        
        const keyFindings = [
          `System status: ${systemStatus}`,
          `${recentErrors} system flags in the last hour`,
          `${activeIncidents} active incidents requiring attention`
        ];
        
        const risks: string[] = [];
        if (activeIncidents > 0) {
          risks.push(`${activeIncidents} unresolved incident(s) may impact operations`);
        }
        if (recentErrors > 10) {
          risks.push('Elevated error rate detected');
        }
        
        const actions = [
          activeIncidents > 0 ? 'Review active incidents in Safety Center' : 'No active incidents',
          'Check System Health Monitor for service status',
          'Review recent audit logs for anomalies'
        ];
        
        reply = formatEnterpriseResponse(
          `System Health (${new Date().toLocaleTimeString()})`,
          keyFindings,
          [
            { label: 'Status', value: systemStatus },
            { label: 'Recent Flags', value: recentErrors },
            { label: 'Active Incidents', value: activeIncidents }
          ],
          risks.length > 0 ? risks : undefined,
          actions
        );
        meta = { ...meta, type: 'operations', systemStatus, recentErrors, activeIncidents };
        break;
      }
      
      case 'finance': {
        // Financial overview
        const [totalPayouts, pendingPayouts, failedPayouts] = await Promise.all([
          prisma.payout.count().catch(() => 0),
          prisma.payout.count({ where: { status: 'pending' } }).catch(() => 0),
          prisma.payout.count({ where: { status: 'failed' } }).catch(() => 0)
        ]);
        
        const keyFindings = [
          `${formatNumber(totalPayouts)} total payout records`,
          `${pendingPayouts} payouts awaiting processing`,
          `${failedPayouts} failed payouts require attention`
        ];
        
        const risks: string[] = [];
        if (failedPayouts > 0) {
          risks.push(`${failedPayouts} failed payout(s) need resolution`);
        }
        if (pendingPayouts > 100) {
          risks.push('High pending payout volume may delay partner payments');
        }
        
        const actions = [
          failedPayouts > 0 ? 'Review and retry failed payouts' : 'No failed payouts',
          'Access Finance Dashboard for revenue breakdown',
          'Configure payout schedules in Payout Settings'
        ];
        
        reply = formatEnterpriseResponse(
          `Finance Summary (${queryTime.split('T')[0]})`,
          keyFindings,
          [
            { label: 'Total Payouts', value: totalPayouts },
            { label: 'Pending', value: pendingPayouts },
            { label: 'Failed', value: failedPayouts }
          ],
          risks.length > 0 ? risks : undefined,
          actions
        );
        meta = { ...meta, type: 'finance', totalPayouts, pendingPayouts, failedPayouts };
        break;
      }
      
      case 'drivers': {
        // Driver operations
        const [totalDrivers, onlineDrivers, pendingKyc, lowRating] = await Promise.all([
          prisma.driverProfile.count(),
          prisma.driverProfile.count({ where: { isOnline: true } }).catch(() => 0),
          prisma.driverProfile.count({ where: { verificationStatus: 'pending' } }).catch(() => 0),
          prisma.driverStats.count({ where: { rating: { lt: 3.5 } } }).catch(() => 0)
        ]);
        
        const onlineRate = totalDrivers > 0 ? Math.round((onlineDrivers / totalDrivers) * 100) : 0;
        
        const keyFindings = [
          `${formatNumber(totalDrivers)} total registered drivers`,
          `${formatNumber(onlineDrivers)} currently online (${onlineRate}% availability)`,
          `${pendingKyc} pending driver verifications`,
          `${lowRating} drivers with ratings below 3.5`
        ];
        
        const risks: string[] = [];
        if (lowRating > 10) {
          risks.push('Multiple low-rated drivers may affect service quality');
        }
        if (onlineRate < 10) {
          risks.push('Low driver availability may impact fulfillment');
        }
        
        const actions = [
          pendingKyc > 0 ? `Process ${pendingKyc} pending driver verifications` : 'Driver KYC queue clear',
          lowRating > 0 ? 'Review low-rated drivers for quality improvement' : 'Driver ratings healthy',
          'Monitor driver availability in Operations Dashboard'
        ];
        
        reply = formatEnterpriseResponse(
          `Driver Operations (${timeVariant} report)`,
          keyFindings,
          [
            { label: 'Total Drivers', value: totalDrivers },
            { label: 'Online Now', value: onlineDrivers },
            { label: 'Pending KYC', value: pendingKyc },
            { label: 'Low Rating', value: lowRating }
          ],
          risks.length > 0 ? risks : undefined,
          actions
        );
        meta = { ...meta, type: 'drivers', totalDrivers, onlineDrivers, pendingKyc, lowRating };
        break;
      }
      
      case 'customers': {
        // Customer metrics
        const [totalUsers, activeUsers, blockedUsers, recentSignups] = await Promise.all([
          prisma.user.count(),
          prisma.user.count({ where: { isBlocked: false } }),
          prisma.user.count({ where: { isBlocked: true } }),
          prisma.user.count({
            where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
          })
        ]);
        
        const activeRate = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0;
        
        const keyFindings = [
          `${formatNumber(totalUsers)} total registered users`,
          `${formatNumber(activeUsers)} active accounts (${activeRate}%)`,
          `${formatNumber(recentSignups)} new signups in the last 7 days`,
          `${formatNumber(blockedUsers)} accounts currently blocked`
        ];
        
        const actions = [
          'View user details in People & KYC Center',
          blockedUsers > 0 ? 'Review blocked accounts for potential reinstatement' : 'No blocked accounts',
          'Export user analytics from Data Export Center'
        ];
        
        reply = formatEnterpriseResponse(
          `Customer Overview (${queryTime.split('T')[0]})`,
          keyFindings,
          [
            { label: 'Total Users', value: totalUsers },
            { label: 'Active', value: activeUsers },
            { label: 'Blocked', value: blockedUsers },
            { label: 'New (7d)', value: recentSignups }
          ],
          undefined,
          actions
        );
        meta = { ...meta, type: 'customers', totalUsers, activeUsers, blockedUsers, recentSignups };
        break;
      }
      
      default: {
        // General help with context-aware suggestions
        const [pendingKyc, activeIncidents] = await Promise.all([
          prisma.driverProfile.count({ where: { verificationStatus: 'pending' } }).catch(() => 0),
          prisma.sOSAlert.count({ where: { status: { not: 'resolved' } } }).catch(() => 0)
        ]);
        
        const contextFindings = [];
        if (pendingKyc > 0) {
          contextFindings.push(`${pendingKyc} pending verifications need attention`);
        }
        if (activeIncidents > 0) {
          contextFindings.push(`${activeIncidents} active incident(s) require review`);
        }
        if (contextFindings.length === 0) {
          contextFindings.push('No urgent items detected');
        }
        
        const actions = [
          'Ask about KPIs: "Show platform metrics"',
          'Ask about KYC: "Pending verification queue"',
          'Ask about security: "Any fraud signals?"',
          'Ask about payouts: "Payout status"',
          'Ask about drivers: "Driver availability"'
        ];
        
        reply = formatEnterpriseResponse(
          'Admin SafePilot',
          contextFindings,
          undefined,
          undefined,
          actions
        );
        meta = { ...meta, type: 'general', pendingKyc, activeIncidents };
        break;
      }
    }
    
    // Log the query (using valid action type)
    await prisma.safePilotAuditLog.create({
      data: {
        actorUserId: req.user!.userId,
        actorRole: 'ADMIN',
        action: 'ask' as any,
        metadata: {
          query: userQuery.slice(0, 500),
          intent,
          responseType: meta.type,
          source: 'admin_safepilot',
          processingTime: Date.now() - startTime
        }
      }
    }).catch(() => {}); // Don't fail on audit log error
    
    console.log(`[Admin SafePilot] Query completed: intent=${intent}, time=${Date.now() - startTime}ms`);
    
    res.json({ reply, meta });
    
  } catch (error) {
    console.error('[Admin SafePilot Query] Error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      reply: 'Query processing failed. Try a simpler question like "Show platform KPIs" or "KYC queue status".',
      meta: { type: 'error' }
    });
  }
});

export default router;
