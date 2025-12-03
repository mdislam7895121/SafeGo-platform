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

      // Allow customer (during onboarding), pending_shop_partner, and shop_partner roles
      // Customers can upload during the staged onboarding process before their role is upgraded
      if (!["customer", "pending_shop_partner", "shop_partner"].includes(userRole || "")) {
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
      const validTypes = ["logo", "banner", "nid_front", "nid_back"];
      if (!imageType || !validTypes.includes(imageType)) {
        return res.status(400).json({ 
          error: "অবৈধ ছবির ধরণ",
          errorEn: "Invalid image type. Must be 'logo', 'banner', 'nid_front', or 'nid_back'"
        });
      }

      // Generate the URL for the uploaded file
      const fileUrl = getFileUrl(file.filename);

      const messages: Record<string, string> = {
        logo: "লোগো আপলোড সফল হয়েছে",
        banner: "ব্যানার আপলোড সফল হয়েছে",
        nid_front: "NID সামনের ছবি আপলোড সফল হয়েছে",
        nid_back: "NID পেছনের ছবি আপলোড সফল হয়েছে"
      };

      res.json({
        success: true,
        url: fileUrl,
        type: imageType,
        filename: file.filename,
        message: messages[imageType] || "আপলোড সফল হয়েছে"
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

    // Allow customer (during onboarding), pending_shop_partner, and shop_partner roles
    if (!["customer", "pending_shop_partner", "shop_partner"].includes(userRole || "")) {
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

// ===================================================
// STAGED ONBOARDING ENDPOINTS (BD Partner Engine)
// ===================================================

// Stage 1: Light Form Schema - Easy Start
const stage1Schema = z.object({
  shopName: z.string().min(2, "দোকানের নাম কমপক্ষে ২ অক্ষরের হতে হবে"),
  shopType: z.enum(["grocery", "electronics", "fashion", "pharmacy", "general_store", "hardware", "beauty", "books", "sports", "other"], {
    errorMap: () => ({ message: "দোকানের ধরণ নির্বাচন করুন" }),
  }),
  cityOrArea: z.string().min(2, "এলাকা/শহরের নাম লিখুন"),
  contactPhone: z.string().min(10, "সঠিক ফোন নম্বর লিখুন"),
});

// Stage 2: Full KYC Schema - High Security
const stage2KycSchema = z.object({
  ownerName: z.string().min(2, "মালিকের নাম লিখুন"),
  fatherName: z.string().min(2, "পিতার নাম লিখুন"),
  dateOfBirth: z.string().min(1, "জন্ম তারিখ নির্বাচন করুন").transform((val) => new Date(val)),
  presentAddress: z.string().min(5, "বর্তমান ঠিকানা লিখুন"),
  permanentAddress: z.string().min(5, "স্থায়ী ঠিকানা লিখুন"),
  nidNumber: z.string().min(10, "সঠিক জাতীয় পরিচয়পত্র নম্বর লিখুন").regex(/^[0-9]{10,17}$/, "জাতীয় পরিচয়পত্র নম্বর শুধুমাত্র সংখ্যা হতে হবে"),
  nidFrontImage: z.string().url("NID সামনের ছবি আপলোড করুন"),
  nidBackImage: z.string().url("NID পেছনের ছবি আপলোড করুন"),
  emergencyContactName: z.string().min(2, "জরুরি যোগাযোগের নাম লিখুন"),
  emergencyContactPhone: z.string().min(10, "জরুরি যোগাযোগের ফোন নম্বর লিখুন"),
});

// Stage 3: Business Setup Schema
const stage3SetupSchema = z.object({
  shopLogo: z.string().url("দোকানের লোগো আপলোড করুন"),
  shopBanner: z.string().url("দোকানের ব্যানার আপলোড করুন"),
  shopAddress: z.string().min(5, "দোকানের সম্পূর্ণ ঠিকানা লিখুন"),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
  deliveryRadiusKm: z.number().min(1).max(50).optional(),
});

// Get onboarding status and checklist
router.get("/onboarding-status", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { countryCode: true, role: true },
    });

    if (!user || user.countryCode !== "BD") {
      return res.status(403).json({ error: "Shop Partner is only available in Bangladesh" });
    }

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { userId },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!shopPartner) {
      return res.json({
        hasProfile: false,
        partnerStatus: null,
        checklist: {
          stage1Complete: false,
          stage2Complete: false,
          stage3Complete: false,
        },
        nextStep: "stage1",
        message: "শপ পার্টনার হতে প্রথম ধাপ শুরু করুন",
      });
    }

    // Check completion status for each stage
    const stage1Complete = !!(shopPartner.shopName && shopPartner.shopType && shopPartner.cityOrArea);
    const stage2Complete = !!(
      shopPartner.ownerName &&
      shopPartner.fatherName &&
      shopPartner.dateOfBirth &&
      shopPartner.presentAddress &&
      shopPartner.permanentAddress &&
      shopPartner.nidNumber &&
      shopPartner.nidFrontImage &&
      shopPartner.nidBackImage &&
      shopPartner.emergencyContactName &&
      shopPartner.emergencyContactPhone
    );
    const stage3Complete = !!(
      shopPartner.shopLogo &&
      shopPartner.shopBanner &&
      shopPartner.shopAddress &&
      shopPartner._count.products >= 3
    );

    // Determine next step
    let nextStep = "complete";
    if (!stage1Complete) {
      nextStep = "stage1";
    } else if (!stage2Complete) {
      nextStep = "stage2";
    } else if (shopPartner.partnerStatus === "kyc_pending") {
      nextStep = "waiting_kyc_approval";
    } else if (shopPartner.partnerStatus === "setup_incomplete" && !stage3Complete) {
      nextStep = "stage3";
    } else if (shopPartner.partnerStatus === "ready_for_review") {
      nextStep = "waiting_final_approval";
    } else if (shopPartner.partnerStatus === "rejected") {
      nextStep = "rejected";
    } else if (shopPartner.partnerStatus === "live") {
      nextStep = "complete";
    }

    res.json({
      hasProfile: true,
      partnerStatus: shopPartner.partnerStatus,
      verificationStatus: shopPartner.verificationStatus,
      rejectionReason: shopPartner.rejectionReason,
      checklist: {
        stage1Complete,
        stage2Complete,
        stage3Complete,
        productCount: shopPartner._count.products,
        requiredProducts: 3,
      },
      nextStep,
      profile: {
        id: shopPartner.id,
        shopName: shopPartner.shopName,
        shopType: shopPartner.shopType,
        cityOrArea: shopPartner.cityOrArea,
        isActive: shopPartner.isActive,
      },
    });
  } catch (error) {
    console.error("Get onboarding status error:", error);
    res.status(500).json({ error: "Failed to fetch onboarding status" });
  }
});

// Stage 1: Easy Start - Create draft profile
router.post("/stages/1", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Allow customer, pending_shop_partner, or shop_partner roles
    if (!["customer", "pending_shop_partner", "shop_partner"].includes(userRole || "")) {
      return res.status(403).json({ error: "Invalid role for shop partner onboarding" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { shopPartner: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.countryCode !== "BD") {
      return res.status(403).json({ error: "Shop Partner is only available in Bangladesh" });
    }

    // Check if already live
    if (user.shopPartner?.partnerStatus === "live") {
      return res.status(400).json({ error: "আপনি ইতিমধ্যে একজন অনুমোদিত শপ পার্টনার" });
    }

    const parsed = stage1Schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parsed.error.errors 
      });
    }

    const data = parsed.data;

    // Create or update shop partner with Stage 1 data
    const shopPartner = await prisma.shopPartner.upsert({
      where: { userId },
      create: {
        id: randomUUID(),
        userId,
        shopName: data.shopName,
        shopType: data.shopType,
        cityOrArea: data.cityOrArea,
        contactPhone: data.contactPhone,
        shopAddress: data.cityOrArea, // Temporary, will be updated in Stage 3
        partnerStatus: "draft",
        verificationStatus: "pending",
        countryCode: "BD",
      },
      update: {
        shopName: data.shopName,
        shopType: data.shopType,
        cityOrArea: data.cityOrArea,
        contactPhone: data.contactPhone,
        // Don't change partnerStatus if already beyond draft
        ...(user.shopPartner?.partnerStatus === "draft" || !user.shopPartner ? {} : {}),
      },
    });

    // Update user role to pending_shop_partner if they're a customer
    if (user.role === "customer") {
      await prisma.user.update({
        where: { id: userId },
        data: { role: "pending_shop_partner" },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: user.email || "unknown",
        actorRole: user.role || "pending_shop_partner",
        actionType: "SHOP_PARTNER_STAGE1_SUBMITTED",
        entityType: "shop_partner",
        entityId: shopPartner.id,
        description: `Shop Partner Stage 1 submitted: ${data.shopName}`,
        metadata: { shopName: data.shopName, shopType: data.shopType, cityOrArea: data.cityOrArea },
        ipAddress: req.ip || null,
      },
    });

    res.status(201).json({
      success: true,
      message: "অভিনন্দন! প্রথম ধাপ সম্পন্ন হয়েছে।",
      shopPartner: {
        id: shopPartner.id,
        shopName: shopPartner.shopName,
        partnerStatus: shopPartner.partnerStatus,
      },
      nextStep: "stage2",
    });
  } catch (error) {
    console.error("Stage 1 error:", error);
    res.status(500).json({ error: "প্রথম ধাপ জমা দিতে সমস্যা হয়েছে" });
  }
});

// Stage 2: Full KYC Submission
router.post("/stages/2", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { userId },
    });

    if (!shopPartner) {
      return res.status(404).json({ error: "Please complete Stage 1 first" });
    }

    // Only allow if in draft or rejected status
    if (!["draft", "rejected"].includes(shopPartner.partnerStatus)) {
      return res.status(400).json({ 
        error: "KYC already submitted or not in valid state",
        currentStatus: shopPartner.partnerStatus,
      });
    }

    const parsed = stage2KycSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parsed.error.errors 
      });
    }

    const data = parsed.data;

    // Update with KYC data and move to kyc_pending
    const updated = await prisma.shopPartner.update({
      where: { id: shopPartner.id },
      data: {
        ownerName: data.ownerName,
        fatherName: data.fatherName,
        dateOfBirth: data.dateOfBirth,
        presentAddress: data.presentAddress,
        permanentAddress: data.permanentAddress,
        nidNumber: data.nidNumber,
        nidFrontImage: data.nidFrontImage,
        nidBackImage: data.nidBackImage,
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        partnerStatus: "kyc_pending",
        verificationStatus: "under_review",
        kycSubmittedAt: new Date(),
        rejectionReason: null,
      },
    });

    // Audit log
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: user?.email || "unknown",
        actorRole: user?.role || "pending_shop_partner",
        actionType: "SHOP_PARTNER_KYC_SUBMITTED",
        entityType: "shop_partner",
        entityId: shopPartner.id,
        description: `Shop Partner KYC submitted: ${data.ownerName}`,
        metadata: { ownerName: data.ownerName, nidLastFour: data.nidNumber.slice(-4) },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "KYC তথ্য জমা হয়েছে। অনুমোদনের জন্য অপেক্ষা করুন।",
      shopPartner: {
        id: updated.id,
        shopName: updated.shopName,
        partnerStatus: updated.partnerStatus,
      },
      nextStep: "waiting_kyc_approval",
    });
  } catch (error) {
    console.error("Stage 2 KYC error:", error);
    res.status(500).json({ error: "KYC জমা দিতে সমস্যা হয়েছে" });
  }
});

// Stage 3: Business Setup Completion
router.post("/stages/3", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const shopPartner = await prisma.shopPartner.findUnique({
      where: { userId },
      include: { _count: { select: { products: true } } },
    });

    if (!shopPartner) {
      return res.status(404).json({ error: "Please complete Stage 1 and 2 first" });
    }

    // Only allow if KYC approved (setup_incomplete status)
    if (shopPartner.partnerStatus !== "setup_incomplete") {
      return res.status(400).json({ 
        error: "KYC must be approved before completing setup",
        currentStatus: shopPartner.partnerStatus,
      });
    }

    const parsed = stage3SetupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parsed.error.errors 
      });
    }

    const data = parsed.data;

    // Check if minimum products exist
    if (shopPartner._count.products < 3) {
      return res.status(400).json({ 
        error: "কমপক্ষে ৩টি প্রোডাক্ট যোগ করুন",
        currentProducts: shopPartner._count.products,
        requiredProducts: 3,
      });
    }

    // Update with setup data and move to ready_for_review
    const updated = await prisma.shopPartner.update({
      where: { id: shopPartner.id },
      data: {
        shopLogo: data.shopLogo,
        shopBanner: data.shopBanner,
        shopAddress: data.shopAddress,
        openingTime: data.openingTime || "09:00",
        closingTime: data.closingTime || "21:00",
        deliveryRadiusKm: data.deliveryRadiusKm || 5,
        partnerStatus: "ready_for_review",
        setupCompletedAt: new Date(),
      },
    });

    // Audit log
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: user?.email || "unknown",
        actorRole: user?.role || "pending_shop_partner",
        actionType: "SHOP_PARTNER_SETUP_COMPLETED",
        entityType: "shop_partner",
        entityId: shopPartner.id,
        description: `Shop Partner setup completed: ${shopPartner.shopName}`,
        metadata: { shopAddress: data.shopAddress, productCount: shopPartner._count.products },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "সেটআপ সম্পন্ন! চূড়ান্ত অনুমোদনের জন্য অপেক্ষা করুন।",
      shopPartner: {
        id: updated.id,
        shopName: updated.shopName,
        partnerStatus: updated.partnerStatus,
      },
      nextStep: "waiting_final_approval",
    });
  } catch (error) {
    console.error("Stage 3 setup error:", error);
    res.status(500).json({ error: "সেটআপ সম্পন্ন করতে সমস্যা হয়েছে" });
  }
});

export default router;
