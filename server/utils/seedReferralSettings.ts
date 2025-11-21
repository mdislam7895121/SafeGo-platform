import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedReferralSettings() {
  try {
    console.log("🌱 Seeding default referral settings...");

    // Get the first admin user to use as creator
    const adminUser = await prisma.user.findFirst({
      where: {
        role: "admin",
      },
    });

    if (!adminUser) {
      console.warn("⚠️  No admin user found. Skipping referral settings seed.");
      return;
    }

    // Check if settings already exist
    const existingBD = await prisma.referralSetting.findFirst({
      where: {
        countryCode: "BD",
        userType: "driver",
        isDemo: false,
      },
    });

    const existingUS = await prisma.referralSetting.findFirst({
      where: {
        countryCode: "US",
        userType: "driver",
        isDemo: false,
      },
    });

    // Create Bangladesh referral setting
    if (!existingBD) {
      await prisma.referralSetting.create({
        data: {
          countryCode: "BD",
          userType: "driver",
          currency: "BDT",
          baseAmount: 500,
          isActive: true,
          isDemo: false,
          createdByAdminId: adminUser.id,
          notes: "Default referral bonus for Bangladesh drivers",
        },
      });
      console.log("✓ Created default referral setting for Bangladesh (৳500)");
    } else {
      console.log("✓ Bangladesh referral setting already exists");
    }

    // Create United States referral setting
    if (!existingUS) {
      await prisma.referralSetting.create({
        data: {
          countryCode: "US",
          userType: "driver",
          currency: "USD",
          baseAmount: 50,
          isActive: true,
          isDemo: false,
          createdByAdminId: adminUser.id,
          notes: "Default referral bonus for United States drivers",
        },
      });
      console.log("✓ Created default referral setting for United States ($50)");
    } else {
      console.log("✓ United States referral setting already exists");
    }

    console.log("✅ Referral settings seed completed!");
  } catch (error) {
    console.error("❌ Error seeding referral settings:", error);
    throw error;
  }
}

// Run immediately when script is executed directly
seedReferralSettings()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
