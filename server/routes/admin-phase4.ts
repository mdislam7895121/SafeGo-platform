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

// ========================================
// 16. RATINGS & REVIEW CENTER
// ========================================

const ratingsFilterSchema = z.object({
  type: z.enum(["driver", "restaurant", "all"]).default("all"),
  rating: z.coerce.number().min(1).max(5).optional(),
  severity: z.enum(["all", "flagged", "suspicious", "verified"]).default("all"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

router.get("/ratings", checkPermission(Permission.VIEW_REPORTS), async (req: AuthRequest, res) => {
  try {
    const filters = ratingsFilterSchema.parse(req.query);
    
    // Fetch driver ratings from rides
    const driverRatingsWhere: any = {
      customerRating: { not: null },
    };
    if (filters.rating) driverRatingsWhere.customerRating = filters.rating;
    if (filters.dateFrom || filters.dateTo) {
      driverRatingsWhere.createdAt = {};
      if (filters.dateFrom) driverRatingsWhere.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) driverRatingsWhere.createdAt.lte = new Date(filters.dateTo);
    }

    // Fetch restaurant reviews
    const reviewsWhere: any = {};
    if (filters.rating) reviewsWhere.rating = filters.rating;
    if (filters.severity === "flagged") reviewsWhere.isFlagged = true;
    if (filters.dateFrom || filters.dateTo) {
      reviewsWhere.createdAt = {};
      if (filters.dateFrom) reviewsWhere.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) reviewsWhere.createdAt.lte = new Date(filters.dateTo);
    }

    const [driverRatings, restaurantReviews, driverRatingDist, restaurantRatingDist] = await Promise.all([
      filters.type === "restaurant" ? Promise.resolve([]) : prisma.ride.findMany({
        where: driverRatingsWhere,
        select: {
          id: true,
          customerId: true,
          driverId: true,
          customerRating: true,
          customerFeedback: true,
          createdAt: true,
          customer: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
          driver: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: filters.type === "all" ? 10 : filters.limit,
        skip: filters.type === "driver" ? (filters.page - 1) * filters.limit : 0,
      }),
      filters.type === "driver" ? Promise.resolve([]) : prisma.review.findMany({
        where: reviewsWhere,
        include: {
          customer: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
          restaurant: { select: { businessName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: filters.type === "all" ? 10 : filters.limit,
        skip: filters.type === "restaurant" ? (filters.page - 1) * filters.limit : 0,
      }),
      // Driver rating distribution
      prisma.ride.groupBy({
        by: ["customerRating"],
        where: { customerRating: { not: null } },
        _count: { customerRating: true },
      }),
      // Restaurant rating distribution
      prisma.review.groupBy({
        by: ["rating"],
        _count: { rating: true },
      }),
    ]);

    // Format driver ratings
    const formattedDriverRatings = driverRatings.map((r: any) => ({
      id: r.id,
      type: "driver" as const,
      ratingType: "ride",
      entityId: r.driverId,
      entityName: r.driver ? `${r.driver.user?.firstName || ""} ${r.driver.user?.lastName || ""}`.trim() || "Unknown Driver" : "Unknown Driver",
      raterId: r.customerId,
      raterName: r.customer ? `${r.customer.user?.firstName || ""} ${r.customer.user?.lastName || ""}`.trim() || "Unknown Customer" : "Unknown Customer",
      rating: r.customerRating,
      feedback: r.customerFeedback,
      createdAt: r.createdAt,
      isFlagged: false,
      flagReason: null,
      severity: r.customerRating && r.customerRating <= 2 ? "low_rating" : "normal",
    }));

    // Format restaurant reviews
    const formattedRestaurantReviews = restaurantReviews.map((r: any) => ({
      id: r.id,
      type: "restaurant" as const,
      ratingType: "food_order",
      entityId: r.restaurantId,
      entityName: r.restaurant?.businessName || "Unknown Restaurant",
      raterId: r.customerId,
      raterName: r.customer ? `${r.customer.user?.firstName || ""} ${r.customer.user?.lastName || ""}`.trim() || "Unknown Customer" : "Unknown Customer",
      rating: r.rating,
      feedback: r.reviewText,
      createdAt: r.createdAt,
      isFlagged: r.isFlagged,
      flagReason: r.flagReason,
      isHidden: r.isHidden,
      hideReason: r.hideReason,
      severity: r.isFlagged ? "flagged" : r.rating <= 2 ? "low_rating" : "normal",
    }));

    // Combine and sort
    const allRatings = [...formattedDriverRatings, ...formattedRestaurantReviews]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Build distribution data
    const distribution = {
      driver: [1, 2, 3, 4, 5].map(rating => ({
        rating,
        count: (driverRatingDist as any[]).find((d: any) => d.customerRating === rating)?._count?.customerRating || 0,
      })),
      restaurant: [1, 2, 3, 4, 5].map(rating => ({
        rating,
        count: (restaurantRatingDist as any[]).find((d: any) => d.rating === rating)?._count?.rating || 0,
      })),
    };

    // Calculate totals
    const driverTotal = distribution.driver.reduce((sum, d) => sum + d.count, 0);
    const restaurantTotal = distribution.restaurant.reduce((sum, d) => sum + d.count, 0);
    const driverAvg = driverTotal > 0 
      ? distribution.driver.reduce((sum, d) => sum + d.rating * d.count, 0) / driverTotal 
      : 0;
    const restaurantAvg = restaurantTotal > 0 
      ? distribution.restaurant.reduce((sum, d) => sum + d.rating * d.count, 0) / restaurantTotal 
      : 0;

    res.json({
      ratings: allRatings,
      distribution,
      summary: {
        totalDriverRatings: driverTotal,
        totalRestaurantReviews: restaurantTotal,
        avgDriverRating: Math.round(driverAvg * 100) / 100,
        avgRestaurantRating: Math.round(restaurantAvg * 100) / 100,
        flaggedReviews: restaurantReviews.filter((r: any) => r.isFlagged).length,
        lowRatings: allRatings.filter(r => r.rating <= 2).length,
      },
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: filters.type === "driver" ? driverTotal : filters.type === "restaurant" ? restaurantTotal : driverTotal + restaurantTotal,
      },
    });
  } catch (error) {
    console.error("Error fetching ratings:", error);
    res.status(500).json({ error: "Failed to fetch ratings" });
  }
});

const updateRatingSchema = z.object({
  action: z.enum(["flag", "unflag", "hide", "unhide", "verify"]),
  reason: z.string().optional(),
});

router.patch("/ratings/:id", checkPermission(Permission.MANAGE_REPORTS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = updateRatingSchema.parse(req.body);
    const adminId = req.user!.id;

    // Try to find as a review first (restaurant review)
    const review = await prisma.review.findUnique({ where: { id } });
    
    if (review) {
      const updateData: any = {};
      
      switch (action) {
        case "flag":
          updateData.isFlagged = true;
          updateData.flaggedByAdminId = adminId;
          updateData.flaggedAt = new Date();
          updateData.flagReason = reason || "Flagged by admin";
          break;
        case "unflag":
          updateData.isFlagged = false;
          updateData.flaggedByAdminId = null;
          updateData.flaggedAt = null;
          updateData.flagReason = null;
          break;
        case "hide":
          updateData.isHidden = true;
          updateData.hiddenByAdminId = adminId;
          updateData.hiddenAt = new Date();
          updateData.hideReason = reason || "Hidden by admin";
          break;
        case "unhide":
          updateData.isHidden = false;
          updateData.hiddenByAdminId = null;
          updateData.hiddenAt = null;
          updateData.hideReason = null;
          break;
        case "verify":
          updateData.isFlagged = false;
          updateData.flaggedByAdminId = null;
          updateData.flaggedAt = null;
          updateData.flagReason = null;
          break;
      }

      const updated = await prisma.review.update({
        where: { id },
        data: updateData,
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          action: `rating_${action}`,
          entityType: "review",
          entityId: id,
          userId: adminId,
          details: { action, reason, reviewId: id },
          ipAddress: req.ip || "unknown",
          userAgent: req.headers["user-agent"] || "unknown",
        },
      });

      return res.json({ success: true, rating: updated, type: "restaurant" });
    }

    // If not found as review, it's a ride rating - we don't modify those directly
    // but we can create a flag record
    const ride = await prisma.ride.findUnique({ where: { id } });
    if (ride) {
      // Audit log for ride rating action
      await prisma.auditLog.create({
        data: {
          action: `rating_${action}`,
          entityType: "ride_rating",
          entityId: id,
          userId: adminId,
          details: { action, reason, rideId: id, rating: ride.customerRating },
          ipAddress: req.ip || "unknown",
          userAgent: req.headers["user-agent"] || "unknown",
        },
      });

      return res.json({ success: true, type: "driver", message: "Action logged for ride rating" });
    }

    return res.status(404).json({ error: "Rating not found" });
  } catch (error) {
    console.error("Error updating rating:", error);
    res.status(500).json({ error: "Failed to update rating" });
  }
});

// Get linked complaints for a rating
router.get("/ratings/:id/complaints", checkPermission(Permission.VIEW_COMPLAINTS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    // Find complaints related to this ride or review
    const complaints = await prisma.complaint.findMany({
      where: {
        OR: [
          { rideId: id },
          { orderId: id },
        ],
      },
      include: {
        customer: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ complaints });
  } catch (error) {
    console.error("Error fetching linked complaints:", error);
    res.status(500).json({ error: "Failed to fetch linked complaints" });
  }
});

// ========================================
// 17. DRIVER VIOLATIONS CENTER (Enhanced)
// ========================================

const violationsFilterSchema = z.object({
  category: z.enum(["all", "safety", "behavior", "payment_abuse", "system_misuse"]).default("all"),
  severity: z.enum(["all", "critical", "high", "medium", "low"]).default("all"),
  status: z.enum(["all", "open", "investigating", "resolved", "dismissed"]).default("all"),
  driverId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

router.get("/violations-center", checkPermission(Permission.VIEW_VIOLATIONS), async (req: AuthRequest, res) => {
  try {
    const filters = violationsFilterSchema.parse(req.query);

    // Mock data with comprehensive violation information
    const violations = [
      {
        id: "viol-001",
        driverId: "drv-001",
        driverName: "John Smith",
        driverEmail: "john.driver@example.com",
        category: "safety",
        type: "speed_violation",
        severity: "high",
        status: "investigating",
        description: "Exceeded speed limit by 25mph in residential zone",
        points: 5,
        location: { lat: 40.7128, lng: -74.0060, address: "123 Main St, New York, NY" },
        rideId: "ride-123",
        evidence: [
          { type: "gps_log", url: "/evidence/gps-001.json", description: "GPS speed log" },
          { type: "customer_report", description: "Customer complaint about unsafe driving" },
        ],
        timeline: [
          { timestamp: new Date(Date.now() - 86400000 * 2), action: "violation_created", actor: "system", details: "Auto-detected from GPS" },
          { timestamp: new Date(Date.now() - 86400000), action: "assigned", actor: "Admin User", details: "Assigned for investigation" },
          { timestamp: new Date(Date.now() - 3600000), action: "evidence_added", actor: "Admin User", details: "Customer statement added" },
        ],
        investigatorId: "adm-001",
        investigatorName: "Admin User",
        createdAt: new Date(Date.now() - 86400000 * 2),
        updatedAt: new Date(Date.now() - 3600000),
      },
      {
        id: "viol-002",
        driverId: "drv-002",
        driverName: "Jane Doe",
        driverEmail: "jane.driver@example.com",
        category: "behavior",
        type: "harassment_complaint",
        severity: "critical",
        status: "open",
        description: "Multiple customer complaints about inappropriate behavior",
        points: 10,
        location: null,
        rideId: "ride-456",
        evidence: [
          { type: "customer_report", description: "Three separate complaints from customers" },
        ],
        timeline: [
          { timestamp: new Date(Date.now() - 3600000 * 4), action: "violation_created", actor: "system", details: "Created from complaint escalation" },
        ],
        investigatorId: null,
        investigatorName: null,
        createdAt: new Date(Date.now() - 3600000 * 4),
        updatedAt: new Date(Date.now() - 3600000 * 4),
      },
      {
        id: "viol-003",
        driverId: "drv-003",
        driverName: "Bob Wilson",
        driverEmail: "bob.driver@example.com",
        category: "payment_abuse",
        type: "fare_manipulation",
        severity: "high",
        status: "resolved",
        description: "Attempted to manipulate fare by taking longer route",
        points: 7,
        location: { lat: 40.7589, lng: -73.9851, address: "Times Square, New York, NY" },
        rideId: "ride-789",
        evidence: [
          { type: "route_comparison", description: "Optimal vs actual route analysis" },
          { type: "fare_analysis", description: "Fare discrepancy report" },
        ],
        timeline: [
          { timestamp: new Date(Date.now() - 86400000 * 5), action: "violation_created", actor: "system", details: "Flagged by fare analysis system" },
          { timestamp: new Date(Date.now() - 86400000 * 4), action: "assigned", actor: "Admin User", details: "Assigned for review" },
          { timestamp: new Date(Date.now() - 86400000 * 2), action: "resolved", actor: "Admin User", details: "Driver warned, customer refunded" },
        ],
        investigatorId: "adm-001",
        investigatorName: "Admin User",
        resolution: {
          type: "warning",
          notes: "First offense - issued warning and refunded customer $15",
          refundAmount: 15,
          suspensionDays: 0,
        },
        createdAt: new Date(Date.now() - 86400000 * 5),
        updatedAt: new Date(Date.now() - 86400000 * 2),
      },
      {
        id: "viol-004",
        driverId: "drv-004",
        driverName: "Alice Johnson",
        driverEmail: "alice.driver@example.com",
        category: "system_misuse",
        type: "fake_location",
        severity: "critical",
        status: "open",
        description: "GPS spoofing detected - fake location submissions",
        points: 15,
        location: null,
        rideId: null,
        evidence: [
          { type: "gps_analysis", description: "Impossible location jumps detected" },
          { type: "device_log", description: "Mock location app detected" },
        ],
        timeline: [
          { timestamp: new Date(Date.now() - 3600000), action: "violation_created", actor: "system", details: "Detected by anti-fraud system" },
        ],
        investigatorId: null,
        investigatorName: null,
        createdAt: new Date(Date.now() - 3600000),
        updatedAt: new Date(Date.now() - 3600000),
      },
    ];

    // Apply filters
    let filteredViolations = violations;
    if (filters.category !== "all") {
      filteredViolations = filteredViolations.filter(v => v.category === filters.category);
    }
    if (filters.severity !== "all") {
      filteredViolations = filteredViolations.filter(v => v.severity === filters.severity);
    }
    if (filters.status !== "all") {
      filteredViolations = filteredViolations.filter(v => v.status === filters.status);
    }
    if (filters.driverId) {
      filteredViolations = filteredViolations.filter(v => v.driverId === filters.driverId);
    }

    // Summary stats
    const summary = {
      total: violations.length,
      open: violations.filter(v => v.status === "open").length,
      investigating: violations.filter(v => v.status === "investigating").length,
      resolved: violations.filter(v => v.status === "resolved").length,
      critical: violations.filter(v => v.severity === "critical").length,
      byCategory: {
        safety: violations.filter(v => v.category === "safety").length,
        behavior: violations.filter(v => v.category === "behavior").length,
        payment_abuse: violations.filter(v => v.category === "payment_abuse").length,
        system_misuse: violations.filter(v => v.category === "system_misuse").length,
      },
    };

    res.json({
      violations: filteredViolations,
      summary,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: filteredViolations.length,
        totalPages: Math.ceil(filteredViolations.length / filters.limit),
      },
    });
  } catch (error) {
    console.error("Error fetching violations center:", error);
    res.status(500).json({ error: "Failed to fetch violations" });
  }
});

const violationActionSchema = z.object({
  action: z.enum(["assign", "investigate", "resolve", "dismiss", "add_evidence", "update_severity"]),
  investigatorId: z.string().optional(),
  resolution: z.object({
    type: z.enum(["warning", "fine", "temporary_suspension", "permanent_ban"]),
    notes: z.string(),
    fineAmount: z.number().optional(),
    suspensionDays: z.number().optional(),
  }).optional(),
  evidence: z.object({
    type: z.string(),
    description: z.string(),
    url: z.string().optional(),
  }).optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  notes: z.string().optional(),
});

router.patch("/violations-center/:id", checkPermission(Permission.MANAGE_VIOLATIONS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = violationActionSchema.parse(req.body);
    const adminId = req.user!.id;

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: `violation_${data.action}`,
        entityType: "violation",
        entityId: id,
        userId: adminId,
        details: data,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      },
    });

    res.json({
      success: true,
      violationId: id,
      action: data.action,
      updatedAt: new Date(),
      updatedBy: adminId,
    });
  } catch (error) {
    console.error("Error updating violation:", error);
    res.status(500).json({ error: "Failed to update violation" });
  }
});

router.post("/violations-center", checkPermission(Permission.MANAGE_VIOLATIONS), async (req: AuthRequest, res) => {
  try {
    const createSchema = z.object({
      driverId: z.string(),
      category: z.enum(["safety", "behavior", "payment_abuse", "system_misuse"]),
      type: z.string(),
      severity: z.enum(["critical", "high", "medium", "low"]),
      description: z.string(),
      points: z.number().default(0),
      rideId: z.string().optional(),
    });

    const data = createSchema.parse(req.body);
    const adminId = req.user!.id;

    const newViolation = {
      id: crypto.randomUUID(),
      ...data,
      status: "open",
      investigatorId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: adminId,
    };

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "violation_created",
        entityType: "violation",
        entityId: newViolation.id,
        userId: adminId,
        details: data,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      },
    });

    res.status(201).json(newViolation);
  } catch (error) {
    console.error("Error creating violation:", error);
    res.status(500).json({ error: "Failed to create violation" });
  }
});

// ========================================
// 18. EARNINGS DISPUTE RESOLUTION
// ========================================

const earningsDisputeFilterSchema = z.object({
  status: z.enum(["all", "pending", "under_review", "approved", "rejected", "adjusted"]).default("all"),
  driverId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

router.get("/earnings-disputes", checkPermission(Permission.VIEW_EARNINGS), async (req: AuthRequest, res) => {
  try {
    const filters = earningsDisputeFilterSchema.parse(req.query);

    const disputes = [
      {
        id: "disp-001",
        driverId: "drv-001",
        driverName: "John Smith",
        driverEmail: "john.driver@example.com",
        rideId: "ride-123",
        rideDate: new Date(Date.now() - 86400000 * 3),
        claimedAmount: 45.00,
        systemAmount: 32.50,
        difference: 12.50,
        disputeReason: "Toll charges not included in fare calculation",
        status: "pending",
        evidence: [
          { type: "receipt", url: "/evidence/toll-001.pdf", description: "Toll receipt from GW Bridge" },
        ],
        adminDecision: null,
        resolutionNotes: null,
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date(Date.now() - 86400000),
      },
      {
        id: "disp-002",
        driverId: "drv-002",
        driverName: "Jane Doe",
        driverEmail: "jane.driver@example.com",
        rideId: "ride-456",
        rideDate: new Date(Date.now() - 86400000 * 5),
        claimedAmount: 28.00,
        systemAmount: 28.00,
        difference: 0,
        disputeReason: "Wait time not properly calculated",
        status: "under_review",
        evidence: [
          { type: "timestamp_log", description: "Driver app wait time log showing 15 minutes" },
        ],
        adminDecision: null,
        resolutionNotes: "Reviewing GPS logs",
        reviewerId: "adm-001",
        reviewerName: "Admin User",
        createdAt: new Date(Date.now() - 86400000 * 2),
        updatedAt: new Date(Date.now() - 3600000),
      },
      {
        id: "disp-003",
        driverId: "drv-003",
        driverName: "Bob Wilson",
        driverEmail: "bob.driver@example.com",
        rideId: "ride-789",
        rideDate: new Date(Date.now() - 86400000 * 7),
        claimedAmount: 55.00,
        systemAmount: 48.00,
        difference: 7.00,
        disputeReason: "Surge pricing not applied correctly",
        status: "approved",
        evidence: [
          { type: "screenshot", url: "/evidence/surge-001.png", description: "Screenshot showing 1.5x surge" },
        ],
        adminDecision: "approved",
        resolutionNotes: "Verified surge was active during pickup. Adjusted earnings by $7.00",
        adjustedAmount: 55.00,
        reviewerId: "adm-002",
        reviewerName: "Senior Admin",
        createdAt: new Date(Date.now() - 86400000 * 4),
        updatedAt: new Date(Date.now() - 86400000),
        resolvedAt: new Date(Date.now() - 86400000),
      },
      {
        id: "disp-004",
        driverId: "drv-004",
        driverName: "Alice Johnson",
        driverEmail: "alice.driver@example.com",
        rideId: "ride-012",
        rideDate: new Date(Date.now() - 86400000 * 10),
        claimedAmount: 100.00,
        systemAmount: 65.00,
        difference: 35.00,
        disputeReason: "Incorrect distance calculation",
        status: "rejected",
        evidence: [],
        adminDecision: "rejected",
        resolutionNotes: "GPS logs confirm system distance is correct. No evidence of route deviation by system.",
        reviewerId: "adm-001",
        reviewerName: "Admin User",
        createdAt: new Date(Date.now() - 86400000 * 6),
        updatedAt: new Date(Date.now() - 86400000 * 3),
        resolvedAt: new Date(Date.now() - 86400000 * 3),
      },
    ];

    // Apply filters
    let filteredDisputes = disputes;
    if (filters.status !== "all") {
      filteredDisputes = filteredDisputes.filter(d => d.status === filters.status);
    }
    if (filters.driverId) {
      filteredDisputes = filteredDisputes.filter(d => d.driverId === filters.driverId);
    }

    const summary = {
      total: disputes.length,
      pending: disputes.filter(d => d.status === "pending").length,
      underReview: disputes.filter(d => d.status === "under_review").length,
      approved: disputes.filter(d => d.status === "approved").length,
      rejected: disputes.filter(d => d.status === "rejected").length,
      totalClaimedDifference: disputes.reduce((sum, d) => sum + d.difference, 0),
      totalApprovedAdjustments: disputes
        .filter(d => d.status === "approved" && (d as any).adjustedAmount)
        .reduce((sum, d) => sum + d.difference, 0),
    };

    res.json({
      disputes: filteredDisputes,
      summary,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: filteredDisputes.length,
        totalPages: Math.ceil(filteredDisputes.length / filters.limit),
      },
    });
  } catch (error) {
    console.error("Error fetching earnings disputes:", error);
    res.status(500).json({ error: "Failed to fetch earnings disputes" });
  }
});

const disputeDecisionSchema = z.object({
  decision: z.enum(["approve", "reject", "adjust"]),
  adjustedAmount: z.number().optional(),
  resolutionNotes: z.string(),
});

router.patch("/earnings-disputes/:id", checkPermission(Permission.MANAGE_EARNINGS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = disputeDecisionSchema.parse(req.body);
    const adminId = req.user!.id;

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: `dispute_${data.decision}`,
        entityType: "earnings_dispute",
        entityId: id,
        userId: adminId,
        details: data,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      },
    });

    res.json({
      success: true,
      disputeId: id,
      decision: data.decision,
      status: data.decision === "approve" ? "approved" : data.decision === "reject" ? "rejected" : "adjusted",
      adjustedAmount: data.adjustedAmount,
      resolutionNotes: data.resolutionNotes,
      resolvedAt: new Date(),
      resolvedBy: adminId,
    });
  } catch (error) {
    console.error("Error updating dispute:", error);
    res.status(500).json({ error: "Failed to update dispute" });
  }
});

// ========================================
// 19. RIDE TIMELINE VIEWER
// ========================================

router.get("/ride-timeline/:rideId", checkPermission(Permission.VIEW_RIDES), async (req: AuthRequest, res) => {
  try {
    const { rideId } = req.params;

    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        customer: { include: { user: { select: { firstName: true, lastName: true } } } },
        driver: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    const timeline = [
      {
        type: "ride_requested",
        timestamp: ride.createdAt,
        title: "Ride Requested",
        description: `Customer requested pickup at ${ride.pickupAddress}`,
        location: ride.pickupLat && ride.pickupLng ? { lat: ride.pickupLat, lng: ride.pickupLng, address: ride.pickupAddress } : null,
      },
      ...(ride.acceptedAt ? [{
        type: "driver_accepted",
        timestamp: ride.acceptedAt,
        title: "Driver Accepted",
        description: `Driver ${ride.driver?.user?.firstName || "Unknown"} accepted the ride`,
        location: null,
      }] : []),
      ...(ride.arrivedAt ? [{
        type: "driver_arrived",
        timestamp: ride.arrivedAt,
        title: "Driver Arrived",
        description: "Driver arrived at pickup location",
        location: ride.pickupLat && ride.pickupLng ? { lat: ride.pickupLat, lng: ride.pickupLng, address: ride.pickupAddress } : null,
      }] : []),
      ...(ride.tripStartedAt ? [{
        type: "trip_started",
        timestamp: ride.tripStartedAt,
        title: "Trip Started",
        description: "Customer picked up, trip in progress",
        location: ride.pickupLat && ride.pickupLng ? { lat: ride.pickupLat, lng: ride.pickupLng, address: ride.pickupAddress } : null,
      }] : []),
      ...(ride.completedAt ? [{
        type: "trip_completed",
        timestamp: ride.completedAt,
        title: "Trip Completed",
        description: `Arrived at ${ride.dropoffAddress}`,
        location: ride.dropoffLat && ride.dropoffLng ? { lat: ride.dropoffLat, lng: ride.dropoffLng, address: ride.dropoffAddress } : null,
      }] : []),
      ...(ride.cancelledAt ? [{
        type: "ride_cancelled",
        timestamp: ride.cancelledAt,
        title: "Ride Cancelled",
        description: `Cancelled by ${ride.whoCancelled}: ${ride.cancellationReason || "No reason provided"}`,
        location: null,
      }] : []),
    ];

    const safetyEvents: any[] = [];
    const paymentEvents = [
      {
        type: "fare_calculated",
        timestamp: ride.completedAt || ride.createdAt,
        title: "Fare Calculated",
        amount: ride.serviceFare,
        description: `Base fare: $${ride.serviceFare}`,
      },
    ];

    res.json({
      ride: {
        id: ride.id,
        status: ride.status,
        pickupAddress: ride.pickupAddress,
        dropoffAddress: ride.dropoffAddress,
        pickupLocation: ride.pickupLat && ride.pickupLng ? { lat: ride.pickupLat, lng: ride.pickupLng } : null,
        dropoffLocation: ride.dropoffLat && ride.dropoffLng ? { lat: ride.dropoffLat, lng: ride.dropoffLng } : null,
        routePolyline: ride.routePolyline,
        distanceMiles: ride.distanceMiles,
        durationMinutes: ride.durationMinutes,
        fare: ride.serviceFare,
        customerRating: ride.customerRating,
        driverRating: ride.driverRating,
        customer: ride.customer ? `${ride.customer.user?.firstName || ""} ${ride.customer.user?.lastName || ""}`.trim() : "Unknown",
        driver: ride.driver ? `${ride.driver.user?.firstName || ""} ${ride.driver.user?.lastName || ""}`.trim() : "Unknown",
      },
      timeline,
      safetyEvents,
      paymentEvents,
      anomalies: [],
    });
  } catch (error) {
    console.error("Error fetching ride timeline:", error);
    res.status(500).json({ error: "Failed to fetch ride timeline" });
  }
});

// ========================================
// 20. NOTIFICATION RULES ENGINE
// ========================================

router.get("/notification-rules", checkPermission(Permission.VIEW_NOTIFICATIONS), async (req: AuthRequest, res) => {
  try {
    const rules = [
      {
        id: "rule-001",
        name: "Critical Incident Alert",
        description: "Alert super admins immediately for critical safety incidents",
        isActive: true,
        trigger: { type: "incident", severity: "critical" },
        conditions: [
          { field: "severity", operator: "equals", value: "critical" },
          { field: "category", operator: "in", value: ["safety", "harassment"] },
        ],
        actions: [
          { type: "email", recipients: ["super_admin"], template: "critical_incident" },
          { type: "push", recipients: ["super_admin", "country_admin"], template: "critical_alert" },
          { type: "sms", recipients: ["on_call_admin"], template: "urgent_sms" },
        ],
        escalation: {
          enabled: true,
          timeout: 15,
          escalateTo: ["ceo", "legal"],
        },
        createdAt: new Date(Date.now() - 86400000 * 30),
        updatedAt: new Date(Date.now() - 86400000 * 5),
      },
      {
        id: "rule-002",
        name: "High Value Refund Approval",
        description: "Notify finance team for refunds over $100",
        isActive: true,
        trigger: { type: "refund", amountThreshold: 100 },
        conditions: [
          { field: "amount", operator: "greater_than", value: 100 },
        ],
        actions: [
          { type: "email", recipients: ["finance_admin"], template: "high_value_refund" },
        ],
        escalation: {
          enabled: false,
        },
        createdAt: new Date(Date.now() - 86400000 * 15),
        updatedAt: new Date(Date.now() - 86400000 * 2),
      },
      {
        id: "rule-003",
        name: "Driver Document Expiry Warning",
        description: "Warn drivers 30 days before document expiration",
        isActive: true,
        trigger: { type: "scheduled", schedule: "daily" },
        conditions: [
          { field: "document_expiry", operator: "days_before", value: 30 },
        ],
        actions: [
          { type: "push", recipients: ["driver"], template: "document_expiry_warning" },
          { type: "email", recipients: ["driver"], template: "document_renewal" },
        ],
        escalation: {
          enabled: true,
          timeout: 7,
          escalateTo: ["operations_admin"],
        },
        createdAt: new Date(Date.now() - 86400000 * 60),
        updatedAt: new Date(Date.now() - 86400000 * 10),
      },
    ];

    res.json({
      rules,
      templates: {
        email: ["critical_incident", "high_value_refund", "document_renewal", "welcome", "suspension_notice"],
        push: ["critical_alert", "document_expiry_warning", "promo_notification", "ride_reminder"],
        sms: ["urgent_sms", "otp_verification", "ride_status"],
      },
      summary: {
        total: rules.length,
        active: rules.filter(r => r.isActive).length,
        withEscalation: rules.filter(r => r.escalation?.enabled).length,
      },
    });
  } catch (error) {
    console.error("Error fetching notification rules:", error);
    res.status(500).json({ error: "Failed to fetch notification rules" });
  }
});

router.post("/notification-rules", checkPermission(Permission.MANAGE_NOTIFICATIONS), async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string(),
      trigger: z.object({
        type: z.string(),
        severity: z.string().optional(),
        amountThreshold: z.number().optional(),
        schedule: z.string().optional(),
      }),
      conditions: z.array(z.object({
        field: z.string(),
        operator: z.string(),
        value: z.any(),
      })),
      actions: z.array(z.object({
        type: z.enum(["email", "push", "sms"]),
        recipients: z.array(z.string()),
        template: z.string(),
      })),
      escalation: z.object({
        enabled: z.boolean(),
        timeout: z.number().optional(),
        escalateTo: z.array(z.string()).optional(),
      }).optional(),
    });

    const data = schema.parse(req.body);
    const adminId = req.user!.id;

    const newRule = {
      id: crypto.randomUUID(),
      ...data,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: adminId,
    };

    await prisma.auditLog.create({
      data: {
        action: "notification_rule_created",
        entityType: "notification_rule",
        entityId: newRule.id,
        userId: adminId,
        details: data,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      },
    });

    res.status(201).json(newRule);
  } catch (error) {
    console.error("Error creating notification rule:", error);
    res.status(500).json({ error: "Failed to create notification rule" });
  }
});

router.patch("/notification-rules/:id", checkPermission(Permission.MANAGE_NOTIFICATIONS), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { isActive, ...updates } = req.body;
    const adminId = req.user!.id;

    await prisma.auditLog.create({
      data: {
        action: isActive !== undefined ? `notification_rule_${isActive ? "enabled" : "disabled"}` : "notification_rule_updated",
        entityType: "notification_rule",
        entityId: id,
        userId: adminId,
        details: req.body,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      },
    });

    res.json({
      success: true,
      ruleId: id,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error("Error updating notification rule:", error);
    res.status(500).json({ error: "Failed to update notification rule" });
  }
});

// ========================================
// 21. INCIDENT CORRELATION ENGINE
// ========================================

router.get("/correlation/:caseId", checkPermission(Permission.VIEW_INCIDENTS), async (req: AuthRequest, res) => {
  try {
    const { caseId } = req.params;

    const correlatedData = {
      caseId,
      primaryIncident: {
        id: caseId,
        type: "complaint",
        severity: "high",
        subject: "Unsafe driving complaint",
        createdAt: new Date(Date.now() - 86400000 * 2),
      },
      linkedCases: [
        {
          id: "ride-789",
          type: "ride",
          relationship: "occurred_during",
          severity: "medium",
          summary: "Ride where incident occurred",
          timestamp: new Date(Date.now() - 86400000 * 2),
        },
        {
          id: "payment-456",
          type: "payment",
          relationship: "related_transaction",
          severity: "low",
          summary: "Payment for the ride",
          timestamp: new Date(Date.now() - 86400000 * 2),
        },
        {
          id: "safety-123",
          type: "safety_report",
          relationship: "generated_from",
          severity: "high",
          summary: "Auto-generated safety report",
          timestamp: new Date(Date.now() - 86400000 * 2),
        },
        {
          id: "viol-001",
          type: "violation",
          relationship: "escalated_to",
          severity: "high",
          summary: "Driver violation record",
          timestamp: new Date(Date.now() - 86400000),
        },
      ],
      graph: {
        nodes: [
          { id: caseId, type: "complaint", label: "Primary Complaint" },
          { id: "ride-789", type: "ride", label: "Related Ride" },
          { id: "payment-456", type: "payment", label: "Payment" },
          { id: "safety-123", type: "safety", label: "Safety Report" },
          { id: "viol-001", type: "violation", label: "Violation" },
          { id: "drv-001", type: "driver", label: "Driver" },
          { id: "cust-001", type: "customer", label: "Customer" },
        ],
        edges: [
          { from: caseId, to: "ride-789", label: "occurred_during" },
          { from: "ride-789", to: "payment-456", label: "has_payment" },
          { from: caseId, to: "safety-123", label: "generated" },
          { from: "safety-123", to: "viol-001", label: "escalated_to" },
          { from: "ride-789", to: "drv-001", label: "driver" },
          { from: "ride-789", to: "cust-001", label: "customer" },
          { from: caseId, to: "cust-001", label: "filed_by" },
        ],
      },
      rootCause: {
        prediction: "driver_fatigue",
        confidence: 0.78,
        factors: [
          "Driver completed 8 rides in last 10 hours",
          "Incident occurred late at night",
          "Previous similar complaint 2 weeks ago",
        ],
      },
      severityPropagation: {
        initial: "medium",
        current: "high",
        reason: "Multiple linked safety concerns and escalation to violation",
      },
      recommendations: [
        "Review driver fatigue monitoring",
        "Consider temporary suspension pending investigation",
        "Follow up with customer for additional details",
      ],
    };

    res.json(correlatedData);
  } catch (error) {
    console.error("Error fetching correlation:", error);
    res.status(500).json({ error: "Failed to fetch correlation data" });
  }
});

// ========================================
// 22. PAYMENT INTEGRITY DASHBOARD
// ========================================

router.get("/payment-integrity", checkPermission(Permission.VIEW_PAYMENTS), async (req: AuthRequest, res) => {
  try {
    const dashboard = {
      summary: {
        totalTransactions24h: 15420,
        flaggedTransactions: 23,
        underchargeAnomalies: 8,
        overchargeAnomalies: 5,
        stripeSyncErrors: 3,
        fraudPatterns: 7,
        integrityScore: 98.5,
      },
      anomalies: [
        {
          id: "anom-001",
          type: "undercharge",
          rideId: "ride-123",
          expectedAmount: 45.00,
          actualAmount: 35.00,
          difference: -10.00,
          detectedAt: new Date(Date.now() - 3600000),
          status: "investigating",
          reason: "Surge pricing not applied",
        },
        {
          id: "anom-002",
          type: "overcharge",
          rideId: "ride-456",
          expectedAmount: 25.00,
          actualAmount: 32.00,
          difference: 7.00,
          detectedAt: new Date(Date.now() - 7200000),
          status: "resolved",
          reason: "Duplicate toll charge",
          resolution: "Refunded $7 to customer",
        },
        {
          id: "anom-003",
          type: "stripe_sync_error",
          paymentId: "pay-789",
          error: "Payment intent not found",
          detectedAt: new Date(Date.now() - 1800000),
          status: "pending",
          retryCount: 2,
        },
      ],
      fraudPatterns: [
        {
          id: "fraud-001",
          pattern: "multiple_accounts",
          description: "Same device used for 3 different driver accounts",
          severity: "high",
          affectedEntities: ["drv-001", "drv-002", "drv-003"],
          detectedAt: new Date(Date.now() - 86400000),
          status: "investigating",
        },
        {
          id: "fraud-002",
          pattern: "tip_baiting",
          description: "Customer adds large tip then removes after delivery",
          severity: "medium",
          affectedEntities: ["cust-456"],
          detectedAt: new Date(Date.now() - 43200000),
          status: "confirmed",
        },
      ],
      syncStatus: {
        lastSync: new Date(Date.now() - 300000),
        pendingSync: 12,
        failedSync: 3,
        healthStatus: "degraded",
      },
      trends: {
        anomalyRate7d: [0.5, 0.4, 0.6, 0.3, 0.5, 0.4, 0.3],
        fraudRate7d: [0.1, 0.15, 0.12, 0.08, 0.1, 0.09, 0.11],
      },
    };

    res.json(dashboard);
  } catch (error) {
    console.error("Error fetching payment integrity:", error);
    res.status(500).json({ error: "Failed to fetch payment integrity data" });
  }
});

// ========================================
// 23. GLOBAL ADMIN SEARCH
// ========================================

const searchSchema = z.object({
  q: z.string().min(1),
  type: z.enum(["all", "users", "drivers", "restaurants", "rides", "payments", "complaints", "violations", "incidents"]).default("all"),
  limit: z.coerce.number().default(20),
});

router.get("/search", checkPermission(Permission.VIEW_DASHBOARD), async (req: AuthRequest, res) => {
  try {
    const { q, type, limit } = searchSchema.parse(req.query);
    const searchTerm = q.toLowerCase();

    const results: any = {
      users: [],
      drivers: [],
      restaurants: [],
      rides: [],
      payments: [],
      complaints: [],
      violations: [],
      incidents: [],
    };

    if (type === "all" || type === "users") {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { firstName: { contains: searchTerm, mode: "insensitive" } },
            { lastName: { contains: searchTerm, mode: "insensitive" } },
            { email: { contains: searchTerm, mode: "insensitive" } },
            { phone: { contains: searchTerm, mode: "insensitive" } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true },
        take: limit,
      });
      results.users = users.map(u => ({
        id: u.id,
        type: "user",
        title: `${u.firstName} ${u.lastName}`,
        subtitle: u.email,
        meta: { role: u.role, phone: u.phone },
      }));
    }

    if (type === "all" || type === "drivers") {
      const drivers = await prisma.driverProfile.findMany({
        where: {
          OR: [
            { user: { firstName: { contains: searchTerm, mode: "insensitive" } } },
            { user: { lastName: { contains: searchTerm, mode: "insensitive" } } },
            { user: { email: { contains: searchTerm, mode: "insensitive" } } },
            { vehiclePlate: { contains: searchTerm, mode: "insensitive" } },
          ],
        },
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        take: limit,
      });
      results.drivers = drivers.map(d => ({
        id: d.id,
        type: "driver",
        title: `${d.user.firstName} ${d.user.lastName}`,
        subtitle: d.user.email,
        meta: { status: d.status, vehiclePlate: d.vehiclePlate },
      }));
    }

    if (type === "all" || type === "restaurants") {
      const restaurants = await prisma.restaurantProfile.findMany({
        where: {
          OR: [
            { businessName: { contains: searchTerm, mode: "insensitive" } },
            { email: { contains: searchTerm, mode: "insensitive" } },
          ],
        },
        select: { id: true, businessName: true, email: true, status: true, cuisine: true },
        take: limit,
      });
      results.restaurants = restaurants.map(r => ({
        id: r.id,
        type: "restaurant",
        title: r.businessName,
        subtitle: r.email || "",
        meta: { status: r.status, cuisine: r.cuisine },
      }));
    }

    if (type === "all" || type === "complaints") {
      const complaints = await prisma.complaint.findMany({
        where: {
          OR: [
            { ticketCode: { contains: searchTerm, mode: "insensitive" } },
            { subject: { contains: searchTerm, mode: "insensitive" } },
            { description: { contains: searchTerm, mode: "insensitive" } },
          ],
        },
        select: { id: true, ticketCode: true, subject: true, status: true, severity: true, createdAt: true },
        take: limit,
      });
      results.complaints = complaints.map(c => ({
        id: c.id,
        type: "complaint",
        title: c.ticketCode,
        subtitle: c.subject,
        meta: { status: c.status, severity: c.severity, createdAt: c.createdAt },
      }));
    }

    const totalResults = Object.values(results).reduce((sum: number, arr: any) => sum + arr.length, 0);

    res.json({
      query: q,
      totalResults,
      results,
      groupedCount: {
        users: results.users.length,
        drivers: results.drivers.length,
        restaurants: results.restaurants.length,
        rides: results.rides.length,
        payments: results.payments.length,
        complaints: results.complaints.length,
        violations: results.violations.length,
        incidents: results.incidents.length,
      },
    });
  } catch (error) {
    console.error("Error performing search:", error);
    res.status(500).json({ error: "Failed to perform search" });
  }
});

export default router;
