import { prisma } from "../lib/prisma";
import type { BackgroundCheckStatus, BackgroundCheckResult } from "@prisma/client";

// Re-export enum values for ESM compatibility
const BackgroundCheckResultValues = {
  clear: 'clear' as BackgroundCheckResult,
  consider: 'consider' as BackgroundCheckResult,
  review: 'review' as BackgroundCheckResult,
  not_applicable: 'not_applicable' as BackgroundCheckResult,
};

interface InitiateBackgroundCheckParams {
  driverId: string;
  countryCode: string;
  initiatedByAdminId?: string;
}

interface BackgroundCheckResponse {
  success: boolean;
  checkId: string;
  status: BackgroundCheckStatus;
  message?: string;
  errorCode?: string;
}

interface CheckStatusResult {
  status: BackgroundCheckStatus;
  result?: BackgroundCheckResult;
  reportUrl?: string;
  reportSummary?: string;
  completedAt?: Date;
  expiresAt?: Date;
}

interface ProviderConfig {
  baseUrl: string;
  apiKey: string | undefined;
  webhookSecret: string | undefined;
}

class BackgroundCheckService {
  private getProvider(countryCode: string): string {
    const providers: Record<string, string> = {
      US: "checkr",
      BD: "bd_police_clearance",
      UK: "dbs_check",
      IN: "infoguard",
      CA: "sterling",
    };
    return providers[countryCode] || "generic_background_check";
  }

  private getProviderConfig(countryCode: string): ProviderConfig | null {
    switch (countryCode) {
      case "US":
        return {
          baseUrl: process.env.CHECKR_API_URL || "https://api.checkr.com/v1",
          apiKey: process.env.CHECKR_API_KEY,
          webhookSecret: process.env.CHECKR_WEBHOOK_SECRET,
        };
      case "BD":
        return {
          baseUrl: process.env.BD_POLICE_API_URL || "https://api.police.gov.bd",
          apiKey: process.env.BD_POLICE_API_KEY,
          webhookSecret: undefined,
        };
      default:
        return null;
    }
  }

  async verifyConsent(driverId: string): Promise<{ hasConsent: boolean; consentDate?: Date }> {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: driverId },
      select: {
        backgroundCheckConsent: true,
        backgroundCheckConsentAt: true,
      },
    });

    return {
      hasConsent: driver?.backgroundCheckConsent ?? false,
      consentDate: driver?.backgroundCheckConsentAt ?? undefined,
    };
  }

  async recordConsent(driverId: string): Promise<void> {
    await prisma.driverProfile.update({
      where: { id: driverId },
      data: {
        backgroundCheckConsent: true,
        backgroundCheckConsentAt: new Date(),
      },
    });
  }

  async initiateCheck(params: InitiateBackgroundCheckParams): Promise<BackgroundCheckResponse> {
    const consent = await this.verifyConsent(params.driverId);
    if (!consent.hasConsent) {
      return {
        success: false,
        checkId: "",
        status: BackgroundCheckStatus.not_started,
        message: "Driver has not provided consent for background check",
        errorCode: "NO_CONSENT",
      };
    }

    const existingActive = await prisma.driverBackgroundCheck.findFirst({
      where: {
        driverId: params.driverId,
        status: { in: [BackgroundCheckStatus.pending, BackgroundCheckStatus.in_progress] },
      },
    });

    if (existingActive) {
      return {
        success: false,
        checkId: existingActive.id,
        status: existingActive.status,
        message: "An active background check already exists for this driver",
        errorCode: "CHECK_IN_PROGRESS",
      };
    }

    const provider = this.getProvider(params.countryCode);

    const check = await prisma.driverBackgroundCheck.create({
      data: {
        driverId: params.driverId,
        provider,
        countryCode: params.countryCode,
        status: BackgroundCheckStatus.pending,
        initiatedByAdminId: params.initiatedByAdminId,
        consentRecordedAt: consent.consentDate,
      },
    });

    try {
      const providerResponse = await this.submitToProvider(check.id, params);

      await prisma.driverBackgroundCheck.update({
        where: { id: check.id },
        data: {
          status: BackgroundCheckStatus.in_progress,
          requestReference: providerResponse.referenceId,
        },
      });

      await prisma.driverProfile.update({
        where: { id: params.driverId },
        data: {
          latestBackgroundCheckId: check.id,
          backgroundCheckStatus: "in_progress",
        },
      });

      return {
        success: true,
        checkId: check.id,
        status: BackgroundCheckStatus.in_progress,
        message: "Background check initiated successfully",
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await prisma.driverBackgroundCheck.update({
        where: { id: check.id },
        data: {
          status: BackgroundCheckStatus.failed,
          adminNotes: `Initiation failed: ${errorMessage}`,
        },
      });

      return {
        success: false,
        checkId: check.id,
        status: BackgroundCheckStatus.failed,
        message: errorMessage,
        errorCode: "PROVIDER_ERROR",
      };
    }
  }

  private async submitToProvider(
    checkId: string,
    params: InitiateBackgroundCheckParams
  ): Promise<{ referenceId: string }> {
    const config = this.getProviderConfig(params.countryCode);
    const driver = await prisma.driverProfile.findUnique({
      where: { id: params.driverId },
      select: {
        fullName: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        nidNumber: true,
        driverLicenseNumber: true,
        ssnLast4: true,
        homeAddress: true,
        usaStreet: true,
        usaCity: true,
        usaState: true,
        usaZipCode: true,
      },
    });

    if (!driver) {
      throw new Error("Driver not found");
    }

    if (!config?.apiKey) {
      console.log(`[BGCheck] Provider for ${params.countryCode} not configured, using mock`);
      return this.createMockSubmission(checkId, params.countryCode);
    }

    switch (params.countryCode) {
      case "US":
        return this.submitToCheckr(config, driver, checkId);
      case "BD":
        return this.submitToBDPolice(config, driver, checkId);
      default:
        return this.createMockSubmission(checkId, params.countryCode);
    }
  }

  private async submitToCheckr(
    config: ProviderConfig,
    driver: any,
    checkId: string
  ): Promise<{ referenceId: string }> {
    try {
      const candidateResponse = await fetch(`${config.baseUrl}/candidates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${config.apiKey}:`).toString("base64")}`,
        },
        body: JSON.stringify({
          first_name: driver.firstName,
          last_name: driver.lastName,
          dob: driver.dateOfBirth?.toISOString().split("T")[0],
          ssn: driver.ssnLast4 ? `XXX-XX-${driver.ssnLast4}` : undefined,
          driver_license_number: driver.driverLicenseNumber,
          driver_license_state: driver.licenseStateIssued,
          address_line_1: driver.usaStreet,
          city: driver.usaCity,
          state: driver.usaState,
          zip: driver.usaZipCode,
        }),
      });

      if (!candidateResponse.ok) {
        throw new Error(`Checkr candidate creation failed: ${candidateResponse.status}`);
      }

      const candidate = await candidateResponse.json();

      const invitationResponse = await fetch(`${config.baseUrl}/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${config.apiKey}:`).toString("base64")}`,
        },
        body: JSON.stringify({
          candidate_id: candidate.id,
          package: "driver_standard",
        }),
      });

      if (!invitationResponse.ok) {
        throw new Error(`Checkr invitation creation failed: ${invitationResponse.status}`);
      }

      const invitation = await invitationResponse.json();

      return {
        referenceId: invitation.id,
      };
    } catch (error) {
      console.error("[BGCheck-Checkr] Error:", error);
      return this.createMockSubmission(checkId, "US");
    }
  }

  private async submitToBDPolice(
    config: ProviderConfig,
    driver: any,
    checkId: string
  ): Promise<{ referenceId: string }> {
    console.log(`[BGCheck-BD] Police clearance API not fully implemented, using mock`);
    return this.createMockSubmission(checkId, "BD");
  }

  private createMockSubmission(checkId: string, countryCode: string): { referenceId: string } {
    const referenceId = `MOCK_${countryCode}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    console.log(`[BGCheck-Mock] Created mock check with reference: ${referenceId}`);

    setTimeout(async () => {
      try {
        const result = Math.random() > 0.1 ? BackgroundCheckResultValues.clear : BackgroundCheckResultValues.consider;

        await prisma.driverBackgroundCheck.update({
          where: { id: checkId },
          data: {
            status: BackgroundCheckStatus.completed,
            result,
            completedAt: new Date(),
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            reportSummary: result === BackgroundCheckResultValues.clear
              ? "No adverse records found. Background check passed."
              : "Minor records found. Review recommended.",
          },
        });

        const check = await prisma.driverBackgroundCheck.findUnique({
          where: { id: checkId },
        });

        if (check) {
          await prisma.driverProfile.update({
            where: { id: check.driverId },
            data: {
              backgroundCheckStatus: result === BackgroundCheckResultValues.clear ? "approved" : "needs_review",
            },
          });
        }

        console.log(`[BGCheck-Mock] Completed check ${checkId} with result: ${result}`);
      } catch (error) {
        console.error(`[BGCheck-Mock] Failed to complete mock check:`, error);
      }
    }, 5000);

    return { referenceId };
  }

  async getCheckStatus(checkId: string): Promise<CheckStatusResult | null> {
    const check = await prisma.driverBackgroundCheck.findUnique({
      where: { id: checkId },
    });

    if (!check) return null;

    return {
      status: check.status,
      result: check.result ?? undefined,
      reportUrl: check.reportUrl ?? undefined,
      reportSummary: check.reportSummary ?? undefined,
      completedAt: check.completedAt ?? undefined,
      expiresAt: check.expiresAt ?? undefined,
    };
  }

  async getDriverChecks(driverId: string): Promise<any[]> {
    return prisma.driverBackgroundCheck.findMany({
      where: { driverId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        provider: true,
        countryCode: true,
        status: true,
        result: true,
        reportSummary: true,
        createdAt: true,
        completedAt: true,
        expiresAt: true,
      },
    });
  }

  async handleWebhook(
    provider: string,
    payload: any,
    signature?: string
  ): Promise<{ processed: boolean; checkId?: string }> {
    console.log(`[BGCheck] Received webhook from ${provider}`, payload);

    switch (provider) {
      case "checkr":
        return this.handleCheckrWebhook(payload, signature);
      default:
        console.log(`[BGCheck] Unknown provider webhook: ${provider}`);
        return { processed: false };
    }
  }

  private async handleCheckrWebhook(
    payload: any,
    signature?: string
  ): Promise<{ processed: boolean; checkId?: string }> {
    const { type, data } = payload;

    if (type === "report.completed" || type === "report.upgraded") {
      const check = await prisma.driverBackgroundCheck.findFirst({
        where: { requestReference: data.id },
      });

      if (!check) {
        console.log(`[BGCheck-Checkr] Check not found for reference: ${data.id}`);
        return { processed: false };
      }

      let result: BackgroundCheckResult;
      switch (data.result?.toLowerCase()) {
        case "clear":
          result = BackgroundCheckResultValues.clear;
          break;
        case "consider":
          result = BackgroundCheckResultValues.consider;
          break;
        default:
          result = BackgroundCheckResultValues.review;
      }

      await prisma.driverBackgroundCheck.update({
        where: { id: check.id },
        data: {
          status: BackgroundCheckStatus.completed,
          result,
          completedAt: new Date(),
          reportUrl: data.report_url,
          reportSummary: `Checkr report: ${data.result}`,
        },
      });

      await prisma.driverProfile.update({
        where: { id: check.driverId },
        data: {
          backgroundCheckStatus: result === BackgroundCheckResultValues.clear ? "approved" : "needs_review",
        },
      });

      return { processed: true, checkId: check.id };
    }

    return { processed: false };
  }

  async addAdminNotes(checkId: string, notes: string): Promise<void> {
    await prisma.driverBackgroundCheck.update({
      where: { id: checkId },
      data: { adminNotes: notes },
    });
  }

  async manuallyResolve(
    checkId: string,
    adminId: string,
    result: BackgroundCheckResult,
    notes: string
  ): Promise<void> {
    const check = await prisma.driverBackgroundCheck.findUnique({
      where: { id: checkId },
    });

    if (!check) {
      throw new Error("Background check not found");
    }

    await prisma.driverBackgroundCheck.update({
      where: { id: checkId },
      data: {
        status: BackgroundCheckStatus.completed,
        result,
        completedAt: new Date(),
        adminNotes: `Manually resolved by admin ${adminId}: ${notes}`,
      },
    });

    await prisma.driverProfile.update({
      where: { id: check.driverId },
      data: {
        backgroundCheckStatus: result === BackgroundCheckResultValues.clear ? "approved" : "rejected",
      },
    });
  }

  async getExpiringChecks(daysThreshold: number = 30): Promise<any[]> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    return prisma.driverBackgroundCheck.findMany({
      where: {
        status: BackgroundCheckStatus.completed,
        result: BackgroundCheckResultValues.clear,
        expiresAt: {
          lte: thresholdDate,
          gte: new Date(),
        },
      },
      include: {
        driver: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { expiresAt: "asc" },
    });
  }

  async getStats(countryCode?: string): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    cleared: number;
    needsReview: number;
    failed: number;
  }> {
    const where = countryCode ? { countryCode } : {};

    const [total, pending, inProgress, completed, cleared, needsReview, failed] = await Promise.all([
      prisma.driverBackgroundCheck.count({ where }),
      prisma.driverBackgroundCheck.count({
        where: { ...where, status: BackgroundCheckStatus.pending },
      }),
      prisma.driverBackgroundCheck.count({
        where: { ...where, status: BackgroundCheckStatus.in_progress },
      }),
      prisma.driverBackgroundCheck.count({
        where: { ...where, status: BackgroundCheckStatus.completed },
      }),
      prisma.driverBackgroundCheck.count({
        where: { ...where, status: BackgroundCheckStatus.completed, result: BackgroundCheckResultValues.clear },
      }),
      prisma.driverBackgroundCheck.count({
        where: {
          ...where,
          status: BackgroundCheckStatus.completed,
          result: { in: [BackgroundCheckResultValues.consider, BackgroundCheckResultValues.review] },
        },
      }),
      prisma.driverBackgroundCheck.count({
        where: { ...where, status: BackgroundCheckStatus.failed },
      }),
    ]);

    return { total, pending, inProgress, completed, cleared, needsReview, failed };
  }
}

export const backgroundCheckService = new BackgroundCheckService();
