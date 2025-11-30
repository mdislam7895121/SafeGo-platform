import { Router } from "express";
import { randomUUID } from "node:crypto";
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
    const openNow = req.query.openNow === 'true';
    const favoritesOnly = req.query.favoritesOnly === 'true';

    // Build filter conditions
    const whereConditions: any = {
      isVerified: true,
      isActive: true,
      isSuspended: false,
      verificationStatus: "approved",
    };

    // Apply jurisdiction filter: match customer's country AND user not blocked
    whereConditions.user = {
      countryCode: customerCountryCode,
      isBlocked: false,
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

    // Favorites filter - filter to only favorited restaurants
    if (favoritesOnly) {
      whereConditions.favoritedBy = {
        some: {
          customerProfileId: customerProfile.id,
        },
      };
    }

    // Query restaurants with hours for isOpen calculation
    const restaurants = await prisma.restaurantProfile.findMany({
      where: whereConditions,
      include: {
        user: {
          select: {
            countryCode: true,
          },
        },
        branding: {
          select: {
            logoUrl: true,
            primaryColor: true,
          },
        },
        hours: true, // Include operating hours for isOpen calculation
        favoritedBy: {
          where: {
            customerProfileId: customerProfile.id,
          },
        },
      },
      orderBy: sortBy === 'rating' 
        ? { averageRating: 'desc' }
        : { restaurantName: 'asc' },
    });

    // Helper function to check if restaurant is open now
    const isRestaurantOpen = (hours: Array<{ dayOfWeek: string; isClosed: boolean; openTime1: string | null; closeTime1: string | null; openTime2: string | null; closeTime2: string | null }>) => {
      if (!hours || hours.length === 0) return true; // No hours defined = always open
      
      const now = new Date();
      const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const currentDay = dayNames[now.getDay()];
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      const todayHours = hours.find(h => h.dayOfWeek === currentDay);
      if (!todayHours || todayHours.isClosed) return false;
      
      // Check first time slot
      if (todayHours.openTime1 && todayHours.closeTime1) {
        if (currentTime >= todayHours.openTime1 && currentTime <= todayHours.closeTime1) {
          return true;
        }
      }
      
      // Check second time slot (split shifts)
      if (todayHours.openTime2 && todayHours.closeTime2) {
        if (currentTime >= todayHours.openTime2 && currentTime <= todayHours.closeTime2) {
          return true;
        }
      }
      
      return false;
    };

    // Format response (customer-facing only - display-safe fields only)
    let formattedRestaurants = restaurants.map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.restaurantName,
      cuisineType: restaurant.cuisineType || 'Various',
      cityCode: restaurant.cityCode || 'Nationwide',
      averageRating: restaurant.averageRating || 0,
      totalRatings: restaurant.totalRatings || 0,
      logoUrl: restaurant.branding?.logoUrl || null,
      isOpen: isRestaurantOpen(restaurant.hours),
      isFavorite: restaurant.favoritedBy.length > 0,
    }));

    // Filter to only open restaurants if openNow is true
    if (openNow) {
      formattedRestaurants = formattedRestaurants.filter(r => r.isOpen);
    }

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
            isBlocked: true,
          },
        },
      },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Verify restaurant is available for this customer
    if (!restaurant.isVerified || !restaurant.isActive || restaurant.isSuspended ||
        restaurant.verificationStatus !== "approved" || restaurant.user.isBlocked) {
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

    // Get restaurant with user block status
    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            countryCode: true,
            isBlocked: true,
          },
        },
      },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Verify restaurant is available (including verificationStatus and user block status)
    if (!restaurant.isVerified || !restaurant.isActive || restaurant.isSuspended ||
        restaurant.verificationStatus !== "approved" || restaurant.user.isBlocked) {
      return res.status(404).json({ error: "Restaurant not available" });
    }

    // Verify jurisdiction match (country level)
    if (restaurant.user.countryCode !== customerProfile.user.countryCode) {
      return res.status(403).json({ error: "Restaurant not available in your country" });
    }

    // Verify jurisdiction match (city level) - allow nationwide restaurants (cityCode = null)
    const customerCityCode = customerProfile.cityCode;
    const restaurantCityCode = restaurant.cityCode;

    // If restaurant has a specific cityCode, customer must be in that city
    if (restaurantCityCode) {
      if (!customerCityCode || customerCityCode !== restaurantCityCode) {
        return res.status(403).json({ error: "Restaurant not available in your city" });
      }
    }
    // If restaurant is nationwide (cityCode = null), customer from any city can access it

    // Get menu categories with items
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
        },
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });

    // Format response (customer-facing only)
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

    // Get visible media only (not hidden by admin, not flagged, and has valid fileUrl)
    const media = await prisma.restaurantMedia.findMany({
      where: {
        restaurantId: id,
        isHidden: false,
        isFlagged: false,
        fileUrl: { not: null }, // Only return media with valid signed URLs
      },
      orderBy: {
        displayOrder: 'asc',
      },
      select: {
        id: true,
        fileUrl: true,
        fileType: true,
        category: true,
        displayOrder: true,
      },
    });

    // Format response (customer-facing only, no admin fields, only signed URLs)
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
        url: item.fileUrl!, // Safe to use ! because we filtered for non-null fileUrl
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

// ====================================================
// POST /api/customer/food/restaurants/:id/favorite
// Add a restaurant to customer's favorites
// ====================================================
router.post("/restaurants/:id/favorite", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can favorite restaurants" });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Check if restaurant exists and is active
    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id },
    });

    if (!restaurant || !restaurant.isVerified || !restaurant.isActive || restaurant.isSuspended) {
      return res.status(404).json({ error: "Restaurant not found or not available" });
    }

    // Check if already favorited
    const existingFavorite = await prisma.foodRestaurantFavorite.findUnique({
      where: {
        customerProfileId_restaurantId: {
          customerProfileId: customerProfile.id,
          restaurantId: id,
        },
      },
    });

    if (existingFavorite) {
      return res.status(400).json({ error: "Restaurant is already in favorites" });
    }

    // Create favorite
    await prisma.foodRestaurantFavorite.create({
      data: {
        customerProfileId: customerProfile.id,
        restaurantId: id,
      },
    });

    res.json({ success: true, isFavorite: true });
  } catch (error) {
    console.error("[Customer Food] Add favorite error:", error);
    res.status(500).json({ error: "Failed to add favorite" });
  }
});

// ====================================================
// DELETE /api/customer/food/restaurants/:id/favorite
// Remove a restaurant from customer's favorites
// ====================================================
router.delete("/restaurants/:id/favorite", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can manage favorites" });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Delete favorite (will silently succeed even if not found)
    await prisma.foodRestaurantFavorite.deleteMany({
      where: {
        customerProfileId: customerProfile.id,
        restaurantId: id,
      },
    });

    res.json({ success: true, isFavorite: false });
  } catch (error) {
    console.error("[Customer Food] Remove favorite error:", error);
    res.status(500).json({ error: "Failed to remove favorite" });
  }
});

// ====================================================
// GET /api/customer/food/orders/:id/reorder
// Get order items for reordering (adds to cart)
// ====================================================
router.get("/orders/:id/reorder", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can reorder" });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Get the order with restaurant info
    const order = await prisma.foodOrder.findUnique({
      where: { id },
      include: {
        restaurant: {
          include: {
            branding: true,
            hours: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Verify order belongs to customer
    if (order.customerId !== customerProfile.id) {
      return res.status(403).json({ error: "Order not found" });
    }

    // Verify restaurant is still active
    if (!order.restaurant.isVerified || !order.restaurant.isActive || order.restaurant.isSuspended) {
      return res.status(400).json({ error: "Restaurant is no longer available for orders" });
    }

    // Parse items from the order
    let items: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
      description?: string;
      imageUrl?: string;
      modifiers?: Array<{ name: string; price: number }>;
      specialInstructions?: string;
    }> = [];

    if (order.items) {
      try {
        items = JSON.parse(order.items);
      } catch {
        return res.status(400).json({ error: "Could not parse order items" });
      }
    }

    // Return cart payload for frontend
    res.json({
      restaurant: {
        id: order.restaurant.id,
        name: order.restaurant.restaurantName,
        cuisineType: order.restaurant.cuisineType,
        address: order.restaurant.address,
        logoUrl: order.restaurant.branding?.logoUrl || null,
        primaryColor: order.restaurant.branding?.primaryColor || null,
      },
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        description: item.description || '',
        imageUrl: item.imageUrl || null,
        modifiers: item.modifiers || [],
        specialInstructions: item.specialInstructions || '',
      })),
      originalOrderId: order.id,
    });
  } catch (error) {
    console.error("[Customer Food] Reorder error:", error);
    res.status(500).json({ error: "Failed to get reorder data" });
  }
});

// ====================================================
// CUSTOMER DELIVERY ADDRESSES - CRUD
// Multiple labeled addresses (Home, Work, Other)
// ====================================================

// GET /api/customer/food/addresses - List all saved addresses
router.get("/addresses", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can access addresses" });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const addresses = await prisma.customerAddress.findMany({
      where: { customerProfileId: customerProfile.id },
      orderBy: [
        { isDefault: 'desc' }, // Default address first
        { createdAt: 'desc' },
      ],
    });

    res.json({ addresses });
  } catch (error) {
    console.error("[Customer Food] Get addresses error:", error);
    res.status(500).json({ error: "Failed to fetch addresses" });
  }
});

// POST /api/customer/food/addresses - Create a new address
router.post("/addresses", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can add addresses" });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const { label, customLabel, address, lat, lng, placeId, apartment, instructions, isDefault } = req.body;

    // Validate required fields
    if (!label || !address || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "Label, address, latitude and longitude are required" });
    }

    // Validate label
    if (!['home', 'work', 'other'].includes(label)) {
      return res.status(400).json({ error: "Label must be home, work, or other" });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.customerAddress.updateMany({
        where: { 
          customerProfileId: customerProfile.id,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    // Check if this is the first address (auto-set as default)
    const existingAddressCount = await prisma.customerAddress.count({
      where: { customerProfileId: customerProfile.id },
    });

    const newAddress = await prisma.customerAddress.create({
      data: {
        customerProfileId: customerProfile.id,
        label,
        customLabel: label === 'other' ? customLabel : null,
        address,
        lat,
        lng,
        placeId,
        apartment,
        instructions,
        isDefault: existingAddressCount === 0 ? true : Boolean(isDefault),
      },
    });

    res.status(201).json({ address: newAddress });
  } catch (error) {
    console.error("[Customer Food] Create address error:", error);
    res.status(500).json({ error: "Failed to create address" });
  }
});

// PATCH /api/customer/food/addresses/:id - Update an address
router.patch("/addresses/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { id } = req.params;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can update addresses" });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Verify address belongs to customer
    const existingAddress = await prisma.customerAddress.findUnique({
      where: { id },
    });

    if (!existingAddress || existingAddress.customerProfileId !== customerProfile.id) {
      return res.status(404).json({ error: "Address not found" });
    }

    const { label, customLabel, address, lat, lng, placeId, apartment, instructions, isDefault } = req.body;

    // Validate label if provided
    if (label && !['home', 'work', 'other'].includes(label)) {
      return res.status(400).json({ error: "Label must be home, work, or other" });
    }

    // If setting as default, unset other defaults
    if (isDefault && !existingAddress.isDefault) {
      await prisma.customerAddress.updateMany({
        where: { 
          customerProfileId: customerProfile.id,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    const updatedAddress = await prisma.customerAddress.update({
      where: { id },
      data: {
        ...(label && { label }),
        ...(label === 'other' && { customLabel }),
        ...(label !== 'other' && { customLabel: null }),
        ...(address && { address }),
        ...(lat !== undefined && { lat }),
        ...(lng !== undefined && { lng }),
        ...(placeId !== undefined && { placeId }),
        ...(apartment !== undefined && { apartment }),
        ...(instructions !== undefined && { instructions }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    res.json({ address: updatedAddress });
  } catch (error) {
    console.error("[Customer Food] Update address error:", error);
    res.status(500).json({ error: "Failed to update address" });
  }
});

// DELETE /api/customer/food/addresses/:id - Delete an address
router.delete("/addresses/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { id } = req.params;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can delete addresses" });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Verify address belongs to customer
    const existingAddress = await prisma.customerAddress.findUnique({
      where: { id },
    });

    if (!existingAddress || existingAddress.customerProfileId !== customerProfile.id) {
      return res.status(404).json({ error: "Address not found" });
    }

    await prisma.customerAddress.delete({
      where: { id },
    });

    // If deleted address was default, set another as default
    if (existingAddress.isDefault) {
      const nextAddress = await prisma.customerAddress.findFirst({
        where: { customerProfileId: customerProfile.id },
        orderBy: { createdAt: 'desc' },
      });

      if (nextAddress) {
        await prisma.customerAddress.update({
          where: { id: nextAddress.id },
          data: { isDefault: true },
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[Customer Food] Delete address error:", error);
    res.status(500).json({ error: "Failed to delete address" });
  }
});

// PATCH /api/customer/food/addresses/:id/set-default - Set address as default
router.patch("/addresses/:id/set-default", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { id } = req.params;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can modify addresses" });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Verify address belongs to customer
    const existingAddress = await prisma.customerAddress.findUnique({
      where: { id },
    });

    if (!existingAddress || existingAddress.customerProfileId !== customerProfile.id) {
      return res.status(404).json({ error: "Address not found" });
    }

    // Unset all other defaults
    await prisma.customerAddress.updateMany({
      where: { 
        customerProfileId: customerProfile.id,
        isDefault: true,
      },
      data: { isDefault: false },
    });

    // Set this one as default
    const updatedAddress = await prisma.customerAddress.update({
      where: { id },
      data: { isDefault: true },
    });

    res.json({ address: updatedAddress });
  } catch (error) {
    console.error("[Customer Food] Set default address error:", error);
    res.status(500).json({ error: "Failed to set default address" });
  }
});

// ====================================================
// BLOCKED RESTAURANTS MANAGEMENT
// ====================================================

// GET /api/customer/food/blocked-restaurants - List blocked restaurants
router.get("/blocked-restaurants", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can view blocked restaurants" });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const blockedRestaurants = await prisma.customerBlockedRestaurant.findMany({
      where: { customerProfileId: customerProfile.id },
      include: {
        restaurant: {
          select: {
            id: true,
            restaurantName: true,
            cuisineType: true,
            averageRating: true,
            branding: {
              select: {
                logoUrl: true,
              },
            },
          },
        },
      },
      orderBy: { blockedAt: 'desc' },
    });

    res.json({
      blockedRestaurants: blockedRestaurants.map(br => ({
        id: br.id,
        restaurantId: br.restaurant.id,
        restaurantName: br.restaurant.restaurantName,
        cuisineType: br.restaurant.cuisineType,
        averageRating: br.restaurant.averageRating,
        logoUrl: br.restaurant.branding?.logoUrl,
        reason: br.blockReason,
        blockedAt: br.blockedAt,
      })),
    });
  } catch (error) {
    console.error("[Customer Food] List blocked restaurants error:", error);
    res.status(500).json({ error: "Failed to list blocked restaurants" });
  }
});

// POST /api/customer/food/blocked-restaurants - Block a restaurant
router.post("/blocked-restaurants", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { restaurantId, reason } = req.body;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can block restaurants" });
    }

    if (!restaurantId) {
      return res.status(400).json({ error: "Restaurant ID is required" });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Check if restaurant exists
    const restaurant = await prisma.restaurantProfile.findUnique({
      where: { id: restaurantId },
    });

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Check if already blocked
    const existingBlock = await prisma.customerBlockedRestaurant.findFirst({
      where: {
        customerProfileId: customerProfile.id,
        restaurantId: restaurantId,
      },
    });

    if (existingBlock) {
      return res.status(400).json({ error: "Restaurant is already blocked" });
    }

    // Create block record
    const blockedRestaurant = await prisma.customerBlockedRestaurant.create({
      data: {
        id: randomUUID(),
        customerProfileId: customerProfile.id,
        restaurantId: restaurantId,
        blockReason: reason || null,
      },
    });

    res.status(201).json({
      success: true,
      blockedRestaurant: {
        id: blockedRestaurant.id,
        restaurantId,
        restaurantName: restaurant.restaurantName,
        reason: blockedRestaurant.blockReason,
        blockedAt: blockedRestaurant.blockedAt,
      },
    });
  } catch (error) {
    console.error("[Customer Food] Block restaurant error:", error);
    res.status(500).json({ error: "Failed to block restaurant" });
  }
});

// DELETE /api/customer/food/blocked-restaurants/:id - Unblock a restaurant
router.delete("/blocked-restaurants/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { id } = req.params;

    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can unblock restaurants" });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Verify block record exists and belongs to customer
    const blockedRestaurant = await prisma.customerBlockedRestaurant.findUnique({
      where: { id },
    });

    if (!blockedRestaurant || blockedRestaurant.customerProfileId !== customerProfile.id) {
      return res.status(404).json({ error: "Blocked restaurant not found" });
    }

    await prisma.customerBlockedRestaurant.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("[Customer Food] Unblock restaurant error:", error);
    res.status(500).json({ error: "Failed to unblock restaurant" });
  }
});

export default router;
