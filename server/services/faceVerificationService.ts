import { prisma } from "../lib/prisma";
import { FaceMatchStatus, KycDocumentType } from "@prisma/client";
import crypto from "crypto";

interface InitiateFaceVerificationParams {
  userType: "customer" | "driver";
  userId: string;
  countryCode: string;
  documentType: KycDocumentType;
  idPhotoRef?: string;
  selfieRef?: string;
  livenessRequired?: boolean;
}

interface FaceVerificationResult {
  success: boolean;
  sessionId: string;
  status: FaceMatchStatus;
  matchScore?: number;
  livenessScore?: number;
  decision?: string;
  message?: string;
  errorCode?: string;
}

interface ProviderConfig {
  baseUrl: string;
  apiKey: string | undefined;
}

interface LivenessCheckResult {
  passed: boolean;
  score: number;
  checks: string[];
}

class FaceVerificationService {
  private getProvider(countryCode: string): string {
    const providers: Record<string, string> = {
      US: "aws_rekognition",
      BD: "faceverify_bd",
      UK: "iproov",
      default: "generic_face_match",
    };
    return providers[countryCode] || providers.default;
  }

  private getProviderConfig(countryCode: string): ProviderConfig | null {
    switch (countryCode) {
      case "US":
        return {
          baseUrl: process.env.AWS_REKOGNITION_ENDPOINT || "https://rekognition.us-east-1.amazonaws.com",
          apiKey: process.env.AWS_ACCESS_KEY_ID,
        };
      case "BD":
        return {
          baseUrl: process.env.BD_FACE_API_URL || "https://api.faceverify.bd",
          apiKey: process.env.BD_FACE_API_KEY,
        };
      default:
        return null;
    }
  }

  async initiateVerification(params: InitiateFaceVerificationParams): Promise<FaceVerificationResult> {
    const provider = this.getProvider(params.countryCode);
    const livenessRequired = params.livenessRequired ?? true;

    const session = await prisma.faceVerificationSession.create({
      data: {
        userType: params.userType,
        userId: params.userId,
        countryCode: params.countryCode,
        documentType: params.documentType,
        idPhotoRef: params.idPhotoRef,
        selfieRef: params.selfieRef,
        provider,
        status: FaceMatchStatus.pending,
        livenessRequired,
      },
    });

    try {
      const result = await this.processVerification(session.id, params);

      await prisma.faceVerificationSession.update({
        where: { id: session.id },
        data: {
          status: result.status,
          matchScore: result.matchScore,
          livenessScore: result.livenessScore,
          livenessPassed: result.livenessPassed,
          decision: result.decision,
          completedAt: result.status !== FaceMatchStatus.pending ? new Date() : undefined,
        },
      });

      if (result.status === FaceMatchStatus.match) {
        await this.updateUserFaceVerification(params.userType, params.userId, true);
      }

      return {
        success: result.status === FaceMatchStatus.match,
        sessionId: session.id,
        status: result.status,
        matchScore: result.matchScore,
        livenessScore: result.livenessScore,
        decision: result.decision,
        message: result.message,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown verification error";

      await prisma.faceVerificationSession.update({
        where: { id: session.id },
        data: {
          status: FaceMatchStatus.failed,
          metadata: { error: errorMessage },
          completedAt: new Date(),
        },
      });

      return {
        success: false,
        sessionId: session.id,
        status: FaceMatchStatus.failed,
        message: errorMessage,
        errorCode: "VERIFICATION_ERROR",
      };
    }
  }

  private async processVerification(
    sessionId: string,
    params: InitiateFaceVerificationParams
  ): Promise<{
    status: FaceMatchStatus;
    matchScore?: number;
    livenessScore?: number;
    livenessPassed?: boolean;
    decision?: string;
    message?: string;
  }> {
    const config = this.getProviderConfig(params.countryCode);

    if (!config?.apiKey) {
      console.log(`[FaceVerify] Provider for ${params.countryCode} not configured, using mock`);
      return this.processMockVerification(params);
    }

    switch (params.countryCode) {
      case "US":
        return this.processAWSRekognition(config, params);
      case "BD":
        return this.processBDFaceVerify(config, params);
      default:
        return this.processMockVerification(params);
    }
  }

  private async processAWSRekognition(
    config: ProviderConfig,
    params: InitiateFaceVerificationParams
  ): Promise<{
    status: FaceMatchStatus;
    matchScore?: number;
    livenessScore?: number;
    livenessPassed?: boolean;
    decision?: string;
    message?: string;
  }> {
    console.log("[FaceVerify-AWS] Processing with AWS Rekognition (mock in demo)");
    return this.processMockVerification(params);
  }

  private async processBDFaceVerify(
    config: ProviderConfig,
    params: InitiateFaceVerificationParams
  ): Promise<{
    status: FaceMatchStatus;
    matchScore?: number;
    livenessScore?: number;
    livenessPassed?: boolean;
    decision?: string;
    message?: string;
  }> {
    console.log("[FaceVerify-BD] Processing with BD Face API (mock in demo)");
    return this.processMockVerification(params);
  }

  private processMockVerification(params: InitiateFaceVerificationParams): {
    status: FaceMatchStatus;
    matchScore?: number;
    livenessScore?: number;
    livenessPassed?: boolean;
    decision?: string;
    message?: string;
  } {
    const matchScore = 75 + Math.floor(Math.random() * 25);
    const livenessScore = params.livenessRequired ? 80 + Math.floor(Math.random() * 20) : undefined;
    const livenessPassed = livenessScore ? livenessScore >= 70 : undefined;

    let status: FaceMatchStatus;
    let decision: string;
    let message: string;

    if (matchScore >= 85) {
      if (!params.livenessRequired || livenessPassed) {
        status = FaceMatchStatus.match;
        decision = "match";
        message = "Face verification successful";
      } else {
        status = FaceMatchStatus.liveness_failed;
        decision = "liveness_failed";
        message = "Face matched but liveness check failed";
      }
    } else if (matchScore >= 70) {
      status = FaceMatchStatus.inconclusive;
      decision = "inconclusive";
      message = "Face match inconclusive, manual review recommended";
    } else {
      status = FaceMatchStatus.mismatch;
      decision = "mismatch";
      message = "Face does not match ID photo";
    }

    console.log(`[FaceVerify-Mock] Result: ${decision}, match: ${matchScore}%, liveness: ${livenessScore}%`);

    return {
      status,
      matchScore,
      livenessScore,
      livenessPassed,
      decision,
      message,
    };
  }

  private async updateUserFaceVerification(
    userType: string,
    userId: string,
    verified: boolean
  ): Promise<void> {
    try {
      if (userType === "driver") {
        await prisma.driverProfile.update({
          where: { id: userId },
          data: {
            faceVerificationCompleted: verified,
            faceVerificationCompletedAt: verified ? new Date() : null,
          },
        });
      }
    } catch (error) {
      console.error(`[FaceVerify] Failed to update ${userType} face verification:`, error);
    }
  }

  async getSession(sessionId: string): Promise<any | null> {
    return prisma.faceVerificationSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userType: true,
        userId: true,
        countryCode: true,
        documentType: true,
        provider: true,
        status: true,
        matchScore: true,
        livenessScore: true,
        livenessPassed: true,
        decision: true,
        createdAt: true,
        completedAt: true,
      },
    });
  }

  async getUserSessions(userId: string, userType: string): Promise<any[]> {
    return prisma.faceVerificationSession.findMany({
      where: { userId, userType },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        documentType: true,
        status: true,
        matchScore: true,
        livenessScore: true,
        decision: true,
        createdAt: true,
        completedAt: true,
      },
    });
  }

  async adminReview(
    sessionId: string,
    adminId: string,
    decision: "match" | "mismatch",
    notes: string
  ): Promise<void> {
    const session = await prisma.faceVerificationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error("Session not found");
    }

    const newStatus = decision === "match" ? FaceMatchStatus.match : FaceMatchStatus.mismatch;

    await prisma.faceVerificationSession.update({
      where: { id: sessionId },
      data: {
        status: newStatus,
        decision,
        reviewedByAdminId: adminId,
        adminNotes: notes,
        completedAt: new Date(),
      },
    });

    if (decision === "match") {
      await this.updateUserFaceVerification(session.userType, session.userId, true);
    }
  }

  async getPendingSessions(countryCode?: string): Promise<any[]> {
    return prisma.faceVerificationSession.findMany({
      where: {
        status: { in: [FaceMatchStatus.pending, FaceMatchStatus.inconclusive] },
        ...(countryCode && { countryCode }),
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
  }

  async requestNewSelfie(sessionId: string, adminId: string, reason: string): Promise<void> {
    await prisma.faceVerificationSession.update({
      where: { id: sessionId },
      data: {
        status: FaceMatchStatus.pending,
        selfieRef: null,
        adminNotes: `New selfie requested by admin ${adminId}: ${reason}`,
        metadata: {
          reselfieRequested: true,
          reselfieReason: reason,
          reselfieRequestedAt: new Date().toISOString(),
        },
      },
    });
  }

  async submitSelfie(
    sessionId: string,
    selfieRef: string
  ): Promise<FaceVerificationResult> {
    const session = await prisma.faceVerificationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return {
        success: false,
        sessionId,
        status: FaceMatchStatus.failed,
        message: "Session not found",
        errorCode: "SESSION_NOT_FOUND",
      };
    }

    await prisma.faceVerificationSession.update({
      where: { id: sessionId },
      data: {
        selfieRef,
        status: FaceMatchStatus.pending,
      },
    });

    return this.processVerificationForSession(sessionId);
  }

  private async processVerificationForSession(sessionId: string): Promise<FaceVerificationResult> {
    const session = await prisma.faceVerificationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return {
        success: false,
        sessionId,
        status: FaceMatchStatus.failed,
        message: "Session not found",
        errorCode: "SESSION_NOT_FOUND",
      };
    }

    const result = await this.processVerification(sessionId, {
      userType: session.userType as "customer" | "driver",
      userId: session.userId,
      countryCode: session.countryCode,
      documentType: session.documentType,
      idPhotoRef: session.idPhotoRef ?? undefined,
      selfieRef: session.selfieRef ?? undefined,
      livenessRequired: session.livenessRequired,
    });

    await prisma.faceVerificationSession.update({
      where: { id: sessionId },
      data: {
        status: result.status,
        matchScore: result.matchScore,
        livenessScore: result.livenessScore,
        livenessPassed: result.livenessPassed,
        decision: result.decision,
        completedAt: result.status !== FaceMatchStatus.pending ? new Date() : undefined,
      },
    });

    if (result.status === FaceMatchStatus.match) {
      await this.updateUserFaceVerification(session.userType, session.userId, true);
    }

    return {
      success: result.status === FaceMatchStatus.match,
      sessionId,
      status: result.status,
      matchScore: result.matchScore,
      livenessScore: result.livenessScore,
      decision: result.decision,
      message: result.message,
    };
  }

  async getStats(countryCode?: string): Promise<{
    total: number;
    pending: number;
    matched: number;
    mismatched: number;
    inconclusive: number;
    failed: number;
  }> {
    const where = countryCode ? { countryCode } : {};

    const [total, pending, matched, mismatched, inconclusive, failed] = await Promise.all([
      prisma.faceVerificationSession.count({ where }),
      prisma.faceVerificationSession.count({
        where: { ...where, status: FaceMatchStatus.pending },
      }),
      prisma.faceVerificationSession.count({
        where: { ...where, status: FaceMatchStatus.match },
      }),
      prisma.faceVerificationSession.count({
        where: { ...where, status: FaceMatchStatus.mismatch },
      }),
      prisma.faceVerificationSession.count({
        where: { ...where, status: FaceMatchStatus.inconclusive },
      }),
      prisma.faceVerificationSession.count({
        where: { ...where, status: FaceMatchStatus.failed },
      }),
    ]);

    return { total, pending, matched, mismatched, inconclusive, failed };
  }

  async requireFaceVerification(driverId: string): Promise<void> {
    await prisma.driverProfile.update({
      where: { id: driverId },
      data: {
        faceVerificationRequired: true,
        faceVerificationCompleted: false,
        faceVerificationCompletedAt: null,
      },
    });
  }

  async checkRequirement(driverId: string): Promise<{
    required: boolean;
    completed: boolean;
    completedAt?: Date;
  }> {
    const driver = await prisma.driverProfile.findUnique({
      where: { id: driverId },
      select: {
        faceVerificationRequired: true,
        faceVerificationCompleted: true,
        faceVerificationCompletedAt: true,
      },
    });

    return {
      required: driver?.faceVerificationRequired ?? false,
      completed: driver?.faceVerificationCompleted ?? false,
      completedAt: driver?.faceVerificationCompletedAt ?? undefined,
    };
  }
}

export const faceVerificationService = new FaceVerificationService();
