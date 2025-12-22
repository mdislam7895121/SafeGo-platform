import { prisma } from "../../lib/prisma";
import crypto from "crypto";

export type CacheKind = "EMBEDDING" | "KB_RESULTS";

const EMBEDDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const KB_RESULTS_TTL_MS = 24 * 60 * 60 * 1000;

function getTTL(kind: CacheKind): number {
  return kind === "EMBEDDING" ? EMBEDDING_TTL_MS : KB_RESULTS_TTL_MS;
}

function generateCacheKey(params: {
  query: string;
  country?: string;
  role?: string;
  service?: string;
  kind: CacheKind;
}): string {
  const normalized = params.query.toLowerCase().trim().replace(/\s+/g, " ");
  const keyParts = [
    params.kind,
    normalized,
    params.country || "GLOBAL",
    params.role || "ALL",
    params.service || "ALL",
  ];
  const hash = crypto.createHash("sha256").update(keyParts.join("|")).digest("hex");
  return `${params.kind}:${hash}`;
}

export async function getCached<T>(params: {
  query: string;
  country?: string;
  role?: string;
  service?: string;
  kind: CacheKind;
}): Promise<{ hit: boolean; data: T | null }> {
  const cacheKey = generateCacheKey(params);

  try {
    const cached = await prisma.safePilotCache.findUnique({
      where: { cacheKey },
    });

    if (!cached) {
      return { hit: false, data: null };
    }

    if (new Date() > cached.expiresAt) {
      await prisma.safePilotCache.delete({ where: { cacheKey } }).catch(() => {});
      return { hit: false, data: null };
    }

    return { hit: true, data: cached.payloadJson as T };
  } catch (error) {
    console.error("[SafePilot Cache] Get error:", error);
    return { hit: false, data: null };
  }
}

export async function setCache<T>(params: {
  query: string;
  country?: string;
  role?: string;
  service?: string;
  kind: CacheKind;
  data: T;
}): Promise<void> {
  const cacheKey = generateCacheKey(params);
  const ttl = getTTL(params.kind);
  const expiresAt = new Date(Date.now() + ttl);

  try {
    await prisma.safePilotCache.upsert({
      where: { cacheKey },
      update: {
        payloadJson: params.data as any,
        expiresAt,
        createdAt: new Date(),
      },
      create: {
        cacheKey,
        kind: params.kind,
        payloadJson: params.data as any,
        expiresAt,
      },
    });
  } catch (error) {
    console.error("[SafePilot Cache] Set error:", error);
  }
}

export async function clearExpiredCache(): Promise<number> {
  try {
    const result = await prisma.safePilotCache.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  } catch (error) {
    console.error("[SafePilot Cache] Clear error:", error);
    return 0;
  }
}

export async function invalidateKBCache(): Promise<number> {
  try {
    const result = await prisma.safePilotCache.deleteMany({
      where: { kind: "KB_RESULTS" },
    });
    return result.count;
  } catch (error) {
    console.error("[SafePilot Cache] Invalidate KB error:", error);
    return 0;
  }
}
