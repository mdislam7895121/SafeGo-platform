import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const demoUsers = [
  { email: "customer.bd@demo.com", password: "demo123", role: "customer", countryCode: "BD" },
  { email: "customer.us@demo.com", password: "demo123", role: "customer", countryCode: "US" },
  { email: "driver.bd@demo.com", password: "demo123", role: "driver", countryCode: "BD" },
  { email: "driver.us@demo.com", password: "demo123", role: "driver", countryCode: "US" },
  { email: "restaurant.bd@demo.com", password: "demo123", role: "restaurant", countryCode: "BD" },
  { email: "restaurant.us@demo.com", password: "demo123", role: "restaurant", countryCode: "US" },
  { email: "admin@demo.com", password: "demo123", role: "admin", countryCode: "US" },
];

async function seed() {
  console.log("\n🌱 Seeding demo users...\n");
  console.log("┌─────────────┬─────────┬─────────────────────────┬──────────┐");
  console.log("│ Role        │ Country │ Email                   │ Password │");
  console.log("├─────────────┼─────────┼─────────────────────────┼──────────┤");

  for (const userData of demoUsers) {
    try {
      const existingUser = await prisma.user.findUnique({ where: { email: userData.email } });

      if (existingUser) {
        console.log(`│ ${userData.role.padEnd(11)} │ ${userData.countryCode.padEnd(7)} │ ${userData.email.padEnd(23)} │ (exists) │`);
        continue;
      }

      const passwordHash = await bcrypt.hash(userData.password, 10);
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          passwordHash,
          role: userData.role as any,
          countryCode: userData.countryCode,
        },
      });

      if (userData.role === "customer") {
        await prisma.customerProfile.create({ data: { userId: user.id } });
      } else if (userData.role === "driver") {
        const driverProfile = await prisma.driverProfile.create({ data: { userId: user.id } });
        await prisma.driverStats.create({ data: { driverId: driverProfile.id } });
        await prisma.driverWallet.create({ data: { driverId: driverProfile.id } });
      } else if (userData.role === "restaurant") {
        const restaurantProfile = await prisma.restaurantProfile.create({
          data: {
            userId: user.id,
            restaurantName: `Demo Restaurant ${userData.countryCode}`,
            address: "Sample Address",
          },
        });
        await prisma.restaurantWallet.create({ data: { restaurantId: restaurantProfile.id } });
      } else if (userData.role === "admin") {
        await prisma.adminProfile.create({ data: { userId: user.id } });
      }

      console.log(`│ ${userData.role.padEnd(11)} │ ${userData.countryCode.padEnd(7)} │ ${userData.email.padEnd(23)} │ ${userData.password.padEnd(8)} │`);
    } catch (error: any) {
      console.log(`│ ${userData.role.padEnd(11)} │ ${userData.countryCode.padEnd(7)} │ ${userData.email.padEnd(23)} │ ERROR    │`);
      console.error(`  ${error.message}`);
    }
  }

  console.log("└─────────────┴─────────┴─────────────────────────┴──────────┘");
  console.log("\n✅ Demo users seeded successfully!\n");

  // Seed demo tax rules
  console.log("\n🏛️  Seeding demo tax rules...\n");
  
  const demoTaxRules = [
    // US Sales Tax - Customer pays
    {
      countryCode: "US",
      stateCode: null,
      cityCode: null,
      taxName: "Sales Tax",
      taxRatePercent: 7.5,
      appliesTo: "ALL",
      payeeType: "CUSTOMER",
      isInclusive: false,
      isActive: true,
      effectiveFrom: new Date("2024-01-01"),
      effectiveTo: null,
      isDemo: true,
    },
    // US Self-Employment Tax - Driver pays
    {
      countryCode: "US",
      stateCode: null,
      cityCode: null,
      taxName: "Self-Employment Tax",
      taxRatePercent: 15.3,
      appliesTo: "RIDE",
      payeeType: "DRIVER",
      isInclusive: true,
      isActive: true,
      effectiveFrom: new Date("2024-01-01"),
      effectiveTo: null,
      isDemo: true,
    },
    // Bangladesh VAT - Customer pays
    {
      countryCode: "BD",
      stateCode: null,
      cityCode: null,
      taxName: "VAT",
      taxRatePercent: 15.0,
      appliesTo: "ALL",
      payeeType: "CUSTOMER",
      isInclusive: true,
      isActive: true,
      effectiveFrom: new Date("2024-01-01"),
      effectiveTo: null,
      isDemo: true,
    },
    // New York City Tax - Additional city tax
    {
      countryCode: "US",
      stateCode: "NY",
      cityCode: "NYC",
      taxName: "NYC Local Tax",
      taxRatePercent: 4.5,
      appliesTo: "RIDE",
      payeeType: "CUSTOMER",
      isInclusive: false,
      isActive: true,
      effectiveFrom: new Date("2024-01-01"),
      effectiveTo: null,
      isDemo: true,
    },
  ];

  for (const taxRule of demoTaxRules) {
    try {
      const existing = await prisma.taxRule.findFirst({
        where: {
          countryCode: taxRule.countryCode,
          stateCode: taxRule.stateCode,
          cityCode: taxRule.cityCode,
          taxName: taxRule.taxName,
          isDemo: true,
        },
      });

      if (existing) {
        console.log(`  ✓ ${taxRule.taxName} (${taxRule.countryCode}) - exists`);
        continue;
      }

      await prisma.taxRule.create({
        data: taxRule as any,
      });

      console.log(`  ✓ ${taxRule.taxName} (${taxRule.countryCode}) - created`);
    } catch (error: any) {
      console.error(`  ✗ ${taxRule.taxName} - error: ${error.message}`);
    }
  }

  console.log("\n✅ Demo tax rules seeded successfully!\n");
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
