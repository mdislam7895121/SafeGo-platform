import { Router, Request, Response } from "express";
import { Permission, canPerform, AdminRole } from "../utils/permissions";
import {
  ComplianceExportService,
  ComplianceExportCategory,
  ComplianceExportStatus,
} from "../services/complianceExportService";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    adminProfile?: {
      adminRole: AdminRole;
      isActive: boolean;
    } | null;
  };
}

function checkPermission(req: AuthenticatedRequest, permission: Permission): boolean {
  return canPerform(req.user, permission);
}

function getClientIp(req: any): string | null {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.connection?.remoteAddress ||
    null
  );
}

const router = Router();

router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!checkPermission(req, Permission.VIEW_COMPLIANCE_EXPORTS)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const { category, status, countryCode, limit, offset, startDate, endDate } = req.query;

    const result = await ComplianceExportService.getExports({
      category: category as ComplianceExportCategory,
      status: status as ComplianceExportStatus,
      countryCode: countryCode as string,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    return res.json(result);
  } catch (error: any) {
    console.error("[ComplianceExports] Error listing exports:", error);
    return res.status(500).json({ error: "Failed to fetch exports" });
  }
});

router.get("/entities", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!checkPermission(req, Permission.VIEW_COMPLIANCE_EXPORTS)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    return res.json({
      entities: ComplianceExportService.AVAILABLE_ENTITIES.map((entity) => ({
        id: entity,
        label: entity.charAt(0).toUpperCase() + entity.slice(1).replace(/([A-Z])/g, " $1"),
        description: getEntityDescription(entity),
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to fetch entities" });
  }
});

function getEntityDescription(entity: string): string {
  const descriptions: Record<string, string> = {
    profile: "User profile information including name, email, phone",
    kyc: "Know Your Customer documents and verification status",
    rides: "Ride history including pickup/dropoff, fares, status",
    deliveries: "Parcel delivery history",
    wallet: "Wallet balance and transaction history",
    complaints: "Filed complaints and their resolution status",
    safetyIncidents: "Safety-related incidents and reports",
    payments: "Payment history and transaction records",
    disputes: "Dispute cases and resolutions",
    auditLogs: "Audit trail of user/admin actions",
  };
  return descriptions[entity] || entity;
}

router.get("/retention-policies", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!checkPermission(req, Permission.VIEW_COMPLIANCE_EXPORTS)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const policies = await ComplianceExportService.getRetentionPolicies();
    return res.json({ policies });
  } catch (error: any) {
    console.error("[ComplianceExports] Error fetching retention policies:", error);
    return res.status(500).json({ error: "Failed to fetch retention policies" });
  }
});

router.put("/retention-policies/:countryCode", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!checkPermission(req, Permission.MANAGE_RETENTION_POLICIES)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const { countryCode } = req.params;
    const policy = await ComplianceExportService.upsertRetentionPolicy(
      countryCode,
      req.body,
      req.user!.id
    );

    return res.json({ success: true, policy });
  } catch (error: any) {
    console.error("[ComplianceExports] Error updating retention policy:", error);
    return res.status(500).json({ error: "Failed to update retention policy" });
  }
});

router.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!checkPermission(req, Permission.VIEW_COMPLIANCE_EXPORTS)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const exportRecord = await ComplianceExportService.getExportById(req.params.id);
    if (!exportRecord) {
      return res.status(404).json({ error: "Export not found" });
    }

    return res.json({ export: exportRecord });
  } catch (error: any) {
    console.error("[ComplianceExports] Error fetching export:", error);
    return res.status(500).json({ error: "Failed to fetch export" });
  }
});

router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!checkPermission(req, Permission.CREATE_COMPLIANCE_EXPORT)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    if (!req.user?.id || !req.user?.email) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const validation = ComplianceExportService.validateCreateExportInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: "Validation failed", details: validation.error });
    }

    const result = await ComplianceExportService.createExport(
      validation.data!,
      req.user.id,
      req.user.email,
      req.user.role || "ADMIN",
      getClientIp(req) || undefined,
      req.headers["user-agent"] || undefined
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(201).json({ success: true, export: result.export });
  } catch (error: any) {
    console.error("[ComplianceExports] Error creating export:", error);
    return res.status(500).json({ error: "Failed to create export" });
  }
});

router.get("/:id/download", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!checkPermission(req, Permission.DOWNLOAD_COMPLIANCE_EXPORT)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    if (!req.user?.id || !req.user?.email) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const result = await ComplianceExportService.downloadExport(
      req.params.id,
      req.user.id,
      req.user.email,
      getClientIp(req) || undefined,
      req.headers["user-agent"] || undefined
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="compliance-export-${req.params.id}.json"`
    );
    return res.json(result.data);
  } catch (error: any) {
    console.error("[ComplianceExports] Error downloading export:", error);
    return res.status(500).json({ error: "Failed to download export" });
  }
});

router.post("/:id/cancel", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!checkPermission(req, Permission.CREATE_COMPLIANCE_EXPORT)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    if (!req.user?.id || !req.user?.email) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const result = await ComplianceExportService.cancelExport(
      req.params.id,
      req.user.id,
      req.user.email
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[ComplianceExports] Error cancelling export:", error);
    return res.status(500).json({ error: "Failed to cancel export" });
  }
});

export default router;
