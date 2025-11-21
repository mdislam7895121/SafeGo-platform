import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedDriverTiers() {
  try {
    console.log("🌱 Seeding default driver tier system...");

    // Define the 4 tiers
    const tiers = [
      {
        name: "Blue",
        requiredPoints: 0,
        color: "#3B82F6",
        description: "Entry level tier for new drivers",
        displayOrder: 1,
        benefits: [
          "Access to SafeGo platform",
          "Basic driver support",
          "Standard trip requests",
          "Weekly earnings reports",
        ],
      },
      {
        name: "Gold",
        requiredPoints: 500,
        color: "#F59E0B",
        description: "Intermediate tier with enhanced benefits",
        displayOrder: 2,
        benefits: [
          "All Blue tier benefits",
          "Priority support access",
          "Higher trip visibility",
          "Exclusive bonus opportunities",
          "Advanced earnings analytics",
        ],
      },
      {
        name: "Premium",
        requiredPoints: 1500,
        color: "#8B5CF6",
        description: "Premium tier with exclusive perks",
        displayOrder: 3,
        benefits: [
          "All Gold tier benefits",
          "Lower commission rates (2% reduction)",
          "Premium surge zone access",
          "24/7 dedicated support line",
          "Advanced trip planning tools",
          "Monthly performance bonuses",
        ],
      },
      {
        name: "Diamond",
        requiredPoints: 3000,
        color: "#06B6D4",
        description: "Elite tier with maximum benefits",
        displayOrder: 4,
        benefits: [
          "All Premium tier benefits",
          "Lowest commission rates (5% reduction)",
          "First access to high-value trips",
          "VIP support with account manager",
          "Exclusive partnership rewards",
          "Annual recognition awards",
          "Beta access to new features",
        ],
      },
    ];

    // Seed each tier
    for (const tierData of tiers) {
      const existingTier = await prisma.driverTier.findUnique({
        where: { name: tierData.name },
      });

      if (!existingTier) {
        const tier = await prisma.driverTier.create({
          data: {
            name: tierData.name,
            requiredPoints: tierData.requiredPoints,
            color: tierData.color,
            description: tierData.description,
            displayOrder: tierData.displayOrder,
            isActive: true,
          },
        });

        // Create benefits for this tier
        for (let i = 0; i < tierData.benefits.length; i++) {
          await prisma.tierBenefit.create({
            data: {
              tierId: tier.id,
              benefitText: tierData.benefits[i],
              displayOrder: i + 1,
              isActive: true,
            },
          });
        }

        console.log(`✓ Created ${tierData.name} tier with ${tierData.benefits.length} benefits`);
      } else {
        console.log(`✓ ${tierData.name} tier already exists`);
      }
    }

    // Create default points rules
    const existingTripRule = await prisma.pointsRule.findUnique({
      where: { ruleName: "default_trip_completion" },
    });

    if (!existingTripRule) {
      await prisma.pointsRule.create({
        data: {
          ruleName: "default_trip_completion",
          description: "Points earned for completing a standard trip",
          basePoints: 10,
          multiplier: 1.0,
          isActive: true,
        },
      });
      console.log("✓ Created default trip completion rule (10 points per trip)");
    }

    // Country-specific rules
    const existingBDRule = await prisma.pointsRule.findUnique({
      where: { ruleName: "bd_trip_completion" },
    });

    if (!existingBDRule) {
      await prisma.pointsRule.create({
        data: {
          ruleName: "bd_trip_completion",
          description: "Points for trips in Bangladesh",
          basePoints: 10,
          multiplier: 1.0,
          countryCode: "BD",
          isActive: true,
        },
      });
      console.log("✓ Created Bangladesh trip rule (10 points per trip)");
    }

    const existingUSRule = await prisma.pointsRule.findUnique({
      where: { ruleName: "us_trip_completion" },
    });

    if (!existingUSRule) {
      await prisma.pointsRule.create({
        data: {
          ruleName: "us_trip_completion",
          description: "Points for trips in United States",
          basePoints: 10,
          multiplier: 1.0,
          countryCode: "US",
          isActive: true,
        },
      });
      console.log("✓ Created United States trip rule (10 points per trip)");
    }

    console.log("✅ Driver tier system seed completed!");
  } catch (error) {
    console.error("❌ Error seeding driver tiers:", error);
    throw error;
  }
}

// Run immediately when script is executed directly
seedDriverTiers()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
