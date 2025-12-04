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
  scope: z.enum(["GLOBAL", "COUNTRY", "SERVICE", "COUNTRY_SERVICE"]).default("COUNTRY"),
  reason: z.string().min(10),
  lockedFeatures: z.array(z.string()).optional().default([]),
  excludedAdmins: z.array(z.string()).optional().default([]),
  scheduledEndAt: z.string().datetime().optional(),
  estimatedEndTime: z.string().datetime().optional(),
  countryCode: z.string().optional(),
  serviceType: z.string().optional(),
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
 * SUPER_ADMIN can activate GLOBAL lockdowns
 * Other admins can only activate COUNTRY or SERVICE scoped lockdowns for their region
 */
router.post("/emergency/activate", checkPermission(Permission.ACTIVATE_EMERGENCY_LOCKDOWN), async (req: AuthRequest, res) => {
  try {
    const data = ActivateLockdownSchema.parse(req.body);
    const adminUser = (req as any).adminUser;
    const userRole = req.user?.adminRole;
    const userCountry = req.user?.country;

    // Enforce scope restrictions based on admin role
    if (data.scope === "GLOBAL" && userRole !== "SUPER_ADMIN") {
      return res.status(403).json({ 
        error: "Only SUPER_ADMIN can activate GLOBAL lockdowns. Use COUNTRY or SERVICE scope instead." 
      });
    }

    // Non-SUPER_ADMIN must specify a country for country-scoped lockdowns
    if ((data.scope === "COUNTRY" || data.scope === "COUNTRY_SERVICE") && userRole !== "SUPER_ADMIN") {
      if (!data.countryCode) {
        data.countryCode = userCountry; // Default to admin's country
      }
      // Verify admin can only lock their own country
      if (data.countryCode !== userCountry) {
        return res.status(403).json({ 
          error: "You can only activate lockdowns for your assigned country." 
        });
      }
    }

    // Check for existing active lockdown in the same scope
    const existingLockdownWhere: any = { isActive: true };
    if (data.scope === "COUNTRY" || data.scope === "COUNTRY_SERVICE") {
      existingLockdownWhere.countryCode = data.countryCode;
    }
    if (data.scope === "SERVICE" || data.scope === "COUNTRY_SERVICE") {
      existingLockdownWhere.serviceType = data.serviceType;
    }
    if (data.scope === "GLOBAL") {
      existingLockdownWhere.scope = "GLOBAL";
    }

    const existingLockdown = await prisma.emergencyLockdown.findFirst({
      where: existingLockdownWhere,
    });

    if (existingLockdown) {
      return res.status(400).json({ 
        error: "An emergency lockdown is already active for this scope. Deactivate it first.",
        existingLockdownId: existingLockdown.id
      });
    }

    const lockdown = await prisma.emergencyLockdown.create({
      data: {
        level: data.level,
        scope: data.scope as any,
        reason: data.reason,
        lockedFeatures: data.lockedFeatures,
        excludedAdmins: data.excludedAdmins,
        activatedBy: adminUser?.id || "unknown",
        activatedByEmail: adminUser?.email || "unknown",
        scheduledEndAt: data.scheduledEndAt ? new Date(data.scheduledEndAt) : null,
        estimatedEndTime: data.estimatedEndTime ? new Date(data.estimatedEndTime) : null,
        countryCode: data.countryCode,
        serviceType: data.serviceType,
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
      description: `Activated ${data.level} ${data.scope} emergency lockdown: ${data.reason}`,
      ipAddress: getClientIp(req),
      metadata: { 
        level: data.level, 
        scope: data.scope,
        lockedFeatures: data.lockedFeatures, 
        countryCode: data.countryCode,
        serviceType: data.serviceType
      },
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

// ==============================================================
// PEOPLE & KYC CENTER PHASE-2 ENDPOINTS
// ==============================================================

// Validation schemas for KYC Phase-2
const KycQueueFilterSchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  countryCode: z.string().optional(),
  userRole: z.string().optional(),
  assignedAdminId: z.string().optional(),
  isOverdue: z.boolean().optional(),
  minRiskScore: z.number().optional(),
  maxRiskScore: z.number().optional(),
  page: z.number().default(1),
  limit: z.number().default(20),
});

const AssignKycReviewSchema = z.object({
  queueItemId: z.string(),
  adminId: z.string(),
});

const CompleteKycReviewSchema = z.object({
  queueItemId: z.string(),
  status: z.enum(["APPROVED", "REJECTED", "ESCALATED", "ON_HOLD"]),
  reviewNotes: z.string().optional(),
  rejectionReason: z.string().optional(),
});

const EscalateKycReviewSchema = z.object({
  queueItemId: z.string(),
  escalateTo: z.string(),
  reason: z.string(),
});

const RiskSignalFilterSchema = z.object({
  userId: z.string().optional(),
  signalType: z.string().optional(),
  severity: z.string().optional(),
  status: z.string().optional(),
  countryCode: z.string().optional(),
  page: z.number().default(1),
  limit: z.number().default(20),
});

const CreateRiskSignalSchema = z.object({
  userId: z.string(),
  userRole: z.string(),
  signalType: z.string(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  description: z.string(),
  evidence: z.record(z.any()).optional(),
  countryCode: z.string().optional(),
});

const ResolveRiskSignalSchema = z.object({
  signalId: z.string(),
  resolution: z.string(),
  notes: z.string().optional(),
});

const SuspiciousActivityFilterSchema = z.object({
  userId: z.string().optional(),
  flagType: z.string().optional(),
  severity: z.string().optional(),
  status: z.string().optional(),
  page: z.number().default(1),
  limit: z.number().default(20),
});

const CreateSuspiciousActivitySchema = z.object({
  userId: z.string(),
  userRole: z.string(),
  flagType: z.string(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  description: z.string(),
  evidence: z.record(z.any()).optional(),
});

const DuplicateDetectionFilterSchema = z.object({
  matchType: z.string().optional(),
  riskLevel: z.string().optional(),
  status: z.string().optional(),
  page: z.number().default(1),
  limit: z.number().default(20),
});

/**
 * GET /api/admin-phase2/kyc/queue
 * Get KYC review queue with advanced filters
 */
router.get("/kyc/queue", checkPermission(Permission.VIEW_PEOPLE_CENTER), async (req: AuthRequest, res) => {
  try {
    const params = KycQueueFilterSchema.parse(req.query);
    const { page, limit, ...filters } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.countryCode) where.countryCode = filters.countryCode;
    if (filters.userRole) where.userRole = filters.userRole;
    if (filters.assignedAdminId) where.assignedAdminId = filters.assignedAdminId;
    if (filters.isOverdue !== undefined) where.isOverdue = filters.isOverdue;
    if (filters.minRiskScore !== undefined || filters.maxRiskScore !== undefined) {
      where.riskScore = {};
      if (filters.minRiskScore !== undefined) where.riskScore.gte = filters.minRiskScore;
      if (filters.maxRiskScore !== undefined) where.riskScore.lte = filters.maxRiskScore;
    }

    const [queue, total] = await Promise.all([
      prisma.kycReviewQueue.findMany({
        where,
        orderBy: [
          { priority: "desc" },
          { submittedAt: "asc" },
        ],
        skip,
        take: limit,
      }),
      prisma.kycReviewQueue.count({ where }),
    ]);

    // Calculate queue statistics
    const stats = await prisma.kycReviewQueue.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    res.json({
      queue,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats: stats.reduce((acc, s) => {
        acc[s.status] = s._count.status;
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error) {
    console.error("Error fetching KYC queue:", error);
    res.status(500).json({ error: "Failed to fetch KYC queue" });
  }
});

/**
 * GET /api/admin-phase2/kyc/queue/:id
 * Get single KYC queue item details
 */
router.get("/kyc/queue/:id", checkPermission(Permission.VIEW_PEOPLE_CENTER), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const queueItem = await prisma.kycReviewQueue.findUnique({
      where: { id },
    });

    if (!queueItem) {
      return res.status(404).json({ error: "Queue item not found" });
    }

    // Fetch related risk signals
    let riskSignals: any[] = [];
    if (queueItem.riskSignalIds && queueItem.riskSignalIds.length > 0) {
      riskSignals = await prisma.identityRiskSignal.findMany({
        where: { id: { in: queueItem.riskSignalIds } },
      });
    }

    res.json({ queueItem, riskSignals });
  } catch (error) {
    console.error("Error fetching KYC queue item:", error);
    res.status(500).json({ error: "Failed to fetch KYC queue item" });
  }
});

/**
 * POST /api/admin-phase2/kyc/queue/assign
 * Assign a KYC review to an admin
 */
router.post("/kyc/queue/assign", checkPermission(Permission.BULK_KYC_OPERATIONS), async (req: AuthRequest, res) => {
  try {
    const data = AssignKycReviewSchema.parse(req.body);
    const adminUser = (req as any).adminUser;

    const updated = await prisma.kycReviewQueue.update({
      where: { id: data.queueItemId },
      data: {
        assignedAdminId: data.adminId,
        assignedAt: new Date(),
        status: "IN_PROGRESS",
        reviewStartedAt: new Date(),
      },
    });

    await logAuditEvent({
      actorId: adminUser?.id,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: "KYC_REVIEW_ASSIGNED",
      entityType: "KYC_QUEUE",
      entityId: data.queueItemId,
      description: `Assigned KYC review to admin ${data.adminId}`,
      ipAddress: getClientIp(req),
      metadata: { assignedTo: data.adminId },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error assigning KYC review:", error);
    res.status(500).json({ error: "Failed to assign KYC review" });
  }
});

/**
 * POST /api/admin-phase2/kyc/queue/complete
 * Complete a KYC review
 */
router.post("/kyc/queue/complete", checkPermission(Permission.MANAGE_PEOPLE_CENTER), async (req: AuthRequest, res) => {
  try {
    const data = CompleteKycReviewSchema.parse(req.body);
    const adminUser = (req as any).adminUser;

    const updated = await prisma.kycReviewQueue.update({
      where: { id: data.queueItemId },
      data: {
        status: data.status,
        completedAt: new Date(),
        reviewNotes: data.reviewNotes,
        rejectionReason: data.rejectionReason,
        previousReviews: { increment: 1 },
      },
    });

    await logAuditEvent({
      actorId: adminUser?.id,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: `KYC_REVIEW_${data.status}`,
      entityType: "KYC_QUEUE",
      entityId: data.queueItemId,
      description: `KYC review completed with status: ${data.status}`,
      ipAddress: getClientIp(req),
      metadata: { 
        status: data.status, 
        userId: updated.userId,
        rejectionReason: data.rejectionReason,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error completing KYC review:", error);
    res.status(500).json({ error: "Failed to complete KYC review" });
  }
});

/**
 * POST /api/admin-phase2/kyc/queue/escalate
 * Escalate a KYC review
 */
router.post("/kyc/queue/escalate", checkPermission(Permission.MANAGE_PEOPLE_CENTER), async (req: AuthRequest, res) => {
  try {
    const data = EscalateKycReviewSchema.parse(req.body);
    const adminUser = (req as any).adminUser;

    const updated = await prisma.kycReviewQueue.update({
      where: { id: data.queueItemId },
      data: {
        status: "ESCALATED",
        escalatedTo: data.escalateTo,
        escalatedAt: new Date(),
        escalationReason: data.reason,
      },
    });

    await logAuditEvent({
      actorId: adminUser?.id,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: "KYC_REVIEW_ESCALATED",
      entityType: "KYC_QUEUE",
      entityId: data.queueItemId,
      description: `KYC review escalated to ${data.escalateTo}: ${data.reason}`,
      ipAddress: getClientIp(req),
      metadata: { escalatedTo: data.escalateTo, reason: data.reason },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error escalating KYC review:", error);
    res.status(500).json({ error: "Failed to escalate KYC review" });
  }
});

/**
 * GET /api/admin-phase2/kyc/queue/stats
 * Get KYC queue statistics and SLA metrics
 */
router.get("/kyc/queue/stats", checkPermission(Permission.VIEW_PEOPLE_CENTER), async (req: AuthRequest, res) => {
  try {
    const countryCode = req.query.countryCode as string | undefined;
    const where = countryCode ? { countryCode } : {};

    const [
      totalPending,
      totalOverdue,
      byStatus,
      byPriority,
      byCountry,
      avgReviewTime,
    ] = await Promise.all([
      prisma.kycReviewQueue.count({ where: { ...where, status: "PENDING" } }),
      prisma.kycReviewQueue.count({ where: { ...where, isOverdue: true } }),
      prisma.kycReviewQueue.groupBy({ by: ["status"], where, _count: true }),
      prisma.kycReviewQueue.groupBy({ by: ["priority"], where, _count: true }),
      prisma.kycReviewQueue.groupBy({ by: ["countryCode"], _count: true }),
      prisma.kycReviewQueue.aggregate({
        where: { ...where, completedAt: { not: null } },
        _avg: { riskScore: true },
      }),
    ]);

    res.json({
      totalPending,
      totalOverdue,
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      byPriority: byPriority.reduce((acc, s) => ({ ...acc, [s.priority]: s._count }), {}),
      byCountry: byCountry.reduce((acc, s) => ({ ...acc, [s.countryCode]: s._count }), {}),
      avgRiskScore: avgReviewTime._avg.riskScore || 0,
    });
  } catch (error) {
    console.error("Error fetching KYC queue stats:", error);
    res.status(500).json({ error: "Failed to fetch KYC queue stats" });
  }
});

// ==============================================================
// RISK SIGNALS ENDPOINTS
// ==============================================================

/**
 * GET /api/admin-phase2/kyc/risk-signals
 * Get identity risk signals with filters
 */
router.get("/kyc/risk-signals", checkPermission(Permission.VIEW_RISK_CENTER), async (req: AuthRequest, res) => {
  try {
    const params = RiskSignalFilterSchema.parse(req.query);
    const { page, limit, ...filters } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.signalType) where.signalType = filters.signalType;
    if (filters.severity) where.severity = filters.severity;
    if (filters.status) where.status = filters.status;
    if (filters.countryCode) where.countryCode = filters.countryCode;

    const [signals, total] = await Promise.all([
      prisma.identityRiskSignal.findMany({
        where,
        orderBy: { detectedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.identityRiskSignal.count({ where }),
    ]);

    res.json({
      signals,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching risk signals:", error);
    res.status(500).json({ error: "Failed to fetch risk signals" });
  }
});

/**
 * POST /api/admin-phase2/kyc/risk-signals
 * Create a new risk signal
 */
router.post("/kyc/risk-signals", checkPermission(Permission.MANAGE_RISK_CASES), async (req: AuthRequest, res) => {
  try {
    const data = CreateRiskSignalSchema.parse(req.body);
    const adminUser = (req as any).adminUser;

    const signal = await prisma.identityRiskSignal.create({
      data: {
        userId: data.userId,
        userRole: data.userRole,
        signalType: data.signalType as any,
        severity: data.severity as any,
        description: data.description,
        evidence: data.evidence || {},
        countryCode: data.countryCode,
        detectedAt: new Date(),
        detectedBy: adminUser?.id || "system",
        status: "ACTIVE",
      },
    });

    await logAuditEvent({
      actorId: adminUser?.id,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: "RISK_SIGNAL_CREATED",
      entityType: "RISK_SIGNAL",
      entityId: signal.id,
      description: `Created ${data.severity} risk signal: ${data.signalType}`,
      ipAddress: getClientIp(req),
      metadata: { userId: data.userId, signalType: data.signalType, severity: data.severity },
    });

    res.status(201).json(signal);
  } catch (error) {
    console.error("Error creating risk signal:", error);
    res.status(500).json({ error: "Failed to create risk signal" });
  }
});

/**
 * POST /api/admin-phase2/kyc/risk-signals/resolve
 * Resolve a risk signal
 */
router.post("/kyc/risk-signals/resolve", checkPermission(Permission.RESOLVE_RISK_CASES), async (req: AuthRequest, res) => {
  try {
    const data = ResolveRiskSignalSchema.parse(req.body);
    const adminUser = (req as any).adminUser;

    const signal = await prisma.identityRiskSignal.update({
      where: { id: data.signalId },
      data: {
        status: "RESOLVED",
        resolution: data.resolution,
        resolvedBy: adminUser?.id,
        resolvedAt: new Date(),
      },
    });

    await logAuditEvent({
      actorId: adminUser?.id,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: "RISK_SIGNAL_RESOLVED",
      entityType: "RISK_SIGNAL",
      entityId: data.signalId,
      description: `Resolved risk signal: ${data.resolution}`,
      ipAddress: getClientIp(req),
      metadata: { resolution: data.resolution },
    });

    res.json(signal);
  } catch (error) {
    console.error("Error resolving risk signal:", error);
    res.status(500).json({ error: "Failed to resolve risk signal" });
  }
});

/**
 * GET /api/admin-phase2/kyc/risk-signals/user/:userId
 * Get all risk signals for a specific user
 */
router.get("/kyc/risk-signals/user/:userId", checkPermission(Permission.VIEW_RISK_CENTER), async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;

    const signals = await prisma.identityRiskSignal.findMany({
      where: { userId },
      orderBy: { detectedAt: "desc" },
    });

    // Calculate aggregate risk score
    const riskScore = signals.reduce((score, signal) => {
      if (signal.status !== "ACTIVE") return score;
      const severityWeight = { LOW: 1, MEDIUM: 3, HIGH: 7, CRITICAL: 15 };
      return score + (severityWeight[signal.severity as keyof typeof severityWeight] || 1);
    }, 0);

    res.json({ signals, riskScore, signalCount: signals.length });
  } catch (error) {
    console.error("Error fetching user risk signals:", error);
    res.status(500).json({ error: "Failed to fetch user risk signals" });
  }
});

// ==============================================================
// DUPLICATE DETECTION ENDPOINTS
// ==============================================================

/**
 * GET /api/admin-phase2/kyc/duplicates
 * Get duplicate account clusters
 */
router.get("/kyc/duplicates", checkPermission(Permission.VIEW_PEOPLE_CENTER), async (req: AuthRequest, res) => {
  try {
    const params = DuplicateDetectionFilterSchema.parse(req.query);
    const { page, limit, ...filters } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.matchType) where.matchType = filters.matchType;
    if (filters.riskLevel) where.riskLevel = filters.riskLevel;
    if (filters.status) where.status = filters.status;

    const [clusters, total] = await Promise.all([
      prisma.duplicateAccountCluster.findMany({
        where,
        orderBy: { detectedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.duplicateAccountCluster.count({ where }),
    ]);

    res.json({
      clusters,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching duplicate clusters:", error);
    res.status(500).json({ error: "Failed to fetch duplicate clusters" });
  }
});

/**
 * POST /api/admin-phase2/kyc/duplicates/merge
 * Merge duplicate accounts
 */
router.post("/kyc/duplicates/merge", checkPermission(Permission.BULK_KYC_OPERATIONS), async (req: AuthRequest, res) => {
  try {
    const { clusterId, primaryAccountId } = req.body;
    const adminUser = (req as any).adminUser;

    if (!clusterId || !primaryAccountId) {
      return res.status(400).json({ error: "clusterId and primaryAccountId required" });
    }

    const cluster = await prisma.duplicateAccountCluster.update({
      where: { id: clusterId },
      data: {
        primaryAccountId,
        status: "MERGED",
        mergedBy: adminUser?.id,
        mergedAt: new Date(),
      },
    });

    await logAuditEvent({
      actorId: adminUser?.id,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: "DUPLICATE_ACCOUNTS_MERGED",
      entityType: "DUPLICATE_CLUSTER",
      entityId: clusterId,
      description: `Merged duplicate accounts into primary: ${primaryAccountId}`,
      ipAddress: getClientIp(req),
      metadata: { primaryAccountId, accountIds: cluster.accountIds },
    });

    res.json(cluster);
  } catch (error) {
    console.error("Error merging duplicate accounts:", error);
    res.status(500).json({ error: "Failed to merge duplicate accounts" });
  }
});

/**
 * POST /api/admin-phase2/kyc/duplicates/dismiss
 * Dismiss a duplicate detection as false positive
 */
router.post("/kyc/duplicates/dismiss", checkPermission(Permission.MANAGE_PEOPLE_CENTER), async (req: AuthRequest, res) => {
  try {
    const { clusterId, reason } = req.body;
    const adminUser = (req as any).adminUser;

    if (!clusterId) {
      return res.status(400).json({ error: "clusterId required" });
    }

    const cluster = await prisma.duplicateAccountCluster.update({
      where: { id: clusterId },
      data: {
        status: "FALSE_POSITIVE",
        dismissedBy: adminUser?.id,
        dismissedAt: new Date(),
        dismissalReason: reason,
      },
    });

    await logAuditEvent({
      actorId: adminUser?.id,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: "DUPLICATE_DETECTION_DISMISSED",
      entityType: "DUPLICATE_CLUSTER",
      entityId: clusterId,
      description: `Dismissed duplicate detection as false positive`,
      ipAddress: getClientIp(req),
      metadata: { reason },
    });

    res.json(cluster);
  } catch (error) {
    console.error("Error dismissing duplicate detection:", error);
    res.status(500).json({ error: "Failed to dismiss duplicate detection" });
  }
});

// ==============================================================
// SUSPICIOUS ACTIVITY ENDPOINTS
// ==============================================================

/**
 * GET /api/admin-phase2/kyc/suspicious-activity
 * Get suspicious activity flags
 */
router.get("/kyc/suspicious-activity", checkPermission(Permission.VIEW_RISK_CENTER), async (req: AuthRequest, res) => {
  try {
    const params = SuspiciousActivityFilterSchema.parse(req.query);
    const { page, limit, ...filters } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.flagType) where.flagType = filters.flagType;
    if (filters.severity) where.severity = filters.severity;
    if (filters.status) where.status = filters.status;

    const [flags, total] = await Promise.all([
      prisma.suspiciousActivityFlag.findMany({
        where,
        orderBy: { detectedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.suspiciousActivityFlag.count({ where }),
    ]);

    res.json({
      flags,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching suspicious activity:", error);
    res.status(500).json({ error: "Failed to fetch suspicious activity" });
  }
});

/**
 * POST /api/admin-phase2/kyc/suspicious-activity
 * Create a suspicious activity flag
 */
router.post("/kyc/suspicious-activity", checkPermission(Permission.MANAGE_RISK_CASES), async (req: AuthRequest, res) => {
  try {
    const data = CreateSuspiciousActivitySchema.parse(req.body);
    const adminUser = (req as any).adminUser;

    const flag = await prisma.suspiciousActivityFlag.create({
      data: {
        userId: data.userId,
        userRole: data.userRole,
        flagType: data.flagType,
        severity: data.severity as any,
        description: data.description,
        evidence: data.evidence || {},
        detectedAt: new Date(),
        detectedBy: adminUser?.id || "system",
        status: "OPEN",
      },
    });

    await logAuditEvent({
      actorId: adminUser?.id,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: "SUSPICIOUS_ACTIVITY_FLAGGED",
      entityType: "SUSPICIOUS_ACTIVITY",
      entityId: flag.id,
      description: `Flagged suspicious activity: ${data.flagType}`,
      ipAddress: getClientIp(req),
      metadata: { userId: data.userId, flagType: data.flagType, severity: data.severity },
    });

    res.status(201).json(flag);
  } catch (error) {
    console.error("Error creating suspicious activity flag:", error);
    res.status(500).json({ error: "Failed to create suspicious activity flag" });
  }
});

/**
 * POST /api/admin-phase2/kyc/suspicious-activity/:id/resolve
 * Resolve a suspicious activity flag
 */
router.post("/kyc/suspicious-activity/:id/resolve", checkPermission(Permission.RESOLVE_RISK_CASES), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { resolution, actionTaken } = req.body;
    const adminUser = (req as any).adminUser;

    const flag = await prisma.suspiciousActivityFlag.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolution,
        actionTaken,
        resolvedBy: adminUser?.id,
        resolvedAt: new Date(),
      },
    });

    await logAuditEvent({
      actorId: adminUser?.id,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: "SUSPICIOUS_ACTIVITY_RESOLVED",
      entityType: "SUSPICIOUS_ACTIVITY",
      entityId: id,
      description: `Resolved suspicious activity: ${resolution}`,
      ipAddress: getClientIp(req),
      metadata: { resolution, actionTaken },
    });

    res.json(flag);
  } catch (error) {
    console.error("Error resolving suspicious activity:", error);
    res.status(500).json({ error: "Failed to resolve suspicious activity" });
  }
});

// ==============================================================
// KYC ENFORCEMENT RULES ENDPOINTS
// ==============================================================

/**
 * GET /api/admin-phase2/kyc/enforcement-rules
 * Get KYC enforcement rules by country
 */
router.get("/kyc/enforcement-rules", checkPermission(Permission.VIEW_SYSTEM_CONFIG), async (req: AuthRequest, res) => {
  try {
    const { countryCode, userRole } = req.query;
    const where: any = { isActive: true };
    if (countryCode) where.countryCode = countryCode;
    if (userRole) where.userRole = userRole;

    const rules = await prisma.kycEnforcementRule.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json(rules);
  } catch (error) {
    console.error("Error fetching KYC enforcement rules:", error);
    res.status(500).json({ error: "Failed to fetch KYC enforcement rules" });
  }
});

/**
 * POST /api/admin-phase2/kyc/enforcement-rules
 * Create or update a KYC enforcement rule
 */
router.post("/kyc/enforcement-rules", checkPermission(Permission.MANAGE_SYSTEM_CONFIG), async (req: AuthRequest, res) => {
  try {
    const data = req.body;
    const adminUser = (req as any).adminUser;

    const rule = await prisma.kycEnforcementRule.upsert({
      where: {
        countryCode_userRole_ruleName: {
          countryCode: data.countryCode,
          userRole: data.userRole,
          ruleName: data.ruleName,
        },
      },
      create: {
        countryCode: data.countryCode,
        userRole: data.userRole,
        ruleName: data.ruleName,
        description: data.description,
        requiredDocuments: data.requiredDocuments || [],
        optionalDocuments: data.optionalDocuments || [],
        minVerificationLevel: data.minVerificationLevel || 1,
        requiresLivenessCheck: data.requiresLivenessCheck || false,
        requiresFacialMatch: data.requiresFacialMatch || false,
        requiresBackgroundCheck: data.requiresBackgroundCheck || false,
        gracePeriodDays: data.gracePeriodDays || 0,
        expiryWarningDays: data.expiryWarningDays || 30,
        autoRejectUnverified: data.autoRejectUnverified || false,
        autoSuspendExpired: data.autoSuspendExpired || true,
        createdBy: adminUser?.id,
      },
      update: {
        description: data.description,
        requiredDocuments: data.requiredDocuments || [],
        optionalDocuments: data.optionalDocuments || [],
        minVerificationLevel: data.minVerificationLevel,
        requiresLivenessCheck: data.requiresLivenessCheck,
        requiresFacialMatch: data.requiresFacialMatch,
        requiresBackgroundCheck: data.requiresBackgroundCheck,
        gracePeriodDays: data.gracePeriodDays,
        expiryWarningDays: data.expiryWarningDays,
        autoRejectUnverified: data.autoRejectUnverified,
        autoSuspendExpired: data.autoSuspendExpired,
        updatedBy: adminUser?.id,
      },
    });

    await logAuditEvent({
      actorId: adminUser?.id,
      actorEmail: adminUser?.email || "unknown",
      actorRole: "admin",
      actionType: "KYC_ENFORCEMENT_RULE_UPDATED",
      entityType: "KYC_ENFORCEMENT_RULE",
      entityId: rule.id,
      description: `Updated KYC enforcement rule: ${data.ruleName}`,
      ipAddress: getClientIp(req),
      metadata: { countryCode: data.countryCode, userRole: data.userRole },
    });

    res.json(rule);
  } catch (error) {
    console.error("Error updating KYC enforcement rule:", error);
    res.status(500).json({ error: "Failed to update KYC enforcement rule" });
  }
});

export default router;
