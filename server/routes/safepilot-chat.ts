import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  safepilotChat,
  getConversationHistory,
  getUserConversations,
  createDocumentWithEmbeddings,
  reembedDocument,
  updateDocumentStatus,
  listDocuments,
  getDocumentById,
  getAuditLogs,
  getAuditStats,
  logAdminAction,
  canUseAdminKB,
} from "../services/safepilot";
import { prisma } from "../lib/prisma";

const router = Router();

const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  country: z.enum(["BD", "US", "GLOBAL"]).default("GLOBAL"),
  role: z.enum(["CUSTOMER", "DRIVER", "RESTAURANT", "ADMIN"]),
  service: z.enum(["RIDE", "FOOD", "PARCEL", "ALL"]).default("ALL"),
  conversationId: z.string().uuid().optional(),
});

const kbUploadSchema = z.object({
  title: z.string().min(1).max(500),
  body: z.string().min(1).max(100000),
  tags: z.array(z.string()).default([]),
  countryScope: z.enum(["GLOBAL", "BD", "US"]).default("GLOBAL"),
  roleScope: z.enum(["ALL", "CUSTOMER", "DRIVER", "RESTAURANT", "ADMIN"]).default("ALL"),
  serviceScope: z.enum(["ALL", "RIDE", "FOOD", "PARCEL"]).default("ALL"),
  source: z.enum(["admin_upload", "policy", "faq", "runbook"]).default("admin_upload"),
});

const kbUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  title: z.string().min(1).max(500).optional(),
  body: z.string().min(1).max(100000).optional(),
  tags: z.array(z.string()).optional(),
  countryScope: z.enum(["GLOBAL", "BD", "US"]).optional(),
  roleScope: z.enum(["ALL", "CUSTOMER", "DRIVER", "RESTAURANT", "ADMIN"]).optional(),
  serviceScope: z.enum(["ALL", "RIDE", "FOOD", "PARCEL"]).optional(),
});

const auditFiltersSchema = z.object({
  actorUserId: z.string().uuid().optional(),
  actorRole: z.enum(["CUSTOMER", "DRIVER", "RESTAURANT", "ADMIN"]).optional(),
  action: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

interface AuthRequest extends Request {
  user?: {
    id: string;
    userId?: string;
    role?: string;
    adminRole?: string;
    country?: string;
  };
}

function getUserRole(req: AuthRequest): "CUSTOMER" | "DRIVER" | "RESTAURANT" | "ADMIN" {
  if (req.user?.adminRole) return "ADMIN";
  const role = req.user?.role?.toUpperCase();
  if (role === "DRIVER") return "DRIVER";
  if (role === "RESTAURANT") return "RESTAURANT";
  return "CUSTOMER";
}

function getUserCountry(req: AuthRequest): "BD" | "US" | "GLOBAL" {
  const country = req.user?.country?.toUpperCase();
  if (country === "BD") return "BD";
  if (country === "US") return "US";
  return "GLOBAL";
}

router.post("/chat", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
    }

    const { message, country, role, service, conversationId } = parsed.data;
    
    const effectiveRole = getUserRole(req);
    const effectiveCountry = country !== "GLOBAL" ? country : getUserCountry(req);

    const response = await safepilotChat({
      message,
      country: effectiveCountry,
      role: effectiveRole,
      service,
      userId: req.user.id,
      conversationId,
    });

    res.json(response);
  } catch (error) {
    console.error("[SafePilot] Chat error:", error);
    res.status(500).json({ error: "Failed to process chat request" });
  }
});

router.get("/conversations", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const conversations = await getUserConversations(req.user.id, limit);

    res.json({ conversations });
  } catch (error) {
    console.error("[SafePilot] Get conversations error:", error);
    res.status(500).json({ error: "Failed to get conversations" });
  }
});

router.get("/conversations/:conversationId", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { conversationId } = req.params;
    const messages = await getConversationHistory(req.user.id, conversationId);

    res.json({ messages });
  } catch (error) {
    console.error("[SafePilot] Get conversation error:", error);
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

router.post("/kb/upload", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = getUserRole(req);
    if (!canUseAdminKB(userRole)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const parsed = kbUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
    }

    const { title, body, tags, countryScope, roleScope, serviceScope, source } = parsed.data;

    const documentId = await createDocumentWithEmbeddings({
      title,
      body,
      tags,
      countryScope,
      roleScope,
      serviceScope,
      source,
      createdByAdminId: req.user.id,
    });

    await logAdminAction(req.user.id, "kb_upload", {
      documentId,
      title,
      countryScope,
      roleScope,
      serviceScope,
    });

    res.json({ success: true, documentId });
  } catch (error) {
    console.error("[SafePilot] KB upload error:", error);
    res.status(500).json({ error: "Failed to upload document" });
  }
});

router.post("/kb/reembed", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = getUserRole(req);
    if (!canUseAdminKB(userRole)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { documentId } = req.body;
    if (!documentId) {
      return res.status(400).json({ error: "documentId is required" });
    }

    const success = await reembedDocument(documentId);
    if (!success) {
      return res.status(404).json({ error: "Document not found" });
    }

    await logAdminAction(req.user.id, "kb_reembed", { documentId });

    res.json({ success: true });
  } catch (error) {
    console.error("[SafePilot] KB reembed error:", error);
    res.status(500).json({ error: "Failed to reembed document" });
  }
});

router.patch("/kb/:documentId", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = getUserRole(req);
    if (!canUseAdminKB(userRole)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { documentId } = req.params;
    const parsed = kbUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
    }

    const updates = parsed.data;

    if (updates.isActive !== undefined) {
      const success = await updateDocumentStatus(documentId, updates.isActive);
      if (!success) {
        return res.status(404).json({ error: "Document not found" });
      }
    }

    if (updates.title || updates.body || updates.tags || updates.countryScope || updates.roleScope || updates.serviceScope) {
      await prisma.safePilotKBDocument.update({
        where: { id: documentId },
        data: {
          ...(updates.title && { title: updates.title }),
          ...(updates.body && { body: updates.body }),
          ...(updates.tags && { tags: updates.tags }),
          ...(updates.countryScope && { countryScope: updates.countryScope }),
          ...(updates.roleScope && { roleScope: updates.roleScope }),
          ...(updates.serviceScope && { serviceScope: updates.serviceScope }),
          version: { increment: 1 },
        },
      });

      if (updates.body) {
        await reembedDocument(documentId);
      }
    }

    const action = updates.isActive === false ? "kb_disable" : "kb_update";
    await logAdminAction(req.user.id, action, { documentId, updates });

    res.json({ success: true });
  } catch (error) {
    console.error("[SafePilot] KB update error:", error);
    res.status(500).json({ error: "Failed to update document" });
  }
});

router.get("/kb/list", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = getUserRole(req);
    if (!canUseAdminKB(userRole)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const filters: any = {};
    if (req.query.countryScope) filters.countryScope = req.query.countryScope;
    if (req.query.roleScope) filters.roleScope = req.query.roleScope;
    if (req.query.serviceScope) filters.serviceScope = req.query.serviceScope;
    if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === "true";
    if (req.query.source) filters.source = req.query.source;

    const documents = await listDocuments(filters);

    res.json({ documents });
  } catch (error) {
    console.error("[SafePilot] KB list error:", error);
    res.status(500).json({ error: "Failed to list documents" });
  }
});

router.get("/kb/:documentId", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = getUserRole(req);
    if (!canUseAdminKB(userRole)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { documentId } = req.params;
    const document = await getDocumentById(documentId);

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json({ document });
  } catch (error) {
    console.error("[SafePilot] KB get error:", error);
    res.status(500).json({ error: "Failed to get document" });
  }
});

router.get("/audit", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = getUserRole(req);
    if (!canUseAdminKB(userRole)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const parsed = auditFiltersSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid filters", details: parsed.error.errors });
    }

    const filters = parsed.data;
    const { logs, total } = await getAuditLogs({
      ...filters,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    });

    res.json({ logs, total, limit: filters.limit, offset: filters.offset });
  } catch (error) {
    console.error("[SafePilot] Audit logs error:", error);
    res.status(500).json({ error: "Failed to get audit logs" });
  }
});

router.get("/audit/stats", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = getUserRole(req);
    if (!canUseAdminKB(userRole)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const days = parseInt(req.query.days as string) || 30;
    const stats = await getAuditStats(days);

    res.json({ stats });
  } catch (error) {
    console.error("[SafePilot] Audit stats error:", error);
    res.status(500).json({ error: "Failed to get audit stats" });
  }
});

export default router;
