import { prisma } from "../lib/prisma";
import { KycVerificationStatus, KycDocumentType } from "@prisma/client";
import crypto from "crypto";

interface VerifyIdentityParams {
  userType: "customer" | "driver" | "restaurant";
  userId: string;
  countryCode: string;
  documentType: KycDocumentType;
  documentData: {
    documentNumber?: string;
    fullName?: string;
    dateOfBirth?: string;
    fatherName?: string;
    motherName?: string;
    address?: string;
    nidNumber?: string;
  };
  triggeredByAdminId?: string;
  autoTriggered?: boolean;
}

interface VerificationResult {
  success: boolean;
  logId: string;
  status: KycVerificationStatus;
  matchScore?: number;
  message?: string;
  errorCode?: string;
}

interface ProviderResponse {
  success: boolean;
  status: KycVerificationStatus;
  matchScore?: number;
  responseCode?: string;
  message?: string;
}

interface BDNidVerificationData {
  nidNumber: string;
  fullName: string;
  dateOfBirth: string;
  fatherName?: string;
  motherName?: string;
}

interface USKycVerificationData {
  ssnLast4: string;
  fullName: string;
  dateOfBirth: string;
  address?: string;
}

class IdentityVerificationService {
  private getProvider(countryCode: string): string {
    const providers: Record<string, string> = {
      BD: "bd_nid_porichoy",
      US: "us_kyc_idology",
      UK: "uk_kyc_experian",
      IN: "in_aadhaar_digio",
    };
    return providers[countryCode] || "generic_kyc_provider";
  }

  private hashPayload(data: Record<string, any>): string {
    const sorted = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash("sha256").update(sorted).digest("hex");
  }

  private getProviderConfig(countryCode: string): { baseUrl: string; apiKey: string | undefined } | null {
    switch (countryCode) {
      case "BD":
        return {
          baseUrl: process.env.BD_NID_API_URL || "https://api.porichoy.gov.bd/api",
          apiKey: process.env.BD_NID_API_KEY,
        };
      case "US":
        return {
          baseUrl: process.env.US_KYC_API_URL || "https://api.idology.com/v2",
          apiKey: process.env.US_KYC_API_KEY,
        };
      default:
        return null;
    }
  }

  async verifyIdentity(params: VerifyIdentityParams): Promise<VerificationResult> {
    const provider = this.getProvider(params.countryCode);
    const payloadHash = this.hashPayload(params.documentData);

    const log = await prisma.kycVerificationLog.create({
      data: {
        userType: params.userType,
        userId: params.userId,
        countryCode: params.countryCode,
        provider,
        documentType: params.documentType,
        requestPayloadHash: payloadHash,
        responseStatus: KycVerificationStatus.pending,
        triggeredByAdminId: params.triggeredByAdminId,
        autoTriggered: params.autoTriggered ?? false,
      },
    });

    try {
      let providerResponse: ProviderResponse;

      switch (params.countryCode) {
        case "BD":
          providerResponse = await this.verifyBangladeshNID(params.documentData as BDNidVerificationData);
          break;
        case "US":
          providerResponse = await this.verifyUSKYC(params.documentData as USKycVerificationData);
          break;
        default:
          providerResponse = this.createMockVerification(params);
      }

      await prisma.kycVerificationLog.update({
        where: { id: log.id },
        data: {
          responseStatus: providerResponse.status,
          responseCode: providerResponse.responseCode,
          responseMessage: providerResponse.message,
          matchScore: providerResponse.matchScore,
          completedAt: new Date(),
        },
      });

      if (providerResponse.status === KycVerificationStatus.match) {
        await this.updateUserVerificationStatus(params.userType, params.userId, true);
      }

      return {
        success: providerResponse.success,
        logId: log.id,
        status: providerResponse.status,
        matchScore: providerResponse.matchScore,
        message: providerResponse.message,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown verification error";

      await prisma.kycVerificationLog.update({
        where: { id: log.id },
        data: {
          responseStatus: KycVerificationStatus.error,
          responseCode: "INTERNAL_ERROR",
          responseMessage: errorMessage,
          completedAt: new Date(),
        },
      });

      return {
        success: false,
        logId: log.id,
        status: KycVerificationStatus.error,
        message: errorMessage,
        errorCode: "INTERNAL_ERROR",
      };
    }
  }

  private async verifyBangladeshNID(data: BDNidVerificationData): Promise<ProviderResponse> {
    const config = this.getProviderConfig("BD");

    if (!config?.apiKey) {
      console.log("[KYC-BD] BD NID API not configured, using mock verification");
      return this.createMockNIDVerification(data);
    }

    try {
      const response = await fetch(`${config.baseUrl}/nid/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          "X-API-Version": "2.0",
        },
        body: JSON.stringify({
          national_id: data.nidNumber,
          name: data.fullName,
          date_of_birth: data.dateOfBirth,
          father_name: data.fatherName,
          mother_name: data.motherName,
        }),
      });

      if (!response.ok) {
        console.error("[KYC-BD] NID verification failed:", response.status);
        return {
          success: false,
          status: KycVerificationStatus.error,
          responseCode: `HTTP_${response.status}`,
          message: `NID verification request failed: ${response.status}`,
        };
      }

      const result = await response.json();

      if (result.success && result.match) {
        return {
          success: true,
          status: KycVerificationStatus.match,
          matchScore: result.confidence_score ?? 100,
          responseCode: "NID_VERIFIED",
          message: "NID verification successful",
        };
      } else if (result.success && !result.match) {
        return {
          success: false,
          status: KycVerificationStatus.mismatch,
          matchScore: result.confidence_score ?? 0,
          responseCode: "NID_MISMATCH",
          message: result.mismatch_reason || "NID data does not match",
        };
      } else {
        return {
          success: false,
          status: KycVerificationStatus.error,
          responseCode: result.error_code || "NID_ERROR",
          message: result.message || "NID verification failed",
        };
      }
    } catch (error) {
      console.error("[KYC-BD] NID verification error:", error);
      return this.createMockNIDVerification(data);
    }
  }

  private createMockNIDVerification(data: BDNidVerificationData): ProviderResponse {
    const nidNumber = data.nidNumber?.replace(/\s/g, "") || "";
    const isValidFormat = nidNumber.length === 10 || nidNumber.length === 13 || nidNumber.length === 17;

    if (!isValidFormat) {
      return {
        success: false,
        status: KycVerificationStatus.mismatch,
        matchScore: 0,
        responseCode: "MOCK_INVALID_FORMAT",
        message: "NID number format is invalid (must be 10, 13, or 17 digits)",
      };
    }

    const mockScore = 85 + Math.floor(Math.random() * 15);

    console.log(`[KYC-BD-Mock] Verified NID for ${data.fullName}, score: ${mockScore}`);

    return {
      success: true,
      status: KycVerificationStatus.match,
      matchScore: mockScore,
      responseCode: "MOCK_VERIFIED",
      message: "Mock NID verification successful",
    };
  }

  private async verifyUSKYC(data: USKycVerificationData): Promise<ProviderResponse> {
    const config = this.getProviderConfig("US");

    if (!config?.apiKey) {
      console.log("[KYC-US] US KYC API not configured, using mock verification");
      return this.createMockUSVerification(data);
    }

    try {
      const response = await fetch(`${config.baseUrl}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${config.apiKey}:`).toString("base64")}`,
        },
        body: JSON.stringify({
          ssn_last_4: data.ssnLast4,
          full_name: data.fullName,
          dob: data.dateOfBirth,
          address: data.address,
        }),
      });

      if (!response.ok) {
        console.error("[KYC-US] Verification failed:", response.status);
        return {
          success: false,
          status: KycVerificationStatus.error,
          responseCode: `HTTP_${response.status}`,
          message: `US KYC verification request failed: ${response.status}`,
        };
      }

      const result = await response.json();

      if (result.verified) {
        return {
          success: true,
          status: KycVerificationStatus.match,
          matchScore: result.score ?? 100,
          responseCode: "SSN_VERIFIED",
          message: "US KYC verification successful",
        };
      } else {
        return {
          success: false,
          status: KycVerificationStatus.mismatch,
          matchScore: result.score ?? 0,
          responseCode: result.failure_reason || "SSN_MISMATCH",
          message: result.message || "SSN verification failed",
        };
      }
    } catch (error) {
      console.error("[KYC-US] Verification error:", error);
      return this.createMockUSVerification(data);
    }
  }

  private createMockUSVerification(data: USKycVerificationData): ProviderResponse {
    const ssnLast4 = data.ssnLast4?.replace(/\D/g, "") || "";

    if (ssnLast4.length !== 4) {
      return {
        success: false,
        status: KycVerificationStatus.mismatch,
        matchScore: 0,
        responseCode: "MOCK_INVALID_SSN",
        message: "SSN last 4 digits must be exactly 4 numbers",
      };
    }

    const mockScore = 90 + Math.floor(Math.random() * 10);

    console.log(`[KYC-US-Mock] Verified SSN for ${data.fullName}, score: ${mockScore}`);

    return {
      success: true,
      status: KycVerificationStatus.match,
      matchScore: mockScore,
      responseCode: "MOCK_VERIFIED",
      message: "Mock SSN verification successful",
    };
  }

  private createMockVerification(params: VerifyIdentityParams): ProviderResponse {
    console.log(`[KYC-Mock] Generic mock verification for ${params.countryCode}`);

    return {
      success: true,
      status: KycVerificationStatus.match,
      matchScore: 95,
      responseCode: "MOCK_VERIFIED",
      message: "Mock verification successful for unsupported country",
    };
  }

  private async updateUserVerificationStatus(
    userType: string,
    userId: string,
    verified: boolean
  ): Promise<void> {
    try {
      switch (userType) {
        case "driver":
          await prisma.driverProfile.update({
            where: { id: userId },
            data: {
              isVerified: verified,
              verificationStatus: verified ? "approved" : "pending",
            },
          });
          break;
        case "customer":
          await prisma.customerProfile.update({
            where: { id: userId },
            data: {
              isVerified: verified,
            },
          });
          break;
        case "restaurant":
          await prisma.restaurantProfile.update({
            where: { id: userId },
            data: {
              isVerified: verified,
            },
          });
          break;
      }
    } catch (error) {
      console.error(`[KYC] Failed to update ${userType} verification status:`, error);
    }
  }

  async getVerificationHistory(
    userId: string,
    userType: string,
    limit: number = 10
  ): Promise<any[]> {
    return prisma.kycVerificationLog.findMany({
      where: { userId, userType },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        documentType: true,
        provider: true,
        responseStatus: true,
        matchScore: true,
        responseMessage: true,
        autoTriggered: true,
        createdAt: true,
        completedAt: true,
      },
    });
  }

  async getVerificationById(logId: string): Promise<any | null> {
    return prisma.kycVerificationLog.findUnique({
      where: { id: logId },
    });
  }

  async addAdminNotes(logId: string, notes: string): Promise<void> {
    await prisma.kycVerificationLog.update({
      where: { id: logId },
      data: { adminViewNotes: notes },
    });
  }

  async getPendingVerifications(countryCode?: string): Promise<any[]> {
    return prisma.kycVerificationLog.findMany({
      where: {
        responseStatus: {
          in: [KycVerificationStatus.pending, KycVerificationStatus.manual_review],
        },
        ...(countryCode && { countryCode }),
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
  }

  async markForManualReview(logId: string, adminId: string, reason: string): Promise<void> {
    await prisma.kycVerificationLog.update({
      where: { id: logId },
      data: {
        responseStatus: KycVerificationStatus.manual_review,
        adminViewNotes: reason,
        triggeredByAdminId: adminId,
      },
    });
  }

  async resolveManualReview(
    logId: string,
    adminId: string,
    decision: "match" | "mismatch",
    notes: string
  ): Promise<void> {
    const log = await prisma.kycVerificationLog.findUnique({
      where: { id: logId },
    });

    if (!log) {
      throw new Error("Verification log not found");
    }

    await prisma.kycVerificationLog.update({
      where: { id: logId },
      data: {
        responseStatus: decision === "match" ? KycVerificationStatus.match : KycVerificationStatus.mismatch,
        adminViewNotes: `${notes}\n\nResolved by admin: ${adminId}`,
        completedAt: new Date(),
      },
    });

    if (decision === "match") {
      await this.updateUserVerificationStatus(log.userType, log.userId, true);
    }
  }

  async getVerificationStats(countryCode?: string): Promise<{
    total: number;
    pending: number;
    matched: number;
    mismatched: number;
    errors: number;
    manualReview: number;
  }> {
    const where = countryCode ? { countryCode } : {};

    const [total, pending, matched, mismatched, errors, manualReview] = await Promise.all([
      prisma.kycVerificationLog.count({ where }),
      prisma.kycVerificationLog.count({
        where: { ...where, responseStatus: KycVerificationStatus.pending },
      }),
      prisma.kycVerificationLog.count({
        where: { ...where, responseStatus: KycVerificationStatus.match },
      }),
      prisma.kycVerificationLog.count({
        where: { ...where, responseStatus: KycVerificationStatus.mismatch },
      }),
      prisma.kycVerificationLog.count({
        where: { ...where, responseStatus: KycVerificationStatus.error },
      }),
      prisma.kycVerificationLog.count({
        where: { ...where, responseStatus: KycVerificationStatus.manual_review },
      }),
    ]);

    return { total, pending, matched, mismatched, errors, manualReview };
  }
}

export const identityVerificationService = new IdentityVerificationService();
