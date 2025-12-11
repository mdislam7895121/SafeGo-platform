import express from 'express';
import {
  authenticateToken,
  requireAdmin,
  requireRole,
  requireOwner,
  AuthenticatedRequest
} from '../middleware/authz';
import {
  generateSignedDocumentUrl,
  verifyDocumentToken,
  canAccessDocument,
  getDocumentById
} from '../services/documentService';
import { logAuditEvent } from '../utils/audit';
import { getClientIp } from '../utils/ip';
import { prisma } from '../db';

const router = express.Router();

router.get(
  '/admin/documents/:id/url',
  authenticateToken,
  requireAdmin('MANAGE_KYC'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const document = await getDocumentById(id);

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const { signedUrl, expiresAt } = await generateSignedDocumentUrl(
        id,
        req.user!.id,
        'admin',
        'view'
      );

      await logAuditEvent({
        actorId: req.user!.id,
        actorEmail: req.user!.email,
        actorRole: 'admin',
        ipAddress: getClientIp(req),
        actionType: 'DOCUMENT_URL_ISSUED',
        entityType: 'document',
        entityId: id,
        description: `Admin ${req.user!.email} issued signed URL for document ${id}`,
        metadata: {
          documentType: document.documentType,
          category: document.category,
          purpose: 'view',
          expiresAt
        }
      });

      res.json({
        url: signedUrl,
        expiresAt
      });
    } catch (error) {
      console.error('Error generating admin document URL:', error);
      res.status(500).json({ error: 'Failed to generate document URL' });
    }
  }
);

router.get(
  '/driver/documents/:id/url',
  authenticateToken,
  requireRole('driver'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const document = await getDocumentById(id);

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const hasAccess = await canAccessDocument(id, req.user!.id, 'driver');
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this document' });
      }

      const { signedUrl, expiresAt } = await generateSignedDocumentUrl(
        id,
        req.user!.id,
        'driver',
        'view'
      );

      await logAuditEvent({
        actorId: req.user!.id,
        actorEmail: req.user!.email,
        actorRole: 'driver',
        ipAddress: getClientIp(req),
        actionType: 'DOCUMENT_URL_ISSUED',
        entityType: 'document',
        entityId: id,
        description: `Driver accessed document ${id}`,
        metadata: {
          documentType: document.documentType,
          category: document.category,
          purpose: 'view'
        }
      });

      res.json({
        url: signedUrl,
        expiresAt
      });
    } catch (error) {
      console.error('Error generating driver document URL:', error);
      res.status(500).json({ error: 'Failed to generate document URL' });
    }
  }
);

router.get(
  '/restaurant/documents/:id/url',
  authenticateToken,
  requireRole('restaurant'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const document = await getDocumentById(id);

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const hasAccess = await canAccessDocument(id, req.user!.id, 'restaurant');
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this document' });
      }

      const { signedUrl, expiresAt } = await generateSignedDocumentUrl(
        id,
        req.user!.id,
        'restaurant',
        'view'
      );

      await logAuditEvent({
        actorId: req.user!.id,
        actorEmail: req.user!.email,
        actorRole: 'restaurant',
        ipAddress: getClientIp(req),
        actionType: 'DOCUMENT_URL_ISSUED',
        entityType: 'document',
        entityId: id,
        description: `Restaurant accessed document ${id}`,
        metadata: {
          documentType: document.documentType,
          category: document.category,
          purpose: 'view'
        }
      });

      res.json({
        url: signedUrl,
        expiresAt
      });
    } catch (error) {
      console.error('Error generating restaurant document URL:', error);
      res.status(500).json({ error: 'Failed to generate document URL' });
    }
  }
);

router.get('/download/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(401).json({ error: 'Missing or invalid token' });
    }

    const payload = await verifyDocumentToken(token);

    if (payload.documentId !== id) {
      return res.status(403).json({ error: 'Token does not match document' });
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        driverProfile: { select: { userId: true } },
        customerProfile: { select: { userId: true } },
        restaurantProfile: { select: { userId: true } }
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Verify ownership or admin access
    const userId = req.user!.id;
    const isOwner = 
      (document.driverProfile?.userId === userId) ||
      (document.customerProfile?.userId === userId) ||
      (document.restaurantProfile?.userId === userId);
    
    const isAdmin = req.user!.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Access denied - you do not have permission to access this document' });
    }

    // Log document download
    await logAuditEvent({
      actorId: userId,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      ipAddress: getClientIp(req),
      actionType: 'DOCUMENT_DOWNLOADED',
      entityType: 'document',
      entityId: id,
      description: `User ${req.user!.email} downloaded document ${id}`,
      metadata: {
        documentType: document.documentType,
        category: document.category,
        isOwner,
        isAdmin
      }
    });

    return res.redirect(document.fileUrl);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
});

export default router;
