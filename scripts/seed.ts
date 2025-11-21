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

  // Seed demo restaurants with menus
  console.log("\n🍔 Seeding demo restaurants with menus...\n");

  const demoRestaurants = [
    // NYC Restaurants
    {
      email: "pizza-nyc@demo.com",
      countryCode: "US",
      cityCode: "NYC",
      restaurantName: "Bella's Pizzeria",
      cuisineType: "Italian",
      description: "Authentic New York-style pizza made with fresh ingredients",
      address: "123 Broadway, New York, NY 10001",
      averageRating: 4.7,
      totalRatings: 342,
      menu: [
        {
          categoryName: "Pizzas",
          categoryDescription: "Hand-tossed New York-style pizzas",
          items: [
            { name: "Margherita Pizza", description: "Classic tomato sauce, fresh mozzarella, and basil", price: 14.99, isAvailable: true },
            { name: "Pepperoni Pizza", description: "Tomato sauce, mozzarella, and premium pepperoni", price: 16.99, isAvailable: true },
            { name: "Veggie Supreme", description: "Bell peppers, mushrooms, onions, olives, and tomatoes", price: 15.99, isAvailable: true },
          ],
        },
        {
          categoryName: "Appetizers",
          categoryDescription: "Start your meal right",
          items: [
            { name: "Garlic Bread", description: "Toasted bread with garlic butter", price: 5.99, isAvailable: true },
            { name: "Mozzarella Sticks", description: "Crispy fried mozzarella with marinara sauce", price: 7.99, isAvailable: true },
          ],
        },
        {
          categoryName: "Drinks",
          categoryDescription: "Beverages to complement your meal",
          items: [
            { name: "Coke", description: "Classic Coca-Cola", price: 2.49, isAvailable: true },
            { name: "Lemonade", description: "Fresh-squeezed lemonade", price: 3.49, isAvailable: true },
          ],
        },
      ],
    },
    {
      email: "sushi-nyc@demo.com",
      countryCode: "US",
      cityCode: "NYC",
      restaurantName: "Tokyo Sushi Bar",
      cuisineType: "Japanese",
      description: "Fresh sushi and sashimi prepared by expert chefs",
      address: "456 5th Avenue, New York, NY 10018",
      averageRating: 4.8,
      totalRatings: 278,
      menu: [
        {
          categoryName: "Sushi Rolls",
          categoryDescription: "Traditional and specialty rolls",
          items: [
            { name: "California Roll", description: "Crab, avocado, and cucumber", price: 9.99, isAvailable: true },
            { name: "Spicy Tuna Roll", description: "Tuna, spicy mayo, and cucumber", price: 11.99, isAvailable: true },
            { name: "Dragon Roll", description: "Eel, avocado, and special sauce", price: 14.99, isAvailable: true },
          ],
        },
        {
          categoryName: "Appetizers",
          categoryDescription: "Japanese starters",
          items: [
            { name: "Edamame", description: "Steamed soybeans with sea salt", price: 4.99, isAvailable: true },
            { name: "Gyoza", description: "Pan-fried dumplings (6 pieces)", price: 6.99, isAvailable: true },
          ],
        },
      ],
    },
    // SF Restaurants
    {
      email: "burger-sf@demo.com",
      countryCode: "US",
      cityCode: "SF",
      restaurantName: "Golden Gate Burgers",
      cuisineType: "American",
      description: "Gourmet burgers made with locally sourced ingredients",
      address: "789 Market Street, San Francisco, CA 94103",
      averageRating: 4.6,
      totalRatings: 198,
      menu: [
        {
          categoryName: "Burgers",
          categoryDescription: "100% grass-fed beef burgers",
          items: [
            { name: "Classic Cheeseburger", description: "Beef patty, cheddar, lettuce, tomato, onion", price: 12.99, isAvailable: true },
            { name: "Bacon BBQ Burger", description: "Beef patty, bacon, BBQ sauce, onion rings", price: 14.99, isAvailable: true },
            { name: "Veggie Burger", description: "House-made veggie patty with avocado", price: 11.99, isAvailable: true },
          ],
        },
        {
          categoryName: "Sides",
          categoryDescription: "Delicious accompaniments",
          items: [
            { name: "French Fries", description: "Crispy golden fries", price: 4.99, isAvailable: true },
            { name: "Onion Rings", description: "Beer-battered onion rings", price: 5.99, isAvailable: true },
          ],
        },
      ],
    },
    {
      email: "mexican-sf@demo.com",
      countryCode: "US",
      cityCode: "SF",
      restaurantName: "Mission Tacos",
      cuisineType: "Mexican",
      description: "Authentic Mission-style burritos and tacos",
      address: "321 Mission Street, San Francisco, CA 94110",
      averageRating: 4.5,
      totalRatings: 412,
      menu: [
        {
          categoryName: "Tacos",
          categoryDescription: "Soft or hard shell tacos",
          items: [
            { name: "Carne Asada Taco", description: "Grilled steak, onions, cilantro, salsa", price: 4.99, isAvailable: true },
            { name: "Chicken Taco", description: "Grilled chicken, lettuce, cheese, sour cream", price: 4.49, isAvailable: true },
            { name: "Fish Taco", description: "Battered fish, cabbage, chipotle sauce", price: 5.49, isAvailable: true },
          ],
        },
        {
          categoryName: "Burritos",
          categoryDescription: "Massive Mission-style burritos",
          items: [
            { name: "Super Burrito", description: "Choice of meat, rice, beans, cheese, sour cream, guacamole", price: 11.99, isAvailable: true },
            { name: "Vegetarian Burrito", description: "Black beans, rice, cheese, vegetables", price: 9.99, isAvailable: true },
          ],
        },
      ],
    },
    // Dhaka Restaurants
    {
      email: "biryani-dhk@demo.com",
      countryCode: "BD",
      cityCode: "DHK",
      restaurantName: "Sultan's Biryani House",
      cuisineType: "Bangladeshi",
      description: "Traditional Dhaka-style biryani and kebabs",
      address: "12 Gulshan Avenue, Dhaka 1212",
      averageRating: 4.9,
      totalRatings: 567,
      menu: [
        {
          categoryName: "Biryani",
          categoryDescription: "Aromatic rice dishes with meat",
          items: [
            { name: "Chicken Biryani", description: "Fragrant basmati rice with tender chicken", price: 350, isAvailable: true },
            { name: "Mutton Biryani", description: "Traditional mutton biryani with spices", price: 450, isAvailable: true },
            { name: "Vegetable Biryani", description: "Mixed vegetables with saffron rice", price: 280, isAvailable: true },
          ],
        },
        {
          categoryName: "Kebabs",
          categoryDescription: "Grilled meat specialties",
          items: [
            { name: "Chicken Tikka", description: "Marinated chicken pieces grilled to perfection", price: 250, isAvailable: true },
            { name: "Seekh Kebab", description: "Spiced minced meat on skewers", price: 220, isAvailable: true },
          ],
        },
        {
          categoryName: "Drinks",
          categoryDescription: "Traditional beverages",
          items: [
            { name: "Lassi", description: "Sweet yogurt drink", price: 80, isAvailable: true },
            { name: "Masala Chai", description: "Spiced milk tea", price: 50, isAvailable: true },
          ],
        },
      ],
    },
    {
      email: "curry-dhk@demo.com",
      countryCode: "BD",
      cityCode: "DHK",
      restaurantName: "Dhaka Curry Kitchen",
      cuisineType: "Indian",
      description: "North Indian and Bengali curry specialties",
      address: "45 Dhanmondi Road, Dhaka 1205",
      averageRating: 4.7,
      totalRatings: 423,
      menu: [
        {
          categoryName: "Curries",
          categoryDescription: "Rich and flavorful curry dishes",
          items: [
            { name: "Butter Chicken", description: "Creamy tomato-based chicken curry", price: 320, isAvailable: true },
            { name: "Lamb Rogan Josh", description: "Tender lamb in aromatic spices", price: 420, isAvailable: true },
            { name: "Paneer Tikka Masala", description: "Cottage cheese in spiced tomato gravy", price: 280, isAvailable: true },
          ],
        },
        {
          categoryName: "Breads",
          categoryDescription: "Freshly baked Indian breads",
          items: [
            { name: "Naan", description: "Traditional tandoor-baked bread", price: 40, isAvailable: true },
            { name: "Garlic Naan", description: "Naan with garlic and butter", price: 60, isAvailable: true },
            { name: "Roti", description: "Whole wheat flatbread", price: 30, isAvailable: true },
          ],
        },
      ],
    },
  ];

  for (const restaurantData of demoRestaurants) {
    try {
      // Find or create user
      let user = await prisma.user.findUnique({ where: { email: restaurantData.email } });
      
      if (!user) {
        const passwordHash = await bcrypt.hash("demo123", 10);
        user = await prisma.user.create({
          data: {
            email: restaurantData.email,
            passwordHash,
            role: "restaurant",
            countryCode: restaurantData.countryCode,
          },
        });
      }

      // Find or create restaurant profile
      let restaurantProfile = await prisma.restaurantProfile.findUnique({ where: { userId: user.id } });
      
      if (!restaurantProfile) {
        restaurantProfile = await prisma.restaurantProfile.create({
          data: {
            userId: user.id,
            restaurantName: restaurantData.restaurantName,
            address: restaurantData.address,
            cuisineType: restaurantData.cuisineType,
            description: restaurantData.description,
            cityCode: restaurantData.cityCode,
            averageRating: restaurantData.averageRating,
            totalRatings: restaurantData.totalRatings,
            isVerified: true,
            isActive: true,
            isDemo: true,
          },
        });

        // Create wallet
        await prisma.restaurantWallet.create({ data: { restaurantId: restaurantProfile.id } });
      } else {
        // Update existing profile
        restaurantProfile = await prisma.restaurantProfile.update({
          where: { id: restaurantProfile.id },
          data: {
            restaurantName: restaurantData.restaurantName,
            address: restaurantData.address,
            cuisineType: restaurantData.cuisineType,
            description: restaurantData.description,
            cityCode: restaurantData.cityCode,
            averageRating: restaurantData.averageRating,
            totalRatings: restaurantData.totalRatings,
            isVerified: true,
            isActive: true,
            isDemo: true,
          },
        });
      }

      // Create menu categories and items
      for (let catIndex = 0; catIndex < restaurantData.menu.length; catIndex++) {
        const catData = restaurantData.menu[catIndex];
        
        let category = await prisma.menuCategory.findFirst({
          where: {
            restaurantId: restaurantProfile.id,
            name: catData.categoryName,
          },
        });

        if (!category) {
          category = await prisma.menuCategory.create({
            data: {
              restaurantId: restaurantProfile.id,
              name: catData.categoryName,
              description: catData.categoryDescription || null,
              displayOrder: catIndex,
              isActive: true,
              isDemo: true,
            },
          });
        }

        // Create menu items
        for (let itemIndex = 0; itemIndex < catData.items.length; itemIndex++) {
          const itemData = catData.items[itemIndex];
          
          const existingItem = await prisma.menuItem.findFirst({
            where: {
              categoryId: category.id,
              name: itemData.name,
            },
          });

          if (!existingItem) {
            await prisma.menuItem.create({
              data: {
                restaurantId: restaurantProfile.id,
                categoryId: category.id,
                name: itemData.name,
                description: itemData.description || null,
                price: itemData.price,
                isAvailable: itemData.isAvailable,
                displayOrder: itemIndex,
                isActive: true,
                isDemo: true,
              },
            });
          }
        }
      }

      console.log(`  ✓ ${restaurantData.restaurantName} (${restaurantData.cityCode}) - created with ${restaurantData.menu.length} categories`);
    } catch (error: any) {
      console.error(`  ✗ ${restaurantData.restaurantName} - error: ${error.message}`);
    }
  }

  console.log("\n✅ Demo restaurants and menus seeded successfully!\n");
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
