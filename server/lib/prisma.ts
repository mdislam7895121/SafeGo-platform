import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const FALLBACK_DATABASE_URL =
  "postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public";

const getDatabaseUrl = () => {
  const configuredUrl = process.env.DATABASE_URL?.trim();

  if (configuredUrl && configuredUrl.length > 0) {
    return configuredUrl;
  }

  console.warn(
    "[prisma] DATABASE_URL is not set. Using a placeholder URL; database calls will fail until configured."
  );

  process.env.DATABASE_URL = FALLBACK_DATABASE_URL;
  return process.env.DATABASE_URL;
};

const prismaClientSingleton = () => {
  const databaseUrl = getDatabaseUrl();

  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
};

const prismaInstance = (globalThis.__prisma ?? prismaClientSingleton()) as PrismaClient;

// Export prisma as any to avoid hard failures when schema/client typings drift.
export const prisma: any = prismaInstance;

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prismaInstance;
}

export const db = prisma;

export async function disconnectPrisma() {
  await prisma.$disconnect();
}

process.on("beforeExit", async () => {
  await disconnectPrisma();
});
