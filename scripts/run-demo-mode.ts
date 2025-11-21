#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import { enableDemoMode, clearDemoMode } from "../server/services/demoModeService";

const command = process.argv[2];

const cliPrisma = new PrismaClient();

async function main() {
  try {
    if (command === "enable") {
      console.log("🎬 Starting Demo Mode activation...\n");
      const summary = await enableDemoMode();
      console.log("\n🎉 Demo Mode successfully activated!");
      console.log("\n📈 You can now:");
      console.log("   - View analytics dashboards with realistic data");
      console.log("   - Test RBAC filtering across jurisdictions");
      console.log("   - Explore earnings, wallet, and payout systems");
      console.log("\n💡 To clear demo data, run: tsx scripts/run-demo-mode.ts clear\n");
      process.exit(0);
    } else if (command === "clear") {
      console.log("🗑️  Starting Demo Mode cleanup...\n");
      await clearDemoMode();
      console.log("\n✨ Demo data cleared successfully!");
      console.log("   Your database is back to its original state.\n");
      process.exit(0);
    } else {
      console.log("❌ Invalid command. Usage:");
      console.log("   tsx scripts/run-demo-mode.ts enable  - Generate comprehensive demo data");
      console.log("   tsx scripts/run-demo-mode.ts clear   - Remove all demo data\n");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  } finally {
    await cliPrisma.$disconnect();
  }
}

main();
