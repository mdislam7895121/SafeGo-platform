import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { prisma } from '../db';
import * as adminSupportService from '../services/safepilot/adminSupportService';

const router = Router();

// Middleware to check admin role
const requireAdmin = async (req: AuthRequest, res: Response, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const adminRoles = ['admin', 'super_admin', 'support_admin'];
  if (!adminRoles.includes(req.user.role?.toLowerCase() || '')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};

// GET /api/admin/safepilot/support/conversations
// List conversations with filters
router.get('/conversations', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const {
      role_scope,
      country,
      service,
      status,
      q,
      from,
      to,
      cursor,
      limit,
    } = req.query;
    
    if (!role_scope || !['CUSTOMER', 'DRIVER', 'RESTAURANT'].includes(String(role_scope).toUpperCase())) {
      return res.status(400).json({ error: 'role_scope is required and must be CUSTOMER, DRIVER, or RESTAURANT' });
    }
    
    const filters: adminSupportService.ConversationFilters = {
      roleScope: String(role_scope).toUpperCase() as adminSupportService.RoleScope,
      country: country ? String(country).toUpperCase() as adminSupportService.CountryScope : undefined,
      service: service ? String(service).toLowerCase() as adminSupportService.ServiceScope : undefined,
      status: status ? String(status).toLowerCase() as adminSupportService.StatusScope : undefined,
      q: q ? String(q) : undefined,
      from: from ? new Date(String(from)) : undefined,
      to: to ? new Date(String(to)) : undefined,
      cursor: cursor ? String(cursor) : undefined,
      limit: limit ? parseInt(String(limit), 10) : 20,
    };
    
    const result = await adminSupportService.listConversations(filters, req.user!.userId);
    
    res.json(result);
  } catch (error) {
    console.error('[Admin SafePilot Support] List conversations error:', error);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// GET /api/admin/safepilot/support/conversations/:conversationId
// Get conversation detail
router.get('/conversations/:conversationId', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.params;
    
    const result = await adminSupportService.getConversationDetail(conversationId, req.user!.userId);
    
    if (!result) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Admin SafePilot Support] Get conversation detail error:', error);
    res.status(500).json({ error: 'Failed to get conversation detail' });
  }
});

// POST /api/admin/safepilot/support/tickets
// Create support ticket
router.post('/tickets', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const {
      conversationId,
      roleScope,
      userId,
      country,
      service,
      reason,
      severity,
      rideId,
      foodOrderId,
      deliveryId,
    } = req.body;
    
    if (!conversationId || !roleScope || !userId || !country || !service || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await adminSupportService.createTicket({
      conversationId,
      roleScope,
      userId,
      country,
      service,
      reason,
      severity: severity || 'MEDIUM',
      rideId,
      foodOrderId,
      deliveryId,
    }, req.user!.userId);
    
    res.status(201).json(result);
  } catch (error) {
    console.error('[Admin SafePilot Support] Create ticket error:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// GET /api/admin/safepilot/support/tickets
// List tickets
router.get('/tickets', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const {
      role_scope,
      status,
      severity,
      assigned_to,
      cursor,
      limit,
    } = req.query;
    
    const result = await adminSupportService.listTickets({
      roleScope: role_scope ? String(role_scope).toUpperCase() as adminSupportService.RoleScope : undefined,
      status: status ? String(status).toUpperCase() as any : undefined,
      severity: severity ? String(severity).toUpperCase() as any : undefined,
      assignedToAdminId: assigned_to ? String(assigned_to) : undefined,
      cursor: cursor ? String(cursor) : undefined,
      limit: limit ? parseInt(String(limit), 10) : 20,
    }, req.user!.userId);
    
    res.json(result);
  } catch (error) {
    console.error('[Admin SafePilot Support] List tickets error:', error);
    res.status(500).json({ error: 'Failed to list tickets' });
  }
});

// POST /api/admin/safepilot/support/tickets/:ticketId/assign
// Assign ticket to admin
router.post('/tickets/:ticketId/assign', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { ticketId } = req.params;
    const { assigned_to_admin_user_id } = req.body;
    
    if (!assigned_to_admin_user_id) {
      return res.status(400).json({ error: 'assigned_to_admin_user_id is required' });
    }
    
    const result = await adminSupportService.assignTicket(ticketId, assigned_to_admin_user_id, req.user!.userId);
    
    res.json(result);
  } catch (error) {
    console.error('[Admin SafePilot Support] Assign ticket error:', error);
    res.status(500).json({ error: 'Failed to assign ticket' });
  }
});

// POST /api/admin/safepilot/support/tickets/:ticketId/resolve
// Resolve ticket
router.post('/tickets/:ticketId/resolve', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { ticketId } = req.params;
    const { resolution_reason } = req.body;
    
    if (!resolution_reason) {
      return res.status(400).json({ error: 'resolution_reason is required' });
    }
    
    const result = await adminSupportService.resolveTicket(ticketId, resolution_reason, req.user!.userId);
    
    res.json(result);
  } catch (error) {
    console.error('[Admin SafePilot Support] Resolve ticket error:', error);
    res.status(500).json({ error: 'Failed to resolve ticket' });
  }
});

// POST /api/admin/safepilot/support/internal-note
// Add internal note
router.post('/internal-note', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { ticketId, note } = req.body;
    
    if (!ticketId || !note) {
      return res.status(400).json({ error: 'ticketId and note are required' });
    }
    
    const result = await adminSupportService.addInternalNote(ticketId, note, req.user!.userId);
    
    res.json(result);
  } catch (error) {
    console.error('[Admin SafePilot Support] Add internal note error:', error);
    res.status(500).json({ error: 'Failed to add internal note' });
  }
});

// GET /api/admin/safepilot/support/audit
// Get audit logs
router.get('/audit', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { from, to, cursor, limit } = req.query;
    
    const result = await adminSupportService.getSupportAuditLogs({
      from: from ? new Date(String(from)) : undefined,
      to: to ? new Date(String(to)) : undefined,
      cursor: cursor ? String(cursor) : undefined,
      limit: limit ? parseInt(String(limit), 10) : 50,
    }, req.user!.userId);
    
    res.json(result);
  } catch (error) {
    console.error('[Admin SafePilot Support] Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

// GET /api/admin/safepilot/support/admins
// Get list of admins for assignment dropdown
router.get('/admins', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ['admin', 'super_admin', 'support_admin'] },
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
      orderBy: { email: 'asc' },
    });
    
    res.json({ admins });
  } catch (error) {
    console.error('[Admin SafePilot Support] Get admins error:', error);
    res.status(500).json({ error: 'Failed to get admins' });
  }
});

export default router;
