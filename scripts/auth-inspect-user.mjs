#!/usr/bin/env node
/**
 * AUTH USER INSPECTION TOOL
 * Safe, read-only admin utility to inspect user accounts
 * 
 * Usage:
 *   node scripts/auth-inspect-user.mjs <email>
 *   node scripts/auth-inspect-user.mjs md550@gmail.com
 */

import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const prisma = new PrismaClient();

async function inspectUser(email) {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║           AUTH USER INSPECTION TOOL (READ-ONLY)          ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  console.log(`Inspecting: ${email}\n`);

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        countryCode: true,
        isBlocked: true,
        isAccountLocked: true,
        accountLockedAt: true,
        createdAt: true,
        updatedAt: true,
        failedLoginAttempts: true,
        lastFailedLoginAt: true,
        temporaryLockUntil: true,
        // Don't select passwordHash - keep it secret
        customerProfile: {
          select: {
            id: true,
            verificationStatus: true,
            isVerified: true,
            createdAt: true,
          },
        },
        adminProfile: {
          select: {
            id: true,
            adminRole: true,
            isActive: true,
            twoFactorEnabled: true,
          },
        },
        driverProfile: {
          select: {
            id: true,
            verificationStatus: true,
            isVerified: true,
          },
        },
      },
    });

    if (!user) {
      console.log("❌ User not found\n");
      return false;
    }

    console.log("✅ USER FOUND\n");

    console.log("📋 BASIC INFO:");
    console.log(`   ID:            ${user.id}`);
    console.log(`   Email:         ${user.email}`);
    console.log(`   Role:          ${user.role}`);
    console.log(`   Country:       ${user.countryCode}`);
    console.log(`   Created:       ${new Date(user.createdAt).toISOString()}`);
    console.log(`   Updated:       ${new Date(user.updatedAt).toISOString()}`);

    console.log("\n🔐 ACCOUNT STATUS:");
    console.log(`   Blocked:       ${user.isBlocked ? "YES" : "NO"}`);
    if (user.blockedAt) {
      console.log(`   Blocked At:    ${new Date(user.blockedAt).toISOString()}`);
    }
    console.log(`   Failed Attempts: ${user.failedLoginAttempts || 0}`);
    if (user.lastFailedLoginAt) {
      console.log(`   Last Failed:   ${new Date(user.lastFailedLoginAt).toISOString()}`);
    }
    if (user.temporaryLockUntil) {
      const lockTime = new Date(user.temporaryLockUntil);
      const now = new Date();
      const isLocked = lockTime > now;
      console.log(`   Lock Until:    ${lockTime.toISOString()} (${isLocked ? "LOCKED" : "EXPIRED"})`);
    }

    // Check password hash in raw query (to avoid Prisma selecting it)
    const userWithHash = await prisma.$queryRaw`
      SELECT "passwordHash" IS NOT NULL as "hasPasswordHash",
             CASE 
               WHEN "passwordHash" IS NULL THEN 'NO HASH'
               WHEN "passwordHash" LIKE '$2%' THEN 'BCRYPT'
               WHEN "passwordHash" LIKE '$2a%' THEN 'BCRYPT (2a)'
               WHEN "passwordHash" LIKE '$2b%' THEN 'BCRYPT (2b)'
               WHEN "passwordHash" LIKE '$2x%' THEN 'BCRYPT (2x)'
               WHEN "passwordHash" LIKE '$2y%' THEN 'BCRYPT (2y)'
               ELSE 'UNKNOWN'
             END as "hashType"
      FROM "users"
      WHERE "email" = ${email}
    `;

    const hashInfo = userWithHash?.[0];
    console.log(`\n🔑 PASSWORD HASH:`);
    console.log(`   Exists:        ${hashInfo?.hasPasswordHash ? "YES" : "NO"}`);
    console.log(`   Algorithm:     ${hashInfo?.hashType || "UNKNOWN"}`);
    if (!hashInfo?.hasPasswordHash) {
      console.log("   ⚠️  WARNING: No password hash set - user cannot login!");
    }

    // Profiles
    if (user.role === "customer" && user.customerProfile) {
      console.log(`\n👤 CUSTOMER PROFILE:`);
      console.log(`   ID:            ${user.customerProfile.id}`);
      console.log(`   Status:        ${user.customerProfile.verificationStatus}`);
      console.log(`   Verified:      ${user.customerProfile.isVerified ? "YES" : "NO"}`);
      console.log(`   Created:       ${new Date(user.customerProfile.createdAt).toISOString()}`);
    }

    if (user.role === "admin" && user.adminProfile) {
      console.log(`\n⚙️  ADMIN PROFILE:`);
      console.log(`   ID:            ${user.adminProfile.id}`);
      console.log(`   Admin Role:    ${user.adminProfile.adminRole}`);
      console.log(`   Active:        ${user.adminProfile.isActive ? "YES" : "NO"}`);
      console.log(`   2FA Enabled:   ${user.adminProfile.twoFactorEnabled ? "YES" : "NO"}`);
    }

    if (user.role === "driver" && user.driverProfile) {
      console.log(`\n🚗 DRIVER PROFILE:`);
      console.log(`   ID:            ${user.driverProfile.id}`);
      console.log(`   Status:        ${user.driverProfile.verificationStatus}`);
      console.log(`   Verified:      ${user.driverProfile.isVerified ? "YES" : "NO"}`);
    }

    console.log("\n✅ INSPECTION COMPLETE\n");
    return true;
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Main
const email = process.argv[2];
if (!email) {
  console.error("\n❌ Usage: node scripts/auth-inspect-user.mjs <email>\n");
  console.error("Example: node scripts/auth-inspect-user.mjs user@example.com\n");
  process.exit(1);
}

const success = await inspectUser(email);
process.exit(success ? 0 : 1);
