import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function seedRestaurants() {
  const restaurantUsers = [
    { email: "restaurant.bd@demo.com", password: "demo123", role: "restaurant", countryCode: "BD" },
    { email: "restaurant.us@demo.com", password: "demo123", role: "restaurant", countryCode: "US" },
  ];

  for (const userData of restaurantUsers) {
    try {
      const existingUser = await prisma.user.findUnique({ where: { email: userData.email } });
      if (existingUser) {
        console.log(`✓ ${userData.email} already exists`);
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

      // Create restaurant profile with required restaurantName
      await prisma.restaurantProfile.create({
        data: {
          userId: user.id,
          restaurantName: `Demo Restaurant ${userData.countryCode}`,
        },
      });

      console.log(`✓ Created: ${userData.email} (password: ${userData.password})`);
    } catch (error: any) {
      console.error(`✗ Failed to create ${userData.email}:`, error.message);
    }
  }
}

seedRestaurants()
  .catch((error) => { console.error("Error:", error); })
  .finally(() => { prisma.$disconnect(); });
