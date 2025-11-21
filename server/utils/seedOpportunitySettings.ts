import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedOpportunitySettings() {
  try {
    console.log("🌱 Seeding default opportunity settings...");

    // Get the first admin user to use as creator
    const adminUser = await prisma.user.findFirst({
      where: {
        role: "admin",
      },
    });

    if (!adminUser) {
      console.warn("⚠️  No admin user found. Skipping opportunity settings seed.");
      return;
    }

    // Bangladesh - Trip Boost
    const existingBDTripBoost = await prisma.opportunitySetting.findFirst({
      where: {
        countryCode: "BD",
        bonusType: "trip_boost",
        isDemo: false,
      },
    });

    if (!existingBDTripBoost) {
      await prisma.opportunitySetting.create({
        data: {
          bonusType: "trip_boost",
          countryCode: "BD",
          currency: "BDT",
          baseAmount: 50,
          isActive: true,
          isDemo: false,
          createdByAdminId: adminUser.id,
          notes: "Default trip boost for Bangladesh drivers",
        },
      });
      console.log("✓ Created Trip Boost for Bangladesh (৳50)");
    } else {
      console.log("✓ Trip Boost for Bangladesh already exists");
    }

    // Bangladesh - Surge Boost
    const existingBDSurgeBoost = await prisma.opportunitySetting.findFirst({
      where: {
        countryCode: "BD",
        bonusType: "surge_boost",
        isDemo: false,
      },
    });

    if (!existingBDSurgeBoost) {
      await prisma.opportunitySetting.create({
        data: {
          bonusType: "surge_boost",
          countryCode: "BD",
          currency: "BDT",
          baseAmount: 100,
          promoAmount: 150,
          isActive: true,
          isDemo: false,
          createdByAdminId: adminUser.id,
          notes: "Surge boost for Bangladesh drivers during high demand",
        },
      });
      console.log("✓ Created Surge Boost for Bangladesh (৳100, Promo: ৳150)");
    } else {
      console.log("✓ Surge Boost for Bangladesh already exists");
    }

    // United States - Trip Boost
    const existingUSTripBoost = await prisma.opportunitySetting.findFirst({
      where: {
        countryCode: "US",
        bonusType: "trip_boost",
        isDemo: false,
      },
    });

    if (!existingUSTripBoost) {
      await prisma.opportunitySetting.create({
        data: {
          bonusType: "trip_boost",
          countryCode: "US",
          currency: "USD",
          baseAmount: 5,
          isActive: true,
          isDemo: false,
          createdByAdminId: adminUser.id,
          notes: "Default trip boost for United States drivers",
        },
      });
      console.log("✓ Created Trip Boost for United States ($5)");
    } else {
      console.log("✓ Trip Boost for United States already exists");
    }

    // United States - Peak Hour Boost
    const existingUSPeakHourBoost = await prisma.opportunitySetting.findFirst({
      where: {
        countryCode: "US",
        bonusType: "peak_hour_boost",
        isDemo: false,
      },
    });

    if (!existingUSPeakHourBoost) {
      await prisma.opportunitySetting.create({
        data: {
          bonusType: "peak_hour_boost",
          countryCode: "US",
          currency: "USD",
          baseAmount: 8,
          isActive: true,
          isDemo: false,
          createdByAdminId: adminUser.id,
          notes: "Peak hour boost for United States drivers",
        },
      });
      console.log("✓ Created Peak Hour Boost for United States ($8)");
    } else {
      console.log("✓ Peak Hour Boost for United States already exists");
    }

    console.log("✅ Opportunity settings seed completed!");
  } catch (error) {
    console.error("❌ Error seeding opportunity settings:", error);
    throw error;
  }
}

// Run immediately when script is executed directly
seedOpportunitySettings()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
