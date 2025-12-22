import { prisma } from '../../db';

// Types
export type RoleScope = 'CUSTOMER' | 'DRIVER' | 'RESTAURANT';
export type CountryScope = 'US' | 'BD' | 'ALL';
export type ServiceScope = 'ride' | 'food' | 'parcel' | 'ALL';
export type StatusScope = 'open' | 'escalated' | 'resolved' | 'ALL';

export interface ConversationFilters {
  roleScope: RoleScope;
  country?: CountryScope;
  service?: ServiceScope;
  status?: StatusScope;
  q?: string;
  from?: Date;
  to?: Date;
  cursor?: string;
  limit?: number;
}

export interface CreateTicketInput {
  conversationId: string;
  roleScope: RoleScope;
  userId: string;
  country: CountryScope;
  service: ServiceScope;
  reason: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  rideId?: string;
  foodOrderId?: string;
  deliveryId?: string;
}

// Generate unique ticket code
function generateTicketCode(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `SP-${year}-${random}`;
}

// Log audit action
async function logAuditAction(
  adminUserId: string,
  action: string,
  metadata: Record<string, any>
): Promise<void> {
  try {
    await prisma.safePilotAuditLog.create({
      data: {
        actorUserId: adminUserId,
        actorRole: 'ADMIN',
        action: action as any,
        metadata,
      },
    });
  } catch (error) {
    console.error('[AdminSupportService] Audit log error:', error);
  }
}

// List conversations with filters (admin only)
export async function listConversations(
  filters: ConversationFilters,
  adminUserId: string
): Promise<{ conversations: any[]; cursor: string | null; total: number }> {
  const limit = filters.limit || 20;
  
  // Build where clause
  const where: any = {
    userRole: filters.roleScope,
  };
  
  if (filters.country && filters.country !== 'ALL') {
    where.country = filters.country;
  }
  
  if (filters.service && filters.service !== 'ALL') {
    where.service = filters.service.toUpperCase();
  }
  
  if (filters.status && filters.status !== 'ALL') {
    where.status = filters.status;
  }
  
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = filters.from;
    if (filters.to) where.createdAt.lte = filters.to;
  }
  
  if (filters.cursor) {
    where.id = { lt: filters.cursor };
  }
  
  // Get conversations with last message
  const conversations = await prisma.safePilotConversation.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: {
        select: { messages: true },
      },
    },
  });
  
  // Check if there's more
  const hasMore = conversations.length > limit;
  const items = hasMore ? conversations.slice(0, limit) : conversations;
  const nextCursor = hasMore ? items[items.length - 1].id : null;
  
  // Get total count
  const total = await prisma.safePilotConversation.count({ where });
  
  // Log audit
  await logAuditAction(adminUserId, 'VIEW_CONVERSATIONS', { filters, resultCount: items.length });
  
  return {
    conversations: items.map((c: any) => ({
      id: c.id,
      userId: c.userId,
      userRole: c.userRole,
      country: c.country,
      service: c.service || 'ALL',
      status: c.status || 'open',
      lastMessage: c.messages[0] ? {
        content: c.messages[0].content.slice(0, 100) + (c.messages[0].content.length > 100 ? '...' : ''),
        direction: c.messages[0].direction,
        createdAt: c.messages[0].createdAt,
      } : null,
      messageCount: c._count.messages,
      isEscalated: c.isEscalated || false,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt || c.createdAt,
    })),
    cursor: nextCursor,
    total,
  };
}

// Get conversation detail (admin only)
export async function getConversationDetail(
  conversationId: string,
  adminUserId: string
): Promise<any | null> {
  const conversation = await prisma.safePilotConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  
  if (!conversation) return null;
  
  // Get user info (masked sensitive data)
  const user = await prisma.user.findUnique({
    where: { id: conversation.userId },
    select: {
      id: true,
      email: true,
      countryCode: true,
      role: true,
    },
  });
  
  // Log audit
  await logAuditAction(adminUserId, 'VIEW_CONVERSATION_DETAIL', { conversationId, userId: conversation.userId });
  
  const conv = conversation as any;
  return {
    id: conv.id,
    userId: conv.userId,
    userRole: conv.userRole,
    country: conv.country,
    service: conv.service || 'ALL',
    status: conv.status || 'open',
    isEscalated: conv.isEscalated || false,
    assignedAdminId: conv.assignedAdminId || null,
    messages: conv.messages.map((m: any) => ({
      id: m.id,
      direction: m.direction,
      content: m.content,
      moderationFlags: m.moderationFlags,
      sources: m.sources,
      createdAt: m.createdAt,
    })),
    relatedEntities: {
      rideId: conv.rideId || null,
      foodOrderId: conv.foodOrderId || null,
      deliveryId: conv.deliveryId || null,
    },
    user: user ? {
      id: user.id,
      email: maskEmail(user.email),
      countryCode: user.countryCode || '',
      role: user.role,
    } : null,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt || conv.createdAt,
  };
}

// Create support ticket
export async function createTicket(
  input: CreateTicketInput,
  adminUserId: string
): Promise<{ ticketCode: string; id: string }> {
  const ticketCode = generateTicketCode();
  
  const ticket = await prisma.safePilotSupportTicket.create({
    data: {
      ticketCode,
      conversationId: input.conversationId,
      roleScope: input.roleScope as any,
      userId: input.userId,
      country: input.country as any,
      service: input.service.toUpperCase() as any,
      reason: input.reason,
      severity: input.severity as any,
      rideId: input.rideId,
      foodOrderId: input.foodOrderId,
      deliveryId: input.deliveryId,
    },
  });
  
  // Mark conversation as escalated
  await prisma.safePilotConversation.update({
    where: { id: input.conversationId },
    data: {
      isEscalated: true,
      escalatedAt: new Date(),
      status: 'escalated',
    },
  });
  
  // Log audit
  await logAuditAction(adminUserId, 'CREATE_TICKET', { ticketCode, conversationId: input.conversationId, severity: input.severity });
  
  return { ticketCode, id: ticket.id };
}

// Assign ticket to admin
export async function assignTicket(
  ticketId: string,
  assignedToAdminId: string,
  adminUserId: string
): Promise<{ success: boolean }> {
  await prisma.safePilotSupportTicket.update({
    where: { id: ticketId },
    data: {
      assignedToAdminId,
      status: 'ASSIGNED',
    },
  });
  
  // Log audit
  await logAuditAction(adminUserId, 'ASSIGN_TICKET', { ticketId, assignedToAdminId });
  
  return { success: true };
}

// Resolve ticket
export async function resolveTicket(
  ticketId: string,
  resolutionReason: string,
  adminUserId: string
): Promise<{ success: boolean }> {
  const ticket = await prisma.safePilotSupportTicket.update({
    where: { id: ticketId },
    data: {
      status: 'RESOLVED',
      resolutionReason,
      resolvedAt: new Date(),
    },
  });
  
  // Update conversation status
  await prisma.safePilotConversation.update({
    where: { id: ticket.conversationId },
    data: { status: 'resolved' },
  });
  
  // Log audit
  await logAuditAction(adminUserId, 'RESOLVE_TICKET', { ticketId, resolutionReason });
  
  return { success: true };
}

// Add internal note
export async function addInternalNote(
  ticketId: string,
  note: string,
  adminUserId: string
): Promise<{ id: string }> {
  const internalNote = await prisma.safePilotInternalNote.create({
    data: {
      ticketId,
      adminUserId,
      note,
    },
  });
  
  // Log audit
  await logAuditAction(adminUserId, 'ADD_INTERNAL_NOTE', { ticketId, noteId: internalNote.id });
  
  return { id: internalNote.id };
}

// List tickets with filters
export async function listTickets(
  filters: {
    roleScope?: RoleScope;
    status?: 'OPEN' | 'ASSIGNED' | 'RESOLVED' | 'ALL';
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'ALL';
    assignedToAdminId?: string;
    limit?: number;
    cursor?: string;
  },
  adminUserId: string
): Promise<{ tickets: any[]; cursor: string | null; total: number }> {
  const limit = filters.limit || 20;
  
  const where: any = {};
  
  if (filters.roleScope) {
    where.roleScope = filters.roleScope;
  }
  
  if (filters.status && filters.status !== 'ALL') {
    where.status = filters.status;
  }
  
  if (filters.severity && filters.severity !== 'ALL') {
    where.severity = filters.severity;
  }
  
  if (filters.assignedToAdminId) {
    where.assignedToAdminId = filters.assignedToAdminId;
  }
  
  if (filters.cursor) {
    where.id = { lt: filters.cursor };
  }
  
  const tickets = await prisma.safePilotSupportTicket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    include: {
      internalNotes: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
  
  const hasMore = tickets.length > limit;
  const items = hasMore ? tickets.slice(0, limit) : tickets;
  const nextCursor = hasMore ? items[items.length - 1].id : null;
  
  const total = await prisma.safePilotSupportTicket.count({ where });
  
  return {
    tickets: items.map((t: any) => ({
      id: t.id,
      ticketCode: t.ticketCode,
      roleScope: t.roleScope,
      userId: t.userId,
      country: t.country,
      service: t.service,
      reason: t.reason,
      severity: t.severity,
      status: t.status,
      assignedToAdminId: t.assignedToAdminId,
      resolutionReason: t.resolutionReason,
      lastNote: t.internalNotes[0]?.note.slice(0, 100) || null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      resolvedAt: t.resolvedAt,
    })),
    cursor: nextCursor,
    total,
  };
}

// Get admin audit logs for support center
export async function getSupportAuditLogs(
  filters: {
    from?: Date;
    to?: Date;
    limit?: number;
    cursor?: string;
  },
  adminUserId: string
): Promise<{ logs: any[]; cursor: string | null; total: number }> {
  const limit = filters.limit || 50;
  
  const where: any = {
    action: {
      in: [
        'VIEW_CONVERSATIONS',
        'VIEW_CONVERSATION_DETAIL',
        'CREATE_TICKET',
        'ASSIGN_TICKET',
        'RESOLVE_TICKET',
        'ADD_INTERNAL_NOTE',
      ],
    },
  };
  
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = filters.from;
    if (filters.to) where.createdAt.lte = filters.to;
  }
  
  if (filters.cursor) {
    where.id = { lt: filters.cursor };
  }
  
  const logs = await prisma.safePilotAuditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });
  
  const hasMore = logs.length > limit;
  const items = hasMore ? logs.slice(0, limit) : logs;
  const nextCursor = hasMore ? items[items.length - 1].id : null;
  
  const total = await prisma.safePilotAuditLog.count({ where });
  
  return {
    logs: items,
    cursor: nextCursor,
    total,
  };
}

// Helper functions
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***.***';
  const maskedLocal = local.slice(0, 2) + '***';
  return `${maskedLocal}@${domain}`;
}
