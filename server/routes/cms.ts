import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const CMS_PAGE_CATEGORIES = ['legal', 'company', 'support', 'partner'] as const;
const CMS_PAGE_STATUSES = ['draft', 'published'] as const;
const CMS_PAGE_VISIBILITIES = ['public_visible', 'partner_only'] as const;

const createPageSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  title: z.string().min(1).max(200),
  body: z.string(),
  category: z.enum(CMS_PAGE_CATEGORIES).default('company'),
  status: z.enum(CMS_PAGE_STATUSES).default('draft'),
  visibility: z.enum(CMS_PAGE_VISIBILITIES).default('public_visible'),
  metaDescription: z.string().optional(),
  metaKeywords: z.string().optional()
});

const updatePageSchema = createPageSchema.partial().omit({ slug: true });

router.get('/public/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const page = await (prisma as any).cmsPage.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        body: true,
        category: true,
        status: true,
        visibility: true,
        metaDescription: true,
        metaKeywords: true,
        updatedAt: true
      }
    });

    if (!page) {
      return res.status(404).json({ 
        error: 'Page not found',
        message: 'The requested page does not exist'
      });
    }

    if (page.status !== 'published') {
      return res.status(404).json({ 
        error: 'Page not available',
        message: 'This page is not yet published'
      });
    }

    if (page.visibility === 'partner_only') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'This page is only available to partners'
      });
    }

    return res.json(page);
  } catch (error) {
    console.error('[CMS] Error fetching public page:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const adminAuth = [authenticateToken, requireRole(['admin', 'super_admin', 'compliance_admin'])];

router.get('/admin', ...adminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { category, status, search } = req.query;

    const where: any = {};
    
    if (category && CMS_PAGE_CATEGORIES.includes(category as any)) {
      where.category = category;
    }
    if (status && CMS_PAGE_STATUSES.includes(status as any)) {
      where.status = status;
    }
    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } }
      ];
    }

    const pages = await (prisma as any).cmsPage.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        status: true,
        visibility: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return res.json({ pages });
  } catch (error) {
    console.error('[CMS] Error listing pages:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/admin/:id', ...adminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const page = await (prisma as any).cmsPage.findUnique({
      where: { id }
    });

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    return res.json(page);
  } catch (error) {
    console.error('[CMS] Error fetching page:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin', ...adminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const validated = createPageSchema.parse(req.body);
    const adminId = req.user?.id;

    const existingPage = await (prisma as any).cmsPage.findUnique({
      where: { slug: validated.slug }
    });

    if (existingPage) {
      return res.status(400).json({ error: 'A page with this slug already exists' });
    }

    const page = await (prisma as any).cmsPage.create({
      data: {
        ...validated,
        createdByAdminId: adminId,
        updatedByAdminId: adminId
      }
    });

    return res.status(201).json(page);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[CMS] Error creating page:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/admin/:id', ...adminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validated = updatePageSchema.parse(req.body);
    const adminId = req.user?.id;

    const existingPage = await (prisma as any).cmsPage.findUnique({
      where: { id }
    });

    if (!existingPage) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const page = await (prisma as any).cmsPage.update({
      where: { id },
      data: {
        ...validated,
        updatedByAdminId: adminId
      }
    });

    return res.json(page);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[CMS] Error updating page:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/admin/:id', ...adminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingPage = await (prisma as any).cmsPage.findUnique({
      where: { id }
    });

    if (!existingPage) {
      return res.status(404).json({ error: 'Page not found' });
    }

    await (prisma as any).cmsPage.delete({ where: { id } });

    return res.json({ success: true, message: 'Page deleted successfully' });
  } catch (error) {
    console.error('[CMS] Error deleting page:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
