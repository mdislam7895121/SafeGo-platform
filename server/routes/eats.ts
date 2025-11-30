import { Router, type Request, type Response } from "express";
import { prisma } from "../db";

const router = Router();

router.get("/restaurants", async (req: Request, res: Response) => {
  try {
    const cuisineType = req.query.cuisineType as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const openNow = req.query.openNow === 'true';
    const search = req.query.search as string | undefined;

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
      isOpen: isRestaurantOpen(restaurant.hours),
      isFavorite: false,
    }));

    if (openNow) {
      formattedRestaurants = formattedRestaurants.filter(r => r.isOpen);
    }

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

export default router;
