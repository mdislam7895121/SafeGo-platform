#!/usr/bin/env node
/**
 * ADMIN TOOL: Activate a Single User Account (for testing/support)
 * 
 * This script is for LOCAL ADMIN USE ONLY - not exposed via API
 * Updates a customer profile from pending to active status
 * 
 * Usage:
 *   node scripts/activate-user.mjs <email>
 *   node scripts/activate-user.mjs md550@gmail.com
 * 
 * Effect:
 *   - Sets customerProfile.verified = true
 *   - Sets customerProfile.verificationStatus = "active"
 *   - Updates customerProfile.updatedAt to current time
 *   - Returns 0 on success, 1 on failure
 */

import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const prisma = new PrismaClient();

async function activateUser(email) {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║        ADMIN TOOL: ACTIVATE USER ACCOUNT (TESTING)         ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  console.log(`📧 Email: ${email}\n`);

  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: { customerProfile: true },
    });

    if (!user) {
      console.error("❌ User not found\n");
      return 1;
    }

    console.log("✅ User found");
    console.log(`   ID:       ${user.id}`);
    console.log(`   Email:    ${user.email}`);
    console.log(`   Role:     ${user.role}\n`);

    // Only customers can be activated via this tool
    if (user.role !== 'customer') {
      console.error(`❌ This tool only works for customer role (user role: ${user.role})\n`);
      return 1;
    }

    // Check if profile exists
    if (!user.customerProfile) {
      console.error("❌ Customer profile not found for this user\n");
      return 1;
    }

    console.log("📋 Current Profile Status:");
    console.log(`   Status:     ${user.customerProfile.verificationStatus}`);
    console.log(`   Verified:   ${user.customerProfile.isVerified ? "YES" : "NO"}`);
    console.log(`   Created:    ${new Date(user.customerProfile.createdAt).toISOString()}`);
    console.log(`   Updated:    ${new Date(user.customerProfile.updatedAt).toISOString()}\n`);

    // Update profile to active/verified
    console.log("⏳ Updating profile...\n");
    const updated = await prisma.customerProfile.update({
      where: { userId: user.id },
      data: {
        verificationStatus: 'active',
        isVerified: true,
        updatedAt: new Date(),
      },
    });

    console.log("✅ Profile Updated Successfully\n");
    console.log("📋 New Profile Status:");
    console.log(`   Status:     ${updated.verificationStatus}`);
    console.log(`   Verified:   ${updated.isVerified ? "YES" : "NO"}`);
    console.log(`   Updated:    ${new Date(updated.updatedAt).toISOString()}\n`);

    console.log("🎉 User is now active and can login!\n");
    console.log("Test login with:");
    console.log(`   curl -X POST https://api.safegoglobal.com/api/auth/login \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"email":"${email}","password":"<password>"}'`);
    console.log();

    return 0;
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    console.error();
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

// Main
const email = process.argv[2];
if (!email) {
  console.error("\n❌ Usage: node scripts/activate-user.mjs <email>\n");
  console.error("Example: node scripts/activate-user.mjs md550@gmail.com\n");
  process.exit(1);
}

const result = await activateUser(email);
process.exit(result);
