import { Router, type Request, type Response } from "express";
import { prisma } from "../db";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { DayOfWeek } from "@prisma/client";

const router = Router();

// Demo restaurant data for seeding
// Using local stock images for better reliability
const DEMO_RESTAURANTS = [
  // Bangladesh restaurants
  {
    countryCode: "BD",
    cityCode: "DHK",
    restaurantName: "Dhaka Biryani House",
    cuisineType: "Indian",
    description: "Authentic Hyderabadi biryani and traditional Bengali cuisine. Our recipes have been passed down for generations.",
    address: "123 Gulshan Avenue, Dhaka 1212",
    coverPhotoUrl: "/attached_assets/stock_images/indian_biryani_resta_ff5f6183.jpg",
    logoUrl: "/attached_assets/stock_images/indian_restaurant_lo_e339b808.jpg",
    averageRating: 4.7,
    totalRatings: 328,
    menuCategories: [
      {
        name: "Signature Biryanis",
        description: "Our world-famous biryanis",
        items: [
          { name: "Hyderabadi Chicken Biryani", description: "Aromatic basmati rice with tender chicken, saffron, and secret spices", price: 450, imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=300&fit=crop" },
          { name: "Mutton Kacchi Biryani", description: "Traditional slow-cooked mutton biryani with caramelized onions", price: 650, imageUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&h=300&fit=crop" },
          { name: "Vegetable Dum Biryani", description: "Mixed vegetables in fragrant rice with paneer and nuts", price: 350, imageUrl: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400&h=300&fit=crop" },
        ],
      },
      {
        name: "Appetizers",
        description: "Start your meal right",
        items: [
          { name: "Seekh Kebab", description: "Grilled minced meat skewers with mint chutney", price: 280, imageUrl: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop" },
          { name: "Chicken Tikka", description: "Marinated chicken pieces grilled to perfection", price: 320, imageUrl: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&h=300&fit=crop" },
          { name: "Onion Pakora", description: "Crispy onion fritters with spicy batter", price: 120, imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop" },
        ],
      },
      {
        name: "Beverages",
        description: "Refreshing drinks",
        items: [
          { name: "Mango Lassi", description: "Creamy yogurt drink with fresh mango", price: 80, imageUrl: "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&h=300&fit=crop" },
          { name: "Masala Chai", description: "Authentic spiced tea with milk", price: 40, imageUrl: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400&h=300&fit=crop" },
        ],
      },
    ],
  },
  {
    countryCode: "BD",
    cityCode: "DHK",
    restaurantName: "Bengal Tiger Kitchen",
    cuisineType: "Bengali",
    description: "Traditional Bengali home cooking with a modern twist. Fresh river fish and authentic flavors.",
    address: "45 Dhanmondi Road 27, Dhaka 1205",
    coverPhotoUrl: "/attached_assets/stock_images/indian_curry_restaur_90b44af3.jpg",
    logoUrl: "/attached_assets/stock_images/butter_chicken_cream_4571bd1c.jpg",
    averageRating: 4.5,
    totalRatings: 215,
    menuCategories: [
      {
        name: "Fish Specialties",
        description: "Fresh catch from Bangladesh rivers",
        items: [
          { name: "Hilsa Fish Curry", description: "National fish of Bangladesh in mustard sauce", price: 550, imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop" },
          { name: "Rohu Fish Fry", description: "Crispy fried rohu with spices", price: 380, imageUrl: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop" },
          { name: "Prawn Malai Curry", description: "Creamy coconut curry with jumbo prawns", price: 480, imageUrl: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop" },
        ],
      },
      {
        name: "Rice & Breads",
        description: "Perfect accompaniments",
        items: [
          { name: "Plain Basmati Rice", description: "Fluffy aromatic basmati rice", price: 80, imageUrl: "https://images.unsplash.com/photo-1516684732162-798a0062be99?w=400&h=300&fit=crop" },
          { name: "Butter Naan", description: "Soft tandoor-baked bread with butter", price: 40, imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop" },
          { name: "Paratha", description: "Flaky layered flatbread", price: 35, imageUrl: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop" },
        ],
      },
      {
        name: "Desserts",
        description: "Sweet endings",
        items: [
          { name: "Rasmalai", description: "Soft cheese dumplings in sweet cream", price: 120, imageUrl: "https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=400&h=300&fit=crop" },
          { name: "Mishti Doi", description: "Traditional Bengali sweet yogurt", price: 80, imageUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop" },
        ],
      },
    ],
  },
  // United States restaurants
  {
    countryCode: "US",
    cityCode: "NYC",
    restaurantName: "Manhattan Burger Co.",
    cuisineType: "American",
    description: "Gourmet burgers and craft beers in the heart of NYC. Premium Angus beef and fresh ingredients daily.",
    address: "789 Broadway, New York, NY 10003",
    coverPhotoUrl: "/attached_assets/stock_images/american_burger_rest_1ff44af7.jpg",
    logoUrl: "/attached_assets/stock_images/burger_restaurant_lo_b31136ce.jpg",
    averageRating: 4.6,
    totalRatings: 892,
    menuCategories: [
      {
        name: "Signature Burgers",
        description: "Our famous handcrafted burgers",
        items: [
          { name: "Classic Smash Burger", description: "Double smashed patties, American cheese, pickles, special sauce", price: 14.99, imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop" },
          { name: "Truffle Mushroom Burger", description: "Swiss cheese, sautéed mushrooms, truffle aioli", price: 18.99, imageUrl: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=400&h=300&fit=crop" },
          { name: "BBQ Bacon Burger", description: "Crispy bacon, cheddar, onion rings, BBQ sauce", price: 16.99, imageUrl: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&h=300&fit=crop" },
          { name: "Veggie Beyond Burger", description: "Plant-based patty, avocado, tomato, vegan mayo", price: 15.99, imageUrl: "https://images.unsplash.com/photo-1520072959219-c595dc870360?w=400&h=300&fit=crop" },
        ],
      },
      {
        name: "Sides",
        description: "Perfect additions",
        items: [
          { name: "Truffle Parmesan Fries", description: "Hand-cut fries with truffle oil and parmesan", price: 7.99, imageUrl: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop" },
          { name: "Onion Rings", description: "Beer-battered crispy onion rings", price: 6.99, imageUrl: "https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&h=300&fit=crop" },
          { name: "Mac & Cheese Bites", description: "Crispy fried mac and cheese balls", price: 8.99, imageUrl: "https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?w=400&h=300&fit=crop" },
        ],
      },
      {
        name: "Beverages",
        description: "Drinks and shakes",
        items: [
          { name: "Chocolate Milkshake", description: "Rich and creamy classic shake", price: 6.99, imageUrl: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=300&fit=crop" },
          { name: "Fresh Lemonade", description: "Freshly squeezed with mint", price: 4.99, imageUrl: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400&h=300&fit=crop" },
        ],
      },
    ],
  },
  {
    countryCode: "US",
    cityCode: "NYC",
    restaurantName: "Little Italy Pizzeria",
    cuisineType: "Italian",
    description: "Authentic Neapolitan pizza baked in our wood-fired oven. Family recipes from Naples since 1985.",
    address: "234 Mulberry Street, New York, NY 10012",
    coverPhotoUrl: "/attached_assets/stock_images/italian_pizzeria_res_da132bc0.jpg",
    logoUrl: "/attached_assets/stock_images/pizza_restaurant_log_4ebe32ac.jpg",
    averageRating: 4.8,
    totalRatings: 1247,
    menuCategories: [
      {
        name: "Classic Pizzas",
        description: "Traditional Neapolitan recipes",
        items: [
          { name: "Margherita", description: "San Marzano tomatoes, fresh mozzarella, basil, olive oil", price: 16.99, imageUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop" },
          { name: "Pepperoni", description: "Spicy pepperoni, mozzarella, tomato sauce", price: 18.99, imageUrl: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&h=300&fit=crop" },
          { name: "Quattro Formaggi", description: "Four cheese blend: mozzarella, gorgonzola, parmesan, fontina", price: 19.99, imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop" },
          { name: "Prosciutto e Rucola", description: "Prosciutto di Parma, arugula, shaved parmesan", price: 21.99, imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop" },
        ],
      },
      {
        name: "Pasta",
        description: "Handmade daily",
        items: [
          { name: "Spaghetti Carbonara", description: "Guanciale, egg, pecorino, black pepper", price: 17.99, imageUrl: "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=400&h=300&fit=crop" },
          { name: "Penne Arrabbiata", description: "Spicy tomato sauce with garlic and chili", price: 14.99, imageUrl: "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=400&h=300&fit=crop" },
          { name: "Fettuccine Alfredo", description: "Rich creamy parmesan sauce", price: 16.99, imageUrl: "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=400&h=300&fit=crop" },
        ],
      },
      {
        name: "Appetizers",
        description: "Start Italian style",
        items: [
          { name: "Bruschetta", description: "Toasted bread with tomatoes, basil, garlic", price: 9.99, imageUrl: "https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=400&h=300&fit=crop" },
          { name: "Caprese Salad", description: "Fresh mozzarella, tomatoes, basil, balsamic", price: 12.99, imageUrl: "https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=400&h=300&fit=crop" },
          { name: "Garlic Knots", description: "Fresh baked with garlic butter and herbs", price: 7.99, imageUrl: "https://images.unsplash.com/photo-1619531040576-f9416740661b?w=400&h=300&fit=crop" },
        ],
      },
      {
        name: "Desserts",
        description: "Dolci Italiani",
        items: [
          { name: "Tiramisu", description: "Classic coffee-soaked ladyfingers with mascarpone", price: 8.99, imageUrl: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&h=300&fit=crop" },
          { name: "Cannoli", description: "Crispy shell filled with sweet ricotta cream", price: 6.99, imageUrl: "https://images.unsplash.com/photo-1631206753348-db44968fd440?w=400&h=300&fit=crop" },
        ],
      },
    ],
  },
];

// POST /api/eats/seed-demo - Seed demo restaurants and menu items
router.post("/seed-demo", async (_req: Request, res: Response) => {
  try {
    const createdRestaurants: string[] = [];

    for (const demoData of DEMO_RESTAURANTS) {
      // Check if demo restaurant already exists
      const existingRestaurant = await prisma.restaurantProfile.findFirst({
        where: {
          restaurantName: demoData.restaurantName,
          isDemo: true,
        },
      });

      if (existingRestaurant) {
        createdRestaurants.push(`${demoData.restaurantName} (already exists)`);
        continue;
      }

      // Create demo user for restaurant
      const hashedPassword = await bcrypt.hash("demo123456", 10);
      const userEmail = `demo.${demoData.restaurantName.toLowerCase().replace(/[^a-z0-9]/g, '')}.${Date.now()}@safego-demo.com`;
      
      const demoUser = await prisma.user.create({
        data: {
          id: randomUUID(),
          email: userEmail,
          passwordHash: hashedPassword,
          role: "restaurant",
          countryCode: demoData.countryCode,
          isBlocked: false,
          isDemo: true,
        },
      });

      // Create restaurant profile
      const restaurant = await prisma.restaurantProfile.create({
        data: {
          id: randomUUID(),
          userId: demoUser.id,
          restaurantName: demoData.restaurantName,
          cuisineType: demoData.cuisineType,
          description: demoData.description,
          address: demoData.address,
          cityCode: demoData.cityCode,
          countryCode: demoData.countryCode,
          averageRating: demoData.averageRating,
          totalRatings: demoData.totalRatings,
          verificationStatus: "approved",
          isVerified: true,
          isActive: true,
          isSuspended: false,
          isDemo: true,
        },
      });

      // Create branding
      await prisma.restaurantBranding.create({
        data: {
          id: randomUUID(),
          restaurantId: restaurant.id,
          logoUrl: demoData.logoUrl,
          coverPhotoUrl: demoData.coverPhotoUrl,
          primaryColor: "#FF5722",
          secondaryColor: "#4CAF50",
          themeMode: "light",
        },
      });

      // Create operational settings
      await prisma.operationalSettings.create({
        data: {
          id: randomUUID(),
          restaurantId: restaurant.id,
          deliveryEnabled: true,
          pickupEnabled: true,
          preparationTimeMinutes: 25,
          minOrderAmount: demoData.countryCode === "BD" ? 200 : 10,
          isTemporarilyClosed: false,
        },
      });

      // Create hours (open every day 9am-10pm)
      const days: DayOfWeek[] = [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY, DayOfWeek.SUNDAY];
      for (const day of days) {
        await prisma.restaurantHours.create({
          data: {
            id: randomUUID(),
            restaurantId: restaurant.id,
            dayOfWeek: day,
            isClosed: false,
            openTime1: "09:00",
            closeTime1: "22:00",
          },
        });
      }

      // Create menu categories and items
      let categoryOrder = 0;
      for (const categoryData of demoData.menuCategories) {
        const category = await prisma.menuCategory.create({
          data: {
            id: randomUUID(),
            restaurantId: restaurant.id,
            name: categoryData.name,
            description: categoryData.description,
            displayOrder: categoryOrder++,
            isActive: true,
            isDemo: true,
          },
        });

        let itemOrder = 0;
        for (const itemData of categoryData.items) {
          await prisma.menuItem.create({
            data: {
              id: randomUUID(),
              restaurantId: restaurant.id,
              categoryId: category.id,
              name: itemData.name,
              shortDescription: itemData.description,
              basePrice: itemData.price,
              currency: demoData.countryCode === "BD" ? "BDT" : "USD",
              itemImageUrl: itemData.imageUrl,
              availabilityStatus: "available",
              displayOrder: itemOrder++,
              isDemo: true,
            },
          });
        }
      }

      createdRestaurants.push(demoData.restaurantName);
    }

    res.json({
      success: true,
      message: "Demo restaurants seeded successfully",
      restaurants: createdRestaurants,
    });
  } catch (error) {
    console.error("[Eats] Seed demo error:", error);
    res.status(500).json({ error: "Failed to seed demo data" });
  }
});

router.get("/restaurants", async (req: Request, res: Response) => {
  try {
    const cuisineType = req.query.cuisineType as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const openNow = req.query.openNow === 'true';
    const search = req.query.search as string | undefined;

    // Server-side validation logging for debugging restaurant queries
    console.log("[Eats] Restaurant query:", {
      cuisineType: cuisineType || 'all',
      sortBy: sortBy || 'default',
      openNow,
      search: search || null,
      timestamp: new Date().toISOString(),
    });

    const whereConditions: any = {
      isVerified: true,
      isActive: true,
      isSuspended: false,
      verificationStatus: "approved",
      user: {
        isBlocked: false,
      },
    };

    if (cuisineType && cuisineType !== 'all') {
      whereConditions.cuisineType = cuisineType;
    }

    if (search) {
      whereConditions.AND = [
        {
          OR: [
            { restaurantName: { contains: search, mode: 'insensitive' } },
            { cuisineType: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const restaurants = await prisma.restaurantProfile.findMany({
      where: whereConditions,
      select: {
        id: true,
        restaurantName: true,
        cuisineType: true,
        averageRating: true,
        totalRatings: true,
        cityCode: true,
        branding: {
          select: {
            logoUrl: true,
            coverPhotoUrl: true,
          },
        },
        hours: true,
      },
      orderBy: sortBy === 'rating' 
        ? { averageRating: 'desc' }
        : { restaurantName: 'asc' },
    });

    const isRestaurantOpen = (hours: Array<{ dayOfWeek: string; isClosed: boolean; openTime1: string | null; closeTime1: string | null; openTime2: string | null; closeTime2: string | null }>) => {
      if (!hours || hours.length === 0) return true;
      
      const now = new Date();
      const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const currentDay = dayNames[now.getDay()];
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      const todayHours = hours.find(h => h.dayOfWeek === currentDay);
      if (!todayHours || todayHours.isClosed) return false;
      
      if (todayHours.openTime1 && todayHours.closeTime1) {
        if (currentTime >= todayHours.openTime1 && currentTime <= todayHours.closeTime1) {
          return true;
        }
      }
      
      if (todayHours.openTime2 && todayHours.closeTime2) {
        if (currentTime >= todayHours.openTime2 && currentTime <= todayHours.closeTime2) {
          return true;
        }
      }
      
      return false;
    };

    let formattedRestaurants = restaurants.map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.restaurantName,
      cuisineType: restaurant.cuisineType || 'Various',
      cityCode: restaurant.cityCode || 'Nationwide',
      averageRating: restaurant.averageRating || 0,
      totalRatings: restaurant.totalRatings || 0,
      logoUrl: restaurant.branding?.logoUrl || null,
      coverPhotoUrl: restaurant.branding?.coverPhotoUrl || null,
      isOpen: isRestaurantOpen(restaurant.hours),
      isFavorite: false,
    }));

    if (openNow) {
      formattedRestaurants = formattedRestaurants.filter(r => r.isOpen);
    }

    // Log query results for debugging
    console.log("[Eats] Restaurant query results:", {
      totalFound: restaurants.length,
      afterFilters: formattedRestaurants.length,
      openNowFilter: openNow,
    });

    res.json({
      restaurants: formattedRestaurants,
      count: formattedRestaurants.length,
    });
  } catch (error) {
    console.error("[Public Eats] Get restaurants error:", error);
    res.status(500).json({ error: "Failed to fetch restaurants" });
  }
});

router.get("/restaurants/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: { isBlocked: true },
        },
      },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    if (!restaurant.isVerified || !restaurant.isActive || restaurant.isSuspended || 
        restaurant.verificationStatus !== "approved" || restaurant.user?.isBlocked) {
      return res.status(404).json({ error: "Restaurant not available" });
    }

    res.json({
      restaurant: {
        id: restaurant.id,
        name: restaurant.restaurantName,
        cuisineType: restaurant.cuisineType || 'Various',
        description: restaurant.description || '',
        address: restaurant.address,
        cityCode: restaurant.cityCode || 'Nationwide',
        averageRating: restaurant.averageRating || 0,
        totalRatings: restaurant.totalRatings || 0,
      },
    });
  } catch (error) {
    console.error("[Public Eats] Get restaurant details error:", error);
    res.status(500).json({ error: "Failed to fetch restaurant details" });
  }
});

router.get("/restaurants/:id/branding", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: { isBlocked: true },
        },
      },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    if (!restaurant.isVerified || !restaurant.isActive || restaurant.isSuspended || 
        restaurant.verificationStatus !== "approved" || restaurant.user?.isBlocked) {
      return res.status(404).json({ error: "Restaurant not available" });
    }

    const branding = await prisma.restaurantBranding.findUnique({
      where: { restaurantId: id },
    });

    const media = await prisma.restaurantMedia.findMany({
      where: { restaurantId: id },
      orderBy: { displayOrder: 'asc' },
    });

    res.json({
      branding: branding ? {
        logoUrl: branding.logoUrl,
        coverPhotoUrl: branding.coverPhotoUrl,
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        themeMode: branding.themeMode,
      } : {
        logoUrl: null,
        coverPhotoUrl: null,
        primaryColor: null,
        secondaryColor: null,
        themeMode: 'light',
      },
      media: media.map(m => ({
        id: m.id,
        url: m.fileUrl || '',
        type: m.fileType || 'image',
        category: m.category,
        displayOrder: m.displayOrder,
      })),
    });
  } catch (error) {
    console.error("[Public Eats] Get restaurant branding error:", error);
    res.status(500).json({ error: "Failed to fetch restaurant branding" });
  }
});

router.get("/restaurants/:id/menu", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: { isBlocked: true },
        },
      },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    if (!restaurant.isVerified || !restaurant.isActive || restaurant.isSuspended || 
        restaurant.verificationStatus !== "approved" || restaurant.user?.isBlocked) {
      return res.status(404).json({ error: "Restaurant not available" });
    }

    const categories = await prisma.menuCategory.findMany({
      where: {
        restaurantId: id,
        isActive: true,
      },
      include: {
        menuItems: {
          where: {
            availabilityStatus: 'available',
            isArchived: false,
          },
          orderBy: {
            displayOrder: 'asc',
          },
          include: {
            optionGroups: {
              where: { isDemo: false },
              include: {
                options: {
                  where: { isActive: true },
                  orderBy: { createdAt: 'asc' },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });

    const formattedCategories = categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description || '',
      items: category.menuItems.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.shortDescription || item.longDescription || '',
        price: parseFloat(item.basePrice.toString()),
        imageUrl: item.itemImageUrl,
        isAvailable: item.availabilityStatus === 'available',
        isVegetarian: item.isVegetarian,
        isSpicy: item.isSpicy,
        calories: item.calories,
        hasVariants: item.hasVariants || item.optionGroups.some(g => ['variant', 'size'].includes(g.type)),
        hasAddOns: item.hasAddOns || item.optionGroups.some(g => !['variant', 'size'].includes(g.type)),
        optionGroupsCount: item.optionGroups.length,
      })),
    }));

    res.json({
      restaurantId: id,
      restaurantName: restaurant.restaurantName,
      categories: formattedCategories,
      totalCategories: formattedCategories.length,
      totalItems: formattedCategories.reduce((sum: number, cat: typeof formattedCategories[0]) => sum + cat.items.length, 0),
    });
  } catch (error) {
    console.error("[Public Eats] Get restaurant menu error:", error);
    res.status(500).json({ error: "Failed to fetch restaurant menu" });
  }
});

// Step 44: Get menu item detail with variants, add-ons, and upsells
router.get("/restaurants/:restaurantId/items/:itemId", async (req: Request, res: Response) => {
  try {
    const { restaurantId, itemId } = req.params;

    // Verify restaurant is available
    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id: restaurantId },
      include: {
        user: { select: { isBlocked: true } },
      },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    if (!restaurant.isVerified || !restaurant.isActive || restaurant.isSuspended ||
        restaurant.verificationStatus !== "approved" || restaurant.user?.isBlocked) {
      return res.status(404).json({ error: "Restaurant not available" });
    }

    // Fetch item with option groups, options, and upsell links
    const item = await prisma.menuItem.findFirst({
      where: {
        id: itemId,
        restaurantId,
        isArchived: false,
        availabilityStatus: 'available',
      },
      include: {
        optionGroups: {
          where: { isDemo: false },
          include: {
            options: {
              where: { isActive: true },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        upsellLinksFrom: {
          where: { isActive: true },
          include: {
            toMenuItem: {
              select: {
                id: true,
                name: true,
                basePrice: true,
                itemImageUrl: true,
                shortDescription: true,
                availabilityStatus: true,
                isArchived: true,
              },
            },
          },
          orderBy: { priority: 'desc' },
          take: 6,
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    // Format option groups
    const optionGroups = item.optionGroups.map((group) => ({
      id: group.id,
      name: group.name,
      type: group.type as string,
      isRequired: group.isRequired,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      options: group.options.map((opt) => ({
        id: opt.id,
        label: opt.label,
        priceDelta: parseFloat(opt.priceDelta.toString()),
        isDefault: opt.isDefault,
        isActive: opt.isActive,
      })),
    }));

    // Format upsell items (filter out unavailable items)
    const upsellItems = item.upsellLinksFrom
      .filter((link) => 
        link.toMenuItem.availabilityStatus === 'available' && 
        !link.toMenuItem.isArchived
      )
      .map((link) => ({
        id: link.toMenuItem.id,
        name: link.toMenuItem.name,
        price: parseFloat(link.toMenuItem.basePrice.toString()),
        imageUrl: link.toMenuItem.itemImageUrl,
        shortDescription: link.toMenuItem.shortDescription,
      }));

    res.json({
      id: item.id,
      restaurantId: item.restaurantId,
      name: item.name,
      shortDescription: item.shortDescription,
      longDescription: item.longDescription,
      basePrice: parseFloat(item.basePrice.toString()),
      currency: item.currency,
      imageUrl: item.itemImageUrl,
      isVegetarian: item.isVegetarian,
      isVegan: item.isVegan,
      isHalal: item.isHalal,
      isSpicy: item.isSpicy,
      calories: item.calories,
      preparationTimeMinutes: item.preparationTimeMinutes,
      hasVariants: item.hasVariants || optionGroups.some(g => ['variant', 'size'].includes(g.type)),
      hasAddOns: item.hasAddOns || optionGroups.some(g => !['variant', 'size'].includes(g.type)),
      optionGroups,
      upsellItems,
    });
  } catch (error) {
    console.error("[Public Eats] Get item detail error:", error);
    res.status(500).json({ error: "Failed to fetch item details" });
  }
});

export default router;
