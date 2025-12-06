/**
 * Privacy & Consent Management Routes
 * 
 * Admin endpoints for managing privacy policies, consent logs, and data requests
 * User endpoints for accepting policies and updating consent preferences
 */

import { Router } from "express";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { ConsentType, ConsentUserRole, PrivacyDeleteRequestStatus } from "@prisma/client";

const router = Router();

router.use(authenticateToken);

const adminOnly = (req: AuthRequest, res: any, next: any) => {
  if (!["admin", "super_admin"].includes(req.user?.role || "")) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

const superAdminOnly = (req: AuthRequest, res: any, next: any) => {
  if (req.user?.role !== "super_admin") {
    return res.status(403).json({ error: "Super Admin access required" });
  }
  next();
};

// ===================================================
// POLICY VERSION MANAGEMENT (Admin Only)
// ===================================================

router.get("/policies", adminOnly, async (req: AuthRequest, res) => {
  try {
    const policies = await prisma.policyVersion.findMany({
      orderBy: { createdAt: "desc" },
    });
    
    res.json({
      success: true,
      policies,
    });
  } catch (error) {
    console.error("[Privacy] List policies error:", error);
    res.status(500).json({ error: "Failed to fetch policy versions" });
  }
});

router.get("/policies/active", async (req: AuthRequest, res) => {
  try {
    const activePolicy = await prisma.policyVersion.findFirst({
      where: { isActive: true },
    });
    
    res.json({
      success: true,
      policy: activePolicy,
    });
  } catch (error) {
    console.error("[Privacy] Get active policy error:", error);
    res.status(500).json({ error: "Failed to fetch active policy" });
  }
});

const createPolicySchema = z.object({
  version: z.string().min(1),
  title: z.string().min(1),
  contentUrl: z.string().url(),
  summary: z.string().optional(),
});

router.post("/policies", superAdminOnly, async (req: AuthRequest, res) => {
  try {
    const parsed = createPolicySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const existing = await prisma.policyVersion.findUnique({
      where: { version: parsed.data.version },
    });

    if (existing) {
      return res.status(409).json({ error: "Policy version already exists" });
    }

    const policy = await prisma.policyVersion.create({
      data: {
        ...parsed.data,
        createdBy: req.user?.id,
      },
    });

    res.json({
      success: true,
      policy,
    });
  } catch (error) {
    console.error("[Privacy] Create policy error:", error);
    res.status(500).json({ error: "Failed to create policy version" });
  }
});

router.patch("/policies/:id/activate", superAdminOnly, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.$transaction(async (tx) => {
      await tx.policyVersion.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      await tx.policyVersion.update({
        where: { id },
        data: { isActive: true },
      });
    });

    const updatedPolicy = await prisma.policyVersion.findUnique({
      where: { id },
    });

    res.json({
      success: true,
      policy: updatedPolicy,
      message: "Policy activated. Users will be required to accept the new policy.",
    });
  } catch (error) {
    console.error("[Privacy] Activate policy error:", error);
    res.status(500).json({ error: "Failed to activate policy" });
  }
});

router.delete("/policies/:id", superAdminOnly, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const policy = await prisma.policyVersion.findUnique({
      where: { id },
    });

    if (!policy) {
      return res.status(404).json({ error: "Policy not found" });
    }

    if (policy.isActive) {
      return res.status(400).json({ error: "Cannot delete active policy. Deactivate it first." });
    }

    await prisma.policyVersion.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Policy version deleted",
    });
  } catch (error) {
    console.error("[Privacy] Delete policy error:", error);
    res.status(500).json({ error: "Failed to delete policy" });
  }
});

// ===================================================
// CONSENT LOG MANAGEMENT (Admin View Only)
// ===================================================

router.get("/consent-logs", adminOnly, async (req: AuthRequest, res) => {
  try {
    const { userId, userRole, consentType, limit = "50", offset = "0" } = req.query;

    const where: any = {};
    if (userId) where.userId = userId;
    if (userRole) where.userRole = userRole as ConsentUserRole;
    if (consentType) where.consentType = consentType as ConsentType;

    const [logs, total] = await Promise.all([
      prisma.consentLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.consentLog.count({ where }),
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    console.error("[Privacy] List consent logs error:", error);
    res.status(500).json({ error: "Failed to fetch consent logs" });
  }
});

// ===================================================
// PRIVACY DELETE/EXPORT REQUESTS (Admin Management)
// ===================================================

router.get("/data-requests", adminOnly, async (req: AuthRequest, res) => {
  try {
    const { status, userRole, requestType, limit = "50", offset = "0" } = req.query;

    const where: any = {};
    if (status) where.status = status as PrivacyDeleteRequestStatus;
    if (userRole) where.userRole = userRole as ConsentUserRole;
    if (requestType) where.requestType = requestType;

    const [requests, total] = await Promise.all([
      prisma.privacyDeleteRequest.findMany({
        where,
        orderBy: { requestedAt: "desc" },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.privacyDeleteRequest.count({ where }),
    ]);

    res.json({
      success: true,
      requests,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    console.error("[Privacy] List data requests error:", error);
    res.status(500).json({ error: "Failed to fetch data requests" });
  }
});

const updateRequestSchema = z.object({
  status: z.enum(["processing", "completed", "rejected"]),
  rejectionReason: z.string().optional(),
  notes: z.string().optional(),
});

router.patch("/data-requests/:id", adminOnly, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const parsed = updateRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const existing = await prisma.privacyDeleteRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Request not found" });
    }

    const updateData: any = {
      status: parsed.data.status,
      processedBy: req.user?.id,
    };

    if (parsed.data.status === "completed" || parsed.data.status === "rejected") {
      updateData.processedAt = new Date();
    }

    if (parsed.data.rejectionReason) {
      updateData.rejectionReason = parsed.data.rejectionReason;
    }

    if (parsed.data.notes) {
      updateData.notes = parsed.data.notes;
    }

    const updated = await prisma.privacyDeleteRequest.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      request: updated,
    });
  } catch (error) {
    console.error("[Privacy] Update data request error:", error);
    res.status(500).json({ error: "Failed to update data request" });
  }
});

// ===================================================
// DATA RETENTION CONFIGURATION (Super Admin Only)
// ===================================================

router.get("/retention-config", adminOnly, async (req: AuthRequest, res) => {
  try {
    const configs = await prisma.privacyDataRetentionConfig.findMany({
      orderBy: { configKey: "asc" },
    });

    res.json({
      success: true,
      configs,
    });
  } catch (error) {
    console.error("[Privacy] List retention configs error:", error);
    res.status(500).json({ error: "Failed to fetch retention configs" });
  }
});

const upsertRetentionSchema = z.object({
  configKey: z.string().min(1),
  configValue: z.string().min(1),
  description: z.string().optional(),
});

router.post("/retention-config", superAdminOnly, async (req: AuthRequest, res) => {
  try {
    const parsed = upsertRetentionSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const config = await prisma.privacyDataRetentionConfig.upsert({
      where: { configKey: parsed.data.configKey },
      update: {
        configValue: parsed.data.configValue,
        description: parsed.data.description,
        updatedByAdminId: req.user?.id,
      },
      create: {
        configKey: parsed.data.configKey,
        configValue: parsed.data.configValue,
        description: parsed.data.description,
        updatedByAdminId: req.user?.id,
      },
    });

    res.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error("[Privacy] Upsert retention config error:", error);
    res.status(500).json({ error: "Failed to save retention config" });
  }
});

router.post("/retention-config/seed", superAdminOnly, async (req: AuthRequest, res) => {
  try {
    const defaults = [
      { configKey: "ride_history_retention_years", configValue: "5", description: "How many years to retain ride history data" },
      { configKey: "payment_record_retention_years", configValue: "7", description: "How many years to retain payment records" },
      { configKey: "deleted_account_data_retention_days", configValue: "30", description: "Days to retain data after account deletion request" },
      { configKey: "inactive_account_warning_days", configValue: "365", description: "Days of inactivity before warning user" },
      { configKey: "consent_log_retention_years", configValue: "10", description: "How many years to retain consent logs" },
    ];

    for (const config of defaults) {
      await prisma.privacyDataRetentionConfig.upsert({
        where: { configKey: config.configKey },
        update: {},
        create: {
          ...config,
          updatedByAdminId: req.user?.id,
        },
      });
    }

    const configs = await prisma.privacyDataRetentionConfig.findMany({
      orderBy: { configKey: "asc" },
    });

    res.json({
      success: true,
      message: "Default retention configs seeded",
      configs,
    });
  } catch (error) {
    console.error("[Privacy] Seed retention configs error:", error);
    res.status(500).json({ error: "Failed to seed retention configs" });
  }
});

// ===================================================
// USER CONSENT ENDPOINTS
// ===================================================

router.post("/accept-policy", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId || !role) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const activePolicy = await prisma.policyVersion.findFirst({
      where: { isActive: true },
    });

    if (!activePolicy) {
      return res.status(400).json({ error: "No active policy to accept" });
    }

    const ipAddress = req.headers["x-forwarded-for"] as string || req.ip;
    const deviceInfo = req.headers["user-agent"] as string;
    const now = new Date();

    const consentData = {
      privacyPolicyVersion: activePolicy.version,
      termsAccepted: true,
      privacyAccepted: true,
      policyAcceptedAt: now,
    };

    if (role === "customer") {
      const profile = await prisma.customerProfile.findFirst({ where: { userId } });
      if (profile) {
        await prisma.customerProfile.update({
          where: { id: profile.id },
          data: consentData,
        });
      }
    } else if (role === "driver") {
      const profile = await prisma.driverProfile.findFirst({ where: { userId } });
      if (profile) {
        await prisma.driverProfile.update({
          where: { id: profile.id },
          data: consentData,
        });
      }
    } else if (role === "restaurant") {
      const profile = await prisma.restaurantProfile.findFirst({ where: { userId } });
      if (profile) {
        await prisma.restaurantProfile.update({
          where: { id: profile.id },
          data: consentData,
        });
      }
    } else if (role === "shop_partner") {
      const profile = await prisma.shopPartner.findFirst({ where: { userId } });
      if (profile) {
        await prisma.shopPartner.update({
          where: { id: profile.id },
          data: consentData,
        });
      }
    } else if (role === "ticket_operator" || role === "ticket_partner" || role === "rental_partner") {
      const profile = await prisma.ticketOperator.findFirst({ where: { userId } });
      if (profile) {
        await prisma.ticketOperator.update({
          where: { id: profile.id },
          data: consentData,
        });
      }
    } else if (role === "admin" || role === "super_admin") {
      const profile = await prisma.adminProfile.findFirst({ where: { userId } });
      if (profile) {
        await prisma.adminProfile.update({
          where: { id: profile.id },
          data: consentData,
        });
      }
    }

    await prisma.consentLog.createMany({
      data: [
        {
          userId,
          userRole: role as ConsentUserRole,
          consentType: "terms",
          value: true,
          policyVersion: activePolicy.version,
          ipAddress,
          deviceInfo,
          source: "app",
        },
        {
          userId,
          userRole: role as ConsentUserRole,
          consentType: "privacy",
          value: true,
          policyVersion: activePolicy.version,
          ipAddress,
          deviceInfo,
          source: "app",
        },
      ],
    });

    res.json({
      success: true,
      message: "Policy accepted",
      policyVersion: activePolicy.version,
    });
  } catch (error) {
    console.error("[Privacy] Accept policy error:", error);
    res.status(500).json({ error: "Failed to accept policy" });
  }
});

const updateConsentSchema = z.object({
  marketingOptIn: z.boolean().optional(),
  dataSharingOptIn: z.boolean().optional(),
  locationPermission: z.boolean().optional(),
  trackingConsent: z.boolean().optional(),
});

router.patch("/consent-preferences", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId || !role) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsed = updateConsentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const ipAddress = req.headers["x-forwarded-for"] as string || req.ip;
    const deviceInfo = req.headers["user-agent"] as string;

    const consentLogs: any[] = [];
    const updateData = parsed.data;

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        let consentType: ConsentType | null = null;
        if (key === "marketingOptIn") consentType = "marketing";
        if (key === "dataSharingOptIn") consentType = "data_sharing";
        if (key === "locationPermission") consentType = "location";
        if (key === "trackingConsent") consentType = "tracking";

        if (consentType) {
          consentLogs.push({
            userId,
            userRole: role as ConsentUserRole,
            consentType,
            value,
            ipAddress,
            deviceInfo,
            source: "app",
          });
        }
      }
    });

    if (role === "customer") {
      const profile = await prisma.customerProfile.findFirst({ where: { userId } });
      if (profile) {
        await prisma.customerProfile.update({
          where: { id: profile.id },
          data: updateData,
        });
      }
    } else if (role === "driver") {
      const profile = await prisma.driverProfile.findFirst({ where: { userId } });
      if (profile) {
        await prisma.driverProfile.update({
          where: { id: profile.id },
          data: updateData,
        });
      }
    } else if (role === "restaurant") {
      const profile = await prisma.restaurantProfile.findFirst({ where: { userId } });
      if (profile) {
        await prisma.restaurantProfile.update({
          where: { id: profile.id },
          data: updateData,
        });
      }
    } else if (role === "shop_partner") {
      const profile = await prisma.shopPartner.findFirst({ where: { userId } });
      if (profile) {
        await prisma.shopPartner.update({
          where: { id: profile.id },
          data: updateData,
        });
      }
    } else if (role === "ticket_operator" || role === "ticket_partner" || role === "rental_partner") {
      const profile = await prisma.ticketOperator.findFirst({ where: { userId } });
      if (profile) {
        await prisma.ticketOperator.update({
          where: { id: profile.id },
          data: updateData,
        });
      }
    } else if (role === "admin" || role === "super_admin") {
      const profile = await prisma.adminProfile.findFirst({ where: { userId } });
      if (profile) {
        await prisma.adminProfile.update({
          where: { id: profile.id },
          data: updateData,
        });
      }
    }

    if (consentLogs.length > 0) {
      await prisma.consentLog.createMany({ data: consentLogs });
    }

    res.json({
      success: true,
      message: "Consent preferences updated",
    });
  } catch (error) {
    console.error("[Privacy] Update consent preferences error:", error);
    res.status(500).json({ error: "Failed to update consent preferences" });
  }
});

router.get("/my-consent-status", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId || !role) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const activePolicy = await prisma.policyVersion.findFirst({
      where: { isActive: true },
    });

    let consentStatus: any = null;
    let mustAcceptNewPolicy = false;
    let verificationStatus: string | null = null;
    let isVerified = false;

    // Helper function to determine if policy acceptance is required
    // Only require acceptance if: user is verified AND (policy version mismatch OR not accepted)
    const checkPolicyRequired = (
      profileVerificationStatus: string | null | undefined,
      privacyPolicyVersion: string | null | undefined,
      termsAccepted: boolean,
      privacyAccepted: boolean
    ): boolean => {
      // Verified statuses vary by role: "verified", "approved" are considered verified
      const verifiedStatuses = ["verified", "approved"];
      const userIsVerified = verifiedStatuses.includes(profileVerificationStatus || "");
      
      if (!userIsVerified) {
        // User is not verified yet - do NOT force policy acceptance during onboarding
        return false;
      }

      // User is verified - check if they need to accept the policy
      if (!activePolicy) {
        return false; // No active policy to accept
      }

      // Must accept if: version mismatch OR terms not accepted OR privacy not accepted
      const versionMismatch = privacyPolicyVersion !== activePolicy.version;
      const notFullyAccepted = !termsAccepted || !privacyAccepted;
      
      return versionMismatch || notFullyAccepted;
    };

    if (role === "customer") {
      const profile = await prisma.customerProfile.findFirst({ where: { userId } });
      if (profile) {
        verificationStatus = profile.verificationStatus;
        isVerified = ["verified", "approved"].includes(profile.verificationStatus || "");
        consentStatus = {
          privacyPolicyVersion: profile.privacyPolicyVersion,
          termsAccepted: profile.termsAccepted,
          privacyAccepted: profile.privacyAccepted,
          policyAcceptedAt: profile.policyAcceptedAt,
          marketingOptIn: profile.marketingOptIn,
          dataSharingOptIn: profile.dataSharingOptIn,
          locationPermission: profile.locationPermission,
          trackingConsent: profile.trackingConsent,
        };
        mustAcceptNewPolicy = checkPolicyRequired(
          profile.verificationStatus,
          profile.privacyPolicyVersion,
          profile.termsAccepted,
          profile.privacyAccepted
        );
      }
    } else if (role === "driver") {
      const profile = await prisma.driverProfile.findFirst({ where: { userId } });
      if (profile) {
        verificationStatus = profile.verificationStatus;
        isVerified = ["verified", "approved"].includes(profile.verificationStatus || "");
        consentStatus = {
          privacyPolicyVersion: profile.privacyPolicyVersion,
          termsAccepted: profile.termsAccepted,
          privacyAccepted: profile.privacyAccepted,
          policyAcceptedAt: profile.policyAcceptedAt,
          marketingOptIn: profile.marketingOptIn,
          dataSharingOptIn: profile.dataSharingOptIn,
          locationPermission: profile.locationPermission,
          trackingConsent: profile.trackingConsent,
        };
        mustAcceptNewPolicy = checkPolicyRequired(
          profile.verificationStatus,
          profile.privacyPolicyVersion,
          profile.termsAccepted,
          profile.privacyAccepted
        );
      }
    } else if (role === "restaurant") {
      const profile = await prisma.restaurantProfile.findFirst({ where: { userId } });
      if (profile) {
        verificationStatus = profile.verificationStatus;
        isVerified = ["verified", "approved"].includes(profile.verificationStatus || "");
        consentStatus = {
          privacyPolicyVersion: profile.privacyPolicyVersion,
          termsAccepted: profile.termsAccepted,
          privacyAccepted: profile.privacyAccepted,
          policyAcceptedAt: profile.policyAcceptedAt,
          marketingOptIn: profile.marketingOptIn,
          dataSharingOptIn: profile.dataSharingOptIn,
          locationPermission: profile.locationPermission,
          trackingConsent: profile.trackingConsent,
        };
        mustAcceptNewPolicy = checkPolicyRequired(
          profile.verificationStatus,
          profile.privacyPolicyVersion,
          profile.termsAccepted,
          profile.privacyAccepted
        );
      }
    } else if (role === "shop_partner") {
      const profile = await prisma.shopPartner.findFirst({ where: { userId } });
      if (profile) {
        verificationStatus = profile.verificationStatus;
        isVerified = profile.verificationStatus === "approved";
        consentStatus = {
          privacyPolicyVersion: profile.privacyPolicyVersion,
          termsAccepted: profile.termsAccepted,
          privacyAccepted: profile.privacyAccepted,
          policyAcceptedAt: profile.policyAcceptedAt,
          marketingOptIn: profile.marketingOptIn,
          dataSharingOptIn: profile.dataSharingOptIn,
          locationPermission: profile.locationPermission,
          trackingConsent: profile.trackingConsent,
        };
        mustAcceptNewPolicy = checkPolicyRequired(
          profile.verificationStatus,
          profile.privacyPolicyVersion,
          profile.termsAccepted,
          profile.privacyAccepted
        );
      }
    } else if (role === "ticket_operator" || role === "ticket_partner" || role === "rental_partner") {
      const profile = await prisma.ticketOperator.findFirst({ where: { userId } });
      if (profile) {
        verificationStatus = profile.verificationStatus;
        isVerified = profile.verificationStatus === "approved";
        consentStatus = {
          privacyPolicyVersion: profile.privacyPolicyVersion,
          termsAccepted: profile.termsAccepted,
          privacyAccepted: profile.privacyAccepted,
          policyAcceptedAt: profile.policyAcceptedAt,
          marketingOptIn: profile.marketingOptIn,
          dataSharingOptIn: profile.dataSharingOptIn,
          locationPermission: profile.locationPermission,
          trackingConsent: profile.trackingConsent,
        };
        mustAcceptNewPolicy = checkPolicyRequired(
          profile.verificationStatus,
          profile.privacyPolicyVersion,
          profile.termsAccepted,
          profile.privacyAccepted
        );
      }
    } else if (role === "admin" || role === "super_admin") {
      // Admins are never blocked from Admin Panel by policy acceptance
      const profile = await prisma.adminProfile.findFirst({ where: { userId } });
      if (profile) {
        verificationStatus = "verified"; // Admins are always considered verified
        isVerified = true;
        consentStatus = {
          privacyPolicyVersion: profile.privacyPolicyVersion,
          termsAccepted: profile.termsAccepted,
          privacyAccepted: profile.privacyAccepted,
          policyAcceptedAt: profile.policyAcceptedAt,
          marketingOptIn: profile.marketingOptIn,
          dataSharingOptIn: profile.dataSharingOptIn,
          locationPermission: profile.locationPermission,
          trackingConsent: profile.trackingConsent,
        };
        // Admins should NEVER be blocked - they may be reminded but not forced
        mustAcceptNewPolicy = false;
      }
    }

    res.json({
      success: true,
      consentStatus,
      activePolicy: activePolicy ? {
        version: activePolicy.version,
        title: activePolicy.title,
        contentUrl: activePolicy.contentUrl,
        summary: (activePolicy as any).summary,
      } : null,
      mustAcceptNewPolicy: !!mustAcceptNewPolicy,
      verificationStatus,
      isVerified,
    });
  } catch (error) {
    console.error("[Privacy] Get consent status error:", error);
    res.status(500).json({ error: "Failed to get consent status" });
  }
});

router.post("/request-data-action", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId || !role) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { requestType } = req.body;
    if (!["delete", "export"].includes(requestType)) {
      return res.status(400).json({ error: "Invalid request type. Must be 'delete' or 'export'." });
    }

    const existing = await prisma.privacyDeleteRequest.findFirst({
      where: {
        userId,
        requestType,
        status: { in: ["pending", "processing"] },
      },
    });

    if (existing) {
      return res.status(409).json({ 
        error: "You already have a pending request of this type",
        existingRequest: existing,
      });
    }

    const request = await prisma.privacyDeleteRequest.create({
      data: {
        userId,
        userRole: role as ConsentUserRole,
        requestType,
      },
    });

    res.json({
      success: true,
      message: `Your ${requestType} request has been submitted. You will be notified when it's processed.`,
      request,
    });
  } catch (error) {
    console.error("[Privacy] Request data action error:", error);
    res.status(500).json({ error: "Failed to submit data request" });
  }
});

// ===================================================
// DASHBOARD STATS (Admin Only)
// ===================================================

router.get("/stats", adminOnly, async (req: AuthRequest, res) => {
  try {
    const [
      totalPolicies,
      activePolicy,
      pendingRequests,
      processingRequests,
      completedRequests,
      recentConsentLogs,
    ] = await Promise.all([
      prisma.policyVersion.count(),
      prisma.policyVersion.findFirst({ where: { isActive: true } }),
      prisma.privacyDeleteRequest.count({ where: { status: "pending" } }),
      prisma.privacyDeleteRequest.count({ where: { status: "processing" } }),
      prisma.privacyDeleteRequest.count({ where: { status: "completed" } }),
      prisma.consentLog.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    res.json({
      success: true,
      stats: {
        totalPolicies,
        activePolicyVersion: activePolicy?.version || null,
        dataRequests: {
          pending: pendingRequests,
          processing: processingRequests,
          completed: completedRequests,
        },
        recentConsentChanges: recentConsentLogs,
      },
    });
  } catch (error) {
    console.error("[Privacy] Get stats error:", error);
    res.status(500).json({ error: "Failed to get privacy stats" });
  }
});

export default router;
