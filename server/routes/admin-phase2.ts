import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, loadAdminProfile, checkPermission } from "../middleware/auth";
import { authenticateToken, requireAdmin } from "../middleware/authz";
import { Permission, AdminRole } from "../utils/permissions";
import { z } from "zod";
import { logAuditEvent, ActionType, EntityType, getClientIp } from "../utils/audit";
import crypto from "crypto";

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin());
router.use(loadAdminProfile);

// ====================================================
// RBAC V3: PERMISSION BUNDLES API
// ====================================================

const CreatePermissionBundleSchema = z.object({
  name: z.string().min(3).max(100),
  type: z.enum(["OPS", "FINANCE", "SAFETY", "LEGAL", "ENGINEERING", "CUSTOM"]),
  description: z.string().optional(),
  permissions: z.array(z.string()),
  isSystemBundle: z.boolean().optional().default(false),
});

const UpdatePermissionBundleSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/admin-phase2/permission-bundles
 * List all permission bundles
 */
router.get("/permission-bundles", checkPermission(Permission.VIEW_PERMISSION_BUNDLES), async (req: AuthRequest, res) => {
  try {
    const bundles = await prisma.adminPermissionBundle.findMany({
      include: {
        assignments: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(bundles);
  } catch (error) {
    console.error("Error fetching permission bundles:", error);
    res.status(500).json({ error: "Failed to fetch permission bundles" });
  }
});

/**
 * POST /api/admin-phase2/permission-bundles
 * Create a new permission bundle
 */
router.post("/permission-bundles", checkPermission(Permission.MANAGE_PERMISSION_BUNDLES), async (req: AuthRequest, res) => {
  try {
    const data = CreatePermissionBundleSchema.parse(req.body);
    const adminUser = (req as any).adminUser;

    const bundle = await prisma.adminPermissionBundle.create({
      data: {
        name: data.name,
        type: data.type,
        description: data.description,
        permissions: data.permissions,
        isSystemBundle: data.isSystemBundle,
        createdByAdminId: adminUser?.id,
      },
    });

    await logAuditEvent({
      actorId: req.user?.userId || null,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: "PERMISSION_BUNDLE_CREATED",
      entityType: "PERMISSION_BUNDLE",
      entityId: bundle.id,
      description: `Created permission bundle: ${data.name}`,
      ipAddress: getClientIp(req),
      metadata: { bundleType: data.type, permissionCount: data.permissions.length },
    });

    res.status(201).json(bundle);
  } catch (error) {
    console.error("Error creating permission bundle:", error);
    res.status(500).json({ error: "Failed to create permission bundle" });
  }
});

/**
 * PUT /api/admin-phase2/permission-bundles/:id
 * Update a permission bundle
 */
router.put("/permission-bundles/:id", checkPermission(Permission.MANAGE_PERMISSION_BUNDLES), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = UpdatePermissionBundleSchema.parse(req.body);
    const adminUser = (req as any).adminUser;

    const existing = await prisma.adminPermissionBundle.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Permission bundle not found" });
    }

    if (existing.isSystemBundle && data.permissions) {
      return res.status(403).json({ error: "Cannot modify permissions of system bundles" });
    }

    const bundle = await prisma.adminPermissionBundle.update({
      where: { id },
      data: {
        ...data,
        updatedByAdminId: adminUser?.id,
      },
    });

    await logAuditEvent({
      actorId: req.user?.userId || null,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: "PERMISSION_BUNDLE_UPDATED",
      entityType: "PERMISSION_BUNDLE",
      entityId: id,
      description: `Updated permission bundle: ${bundle.name}`,
      ipAddress: getClientIp(req),
    });

    res.json(bundle);
  } catch (error) {
    console.error("Error updating permission bundle:", error);
    res.status(500).json({ error: "Failed to update permission bundle" });
  }
});

/**
 * DELETE /api/admin-phase2/permission-bundles/:id
 * Delete a permission bundle
 */
router.delete("/permission-bundles/:id", checkPermission(Permission.MANAGE_PERMISSION_BUNDLES), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const adminUser = (req as any).adminUser;

    const existing = await prisma.adminPermissionBundle.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Permission bundle not found" });
    }

    if (existing.isSystemBundle) {
      return res.status(403).json({ error: "Cannot delete system bundles" });
    }

    await prisma.adminPermissionBundle.delete({ where: { id } });

    await logAuditEvent({
      actorId: req.user?.userId || null,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: "PERMISSION_BUNDLE_DELETED",
      entityType: "PERMISSION_BUNDLE",
      entityId: id,
      description: `Deleted permission bundle: ${existing.name}`,
      ipAddress: getClientIp(req),
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting permission bundle:", error);
    res.status(500).json({ error: "Failed to delete permission bundle" });
  }
});

/**
 * POST /api/admin-phase2/permission-bundles/:bundleId/assign/:adminProfileId
 * Assign a permission bundle to an admin
 */
router.post("/permission-bundles/:bundleId/assign/:adminProfileId", checkPermission(Permission.ASSIGN_PERMISSION_BUNDLES), async (req: AuthRequest, res) => {
  try {
    const { bundleId, adminProfileId } = req.params;
    const { expiresAt } = req.body;
    const adminUser = (req as any).adminUser;

    const bundle = await prisma.adminPermissionBundle.findUnique({ where: { id: bundleId } });
    if (!bundle) {
      return res.status(404).json({ error: "Permission bundle not found" });
    }

    const assignment = await prisma.adminBundleAssignment.create({
      data: {
        adminProfileId,
        bundleId,
        assignedByAdminId: adminUser?.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    await logAuditEvent({
      actorId: req.user?.userId || null,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: "PERMISSION_BUNDLE_ASSIGNED",
      entityType: "PERMISSION_BUNDLE",
      entityId: bundleId,
      description: `Assigned bundle ${bundle.name} to admin ${adminProfileId}`,
      ipAddress: getClientIp(req),
      metadata: { targetAdminId: adminProfileId, expiresAt },
    });

    res.status(201).json(assignment);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Bundle already assigned to this admin" });
    }
    console.error("Error assigning permission bundle:", error);
    res.status(500).json({ error: "Failed to assign permission bundle" });
  }
});

/**
 * DELETE /api/admin-phase2/permission-bundles/:bundleId/unassign/:adminProfileId
 * Remove a permission bundle from an admin
 */
router.delete("/permission-bundles/:bundleId/unassign/:adminProfileId", checkPermission(Permission.ASSIGN_PERMISSION_BUNDLES), async (req: AuthRequest, res) => {
  try {
    const { bundleId, adminProfileId } = req.params;
    const adminUser = (req as any).adminUser;

    const assignment = await prisma.adminBundleAssignment.findFirst({
      where: { bundleId, adminProfileId },
      include: { bundle: true },
    });

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    await prisma.adminBundleAssignment.delete({ where: { id: assignment.id } });

    await logAuditEvent({
      actorId: req.user?.userId || null,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: "PERMISSION_BUNDLE_UNASSIGNED",
      entityType: "PERMISSION_BUNDLE",
      entityId: bundleId,
      description: `Removed bundle ${assignment.bundle.name} from admin ${adminProfileId}`,
      ipAddress: getClientIp(req),
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error removing permission bundle assignment:", error);
    res.status(500).json({ error: "Failed to remove assignment" });
  }
});

// ====================================================
// RBAC V3: EMERGENCY LOCKDOWN CONTROLS
// ====================================================

const ActivateLockdownSchema = z.object({
  level: z.enum(["PARTIAL", "FULL", "MAINTENANCE"]),
  reason: z.string().min(10),
  lockedFeatures: z.array(z.string()).optional().default([]),
  excludedAdmins: z.array(z.string()).optional().default([]),
  scheduledEndAt: z.string().datetime().optional(),
  countryScope: z.string().optional(),
});

/**
 * GET /api/admin-phase2/emergency/status
 * Get current emergency lockdown status
 */
router.get("/emergency/status", checkPermission(Permission.VIEW_EMERGENCY_STATUS), async (req: AuthRequest, res) => {
  try {
    const activeLockdown = await prisma.emergencyLockdown.findFirst({
      where: { isActive: true },
      orderBy: { activatedAt: "desc" },
    });

    res.json({
      isLocked: !!activeLockdown,
      lockdown: activeLockdown,
      level: activeLockdown?.level || "NONE",
    });
  } catch (error) {
    console.error("Error fetching emergency status:", error);
    res.status(500).json({ error: "Failed to fetch emergency status" });
  }
});

/**
 * GET /api/admin-phase2/emergency/history
 * Get emergency lockdown history
 */
router.get("/emergency/history", checkPermission(Permission.VIEW_EMERGENCY_STATUS), async (req: AuthRequest, res) => {
  try {
    const history = await prisma.emergencyLockdown.findMany({
      orderBy: { activatedAt: "desc" },
      take: 50,
    });

    res.json(history);
  } catch (error) {
    console.error("Error fetching emergency history:", error);
    res.status(500).json({ error: "Failed to fetch emergency history" });
  }
});

/**
 * POST /api/admin-phase2/emergency/activate
 * Activate emergency lockdown
 */
router.post("/emergency/activate", checkPermission(Permission.ACTIVATE_EMERGENCY_LOCKDOWN), async (req: AuthRequest, res) => {
  try {
    const data = ActivateLockdownSchema.parse(req.body);
    const adminUser = (req as any).adminUser;

    // Check for existing active lockdown
    const existingLockdown = await prisma.emergencyLockdown.findFirst({
      where: { isActive: true },
    });

    if (existingLockdown) {
      return res.status(400).json({ error: "An emergency lockdown is already active. Deactivate it first." });
    }

    const lockdown = await prisma.emergencyLockdown.create({
      data: {
        level: data.level,
        reason: data.reason,
        lockedFeatures: data.lockedFeatures,
        excludedAdmins: data.excludedAdmins,
        activatedBy: adminUser?.id || "unknown",
        activatedByEmail: adminUser?.email || "unknown",
        scheduledEndAt: data.scheduledEndAt ? new Date(data.scheduledEndAt) : null,
        countryScope: data.countryScope,
        isActive: true,
      },
    });

    await logAuditEvent({
      actorId: req.user?.userId || null,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: "EMERGENCY_LOCKDOWN_ACTIVATED",
      entityType: "EMERGENCY_LOCKDOWN",
      entityId: lockdown.id,
      description: `Activated ${data.level} emergency lockdown: ${data.reason}`,
      ipAddress: getClientIp(req),
      metadata: { level: data.level, lockedFeatures: data.lockedFeatures, countryScope: data.countryScope },
    });

    res.status(201).json(lockdown);
  } catch (error) {
    console.error("Error activating emergency lockdown:", error);
    res.status(500).json({ error: "Failed to activate emergency lockdown" });
  }
});

/**
 * POST /api/admin-phase2/emergency/deactivate/:id
 * Deactivate emergency lockdown
 */
router.post("/emergency/deactivate/:id", checkPermission(Permission.DEACTIVATE_EMERGENCY_LOCKDOWN), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const adminUser = (req as any).adminUser;

    const lockdown = await prisma.emergencyLockdown.findUnique({ where: { id } });
    if (!lockdown) {
      return res.status(404).json({ error: "Lockdown not found" });
    }

    if (!lockdown.isActive) {
      return res.status(400).json({ error: "Lockdown is already inactive" });
    }

    const updated = await prisma.emergencyLockdown.update({
      where: { id },
      data: {
        isActive: false,
        deactivatedBy: adminUser?.id,
        deactivatedByEmail: adminUser?.email,
        deactivatedAt: new Date(),
      },
    });

    await logAuditEvent({
      actorId: req.user?.userId || null,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: "EMERGENCY_LOCKDOWN_DEACTIVATED",
      entityType: "EMERGENCY_LOCKDOWN",
      entityId: id,
      description: `Deactivated emergency lockdown`,
      ipAddress: getClientIp(req),
    });

    res.json(updated);
  } catch (error) {
    console.error("Error deactivating emergency lockdown:", error);
    res.status(500).json({ error: "Failed to deactivate emergency lockdown" });
  }
});

// ====================================================
// RBAC V3: ADMIN IMPERSONATION MODE
// ====================================================

const StartImpersonationSchema = z.object({
  targetAdminId: z.string().uuid(),
  reason: z.string().min(10),
  isViewOnly: z.boolean().optional().default(true),
  durationMinutes: z.number().min(5).max(240).optional().default(60),
});

/**
 * GET /api/admin-phase2/impersonation/sessions
 * List impersonation sessions
 */
router.get("/impersonation/sessions", checkPermission(Permission.VIEW_IMPERSONATION_LOGS), async (req: AuthRequest, res) => {
  try {
    const sessions = await prisma.adminImpersonationSession.findMany({
      orderBy: { startedAt: "desc" },
      take: 100,
    });

    res.json(sessions);
  } catch (error) {
    console.error("Error fetching impersonation sessions:", error);
    res.status(500).json({ error: "Failed to fetch impersonation sessions" });
  }
});

/**
 * POST /api/admin-phase2/impersonation/start
 * Start an impersonation session
 */
router.post("/impersonation/start", checkPermission(Permission.IMPERSONATE_ADMIN), async (req: AuthRequest, res) => {
  try {
    const data = StartImpersonationSchema.parse(req.body);
    const adminUser = (req as any).adminUser;

    // Only SUPER_ADMIN can impersonate
    if (adminUser?.adminProfile?.adminRole !== AdminRole.SUPER_ADMIN) {
      return res.status(403).json({ error: "Only Super Admins can impersonate other admins" });
    }

    // Get target admin
    const targetAdmin = await prisma.adminProfile.findUnique({
      where: { id: data.targetAdminId },
      include: { user: true },
    });

    if (!targetAdmin) {
      return res.status(404).json({ error: "Target admin not found" });
    }

    // Cannot impersonate another SUPER_ADMIN
    if (targetAdmin.adminRole === AdminRole.SUPER_ADMIN) {
      return res.status(403).json({ error: "Cannot impersonate another Super Admin" });
    }

    // Check for existing active session
    const existingSession = await prisma.adminImpersonationSession.findFirst({
      where: {
        impersonatorId: adminUser.id,
        status: "ACTIVE",
      },
    });

    if (existingSession) {
      return res.status(400).json({ error: "You already have an active impersonation session. End it first." });
    }

    const expiresAt = new Date(Date.now() + data.durationMinutes * 60 * 1000);

    const session = await prisma.adminImpersonationSession.create({
      data: {
        impersonatorId: adminUser.id,
        impersonatorEmail: adminUser.email,
        impersonatorRole: adminUser.adminProfile.adminRole,
        targetAdminId: targetAdmin.id,
        targetAdminEmail: targetAdmin.user.email,
        targetAdminRole: targetAdmin.adminRole,
        reason: data.reason,
        isViewOnly: data.isViewOnly,
        allowActions: !data.isViewOnly,
        expiresAt,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || null,
      },
    });

    await logAuditEvent({
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      actorRole: "admin",
      actionType: "IMPERSONATION_STARTED",
      entityType: "ADMIN_IMPERSONATION",
      entityId: session.id,
      description: `Started ${data.isViewOnly ? "view-only" : "full"} impersonation of ${targetAdmin.user.email}`,
      ipAddress: getClientIp(req),
      metadata: { targetAdminId: targetAdmin.id, reason: data.reason, durationMinutes: data.durationMinutes },
    });

    res.status(201).json(session);
  } catch (error) {
    console.error("Error starting impersonation:", error);
    res.status(500).json({ error: "Failed to start impersonation session" });
  }
});

/**
 * POST /api/admin-phase2/impersonation/end/:id
 * End an impersonation session
 */
router.post("/impersonation/end/:id", checkPermission(Permission.IMPERSONATE_ADMIN), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const adminUser = (req as any).adminUser;

    const session = await prisma.adminImpersonationSession.findUnique({ where: { id } });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.status !== "ACTIVE") {
      return res.status(400).json({ error: "Session is not active" });
    }

    // Only the impersonator or a super admin can end the session
    if (session.impersonatorId !== adminUser.id && adminUser?.adminProfile?.adminRole !== AdminRole.SUPER_ADMIN) {
      return res.status(403).json({ error: "You can only end your own impersonation sessions" });
    }

    const updated = await prisma.adminImpersonationSession.update({
      where: { id },
      data: {
        status: "ENDED",
        endedAt: new Date(),
      },
    });

    await logAuditEvent({
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      actorRole: "admin",
      actionType: "IMPERSONATION_ENDED",
      entityType: "ADMIN_IMPERSONATION",
      entityId: id,
      description: `Ended impersonation session`,
      ipAddress: getClientIp(req),
      metadata: { actionsPerformed: session.actionsPerformed },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error ending impersonation:", error);
    res.status(500).json({ error: "Failed to end impersonation session" });
  }
});

/**
 * POST /api/admin-phase2/impersonation/revoke/:id
 * Revoke an impersonation session (by super admin)
 */
router.post("/impersonation/revoke/:id", checkPermission(Permission.REVOKE_IMPERSONATION), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const adminUser = (req as any).adminUser;

    const session = await prisma.adminImpersonationSession.findUnique({ where: { id } });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.status !== "ACTIVE") {
      return res.status(400).json({ error: "Session is not active" });
    }

    const updated = await prisma.adminImpersonationSession.update({
      where: { id },
      data: {
        status: "REVOKED",
        endedAt: new Date(),
      },
    });

    await logAuditEvent({
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      actorRole: "admin",
      actionType: "IMPERSONATION_REVOKED",
      entityType: "ADMIN_IMPERSONATION",
      entityId: id,
      description: `Revoked impersonation session for ${session.impersonatorEmail}`,
      ipAddress: getClientIp(req),
    });

    res.json(updated);
  } catch (error) {
    console.error("Error revoking impersonation:", error);
    res.status(500).json({ error: "Failed to revoke impersonation session" });
  }
});

// ====================================================
// RBAC V3: ADMIN SECURE INTERNAL MESSAGING
// ====================================================

const SendMessageSchema = z.object({
  recipientId: z.string().uuid().optional(),
  recipientRole: z.enum(["SUPER_ADMIN", "ADMIN", "COUNTRY_ADMIN", "CITY_ADMIN", "COMPLIANCE_ADMIN", "SUPPORT_ADMIN", "FINANCE_ADMIN", "RISK_ADMIN", "READONLY_ADMIN"]).optional(),
  subject: z.string().min(1).max(200),
  content: z.string().min(1),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional().default("NORMAL"),
  isConfidential: z.boolean().optional().default(false),
  expiresAt: z.string().datetime().optional(),
  threadId: z.string().uuid().optional(),
  replyToId: z.string().uuid().optional(),
});

/**
 * GET /api/admin-phase2/messages/inbox
 * Get admin's inbox messages
 */
router.get("/messages/inbox", checkPermission(Permission.VIEW_ADMIN_MESSAGES), async (req: AuthRequest, res) => {
  try {
    const adminUser = (req as any).adminUser;
    const { status, priority, limit = 50, offset = 0 } = req.query;

    const where: any = {
      OR: [
        { recipientId: adminUser.id },
        { recipientRole: adminUser.adminProfile?.adminRole },
        { recipientId: null, recipientRole: null }, // Broadcast messages
      ],
      status: { not: "DELETED" },
    };

    if (status) where.status = status;
    if (priority) where.priority = priority;

    const messages = await prisma.adminSecureMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Number(limit),
      skip: Number(offset),
    });

    res.json(messages);
  } catch (error) {
    console.error("Error fetching inbox:", error);
    res.status(500).json({ error: "Failed to fetch inbox" });
  }
});

/**
 * GET /api/admin-phase2/messages/sent
 * Get admin's sent messages
 */
router.get("/messages/sent", checkPermission(Permission.VIEW_ADMIN_MESSAGES), async (req: AuthRequest, res) => {
  try {
    const adminUser = (req as any).adminUser;
    const { limit = 50, offset = 0 } = req.query;

    const messages = await prisma.adminSecureMessage.findMany({
      where: {
        senderId: adminUser.id,
        status: { not: "DELETED" },
      },
      orderBy: { createdAt: "desc" },
      take: Number(limit),
      skip: Number(offset),
    });

    res.json(messages);
  } catch (error) {
    console.error("Error fetching sent messages:", error);
    res.status(500).json({ error: "Failed to fetch sent messages" });
  }
});

/**
 * POST /api/admin-phase2/messages/send
 * Send a secure message to another admin
 */
router.post("/messages/send", checkPermission(Permission.SEND_ADMIN_MESSAGE), async (req: AuthRequest, res) => {
  try {
    const data = SendMessageSchema.parse(req.body);
    const adminUser = (req as any).adminUser;

    // Validate recipient exists if specified
    let recipientEmail: string | null = null;
    if (data.recipientId) {
      const recipient = await prisma.adminProfile.findUnique({
        where: { id: data.recipientId },
        include: { user: true },
      });
      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }
      recipientEmail = recipient.user.email;
    }

    // Generate content hash for integrity
    const contentHash = crypto.createHash("sha256").update(data.content).digest("hex");

    const message = await prisma.adminSecureMessage.create({
      data: {
        senderId: adminUser.id,
        senderEmail: adminUser.email,
        senderRole: adminUser.adminProfile?.adminRole || "ADMIN",
        recipientId: data.recipientId || null,
        recipientEmail,
        recipientRole: data.recipientRole || null,
        subject: data.subject,
        content: data.content,
        contentHash,
        priority: data.priority,
        isConfidential: data.isConfidential,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        threadId: data.threadId || null,
        replyToId: data.replyToId || null,
      },
    });

    await logAuditEvent({
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      actorRole: "admin",
      actionType: "ADMIN_MESSAGE_SENT",
      entityType: "ADMIN_MESSAGE",
      entityId: message.id,
      description: `Sent secure message: ${data.subject}`,
      ipAddress: getClientIp(req),
      metadata: { recipientId: data.recipientId, recipientRole: data.recipientRole, priority: data.priority },
    });

    res.status(201).json(message);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

/**
 * POST /api/admin-phase2/messages/broadcast
 * Broadcast a message to all admins or a specific role
 */
router.post("/messages/broadcast", checkPermission(Permission.BROADCAST_ADMIN_MESSAGE), async (req: AuthRequest, res) => {
  try {
    const data = SendMessageSchema.parse(req.body);
    const adminUser = (req as any).adminUser;

    const contentHash = crypto.createHash("sha256").update(data.content).digest("hex");

    const message = await prisma.adminSecureMessage.create({
      data: {
        senderId: adminUser.id,
        senderEmail: adminUser.email,
        senderRole: adminUser.adminProfile?.adminRole || "SUPER_ADMIN",
        recipientId: null,
        recipientEmail: null,
        recipientRole: data.recipientRole || null,
        subject: data.subject,
        content: data.content,
        contentHash,
        priority: data.priority || "HIGH",
        isConfidential: data.isConfidential,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });

    await logAuditEvent({
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      actorRole: "admin",
      actionType: "ADMIN_MESSAGE_BROADCAST",
      entityType: "ADMIN_MESSAGE",
      entityId: message.id,
      description: `Broadcast message: ${data.subject}`,
      ipAddress: getClientIp(req),
      metadata: { targetRole: data.recipientRole, priority: data.priority },
    });

    res.status(201).json(message);
  } catch (error) {
    console.error("Error broadcasting message:", error);
    res.status(500).json({ error: "Failed to broadcast message" });
  }
});

/**
 * PUT /api/admin-phase2/messages/:id/read
 * Mark a message as read
 */
router.put("/messages/:id/read", checkPermission(Permission.VIEW_ADMIN_MESSAGES), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const message = await prisma.adminSecureMessage.update({
      where: { id },
      data: {
        status: "READ",
        readAt: new Date(),
      },
    });

    res.json(message);
  } catch (error) {
    console.error("Error marking message as read:", error);
    res.status(500).json({ error: "Failed to mark message as read" });
  }
});

/**
 * DELETE /api/admin-phase2/messages/:id
 * Soft delete a message
 */
router.delete("/messages/:id", checkPermission(Permission.VIEW_ADMIN_MESSAGES), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.adminSecureMessage.update({
      where: { id },
      data: {
        status: "DELETED",
        deletedAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

// ====================================================
// GLOBAL AUDIT ENGINE V2: AUDIT CHAIN & INTEGRITY
// ====================================================

/**
 * GET /api/admin-phase2/audit/chain
 * Get audit event chain for tamper-proof verification
 */
router.get("/audit/chain", checkPermission(Permission.VIEW_AUDIT_CHAIN), async (req: AuthRequest, res) => {
  try {
    const { limit = 100, offset = 0, traceId, startDate, endDate } = req.query;

    const where: any = {};
    if (traceId) where.traceId = traceId;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }

    const chain = await prisma.auditEventChain.findMany({
      where,
      orderBy: { sequenceNumber: "desc" },
      take: Number(limit),
      skip: Number(offset),
    });

    res.json(chain);
  } catch (error) {
    console.error("Error fetching audit chain:", error);
    res.status(500).json({ error: "Failed to fetch audit chain" });
  }
});

/**
 * POST /api/admin-phase2/audit/verify
 * Verify audit chain integrity
 */
router.post("/audit/verify", checkPermission(Permission.VERIFY_AUDIT_INTEGRITY), async (req: AuthRequest, res) => {
  try {
    const { startSequence, endSequence } = req.body;

    const events = await prisma.auditEventChain.findMany({
      where: {
        sequenceNumber: {
          gte: startSequence || 1,
          lte: endSequence || 1000,
        },
      },
      orderBy: { sequenceNumber: "asc" },
    });

    let isValid = true;
    let brokenAt: number | null = null;

    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1];
      const curr = events[i];

      if (curr.previousHash !== prev.currentHash) {
        isValid = false;
        brokenAt = curr.sequenceNumber;
        break;
      }
    }

    const adminUser = (req as any).adminUser;
    await logAuditEvent({
      actorId: adminUser?.id,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: "AUDIT_CHAIN_VERIFIED",
      entityType: "AUDIT_CHAIN",
      entityId: null,
      description: `Verified audit chain from ${startSequence || 1} to ${endSequence || events.length}`,
      ipAddress: getClientIp(req),
      metadata: { isValid, brokenAt, eventsChecked: events.length },
    });

    res.json({
      isValid,
      brokenAt,
      eventsChecked: events.length,
      startSequence: events[0]?.sequenceNumber,
      endSequence: events[events.length - 1]?.sequenceNumber,
    });
  } catch (error) {
    console.error("Error verifying audit chain:", error);
    res.status(500).json({ error: "Failed to verify audit chain" });
  }
});

// ====================================================
// GLOBAL AUDIT ENGINE V2: EVIDENCE PACKETS
// ====================================================

const GenerateEvidencePacketSchema = z.object({
  incidentId: z.string(),
  incidentType: z.string(),
  title: z.string(),
  description: z.string().optional(),
  eventStartDate: z.string().datetime().optional(),
  eventEndDate: z.string().datetime().optional(),
  userIds: z.array(z.string()).optional().default([]),
  format: z.enum(["PDF", "JSON", "CSV"]).optional().default("PDF"),
});

/**
 * GET /api/admin-phase2/audit/evidence-packets
 * List evidence packets
 */
router.get("/audit/evidence-packets", checkPermission(Permission.VIEW_EVIDENCE_PACKETS), async (req: AuthRequest, res) => {
  try {
    const { status, incidentType, limit = 50, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (incidentType) where.incidentType = incidentType;

    const packets = await prisma.auditEvidencePacket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Number(limit),
      skip: Number(offset),
    });

    res.json(packets);
  } catch (error) {
    console.error("Error fetching evidence packets:", error);
    res.status(500).json({ error: "Failed to fetch evidence packets" });
  }
});

/**
 * POST /api/admin-phase2/audit/evidence-packets/generate
 * Generate an evidence packet for an incident
 */
router.post("/audit/evidence-packets/generate", checkPermission(Permission.GENERATE_EVIDENCE_PACKET), async (req: AuthRequest, res) => {
  try {
    const data = GenerateEvidencePacketSchema.parse(req.body);
    const adminUser = (req as any).adminUser;

    const packet = await prisma.auditEvidencePacket.create({
      data: {
        incidentId: data.incidentId,
        incidentType: data.incidentType,
        title: data.title,
        description: data.description,
        eventStartDate: data.eventStartDate ? new Date(data.eventStartDate) : null,
        eventEndDate: data.eventEndDate ? new Date(data.eventEndDate) : null,
        userIds: data.userIds,
        userRoles: [],
        eventIds: [],
        format: data.format,
        generatedBy: adminUser?.id,
        status: "GENERATING",
      },
    });

    // In production, this would trigger a background job to collect events and generate the file
    // For now, we'll simulate completion
    setTimeout(async () => {
      try {
        await prisma.auditEvidencePacket.update({
          where: { id: packet.id },
          data: {
            status: "READY",
            generatedAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          },
        });
      } catch (e) {
        console.error("Error updating evidence packet status:", e);
      }
    }, 5000);

    await logAuditEvent({
      actorId: adminUser?.id,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: "EVIDENCE_PACKET_GENERATED",
      entityType: "EVIDENCE_PACKET",
      entityId: packet.id,
      description: `Generated evidence packet for ${data.incidentType}: ${data.title}`,
      ipAddress: getClientIp(req),
      metadata: { incidentId: data.incidentId, format: data.format },
    });

    res.status(201).json(packet);
  } catch (error) {
    console.error("Error generating evidence packet:", error);
    res.status(500).json({ error: "Failed to generate evidence packet" });
  }
});

// ====================================================
// GLOBAL AUDIT ENGINE V2: REGULATOR EXPORTS
// ====================================================

const CreateRegulatorExportSchema = z.object({
  exportType: z.enum(["COMPLIANCE_REPORT", "INCIDENT_REPORT", "FINANCIAL_AUDIT", "USER_DATA_EXPORT", "TRANSACTION_HISTORY", "SAFETY_REPORT", "CUSTOM"]),
  format: z.enum(["PDF", "CSV", "JSON"]).optional().default("PDF"),
  title: z.string(),
  description: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  countryCode: z.string().optional(),
  userTypes: z.array(z.string()).optional().default([]),
  eventTypes: z.array(z.string()).optional().default([]),
});

/**
 * GET /api/admin-phase2/audit/regulator-exports
 * List regulator export requests
 */
router.get("/audit/regulator-exports", checkPermission(Permission.EXPORT_REGULATOR_REPORT), async (req: AuthRequest, res) => {
  try {
    const { status, exportType, limit = 50, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (exportType) where.exportType = exportType;

    const exports = await prisma.regulatorExportQueue.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      take: Number(limit),
      skip: Number(offset),
    });

    res.json(exports);
  } catch (error) {
    console.error("Error fetching regulator exports:", error);
    res.status(500).json({ error: "Failed to fetch regulator exports" });
  }
});

/**
 * POST /api/admin-phase2/audit/regulator-exports/request
 * Request a new regulator export
 */
router.post("/audit/regulator-exports/request", checkPermission(Permission.EXPORT_REGULATOR_REPORT), async (req: AuthRequest, res) => {
  try {
    const data = CreateRegulatorExportSchema.parse(req.body);
    const adminUser = (req as any).adminUser;

    const exportRequest = await prisma.regulatorExportQueue.create({
      data: {
        exportType: data.exportType,
        format: data.format,
        title: data.title,
        description: data.description,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        countryCode: data.countryCode,
        userTypes: data.userTypes,
        eventTypes: data.eventTypes,
        requestedBy: adminUser?.id || "unknown",
        requestedByEmail: adminUser?.email || "unknown",
        status: "QUEUED",
      },
    });

    // Simulate processing
    setTimeout(async () => {
      try {
        await prisma.regulatorExportQueue.update({
          where: { id: exportRequest.id },
          data: {
            status: "READY",
            processedAt: new Date(),
            completedAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });
      } catch (e) {
        console.error("Error updating regulator export status:", e);
      }
    }, 10000);

    await logAuditEvent({
      actorId: adminUser?.id,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: "REGULATOR_EXPORT_REQUESTED",
      entityType: "REGULATOR_EXPORT",
      entityId: exportRequest.id,
      description: `Requested ${data.exportType} export: ${data.title}`,
      ipAddress: getClientIp(req),
      metadata: { exportType: data.exportType, format: data.format, countryCode: data.countryCode },
    });

    res.status(201).json(exportRequest);
  } catch (error) {
    console.error("Error requesting regulator export:", error);
    res.status(500).json({ error: "Failed to request regulator export" });
  }
});

export default router;
