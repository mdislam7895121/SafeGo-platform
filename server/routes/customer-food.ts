import { Router } from "express";
import { prisma } from "../db";
import { authenticateToken, type AuthRequest } from "../middleware/auth";

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// ====================================================
// GET /api/customer/food/restaurants
// List all verified, active restaurants (customer only)
// Filtered by jurisdiction (cityCode)
// ====================================================
router.get("/restaurants", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can browse restaurants" });
    }

    // Get customer profile to check verification
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Enforce KYC verification for food ordering
    if (!customerProfile.isVerified) {
      return res.status(403).json({ 
        error: "You must complete KYC verification to order food",
        requiresVerification: true,
      });
    }

    // Get customer's country and city for jurisdiction filtering
    const customerCountryCode = customerProfile.user.countryCode;
    const customerCityCode = customerProfile.cityCode; // Customer's city (may be null)

    // Optional filters from query
    const cuisineType = req.query.cuisineType as string | undefined;
    const sortBy = req.query.sortBy as string | undefined; // 'rating' or 'name'

    // Build filter conditions
    const whereConditions: any = {
      isVerified: true,
      isActive: true,
      isSuspended: false,
    };

    // Apply jurisdiction filter: match customer's country
    whereConditions.user = {
      countryCode: customerCountryCode,
    };

    // City-level jurisdiction filter:
    // - If customer has a cityCode, show: restaurants in their city OR nationwide restaurants (cityCode = null)
    // - If customer has no cityCode, show only nationwide restaurants (cityCode = null)
    if (customerCityCode) {
      whereConditions.OR = [
        { cityCode: customerCityCode }, // Restaurants in customer's city
        { cityCode: null },              // Nationwide restaurants
      ];
    } else {
      whereConditions.cityCode = null; // Only nationwide restaurants
    }

    // Optional cuisine filter
    if (cuisineType) {
      whereConditions.cuisineType = cuisineType;
    }

    // Query restaurants
    const restaurants = await prisma.restaurantProfile.findMany({
      where: whereConditions,
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
      },
      orderBy: sortBy === 'rating' 
        ? { averageRating: 'desc' }
        : { restaurantName: 'asc' },
    });

    // Format response (customer-facing only, no internal fields)
    const formattedRestaurants = restaurants.map((restaurant: typeof restaurants[0]) => ({
      id: restaurant.id,
      name: restaurant.restaurantName,
      cuisineType: restaurant.cuisineType || 'Not specified',
      description: restaurant.description || '',
      address: restaurant.address,
      cityCode: restaurant.cityCode || 'Nationwide',
      averageRating: restaurant.averageRating || 0,
      totalRatings: restaurant.totalRatings || 0,
    }));

    res.json({
      restaurants: formattedRestaurants,
      count: formattedRestaurants.length,
    });
  } catch (error) {
    console.error("[Customer Food] Get restaurants error:", error);
    res.status(500).json({ error: "Failed to fetch restaurants" });
  }
});

// ====================================================
// GET /api/customer/food/restaurants/:id
// Get specific restaurant details (customer only)
// ====================================================
router.get("/restaurants/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can view restaurant details" });
    }

    // Get customer profile to check verification
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Enforce KYC verification
    if (!customerProfile.isVerified) {
      return res.status(403).json({ 
        error: "You must complete KYC verification to order food",
        requiresVerification: true,
      });
    }

    // Get restaurant
    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Verify restaurant is available for this customer
    if (!restaurant.isVerified || !restaurant.isActive || restaurant.isSuspended) {
      return res.status(404).json({ error: "Restaurant not available" });
    }

    // Verify jurisdiction match (country level)
    if (restaurant.user.countryCode !== customerProfile.user.countryCode) {
      return res.status(403).json({ error: "Restaurant not available in your country" });
    }

    // Verify jurisdiction match (city level)
    const customerCityCode = customerProfile.cityCode;
    const restaurantCityCode = restaurant.cityCode;

    // If restaurant has a specific cityCode, customer must be in that city
    if (restaurantCityCode) {
      if (!customerCityCode || customerCityCode !== restaurantCityCode) {
        return res.status(403).json({ error: "Restaurant not available in your city" });
      }
    }
    // If restaurant is nationwide (cityCode = null) but customer has a city, that's OK
    // If customer has no city, they can only access nationwide restaurants (already handled)

    // Format response (customer-facing only)
    res.json({
      restaurant: {
        id: restaurant.id,
        name: restaurant.restaurantName,
        cuisineType: restaurant.cuisineType || 'Not specified',
        description: restaurant.description || '',
        address: restaurant.address,
        cityCode: restaurant.cityCode || 'Nationwide',
        averageRating: restaurant.averageRating || 0,
        totalRatings: restaurant.totalRatings || 0,
      },
    });
  } catch (error) {
    console.error("[Customer Food] Get restaurant details error:", error);
    res.status(500).json({ error: "Failed to fetch restaurant details" });
  }
});

// ====================================================
// GET /api/customer/food/restaurants/:id/menu
// Get restaurant menu with categories and items (customer only)
// ====================================================
router.get("/restaurants/:id/menu", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can view restaurant menus" });
    }

    // Get customer profile to check verification
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Enforce KYC verification
    if (!customerProfile.isVerified) {
      return res.status(403).json({ 
        error: "You must complete KYC verification to order food",
        requiresVerification: true,
      });
    }

    // Get restaurant
    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Verify restaurant is available
    if (!restaurant.isVerified || !restaurant.isActive || restaurant.isSuspended) {
      return res.status(404).json({ error: "Restaurant not available" });
    }

    // Verify jurisdiction match (country level)
    if (restaurant.user.countryCode !== customerProfile.user.countryCode) {
      return res.status(403).json({ error: "Restaurant not available in your country" });
    }

    // Verify jurisdiction match (city level)
    const customerCityCode = customerProfile.cityCode;
    const restaurantCityCode = restaurant.cityCode;

    // If restaurant has a specific cityCode, customer must be in that city
    if (restaurantCityCode) {
      if (!customerCityCode || customerCityCode !== restaurantCityCode) {
        return res.status(403).json({ error: "Restaurant not available in your city" });
      }
    }
    // If restaurant is nationwide (cityCode = null) but customer has a city, that's OK
    // If customer has no city, they can only access nationwide restaurants (already handled)

    // Get menu categories with items
    const categories = await prisma.menuCategory.findMany({
      where: {
        restaurantId: id,
        isActive: true,
      },
      include: {
        menuItems: {
          where: {
            isActive: true,
          },
          orderBy: {
            displayOrder: 'asc',
          },
        },
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });

    // Format response (customer-facing only)
    const formattedCategories = categories.map((category: typeof categories[0]) => ({
      id: category.id,
      name: category.name,
      description: category.description || '',
      items: category.menuItems.map((item: typeof category.menuItems[0]) => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        price: parseFloat(item.price.toString()), // Convert Decimal to number
        imageUrl: item.imageUrl,
        isAvailable: item.isAvailable,
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
    console.error("[Customer Food] Get restaurant menu error:", error);
    res.status(500).json({ error: "Failed to fetch restaurant menu" });
  }
});

// ====================================================
// GET /api/customer/food/restaurants/:id/branding
// Get restaurant branding and media gallery (customer only)
// Returns only visible media (not hidden/flagged by admin)
// ====================================================
router.get("/restaurants/:id/branding", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can view restaurant branding" });
    }

    // Get customer profile to check verification
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Enforce KYC verification
    if (!customerProfile.isVerified) {
      return res.status(403).json({ 
        error: "You must complete KYC verification to order food",
        requiresVerification: true,
      });
    }

    // Get restaurant
    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
      },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Verify restaurant is available
    if (!restaurant.isVerified || !restaurant.isActive || restaurant.isSuspended) {
      return res.status(404).json({ error: "Restaurant not available" });
    }

    // Verify jurisdiction match
    if (restaurant.user.countryCode !== customerProfile.user.countryCode) {
      return res.status(403).json({ error: "Restaurant not available in your country" });
    }

    // Get branding (or create default)
    let branding = await prisma.restaurantBranding.findUnique({
      where: { restaurantId: id },
    });

    if (!branding) {
      branding = await prisma.restaurantBranding.create({
        data: {
          restaurantId: id,
          themeMode: "light",
        },
      });
    }

    // Get visible media only (not hidden by admin, not flagged)
    const media = await prisma.restaurantMedia.findMany({
      where: {
        restaurantId: id,
        isHidden: false,
        isFlagged: false,
      },
      orderBy: {
        displayOrder: 'asc',
      },
      select: {
        id: true,
        filePath: true,
        fileUrl: true,
        fileType: true,
        category: true,
        displayOrder: true,
        createdAt: true,
      },
    });

    // Format response (customer-facing only, no admin fields)
    res.json({
      branding: {
        logoUrl: branding.logoUrl,
        coverPhotoUrl: branding.coverPhotoUrl,
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        themeMode: branding.themeMode,
      },
      media: media.map((item) => ({
        id: item.id,
        url: item.fileUrl || item.filePath,
        type: item.fileType,
        category: item.category,
        displayOrder: item.displayOrder,
      })),
    });
  } catch (error) {
    console.error("[Customer Food] Get restaurant branding error:", error);
    res.status(500).json({ error: "Failed to fetch restaurant branding" });
  }
});

export default router;
