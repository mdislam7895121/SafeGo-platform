import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { prisma } from '../db';

const router = Router();

// Middleware to require ADMIN role only
const requireAdmin = async (req: AuthRequest, res: Response, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', reply: 'Authentication required.' });
  }
  
  const adminRoles = ['admin', 'super_admin'];
  if (!adminRoles.includes(req.user.role?.toLowerCase() || '')) {
    return res.status(403).json({ error: 'Forbidden', reply: 'Admin access required. You do not have permission to use Admin SafePilot.' });
  }
  
  next();
};

// POST /api/admin/safepilot/query
// Admin SafePilot - handles admin-specific queries about KPIs, metrics, platform risks
router.post('/query', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        reply: 'Please provide a valid query.' 
      });
    }
    
    const userQuery = query.trim().toLowerCase();
    
    // Check if query belongs to support domain
    const supportKeywords = [
      'support ticket', 'customer complaint', 'refund request', 'dispute',
      'unresolved customer', 'customer issue', 'support issue', 'help desk',
      'customer service', 'complaint resolution'
    ];
    
    const isSupportQuery = supportKeywords.some(keyword => userQuery.includes(keyword));
    
    if (isSupportQuery) {
      return res.json({
        reply: 'This question belongs to Support SafePilot. Please use the Support console to access support-related information.',
        meta: { redirectTo: 'support', queryType: 'support_domain' }
      });
    }
    
    // Admin domain queries - fetch real data
    let reply = '';
    let meta: any = {};
    
    // Platform risks query
    if (userQuery.includes('risk') || userQuery.includes('fraud') || userQuery.includes('security')) {
      const [auditLogs, blockedUsers] = await Promise.all([
        prisma.safePilotAuditLog.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        }),
        prisma.user.count({
          where: { isBlocked: true }
        })
      ]);
      
      reply = `Platform Risk Summary (Last 7 Days):\n\n• Audit log entries: ${auditLogs}\n• Currently blocked users: ${blockedUsers}\n\nRecommendation: Review the Security Center for detailed threat analysis.`;
      meta = { type: 'platform_risks', auditLogs, blockedUsers };
    }
    // KPI / metrics query
    else if (userQuery.includes('kpi') || userQuery.includes('metric') || userQuery.includes('performance') || userQuery.includes('dashboard')) {
      const [totalUsers, totalRides] = await Promise.all([
        prisma.user.count(),
        prisma.ride.count().catch(() => 0)
      ]);
      
      reply = `Platform KPIs:\n\n• Total registered users: ${totalUsers.toLocaleString()}\n• Total rides: ${totalRides.toLocaleString()}\n\nUse the Admin Dashboard for real-time metrics and trends.`;
      meta = { type: 'kpis', totalUsers, totalRides };
    }
    // KYC / verification query
    else if (userQuery.includes('kyc') || userQuery.includes('verification') || userQuery.includes('approval')) {
      const pendingRestaurants = await prisma.restaurant.count({
        where: { verificationStatus: 'PENDING' }
      }).catch(() => 0);
      
      reply = `KYC & Verification Queue:\n\n• Pending restaurant verifications: ${pendingRestaurants}\n\nVisit People & KYC Center to process pending approvals.`;
      meta = { type: 'kyc', pendingRestaurants };
    }
    // Payouts query
    else if (userQuery.includes('payout') || userQuery.includes('payment') || userQuery.includes('settlement')) {
      reply = `Payout information is available in the Finance Dashboard.\n\nNavigate to Admin > Finance for detailed payout management and settlement tracking.`;
      meta = { type: 'payouts', redirectTo: '/admin/finance' };
    }
    // Revenue query
    else if (userQuery.includes('revenue') || userQuery.includes('earning') || userQuery.includes('income')) {
      reply = `Revenue insights are available in the Admin Finance Dashboard. Navigate to Admin > Finance for detailed revenue breakdowns by service, region, and time period.`;
      meta = { type: 'revenue', redirectTo: '/admin/finance' };
    }
    // Users query
    else if (userQuery.includes('user') || userQuery.includes('customer') || userQuery.includes('account')) {
      const [totalUsers, activeUsers] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isBlocked: false } })
      ]);
      
      reply = `User Statistics:\n\n• Total users: ${totalUsers.toLocaleString()}\n• Active users: ${activeUsers.toLocaleString()}\n• Blocked users: ${(totalUsers - activeUsers).toLocaleString()}\n\nVisit People & KYC Center for detailed user management.`;
      meta = { type: 'users', totalUsers, activeUsers };
    }
    // Default response
    else {
      reply = `I can help you with:\n\n• Platform risks & security alerts\n• KPIs and performance metrics\n• KYC verification queues\n• Payout and settlement status\n• Revenue insights\n• User statistics\n\nTry asking about specific topics like "What are the top platform risks?" or "Show me pending KYC approvals."`;
      meta = { type: 'help', suggestions: ['platform risks', 'kpis', 'kyc approvals', 'user statistics'] };
    }
    
    // Log the query (using valid action type)
    await prisma.safePilotAuditLog.create({
      data: {
        actorUserId: req.user!.userId,
        actorRole: 'ADMIN',
        action: 'ask' as any,
        metadata: { query: userQuery.slice(0, 200), responseType: meta.type, source: 'admin_safepilot' }
      }
    }).catch(() => {}); // Don't fail on audit log error
    
    res.json({ reply, meta });
    
  } catch (error) {
    console.error('[Admin SafePilot Query] Error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      reply: 'An error occurred while processing your query. Please try again.' 
    });
  }
});

export default router;
