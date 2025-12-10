import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { rateLimitSupport } from '../middleware/rateLimit';
import { authenticateToken, requireRole, type AuthRequest } from '../middleware/auth';
import { getClientIp } from '../utils/ip';
import { logAuditEvent } from '../utils/audit';
import { triggerPartnerNotification, getNotificationLogs, type PartnerType } from '../services/partnerEmailService';

const router = Router();

const VALID_REGIONS = ['BD', 'US'] as const;
const REGION_TO_COUNTRY: Record<string, string> = {
  BD: 'Bangladesh',
  US: 'United States'
};

const driverApplicationSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits').max(20),
  email: z.string().email('Invalid email address').max(255),
  city: z.string().min(2, 'City is required').max(100),
  serviceType: z.enum(['ride_driver', 'delivery_courier']),
  vehicleType: z.enum(['car', 'motorcycle', 'bicycle', 'walking']),
  region: z.enum(VALID_REGIONS)
});

const restaurantApplicationSchema = z.object({
  restaurantName: z.string().min(2, 'Restaurant name is required').max(200),
  ownerName: z.string().min(2, 'Owner name is required').max(100),
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits').max(20),
  businessEmail: z.string().email('Invalid email address').max(255),
  city: z.string().min(2, 'City is required').max(100),
  cuisineType: z.string().min(2, 'Cuisine type is required').max(100)
});

const shopApplicationSchema = z.object({
  shopName: z.string().min(2, 'Shop name is required').max(200),
  ownerName: z.string().min(2, 'Owner name is required').max(100),
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits').max(20),
  category: z.enum(['electronics', 'groceries', 'clothing', 'essentials']),
  city: z.string().min(2, 'City is required').max(100)
});

const ticketApplicationSchema = z.object({
  businessName: z.string().min(2, 'Business name is required').max(200),
  contactPerson: z.string().min(2, 'Contact person is required').max(100),
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits').max(20),
  ticketType: z.enum(['bus', 'train', 'launch', 'event']),
  city: z.string().min(2, 'City is required').max(100)
});

const statusUpdateSchema = z.object({
  status: z.enum(['new', 'in_review', 'approved', 'rejected']),
  note: z.string().max(1000).optional()
});

router.post('/driver', rateLimitSupport, async (req: Request, res: Response) => {
  try {
    const validationResult = driverApplicationSchema.safeParse(req.body);
    
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

    const application = await prisma.driverPartnerApplication.create({
      data: {
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        email: data.email,
        city: data.city,
        serviceType: data.serviceType,
        vehicleType: data.vehicleType,
        region: data.region,
        country: REGION_TO_COUNTRY[data.region],
        status: 'new',
        adminNotes: [],
        metadata: { ip, userAgent, submittedAt: new Date().toISOString() }
      }
    });

    await logAuditEvent({
      actorId: null,
      actorEmail: data.email,
      actorRole: 'public',
      ipAddress: ip,
      actionType: 'DRIVER_APPLICATION_SUBMITTED',
      entityType: 'driver_partner_application',
      entityId: application.id,
      description: `Driver/courier application submitted: ${data.fullName} from ${data.city}, ${data.region}`,
      metadata: { serviceType: data.serviceType, vehicleType: data.vehicleType },
      success: true
    });

    console.log(`[PartnerOnboarding] Driver application from ${data.email} - ${data.serviceType}, ${data.region}`);

    return res.status(201).json({
      success: true,
      message: 'Your application has been received. We will review it within 3-5 business days.',
      applicationId: application.id
    });
  } catch (error) {
    console.error('[PartnerOnboarding] Driver application error:', error);
    return res.status(500).json({ error: 'Failed to submit application. Please try again.' });
  }
});

router.post('/restaurant', rateLimitSupport, async (req: Request, res: Response) => {
  try {
    const validationResult = restaurantApplicationSchema.safeParse(req.body);
    
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

    const application = await prisma.restaurantPartnerApplication.create({
      data: {
        restaurantName: data.restaurantName,
        ownerName: data.ownerName,
        phoneNumber: data.phoneNumber,
        businessEmail: data.businessEmail,
        city: data.city,
        cuisineType: data.cuisineType,
        region: 'BD',
        country: 'Bangladesh',
        status: 'new',
        adminNotes: [],
        metadata: { ip, userAgent, submittedAt: new Date().toISOString() }
      }
    });

    await logAuditEvent({
      actorId: null,
      actorEmail: data.businessEmail,
      actorRole: 'public',
      ipAddress: ip,
      actionType: 'RESTAURANT_APPLICATION_SUBMITTED',
      entityType: 'restaurant_partner_application',
      entityId: application.id,
      description: `Restaurant application submitted: ${data.restaurantName} from ${data.city}`,
      metadata: { cuisineType: data.cuisineType },
      success: true
    });

    console.log(`[PartnerOnboarding] Restaurant application from ${data.businessEmail} - ${data.restaurantName}`);

    return res.status(201).json({
      success: true,
      message: 'Your restaurant application has been received. We will review it within 3-5 business days.',
      applicationId: application.id
    });
  } catch (error) {
    console.error('[PartnerOnboarding] Restaurant application error:', error);
    return res.status(500).json({ error: 'Failed to submit application. Please try again.' });
  }
});

router.post('/shop', rateLimitSupport, async (req: Request, res: Response) => {
  try {
    const validationResult = shopApplicationSchema.safeParse(req.body);
    
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

    const application = await prisma.shopPartnerApplication.create({
      data: {
        shopName: data.shopName,
        ownerName: data.ownerName,
        phoneNumber: data.phoneNumber,
        category: data.category,
        city: data.city,
        region: 'BD',
        country: 'Bangladesh',
        status: 'new',
        adminNotes: [],
        metadata: { ip, userAgent, submittedAt: new Date().toISOString() }
      }
    });

    await logAuditEvent({
      actorId: null,
      actorEmail: null,
      actorRole: 'public',
      ipAddress: ip,
      actionType: 'SHOP_APPLICATION_SUBMITTED',
      entityType: 'shop_partner_application',
      entityId: application.id,
      description: `Shop application submitted: ${data.shopName} from ${data.city}`,
      metadata: { category: data.category },
      success: true
    });

    console.log(`[PartnerOnboarding] Shop application - ${data.shopName}, ${data.category}`);

    return res.status(201).json({
      success: true,
      message: 'Your shop application has been received. We will review it within 3-5 business days.',
      applicationId: application.id
    });
  } catch (error) {
    console.error('[PartnerOnboarding] Shop application error:', error);
    return res.status(500).json({ error: 'Failed to submit application. Please try again.' });
  }
});

router.post('/ticket', rateLimitSupport, async (req: Request, res: Response) => {
  try {
    const validationResult = ticketApplicationSchema.safeParse(req.body);
    
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

    const application = await prisma.ticketPartnerApplication.create({
      data: {
        businessName: data.businessName,
        contactPerson: data.contactPerson,
        phoneNumber: data.phoneNumber,
        ticketType: data.ticketType,
        city: data.city,
        region: 'BD',
        country: 'Bangladesh',
        status: 'new',
        adminNotes: [],
        metadata: { ip, userAgent, submittedAt: new Date().toISOString() }
      }
    });

    await logAuditEvent({
      actorId: null,
      actorEmail: null,
      actorRole: 'public',
      ipAddress: ip,
      actionType: 'TICKET_APPLICATION_SUBMITTED',
      entityType: 'ticket_partner_application',
      entityId: application.id,
      description: `Ticket partner application submitted: ${data.businessName} from ${data.city}`,
      metadata: { ticketType: data.ticketType },
      success: true
    });

    console.log(`[PartnerOnboarding] Ticket application - ${data.businessName}, ${data.ticketType}`);

    return res.status(201).json({
      success: true,
      message: 'Your ticket partner application has been received. We will review it within 3-5 business days.',
      applicationId: application.id
    });
  } catch (error) {
    console.error('[PartnerOnboarding] Ticket application error:', error);
    return res.status(500).json({ error: 'Failed to submit application. Please try again.' });
  }
});

router.get('/drivers', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { status, region, city, search, serviceType, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const conditions: any[] = [];
    if (status && status !== 'all') conditions.push({ status });
    if (region && region !== 'all') conditions.push({ region });
    if (city) conditions.push({ city: { contains: city as string, mode: 'insensitive' } });
    if (serviceType && serviceType !== 'all') conditions.push({ serviceType });
    if (search) {
      conditions.push({
        OR: [
          { fullName: { contains: search as string, mode: 'insensitive' } },
          { phoneNumber: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } }
        ]
      });
    }
    const where = conditions.length > 0 ? { AND: conditions } : {};

    const [applications, total] = await Promise.all([
      prisma.driverPartnerApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum
      }),
      prisma.driverPartnerApplication.count({ where })
    ]);

    const stats = await prisma.driverPartnerApplication.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const statsMap = stats.reduce((acc, s) => {
      acc[s.status] = s._count.id;
      return acc;
    }, {} as Record<string, number>);

    return res.json({
      applications,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
      stats: { new: statsMap.new || 0, in_review: statsMap.in_review || 0, approved: statsMap.approved || 0, rejected: statsMap.rejected || 0 }
    });
  } catch (error) {
    console.error('[PartnerOnboarding] List drivers error:', error);
    return res.status(500).json({ error: 'Failed to fetch driver applications' });
  }
});

router.get('/restaurants', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { status, city, cuisineType, search, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const conditions: any[] = [];
    if (status && status !== 'all') conditions.push({ status });
    if (city) conditions.push({ city: { contains: city as string, mode: 'insensitive' } });
    if (cuisineType) conditions.push({ cuisineType });
    if (search) {
      conditions.push({
        OR: [
          { restaurantName: { contains: search as string, mode: 'insensitive' } },
          { ownerName: { contains: search as string, mode: 'insensitive' } },
          { phoneNumber: { contains: search as string, mode: 'insensitive' } }
        ]
      });
    }
    const where = conditions.length > 0 ? { AND: conditions } : {};

    const [applications, total] = await Promise.all([
      prisma.restaurantPartnerApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum
      }),
      prisma.restaurantPartnerApplication.count({ where })
    ]);

    const stats = await prisma.restaurantPartnerApplication.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const statsMap = stats.reduce((acc, s) => {
      acc[s.status] = s._count.id;
      return acc;
    }, {} as Record<string, number>);

    return res.json({
      applications,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
      stats: { new: statsMap.new || 0, in_review: statsMap.in_review || 0, approved: statsMap.approved || 0, rejected: statsMap.rejected || 0 }
    });
  } catch (error) {
    console.error('[PartnerOnboarding] List restaurants error:', error);
    return res.status(500).json({ error: 'Failed to fetch restaurant applications' });
  }
});

router.get('/shops', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { status, city, category, search, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const conditions: any[] = [];
    if (status && status !== 'all') conditions.push({ status });
    if (city) conditions.push({ city: { contains: city as string, mode: 'insensitive' } });
    if (category) conditions.push({ category });
    if (search) {
      conditions.push({
        OR: [
          { shopName: { contains: search as string, mode: 'insensitive' } },
          { ownerName: { contains: search as string, mode: 'insensitive' } },
          { phoneNumber: { contains: search as string, mode: 'insensitive' } }
        ]
      });
    }
    const where = conditions.length > 0 ? { AND: conditions } : {};

    const [applications, total] = await Promise.all([
      prisma.shopPartnerApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum
      }),
      prisma.shopPartnerApplication.count({ where })
    ]);

    const stats = await prisma.shopPartnerApplication.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const statsMap = stats.reduce((acc, s) => {
      acc[s.status] = s._count.id;
      return acc;
    }, {} as Record<string, number>);

    return res.json({
      applications,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
      stats: { new: statsMap.new || 0, in_review: statsMap.in_review || 0, approved: statsMap.approved || 0, rejected: statsMap.rejected || 0 }
    });
  } catch (error) {
    console.error('[PartnerOnboarding] List shops error:', error);
    return res.status(500).json({ error: 'Failed to fetch shop applications' });
  }
});

router.get('/tickets', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { status, city, ticketType, search, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const conditions: any[] = [];
    if (status && status !== 'all') conditions.push({ status });
    if (city) conditions.push({ city: { contains: city as string, mode: 'insensitive' } });
    if (ticketType) conditions.push({ ticketType });
    if (search) {
      conditions.push({
        OR: [
          { businessName: { contains: search as string, mode: 'insensitive' } },
          { contactPerson: { contains: search as string, mode: 'insensitive' } },
          { phoneNumber: { contains: search as string, mode: 'insensitive' } }
        ]
      });
    }
    const where = conditions.length > 0 ? { AND: conditions } : {};

    const [applications, total] = await Promise.all([
      prisma.ticketPartnerApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum
      }),
      prisma.ticketPartnerApplication.count({ where })
    ]);

    const stats = await prisma.ticketPartnerApplication.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const statsMap = stats.reduce((acc, s) => {
      acc[s.status] = s._count.id;
      return acc;
    }, {} as Record<string, number>);

    return res.json({
      applications,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
      stats: { new: statsMap.new || 0, in_review: statsMap.in_review || 0, approved: statsMap.approved || 0, rejected: statsMap.rejected || 0 }
    });
  } catch (error) {
    console.error('[PartnerOnboarding] List tickets error:', error);
    return res.status(500).json({ error: 'Failed to fetch ticket applications' });
  }
});

router.get('/drivers/:id', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const application = await prisma.driverPartnerApplication.findUnique({ where: { id: req.params.id } });
    if (!application) return res.status(404).json({ error: 'Application not found' });
    return res.json(application);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch application' });
  }
});

router.get('/restaurants/:id', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const application = await prisma.restaurantPartnerApplication.findUnique({ where: { id: req.params.id } });
    if (!application) return res.status(404).json({ error: 'Application not found' });
    return res.json(application);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch application' });
  }
});

router.get('/shops/:id', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const application = await prisma.shopPartnerApplication.findUnique({ where: { id: req.params.id } });
    if (!application) return res.status(404).json({ error: 'Application not found' });
    return res.json(application);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch application' });
  }
});

router.get('/tickets/:id', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const application = await prisma.ticketPartnerApplication.findUnique({ where: { id: req.params.id } });
    if (!application) return res.status(404).json({ error: 'Application not found' });
    return res.json(application);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch application' });
  }
});

router.patch('/drivers/:id', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = statusUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: 'Invalid status update' });
    }

    const { status, note } = validationResult.data;
    const existing = await prisma.driverPartnerApplication.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Application not found' });

    const adminNotes = Array.isArray(existing.adminNotes) ? existing.adminNotes : [];
    if (note) {
      adminNotes.push({
        text: note,
        addedAt: new Date().toISOString(),
        addedBy: req.user?.email || 'admin'
      });
    }

    const updated = await prisma.driverPartnerApplication.update({
      where: { id: req.params.id },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedByAdminId: req.user?.id,
        adminNotes
      }
    });

    await logAuditEvent({
      actorId: req.user?.id || null,
      actorEmail: req.user?.email || null,
      actorRole: 'admin',
      ipAddress: getClientIp(req),
      actionType: 'DRIVER_APPLICATION_STATUS_UPDATED',
      entityType: 'driver_partner_application',
      entityId: req.params.id,
      description: `Driver application status updated to ${status}`,
      metadata: { previousStatus: existing.status, newStatus: status },
      success: true
    });

    // Trigger email notification (non-blocking)
    triggerPartnerNotification({
      partnerType: 'DRIVER',
      applicationId: existing.id,
      newStatus: status,
      previousStatus: existing.status,
      recipientEmail: existing.email,
      recipientName: existing.fullName,
      region: existing.region,
      country: existing.country,
      adminId: req.user?.id,
      additionalData: { serviceType: existing.serviceType, vehicleType: existing.vehicleType }
    }).catch(err => console.error('[PartnerOnboarding] Driver email notification failed:', err));

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update application' });
  }
});

router.patch('/restaurants/:id', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = statusUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: 'Invalid status update' });
    }

    const { status, note } = validationResult.data;
    const existing = await prisma.restaurantPartnerApplication.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Application not found' });

    const adminNotes = Array.isArray(existing.adminNotes) ? existing.adminNotes : [];
    if (note) {
      adminNotes.push({
        text: note,
        addedAt: new Date().toISOString(),
        addedBy: req.user?.email || 'admin'
      });
    }

    const updated = await prisma.restaurantPartnerApplication.update({
      where: { id: req.params.id },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedByAdminId: req.user?.id,
        adminNotes
      }
    });

    await logAuditEvent({
      actorId: req.user?.id || null,
      actorEmail: req.user?.email || null,
      actorRole: 'admin',
      ipAddress: getClientIp(req),
      actionType: 'RESTAURANT_APPLICATION_STATUS_UPDATED',
      entityType: 'restaurant_partner_application',
      entityId: req.params.id,
      description: `Restaurant application status updated to ${status}`,
      metadata: { previousStatus: existing.status, newStatus: status },
      success: true
    });

    // Trigger email notification (non-blocking)
    triggerPartnerNotification({
      partnerType: 'RESTAURANT',
      applicationId: existing.id,
      newStatus: status,
      previousStatus: existing.status,
      recipientEmail: existing.businessEmail,
      recipientName: existing.ownerName,
      region: existing.region,
      country: existing.country,
      adminId: req.user?.id,
      additionalData: { restaurantName: existing.restaurantName, cuisineType: existing.cuisineType }
    }).catch(err => console.error('[PartnerOnboarding] Restaurant email notification failed:', err));

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update application' });
  }
});

router.patch('/shops/:id', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = statusUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: 'Invalid status update' });
    }

    const { status, note } = validationResult.data;
    const existing = await prisma.shopPartnerApplication.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Application not found' });

    const adminNotes = Array.isArray(existing.adminNotes) ? existing.adminNotes : [];
    if (note) {
      adminNotes.push({
        text: note,
        addedAt: new Date().toISOString(),
        addedBy: req.user?.email || 'admin'
      });
    }

    const updated = await prisma.shopPartnerApplication.update({
      where: { id: req.params.id },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedByAdminId: req.user?.id,
        adminNotes
      }
    });

    await logAuditEvent({
      actorId: req.user?.id || null,
      actorEmail: req.user?.email || null,
      actorRole: 'admin',
      ipAddress: getClientIp(req),
      actionType: 'SHOP_APPLICATION_STATUS_UPDATED',
      entityType: 'shop_partner_application',
      entityId: req.params.id,
      description: `Shop application status updated to ${status}`,
      metadata: { previousStatus: existing.status, newStatus: status },
      success: true
    });

    // Trigger email notification (non-blocking) - only if email exists
    if (existing.email) {
      triggerPartnerNotification({
        partnerType: 'SHOP',
        applicationId: existing.id,
        newStatus: status,
        previousStatus: existing.status,
        recipientEmail: existing.email,
        recipientName: existing.ownerName,
        region: existing.region,
        country: existing.country,
        adminId: req.user?.id,
        additionalData: { shopName: existing.shopName, category: existing.category }
      }).catch(err => console.error('[PartnerOnboarding] Shop email notification failed:', err));
    }

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update application' });
  }
});

router.patch('/tickets/:id', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = statusUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: 'Invalid status update' });
    }

    const { status, note } = validationResult.data;
    const existing = await prisma.ticketPartnerApplication.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Application not found' });

    const adminNotes = Array.isArray(existing.adminNotes) ? existing.adminNotes : [];
    if (note) {
      adminNotes.push({
        text: note,
        addedAt: new Date().toISOString(),
        addedBy: req.user?.email || 'admin'
      });
    }

    const updated = await prisma.ticketPartnerApplication.update({
      where: { id: req.params.id },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedByAdminId: req.user?.id,
        adminNotes
      }
    });

    await logAuditEvent({
      actorId: req.user?.id || null,
      actorEmail: req.user?.email || null,
      actorRole: 'admin',
      ipAddress: getClientIp(req),
      actionType: 'TICKET_APPLICATION_STATUS_UPDATED',
      entityType: 'ticket_partner_application',
      entityId: req.params.id,
      description: `Ticket application status updated to ${status}`,
      metadata: { previousStatus: existing.status, newStatus: status },
      success: true
    });

    // Trigger email notification (non-blocking) - only if email exists
    if (existing.email) {
      triggerPartnerNotification({
        partnerType: 'TICKET',
        applicationId: existing.id,
        newStatus: status,
        previousStatus: existing.status,
        recipientEmail: existing.email,
        recipientName: existing.contactPerson,
        region: existing.region,
        country: existing.country,
        adminId: req.user?.id,
        additionalData: { businessName: existing.businessName, ticketType: existing.ticketType }
      }).catch(err => console.error('[PartnerOnboarding] Ticket email notification failed:', err));
    }

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update application' });
  }
});

// ========================================
// NOTIFICATION LOGS ENDPOINTS
// ========================================

router.get('/notifications/logs', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { partnerType, success, page = '1', limit = '20' } = req.query;
    
    const result = await getNotificationLogs({
      partnerType: partnerType as string,
      success: success === 'true' ? true : success === 'false' ? false : undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    });

    return res.json(result);
  } catch (error) {
    console.error('[PartnerOnboarding] Get notification logs error:', error);
    return res.status(500).json({ error: 'Failed to fetch notification logs' });
  }
});

router.get('/notifications/:applicationId', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { applicationId } = req.params;
    
    const result = await getNotificationLogs({
      partnerApplicationId: applicationId,
      page: 1,
      limit: 100
    });

    return res.json(result);
  } catch (error) {
    console.error('[PartnerOnboarding] Get application notifications error:', error);
    return res.status(500).json({ error: 'Failed to fetch notification history' });
  }
});

export default router;
