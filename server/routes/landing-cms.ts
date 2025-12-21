import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
const adminAuth = [authenticateToken, requireRole(['admin', 'super_admin', 'compliance_admin'])];

const sectionKeySchema = z.enum([
  'hero', 'services', 'how_it_works', 'safety', 'partners', 
  'faq', 'ready_to_move', 'footer', 'announcement_bar', 'contact_cta'
]);

const countrySchema = z.enum(['BD', 'US', 'GLOBAL']);

const createSectionSchema = z.object({
  key: sectionKeySchema,
  orderIndex: z.number().int().min(0).default(0),
  isEnabled: z.boolean().default(true),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  body: z.string().optional(),
  ctas: z.any().optional(),
  media: z.any().optional(),
  settings: z.any().optional()
});

const updateSectionSchema = createSectionSchema.partial();

const updateSettingsSchema = z.object({
  defaultRegion: z.string().optional(),
  showTestingBanner: z.boolean().optional(),
  testingBannerText: z.string().optional(),
  supportEmail: z.string().email().optional().nullable(),
  supportPhone: z.string().optional().nullable(),
  socialLinks: z.any().optional(),
  footerLinks: z.any().optional(),
  legalLinks: z.any().optional(),
  servicesConfig: z.any().optional()
});

async function logAudit(adminId: string, entityType: string, entityId: string, action: string, diffSummary?: any) {
  try {
    await (prisma as any).landingAuditLog.create({
      data: { adminId, entityType, entityId, action, diffSummary }
    });
  } catch (error) {
    console.error('[LandingCMS] Audit log error:', error);
  }
}

router.get('/public/landing', async (req, res: Response) => {
  try {
    const country = (req.query.country as string) || 'GLOBAL';
    const validCountry = ['BD', 'US', 'GLOBAL'].includes(country) ? country : 'GLOBAL';

    let landingPage = await (prisma as any).landingPage.findFirst({
      where: { country: validCountry, isActive: true },
      include: {
        sections: {
          where: { isEnabled: true },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    if (!landingPage && validCountry !== 'GLOBAL') {
      landingPage = await (prisma as any).landingPage.findFirst({
        where: { country: 'GLOBAL', isActive: true },
        include: {
          sections: {
            where: { isEnabled: true },
            orderBy: { orderIndex: 'asc' }
          }
        }
      });
    }

    let settings = await (prisma as any).landingSettings.findUnique({
      where: { country: validCountry }
    });

    if (!settings && validCountry !== 'GLOBAL') {
      settings = await (prisma as any).landingSettings.findUnique({
        where: { country: 'GLOBAL' }
      });
    }

    if (!landingPage) {
      return res.json({
        useFallback: true,
        country: validCountry,
        settings: settings || null,
        sections: {}
      });
    }

    const sectionsMap: Record<string, any> = {};
    for (const section of landingPage.sections) {
      sectionsMap[section.key] = {
        id: section.id,
        key: section.key,
        orderIndex: section.orderIndex,
        isEnabled: section.isEnabled,
        title: section.title,
        subtitle: section.subtitle,
        body: section.body,
        ctas: section.ctas,
        media: section.media,
        settings: section.settings
      };
    }

    return res.json({
      useFallback: false,
      country: validCountry,
      pageId: landingPage.id,
      locale: landingPage.locale,
      settings: settings ? {
        defaultRegion: settings.defaultRegion,
        showTestingBanner: settings.showTestingBanner,
        testingBannerText: settings.testingBannerText,
        supportEmail: settings.supportEmail,
        supportPhone: settings.supportPhone,
        socialLinks: settings.socialLinks,
        footerLinks: settings.footerLinks,
        legalLinks: settings.legalLinks,
        servicesConfig: settings.servicesConfig
      } : null,
      sections: sectionsMap
    });
  } catch (error) {
    console.error('[LandingCMS] Error fetching public landing:', error);
    return res.json({ useFallback: true, sections: [], settings: null });
  }
});

router.get('/admin/landing/pages', ...adminAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const pages = await (prisma as any).landingPage.findMany({
      orderBy: [{ country: 'asc' }, { createdAt: 'desc' }],
      include: {
        sections: {
          select: { id: true, key: true, isEnabled: true },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    return res.json({ pages });
  } catch (error) {
    console.error('[LandingCMS] Error listing pages:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/landing/pages', ...adminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { country, locale = 'en' } = req.body;
    const validCountry = countrySchema.parse(country);
    const adminId = (req.user as any)?.id;

    const existing = await (prisma as any).landingPage.findFirst({
      where: { country: validCountry, locale }
    });

    if (existing) {
      return res.status(400).json({ error: 'A landing page for this country/locale already exists' });
    }

    const page = await (prisma as any).landingPage.create({
      data: {
        country: validCountry,
        locale,
        isActive: false,
        updatedByAdminId: adminId
      }
    });

    await logAudit(adminId || 'system', 'LandingPage', page.id, 'create', { country: validCountry, locale });

    return res.status(201).json(page);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid country', details: error.errors });
    }
    console.error('[LandingCMS] Error creating page:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/admin/landing/pages/:id', ...adminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const page = await (prisma as any).landingPage.findUnique({
      where: { id },
      include: {
        sections: { orderBy: { orderIndex: 'asc' } }
      }
    });

    if (!page) {
      return res.status(404).json({ error: 'Landing page not found' });
    }

    return res.json(page);
  } catch (error) {
    console.error('[LandingCMS] Error fetching page:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/landing/publish/:country', ...adminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const country = countrySchema.parse(req.params.country);
    const { pageId } = req.body;
    const adminId = (req.user as any)?.id;

    await (prisma as any).landingPage.updateMany({
      where: { country, isActive: true },
      data: { isActive: false }
    });

    const page = await (prisma as any).landingPage.update({
      where: { id: pageId },
      data: { isActive: true, updatedByAdminId: adminId }
    });

    await logAudit(adminId || 'system', 'LandingPage', pageId, 'publish', { country });

    return res.json({ success: true, page });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid country' });
    }
    console.error('[LandingCMS] Error publishing page:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/landing/pages/:id/sections', ...adminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id: landingPageId } = req.params;
    const validated = createSectionSchema.parse(req.body);
    const adminId = (req.user as any)?.id;

    const page = await (prisma as any).landingPage.findUnique({ where: { id: landingPageId } });
    if (!page) {
      return res.status(404).json({ error: 'Landing page not found' });
    }

    const existing = await (prisma as any).landingSection.findFirst({
      where: { landingPageId, key: validated.key }
    });

    if (existing) {
      return res.status(400).json({ error: 'Section with this key already exists on this page' });
    }

    const section = await (prisma as any).landingSection.create({
      data: { landingPageId, ...validated }
    });

    await logAudit(adminId || 'system', 'LandingSection', section.id, 'create', { key: validated.key });

    return res.status(201).json(section);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[LandingCMS] Error creating section:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/admin/landing/sections/:id', ...adminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validated = updateSectionSchema.parse(req.body);
    const adminId = (req.user as any)?.id;

    const existing = await (prisma as any).landingSection.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Section not found' });
    }

    const section = await (prisma as any).landingSection.update({
      where: { id },
      data: validated
    });

    await logAudit(adminId || 'system', 'LandingSection', id, 'update', { changes: Object.keys(validated) });

    return res.json(section);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[LandingCMS] Error updating section:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/admin/landing/sections/:id', ...adminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req.user as any)?.id;

    const existing = await (prisma as any).landingSection.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Section not found' });
    }

    await (prisma as any).landingSection.delete({ where: { id } });

    await logAudit(adminId || 'system', 'LandingSection', id, 'delete', { key: existing.key });

    return res.json({ success: true });
  } catch (error) {
    console.error('[LandingCMS] Error deleting section:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/admin/landing/settings', ...adminAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await (prisma as any).landingSettings.findMany({
      orderBy: { country: 'asc' }
    });

    return res.json({ settings });
  } catch (error) {
    console.error('[LandingCMS] Error listing settings:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/admin/landing/settings/:country', ...adminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const country = countrySchema.parse(req.params.country);

    let settings = await (prisma as any).landingSettings.findUnique({
      where: { country }
    });

    if (!settings) {
      settings = await (prisma as any).landingSettings.create({
        data: { country }
      });
    }

    return res.json(settings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid country' });
    }
    console.error('[LandingCMS] Error fetching settings:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/admin/landing/settings/:country', ...adminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const country = countrySchema.parse(req.params.country);
    const validated = updateSettingsSchema.parse(req.body);
    const adminId = (req.user as any)?.id;

    const settings = await (prisma as any).landingSettings.upsert({
      where: { country },
      update: { ...validated, updatedByAdminId: adminId },
      create: { country, ...validated, updatedByAdminId: adminId }
    });

    await logAudit(adminId || 'system', 'LandingSettings', settings.id, 'update', { country, changes: Object.keys(validated) });

    return res.json(settings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[LandingCMS] Error updating settings:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/admin/landing/audit', ...adminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const logs = await (prisma as any).landingAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    const total = await (prisma as any).landingAuditLog.count();

    return res.json({ logs, total, limit, offset });
  } catch (error) {
    console.error('[LandingCMS] Error fetching audit logs:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
