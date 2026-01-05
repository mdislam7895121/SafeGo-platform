import crypto from "crypto";
import { drizzleDb } from "../db/drizzle";
import { authRefreshTokens } from "../db/schema/authRefreshTokens";
import { eq, and, isNull } from "drizzle-orm";

// SECURITY: Pepper for refresh token hashing (server-side secret)
const REFRESH_TOKEN_PEPPER = process.env.REFRESH_TOKEN_PEPPER || "";

// Token expiry: 30 days
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

interface TokenMeta {
  deviceId?: string;
  ip?: string;
  userAgent?: string;
}

interface RefreshTokenResult {
  token: string;
  tokenId: string;
  expiresAt: Date;
  userId: string;
}

interface RotateResult {
  success: boolean;
  token?: string;
  tokenId?: string;
  expiresAt?: Date;
  userId?: string;
  reuseDetected?: boolean;
  error?: string;
}

/**
 * Hash a refresh token using SHA-256 with pepper
 * SECURITY: Never store plaintext tokens
 */
function hashToken(token: string): string {
  return crypto
    .createHash("sha256")
    .update(token + REFRESH_TOKEN_PEPPER)
    .digest("hex");
}

/**
 * Generate a cryptographically secure refresh token
 */
function generateSecureToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

/**
 * Issue a new refresh token for a user
 */
export async function issueRefreshToken(
  userId: string,
  meta: TokenMeta = {}
): Promise<RefreshTokenResult> {
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  const [inserted] = await drizzleDb
    .insert(authRefreshTokens)
    .values({
      userId,
      tokenHash,
      expiresAt,
      deviceId: meta.deviceId || null,
      ip: meta.ip || null,
      userAgent: meta.userAgent || null,
    })
    .returning({ id: authRefreshTokens.id });

  // SECURITY: Log token issuance without token value
  if (process.env.NODE_ENV === "development") {
    console.log(`[RefreshToken] Issued token for user ${userId.substring(0, 8)}...`);
  }

  return {
    token,
    tokenId: inserted.id,
    expiresAt,
    userId,
  };
}

/**
 * Rotate refresh token - invalidate old, issue new
 * Implements reuse detection: if token already revoked, revoke ALL user tokens
 */
export async function rotateRefreshToken(
  oldToken: string,
  meta: TokenMeta = {}
): Promise<RotateResult> {
  const oldTokenHash = hashToken(oldToken);

  // Find the existing token
  const [existingToken] = await drizzleDb
    .select()
    .from(authRefreshTokens)
    .where(eq(authRefreshTokens.tokenHash, oldTokenHash))
    .limit(1);

  if (!existingToken) {
    return { success: false, error: "Token not found" };
  }

  // Check if token is expired
  if (new Date(existingToken.expiresAt) < new Date()) {
    return { success: false, error: "Token expired" };
  }

  // SECURITY: Reuse detection - if token already revoked, this is a stolen token replay
  if (existingToken.revokedAt) {
    console.warn(
      `[RefreshToken] REUSE DETECTED for user ${existingToken.userId.substring(0, 8)}... - revoking all tokens`
    );
    
    // Revoke ALL tokens for this user (global logout)
    await revokeAllUserTokens(existingToken.userId);
    
    return {
      success: false,
      reuseDetected: true,
      error: "Token reuse detected - all sessions revoked",
    };
  }

  // Issue new token
  const newToken = generateSecureToken();
  const newTokenHash = hashToken(newToken);
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  // Insert new token first to get its ID
  const [newTokenRecord] = await drizzleDb
    .insert(authRefreshTokens)
    .values({
      userId: existingToken.userId,
      tokenHash: newTokenHash,
      expiresAt: newExpiresAt,
      deviceId: meta.deviceId || existingToken.deviceId,
      ip: meta.ip || null,
      userAgent: meta.userAgent || null,
    })
    .returning({ id: authRefreshTokens.id });

  // Now revoke old token and link to new one
  await drizzleDb
    .update(authRefreshTokens)
    .set({
      revokedAt: new Date(),
      replacedByTokenId: newTokenRecord.id,
    })
    .where(eq(authRefreshTokens.id, existingToken.id));

  // SECURITY: Log rotation without token values
  if (process.env.NODE_ENV === "development") {
    console.log(
      `[RefreshToken] Rotated token for user ${existingToken.userId.substring(0, 8)}...`
    );
  }

  return {
    success: true,
    token: newToken,
    tokenId: newTokenRecord.id,
    expiresAt: newExpiresAt,
    userId: existingToken.userId,
  };
}

/**
 * Revoke a single refresh token
 */
export async function revokeRefreshToken(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);

  const result = await drizzleDb
    .update(authRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(authRefreshTokens.tokenHash, tokenHash),
        isNull(authRefreshTokens.revokedAt)
      )
    )
    .returning({ id: authRefreshTokens.id });

  if (result.length > 0 && process.env.NODE_ENV === "development") {
    console.log(`[RefreshToken] Revoked token ${result[0].id.substring(0, 8)}...`);
  }

  return result.length > 0;
}

/**
 * Revoke ALL refresh tokens for a user (global logout)
 * Used for: password change, security incident, reuse detection
 */
export async function revokeAllUserTokens(userId: string): Promise<number> {
  const result = await drizzleDb
    .update(authRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(authRefreshTokens.userId, userId),
        isNull(authRefreshTokens.revokedAt)
      )
    )
    .returning({ id: authRefreshTokens.id });

  if (process.env.NODE_ENV === "development") {
    console.log(
      `[RefreshToken] Revoked ${result.length} tokens for user ${userId.substring(0, 8)}...`
    );
  }

  return result.length;
}

/**
 * Validate a refresh token without rotating (for checking)
 */
export async function validateRefreshToken(
  token: string
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const tokenHash = hashToken(token);

  const [existingToken] = await drizzleDb
    .select()
    .from(authRefreshTokens)
    .where(eq(authRefreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!existingToken) {
    return { valid: false, error: "Token not found" };
  }

  if (existingToken.revokedAt) {
    return { valid: false, error: "Token revoked" };
  }

  if (new Date(existingToken.expiresAt) < new Date()) {
    return { valid: false, error: "Token expired" };
  }

  return { valid: true, userId: existingToken.userId };
}
