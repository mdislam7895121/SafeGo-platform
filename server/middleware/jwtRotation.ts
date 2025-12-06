import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "safego-jwt-secret-key";
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const ACCESS_TOKEN_EXPIRY_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

interface TokenPayload {
  userId: string;
  userRole: string;
  email?: string;
  tokenFamily: string;
  tokenVersion: number;
  type: "access" | "refresh";
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateTokenFamily(): string {
  return crypto.randomBytes(16).toString("hex");
}

export async function createTokenPair(
  userId: string,
  userRole: string,
  email?: string,
  deviceInfo?: {
    deviceId?: string;
    deviceFingerprint?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<{ accessToken: string; refreshToken: string; tokenFamily: string }> {
  const tokenFamily = generateTokenFamily();
  const tokenVersion = 1;

  const accessPayload: TokenPayload = {
    userId,
    userRole,
    email,
    tokenFamily,
    tokenVersion,
    type: "access",
  };

  const refreshPayload: TokenPayload = {
    userId,
    userRole,
    email,
    tokenFamily,
    tokenVersion,
    type: "refresh",
  };

  const accessToken = jwt.sign(accessPayload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign(refreshPayload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_EXPIRY_MS);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await prisma.authToken.create({
    data: {
      userId,
      userRole,
      userEmail: email,
      accessTokenHash: hashToken(accessToken),
      refreshTokenHash: hashToken(refreshToken),
      tokenFamily,
      tokenVersion,
      accessExpiresAt,
      refreshExpiresAt,
      deviceId: deviceInfo?.deviceId,
      deviceFingerprint: deviceInfo?.deviceFingerprint,
      ipAddress: deviceInfo?.ipAddress,
      userAgent: deviceInfo?.userAgent,
    },
  });

  console.log(`[JWTRotation] Created token pair for user ${userId}, family: ${tokenFamily}`);

  return { accessToken, refreshToken, tokenFamily };
}

export async function refreshTokenPair(
  refreshToken: string,
  deviceInfo?: {
    deviceId?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as TokenPayload;

    if (decoded.type !== "refresh") {
      console.warn("[JWTRotation] Invalid token type for refresh");
      return null;
    }

    const refreshTokenHash = hashToken(refreshToken);
    const existingToken = await prisma.authToken.findFirst({
      where: {
        refreshTokenHash,
        tokenFamily: decoded.tokenFamily,
        isRevoked: false,
      },
    });

    if (!existingToken) {
      console.warn(`[JWTRotation] Refresh token not found for family ${decoded.tokenFamily}`);

      const reuseAttempt = await prisma.authToken.findFirst({
        where: {
          tokenFamily: decoded.tokenFamily,
          isRevoked: true,
        },
      });

      if (reuseAttempt) {
        console.error(`[JWTRotation] TOKEN REUSE DETECTED for family ${decoded.tokenFamily}`);

        await prisma.authToken.updateMany({
          where: { tokenFamily: decoded.tokenFamily },
          data: {
            reuseDetected: true,
            reuseDetectedAt: new Date(),
          },
        });

        await prisma.authToken.updateMany({
          where: { userId: decoded.userId, isRevoked: false },
          data: {
            isRevoked: true,
            revokedAt: new Date(),
            revokedReason: "Token reuse detected - security breach",
          },
        });

        try {
          await prisma.fraudEvent.create({
            data: {
              userId: decoded.userId,
              userRole: decoded.userRole,
              eventType: "token_reuse",
              severity: "critical",
              description: `Token reuse attack detected. Family: ${decoded.tokenFamily}. All sessions revoked.`,
              status: "pending",
              scoreImpact: 50,
              deviceId: deviceInfo?.deviceId,
              ipAddress: deviceInfo?.ipAddress,
            },
          });
        } catch (e) {
          console.warn("[JWTRotation] Could not create fraud event:", e);
        }

        return null;
      }

      return null;
    }

    if (existingToken.usedAt) {
      console.warn(`[JWTRotation] Refresh token already used at ${existingToken.usedAt}`);
      return null;
    }

    await prisma.authToken.update({
      where: { id: existingToken.id },
      data: {
        usedAt: new Date(),
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: "Token rotated",
      },
    });

    const newTokenVersion = existingToken.tokenVersion + 1;
    const newAccessPayload: TokenPayload = {
      userId: decoded.userId,
      userRole: decoded.userRole,
      email: decoded.email,
      tokenFamily: decoded.tokenFamily,
      tokenVersion: newTokenVersion,
      type: "access",
    };

    const newRefreshPayload: TokenPayload = {
      userId: decoded.userId,
      userRole: decoded.userRole,
      email: decoded.email,
      tokenFamily: decoded.tokenFamily,
      tokenVersion: newTokenVersion,
      type: "refresh",
    };

    const newAccessToken = jwt.sign(newAccessPayload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const newRefreshToken = jwt.sign(newRefreshPayload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

    const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_EXPIRY_MS);
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

    await prisma.authToken.create({
      data: {
        userId: decoded.userId,
        userRole: decoded.userRole,
        userEmail: decoded.email,
        accessTokenHash: hashToken(newAccessToken),
        refreshTokenHash: hashToken(newRefreshToken),
        tokenFamily: decoded.tokenFamily,
        tokenVersion: newTokenVersion,
        accessExpiresAt,
        refreshExpiresAt,
        deviceId: deviceInfo?.deviceId || existingToken.deviceId,
        deviceFingerprint: existingToken.deviceFingerprint,
        ipAddress: deviceInfo?.ipAddress || existingToken.ipAddress,
        userAgent: deviceInfo?.userAgent || existingToken.userAgent,
      },
    });

    console.log(`[JWTRotation] Rotated token pair for user ${decoded.userId}, version: ${newTokenVersion}`);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      console.warn("[JWTRotation] Refresh token expired");
    } else {
      console.error("[JWTRotation] Error refreshing token:", error);
    }
    return null;
  }
}

export async function revokeAllUserTokens(
  userId: string,
  reason: string = "Manual logout"
): Promise<number> {
  const result = await prisma.authToken.updateMany({
    where: {
      userId,
      isRevoked: false,
    },
    data: {
      isRevoked: true,
      revokedAt: new Date(),
      revokedReason: reason,
    },
  });

  console.log(`[JWTRotation] Revoked ${result.count} tokens for user ${userId}: ${reason}`);
  return result.count;
}

export async function revokeTokenFamily(
  tokenFamily: string,
  reason: string = "Family revoked"
): Promise<number> {
  const result = await prisma.authToken.updateMany({
    where: {
      tokenFamily,
      isRevoked: false,
    },
    data: {
      isRevoked: true,
      revokedAt: new Date(),
      revokedReason: reason,
    },
  });

  console.log(`[JWTRotation] Revoked ${result.count} tokens in family ${tokenFamily}: ${reason}`);
  return result.count;
}

export async function validateAccessToken(accessToken: string): Promise<TokenPayload | null> {
  try {
    const decoded = jwt.verify(accessToken, JWT_SECRET) as TokenPayload;

    if (decoded.type !== "access") {
      return null;
    }

    const accessTokenHash = hashToken(accessToken);
    const existingToken = await prisma.authToken.findFirst({
      where: {
        accessTokenHash,
        tokenFamily: decoded.tokenFamily,
        isRevoked: false,
      },
    });

    if (!existingToken) {
      console.warn("[JWTRotation] Access token revoked or not found");
      return null;
    }

    return decoded;
  } catch (error) {
    return null;
  }
}

export const jwtRotationMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];
  const payload = await validateAccessToken(token);

  if (payload) {
    (req as any).user = {
      id: payload.userId,
      role: payload.userRole,
      email: payload.email,
      tokenFamily: payload.tokenFamily,
    };
  }

  next();
};

export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.authToken.deleteMany({
    where: {
      refreshExpiresAt: { lt: new Date() },
    },
  });

  if (result.count > 0) {
    console.log(`[JWTRotation] Cleaned up ${result.count} expired tokens`);
  }

  return result.count;
}
