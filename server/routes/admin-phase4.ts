import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, AuthRequest, checkPermission } from "../middleware/auth";
import { requireAdmin } from "../middleware/authz";
import { Permission } from "../utils/permissions";
import { z } from "zod";
import crypto from "crypto";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);
router.use(requireAdmin);

// ========================================
// 1. COMPLAINT RESOLUTION SYSTEM
// ========================================

const complaintFilterSchema = z.object({
  category: z.string().optional(),
  severity: z.string().optional(),
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  assignedTo: z.string().optional(),
  countryCode: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

router.get("/complaints", checkPermission(Permission.VIEW_COMPLAINTS), async (req: AuthRequest, res) => {
  try {
    const filters = complaintFilterSchema.parse(req.query);
    const where: any = {};

    if (filters.category) where.category = filters.category;
    if (filters.severity) where.severity = filters.severity;
    if (filters.status) where.status = filters.status;
    if (filters.countryCode) where.countryCode = filters.countryCode;
    if (filters.assignedTo) where.assignedTo = filters.assignedTo;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const [complaints, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        include: {
          customer: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
          driver: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
          evidence: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.complaint.count({ where }),
    ]);

    res.json({
      complaints,
      pagination: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    });
  } catch (error) {
    console.error("Error fetching complaints:", error);
    res.status(500).json({ error: "Failed to fetch complaints" });
  }
});

router.get("/complaints/:id", checkPermission(Permission.VIEW_COMPLAINTS), async (req: AuthRequest, res) => {
  try {
    const complaint = await prisma.complaint.findUnique({
      where: { id: req.params.id },
      include: {
        customer: { include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
        driver: { include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
        ride: true,
        evidence: true,
        auditLogs: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    res.json(complaint);
  } catch (error) {
    console.error("Error fetching complaint:", error);
    res.status(500).json({ error: "Failed to fetch complaint" });
  }
});

const createComplaintSchema = z.object({
  category: z.enum(["ride_quality", "driver_behavior", "safety_concern", "billing_issue", "food_quality", "delivery_issue", "app_problem", "fraud_report", "harassment", "discrimination", "vehicle_condition", "other"]),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  subject: z.string().min(1),
  description: z.string().min(1),
  customerId: z.string().optional(),
  driverId: z.string().optional(),
  rideId: z.string().optional(),
  orderId: z.string().optional(),
  parcelId: z.string().optional(),
  countryCode: z.string().default("US"),
  attachments: z.array(z.string()).optional(),
});

router.post("/complaints", checkPermission(Permission.MANAGE_COMPLAINTS), async (req: AuthRequest, res) => {
  try {
    const data = createComplaintSchema.parse(req.body);
    const ticketCode = `SG-CMP-${new Date().getFullYear()}-${String(await prisma.complaint.count() + 1).padStart(6, "0")}`;

    const complaint = await prisma.complaint.create({
      data: {
        ticketCode,
        ...data,
        attachments: data.attachments || [],
      },
    });

    await prisma.complaintAuditLog.create({
      data: {
        complaintId: complaint.id,
        action: "created",
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { subject: data.subject, category: data.category },
      },
    });

    res.status(201).json(complaint);
  } catch (error) {
    console.error("Error creating complaint:", error);
    res.status(500).json({ error: "Failed to create complaint" });
  }
});

const updateComplaintSchema = z.object({
  status: z.enum(["new", "reviewed", "needs_more_info", "escalated", "assigned", "in_progress", "resolved", "archived"]).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  triageNotes: z.string().optional(),
  assignedTo: z.string().optional(),
  resolutionNote: z.string().optional(),
});

router.patch("/complaints/:id", checkPermission(Permission.MANAGE_COMPLAINTS), async (req: AuthRequest, res) => {
  try {
    const data = updateComplaintSchema.parse(req.body);
    const existing = await prisma.complaint.findUnique({ where: { id: req.params.id } });

    if (!existing) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    const updateData: any = { ...data };

    if (data.status === "resolved" && !existing.resolvedAt) {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = req.user!.id;
    }

    if (data.assignedTo && data.assignedTo !== existing.assignedTo) {
      updateData.assignedAt = new Date();
      updateData.assignedBy = req.user!.id;
    }

    const complaint = await prisma.complaint.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await prisma.complaintAuditLog.create({
      data: {
        complaintId: complaint.id,
        action: data.status ? "status_changed" : "updated",
        actor: req.user!.id,
        actorRole: req.user!.role,
        previousValue: existing.status,
        newValue: data.status || undefined,
        details: data,
      },
    });

    res.json(complaint);
  } catch (error) {
    console.error("Error updating complaint:", error);
    res.status(500).json({ error: "Failed to update complaint" });
  }
});

router.post("/complaints/:id/evidence", checkPermission(Permission.MANAGE_COMPLAINTS), async (req: AuthRequest, res) => {
  try {
    const { fileType, fileName, fileUrl, fileSize, mimeType, description } = req.body;

    const evidence = await prisma.complaintEvidence.create({
      data: {
        complaintId: req.params.id,
        fileType,
        fileName,
        fileUrl,
        fileSize,
        mimeType,
        description,
        uploadedBy: req.user!.id,
      },
    });

    await prisma.complaintAuditLog.create({
      data: {
        complaintId: req.params.id,
        action: "evidence_added",
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { fileName, fileType },
      },
    });

    res.status(201).json(evidence);
  } catch (error) {
    console.error("Error adding evidence:", error);
    res.status(500).json({ error: "Failed to add evidence" });
  }
});

router.get("/complaints/:id/audit-logs", checkPermission(Permission.VIEW_COMPLAINTS), async (req: AuthRequest, res) => {
  try {
    const auditLogs = await prisma.complaintAuditLog.findMany({
      where: { complaintId: req.params.id },
      orderBy: { createdAt: "desc" },
    });

    res.json(auditLogs);
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

router.post("/complaints/export", checkPermission(Permission.MANAGE_COMPLAINTS), async (req: AuthRequest, res) => {
  try {
    const { format = "csv", status } = req.body;
    const where: any = {};
    if (status) where.status = status;

    const complaints = await prisma.complaint.findMany({
      where,
      include: {
        customer: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        driver: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (format === "json") {
      res.json(complaints);
    } else {
      const csvData = complaints.map(c => ({
        ticketCode: c.ticketCode,
        category: c.category,
        severity: c.severity,
        status: c.status,
        subject: c.subject,
        customerName: c.customer?.user?.firstName ? `${c.customer.user.firstName} ${c.customer.user.lastName}` : "N/A",
        driverName: c.driver?.user?.firstName ? `${c.driver.user.firstName} ${c.driver.user.lastName}` : "N/A",
        createdAt: c.createdAt,
        resolvedAt: c.resolvedAt || "N/A",
      }));
      res.json({ format: "csv", data: csvData });
    }
  } catch (error) {
    console.error("Error exporting complaints:", error);
    res.status(500).json({ error: "Failed to export complaints" });
  }
});

// ========================================
// 2. REFUND & ADJUSTMENT CENTER
// ========================================

router.get("/refunds/eligible", checkPermission(Permission.MANAGE_BILLING), async (req: AuthRequest, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [rides, foodOrders, deliveries] = await Promise.all([
      prisma.ride.findMany({
        where: {
          completedAt: { gte: sevenDaysAgo },
          status: "completed",
        },
        include: {
          customer: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
          driver: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { completedAt: "desc" },
        take: 100,
      }),
      prisma.foodOrder.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
          status: "completed",
        },
        include: {
          customer: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
          driver: { include: { user: { select: { firstName: true, lastName: true } } } },
          restaurant: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.delivery.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
          status: "completed",
        },
        include: {
          customer: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
          driver: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    res.json({
      rides: rides.map(r => ({
        id: r.id,
        type: "ride",
        fare: r.serviceFare,
        commission: r.safegoCommission,
        driverPayout: r.driverPayout,
        taxes: r.totalTaxAmount,
        customer: r.customer,
        driver: r.driver,
        status: r.status,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      })),
      foodOrders: foodOrders.map(f => ({
        id: f.id,
        type: "food",
        total: f.totalAmount,
        customer: f.customer,
        driver: f.driver,
        restaurant: f.restaurant,
        status: f.status,
        createdAt: f.createdAt,
      })),
      deliveries: deliveries.map(d => ({
        id: d.id,
        type: "parcel",
        fare: d.serviceFare,
        commission: d.safegoCommission,
        driverPayout: d.driverPayout,
        taxes: d.totalTaxAmount,
        customer: d.customer,
        driver: d.driver,
        status: d.status,
        createdAt: d.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching refund-eligible items:", error);
    res.status(500).json({ error: "Failed to fetch refund-eligible items" });
  }
});

router.get("/refunds/decisions", checkPermission(Permission.MANAGE_BILLING), async (req: AuthRequest, res) => {
  try {
    const { status, orderType, page = "1", limit = "20" } = req.query;
    const where: any = {};

    if (status) where.processingStatus = status;
    if (orderType) where.orderType = orderType;

    const [decisions, total] = await Promise.all([
      prisma.refundDecision.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
      }),
      prisma.refundDecision.count({ where }),
    ]);

    res.json({
      decisions,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error("Error fetching refund decisions:", error);
    res.status(500).json({ error: "Failed to fetch refund decisions" });
  }
});

const processRefundSchema = z.object({
  orderType: z.string(),
  orderId: z.string(),
  refundType: z.enum(["full", "partial", "credit"]),
  amount: z.number().positive(),
  reason: z.string(),
  notes: z.string().optional(),
});

router.post("/refunds/process", checkPermission(Permission.MANAGE_BILLING), async (req: AuthRequest, res) => {
  try {
    const data = processRefundSchema.parse(req.body);

    const decision = await prisma.refundDecision.create({
      data: {
        orderType: data.orderType,
        orderId: data.orderId,
        issueType: data.reason,
        issueDescription: data.notes,
        originalAmount: 0,
        recommendedRefund: data.amount,
        actualRefund: data.amount,
        decisionType: data.refundType === "full" ? "full_refund" : data.refundType === "partial" ? "partial_refund" : "credit_only",
        autoApproved: false,
        adminReviewedBy: req.user!.id,
        adminReviewedAt: new Date(),
        adminDecision: "approved",
        adminNotes: data.notes,
        processingStatus: "processing",
      },
    });

    res.status(201).json(decision);
  } catch (error) {
    console.error("Error processing refund:", error);
    res.status(500).json({ error: "Failed to process refund" });
  }
});

router.get("/refunds/fraud-patterns", checkPermission(Permission.MANAGE_BILLING), async (req: AuthRequest, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const refundsByCustomer = await prisma.refundDecision.groupBy({
      by: ["orderId"],
      _count: { id: true },
      where: {
        createdAt: { gte: thirtyDaysAgo },
        processingStatus: "completed",
      },
    });

    const abnormalPatterns = refundsByCustomer.filter(r => r._count.id > 3);

    res.json({
      totalRefundsLast30Days: refundsByCustomer.length,
      abnormalPatterns: abnormalPatterns.length,
      patterns: abnormalPatterns,
    });
  } catch (error) {
    console.error("Error fetching fraud patterns:", error);
    res.status(500).json({ error: "Failed to fetch fraud patterns" });
  }
});

// ========================================
// 3. LEGAL REQUESTS DASHBOARD
// ========================================

router.get("/legal-requests", checkPermission(Permission.VIEW_LEGAL_REQUESTS), async (req: AuthRequest, res) => {
  try {
    const { country, status, page = "1", limit = "20" } = req.query;
    const where: any = {};

    if (country) where.country = country;
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      prisma.legalRequest.findMany({
        where,
        include: { auditLogs: { take: 5, orderBy: { createdAt: "desc" } } },
        orderBy: { createdAt: "desc" },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
      }),
      prisma.legalRequest.count({ where }),
    ]);

    res.json({
      requests,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error("Error fetching legal requests:", error);
    res.status(500).json({ error: "Failed to fetch legal requests" });
  }
});

router.get("/legal-requests/:id", checkPermission(Permission.VIEW_LEGAL_REQUESTS), async (req: AuthRequest, res) => {
  try {
    const request = await prisma.legalRequest.findUnique({
      where: { id: req.params.id },
      include: { auditLogs: { orderBy: { createdAt: "desc" } } },
    });

    if (!request) {
      return res.status(404).json({ error: "Legal request not found" });
    }

    res.json(request);
  } catch (error) {
    console.error("Error fetching legal request:", error);
    res.status(500).json({ error: "Failed to fetch legal request" });
  }
});

const createLegalRequestSchema = z.object({
  country: z.enum(["USA", "BD"]),
  requestType: z.string(),
  subpoenaId: z.string().optional(),
  caseId: z.string().optional(),
  agencyName: z.string().optional(),
  gdNumber: z.string().optional(),
  policeStation: z.string().optional(),
  ioName: z.string().optional(),
  requestingOfficer: z.string(),
  requestingAgency: z.string(),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  description: z.string(),
  targetUserId: z.string().optional(),
  targetDriverId: z.string().optional(),
  dateRangeStart: z.string().optional(),
  dateRangeEnd: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

router.post("/legal-requests", checkPermission(Permission.MANAGE_LEGAL_REQUESTS), async (req: AuthRequest, res) => {
  try {
    const data = createLegalRequestSchema.parse(req.body);
    const requestCode = `SG-LEG-${new Date().getFullYear()}-${String(await prisma.legalRequest.count() + 1).padStart(6, "0")}`;

    const request = await prisma.legalRequest.create({
      data: {
        requestCode,
        ...data,
        dateRangeStart: data.dateRangeStart ? new Date(data.dateRangeStart) : undefined,
        dateRangeEnd: data.dateRangeEnd ? new Date(data.dateRangeEnd) : undefined,
        attachments: data.attachments || [],
        requestExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.legalRequestAuditLog.create({
      data: {
        legalRequestId: request.id,
        action: "created",
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { requestType: data.requestType, country: data.country },
        ipAddress: req.ip,
        hashChainId: crypto.randomUUID(),
      },
    });

    res.status(201).json(request);
  } catch (error) {
    console.error("Error creating legal request:", error);
    res.status(500).json({ error: "Failed to create legal request" });
  }
});

const updateLegalRequestSchema = z.object({
  status: z.enum(["received", "verification", "processing", "delivered", "archived", "expired", "rejected"]).optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
  evidencePackage: z.string().optional(),
  deliveryMethod: z.string().optional(),
});

router.patch("/legal-requests/:id", checkPermission(Permission.MANAGE_LEGAL_REQUESTS), async (req: AuthRequest, res) => {
  try {
    const data = updateLegalRequestSchema.parse(req.body);
    const existing = await prisma.legalRequest.findUnique({ where: { id: req.params.id } });

    if (!existing) {
      return res.status(404).json({ error: "Legal request not found" });
    }

    const updateData: any = { ...data };

    if (data.status === "delivered" && !existing.deliveredAt) {
      updateData.deliveredAt = new Date();
      updateData.processedBy = req.user!.id;
      updateData.processedAt = new Date();
    }

    if (data.assignedTo && data.assignedTo !== existing.assignedTo) {
      updateData.assignedAt = new Date();
    }

    if (data.evidencePackage) {
      updateData.evidenceExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const request = await prisma.legalRequest.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await prisma.legalRequestAuditLog.create({
      data: {
        legalRequestId: request.id,
        action: data.status ? "status_changed" : "updated",
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: data,
        ipAddress: req.ip,
        hashChainId: crypto.randomUUID(),
      },
    });

    res.json(request);
  } catch (error) {
    console.error("Error updating legal request:", error);
    res.status(500).json({ error: "Failed to update legal request" });
  }
});

router.get("/legal-requests/:id/evidence-download", checkPermission(Permission.MANAGE_LEGAL_REQUESTS), async (req: AuthRequest, res) => {
  try {
    const request = await prisma.legalRequest.findUnique({ where: { id: req.params.id } });

    if (!request) {
      return res.status(404).json({ error: "Legal request not found" });
    }

    if (!request.evidencePackage) {
      return res.status(404).json({ error: "Evidence package not available" });
    }

    if (request.evidenceExpiresAt && new Date() > request.evidenceExpiresAt) {
      return res.status(410).json({ error: "Evidence package has expired" });
    }

    await prisma.legalRequest.update({
      where: { id: req.params.id },
      data: { evidenceDownloads: { increment: 1 } },
    });

    await prisma.legalRequestAuditLog.create({
      data: {
        legalRequestId: request.id,
        action: "evidence_downloaded",
        actor: req.user!.id,
        actorRole: req.user!.role,
        ipAddress: req.ip,
        hashChainId: crypto.randomUUID(),
      },
    });

    res.json({ downloadUrl: request.evidencePackage, expiresAt: request.evidenceExpiresAt });
  } catch (error) {
    console.error("Error downloading evidence:", error);
    res.status(500).json({ error: "Failed to download evidence" });
  }
});

// ========================================
// 4. ADMIN COMMUNICATION HUB
// ========================================

router.get("/announcements", checkPermission(Permission.VIEW_ANNOUNCEMENTS), async (req: AuthRequest, res) => {
  try {
    const { status, targetGroup, page = "1", limit = "20" } = req.query;
    const where: any = {};

    if (status) where.status = status;
    if (targetGroup) where.targetGroup = targetGroup;

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
      }),
      prisma.announcement.count({ where }),
    ]);

    res.json({
      announcements,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error("Error fetching announcements:", error);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

const createAnnouncementSchema = z.object({
  title: z.string().min(1),
  messageEn: z.string().min(1),
  messageBn: z.string().optional(),
  imageUrl: z.string().optional(),
  targetGroup: z.enum(["all", "customers", "drivers", "restaurants", "admins"]),
  countryCode: z.string().optional(),
  cityCode: z.string().optional(),
  channels: z.array(z.string()),
  scheduledFor: z.string().optional(),
});

router.post("/announcements", checkPermission(Permission.MANAGE_ANNOUNCEMENTS), async (req: AuthRequest, res) => {
  try {
    const data = createAnnouncementSchema.parse(req.body);

    const announcement = await prisma.announcement.create({
      data: {
        ...data,
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
        status: data.scheduledFor ? "scheduled" : "draft",
        createdBy: req.user!.id,
      },
    });

    res.status(201).json(announcement);
  } catch (error) {
    console.error("Error creating announcement:", error);
    res.status(500).json({ error: "Failed to create announcement" });
  }
});

router.patch("/announcements/:id", checkPermission(Permission.MANAGE_ANNOUNCEMENTS), async (req: AuthRequest, res) => {
  try {
    const { status, ...data } = req.body;

    const updateData: any = { ...data, updatedBy: req.user!.id };
    if (status) {
      updateData.status = status;
      if (status === "sent") updateData.sentAt = new Date();
    }

    const announcement = await prisma.announcement.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(announcement);
  } catch (error) {
    console.error("Error updating announcement:", error);
    res.status(500).json({ error: "Failed to update announcement" });
  }
});

router.post("/announcements/:id/send", checkPermission(Permission.MANAGE_ANNOUNCEMENTS), async (req: AuthRequest, res) => {
  try {
    const announcement = await prisma.announcement.findUnique({ where: { id: req.params.id } });

    if (!announcement) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    const recipients = await countRecipients(announcement.targetGroup, announcement.countryCode, announcement.cityCode);

    await prisma.announcement.update({
      where: { id: req.params.id },
      data: {
        status: "sent",
        sentAt: new Date(),
        totalRecipients: recipients,
      },
    });

    res.json({ success: true, totalRecipients: recipients });
  } catch (error) {
    console.error("Error sending announcement:", error);
    res.status(500).json({ error: "Failed to send announcement" });
  }
});

async function countRecipients(targetGroup: string, countryCode?: string | null, cityCode?: string | null): Promise<number> {
  let count = 0;
  const where: any = {};
  if (cityCode) where.cityCode = cityCode;

  switch (targetGroup) {
    case "customers":
      count = await prisma.customerProfile.count({ where });
      break;
    case "drivers":
      count = await prisma.driverProfile.count({ where });
      break;
    case "restaurants":
      count = await prisma.restaurantProfile.count({ where });
      break;
    case "all":
      const [c, d, r] = await Promise.all([
        prisma.customerProfile.count({ where }),
        prisma.driverProfile.count({ where }),
        prisma.restaurantProfile.count({ where }),
      ]);
      count = c + d + r;
      break;
  }
  return count;
}

// ========================================
// 5. EMAIL TEMPLATE EDITOR
// ========================================

router.get("/email-templates", checkPermission(Permission.MANAGE_TEMPLATES), async (req: AuthRequest, res) => {
  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { templateKey: "asc" },
    });

    res.json(templates);
  } catch (error) {
    console.error("Error fetching email templates:", error);
    res.status(500).json({ error: "Failed to fetch email templates" });
  }
});

router.get("/email-templates/:id", checkPermission(Permission.MANAGE_TEMPLATES), async (req: AuthRequest, res) => {
  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { id: req.params.id },
      include: { versions: { orderBy: { version: "desc" } } },
    });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json(template);
  } catch (error) {
    console.error("Error fetching email template:", error);
    res.status(500).json({ error: "Failed to fetch email template" });
  }
});

const createEmailTemplateSchema = z.object({
  templateKey: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  subjectEn: z.string().min(1),
  subjectBn: z.string().optional(),
  bodyEn: z.string().min(1),
  bodyBn: z.string().optional(),
  variables: z.array(z.string()).optional(),
});

router.post("/email-templates", checkPermission(Permission.MANAGE_TEMPLATES), async (req: AuthRequest, res) => {
  try {
    const data = createEmailTemplateSchema.parse(req.body);

    const template = await prisma.emailTemplate.create({
      data: {
        ...data,
        variables: data.variables || [],
        createdBy: req.user!.id,
      },
    });

    await prisma.emailTemplateVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        subjectEn: data.subjectEn,
        subjectBn: data.subjectBn,
        bodyEn: data.bodyEn,
        bodyBn: data.bodyBn,
        createdBy: req.user!.id,
      },
    });

    res.status(201).json(template);
  } catch (error) {
    console.error("Error creating email template:", error);
    res.status(500).json({ error: "Failed to create email template" });
  }
});

router.patch("/email-templates/:id", checkPermission(Permission.MANAGE_TEMPLATES), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.emailTemplate.findUnique({ where: { id: req.params.id } });

    if (!existing) {
      return res.status(404).json({ error: "Template not found" });
    }

    const { subjectEn, subjectBn, bodyEn, bodyBn, ...rest } = req.body;

    const template = await prisma.emailTemplate.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        subjectEn,
        subjectBn,
        bodyEn,
        bodyBn,
        version: existing.version + 1,
        updatedBy: req.user!.id,
      },
    });

    await prisma.emailTemplateVersion.create({
      data: {
        templateId: template.id,
        version: template.version,
        subjectEn,
        subjectBn,
        bodyEn,
        bodyBn,
        createdBy: req.user!.id,
      },
    });

    res.json(template);
  } catch (error) {
    console.error("Error updating email template:", error);
    res.status(500).json({ error: "Failed to update email template" });
  }
});

router.post("/email-templates/:id/test-send", checkPermission(Permission.MANAGE_TEMPLATES), async (req: AuthRequest, res) => {
  try {
    const { email, variables } = req.body;
    const template = await prisma.emailTemplate.findUnique({ where: { id: req.params.id } });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json({ success: true, message: `Test email would be sent to ${email}` });
  } catch (error) {
    console.error("Error sending test email:", error);
    res.status(500).json({ error: "Failed to send test email" });
  }
});

// ========================================
// 6. SMS TEMPLATE & AUTOMATION ENGINE
// ========================================

router.get("/sms-templates", checkPermission(Permission.MANAGE_TEMPLATES), async (req: AuthRequest, res) => {
  try {
    const templates = await prisma.smsTemplate.findMany({
      orderBy: { templateKey: "asc" },
    });

    res.json(templates);
  } catch (error) {
    console.error("Error fetching SMS templates:", error);
    res.status(500).json({ error: "Failed to fetch SMS templates" });
  }
});

router.get("/sms-templates/:id", checkPermission(Permission.MANAGE_TEMPLATES), async (req: AuthRequest, res) => {
  try {
    const template = await prisma.smsTemplate.findUnique({
      where: { id: req.params.id },
      include: { deliveryLogs: { take: 50, orderBy: { sentAt: "desc" } } },
    });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json(template);
  } catch (error) {
    console.error("Error fetching SMS template:", error);
    res.status(500).json({ error: "Failed to fetch SMS template" });
  }
});

const createSmsTemplateSchema = z.object({
  templateKey: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  messageEn: z.string().min(1),
  messageBn: z.string().optional(),
  variables: z.array(z.string()).optional(),
  usaTwilioEnabled: z.boolean().optional(),
  bdRouting: z.string().optional(),
});

router.post("/sms-templates", checkPermission(Permission.MANAGE_TEMPLATES), async (req: AuthRequest, res) => {
  try {
    const data = createSmsTemplateSchema.parse(req.body);

    const template = await prisma.smsTemplate.create({
      data: {
        ...data,
        variables: data.variables || [],
        createdBy: req.user!.id,
      },
    });

    res.status(201).json(template);
  } catch (error) {
    console.error("Error creating SMS template:", error);
    res.status(500).json({ error: "Failed to create SMS template" });
  }
});

router.patch("/sms-templates/:id", checkPermission(Permission.MANAGE_TEMPLATES), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.smsTemplate.findUnique({ where: { id: req.params.id } });

    if (!existing) {
      return res.status(404).json({ error: "Template not found" });
    }

    const template = await prisma.smsTemplate.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        version: existing.version + 1,
        updatedBy: req.user!.id,
      },
    });

    res.json(template);
  } catch (error) {
    console.error("Error updating SMS template:", error);
    res.status(500).json({ error: "Failed to update SMS template" });
  }
});

router.get("/sms-templates/:id/delivery-logs", checkPermission(Permission.MANAGE_TEMPLATES), async (req: AuthRequest, res) => {
  try {
    const { status, page = "1", limit = "50" } = req.query;
    const where: any = { templateId: req.params.id };

    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      prisma.smsDeliveryLog.findMany({
        where,
        orderBy: { sentAt: "desc" },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
      }),
      prisma.smsDeliveryLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error("Error fetching delivery logs:", error);
    res.status(500).json({ error: "Failed to fetch delivery logs" });
  }
});

// ========================================
// 7. INTERNAL ADMIN CHAT SYSTEM
// ========================================

router.get("/chat/channels", async (req: AuthRequest, res) => {
  try {
    const channels = await prisma.adminChatChannel.findMany({
      include: {
        members: { where: { adminId: req.user!.id } },
        messages: { take: 1, orderBy: { createdAt: "desc" } },
        _count: { select: { members: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const accessibleChannels = channels.filter(c => !c.isPrivate || c.members.length > 0);

    res.json(accessibleChannels);
  } catch (error) {
    console.error("Error fetching chat channels:", error);
    res.status(500).json({ error: "Failed to fetch chat channels" });
  }
});

router.get("/chat/channels/:id", async (req: AuthRequest, res) => {
  try {
    const channel = await prisma.adminChatChannel.findUnique({
      where: { id: req.params.id },
      include: {
        members: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 100,
          include: { reads: true },
        },
      },
    });

    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    res.json(channel);
  } catch (error) {
    console.error("Error fetching channel:", error);
    res.status(500).json({ error: "Failed to fetch channel" });
  }
});

const createChannelSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["department", "private", "announcement"]).optional(),
  department: z.string().optional(),
  isPrivate: z.boolean().optional(),
  memberIds: z.array(z.string()).optional(),
});

router.post("/chat/channels", async (req: AuthRequest, res) => {
  try {
    const data = createChannelSchema.parse(req.body);

    const channel = await prisma.adminChatChannel.create({
      data: {
        ...data,
        createdBy: req.user!.id,
        members: {
          create: [
            { adminId: req.user!.id, role: "owner" },
            ...(data.memberIds?.map(id => ({ adminId: id })) || []),
          ],
        },
      },
      include: { members: true },
    });

    res.status(201).json(channel);
  } catch (error) {
    console.error("Error creating channel:", error);
    res.status(500).json({ error: "Failed to create channel" });
  }
});

router.post("/chat/channels/:id/messages", async (req: AuthRequest, res) => {
  try {
    const { content, attachments, mentions, replyToId } = req.body;

    const message = await prisma.adminChatMessage.create({
      data: {
        channelId: req.params.id,
        senderId: req.user!.id,
        content,
        attachments: attachments || [],
        mentions: mentions || [],
        replyToId,
      },
      include: { reads: true },
    });

    await prisma.adminChatChannel.update({
      where: { id: req.params.id },
      data: { updatedAt: new Date() },
    });

    res.status(201).json(message);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.post("/chat/messages/:id/read", async (req: AuthRequest, res) => {
  try {
    await prisma.adminChatReadReceipt.upsert({
      where: {
        messageId_adminId: {
          messageId: req.params.id,
          adminId: req.user!.id,
        },
      },
      update: { readAt: new Date() },
      create: {
        messageId: req.params.id,
        adminId: req.user!.id,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking message read:", error);
    res.status(500).json({ error: "Failed to mark message read" });
  }
});

// ========================================
// 8. SAFETY INCIDENT REPLAY TOOL
// ========================================

router.get("/safety-incidents", checkPermission(Permission.VIEW_SAFETY_INCIDENTS), async (req: AuthRequest, res) => {
  try {
    const { severity, status, page = "1", limit = "20" } = req.query;
    const where: any = {};

    if (severity) where.severity = severity;
    if (status) where.status = status;

    const [incidents, total] = await Promise.all([
      prisma.safetyIncident.findMany({
        where,
        include: {
          ride: { select: { pickupAddress: true, dropoffAddress: true, status: true } },
          driver: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
      }),
      prisma.safetyIncident.count({ where }),
    ]);

    res.json({
      incidents,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error("Error fetching safety incidents:", error);
    res.status(500).json({ error: "Failed to fetch safety incidents" });
  }
});

router.get("/safety-incidents/:id", checkPermission(Permission.VIEW_SAFETY_INCIDENTS), async (req: AuthRequest, res) => {
  try {
    const incident = await prisma.safetyIncident.findUnique({
      where: { id: req.params.id },
      include: {
        ride: {
          include: {
            customer: { include: { user: { select: { firstName: true, lastName: true } } } },
            telemetryLocations: { orderBy: { timestamp: "asc" } },
            liveLocations: { orderBy: { timestamp: "asc" } },
          },
        },
        driver: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
      },
    });

    if (!incident) {
      return res.status(404).json({ error: "Safety incident not found" });
    }

    res.json(incident);
  } catch (error) {
    console.error("Error fetching safety incident:", error);
    res.status(500).json({ error: "Failed to fetch safety incident" });
  }
});

router.patch("/safety-incidents/:id", checkPermission(Permission.MANAGE_SAFETY_INCIDENTS), async (req: AuthRequest, res) => {
  try {
    const { status, resolution, adminNotes } = req.body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (resolution) updateData.resolution = resolution;
    if (adminNotes) updateData.adminNotes = adminNotes;

    if (status === "resolved" || status === "escalated") {
      updateData.reviewedBy = req.user!.id;
      updateData.reviewedAt = new Date();
    }

    const incident = await prisma.safetyIncident.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(incident);
  } catch (error) {
    console.error("Error updating safety incident:", error);
    res.status(500).json({ error: "Failed to update safety incident" });
  }
});

router.post("/safety-incidents/:id/export-pdf", checkPermission(Permission.MANAGE_SAFETY_INCIDENTS), async (req: AuthRequest, res) => {
  try {
    const incident = await prisma.safetyIncident.findUnique({
      where: { id: req.params.id },
      include: {
        ride: true,
        driver: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    if (!incident) {
      return res.status(404).json({ error: "Safety incident not found" });
    }

    const pdfUrl = `/reports/safety-incident-${incident.incidentCode}.pdf`;

    await prisma.safetyIncident.update({
      where: { id: req.params.id },
      data: {
        pdfReportUrl: pdfUrl,
        pdfExportedAt: new Date(),
        pdfExportedBy: req.user!.id,
      },
    });

    res.json({ pdfUrl, exportedAt: new Date() });
  } catch (error) {
    console.error("Error exporting PDF:", error);
    res.status(500).json({ error: "Failed to export PDF" });
  }
});

// ========================================
// 9. GEOFENCE MANAGEMENT
// ========================================

router.get("/geofences", checkPermission(Permission.MANAGE_GEOFENCES), async (req: AuthRequest, res) => {
  try {
    const { countryCode, cityCode, ruleType, isActive } = req.query;
    const where: any = {};

    if (countryCode) where.countryCode = countryCode;
    if (cityCode) where.cityCode = cityCode;
    if (ruleType) where.ruleType = ruleType;
    if (isActive !== undefined) where.isActive = isActive === "true";

    const geofences = await prisma.geofence.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json(geofences);
  } catch (error) {
    console.error("Error fetching geofences:", error);
    res.status(500).json({ error: "Failed to fetch geofences" });
  }
});

const createGeofenceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  countryCode: z.string(),
  cityCode: z.string().optional(),
  geoType: z.enum(["polygon", "circle"]),
  geoData: z.object({}).passthrough(),
  ruleType: z.string(),
  restrictions: z.object({}).passthrough().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
});

router.post("/geofences", checkPermission(Permission.MANAGE_GEOFENCES), async (req: AuthRequest, res) => {
  try {
    const data = createGeofenceSchema.parse(req.body);

    const geofence = await prisma.geofence.create({
      data: {
        ...data,
        validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        createdBy: req.user!.id,
      },
    });

    res.status(201).json(geofence);
  } catch (error) {
    console.error("Error creating geofence:", error);
    res.status(500).json({ error: "Failed to create geofence" });
  }
});

router.patch("/geofences/:id", checkPermission(Permission.MANAGE_GEOFENCES), async (req: AuthRequest, res) => {
  try {
    const geofence = await prisma.geofence.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        updatedBy: req.user!.id,
      },
    });

    res.json(geofence);
  } catch (error) {
    console.error("Error updating geofence:", error);
    res.status(500).json({ error: "Failed to update geofence" });
  }
});

router.delete("/geofences/:id", checkPermission(Permission.MANAGE_GEOFENCES), async (req: AuthRequest, res) => {
  try {
    await prisma.geofence.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting geofence:", error);
    res.status(500).json({ error: "Failed to delete geofence" });
  }
});

// ========================================
// 10. DOCUMENT MANAGER
// ========================================

router.get("/documents", checkPermission(Permission.VIEW_DOCUMENTS), async (req: AuthRequest, res) => {
  try {
    const { userType, status, expiringWithin } = req.query;

    let documents: any[] = [];

    if (!userType || userType === "driver") {
      const drivers = await prisma.driverProfile.findMany({
        where: status ? { profilePhotoStatus: status as any } : undefined,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        take: 100,
      });

      documents.push(...drivers.map(d => ({
        id: d.id,
        userType: "driver",
        userName: `${d.firstName || d.user.firstName} ${d.lastName || d.user.lastName}`,
        email: d.user.email,
        documents: [
          { type: "profile_photo", status: d.profilePhotoStatus, url: d.profilePhotoUrl, rejectionReason: d.profilePhotoRejectionReason },
          { type: "driver_license", status: d.driverLicenseStatus, url: d.driverLicenseImageUrl, expiry: d.driverLicenseExpiry, rejectionReason: d.driverLicenseRejectionReason },
          { type: "tlc_license", status: d.tlcLicenseDocStatus, url: d.tlcLicenseImageUrl, expiry: d.tlcLicenseExpiry, rejectionReason: d.tlcLicenseRejectionReason },
          { type: "nid", status: d.nidStatus, url: d.nidFrontImageUrl, rejectionReason: d.nidRejectionReason },
        ],
      })));
    }

    if (!userType || userType === "customer") {
      const customers = await prisma.customerProfile.findMany({
        where: status ? { verificationStatus: status as string } : undefined,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        take: 100,
      });

      documents.push(...customers.map(c => ({
        id: c.id,
        userType: "customer",
        userName: `${c.firstName || c.user.firstName} ${c.lastName || c.user.lastName}`,
        email: c.user.email,
        documents: [
          { type: "nid", status: c.verificationStatus, url: c.nidFrontImageUrl },
        ],
      })));
    }

    res.json(documents);
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

router.patch("/documents/driver/:id/:docType", checkPermission(Permission.MANAGE_DOCUMENTS), async (req: AuthRequest, res) => {
  try {
    const { id, docType } = req.params;
    const { status, rejectionReason } = req.body;

    const updateData: any = {};

    switch (docType) {
      case "profile_photo":
        updateData.profilePhotoStatus = status;
        if (rejectionReason) updateData.profilePhotoRejectionReason = rejectionReason;
        break;
      case "driver_license":
        updateData.driverLicenseStatus = status;
        if (rejectionReason) updateData.driverLicenseRejectionReason = rejectionReason;
        break;
      case "tlc_license":
        updateData.tlcLicenseDocStatus = status;
        if (rejectionReason) updateData.tlcLicenseRejectionReason = rejectionReason;
        break;
      case "nid":
        updateData.nidStatus = status;
        if (rejectionReason) updateData.nidRejectionReason = rejectionReason;
        break;
    }

    const driver = await prisma.driverProfile.update({
      where: { id },
      data: updateData,
    });

    res.json(driver);
  } catch (error) {
    console.error("Error updating document status:", error);
    res.status(500).json({ error: "Failed to update document status" });
  }
});

router.post("/documents/bulk-approve", checkPermission(Permission.MANAGE_DOCUMENTS), async (req: AuthRequest, res) => {
  try {
    const { documentIds, docType, userType } = req.body;

    if (userType === "driver") {
      const updateField = docType === "profile_photo" ? "profilePhotoStatus" :
                          docType === "driver_license" ? "driverLicenseStatus" :
                          docType === "tlc_license" ? "tlcLicenseDocStatus" : "nidStatus";

      await prisma.driverProfile.updateMany({
        where: { id: { in: documentIds } },
        data: { [updateField]: "APPROVED" },
      });
    }

    res.json({ success: true, count: documentIds.length });
  } catch (error) {
    console.error("Error bulk approving documents:", error);
    res.status(500).json({ error: "Failed to bulk approve documents" });
  }
});

router.get("/documents/expiring", checkPermission(Permission.VIEW_DOCUMENTS), async (req: AuthRequest, res) => {
  try {
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const expiringDrivers = await prisma.driverProfile.findMany({
      where: {
        OR: [
          { driverLicenseExpiry: { lte: thirtyDaysFromNow } },
          { tlcLicenseExpiry: { lte: thirtyDaysFromNow } },
        ],
      },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });

    const expiringDocuments = expiringDrivers.flatMap(d => {
      const docs = [];
      if (d.driverLicenseExpiry && d.driverLicenseExpiry <= thirtyDaysFromNow) {
        docs.push({
          driverId: d.id,
          driverName: `${d.firstName || d.user.firstName} ${d.lastName || d.user.lastName}`,
          email: d.user.email,
          docType: "driver_license",
          expiryDate: d.driverLicenseExpiry,
          daysUntilExpiry: Math.ceil((d.driverLicenseExpiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
        });
      }
      if (d.tlcLicenseExpiry && d.tlcLicenseExpiry <= thirtyDaysFromNow) {
        docs.push({
          driverId: d.id,
          driverName: `${d.firstName || d.user.firstName} ${d.lastName || d.user.lastName}`,
          email: d.user.email,
          docType: "tlc_license",
          expiryDate: d.tlcLicenseExpiry,
          daysUntilExpiry: Math.ceil((d.tlcLicenseExpiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
        });
      }
      return docs;
    });

    res.json(expiringDocuments);
  } catch (error) {
    console.error("Error fetching expiring documents:", error);
    res.status(500).json({ error: "Failed to fetch expiring documents" });
  }
});

// ========================================
// 11. DRIVER VIOLATION MANAGEMENT
// ========================================

router.get("/violations", checkPermission(Permission.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { status, severity, page = "1", limit = "20" } = req.query;
    
    const violations = [
      {
        id: "viol-001",
        violationCode: "SG-VIO-2024-000001",
        driverId: "drv-001",
        driverName: "John Driver",
        driverPhone: "+1234567890",
        type: "speed_violation",
        severity: "high",
        status: "pending_review",
        incidentDate: new Date(),
        description: "Driver exceeded speed limit by 20mph in school zone",
        points: 3,
        penalty: "warning",
        appealStatus: null,
        createdAt: new Date(),
      },
      {
        id: "viol-002",
        violationCode: "SG-VIO-2024-000002",
        driverId: "drv-002",
        driverName: "Jane Driver",
        driverPhone: "+1234567891",
        type: "harassment_complaint",
        severity: "critical",
        status: "escalated",
        incidentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        description: "Multiple customer complaints about inappropriate behavior",
        points: 10,
        penalty: "suspension",
        appealStatus: "pending",
        createdAt: new Date(),
      },
    ];

    res.json({
      violations: violations.filter(v => 
        (!status || v.status === status) && 
        (!severity || v.severity === severity)
      ),
      pagination: { total: violations.length, page: parseInt(page as string), limit: parseInt(limit as string), totalPages: 1 },
    });
  } catch (error) {
    console.error("Error fetching violations:", error);
    res.status(500).json({ error: "Failed to fetch violations" });
  }
});

router.patch("/violations/:id", checkPermission(Permission.MANAGE_DRIVERS), async (req: AuthRequest, res) => {
  try {
    const { status, penalty, notes, appealDecision } = req.body;
    
    res.json({
      id: req.params.id,
      status: status || "reviewed",
      penalty,
      notes,
      appealDecision,
      reviewedBy: req.user!.id,
      reviewedAt: new Date(),
    });
  } catch (error) {
    console.error("Error updating violation:", error);
    res.status(500).json({ error: "Failed to update violation" });
  }
});

// ========================================
// 12. CUSTOMER TRUST & SAFETY REVIEW BOARD
// ========================================

router.get("/trust-safety/cases", checkPermission(Permission.MANAGE_SAFETY), async (req: AuthRequest, res) => {
  try {
    const cases = [
      {
        id: "case-001",
        caseCode: "SG-TSR-2024-000001",
        type: "safety_incident",
        priority: "critical",
        status: "pending_committee",
        summary: "Customer reported feeling unsafe during night ride",
        customerName: "Alice Customer",
        driverName: "Bob Driver",
        incidentDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        evidenceCount: 5,
        createdAt: new Date(),
        committeeDecision: null,
        decisionDate: null,
      },
      {
        id: "case-002",
        caseCode: "SG-TSR-2024-000002",
        type: "fraud_investigation",
        priority: "high",
        status: "under_review",
        summary: "Suspected fare manipulation scheme",
        customerName: "Charlie Customer",
        driverName: "David Driver",
        incidentDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        evidenceCount: 12,
        createdAt: new Date(),
        committeeDecision: null,
        decisionDate: null,
      },
    ];

    res.json({ cases });
  } catch (error) {
    console.error("Error fetching trust & safety cases:", error);
    res.status(500).json({ error: "Failed to fetch cases" });
  }
});

router.post("/trust-safety/cases/:id/decision", checkPermission(Permission.MANAGE_SAFETY), async (req: AuthRequest, res) => {
  try {
    const { decision, reasoning, actionsTaken, language } = req.body;
    
    const decisionLetter = language === "bn" 
      ? `সিদ্ধান্ত: ${decision}\nকারণ: ${reasoning}\nপদক্ষেপ: ${actionsTaken.join(", ")}`
      : `Decision: ${decision}\nReasoning: ${reasoning}\nActions: ${actionsTaken.join(", ")}`;

    res.json({
      caseId: req.params.id,
      decision,
      reasoning,
      actionsTaken,
      decisionLetter,
      decidedBy: req.user!.id,
      decidedAt: new Date(),
    });
  } catch (error) {
    console.error("Error recording decision:", error);
    res.status(500).json({ error: "Failed to record decision" });
  }
});

// ========================================
// 13. POLICY ENFORCEMENT ENGINE
// ========================================

router.get("/policies", checkPermission(Permission.MANAGE_POLICIES), async (req: AuthRequest, res) => {
  try {
    const policies = [
      {
        id: "pol-001",
        policyCode: "SG-POL-RIDE-001",
        name: "Ride Cancellation Policy",
        type: "rides",
        version: "2.1",
        status: "active",
        rules: [
          { id: "r1", condition: "cancellation_time < 2min", action: "no_fee", priority: 1 },
          { id: "r2", condition: "cancellation_time >= 2min && cancellation_time < 5min", action: "reduced_fee", priority: 2 },
          { id: "r3", condition: "cancellation_time >= 5min", action: "full_fee", priority: 3 },
        ],
        effectiveFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        effectiveUntil: null,
        createdAt: new Date(),
      },
      {
        id: "pol-002",
        policyCode: "SG-POL-EATS-001",
        name: "Food Order Refund Policy",
        type: "eats",
        version: "1.3",
        status: "active",
        rules: [
          { id: "r1", condition: "order_not_started", action: "full_refund", priority: 1 },
          { id: "r2", condition: "order_preparing", action: "partial_refund", priority: 2 },
          { id: "r3", condition: "order_out_for_delivery", action: "no_refund", priority: 3 },
        ],
        effectiveFrom: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        effectiveUntil: null,
        createdAt: new Date(),
      },
    ];

    res.json({ policies });
  } catch (error) {
    console.error("Error fetching policies:", error);
    res.status(500).json({ error: "Failed to fetch policies" });
  }
});

router.post("/policies", checkPermission(Permission.MANAGE_POLICIES), async (req: AuthRequest, res) => {
  try {
    const { name, type, rules, effectiveFrom } = req.body;
    
    res.status(201).json({
      id: crypto.randomUUID(),
      policyCode: `SG-POL-${type.toUpperCase()}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`,
      name,
      type,
      version: "1.0",
      status: "draft",
      rules,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
      createdBy: req.user!.id,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Error creating policy:", error);
    res.status(500).json({ error: "Failed to create policy" });
  }
});

router.patch("/policies/:id", checkPermission(Permission.MANAGE_POLICIES), async (req: AuthRequest, res) => {
  try {
    const { status, rules, effectiveFrom, effectiveUntil } = req.body;
    
    res.json({
      id: req.params.id,
      status,
      rules,
      effectiveFrom,
      effectiveUntil,
      updatedBy: req.user!.id,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error("Error updating policy:", error);
    res.status(500).json({ error: "Failed to update policy" });
  }
});

// ========================================
// 14. GLOBAL EXPORT CENTER
// ========================================

router.get("/exports", checkPermission(Permission.VIEW_EXPORTS), async (req: AuthRequest, res) => {
  try {
    const exports = [
      {
        id: "exp-001",
        type: "complaints",
        format: "csv",
        status: "completed",
        recordCount: 1250,
        fileSize: "2.4 MB",
        checksum: "sha256:abc123def456...",
        requestedBy: "admin@safego.com",
        requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
        downloadUrl: "/exports/complaints-2024-12-05.csv",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        id: "exp-002",
        type: "refunds",
        format: "json",
        status: "processing",
        recordCount: 0,
        fileSize: null,
        checksum: null,
        requestedBy: "finance@safego.com",
        requestedAt: new Date(Date.now() - 30 * 60 * 1000),
        completedAt: null,
        downloadUrl: null,
        expiresAt: null,
      },
    ];

    res.json({ exports });
  } catch (error) {
    console.error("Error fetching exports:", error);
    res.status(500).json({ error: "Failed to fetch exports" });
  }
});

router.post("/exports", checkPermission(Permission.MANAGE_EXPORTS), async (req: AuthRequest, res) => {
  try {
    const { type, format, dateFrom, dateTo, filters } = req.body;
    
    const exportId = crypto.randomUUID();
    const checksum = crypto.createHash("sha256").update(exportId + Date.now()).digest("hex");

    res.status(201).json({
      id: exportId,
      type,
      format,
      status: "queued",
      filters,
      dateRange: { from: dateFrom, to: dateTo },
      checksum: `sha256:${checksum.slice(0, 32)}`,
      requestedBy: req.user!.id,
      requestedAt: new Date(),
      estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000),
    });
  } catch (error) {
    console.error("Error creating export:", error);
    res.status(500).json({ error: "Failed to create export" });
  }
});

router.get("/exports/:id/download", checkPermission(Permission.VIEW_EXPORTS), async (req: AuthRequest, res) => {
  try {
    res.json({
      downloadUrl: `/exports/${req.params.id}/file`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      checksum: "sha256:" + crypto.createHash("sha256").update(req.params.id).digest("hex").slice(0, 32),
    });
  } catch (error) {
    console.error("Error getting download URL:", error);
    res.status(500).json({ error: "Failed to get download URL" });
  }
});

// ========================================
// 15. ADMIN ACTIVITY MONITOR (REAL-TIME)
// ========================================

router.get("/activity-monitor", checkPermission(Permission.VIEW_ADMIN_ACTIVITY), async (req: AuthRequest, res) => {
  try {
    const activities = [
      {
        id: "act-001",
        adminId: "adm-001",
        adminName: "John Admin",
        adminRole: "super_admin",
        action: "complaint_resolved",
        target: "SG-CMP-2024-000125",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0 Chrome/120.0",
        geoLocation: { country: "US", city: "New York", lat: 40.7128, lng: -74.0060 },
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        riskScore: 0.1,
        anomalyFlags: [],
      },
      {
        id: "act-002",
        adminId: "adm-002",
        adminName: "Jane Admin",
        adminRole: "country_admin",
        action: "bulk_refund_approved",
        target: "15 refunds totaling $2,450",
        ipAddress: "10.0.0.55",
        userAgent: "Mozilla/5.0 Firefox/121.0",
        geoLocation: { country: "BD", city: "Dhaka", lat: 23.8103, lng: 90.4125 },
        timestamp: new Date(Date.now() - 12 * 60 * 1000),
        riskScore: 0.7,
        anomalyFlags: ["unusual_volume", "new_ip_address"],
      },
      {
        id: "act-003",
        adminId: "adm-003",
        adminName: "Bob Supervisor",
        adminRole: "support_supervisor",
        action: "driver_suspended",
        target: "DRV-2024-000892",
        ipAddress: "172.16.0.25",
        userAgent: "Mozilla/5.0 Safari/17.2",
        geoLocation: { country: "US", city: "Los Angeles", lat: 34.0522, lng: -118.2437 },
        timestamp: new Date(Date.now() - 25 * 60 * 1000),
        riskScore: 0.3,
        anomalyFlags: [],
      },
    ];

    res.json({
      activities,
      summary: {
        totalActions24h: 156,
        uniqueAdmins: 12,
        highRiskActions: 3,
        anomaliesDetected: 2,
      },
    });
  } catch (error) {
    console.error("Error fetching activity monitor:", error);
    res.status(500).json({ error: "Failed to fetch activity monitor" });
  }
});

router.post("/activity-monitor/alert", checkPermission(Permission.MANAGE_ADMIN_ACTIVITY), async (req: AuthRequest, res) => {
  try {
    const { activityId, alertType, notes } = req.body;
    
    res.status(201).json({
      alertId: crypto.randomUUID(),
      activityId,
      alertType,
      notes,
      createdBy: req.user!.id,
      createdAt: new Date(),
      status: "sent",
    });
  } catch (error) {
    console.error("Error creating alert:", error);
    res.status(500).json({ error: "Failed to create alert" });
  }
});

export default router;
