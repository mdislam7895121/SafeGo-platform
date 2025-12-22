import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { prisma } from '../db';

const router = Router();

// Middleware to require SUPPORT_ADMIN role only
const requireSupportAdmin = async (req: AuthRequest, res: Response, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', reply: 'Authentication required.' });
  }
  
  const supportRoles = ['support_admin', 'super_admin'];
  if (!supportRoles.includes(req.user.role?.toLowerCase() || '')) {
    return res.status(403).json({ error: 'Forbidden', reply: 'Support Admin access required. You do not have permission to use Support SafePilot.' });
  }
  
  next();
};

// POST /api/support/safepilot/query
// Support SafePilot - handles support-specific queries about tickets, conversations, disputes
router.post('/query', authenticateToken, requireSupportAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        reply: 'Please provide a valid query.' 
      });
    }
    
    const userQuery = query.trim().toLowerCase();
    
    // Check if query belongs to admin domain
    const adminKeywords = [
      'platform risk', 'fraud detection', 'kpi', 'revenue', 'payout processing',
      'kyc approval', 'driver verification', 'system metric', 'platform performance'
    ];
    
    const isAdminQuery = adminKeywords.some(keyword => userQuery.includes(keyword));
    
    if (isAdminQuery) {
      return res.json({
        reply: 'This question belongs to Admin SafePilot. Please use the Admin dashboard to access platform-level metrics and configurations.',
        meta: { redirectTo: 'admin', queryType: 'admin_domain' }
      });
    }
    
    // Support domain queries - fetch real data
    let reply = '';
    let meta: any = {};
    
    // Unresolved customer issues
    if (userQuery.includes('unresolved') || userQuery.includes('pending') || userQuery.includes('open ticket')) {
      const [openTickets, escalatedConversations] = await Promise.all([
        prisma.safePilotSupportTicket.count({
          where: { status: 'OPEN' }
        }).catch(() => 0),
        prisma.safePilotConversation.count({
          where: { isEscalated: true, status: { not: 'resolved' } }
        }).catch(() => 0)
      ]);
      
      reply = `Unresolved Support Issues:\n\n• Open support tickets: ${openTickets}\n• Escalated conversations: ${escalatedConversations}\n\nPrioritize high-severity tickets and escalated conversations first.`;
      meta = { type: 'unresolved_issues', openTickets, escalatedConversations };
    }
    // Customer complaints
    else if (userQuery.includes('complaint') || userQuery.includes('customer issue')) {
      const recentComplaints = await prisma.safePilotConversation.count({
        where: {
          userRole: 'CUSTOMER',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      }).catch(() => 0);
      
      reply = `Customer Conversations (Last 24 Hours):\n\n• New customer conversations: ${recentComplaints}\n\nUse the Support Center to view and respond to customer conversations.`;
      meta = { type: 'complaints', recentComplaints };
    }
    // Refund queries
    else if (userQuery.includes('refund') || userQuery.includes('money back')) {
      reply = `Refund requests are managed through the Finance section.\n\nNavigate to Support > Refunds to process pending refund requests.`;
      meta = { type: 'refunds', redirectTo: '/support/refunds' };
    }
    // Disputes
    else if (userQuery.includes('dispute') || userQuery.includes('chargeback')) {
      reply = `Dispute management is handled through the Finance section. Open disputes require immediate attention to prevent chargebacks.\n\nNavigate to Support > Disputes to view active cases.`;
      meta = { type: 'disputes', redirectTo: '/support/disputes' };
    }
    // Ticket stats
    else if (userQuery.includes('ticket') || userQuery.includes('support stat')) {
      const [totalOpen, totalAssigned, totalResolved] = await Promise.all([
        prisma.safePilotSupportTicket.count({ where: { status: 'OPEN' } }).catch(() => 0),
        prisma.safePilotSupportTicket.count({ where: { status: 'ASSIGNED' } }).catch(() => 0),
        prisma.safePilotSupportTicket.count({
          where: { 
            status: 'RESOLVED',
            resolvedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        }).catch(() => 0)
      ]);
      
      reply = `Support Ticket Statistics:\n\n• Open tickets: ${totalOpen}\n• Assigned tickets: ${totalAssigned}\n• Resolved (last 7 days): ${totalResolved}\n\nAim to keep open ticket count below 50 for optimal response times.`;
      meta = { type: 'ticket_stats', totalOpen, totalAssigned, totalResolved };
    }
    // Conversations
    else if (userQuery.includes('conversation') || userQuery.includes('chat')) {
      const [customerConvs, driverConvs, restaurantConvs] = await Promise.all([
        prisma.safePilotConversation.count({ where: { userRole: 'CUSTOMER' } }),
        prisma.safePilotConversation.count({ where: { userRole: 'DRIVER' } }),
        prisma.safePilotConversation.count({ where: { userRole: 'RESTAURANT' } })
      ]);
      
      reply = `SafePilot Conversation Summary:\n\n• Customer conversations: ${customerConvs}\n• Driver conversations: ${driverConvs}\n• Restaurant conversations: ${restaurantConvs}\n\nUse the Support Center to review and manage conversations.`;
      meta = { type: 'conversations', customerConvs, driverConvs, restaurantConvs };
    }
    // Default response
    else {
      reply = `I can help you with:\n\n• Unresolved customer issues\n• Complaint tracking\n• Refund requests\n• Dispute management\n• Support ticket statistics\n• Conversation summaries\n\nTry asking "What are the unresolved customer support issues?" or "Show me ticket statistics."`;
      meta = { type: 'help', suggestions: ['unresolved issues', 'ticket stats', 'customer complaints', 'conversations'] };
    }
    
    // Log the query (using valid action type)
    await prisma.safePilotAuditLog.create({
      data: {
        actorUserId: req.user!.userId,
        actorRole: 'SUPPORT_ADMIN',
        action: 'ask' as any,
        metadata: { query: userQuery.slice(0, 200), responseType: meta.type, source: 'support_safepilot' }
      }
    }).catch(() => {}); // Don't fail on audit log error
    
    res.json({ reply, meta });
    
  } catch (error) {
    console.error('[Support SafePilot Query] Error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      reply: 'An error occurred while processing your query. Please try again.' 
    });
  }
});

export default router;
