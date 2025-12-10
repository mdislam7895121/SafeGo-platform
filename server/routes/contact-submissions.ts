import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { rateLimitSupport } from '../middleware/rateLimit';
import { authenticateToken, AuthRequest, requireAdminAccess, hasAdminCapability } from '../middleware/auth';
import { getClientIp } from '../utils/ip';
import { logAuditEvent } from '../utils/audit';

const router = Router();

const VALID_REGIONS = ['BD', 'US', 'GLOBAL'] as const;

const CATEGORY_TO_SERVICE: Record<string, string> = {
  rides: 'rides',
  food: 'food',
  parcel: 'parcel',
  shops: 'shops',
  tickets: 'tickets',
  driver: 'driver',
  partner: 'business',
  payment: 'payments',
  safety: 'safety',
  technical: 'technical',
  general: 'general',
  other: 'general'
};

const REGION_TO_COUNTRY: Record<string, string> = {
  BD: 'Bangladesh',
  US: 'United States',
  GLOBAL: 'Global'
};

const contactSubmissionSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  email: z.string().email('Invalid email address').max(255),
  category: z.string().min(1, 'Category is required'),
  categoryLabel: z.string().min(1, 'Category label is required'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000, 'Message too long'),
  region: z.enum(VALID_REGIONS).optional().default('GLOBAL')
});

router.post('/', rateLimitSupport, async (req: Request, res: Response) => {
  try {
    const validationResult = contactSubmissionSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message
        }))
      });
    }

    const data = validationResult.data;
    const ip = getClientIp(req);
    const userAgent = req.get('User-Agent') || 'unknown';

    const submission = await prisma.contactSubmission.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        category: data.category,
        categoryLabel: data.categoryLabel,
        message: data.message,
        region: data.region,
        country: REGION_TO_COUNTRY[data.region] || 'Global',
        relatedService: CATEGORY_TO_SERVICE[data.category] || 'general',
        source: 'landing_contact_form',
        status: 'open',
        priority: data.category === 'safety' ? 'high' : 'low',
        metadata: {
          ip,
          userAgent,
          submittedAt: new Date().toISOString()
        },
        internalNotes: []
      }
    });

    await logAuditEvent({
      actorId: null,
      actorEmail: data.email,
      actorRole: 'public',
      ipAddress: ip,
      actionType: 'CONTACT_FORM_SUBMITTED',
      entityType: 'contact_submission',
      entityId: submission.id,
      description: `Contact form submitted: ${data.categoryLabel} from ${data.region}`,
      metadata: {
        category: data.category,
        region: data.region
      },
      success: true
    });

    console.log(`[Contact] New submission from ${data.email} - Category: ${data.category}, Region: ${data.region}`);

    return res.status(201).json({
      success: true,
      message: 'Your message has been received. Our team will respond within 24-48 hours.',
      ticketId: submission.id
    });
  } catch (error) {
    console.error('[Contact] Error creating submission:', error);
    return res.status(500).json({
      error: 'Failed to submit your message. Please try again later.'
    });
  }
});

router.get('/', authenticateToken, requireAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    if (!hasAdminCapability(req.user, 'SUPPORT_VIEW')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const {
      status,
      priority,
      region,
      category,
      search,
      assignedToMe,
      page = '1',
      limit = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (status && status !== 'all') {
      where.status = status;
    }
    if (priority && priority !== 'all') {
      where.priority = priority;
    }
    if (region && region !== 'all') {
      where.region = region;
    }
    if (category && category !== 'all') {
      where.category = category;
    }
    if (assignedToMe === 'true' && req.user?.adminId) {
      where.assignedToAdminId = req.user.adminId;
    }
    if (search) {
      where.OR = [
        { fullName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { message: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder === 'asc' ? 'asc' : 'desc';

    const [submissions, total] = await Promise.all([
      prisma.contactSubmission.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          fullName: true,
          email: true,
          country: true,
          region: true,
          category: true,
          categoryLabel: true,
          status: true,
          priority: true,
          relatedService: true,
          assignedToAdminId: true,
          resolvedAt: true
        }
      }),
      prisma.contactSubmission.count({ where })
    ]);

    const stats = await prisma.contactSubmission.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const statusCounts = {
      open: 0,
      pending: 0,
      resolved: 0
    };
    stats.forEach(s => {
      if (s.status in statusCounts) {
        statusCounts[s.status as keyof typeof statusCounts] = s._count.id;
      }
    });

    return res.json({
      submissions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      },
      stats: statusCounts
    });
  } catch (error) {
    console.error('[Contact Admin] Error fetching submissions:', error);
    return res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

router.get('/:id', authenticateToken, requireAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    if (!hasAdminCapability(req.user, 'SUPPORT_VIEW')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { id } = req.params;

    const submission = await prisma.contactSubmission.findUnique({
      where: { id }
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    return res.json(submission);
  } catch (error) {
    console.error('[Contact Admin] Error fetching submission:', error);
    return res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

const updateSubmissionSchema = z.object({
  status: z.enum(['open', 'pending', 'resolved']).optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  assignedToAdminId: z.string().nullable().optional(),
  internalNote: z.string().max(2000).optional()
});

router.patch('/:id', authenticateToken, requireAdminAccess, async (req: AuthRequest, res: Response) => {
  try {
    if (!hasAdminCapability(req.user, 'SUPPORT_MANAGE')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { id } = req.params;
    const validationResult = updateSubmissionSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.issues
      });
    }

    const data = validationResult.data;
    const existing = await prisma.contactSubmission.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const updateData: any = {};

    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === 'resolved' && !existing.resolvedAt) {
        updateData.resolvedAt = new Date();
      }
    }
    if (data.priority !== undefined) {
      updateData.priority = data.priority;
    }
    if (data.assignedToAdminId !== undefined) {
      updateData.assignedToAdminId = data.assignedToAdminId;
    }

    if (data.internalNote) {
      const existingNotes = (existing.internalNotes as any[]) || [];
      existingNotes.push({
        note: data.internalNote,
        addedBy: req.user?.email || 'admin',
        addedAt: new Date().toISOString()
      });
      updateData.internalNotes = existingNotes;
    }

    const updated = await prisma.contactSubmission.update({
      where: { id },
      data: updateData
    });

    await logAuditEvent({
      actorId: req.user?.adminId || null,
      actorEmail: req.user?.email || null,
      actorRole: 'admin',
      ipAddress: getClientIp(req),
      actionType: 'CONTACT_SUBMISSION_UPDATED',
      entityType: 'contact_submission',
      entityId: id,
      description: `Contact submission ${id} updated`,
      metadata: {
        changes: Object.keys(updateData)
      },
      success: true
    });

    return res.json(updated);
  } catch (error) {
    console.error('[Contact Admin] Error updating submission:', error);
    return res.status(500).json({ error: 'Failed to update submission' });
  }
});

export default router;
