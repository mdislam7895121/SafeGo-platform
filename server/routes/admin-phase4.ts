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

export default router;
