import { prisma } from "../lib/prisma";

export async function migrateTo3TierSystem() {
  try {
    console.log("🔄 Starting migration to 3-tier system...");

    // Step 1: Find Diamond tier (if exists)
    const diamondTier = await prisma.driverTier.findUnique({
      where: { name: "Diamond" },
    });

    if (diamondTier) {
      console.log(`Found Diamond tier: ${diamondTier.id}`);

      // Step 2: Find Premium tier (target for Diamond drivers)
      const premiumTier = await prisma.driverTier.findUnique({
        where: { name: "Premium" },
      });

      if (!premiumTier) {
        throw new Error("Premium tier not found! Cannot migrate Diamond drivers.");
      }

      // Step 3: Count drivers in Diamond tier
      const diamondDriverCount = await prisma.driverPoints.count({
        where: { currentTierId: diamondTier.id },
      });

      console.log(`Found ${diamondDriverCount} drivers in Diamond tier`);

      // Step 4: Migrate Diamond drivers to Premium tier
      if (diamondDriverCount > 0) {
        const result = await prisma.driverPoints.updateMany({
          where: { currentTierId: diamondTier.id },
          data: { currentTierId: premiumTier.id },
        });

        console.log(`✓ Migrated ${result.count} drivers from Diamond to Premium`);
      }

      // Step 5: Delete Diamond tier benefits
      const deletedBenefits = await prisma.tierBenefit.deleteMany({
        where: { tierId: diamondTier.id },
      });

      console.log(`✓ Deleted ${deletedBenefits.count} Diamond tier benefits`);

      // Step 6: Delete Diamond tier
      await prisma.driverTier.delete({
        where: { id: diamondTier.id },
      });

      console.log(`✓ Deleted Diamond tier`);
    } else {
      console.log("✓ Diamond tier not found (already removed or never created)");
    }

    // Step 7: Update tier thresholds to new values
    console.log("\n📊 Updating tier thresholds...");

    const blueUpdate = await prisma.driverTier.update({
      where: { name: "Blue" },
      data: {
        requiredPoints: 1000,
        description: "First tier for dedicated drivers (1000-1499 points)",
      },
    });
    console.log(`✓ Updated Blue tier: ${blueUpdate.requiredPoints} points`);

    const goldUpdate = await prisma.driverTier.update({
      where: { name: "Gold" },
      data: {
        requiredPoints: 1500,
        description: "Intermediate tier with enhanced benefits (1500-2499 points)",
      },
    });
    console.log(`✓ Updated Gold tier: ${goldUpdate.requiredPoints} points`);

    const premiumUpdate = await prisma.driverTier.update({
      where: { name: "Premium" },
      data: {
        requiredPoints: 2500,
        description: "Premium tier with exclusive perks (2500+ points)",
      },
    });
    console.log(`✓ Updated Premium tier: ${premiumUpdate.requiredPoints} points`);

    // Step 8: Initialize 90-day cycle for all existing drivers
    console.log("\n🔄 Initializing 90-day cycles for existing drivers...");

    const now = new Date();
    const cycleEnd = new Date(now);
    cycleEnd.setDate(cycleEnd.getDate() + 90);

    const driversToUpdate = await prisma.driverPoints.findMany({
      where: {
        OR: [
          { cycleStartDate: null },
          { cycleEndDate: null },
        ],
      },
    });

    console.log(`Found ${driversToUpdate.length} drivers needing cycle initialization`);

    for (const driver of driversToUpdate) {
      await prisma.driverPoints.update({
        where: { id: driver.id },
        data: {
          cycleStartDate: now,
          cycleEndDate: cycleEnd,
          // totalPoints stays the same (becomes 90-day status points)
          // lifetimePoints already exists
        },
      });
    }

    console.log(`✓ Initialized cycles for ${driversToUpdate.length} drivers`);

    // Step 9: Recalculate tiers based on new thresholds
    console.log("\n🎯 Recalculating driver tiers based on new thresholds...");

    const allDrivers = await prisma.driverPoints.findMany({
      include: { tier: true },
    });

    let recalculated = 0;
    const tiers = await prisma.driverTier.findMany({
      orderBy: { displayOrder: "asc" },
    });

    for (const driver of allDrivers) {
      // Find eligible tier based on totalPoints (90-day status points)
      const eligibleTier = tiers
        .filter((t) => driver.totalPoints >= t.requiredPoints)
        .sort((a, b) => b.requiredPoints - a.requiredPoints)[0];

      const newTierId = eligibleTier?.id || null;

      // Only update if tier changed
      if (driver.currentTierId !== newTierId) {
        await prisma.driverPoints.update({
          where: { id: driver.id },
          data: { currentTierId: newTierId },
        });
        recalculated++;
      }
    }

    console.log(`✓ Recalculated tiers for ${recalculated} drivers`);

    // Step 10: Summary
    console.log("\n✅ Migration to 3-tier system completed!");
    console.log("\n📋 New tier structure:");
    console.log("   • Blue: 1000-1499 points");
    console.log("   • Gold: 1500-2499 points");
    console.log("   • Premium: 2500+ points");
    console.log("   • No tier: 0-999 points");

    const tierCounts = await prisma.driverPoints.groupBy({
      by: ["currentTierId"],
      _count: true,
    });

    console.log("\n📊 Current driver distribution:");
    for (const count of tierCounts) {
      if (count.currentTierId) {
        const tier = await prisma.driverTier.findUnique({
          where: { id: count.currentTierId },
        });
        console.log(`   ${tier?.name}: ${count._count} drivers`);
      } else {
        console.log(`   No tier: ${count._count} drivers`);
      }
    }

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run immediately when script is executed directly
migrateTo3TierSystem()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
