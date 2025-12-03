import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { z } from "zod";
import { randomUUID } from "crypto";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { uploadShopImage, getFileUrl } from "../middleware/upload";

const router = Router();

// Apply authentication middleware to all shop-partner routes
router.use(authenticateToken);

// Shop image upload endpoint - must be before other routes
router.post("/upload-image", (req: AuthRequest, res: Response) => {
  uploadShopImage(req, res, async (err: any) => {
    try {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ 
            error: "ফাইলের আকার ৫ মেগাবাইটের বেশি হতে পারবে না",
            errorEn: "File size exceeds 5MB limit"
          });
        }
        return res.status(400).json({ 
          error: err.message || "ফাইল আপলোড ব্যর্থ হয়েছে",
          errorEn: err.message || "File upload failed"
        });
      }

      const userId = req.user?.userId;
      const userRole = req.user?.role;
      
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Allow both pending_shop_partner and shop_partner roles
      if (userRole !== "pending_shop_partner" && userRole !== "shop_partner") {
        return res.status(403).json({ error: "Only shop partners can upload images" });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ 
          error: "কোনো ফাইল নির্বাচন করা হয়নি",
          errorEn: "No file provided"
        });
      }

      // Validate image type from query param
      const imageType = req.query.type as string;
      if (!imageType || !["logo", "banner"].includes(imageType)) {
        return res.status(400).json({ 
          error: "অবৈধ ছবির ধরণ",
          errorEn: "Invalid image type. Must be 'logo' or 'banner'"
        });
      }

      // Generate the URL for the uploaded file
      const fileUrl = getFileUrl(file.filename);

      res.json({
        success: true,
        url: fileUrl,
        type: imageType,
        filename: file.filename,
        message: imageType === "logo" ? "লোগো আপলোড সফল হয়েছে" : "ব্যানার আপলোড সফল হয়েছে"
      });
    } catch (error) {
      console.error("Shop image upload error:", error);
      res.status(500).json({ 
        error: "ছবি আপলোড ব্যর্থ হয়েছে",
        errorEn: "Failed to upload image"
      });
    }
  });
});

const shopPartnerRegisterSchema = z.object({
  shopName: z.string().min(2, "দোকানের নাম কমপক্ষে ২ অক্ষরের হতে হবে"),
  shopType: z.enum(["grocery", "electronics", "fashion", "pharmacy", "general_store", "hardware", "beauty", "books", "sports", "other"], {
    errorMap: () => ({ message: "দোকানের ধরণ নির্বাচন করুন" }),
  }),
  shopDescription: z.string().optional(),
  shopAddress: z.string().min(5, "দোকানের ঠিকানা লিখুন"),
  shopLat: z.number().optional(),
  shopLng: z.number().optional(),
  ownerName: z.string().min(2, "মালিকের নাম লিখুন"),
  fatherName: z.string().min(2, "পিতার নাম লিখুন"),
  dateOfBirth: z.string().min(1, "জন্ম তারিখ নির্বাচন করুন").transform((val) => new Date(val)),
  presentAddress: z.string().min(5, "বর্তমান ঠিকানা লিখুন"),
  permanentAddress: z.string().min(5, "স্থায়ী ঠিকানা লিখুন"),
  nidNumber: z.string().min(10, "সঠিক জাতীয় পরিচয়পত্র নম্বর লিখুন"),
  emergencyContactName: z.string().min(2, "জরুরি যোগাযোগের নাম লিখুন"),
  emergencyContactPhone: z.string().min(10, "জরুরি যোগাযোগের ফোন নম্বর লিখুন"),
  emergencyContactRelation: z.string().optional(),
  tradeLicenseNumber: z.string().optional(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
  deliveryRadiusKm: z.number().optional(),
  minOrderAmount: z.number().optional(),
  avgPreparationMinutes: z.number().optional(),
  shopLogo: z.string().optional(),
  shopBanner: z.string().optional(),
});

const shopPartnerKycSchema = z.object({
  nidFrontImage: z.string().url("NID front image URL is required"),
  nidBackImage: z.string().url("NID back image URL is required"),
  tradeLicenseImage: z.string().url().optional(),
  shopLogo: z.string().url().optional(),
  shopBanner: z.string().url().optional(),
});

router.post("/register", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Allow both pending_shop_partner and shop_partner roles
    if (userRole !== "pending_shop_partner" && userRole !== "shop_partner") {
      return res.status(403).json({ error: "Only shop partners can access this endpoint" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { shopPartner: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.countryCode !== "BD") {
      return res.status(403).json({ error: "Shop Partner registration is only available in Bangladesh" });
    }

    // If user has final role (shop_partner), they can't re-register
    if (user.role === "shop_partner" && user.shopPartner) {
      return res.status(400).json({ error: "You are already approved as a Shop Partner" });
    }

    // For pending role, allow resubmission if profile exists but not yet approved
    if (user.shopPartner && user.shopPartner.verificationStatus === "approved") {
      return res.status(400).json({ error: "You are already approved as a Shop Partner" });
    }

    const parsed = shopPartnerRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parsed.error.errors 
      });
    }

    const data = parsed.data;

    // Use upsert to handle both new registration and resubmission for pending roles
    const shopPartner = await prisma.shopPartner.upsert({
      where: { userId },
      create: {
        id: randomUUID(),
        userId,
        shopName: data.shopName,
        shopType: data.shopType,
        shopDescription: data.shopDescription,
        shopAddress: data.shopAddress,
        shopLat: data.shopLat,
        shopLng: data.shopLng,
        ownerName: data.ownerName,
        fatherName: data.fatherName,
        dateOfBirth: data.dateOfBirth,
        presentAddress: data.presentAddress,
        permanentAddress: data.permanentAddress,
        nidNumber: data.nidNumber,
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        emergencyContactRelation: data.emergencyContactRelation,
        tradeLicenseNumber: data.tradeLicenseNumber,
        openingTime: data.openingTime || "09:00",
        closingTime: data.closingTime || "21:00",
        deliveryRadiusKm: data.deliveryRadiusKm || 5,
        minOrderAmount: data.minOrderAmount,
        avgPreparationMinutes: data.avgPreparationMinutes || 30,
        shopLogo: data.shopLogo,
        shopBanner: data.shopBanner,
        verificationStatus: "pending",
        countryCode: "BD",
      },
      update: {
        shopName: data.shopName,
        shopType: data.shopType,
        shopDescription: data.shopDescription,
        shopAddress: data.shopAddress,
        shopLat: data.shopLat,
        shopLng: data.shopLng,
        ownerName: data.ownerName,
        fatherName: data.fatherName,
        dateOfBirth: data.dateOfBirth,
        presentAddress: data.presentAddress,
        permanentAddress: data.permanentAddress,
        nidNumber: data.nidNumber,
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        emergencyContactRelation: data.emergencyContactRelation,
        tradeLicenseNumber: data.tradeLicenseNumber,
        openingTime: data.openingTime || "09:00",
        closingTime: data.closingTime || "21:00",
        deliveryRadiusKm: data.deliveryRadiusKm || 5,
        minOrderAmount: data.minOrderAmount,
        avgPreparationMinutes: data.avgPreparationMinutes || 30,
        shopLogo: data.shopLogo,
        shopBanner: data.shopBanner,
        verificationStatus: "pending",
        rejectionReason: null,
      },
    });

    const isUpdate = user.shopPartner !== null;
    res.status(isUpdate ? 200 : 201).json({
      message: isUpdate 
        ? "Shop Partner registration updated successfully" 
        : "Shop Partner registration submitted successfully",
      shopPartner: {
        id: shopPartner.id,
        shopName: shopPartner.shopName,
        verificationStatus: shopPartner.verificationStatus,
      },
    });
  } catch (error) {
    console.error("Shop Partner registration error:", error);
    res.status(500).json({ error: "Failed to register shop partner" });
  }
});

router.post("/kyc", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { userId },
    });

    if (!shopPartner) {
      return res.status(404).json({ error: "Shop Partner profile not found. Please register first." });
    }

    if (shopPartner.verificationStatus === "approved") {
      return res.status(400).json({ error: "Your shop is already verified" });
    }

    const parsed = shopPartnerKycSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parsed.error.errors 
      });
    }

    const data = parsed.data;

    const updated = await prisma.shopPartner.update({
      where: { id: shopPartner.id },
      data: {
        nidFrontImage: data.nidFrontImage,
        nidBackImage: data.nidBackImage,
        tradeLicenseImage: data.tradeLicenseImage,
        shopLogo: data.shopLogo,
        shopBanner: data.shopBanner,
        verificationStatus: "under_review",
        updatedAt: new Date(),
      },
    });

    res.json({
      message: "KYC documents uploaded successfully. Your application is under review.",
      shopPartner: {
        id: updated.id,
        shopName: updated.shopName,
        verificationStatus: updated.verificationStatus,
      },
    });
  } catch (error) {
    console.error("Shop Partner KYC error:", error);
    res.status(500).json({ error: "Failed to upload KYC documents" });
  }
});

router.get("/profile", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { userId },
      include: {
        products: {
          where: { isActive: true },
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            products: true,
            orders: true,
          },
        },
      },
    });

    // Return null profile instead of 404 to allow frontend to redirect to setup
    if (!shopPartner) {
      return res.json({ profile: null, shopPartner: null });
    }

    const profileData = {
      id: shopPartner.id,
      shopName: shopPartner.shopName,
      shopType: shopPartner.shopType,
      shopDescription: shopPartner.shopDescription,
      shopAddress: shopPartner.shopAddress,
      shopLogo: shopPartner.shopLogo,
      shopBanner: shopPartner.shopBanner,
      verificationStatus: shopPartner.verificationStatus,
      rejectionReason: shopPartner.rejectionReason,
      isActive: shopPartner.isActive,
      isOpen: shopPartner.isOpen,
      openingTime: shopPartner.openingTime,
      closingTime: shopPartner.closingTime,
      deliveryRadiusKm: shopPartner.deliveryRadiusKm,
      minOrderAmount: shopPartner.minOrderAmount,
      commissionRate: shopPartner.commissionRate,
      walletBalance: shopPartner.walletBalance,
      negativeBalance: shopPartner.negativeBalance,
      totalEarnings: shopPartner.totalEarnings,
      pendingPayout: shopPartner.pendingPayout,
      averageRating: shopPartner.averageRating,
      totalRatings: shopPartner.totalRatings,
      totalOrders: shopPartner.totalOrders,
      productCount: shopPartner._count.products,
      orderCount: shopPartner._count.orders,
      recentProducts: shopPartner.products,
    };

    // Return both profile and shopPartner for backward compatibility
    res.json({
      profile: profileData,
      shopPartner: profileData,
    });
  } catch (error) {
    console.error("Shop Partner profile error:", error);
    res.status(500).json({ error: "Failed to fetch shop partner profile" });
  }
});

router.patch("/profile", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { userId },
    });

    if (!shopPartner) {
      return res.status(404).json({ error: "Shop Partner profile not found" });
    }

    const allowedFields = [
      "shopDescription", "shopLogo", "shopBanner", "isOpen",
      "openingTime", "closingTime", "deliveryRadiusKm", "minOrderAmount",
      "avgPreparationMinutes"
    ];

    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    updateData.updatedAt = new Date();

    const updated = await prisma.shopPartner.update({
      where: { id: shopPartner.id },
      data: updateData,
    });

    res.json({
      message: "Profile updated successfully",
      shopPartner: {
        id: updated.id,
        shopName: updated.shopName,
        isOpen: updated.isOpen,
        openingTime: updated.openingTime,
        closingTime: updated.closingTime,
      },
    });
  } catch (error) {
    console.error("Shop Partner profile update error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.get("/dashboard", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { userId },
    });

    if (!shopPartner) {
      return res.status(404).json({ error: "Shop Partner profile not found" });
    }

    if (!shopPartner.isActive) {
      return res.status(403).json({ 
        error: "Your shop is not active. Please complete verification first.",
        verificationStatus: shopPartner.verificationStatus,
        rejectionReason: shopPartner.rejectionReason,
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      todaysOrders,
      pendingOrders,
      recentOrders,
      lowStockProducts,
    ] = await Promise.all([
      prisma.productOrder.count({
        where: {
          shopPartnerId: shopPartner.id,
          placedAt: { gte: today },
        },
      }),
      prisma.productOrder.count({
        where: {
          shopPartnerId: shopPartner.id,
          status: { in: ["placed", "accepted", "packing"] },
        },
      }),
      prisma.productOrder.findMany({
        where: { shopPartnerId: shopPartner.id },
        take: 10,
        orderBy: { placedAt: "desc" },
        include: {
          items: true,
          customer: {
            select: {
              fullName: true,
              phoneNumber: true,
            },
          },
        },
      }),
      prisma.shopProduct.findMany({
        where: {
          shopPartnerId: shopPartner.id,
          isActive: true,
          stockQuantity: { lte: 5 },
        },
        take: 10,
        orderBy: { stockQuantity: "asc" },
      }),
    ]);

    res.json({
      dashboard: {
        shopName: shopPartner.shopName,
        isOpen: shopPartner.isOpen,
        todaysOrders,
        pendingOrders,
        walletBalance: shopPartner.walletBalance,
        negativeBalance: shopPartner.negativeBalance,
        pendingPayout: shopPartner.pendingPayout,
        averageRating: shopPartner.averageRating,
        totalOrders: shopPartner.totalOrders,
        recentOrders,
        lowStockProducts,
      },
    });
  } catch (error) {
    console.error("Shop Partner dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

router.post("/products", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { userId },
    });

    if (!shopPartner) {
      return res.status(404).json({ error: "Shop Partner profile not found" });
    }

    if (!shopPartner.isActive) {
      return res.status(403).json({ error: "Your shop is not active. Please complete verification first." });
    }

    const productSchema = z.object({
      name: z.string().min(2),
      description: z.string().optional(),
      category: z.string().min(1),
      subcategory: z.string().optional(),
      price: z.number().positive(),
      discountPrice: z.number().positive().optional(),
      discountPercent: z.number().min(0).max(100).optional(),
      images: z.array(z.string().url()).optional(),
      stockQuantity: z.number().int().min(0).default(0),
      weight: z.number().positive().optional(),
      unit: z.string().optional(),
      sku: z.string().optional(),
      barcode: z.string().optional(),
      isFeatured: z.boolean().optional(),
    });

    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parsed.error.errors 
      });
    }

    const data = parsed.data;

    const product = await prisma.shopProduct.create({
      data: {
        id: randomUUID(),
        shopPartnerId: shopPartner.id,
        name: data.name,
        description: data.description,
        category: data.category,
        subcategory: data.subcategory,
        price: data.price,
        discountPrice: data.discountPrice,
        discountPercent: data.discountPercent,
        images: data.images,
        stockQuantity: data.stockQuantity,
        isInStock: data.stockQuantity > 0,
        weight: data.weight,
        unit: data.unit,
        sku: data.sku,
        barcode: data.barcode,
        isFeatured: data.isFeatured || false,
        isActive: true,
      },
    });

    res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.get("/products", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { userId },
    });

    if (!shopPartner) {
      return res.status(404).json({ error: "Shop Partner profile not found" });
    }

    const { category, isActive, search, page = "1", limit = "20" } = req.query;

    const where: any = { shopPartnerId: shopPartner.id };
    
    if (category) {
      where.category = category;
    }
    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [products, total] = await Promise.all([
      prisma.shopProduct.findMany({
        where,
        take: parseInt(limit as string),
        skip,
        orderBy: { createdAt: "desc" },
      }),
      prisma.shopProduct.count({ where }),
    ]);

    res.json({
      products,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.patch("/products/:productId", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { productId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { userId },
    });

    if (!shopPartner) {
      return res.status(404).json({ error: "Shop Partner profile not found" });
    }

    const product = await prisma.shopProduct.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (product.shopPartnerId !== shopPartner.id) {
      return res.status(403).json({ error: "You do not own this product" });
    }

    const allowedFields = [
      "name", "description", "category", "subcategory", "price",
      "discountPrice", "discountPercent", "images", "stockQuantity",
      "isInStock", "weight", "unit", "sku", "barcode", "isActive", "isFeatured"
    ];

    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (updateData.stockQuantity !== undefined) {
      updateData.isInStock = updateData.stockQuantity > 0;
    }

    updateData.updatedAt = new Date();

    const updated = await prisma.shopProduct.update({
      where: { id: productId },
      data: updateData,
    });

    res.json({
      message: "Product updated successfully",
      product: updated,
    });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.delete("/products/:productId", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { productId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { userId },
    });

    if (!shopPartner) {
      return res.status(404).json({ error: "Shop Partner profile not found" });
    }

    const product = await prisma.shopProduct.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (product.shopPartnerId !== shopPartner.id) {
      return res.status(403).json({ error: "You do not own this product" });
    }

    await prisma.shopProduct.update({
      where: { id: productId },
      data: { isActive: false, updatedAt: new Date() },
    });

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

router.get("/orders", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { userId },
    });

    if (!shopPartner) {
      return res.status(404).json({ error: "Shop Partner profile not found" });
    }

    const { status, page = "1", limit = "20" } = req.query;

    const where: any = { shopPartnerId: shopPartner.id };
    if (status) {
      where.status = status;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [orders, total] = await Promise.all([
      prisma.productOrder.findMany({
        where,
        take: parseInt(limit as string),
        skip,
        orderBy: { placedAt: "desc" },
        include: {
          items: {
            include: { product: true },
          },
          customer: {
            select: {
              fullName: true,
              phoneNumber: true,
            },
          },
          driver: {
            select: {
              user: { select: { email: true } },
            },
          },
        },
      }),
      prisma.productOrder.count({ where }),
    ]);

    res.json({
      orders,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.patch("/orders/:orderId/status", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { orderId } = req.params;
    const { status } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { userId },
    });

    if (!shopPartner) {
      return res.status(404).json({ error: "Shop Partner profile not found" });
    }

    const order = await prisma.productOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.shopPartnerId !== shopPartner.id) {
      return res.status(403).json({ error: "You do not own this order" });
    }

    const validTransitions: Record<string, string[]> = {
      placed: ["accepted", "cancelled_by_shop"],
      accepted: ["packing", "cancelled_by_shop"],
      packing: ["ready_for_pickup", "cancelled_by_shop"],
      ready_for_pickup: ["picked_up"],
    };

    if (!validTransitions[order.status]?.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status transition from ${order.status} to ${status}` 
      });
    }

    const now = new Date();
    const statusTimestamps: Record<string, any> = {
      accepted: { acceptedAt: now },
      packing: { packingAt: now },
      ready_for_pickup: { readyForPickupAt: now },
      cancelled_by_shop: { cancelledAt: now, cancelledBy: "shop" },
    };

    const statusHistory = order.statusHistory ? JSON.parse(order.statusHistory as string) : [];
    statusHistory.push({ status, timestamp: now.toISOString(), actor: "shop" });

    const updateData: any = {
      status,
      statusHistory: JSON.stringify(statusHistory),
      updatedAt: now,
      ...statusTimestamps[status],
    };

    const updated = await prisma.productOrder.update({
      where: { id: orderId },
      data: updateData,
    });

    res.json({
      message: `Order status updated to ${status}`,
      order: {
        id: updated.id,
        orderNumber: updated.orderNumber,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

router.get("/earnings", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { userId },
    });

    if (!shopPartner) {
      return res.status(404).json({ error: "Shop Partner profile not found" });
    }

    const { startDate, endDate } = req.query;

    const where: any = {
      shopPartnerId: shopPartner.id,
      status: "delivered",
    };

    if (startDate) {
      where.deliveredAt = { gte: new Date(startDate as string) };
    }
    if (endDate) {
      where.deliveredAt = { 
        ...where.deliveredAt, 
        lte: new Date(endDate as string) 
      };
    }

    const deliveredOrders = await prisma.productOrder.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        safegoCommission: true,
        shopPayout: true,
        paymentMethod: true,
        deliveredAt: true,
      },
      orderBy: { deliveredAt: "desc" },
    });

    const totals = deliveredOrders.reduce(
      (acc, order) => ({
        totalRevenue: acc.totalRevenue + Number(order.totalAmount),
        totalCommission: acc.totalCommission + Number(order.safegoCommission),
        totalPayout: acc.totalPayout + Number(order.shopPayout),
        cashOrders: order.paymentMethod === "cash" ? acc.cashOrders + 1 : acc.cashOrders,
        onlineOrders: order.paymentMethod !== "cash" ? acc.onlineOrders + 1 : acc.onlineOrders,
      }),
      { totalRevenue: 0, totalCommission: 0, totalPayout: 0, cashOrders: 0, onlineOrders: 0 }
    );

    res.json({
      earnings: {
        walletBalance: shopPartner.walletBalance,
        negativeBalance: shopPartner.negativeBalance,
        pendingPayout: shopPartner.pendingPayout,
        totalEarnings: shopPartner.totalEarnings,
        commissionRate: shopPartner.commissionRate,
        ...totals,
        orderCount: deliveredOrders.length,
        orders: deliveredOrders,
      },
    });
  } catch (error) {
    console.error("Get earnings error:", error);
    res.status(500).json({ error: "Failed to fetch earnings" });
  }
});

export default router;
