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

  // Seed demo tax rules (Uber-style)
  console.log("\n🏛️  Seeding demo tax rules (Uber-style)...\n");
  
  const demoTaxRules = [
    // USA - Country-level Sales Tax (applies to all services)
    {
      countryCode: "US",
      cityCode: null,
      taxType: "SALES_TAX",
      serviceType: "RIDE",
      percentRate: 7.5,
      flatFee: null,
      isActive: true,
      isDemo: true,
    },
    {
      countryCode: "US",
      cityCode: null,
      taxType: "SALES_TAX",
      serviceType: "FOOD",
      percentRate: 7.5,
      flatFee: null,
      isActive: true,
      isDemo: true,
    },
    {
      countryCode: "US",
      cityCode: null,
      taxType: "SALES_TAX",
      serviceType: "PARCEL",
      percentRate: 7.5,
      flatFee: null,
      isActive: true,
      isDemo: true,
    },
    // NYC - Trip Fee (overrides country rules for rides in NYC)
    {
      countryCode: "US",
      cityCode: "NYC",
      taxType: "TRIP_FEE",
      serviceType: "RIDE",
      percentRate: 0.5,
      flatFee: 2.50,
      isActive: true,
      isDemo: true,
    },
    {
      countryCode: "US",
      cityCode: "NYC",
      taxType: "LOCAL_MUNICIPALITY_FEE",
      serviceType: "FOOD",
      percentRate: null,
      flatFee: 0.75,
      isActive: true,
      isDemo: true,
    },
    // SF - Local Municipality Fee (overrides country rules for rides in SF)
    {
      countryCode: "US",
      cityCode: "SF",
      taxType: "LOCAL_MUNICIPALITY_FEE",
      serviceType: "RIDE",
      percentRate: null,
      flatFee: 1.50,
      isActive: true,
      isDemo: true,
    },
    // Bangladesh - Country-level VAT
    {
      countryCode: "BD",
      cityCode: null,
      taxType: "VAT",
      serviceType: "RIDE",
      percentRate: 15.0,
      flatFee: null,
      isActive: true,
      isDemo: true,
    },
    {
      countryCode: "BD",
      cityCode: null,
      taxType: "VAT",
      serviceType: "FOOD",
      percentRate: 15.0,
      flatFee: null,
      isActive: true,
      isDemo: true,
    },
    {
      countryCode: "BD",
      cityCode: null,
      taxType: "VAT",
      serviceType: "PARCEL",
      percentRate: 15.0,
      flatFee: null,
      isActive: true,
      isDemo: true,
    },
    // Dhaka - Government Service Fee (city-specific, stacks with VAT)
    {
      countryCode: "BD",
      cityCode: "DHK",
      taxType: "GOVERNMENT_SERVICE_FEE",
      serviceType: "RIDE",
      percentRate: 5.0,
      flatFee: null,
      isActive: true,
      isDemo: true,
    },
  ];

  for (const taxRule of demoTaxRules) {
    try {
      const existing = await prisma.taxRule.findFirst({
        where: {
          countryCode: taxRule.countryCode,
          cityCode: taxRule.cityCode,
          taxType: taxRule.taxType,
          serviceType: taxRule.serviceType,
          isDemo: true,
        },
      });

      if (existing) {
        console.log(`  ✓ ${taxRule.taxType} for ${taxRule.serviceType} (${taxRule.countryCode}${taxRule.cityCode ? `/${taxRule.cityCode}` : ''}) - exists`);
        continue;
      }

      await prisma.taxRule.create({
        data: taxRule as any,
      });

      console.log(`  ✓ ${taxRule.taxType} for ${taxRule.serviceType} (${taxRule.countryCode}${taxRule.cityCode ? `/${taxRule.cityCode}` : ''}) - created`);
    } catch (error: any) {
      console.error(`  ✗ ${taxRule.taxType} - error: ${error.message}`);
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
