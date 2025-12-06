/**
 * Policy & Safety Management Routes
 * 
 * SafeGo Master Tasks 1-15:
 * - Terms & Conditions
 * - Refund Policy
 * - Cancellation Policy
 * - Community Guidelines
 * - Code of Conduct
 * - Safety Policy
 * - Partner Agreements
 * - SOS Emergency
 * - Safety Monitoring
 * - Audio Recording
 * - Background Checks
 * - Reports
 * - User Restrictions
 * - Safety Center
 */

import { Router } from "express";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();

router.use(authenticateToken);

const adminOnly = (req: AuthRequest, res: any, next: any) => {
  if (!["admin", "super_admin"].includes(req.user?.role || "")) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// ===================================================
// TASK 1: TERMS & CONDITIONS SYSTEM
// ===================================================

router.get("/terms/active", async (req: AuthRequest, res) => {
  try {
    const { countryCode } = req.query;
    const terms = await prisma.termsVersion.findFirst({
      where: { 
        isActive: true,
        OR: [
          { countryCode: countryCode as string },
          { countryCode: null }
        ]
      },
      orderBy: { countryCode: 'desc' }
    });
    res.json({ success: true, terms });
  } catch (error) {
    console.error("[Policy] Get active terms error:", error);
    res.status(500).json({ error: "Failed to fetch terms" });
  }
});

router.get("/terms", adminOnly, async (req: AuthRequest, res) => {
  try {
    const terms = await prisma.termsVersion.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, terms });
  } catch (error) {
    console.error("[Policy] List terms error:", error);
    res.status(500).json({ error: "Failed to fetch terms" });
  }
});

const termsSchema = z.object({
  version: z.string().min(1),
  title: z.string().min(1),
  contentUrl: z.string().min(1),
  content: z.string().optional(),
  summary: z.string().optional(),
  countryCode: z.string().optional(),
});

router.post("/terms", adminOnly, async (req: AuthRequest, res) => {
  try {
    const parsed = termsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
    }
    const terms = await prisma.termsVersion.create({
      data: { ...parsed.data, createdBy: req.user?.id },
    });
    res.json({ success: true, terms });
  } catch (error) {
    console.error("[Policy] Create terms error:", error);
    res.status(500).json({ error: "Failed to create terms" });
  }
});

router.patch("/terms/:id/activate", adminOnly, async (req: AuthRequest, res) => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.termsVersion.updateMany({ where: { isActive: true }, data: { isActive: false } });
      await tx.termsVersion.update({ where: { id: req.params.id }, data: { isActive: true } });
    });
    res.json({ success: true, message: "Terms activated" });
  } catch (error) {
    console.error("[Policy] Activate terms error:", error);
    res.status(500).json({ error: "Failed to activate terms" });
  }
});

// ===================================================
// TASK 2: REFUND POLICY
// ===================================================

router.get("/refund-policy/active", async (req: AuthRequest, res) => {
  try {
    const { serviceType, countryCode } = req.query;
    const policy = await prisma.refundPolicyVersion.findFirst({
      where: { 
        isActive: true,
        OR: [
          { serviceType: serviceType as string },
          { serviceType: null }
        ]
      },
    });
    res.json({ success: true, policy });
  } catch (error) {
    console.error("[Policy] Get refund policy error:", error);
    res.status(500).json({ error: "Failed to fetch refund policy" });
  }
});

router.get("/refund-policy", adminOnly, async (req: AuthRequest, res) => {
  try {
    const policies = await prisma.refundPolicyVersion.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, policies });
  } catch (error) {
    console.error("[Policy] List refund policies error:", error);
    res.status(500).json({ error: "Failed to fetch refund policies" });
  }
});

const refundPolicySchema = z.object({
  version: z.string().min(1),
  title: z.string().min(1),
  contentUrl: z.string().optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  serviceType: z.string().optional(),
  countryCode: z.string().optional(),
});

router.post("/refund-policy", adminOnly, async (req: AuthRequest, res) => {
  try {
    const parsed = refundPolicySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
    }
    const policy = await prisma.refundPolicyVersion.create({
      data: { ...parsed.data, createdBy: req.user?.id },
    });
    res.json({ success: true, policy });
  } catch (error) {
    console.error("[Policy] Create refund policy error:", error);
    res.status(500).json({ error: "Failed to create refund policy" });
  }
});

router.patch("/refund-policy/:id/activate", adminOnly, async (req: AuthRequest, res) => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.refundPolicyVersion.updateMany({ where: { isActive: true }, data: { isActive: false } });
      await tx.refundPolicyVersion.update({ where: { id: req.params.id }, data: { isActive: true } });
    });
    res.json({ success: true, message: "Refund policy activated" });
  } catch (error) {
    console.error("[Policy] Activate refund policy error:", error);
    res.status(500).json({ error: "Failed to activate refund policy" });
  }
});

// ===================================================
// TASK 3: CANCELLATION POLICY
// ===================================================

router.get("/cancellation-policy/active", async (req: AuthRequest, res) => {
  try {
    const { actor, serviceType } = req.query;
    const policies = await prisma.cancellationPolicyVersion.findMany({
      where: { 
        isActive: true,
        ...(actor ? { actor: actor as any } : {}),
      },
    });
    res.json({ success: true, policies });
  } catch (error) {
    console.error("[Policy] Get cancellation policy error:", error);
    res.status(500).json({ error: "Failed to fetch cancellation policy" });
  }
});

router.get("/cancellation-policy", adminOnly, async (req: AuthRequest, res) => {
  try {
    const policies = await prisma.cancellationPolicyVersion.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, policies });
  } catch (error) {
    console.error("[Policy] List cancellation policies error:", error);
    res.status(500).json({ error: "Failed to fetch cancellation policies" });
  }
});

const cancellationPolicySchema = z.object({
  version: z.string().min(1),
  title: z.string().min(1),
  contentUrl: z.string().optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  actor: z.enum(["customer", "driver", "merchant", "system"]),
  serviceType: z.string().optional(),
  feePercentage: z.number().optional(),
  feeFlat: z.number().optional(),
  gracePeriodMinutes: z.number().optional(),
  countryCode: z.string().optional(),
});

router.post("/cancellation-policy", adminOnly, async (req: AuthRequest, res) => {
  try {
    const parsed = cancellationPolicySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
    }
    const policy = await prisma.cancellationPolicyVersion.create({
      data: { ...parsed.data, createdBy: req.user?.id },
    });
    res.json({ success: true, policy });
  } catch (error) {
    console.error("[Policy] Create cancellation policy error:", error);
    res.status(500).json({ error: "Failed to create cancellation policy" });
  }
});

// ===================================================
// TASK 4: COMMUNITY GUIDELINES
// ===================================================

router.get("/community-guidelines/active", async (req: AuthRequest, res) => {
  try {
    const { targetRole } = req.query;
    const guidelines = await prisma.communityGuideline.findFirst({
      where: { 
        isActive: true,
        OR: [
          { targetRole: targetRole as string },
          { targetRole: "all" }
        ]
      },
    });
    res.json({ success: true, guidelines });
  } catch (error) {
    console.error("[Policy] Get guidelines error:", error);
    res.status(500).json({ error: "Failed to fetch guidelines" });
  }
});

router.get("/community-guidelines", adminOnly, async (req: AuthRequest, res) => {
  try {
    const guidelines = await prisma.communityGuideline.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, guidelines });
  } catch (error) {
    console.error("[Policy] List guidelines error:", error);
    res.status(500).json({ error: "Failed to fetch guidelines" });
  }
});

const guidelinesSchema = z.object({
  version: z.string().min(1),
  title: z.string().min(1),
  contentUrl: z.string().optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  targetRole: z.string().default("customer"),
  countryCode: z.string().optional(),
});

router.post("/community-guidelines", adminOnly, async (req: AuthRequest, res) => {
  try {
    const parsed = guidelinesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
    }
    const guidelines = await prisma.communityGuideline.create({
      data: { ...parsed.data, createdBy: req.user?.id },
    });
    res.json({ success: true, guidelines });
  } catch (error) {
    console.error("[Policy] Create guidelines error:", error);
    res.status(500).json({ error: "Failed to create guidelines" });
  }
});

router.patch("/community-guidelines/:id/activate", adminOnly, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.communityGuideline.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    
    await prisma.$transaction(async (tx) => {
      await tx.communityGuideline.updateMany({ 
        where: { isActive: true, targetRole: existing.targetRole }, 
        data: { isActive: false } 
      });
      await tx.communityGuideline.update({ where: { id: req.params.id }, data: { isActive: true } });
    });
    res.json({ success: true, message: "Guidelines activated" });
  } catch (error) {
    console.error("[Policy] Activate guidelines error:", error);
    res.status(500).json({ error: "Failed to activate guidelines" });
  }
});

// ===================================================
// TASKS 5 & 6: CODE OF CONDUCT
// ===================================================

router.get("/code-of-conduct/active", async (req: AuthRequest, res) => {
  try {
    const { targetRole } = req.query;
    const codeOfConduct = await prisma.codeOfConduct.findFirst({
      where: { 
        isActive: true,
        OR: [
          { targetRole: targetRole as any },
          { targetRole: "all_partners" }
        ]
      },
    });
    res.json({ success: true, codeOfConduct });
  } catch (error) {
    console.error("[Policy] Get code of conduct error:", error);
    res.status(500).json({ error: "Failed to fetch code of conduct" });
  }
});

router.get("/code-of-conduct", adminOnly, async (req: AuthRequest, res) => {
  try {
    const codes = await prisma.codeOfConduct.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, codes });
  } catch (error) {
    console.error("[Policy] List code of conduct error:", error);
    res.status(500).json({ error: "Failed to fetch code of conduct" });
  }
});

const codeOfConductSchema = z.object({
  version: z.string().min(1),
  title: z.string().min(1),
  contentUrl: z.string().optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  targetRole: z.enum(["driver", "restaurant", "shop_partner", "ticket_operator", "rental_partner", "all_partners"]),
  countryCode: z.string().optional(),
});

router.post("/code-of-conduct", adminOnly, async (req: AuthRequest, res) => {
  try {
    const parsed = codeOfConductSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
    }
    const code = await prisma.codeOfConduct.create({
      data: { ...parsed.data, createdBy: req.user?.id },
    });
    res.json({ success: true, code });
  } catch (error) {
    console.error("[Policy] Create code of conduct error:", error);
    res.status(500).json({ error: "Failed to create code of conduct" });
  }
});

router.patch("/code-of-conduct/:id/activate", adminOnly, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.codeOfConduct.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    
    await prisma.$transaction(async (tx) => {
      await tx.codeOfConduct.updateMany({ 
        where: { isActive: true, targetRole: existing.targetRole }, 
        data: { isActive: false } 
      });
      await tx.codeOfConduct.update({ where: { id: req.params.id }, data: { isActive: true } });
    });
    res.json({ success: true, message: "Code of conduct activated" });
  } catch (error) {
    console.error("[Policy] Activate code of conduct error:", error);
    res.status(500).json({ error: "Failed to activate code of conduct" });
  }
});

// ===================================================
// TASK 7: SAFETY POLICY
// ===================================================

router.get("/safety-policy/active", async (req: AuthRequest, res) => {
  try {
    const policy = await prisma.safetyPolicyVersion.findFirst({
      where: { isActive: true },
    });
    res.json({ success: true, policy });
  } catch (error) {
    console.error("[Policy] Get safety policy error:", error);
    res.status(500).json({ error: "Failed to fetch safety policy" });
  }
});

router.get("/safety-policy", adminOnly, async (req: AuthRequest, res) => {
  try {
    const policies = await prisma.safetyPolicyVersion.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, policies });
  } catch (error) {
    console.error("[Policy] List safety policies error:", error);
    res.status(500).json({ error: "Failed to fetch safety policies" });
  }
});

const safetyPolicySchema = z.object({
  version: z.string().min(1),
  title: z.string().min(1),
  contentUrl: z.string().optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  countryCode: z.string().optional(),
});

router.post("/safety-policy", adminOnly, async (req: AuthRequest, res) => {
  try {
    const parsed = safetyPolicySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
    }
    const policy = await prisma.safetyPolicyVersion.create({
      data: { ...parsed.data, createdBy: req.user?.id },
    });
    res.json({ success: true, policy });
  } catch (error) {
    console.error("[Policy] Create safety policy error:", error);
    res.status(500).json({ error: "Failed to create safety policy" });
  }
});

router.patch("/safety-policy/:id/activate", adminOnly, async (req: AuthRequest, res) => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.safetyPolicyVersion.updateMany({ where: { isActive: true }, data: { isActive: false } });
      await tx.safetyPolicyVersion.update({ where: { id: req.params.id }, data: { isActive: true } });
    });
    res.json({ success: true, message: "Safety policy activated" });
  } catch (error) {
    console.error("[Policy] Activate safety policy error:", error);
    res.status(500).json({ error: "Failed to activate safety policy" });
  }
});

// ===================================================
// TASK 8: PARTNER AGREEMENTS
// ===================================================

router.get("/partner-agreement/my", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    
    let partnerId: string | undefined;
    if (role === "driver") {
      const profile = await prisma.driverProfile.findFirst({ where: { userId } });
      partnerId = profile?.id;
    } else if (role === "restaurant") {
      const profile = await prisma.restaurantProfile.findFirst({ where: { userId } });
      partnerId = profile?.id;
    } else if (role === "shop_partner") {
      const profile = await prisma.shopPartner.findFirst({ where: { userId } });
      partnerId = profile?.id;
    } else if (role === "ticket_operator") {
      const profile = await prisma.ticketOperator.findFirst({ where: { userId } });
      partnerId = profile?.id;
    }

    if (!partnerId) return res.json({ success: true, agreement: null });

    const agreement = await prisma.partnerAgreement.findFirst({
      where: { partnerId, isValid: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, agreement });
  } catch (error) {
    console.error("[Policy] Get partner agreement error:", error);
    res.status(500).json({ error: "Failed to fetch agreement" });
  }
});

router.post("/partner-agreement/sign", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { version, signatureData, signatureMethod } = req.body;
    
    let partnerId: string | undefined;
    let partnerType: "driver" | "restaurant" | "shop_partner" | "ticket_operator" | "rental_partner" = "driver";
    
    if (role === "driver") {
      const profile = await prisma.driverProfile.findFirst({ where: { userId } });
      partnerId = profile?.id;
      partnerType = "driver";
    } else if (role === "restaurant") {
      const profile = await prisma.restaurantProfile.findFirst({ where: { userId } });
      partnerId = profile?.id;
      partnerType = "restaurant";
    } else if (role === "shop_partner") {
      const profile = await prisma.shopPartner.findFirst({ where: { userId } });
      partnerId = profile?.id;
      partnerType = "shop_partner";
    } else if (role === "ticket_operator") {
      const profile = await prisma.ticketOperator.findFirst({ where: { userId } });
      partnerId = profile?.id;
      partnerType = "ticket_operator";
    }

    if (!partnerId) return res.status(400).json({ error: "Partner profile not found" });

    const agreement = await prisma.partnerAgreement.create({
      data: {
        partnerId,
        partnerType,
        version: version || "1.0",
        signedAt: new Date(),
        signatureData,
        signatureMethod: signatureMethod || "typed",
        ipAddress: req.headers["x-forwarded-for"] as string || req.ip,
        deviceInfo: req.headers["user-agent"] as string,
      },
    });

    res.json({ success: true, agreement, message: "Agreement signed successfully" });
  } catch (error) {
    console.error("[Policy] Sign agreement error:", error);
    res.status(500).json({ error: "Failed to sign agreement" });
  }
});

router.get("/partner-agreements", adminOnly, async (req: AuthRequest, res) => {
  try {
    const { partnerType, limit = "50", offset = "0" } = req.query;
    const where: any = {};
    if (partnerType) where.partnerType = partnerType;

    const [agreements, total] = await Promise.all([
      prisma.partnerAgreement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.partnerAgreement.count({ where }),
    ]);
    res.json({ success: true, agreements, pagination: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) } });
  } catch (error) {
    console.error("[Policy] List agreements error:", error);
    res.status(500).json({ error: "Failed to fetch agreements" });
  }
});

// ===================================================
// TASK 9: SOS EMERGENCY
// ===================================================

router.post("/sos/trigger", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { rideId, latitude, longitude, address } = req.body;

    const sosLog = await prisma.sosLog.create({
      data: {
        triggeredBy: userId,
        triggeredByRole: role || "customer",
        rideId,
        latitude,
        longitude,
        address,
        status: "triggered",
      },
    });

    console.log(`[SOS] Emergency triggered by ${role} ${userId} for ride ${rideId}`);

    res.json({ success: true, sosLog, message: "Emergency SOS triggered. Help is on the way." });
  } catch (error) {
    console.error("[SOS] Trigger error:", error);
    res.status(500).json({ error: "Failed to trigger SOS" });
  }
});

router.get("/sos/logs", adminOnly, async (req: AuthRequest, res) => {
  try {
    const { status, limit = "50", offset = "0" } = req.query;
    const where: any = {};
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      prisma.sosLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.sosLog.count({ where }),
    ]);
    res.json({ success: true, logs, pagination: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) } });
  } catch (error) {
    console.error("[SOS] List logs error:", error);
    res.status(500).json({ error: "Failed to fetch SOS logs" });
  }
});

router.patch("/sos/:id/resolve", adminOnly, async (req: AuthRequest, res) => {
  try {
    const { status, resolutionNote } = req.body;
    const sosLog = await prisma.sosLog.update({
      where: { id: req.params.id },
      data: {
        status: status || "resolved",
        acknowledgedBy: req.user?.id,
        acknowledgedAt: new Date(),
        resolvedAt: new Date(),
        resolutionNote,
      },
    });
    res.json({ success: true, sosLog });
  } catch (error) {
    console.error("[SOS] Resolve error:", error);
    res.status(500).json({ error: "Failed to resolve SOS" });
  }
});

// ===================================================
// TASK 10: SAFETY MONITORING
// ===================================================

router.post("/safety-monitoring/log", async (req: AuthRequest, res) => {
  try {
    const { rideId, driverId, eventType, severity, latitude, longitude, speedRecorded, speedLimit, deviationMeters, description } = req.body;

    const log = await prisma.rideSafetyMonitoringLog.create({
      data: {
        rideId,
        driverId,
        userId: req.user?.id,
        eventType,
        severity: severity || "low",
        latitude,
        longitude,
        speedRecorded,
        speedLimit,
        deviationMeters,
        description,
      },
    });

    console.log(`[Safety] Event logged: ${eventType} for ride ${rideId}`);
    res.json({ success: true, log });
  } catch (error) {
    console.error("[Safety] Log event error:", error);
    res.status(500).json({ error: "Failed to log safety event" });
  }
});

router.get("/safety-monitoring/logs", adminOnly, async (req: AuthRequest, res) => {
  try {
    const { rideId, driverId, eventType, limit = "50", offset = "0" } = req.query;
    const where: any = {};
    if (rideId) where.rideId = rideId;
    if (driverId) where.driverId = driverId;
    if (eventType) where.eventType = eventType;

    const [logs, total] = await Promise.all([
      prisma.rideSafetyMonitoringLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.rideSafetyMonitoringLog.count({ where }),
    ]);
    res.json({ success: true, logs, pagination: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) } });
  } catch (error) {
    console.error("[Safety] List logs error:", error);
    res.status(500).json({ error: "Failed to fetch safety logs" });
  }
});

// ===================================================
// TASK 11: AUDIO RECORDING
// ===================================================

router.post("/audio-recording/start", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { rideId } = req.body;
    if (!rideId) return res.status(400).json({ error: "Ride ID required" });

    const session = await prisma.audioRecordingSession.create({
      data: {
        rideId,
        startedBy: userId,
        startedByRole: role || "customer",
      },
    });

    res.json({ success: true, session, message: "Audio recording started" });
  } catch (error) {
    console.error("[Audio] Start recording error:", error);
    res.status(500).json({ error: "Failed to start recording" });
  }
});

router.patch("/audio-recording/:id/stop", async (req: AuthRequest, res) => {
  try {
    const { encryptedFileUrl, durationSeconds } = req.body;
    
    const session = await prisma.audioRecordingSession.update({
      where: { id: req.params.id },
      data: {
        endedAt: new Date(),
        encryptedFileUrl,
        durationSeconds,
      },
    });

    res.json({ success: true, session, message: "Audio recording stopped" });
  } catch (error) {
    console.error("[Audio] Stop recording error:", error);
    res.status(500).json({ error: "Failed to stop recording" });
  }
});

// ===================================================
// TASK 12: BACKGROUND CHECKS
// ===================================================

router.get("/background-checks", adminOnly, async (req: AuthRequest, res) => {
  try {
    const { status, limit = "50", offset = "0" } = req.query;
    const where: any = {};
    if (status) where.status = status;

    const [records, total] = await Promise.all([
      prisma.backgroundCheckRecord.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.backgroundCheckRecord.count({ where }),
    ]);
    res.json({ success: true, records, pagination: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) } });
  } catch (error) {
    console.error("[Background] List checks error:", error);
    res.status(500).json({ error: "Failed to fetch background checks" });
  }
});

router.patch("/background-checks/:id", adminOnly, async (req: AuthRequest, res) => {
  try {
    const { status, resultSummary, reviewNote } = req.body;
    
    const record = await prisma.backgroundCheckRecord.update({
      where: { id: req.params.id },
      data: {
        status,
        resultSummary,
        reviewedBy: req.user?.id,
        reviewedAt: new Date(),
        reviewNote,
        completedAt: ["passed", "failed"].includes(status) ? new Date() : undefined,
      },
    });

    res.json({ success: true, record });
  } catch (error) {
    console.error("[Background] Update check error:", error);
    res.status(500).json({ error: "Failed to update background check" });
  }
});

// ===================================================
// TASK 13: REPORTS
// ===================================================

router.post("/reports", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { targetId, targetRole, rideId, orderId, category, reason, description, evidence } = req.body;

    const report = await prisma.report.create({
      data: {
        reporterId: userId,
        reporterRole: role || "customer",
        targetId,
        targetRole,
        rideId,
        orderId,
        category,
        reason,
        description,
        evidence,
      },
    });

    res.json({ success: true, report, message: "Report submitted successfully" });
  } catch (error) {
    console.error("[Reports] Create report error:", error);
    res.status(500).json({ error: "Failed to submit report" });
  }
});

router.get("/reports", adminOnly, async (req: AuthRequest, res) => {
  try {
    const { status, category, targetRole, limit = "50", offset = "0" } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (targetRole) where.targetRole = targetRole;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.report.count({ where }),
    ]);
    res.json({ success: true, reports, pagination: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) } });
  } catch (error) {
    console.error("[Reports] List reports error:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

router.patch("/reports/:id", adminOnly, async (req: AuthRequest, res) => {
  try {
    const { status, reviewNote, actionTaken, priority } = req.body;
    
    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: {
        status,
        reviewNote,
        actionTaken,
        priority,
        reviewedBy: req.user?.id,
        reviewedAt: new Date(),
      },
    });

    res.json({ success: true, report });
  } catch (error) {
    console.error("[Reports] Update report error:", error);
    res.status(500).json({ error: "Failed to update report" });
  }
});

// ===================================================
// TASK 14: USER RESTRICTIONS
// ===================================================

router.get("/restrictions", adminOnly, async (req: AuthRequest, res) => {
  try {
    const { userId, status, isActive, limit = "50", offset = "0" } = req.query;
    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (isActive !== undefined) where.isActive = isActive === "true";

    const [restrictions, total] = await Promise.all([
      prisma.userRestriction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.userRestriction.count({ where }),
    ]);
    res.json({ success: true, restrictions, pagination: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) } });
  } catch (error) {
    console.error("[Restrictions] List restrictions error:", error);
    res.status(500).json({ error: "Failed to fetch restrictions" });
  }
});

router.post("/restrictions", adminOnly, async (req: AuthRequest, res) => {
  try {
    const { userId, userRole, status, reason, reasonDetails, expiresAt } = req.body;

    const restriction = await prisma.userRestriction.create({
      data: {
        userId,
        userRole,
        status,
        reason,
        reasonDetails,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        triggeredBy: req.user?.id,
        triggeredByType: "admin",
      },
    });

    res.json({ success: true, restriction });
  } catch (error) {
    console.error("[Restrictions] Create restriction error:", error);
    res.status(500).json({ error: "Failed to create restriction" });
  }
});

router.patch("/restrictions/:id", adminOnly, async (req: AuthRequest, res) => {
  try {
    const { status, isActive, reviewNote } = req.body;
    
    const restriction = await prisma.userRestriction.update({
      where: { id: req.params.id },
      data: {
        status,
        isActive,
        reviewedBy: req.user?.id,
        reviewedAt: new Date(),
        reviewNote,
      },
    });

    res.json({ success: true, restriction });
  } catch (error) {
    console.error("[Restrictions] Update restriction error:", error);
    res.status(500).json({ error: "Failed to update restriction" });
  }
});

// ===================================================
// TASK 15: EMERGENCY CONTACTS (Safety Center)
// ===================================================

router.get("/emergency-contacts/my", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const contacts = await prisma.emergencyContact.findMany({
      where: { userId },
      orderBy: { isPrimary: "desc" },
    });
    res.json({ success: true, contacts });
  } catch (error) {
    console.error("[Safety Center] Get contacts error:", error);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

router.post("/emergency-contacts", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { name, phone, relationship, isPrimary } = req.body;

    if (isPrimary) {
      await prisma.emergencyContact.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.emergencyContact.create({
      data: {
        userId,
        userRole: role || "customer",
        name,
        phone,
        relationship,
        isPrimary: isPrimary || false,
      },
    });

    res.json({ success: true, contact });
  } catch (error) {
    console.error("[Safety Center] Create contact error:", error);
    res.status(500).json({ error: "Failed to create contact" });
  }
});

router.delete("/emergency-contacts/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const contact = await prisma.emergencyContact.findUnique({ where: { id: req.params.id } });
    if (!contact || contact.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to delete this contact" });
    }

    await prisma.emergencyContact.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Contact deleted" });
  } catch (error) {
    console.error("[Safety Center] Delete contact error:", error);
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

// Safety Center summary endpoint
router.get("/safety-center", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const [safetyPolicy, emergencyContacts, recentAlerts] = await Promise.all([
      prisma.safetyPolicyVersion.findFirst({ where: { isActive: true } }),
      prisma.emergencyContact.findMany({ where: { userId }, take: 3, orderBy: { isPrimary: "desc" } }),
      prisma.safetyEvent.findMany({ where: { customerId: userId }, take: 5, orderBy: { createdAt: "desc" } }),
    ]);

    res.json({
      success: true,
      safetyPolicy,
      emergencyContacts,
      recentAlerts,
    });
  } catch (error) {
    console.error("[Safety Center] Get summary error:", error);
    res.status(500).json({ error: "Failed to fetch safety center data" });
  }
});

export default router;
