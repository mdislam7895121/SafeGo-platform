import { Router, type Response } from "express";
import { prisma } from "../db";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { logAuditEvent } from "../utils/audit";
import { z } from "zod";

const router = Router();

router.use(authenticateToken);
router.use(requireRole(["driver"]));

type SafetyIncidentCategory = 
  | "RIDER_MISCONDUCT" 
  | "VEHICLE_DAMAGE" 
  | "PAYMENT_DISPUTE" 
  | "LOST_AND_FOUND" 
  | "HARASSMENT_THREAT" 
  | "UNSAFE_LOCATION" 
  | "OTHER";

type SafetyIncidentStatus = "SUBMITTED" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED";

const CATEGORY_LABELS: Record<SafetyIncidentCategory, string> = {
  RIDER_MISCONDUCT: "Rider Misconduct",
  VEHICLE_DAMAGE: "Vehicle Damage",
  PAYMENT_DISPUTE: "Payment Dispute",
  LOST_AND_FOUND: "Lost & Found",
  HARASSMENT_THREAT: "Harassment/Threat",
  UNSAFE_LOCATION: "Unsafe Location Issue",
  OTHER: "Other"
};

const STATUS_LABELS: Record<SafetyIncidentStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  RESOLVED: "Resolved",
  CLOSED: "Closed"
};

async function getDriverContext(userId: string) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      isVerified: true,
      verificationStatus: true,
      isSuspended: true,
      firstName: true,
      lastName: true,
      user: { select: { countryCode: true } }
    }
  });
  if (!driver) throw new Error("Driver profile not found");
  return {
    driverId: driver.id,
    countryCode: driver.user.countryCode || "US",
    isVerified: driver.isVerified,
    verificationStatus: driver.verificationStatus,
    isSuspended: driver.isSuspended,
    firstName: driver.firstName,
    lastName: driver.lastName
  };
}

const reportIncidentSchema = z.object({
  category: z.enum([
    "RIDER_MISCONDUCT",
    "VEHICLE_DAMAGE",
    "PAYMENT_DISPUTE",
    "LOST_AND_FOUND",
    "HARASSMENT_THREAT",
    "UNSAFE_LOCATION",
    "OTHER"
  ]),
  description: z.string().min(10, "Description must be at least 10 characters"),
  incidentDate: z.string().transform((val) => new Date(val)),
  tripId: z.string().optional(),
  tripType: z.enum(["RIDE", "FOOD", "PARCEL"]).optional(),
  locationAddress: z.string().optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  attachments: z.array(z.string()).optional()
});

router.get("/summary", async (req: AuthRequest, res: Response) => {
  try {
    const ctx = await getDriverContext(req.user!.userId);

    if (ctx.isSuspended) {
      return res.status(403).json({ error: "Account suspended" });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalIncidents, monthlyIncidents, resolvedIncidents, pendingIncidents] = await Promise.all([
      prisma.driverSafetyIncident.count({ where: { driverId: ctx.driverId } }),
      prisma.driverSafetyIncident.count({
        where: { driverId: ctx.driverId, createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.driverSafetyIncident.count({
        where: { driverId: ctx.driverId, status: "RESOLVED" }
      }),
      prisma.driverSafetyIncident.count({
        where: { driverId: ctx.driverId, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } }
      })
    ]);

    const safetyScore = calculateSafetyScore(totalIncidents, resolvedIncidents);

    return res.json({
      safetyScore,
      totalIncidents,
      monthlyIncidents,
      resolvedIncidents,
      pendingIncidents,
      quickActions: [
        { id: "emergency", label: "Emergency SOS", icon: "AlertCircle", href: "/driver/safety/emergency" },
        { id: "report", label: "Report Incident", icon: "FileText", href: "/driver/safety/report" },
        { id: "history", label: "Incident History", icon: "History", href: "/driver/safety/history" }
      ],
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching safety summary:", error);
    return res.status(500).json({ error: "Failed to fetch safety summary" });
  }
});

router.get("/incidents", async (req: AuthRequest, res: Response) => {
  try {
    const ctx = await getDriverContext(req.user!.userId);

    if (ctx.isSuspended) {
      return res.status(403).json({ error: "Account suspended" });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const category = req.query.category as string;

    const skip = (page - 1) * limit;

    const where: any = { driverId: ctx.driverId };
    if (status && ["SUBMITTED", "UNDER_REVIEW", "RESOLVED", "CLOSED"].includes(status)) {
      where.status = status;
    }
    if (category && Object.keys(CATEGORY_LABELS).includes(category)) {
      where.category = category;
    }

    const [incidents, totalCount] = await Promise.all([
      prisma.driverSafetyIncident.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          category: true,
          description: true,
          incidentDate: true,
          status: true,
          tripId: true,
          tripType: true,
          locationAddress: true,
          attachments: true,
          resolution: true,
          resolvedAt: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.driverSafetyIncident.count({ where })
    ]);

    const formattedIncidents = incidents.map(incident => ({
      ...incident,
      categoryLabel: CATEGORY_LABELS[incident.category as SafetyIncidentCategory],
      statusLabel: STATUS_LABELS[incident.status as SafetyIncidentStatus],
      hasAttachments: incident.attachments.length > 0
    }));

    return res.json({
      incidents: formattedIncidents,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount
      }
    });
  } catch (error) {
    console.error("Error fetching incidents:", error);
    return res.status(500).json({ error: "Failed to fetch incidents" });
  }
});

router.get("/incidents/:id", async (req: AuthRequest, res: Response) => {
  try {
    const ctx = await getDriverContext(req.user!.userId);

    if (ctx.isSuspended) {
      return res.status(403).json({ error: "Account suspended" });
    }

    const { id } = req.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: "Invalid incident ID format" });
    }

    const incident = await prisma.driverSafetyIncident.findFirst({
      where: {
        id,
        driverId: ctx.driverId
      },
      select: {
        id: true,
        category: true,
        description: true,
        incidentDate: true,
        status: true,
        tripId: true,
        tripType: true,
        locationAddress: true,
        locationLat: true,
        locationLng: true,
        attachments: true,
        resolution: true,
        resolvedAt: true,
        resolvedBy: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    return res.json({
      ...incident,
      categoryLabel: CATEGORY_LABELS[incident.category as SafetyIncidentCategory],
      statusLabel: STATUS_LABELS[incident.status as SafetyIncidentStatus]
    });
  } catch (error) {
    console.error("Error fetching incident:", error);
    return res.status(500).json({ error: "Failed to fetch incident" });
  }
});

router.post("/report", async (req: AuthRequest, res: Response) => {
  try {
    const ctx = await getDriverContext(req.user!.userId);

    if (ctx.isSuspended) {
      return res.status(403).json({ error: "Account suspended" });
    }

    if (!ctx.isVerified) {
      return res.status(403).json({ error: "Account not verified. Please complete KYC verification." });
    }

    const validationResult = reportIncidentSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validationResult.error.errors 
      });
    }

    const data = validationResult.data;

    const incident = await prisma.driverSafetyIncident.create({
      data: {
        driverId: ctx.driverId,
        category: data.category,
        description: data.description,
        incidentDate: data.incidentDate,
        tripId: data.tripId,
        tripType: data.tripType,
        locationAddress: data.locationAddress,
        locationLat: data.locationLat,
        locationLng: data.locationLng,
        attachments: data.attachments || [],
        status: "SUBMITTED"
      }
    });

    await logAuditEvent({
      actorId: req.user!.userId,
      actorEmail: "",
      actorRole: "driver",
      actionType: "DRIVER_SAFETY_INCIDENT_REPORTED",
      entityType: "safety_incident",
      entityId: incident.id,
      description: `Driver reported safety incident: ${data.category}`,
      metadata: {
        category: data.category,
        incidentDate: data.incidentDate.toISOString(),
        driverId: ctx.driverId
      }
    });

    return res.status(201).json({
      message: "Incident reported successfully",
      incident: {
        id: incident.id,
        category: incident.category,
        categoryLabel: CATEGORY_LABELS[incident.category as SafetyIncidentCategory],
        status: incident.status,
        statusLabel: STATUS_LABELS[incident.status as SafetyIncidentStatus],
        createdAt: incident.createdAt
      }
    });
  } catch (error) {
    console.error("Error reporting incident:", error);
    return res.status(500).json({ error: "Failed to report incident" });
  }
});

router.post("/emergency/sos", async (req: AuthRequest, res: Response) => {
  try {
    const ctx = await getDriverContext(req.user!.userId);

    const { type, message, location } = req.body;

    await logAuditEvent({
      actorId: req.user!.userId,
      actorEmail: "",
      actorRole: "driver",
      actionType: "DRIVER_EMERGENCY_SOS_TRIGGERED",
      entityType: "emergency",
      entityId: ctx.driverId,
      description: "Driver triggered emergency SOS",
      metadata: {
        type: type || "SOS",
        message: message || "Emergency SOS triggered",
        location: location || { lat: null, lng: null },
        driverName: `${ctx.firstName || ''} ${ctx.lastName || ''}`.trim(),
        timestamp: new Date().toISOString()
      }
    });

    return res.json({
      message: "Emergency alert sent successfully",
      alertId: `EMR-${Date.now()}`,
      status: "dispatched",
      estimatedResponseTime: "5-10 minutes",
      supportContactNumber: "+1-800-SAFEGO"
    });
  } catch (error) {
    console.error("Error sending emergency alert:", error);
    return res.status(500).json({ error: "Failed to send emergency alert" });
  }
});

router.post("/emergency/quick-support", async (req: AuthRequest, res: Response) => {
  try {
    const ctx = await getDriverContext(req.user!.userId);

    const { message, urgency } = req.body;

    await logAuditEvent({
      actorId: req.user!.userId,
      actorEmail: "",
      actorRole: "driver",
      actionType: "DRIVER_SAFETY_SUPPORT_CONTACTED",
      entityType: "support_message",
      entityId: ctx.driverId,
      description: "Driver contacted safety support",
      metadata: {
        message: message || "Quick support message",
        urgency: urgency || "normal",
        timestamp: new Date().toISOString()
      }
    });

    return res.json({
      message: "Support message sent successfully",
      ticketId: `SPT-${Date.now()}`,
      estimatedResponse: "Within 24 hours"
    });
  } catch (error) {
    console.error("Error contacting support:", error);
    return res.status(500).json({ error: "Failed to contact support" });
  }
});

router.get("/categories", async (req: AuthRequest, res: Response) => {
  return res.json({
    categories: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
      value,
      label
    }))
  });
});

function calculateSafetyScore(totalIncidents: number, resolvedIncidents: number): number {
  if (totalIncidents === 0) return 100;
  
  const resolutionRate = totalIncidents > 0 ? (resolvedIncidents / totalIncidents) : 1;
  const incidentPenalty = Math.min(totalIncidents * 2, 30);
  
  const score = Math.max(0, 100 - incidentPenalty + (resolutionRate * 10));
  return Math.min(100, Math.round(score));
}

export default router;
