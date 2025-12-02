import { Router, Response } from "express";
import { prisma } from "../db";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { randomUUID } from "crypto";
import { RentalVehicleType, ShopType } from "@prisma/client";

const router = Router();

router.use(authenticateToken);

router.get("/tickets", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.countryCode !== "BD") {
      return res.status(403).json({ error: "This feature is only available in Bangladesh" });
    }

    const { vehicleType, origin, destination } = req.query;

    const validTicketVehicleTypes = ["bus", "coach", "ac_bus", "train"];
    const vehicleTypeFilter = vehicleType && vehicleType !== "all" && validTicketVehicleTypes.includes(vehicleType as string)
      ? { vehicleType: vehicleType as string }
      : {};

    let listings = await prisma.ticketListing.findMany({
      where: {
        isActive: true,
        availableSeats: { gt: 0 },
        operator: {
          countryCode: "BD",
          verificationStatus: "approved",
          isActive: true,
          operatorType: { in: ["ticket", "both"] },
        },
        ...vehicleTypeFilter,
      },
      include: {
        operator: {
          select: {
            id: true,
            operatorName: true,
            logo: true,
            averageRating: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (origin && typeof origin === "string") {
      const originLower = origin.toLowerCase();
      listings = listings.filter((l) => l.originCity.toLowerCase().includes(originLower));
    }

    if (destination && typeof destination === "string") {
      const destLower = destination.toLowerCase();
      listings = listings.filter((l) => l.destinationCity.toLowerCase().includes(destLower));
    }

    if (listings.length === 0) {
      await seedDemoTicketListings();

      listings = await prisma.ticketListing.findMany({
        where: {
          isActive: true,
          availableSeats: { gt: 0 },
          operator: {
            countryCode: "BD",
            verificationStatus: "approved",
            isActive: true,
            operatorType: { in: ["ticket", "both"] },
          },
        },
        include: {
          operator: {
            select: {
              id: true,
              operatorName: true,
              logo: true,
              averageRating: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    const formattedListings = listings.map((l) => ({
      id: l.id,
      routeName: l.routeName,
      vehicleType: l.vehicleType,
      vehicleNumber: l.vehicleNumber,
      originCity: l.originCity,
      originStation: l.originStation,
      destinationCity: l.destinationCity,
      destinationStation: l.destinationStation,
      departureTime: l.departureTime,
      arrivalTime: l.arrivalTime || null,
      basePrice: Number(l.basePrice),
      discountPrice: l.discountPrice ? Number(l.discountPrice) : null,
      totalSeats: l.totalSeats,
      availableSeats: l.availableSeats,
      amenities: l.amenities as string[] | null,
      operator: {
        id: l.operator.id,
        operatorName: l.operator.operatorName,
        logo: l.operator.logo,
        averageRating: l.operator.averageRating || 0,
      },
    }));

    res.json({ listings: formattedListings });
  } catch (error) {
    console.error("BD tickets fetch error:", error);
    res.status(500).json({ error: "Failed to fetch ticket listings" });
  }
});

router.get("/rentals", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.countryCode !== "BD") {
      return res.status(403).json({ error: "This feature is only available in Bangladesh" });
    }

    const { vehicleType, search } = req.query;

    const vehicleTypeFilter = vehicleType && vehicleType !== "all" && Object.values(RentalVehicleType).includes(vehicleType as RentalVehicleType)
      ? { vehicleType: vehicleType as RentalVehicleType }
      : {};

    let vehicles = await prisma.rentalVehicle.findMany({
      where: {
        isActive: true,
        operator: {
          countryCode: "BD",
          verificationStatus: "approved",
          isActive: true,
          operatorType: { in: ["rental", "both"] },
        },
        ...vehicleTypeFilter,
      },
      include: {
        operator: {
          select: {
            id: true,
            operatorName: true,
            logo: true,
            averageRating: true,
            officeAddress: true,
            officePhone: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (search && typeof search === "string") {
      const searchLower = search.toLowerCase();
      vehicles = vehicles.filter(
        (v) =>
          v.brand.toLowerCase().includes(searchLower) ||
          v.model.toLowerCase().includes(searchLower) ||
          v.operator.operatorName.toLowerCase().includes(searchLower)
      );
    }

    if (vehicles.length === 0) {
      await seedDemoRentalVehicles();
      
      vehicles = await prisma.rentalVehicle.findMany({
        where: {
          isActive: true,
          operator: {
            countryCode: "BD",
            verificationStatus: "approved",
            isActive: true,
            operatorType: { in: ["rental", "both"] },
          },
        },
        include: {
          operator: {
            select: {
              id: true,
              operatorName: true,
              logo: true,
              averageRating: true,
              officeAddress: true,
              officePhone: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    const formattedVehicles = vehicles.map((v) => ({
      id: v.id,
      vehicleType: v.vehicleType,
      brand: v.brand,
      model: v.model,
      year: v.year,
      color: v.color,
      passengerCapacity: v.passengerCapacity,
      luggageCapacity: v.luggageCapacity,
      pricePerDay: Number(v.pricePerDay),
      pricePerHour: v.pricePerHour ? Number(v.pricePerHour) : null,
      pricePerKm: v.pricePerKm ? Number(v.pricePerKm) : null,
      securityDeposit: v.securityDeposit ? Number(v.securityDeposit) : null,
      features: v.features as string[] | null,
      images: v.images as string[] | null,
      isAvailable: v.isAvailable,
      currentLocation: v.currentLocation,
      operator: {
        id: v.operator.id,
        operatorName: v.operator.operatorName,
        logo: v.operator.logo,
        averageRating: v.operator.averageRating || 0,
        officeAddress: v.operator.officeAddress,
        officePhone: v.operator.officePhone,
      },
    }));

    res.json({ vehicles: formattedVehicles });
  } catch (error) {
    console.error("BD rentals fetch error:", error);
    res.status(500).json({ error: "Failed to fetch rental vehicles" });
  }
});

router.get("/rentals/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.countryCode !== "BD") {
      return res.status(403).json({ error: "This feature is only available in Bangladesh" });
    }

    const { id } = req.params;

    const vehicle = await prisma.rentalVehicle.findUnique({
      where: { id },
      include: {
        operator: {
          select: {
            id: true,
            operatorName: true,
            logo: true,
            averageRating: true,
            totalRatings: true,
            officeAddress: true,
            officePhone: true,
            officeEmail: true,
          },
        },
      },
    });

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    res.json({
      vehicle: {
        id: vehicle.id,
        vehicleType: vehicle.vehicleType,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        registrationNumber: vehicle.registrationNumber,
        passengerCapacity: vehicle.passengerCapacity,
        luggageCapacity: vehicle.luggageCapacity,
        pricePerDay: Number(vehicle.pricePerDay),
        pricePerHour: vehicle.pricePerHour ? Number(vehicle.pricePerHour) : null,
        pricePerKm: vehicle.pricePerKm ? Number(vehicle.pricePerKm) : null,
        securityDeposit: vehicle.securityDeposit ? Number(vehicle.securityDeposit) : null,
        features: vehicle.features as string[] | null,
        images: vehicle.images as string[] | null,
        isAvailable: vehicle.isAvailable,
        currentLocation: vehicle.currentLocation,
        operator: {
          id: vehicle.operator.id,
          operatorName: vehicle.operator.operatorName,
          logo: vehicle.operator.logo,
          averageRating: vehicle.operator.averageRating || 0,
          totalRatings: vehicle.operator.totalRatings || 0,
          officeAddress: vehicle.operator.officeAddress,
          officePhone: vehicle.operator.officePhone,
          officeEmail: vehicle.operator.officeEmail,
        },
      },
    });
  } catch (error) {
    console.error("BD rental detail fetch error:", error);
    res.status(500).json({ error: "Failed to fetch vehicle details" });
  }
});

router.get("/shops", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.countryCode !== "BD") {
      return res.status(403).json({ error: "This feature is only available in Bangladesh" });
    }

    const { shopType, search } = req.query;

    const shopTypeFilter = shopType && shopType !== "all" && Object.values(ShopType).includes(shopType as ShopType)
      ? { shopType: shopType as ShopType }
      : {};

    let shops = await prisma.shopPartner.findMany({
      where: {
        countryCode: "BD",
        verificationStatus: "approved",
        isActive: true,
        ...shopTypeFilter,
      },
      select: {
        id: true,
        shopName: true,
        shopType: true,
        shopDescription: true,
        shopAddress: true,
        shopLat: true,
        shopLng: true,
        shopLogo: true,
        shopBanner: true,
        averageRating: true,
        totalRatings: true,
        openingTime: true,
        closingTime: true,
        isOpen: true,
        deliveryRadiusKm: true,
        minOrderAmount: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (search && typeof search === "string") {
      const searchLower = search.toLowerCase();
      shops = shops.filter((s) =>
        s.shopName.toLowerCase().includes(searchLower) ||
        (s.shopDescription && s.shopDescription.toLowerCase().includes(searchLower))
      );
    }

    if (shops.length === 0) {
      await seedDemoShops();
      
      shops = await prisma.shopPartner.findMany({
        where: {
          countryCode: "BD",
          verificationStatus: "approved",
          isActive: true,
        },
        select: {
          id: true,
          shopName: true,
          shopType: true,
          shopDescription: true,
          shopAddress: true,
          shopLat: true,
          shopLng: true,
          shopLogo: true,
          shopBanner: true,
          averageRating: true,
          totalRatings: true,
          openingTime: true,
          closingTime: true,
          isOpen: true,
          deliveryRadiusKm: true,
          minOrderAmount: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    const formattedShops = shops.map((s) => ({
      id: s.id,
      shopName: s.shopName,
      shopType: s.shopType,
      shopDescription: s.shopDescription,
      shopAddress: s.shopAddress,
      shopLat: s.shopLat,
      shopLng: s.shopLng,
      logoUrl: s.shopLogo,
      bannerUrl: s.shopBanner,
      rating: s.averageRating || 0,
      totalRatings: s.totalRatings || 0,
      openingTime: s.openingTime,
      closingTime: s.closingTime,
      deliveryEnabled: s.isOpen,
      deliveryRadius: s.deliveryRadiusKm,
      minOrderAmount: s.minOrderAmount ? Number(s.minOrderAmount) : null,
      preparationTime: 20,
    }));

    res.json({ shops: formattedShops });
  } catch (error) {
    console.error("BD shops fetch error:", error);
    res.status(500).json({ error: "Failed to fetch shops" });
  }
});

router.get("/shops/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.countryCode !== "BD") {
      return res.status(403).json({ error: "This feature is only available in Bangladesh" });
    }

    const { id } = req.params;

    const shop = await prisma.shopPartner.findUnique({
      where: { id },
      include: {
        products: {
          where: { isActive: true, isInStock: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }

    res.json({
      shop: {
        id: shop.id,
        shopName: shop.shopName,
        shopType: shop.shopType,
        shopDescription: shop.shopDescription,
        shopAddress: shop.shopAddress,
        shopLat: shop.shopLat,
        shopLng: shop.shopLng,
        logoUrl: shop.shopLogo,
        bannerUrl: shop.shopBanner,
        rating: shop.averageRating || 0,
        totalRatings: shop.totalRatings || 0,
        openingTime: shop.openingTime,
        closingTime: shop.closingTime,
        deliveryEnabled: shop.isOpen,
        deliveryRadius: shop.deliveryRadiusKm,
        minOrderAmount: shop.minOrderAmount ? Number(shop.minOrderAmount) : null,
        products: shop.products.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: Number(p.price),
          discountPrice: p.discountPrice ? Number(p.discountPrice) : null,
          category: p.category,
          images: p.images,
          inStock: p.isInStock,
          stockQuantity: p.stockQuantity,
        })),
      },
    });
  } catch (error) {
    console.error("BD shop detail fetch error:", error);
    res.status(500).json({ error: "Failed to fetch shop details" });
  }
});

// ============================================
// BD SHOP ORDERS ENDPOINTS
// ============================================

// Place a new shop order
router.post("/orders", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "অননুমোদিত অ্যাক্সেস" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customerProfile: true },
    });

    if (!user || user.countryCode !== "BD") {
      return res.status(403).json({ error: "এই সেবা শুধুমাত্র বাংলাদেশে উপলব্ধ" });
    }

    if (!user.customerProfile) {
      return res.status(400).json({ error: "কাস্টমার প্রোফাইল পাওয়া যায়নি" });
    }

    const { shopId, items, deliveryAddress, deliveryLat, deliveryLng, deliveryInstructions, paymentMethod } = req.body;

    if (!shopId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "দোকান এবং পণ্য তথ্য প্রদান করুন" });
    }

    if (!deliveryAddress) {
      return res.status(400).json({ error: "ডেলিভারি ঠিকানা প্রদান করুন" });
    }

    const validPaymentMethods = ["cash", "bkash", "nagad", "card"];
    const finalPaymentMethod = validPaymentMethods.includes(paymentMethod) ? paymentMethod : "cash";

    // Fetch the shop
    const shop = await prisma.shopPartner.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      return res.status(404).json({ error: "দোকান পাওয়া যায়নি" });
    }

    if (!shop.isActive || shop.verificationStatus !== "approved") {
      return res.status(400).json({ error: "এই দোকান থেকে অর্ডার করা যাচ্ছে না" });
    }

    // Fetch and validate all products
    const productIds = items.map((item: { productId: string }) => item.productId);
    const products = await prisma.shopProduct.findMany({
      where: { id: { in: productIds }, shopPartnerId: shopId, isActive: true },
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: "কিছু পণ্য পাওয়া যায়নি বা অপ্রাপ্য" });
    }

    // Calculate order totals
    let subtotal = 0;
    const orderItems: Array<{
      productId: string;
      productName: string;
      productPrice: number;
      quantity: number;
      subtotal: number;
    }> = [];

    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;

      const quantity = Math.max(1, Math.min(item.quantity || 1, product.stockQuantity));
      const price = Number(product.discountPrice || product.price);
      const itemSubtotal = price * quantity;

      if (product.stockQuantity < quantity) {
        return res.status(400).json({ 
          error: `${product.name} এর স্টক অপর্যাপ্ত। বর্তমানে ${product.stockQuantity}টি উপলব্ধ।` 
        });
      }

      subtotal += itemSubtotal;
      orderItems.push({
        productId: product.id,
        productName: product.name,
        productPrice: price,
        quantity,
        subtotal: itemSubtotal,
      });
    }

    // Check minimum order amount
    if (shop.minOrderAmount && subtotal < Number(shop.minOrderAmount)) {
      return res.status(400).json({ 
        error: `ন্যূনতম অর্ডার ৳${Number(shop.minOrderAmount)} হতে হবে। বর্তমান অর্ডার ৳${subtotal}` 
      });
    }

    // Calculate fees
    const deliveryFee = 50; // Fixed delivery fee for BD
    const serviceFee = Math.round(subtotal * 0.05); // 5% service fee
    const totalAmount = subtotal + deliveryFee + serviceFee;

    // Calculate commission
    const commissionRate = Number(shop.commissionRate) / 100;
    const safegoCommission = Math.round(subtotal * commissionRate);
    const shopPayout = subtotal - safegoCommission;
    const driverPayout = deliveryFee - 10; // SafeGo keeps ৳10 from delivery

    // Generate order number
    const orderNumber = `BD${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Create order and update stock in transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create the order
      const newOrder = await tx.productOrder.create({
        data: {
          id: randomUUID(),
          orderNumber,
          customerId: user.customerProfile!.id,
          shopPartnerId: shopId,
          deliveryAddress,
          deliveryLat: deliveryLat || null,
          deliveryLng: deliveryLng || null,
          deliveryInstructions: deliveryInstructions || null,
          subtotal,
          deliveryFee,
          serviceFee,
          totalAmount,
          safegoCommission,
          shopPayout,
          driverPayout,
          paymentMethod: finalPaymentMethod,
          paymentStatus: finalPaymentMethod === "cash" ? "pending" : "pending",
          status: "placed",
          statusHistory: JSON.stringify([
            { status: "placed", timestamp: new Date().toISOString(), actor: "customer" },
          ]),
          estimatedDeliveryMinutes: (shop.avgPreparationMinutes || 30) + 20,
        },
      });

      // Create order items
      for (const item of orderItems) {
        await tx.productOrderItem.create({
          data: {
            id: randomUUID(),
            orderId: newOrder.id,
            productId: item.productId,
            productName: item.productName,
            productPrice: item.productPrice,
            quantity: item.quantity,
            subtotal: item.subtotal,
          },
        });

        // Decrement stock
        await tx.shopProduct.update({
          where: { id: item.productId },
          data: {
            stockQuantity: { decrement: item.quantity },
            isInStock: {
              set: true, // Will be recalculated
            },
          },
        });
      }

      // Create linked delivery record
      await tx.delivery.create({
        data: {
          id: randomUUID(),
          customerId: user.customerProfile!.id,
          pickupAddress: shop.shopAddress,
          pickupLat: shop.shopLat || null,
          pickupLng: shop.shopLng || null,
          dropoffAddress: deliveryAddress,
          dropoffLat: deliveryLat || null,
          dropoffLng: deliveryLng || null,
          serviceFare: deliveryFee,
          safegoCommission: 10,
          driverPayout,
          paymentMethod: finalPaymentMethod,
          status: "requested",
          serviceType: "food",
          countryCode: "BD",
          shopPartnerId: shopId,
          statusHistory: JSON.stringify([
            { status: "requested", timestamp: new Date().toISOString(), actor: "system" },
          ]),
          updatedAt: new Date(),
        },
      });

      // Update shop order count
      await tx.shopPartner.update({
        where: { id: shopId },
        data: {
          totalOrders: { increment: 1 },
          // For cash orders, add to negative balance
          ...(finalPaymentMethod === "cash" ? {
            negativeBalance: { increment: safegoCommission },
          } : {}),
        },
      });

      return newOrder;
    });

    res.status(201).json({
      message: "অর্ডার সফলভাবে দেওয়া হয়েছে",
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        paymentMethod: order.paymentMethod,
        estimatedDeliveryMinutes: order.estimatedDeliveryMinutes,
      },
    });
  } catch (error) {
    console.error("BD shop order creation error:", error);
    res.status(500).json({ error: "অর্ডার তৈরি করতে সমস্যা হয়েছে" });
  }
});

// Get customer's shop orders
router.get("/orders", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "অননুমোদিত অ্যাক্সেস" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customerProfile: true },
    });

    if (!user || user.countryCode !== "BD") {
      return res.status(403).json({ error: "এই সেবা শুধুমাত্র বাংলাদেশে উপলব্ধ" });
    }

    if (!user.customerProfile) {
      return res.status(400).json({ error: "কাস্টমার প্রোফাইল পাওয়া যায়নি" });
    }

    const { status } = req.query;

    const orders = await prisma.productOrder.findMany({
      where: {
        customerId: user.customerProfile.id,
        ...(status && status !== "all" ? { status: status as any } : {}),
      },
      include: {
        shopPartner: {
          select: {
            id: true,
            shopName: true,
            shopAddress: true,
            shopLogo: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
              },
            },
          },
        },
      },
      orderBy: { placedAt: "desc" },
    });

    const formattedOrders = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      statusLabel: getStatusLabel(order.status),
      shopName: order.shopPartner.shopName,
      shopAddress: order.shopPartner.shopAddress,
      shopLogo: order.shopPartner.shopLogo,
      deliveryAddress: order.deliveryAddress,
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        price: Number(item.productPrice),
        subtotal: Number(item.subtotal),
        image: item.product.images ? (item.product.images as string[])[0] : null,
      })),
      subtotal: Number(order.subtotal),
      deliveryFee: Number(order.deliveryFee),
      serviceFee: order.serviceFee ? Number(order.serviceFee) : 0,
      totalAmount: Number(order.totalAmount),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      placedAt: order.placedAt,
      estimatedDeliveryMinutes: order.estimatedDeliveryMinutes,
      customerRating: order.customerRating,
      customerFeedback: order.customerFeedback,
    }));

    res.json({ orders: formattedOrders });
  } catch (error) {
    console.error("BD shop orders fetch error:", error);
    res.status(500).json({ error: "অর্ডার লোড করতে সমস্যা হয়েছে" });
  }
});

// Get single order details
router.get("/orders/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "অননুমোদিত অ্যাক্সেস" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customerProfile: true },
    });

    if (!user || user.countryCode !== "BD" || !user.customerProfile) {
      return res.status(403).json({ error: "এই সেবা শুধুমাত্র বাংলাদেশে উপলব্ধ" });
    }

    const { id } = req.params;

    const order = await prisma.productOrder.findFirst({
      where: {
        id,
        customerId: user.customerProfile.id,
      },
      include: {
        shopPartner: {
          select: {
            id: true,
            shopName: true,
            shopAddress: true,
            shopLogo: true,
            shopLat: true,
            shopLng: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
              },
            },
          },
        },
        driver: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
            profilePhotoUrl: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "অর্ডার পাওয়া যায়নি" });
    }

    res.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        statusLabel: getStatusLabel(order.status),
        statusHistory: order.statusHistory,
        shop: {
          id: order.shopPartner.id,
          name: order.shopPartner.shopName,
          address: order.shopPartner.shopAddress,
          logo: order.shopPartner.shopLogo,
          lat: order.shopPartner.shopLat,
          lng: order.shopPartner.shopLng,
        },
        driver: order.driver ? {
          id: order.driver.id,
          name: order.driver.fullName,
          phone: order.driver.phoneNumber,
          photo: order.driver.profilePhotoUrl,
        } : null,
        deliveryAddress: order.deliveryAddress,
        deliveryLat: order.deliveryLat,
        deliveryLng: order.deliveryLng,
        items: order.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          quantity: item.quantity,
          price: Number(item.productPrice),
          subtotal: Number(item.subtotal),
          image: item.product.images ? (item.product.images as string[])[0] : null,
        })),
        subtotal: Number(order.subtotal),
        deliveryFee: Number(order.deliveryFee),
        serviceFee: order.serviceFee ? Number(order.serviceFee) : 0,
        discount: order.discount ? Number(order.discount) : 0,
        totalAmount: Number(order.totalAmount),
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        placedAt: order.placedAt,
        acceptedAt: order.acceptedAt,
        readyForPickupAt: order.readyForPickupAt,
        pickedUpAt: order.pickedUpAt,
        deliveredAt: order.deliveredAt,
        estimatedDeliveryMinutes: order.estimatedDeliveryMinutes,
        customerRating: order.customerRating,
        customerFeedback: order.customerFeedback,
      },
    });
  } catch (error) {
    console.error("BD shop order detail fetch error:", error);
    res.status(500).json({ error: "অর্ডার তথ্য লোড করতে সমস্যা হয়েছে" });
  }
});

// Rate a completed order
router.patch("/orders/:id/rate", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "অননুমোদিত অ্যাক্সেস" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customerProfile: true },
    });

    if (!user || user.countryCode !== "BD" || !user.customerProfile) {
      return res.status(403).json({ error: "এই সেবা শুধুমাত্র বাংলাদেশে উপলব্ধ" });
    }

    const { id } = req.params;
    const { rating, feedback } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "রেটিং ১ থেকে ৫ এর মধ্যে হতে হবে" });
    }

    const order = await prisma.productOrder.findFirst({
      where: {
        id,
        customerId: user.customerProfile.id,
        status: "delivered",
      },
    });

    if (!order) {
      return res.status(404).json({ error: "অর্ডার পাওয়া যায়নি বা রেটিং দেওয়া যাবে না" });
    }

    if (order.customerRating) {
      return res.status(400).json({ error: "এই অর্ডারে ইতিমধ্যে রেটিং দেওয়া হয়েছে" });
    }

    // Update order with rating
    const updatedOrder = await prisma.productOrder.update({
      where: { id },
      data: {
        customerRating: rating,
        customerFeedback: feedback || null,
      },
    });

    // Update shop average rating
    const shopOrders = await prisma.productOrder.findMany({
      where: {
        shopPartnerId: order.shopPartnerId,
        customerRating: { not: null },
      },
      select: { customerRating: true },
    });

    const totalRatings = shopOrders.length;
    const avgRating = shopOrders.reduce((sum, o) => sum + (o.customerRating || 0), 0) / totalRatings;

    await prisma.shopPartner.update({
      where: { id: order.shopPartnerId },
      data: {
        averageRating: Math.round(avgRating * 10) / 10,
        totalRatings,
      },
    });

    res.json({
      message: "রেটিং সফলভাবে দেওয়া হয়েছে",
      order: {
        id: updatedOrder.id,
        customerRating: updatedOrder.customerRating,
        customerFeedback: updatedOrder.customerFeedback,
      },
    });
  } catch (error) {
    console.error("BD shop order rating error:", error);
    res.status(500).json({ error: "রেটিং দিতে সমস্যা হয়েছে" });
  }
});

// Helper function for status labels
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    placed: "অর্ডার পাঠানো হয়েছে",
    accepted: "দোকান অর্ডার গ্রহণ করেছে",
    preparing: "অর্ডার প্রস্তুত হচ্ছে",
    ready_for_pickup: "ডেলিভারির জন্য প্রস্তুত",
    picked_up: "ডেলিভারিম্যান পণ্য নিয়েছেন",
    on_the_way: "ডেলিভারি পথে",
    delivered: "ডেলিভারি সম্পন্ন",
    cancelled_by_customer: "কাস্টমার বাতিল করেছেন",
    cancelled_by_shop: "দোকান বাতিল করেছে",
    cancelled_by_driver: "ড্রাইভার বাতিল করেছেন",
    refunded: "টাকা ফেরত দেওয়া হয়েছে",
  };
  return labels[status] || status;
}

async function seedDemoRentalVehicles() {
  try {
    const approvedBDRentalVehicles = await prisma.rentalVehicle.count({
      where: {
        isActive: true,
        operator: {
          countryCode: "BD",
          verificationStatus: "approved",
          isActive: true,
          operatorType: { in: ["rental", "both"] },
        },
      },
    });

    if (approvedBDRentalVehicles > 0) {
      return;
    }

    let existingDemo = await prisma.ticketOperator.findFirst({
      where: { operatorName: "SafeGo Demo Rentals BD" },
    });

    let operator: typeof existingDemo;

    if (existingDemo) {
      operator = await prisma.ticketOperator.update({
        where: { id: existingDemo.id },
        data: {
          verificationStatus: "approved",
          isActive: true,
          operatorType: "rental",
          countryCode: "BD",
          verifiedAt: new Date(),
        },
      });
      
      const vehicleCount = await prisma.rentalVehicle.count({
        where: { operatorId: existingDemo.id, isActive: true },
      });

      if (vehicleCount > 0) {
        console.log("[BD-Customer] Demo rental operator activated with existing vehicles");
        return;
      }
    } else {
      const demoUser = await prisma.user.findFirst({
        where: { email: "demo-rental-operator@safego.bd" },
      });

      let userId: string;
      if (!demoUser) {
        const newUser = await prisma.user.create({
          data: {
            id: randomUUID(),
            email: "demo-rental-operator@safego.bd",
            passwordHash: "demo-not-for-login",
            role: "ticket_operator",
            countryCode: "BD",
            isDemo: true,
          },
        });
        userId = newUser.id;
      } else {
        userId = demoUser.id;
      }

      operator = await prisma.ticketOperator.create({
        data: {
          id: randomUUID(),
          userId,
          operatorName: "SafeGo Demo Rentals BD",
          operatorType: "rental",
          description: "ঢাকায় বিশ্বস্ত রেন্টাল সেবা",
          officeAddress: "গুলশান-১, ঢাকা-১২১২",
          officeLat: 23.7808,
          officeLng: 90.4175,
          officePhone: "+8801700000001",
          officeEmail: "demo@safego.bd",
          ownerName: "ডেমো অপারেটর",
          fatherName: "ডেমো পিতা",
          dateOfBirth: new Date("1985-01-15"),
          presentAddress: "গুলশান-১, ঢাকা",
          permanentAddress: "গুলশান-১, ঢাকা",
          nidNumber: "1234567890123",
          emergencyContactName: "ডেমো ইমার্জেন্সি",
          emergencyContactPhone: "+8801700000002",
          verificationStatus: "approved",
          verifiedAt: new Date(),
          isActive: true,
          countryCode: "BD",
          averageRating: 4.5,
          totalRatings: 125,
        },
      });
    }

    const demoVehicles = [
      {
        vehicleType: "car" as RentalVehicleType,
        brand: "Toyota",
        model: "Corolla 2022",
        year: 2022,
        color: "সাদা",
        registrationNumber: "ঢাকা মেট্রো হ ১২৩৪",
        passengerCapacity: 4,
        luggageCapacity: 2,
        pricePerDay: 3500,
        pricePerHour: 400,
        features: ["এসি", "ড্রাইভার সহ", "জিপিএস", "ফুয়েল ইনক্লুডেড"],
        currentLocation: "গুলশান-১, ঢাকা",
      },
      {
        vehicleType: "sedan" as RentalVehicleType,
        brand: "Honda",
        model: "Civic 2023",
        year: 2023,
        color: "কালো",
        registrationNumber: "ঢাকা মেট্রো হ ৫৬৭৮",
        passengerCapacity: 4,
        luggageCapacity: 3,
        pricePerDay: 4500,
        pricePerHour: 500,
        features: ["এসি", "ড্রাইভার সহ", "জিপিএস", "লেদার সিট", "সানরুফ"],
        currentLocation: "বনানী, ঢাকা",
      },
      {
        vehicleType: "suv" as RentalVehicleType,
        brand: "Toyota",
        model: "Fortuner 2022",
        year: 2022,
        color: "সিলভার",
        registrationNumber: "ঢাকা মেট্রো জ ১১২২",
        passengerCapacity: 7,
        luggageCapacity: 4,
        pricePerDay: 8000,
        pricePerHour: 900,
        features: ["এসি", "ড্রাইভার সহ", "জিপিএস", "4WD", "প্রিমিয়াম সাউন্ড"],
        currentLocation: "ধানমন্ডি, ঢাকা",
      },
      {
        vehicleType: "micro" as RentalVehicleType,
        brand: "Toyota",
        model: "Noah 2021",
        year: 2021,
        color: "সাদা",
        registrationNumber: "ঢাকা মেট্রো ক ৩৪৫৬",
        passengerCapacity: 8,
        luggageCapacity: 3,
        pricePerDay: 5500,
        pricePerHour: 600,
        features: ["এসি", "ড্রাইভার সহ", "স্লাইডিং ডোর", "চাইল্ড সিট"],
        currentLocation: "উত্তরা, ঢাকা",
      },
      {
        vehicleType: "micro" as RentalVehicleType,
        brand: "Toyota",
        model: "Hiace 2020",
        year: 2020,
        color: "সাদা",
        registrationNumber: "ঢাকা মেট্রো খ ৭৮৯০",
        passengerCapacity: 12,
        luggageCapacity: 5,
        pricePerDay: 7000,
        pricePerHour: 800,
        features: ["এসি", "ড্রাইভার সহ", "বড় লাগেজ স্পেস", "গ্রুপ ট্রাভেল"],
        currentLocation: "মিরপুর, ঢাকা",
      },
      {
        vehicleType: "tourist_bus" as RentalVehicleType,
        brand: "Scania",
        model: "K360 2019",
        year: 2019,
        color: "লাল/সাদা",
        registrationNumber: "ঢাকা মেট্রো চ ১২১২",
        passengerCapacity: 35,
        luggageCapacity: 20,
        pricePerDay: 25000,
        pricePerHour: 2500,
        features: ["এসি", "ড্রাইভার সহ", "টয়লেট", "ওয়াইফাই", "টিভি", "রিক্লাইনিং সিট"],
        currentLocation: "মতিঝিল, ঢাকা",
      },
      {
        vehicleType: "car" as RentalVehicleType,
        brand: "Nissan",
        model: "Sunny 2021",
        year: 2021,
        color: "নীল",
        registrationNumber: "ঢাকা মেট্রো গ ৪৫৬৭",
        passengerCapacity: 4,
        luggageCapacity: 2,
        pricePerDay: 2800,
        pricePerHour: 350,
        features: ["এসি", "ড্রাইভার সহ", "ইকোনমি"],
        currentLocation: "মহাখালী, ঢাকা",
      },
      {
        vehicleType: "suv" as RentalVehicleType,
        brand: "Mitsubishi",
        model: "Pajero Sport 2021",
        year: 2021,
        color: "সাদা",
        registrationNumber: "ঢাকা মেট্রো ঘ ৮৯০১",
        passengerCapacity: 7,
        luggageCapacity: 4,
        pricePerDay: 9500,
        pricePerHour: 1000,
        features: ["এসি", "ড্রাইভার সহ", "4WD", "আউটডোর ট্রিপ", "প্রিমিয়াম"],
        currentLocation: "বারিধারা, ঢাকা",
      },
    ];

    for (const v of demoVehicles) {
      await prisma.rentalVehicle.create({
        data: {
          id: randomUUID(),
          operatorId: operator.id,
          vehicleType: v.vehicleType,
          brand: v.brand,
          model: v.model,
          year: v.year,
          color: v.color,
          registrationNumber: v.registrationNumber,
          passengerCapacity: v.passengerCapacity,
          luggageCapacity: v.luggageCapacity,
          pricePerDay: v.pricePerDay,
          pricePerHour: v.pricePerHour,
          features: v.features,
          images: [],
          isAvailable: true,
          isActive: true,
          currentLocation: v.currentLocation,
        },
      });
    }

    console.log("[BD-Customer] Seeded demo rental vehicles");
  } catch (error) {
    console.error("[BD-Customer] Failed to seed demo rentals:", error);
  }
}

async function seedDemoShops() {
  try {
    const approvedBDShops = await prisma.shopPartner.count({
      where: {
        countryCode: "BD",
        verificationStatus: "approved",
        isActive: true,
      },
    });

    if (approvedBDShops > 0) {
      return;
    }

    const nonApprovedBDShops = await prisma.shopPartner.findMany({
      where: {
        countryCode: "BD",
        OR: [
          { verificationStatus: { not: "approved" } },
          { isActive: false },
        ],
      },
    });

    if (nonApprovedBDShops.length > 0) {
      await prisma.shopPartner.updateMany({
        where: {
          countryCode: "BD",
        },
        data: {
          verificationStatus: "approved",
          isActive: true,
          verifiedAt: new Date(),
        },
      });
      
      console.log("[BD-Customer] Activated existing demo shops to approved status");
      return;
    }

    const demoShops = [
      {
        email: "demo-shop-grocery@safego.bd",
        shopName: "ডেমো মুদিখানা - গুলশান",
        shopType: "grocery" as ShopType,
        shopDescription: "তাজা শাকসবজি, ফলমূল এবং দৈনন্দিন মুদি সামগ্রী",
        shopAddress: "গুলশান-২, ঢাকা-১২১২",
        shopLat: 23.7925,
        shopLng: 90.4078,
        rating: 4.6,
      },
      {
        email: "demo-shop-mobile@safego.bd",
        shopName: "টেক মোবাইল শপ",
        shopType: "electronics" as ShopType,
        shopDescription: "মোবাইল ফোন, এক্সেসরিজ এবং গ্যাজেট",
        shopAddress: "বনানী ১১, ঢাকা",
        shopLat: 23.7934,
        shopLng: 90.4016,
        rating: 4.3,
      },
      {
        email: "demo-shop-pharmacy@safego.bd",
        shopName: "হেলথ ফার্মেসি",
        shopType: "pharmacy" as ShopType,
        shopDescription: "ওষুধ, স্বাস্থ্য পণ্য এবং মেডিকেল সাপ্লাই",
        shopAddress: "ধানমন্ডি ২৭, ঢাকা",
        shopLat: 23.7461,
        shopLng: 90.3742,
        rating: 4.8,
      },
      {
        email: "demo-shop-fashion@safego.bd",
        shopName: "স্টাইল ফ্যাশন",
        shopType: "fashion" as ShopType,
        shopDescription: "পুরুষ ও মহিলাদের পোশাক এবং এক্সেসরিজ",
        shopAddress: "উত্তরা সেক্টর ৭, ঢাকা",
        shopLat: 23.8759,
        shopLng: 90.3795,
        rating: 4.2,
      },
      {
        email: "demo-shop-beauty@safego.bd",
        shopName: "বিউটি কর্নার",
        shopType: "beauty" as ShopType,
        shopDescription: "কসমেটিক্স, স্কিনকেয়ার এবং বিউটি প্রোডাক্ট",
        shopAddress: "মিরপুর ১০, ঢাকা",
        shopLat: 23.8069,
        shopLng: 90.3687,
        rating: 4.4,
      },
      {
        email: "demo-shop-general@safego.bd",
        shopName: "সুপার স্টোর মার্ট",
        shopType: "general_store" as ShopType,
        shopDescription: "দৈনন্দিন প্রয়োজনীয় সব কিছু এক জায়গায়",
        shopAddress: "মহাখালী, ঢাকা",
        shopLat: 23.7787,
        shopLng: 90.3959,
        rating: 4.5,
      },
      {
        email: "demo-shop-hardware@safego.bd",
        shopName: "বিল্ডার্স হার্ডওয়্যার",
        shopType: "hardware" as ShopType,
        shopDescription: "নির্মাণ সামগ্রী, টুলস এবং হার্ডওয়্যার",
        shopAddress: "তেজগাঁও, ঢাকা",
        shopLat: 23.7590,
        shopLng: 90.3926,
        rating: 4.1,
      },
      {
        email: "demo-shop-books@safego.bd",
        shopName: "জ্ঞান বই ঘর",
        shopType: "books" as ShopType,
        shopDescription: "বই, স্টেশনারি এবং শিক্ষা সামগ্রী",
        shopAddress: "নিউমার্কেট, ঢাকা",
        shopLat: 23.7332,
        shopLng: 90.3847,
        rating: 4.7,
      },
    ];

    for (const shop of demoShops) {
      let user = await prisma.user.findFirst({
        where: { email: shop.email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            id: randomUUID(),
            email: shop.email,
            passwordHash: "demo-not-for-login",
            role: "shop_partner",
            countryCode: "BD",
            isDemo: true,
          },
        });
      }

      const newShop = await prisma.shopPartner.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          shopName: shop.shopName,
          shopType: shop.shopType,
          shopDescription: shop.shopDescription,
          shopAddress: shop.shopAddress,
          shopLat: shop.shopLat,
          shopLng: shop.shopLng,
          ownerName: "ডেমো মালিক",
          fatherName: "ডেমো পিতা",
          dateOfBirth: new Date("1985-01-15"),
          presentAddress: shop.shopAddress,
          permanentAddress: shop.shopAddress,
          nidNumber: "1234567890123",
          emergencyContactName: "ডেমো ইমার্জেন্সি",
          emergencyContactPhone: "+8801700000099",
          verificationStatus: "approved",
          verifiedAt: new Date(),
          isActive: true,
          countryCode: "BD",
          averageRating: shop.rating,
          totalRatings: Math.floor(Math.random() * 100) + 20,
          isOpen: true,
          deliveryRadiusKm: 5,
          openingTime: "09:00",
          closingTime: "21:00",
        },
      });

      // Seed demo products for this shop
      const demoProducts = getDemoProductsForShopType(shop.shopType);
      for (const product of demoProducts) {
        await prisma.shopProduct.create({
          data: {
            id: randomUUID(),
            shopPartnerId: newShop.id,
            name: product.name,
            description: product.description,
            category: product.category,
            price: product.price,
            unit: product.unit,
            stockQuantity: product.stockQuantity,
            isInStock: true,
            isActive: true,
          },
        });
      }
    }

    console.log("[BD-Customer] Seeded demo shops with products");
  } catch (error) {
    console.error("[BD-Customer] Failed to seed demo shops:", error);
  }
}

function getDemoProductsForShopType(shopType: string) {
  const productsByType: Record<string, Array<{ name: string; description: string; category: string; price: number; unit: string; stockQuantity: number }>> = {
    grocery: [
      { name: "চাল (মিনিকেট)", description: "উচ্চমানের মিনিকেট চাল - ১ কেজি", category: "চাল-ডাল", price: 85, unit: "কেজি", stockQuantity: 100 },
      { name: "মসুর ডাল", description: "পরিষ্কার মসুর ডাল - ১ কেজি", category: "চাল-ডাল", price: 120, unit: "কেজি", stockQuantity: 80 },
      { name: "সয়াবিন তেল (১ লিটার)", description: "রিফাইন্ড সয়াবিন তেল", category: "তেল", price: 180, unit: "লিটার", stockQuantity: 50 },
      { name: "লবণ (১ কেজি)", description: "আয়োডিনযুক্ত খাবার লবণ", category: "মশলা", price: 35, unit: "প্যাকেট", stockQuantity: 200 },
      { name: "চিনি (১ কেজি)", description: "সাদা দানাদার চিনি", category: "মশলা", price: 110, unit: "কেজি", stockQuantity: 60 },
      { name: "আলু (১ কেজি)", description: "তাজা দেশি আলু", category: "সবজি", price: 40, unit: "কেজি", stockQuantity: 150 },
    ],
    electronics: [
      { name: "মোবাইল চার্জার (ফাস্ট চার্জ)", description: "২৫ ওয়াট ফাস্ট চার্জিং অ্যাডাপ্টার", category: "এক্সেসরিজ", price: 450, unit: "পিস", stockQuantity: 30 },
      { name: "ইয়ারফোন (ওয়্যার্ড)", description: "হাই-কোয়ালিটি ইয়ারফোন মাইক সহ", category: "এক্সেসরিজ", price: 250, unit: "পিস", stockQuantity: 40 },
      { name: "মোবাইল কভার", description: "সিলিকন ব্যাক কভার", category: "এক্সেসরিজ", price: 150, unit: "পিস", stockQuantity: 100 },
      { name: "স্ক্রিন প্রটেক্টর", description: "টেম্পার্ড গ্লাস স্ক্রিন প্রটেক্টর", category: "এক্সেসরিজ", price: 120, unit: "পিস", stockQuantity: 80 },
      { name: "পাওয়ার ব্যাংক (১০০০০mAh)", description: "পোর্টেবল পাওয়ার ব্যাংক", category: "এক্সেসরিজ", price: 1200, unit: "পিস", stockQuantity: 20 },
      { name: "USB ক্যাবল (টাইপ-সি)", description: "ফাস্ট চার্জিং USB ক্যাবল", category: "এক্সেসরিজ", price: 180, unit: "পিস", stockQuantity: 60 },
    ],
    pharmacy: [
      { name: "প্যারাসিটামল (৫০০mg)", description: "জ্বর ও ব্যথা উপশমকারী - ১০ ট্যাবলেট", category: "ওষুধ", price: 15, unit: "স্ট্রিপ", stockQuantity: 200 },
      { name: "অ্যান্টাসিড ট্যাবলেট", description: "গ্যাসট্রিক সমস্যার সমাধান - ১০ ট্যাবলেট", category: "ওষুধ", price: 25, unit: "স্ট্রিপ", stockQuantity: 150 },
      { name: "ভিটামিন সি (৫০০mg)", description: "রোগ প্রতিরোধ ক্ষমতা বৃদ্ধি - ৩০ ট্যাবলেট", category: "সাপ্লিমেন্ট", price: 180, unit: "বোতল", stockQuantity: 50 },
      { name: "স্যানিটাইজার (১০০ml)", description: "হ্যান্ড স্যানিটাইজার জেল", category: "স্বাস্থ্য পণ্য", price: 80, unit: "বোতল", stockQuantity: 100 },
      { name: "মাস্ক (১০ পিস)", description: "সার্জিক্যাল মাস্ক - ৩ লেয়ার", category: "স্বাস্থ্য পণ্য", price: 50, unit: "প্যাকেট", stockQuantity: 200 },
      { name: "ব্যান্ডেজ", description: "ফার্স্ট এইড ব্যান্ডেজ সেট", category: "স্বাস্থ্য পণ্য", price: 40, unit: "প্যাকেট", stockQuantity: 80 },
    ],
    fashion: [
      { name: "পুরুষ টি-শার্ট", description: "কটন টি-শার্ট - বিভিন্ন সাইজ", category: "পুরুষ পোশাক", price: 350, unit: "পিস", stockQuantity: 40 },
      { name: "পুরুষ পাঞ্জাবি", description: "সেমি সিল্ক পাঞ্জাবি", category: "পুরুষ পোশাক", price: 1200, unit: "পিস", stockQuantity: 20 },
      { name: "মহিলা থ্রি-পিস", description: "কটন থ্রি-পিস সেট", category: "মহিলা পোশাক", price: 850, unit: "সেট", stockQuantity: 25 },
      { name: "শাড়ি", description: "জর্জেট শাড়ি", category: "মহিলা পোশাক", price: 1500, unit: "পিস", stockQuantity: 15 },
      { name: "জিন্স প্যান্ট", description: "ডেনিম জিন্স - বিভিন্ন সাইজ", category: "ইউনিসেক্স", price: 950, unit: "পিস", stockQuantity: 30 },
      { name: "ওড়না", description: "কটন ওড়না - বিভিন্ন রং", category: "মহিলা পোশাক", price: 250, unit: "পিস", stockQuantity: 50 },
    ],
    beauty: [
      { name: "ফেসওয়াশ (১০০ml)", description: "ক্লিনজিং ফেসওয়াশ", category: "স্কিনকেয়ার", price: 220, unit: "বোতল", stockQuantity: 60 },
      { name: "ময়েশ্চারাইজার (৫০ml)", description: "ডেইলি ময়েশ্চারাইজিং ক্রিম", category: "স্কিনকেয়ার", price: 350, unit: "বোতল", stockQuantity: 40 },
      { name: "সানস্ক্রিন (৫০ml)", description: "SPF 50 সানস্ক্রিন লোশন", category: "স্কিনকেয়ার", price: 450, unit: "বোতল", stockQuantity: 35 },
      { name: "লিপস্টিক", description: "ম্যাট লিপস্টিক - বিভিন্ন শেড", category: "মেকআপ", price: 280, unit: "পিস", stockQuantity: 50 },
      { name: "নেইলপলিশ", description: "লং লাস্টিং নেইলপলিশ", category: "মেকআপ", price: 120, unit: "পিস", stockQuantity: 80 },
      { name: "শ্যাম্পু (২০০ml)", description: "অ্যান্টি-ড্যান্ড্রাফ শ্যাম্পু", category: "হেয়ারকেয়ার", price: 180, unit: "বোতল", stockQuantity: 45 },
    ],
    general_store: [
      { name: "সাবান (৪ পিস)", description: "বাথ সোপ প্যাক", category: "বাথ", price: 120, unit: "প্যাকেট", stockQuantity: 100 },
      { name: "ডিটারজেন্ট (১ কেজি)", description: "কাপড় ধোয়ার পাউডার", category: "হাউসহোল্ড", price: 180, unit: "প্যাকেট", stockQuantity: 80 },
      { name: "টুথপেস্ট (১০০g)", description: "ফ্লোরাইড টুথপেস্ট", category: "পার্সোনাল কেয়ার", price: 85, unit: "টিউব", stockQuantity: 120 },
      { name: "টিস্যু বক্স", description: "সফট টিস্যু - ১০০ শীট", category: "হাউসহোল্ড", price: 60, unit: "বক্স", stockQuantity: 150 },
      { name: "বিস্কুট (২০০g)", description: "ক্রিম বিস্কুট", category: "স্ন্যাকস", price: 50, unit: "প্যাকেট", stockQuantity: 200 },
      { name: "চা পাতা (২০০g)", description: "প্রিমিয়াম চা পাতা", category: "বেভারেজ", price: 140, unit: "প্যাকেট", stockQuantity: 70 },
    ],
    hardware: [
      { name: "স্ক্রু সেট", description: "মিক্সড স্ক্রু সেট - ১০০ পিস", category: "ফিক্সচার", price: 150, unit: "সেট", stockQuantity: 50 },
      { name: "হ্যামার", description: "স্টিল হেড হ্যামার", category: "টুলস", price: 250, unit: "পিস", stockQuantity: 30 },
      { name: "ড্রিল বিট সেট", description: "HSS ড্রিল বিট সেট - ১০ পিস", category: "টুলস", price: 450, unit: "সেট", stockQuantity: 20 },
      { name: "পেইন্ট ব্রাশ", description: "পেইন্ট ব্রাশ - মিডিয়াম", category: "পেইন্টিং", price: 80, unit: "পিস", stockQuantity: 60 },
      { name: "ইলেকট্রিক টেপ", description: "ইনসুলেশন টেপ - ব্ল্যাক", category: "ইলেকট্রিক্যাল", price: 35, unit: "রোল", stockQuantity: 100 },
      { name: "পাইপ ফিটিং", description: "পিভিসি পাইপ ফিটিং সেট", category: "প্লাম্বিং", price: 120, unit: "সেট", stockQuantity: 40 },
    ],
    books: [
      { name: "বাংলা উপন্যাস", description: "জনপ্রিয় বাংলা উপন্যাস সংকলন", category: "বই", price: 350, unit: "পিস", stockQuantity: 30 },
      { name: "ইংরেজি গ্রামার বই", description: "ইংরেজি শেখার সহায়ক বই", category: "বই", price: 280, unit: "পিস", stockQuantity: 40 },
      { name: "নোটখাতা (২০০ পাতা)", description: "লাইনযুক্ত নোটখাতা", category: "স্টেশনারি", price: 80, unit: "পিস", stockQuantity: 100 },
      { name: "বলপয়েন্ট কলম (১০ পিস)", description: "ব্লু বলপয়েন্ট কলম সেট", category: "স্টেশনারি", price: 60, unit: "প্যাকেট", stockQuantity: 150 },
      { name: "পেন্সিল বক্স", description: "স্টুডেন্ট পেন্সিল বক্স", category: "স্টেশনারি", price: 120, unit: "পিস", stockQuantity: 80 },
      { name: "কালার পেন্সিল সেট", description: "১২ কালার পেন্সিল সেট", category: "স্টেশনারি", price: 150, unit: "সেট", stockQuantity: 60 },
    ],
  };
  
  return productsByType[shopType] || productsByType.general_store;
}

async function seedDemoTicketListings() {
  try {
    let existingDemo = await prisma.ticketOperator.findFirst({
      where: { operatorName: "SafeGo Demo Tickets BD" },
    });

    let operator: typeof existingDemo;

    if (existingDemo) {
      const listingCount = await prisma.ticketListing.count({
        where: { 
          operatorId: existingDemo.id,
          isActive: true,
        },
      });
      
      if (listingCount > 0) {
        return;
      }
      
      operator = await prisma.ticketOperator.update({
        where: { id: existingDemo.id },
        data: {
          verificationStatus: "approved",
          isActive: true,
          operatorType: "ticket",
          countryCode: "BD",
          verifiedAt: new Date(),
        },
      });
    } else {
      const demoUser = await prisma.user.findFirst({
        where: { email: "demo-ticket-operator@safego.bd" },
      });

      let userId: string;
      if (!demoUser) {
        const newUser = await prisma.user.create({
          data: {
            id: randomUUID(),
            email: "demo-ticket-operator@safego.bd",
            passwordHash: "demo-not-for-login",
            role: "ticket_operator",
            countryCode: "BD",
            isDemo: true,
          },
        });
        userId = newUser.id;
      } else {
        userId = demoUser.id;
      }

      operator = await prisma.ticketOperator.create({
        data: {
          id: randomUUID(),
          userId,
          operatorName: "SafeGo Demo Tickets BD",
          operatorType: "ticket",
          description: "বাংলাদেশের বিশ্বস্ত বাস টিকিট সেবা",
          officeAddress: "মতিঝিল, ঢাকা-১০০০",
          officeLat: 23.7287,
          officeLng: 90.4175,
          officePhone: "+8801700000003",
          officeEmail: "tickets-demo@safego.bd",
          ownerName: "ডেমো টিকিট অপারেটর",
          fatherName: "ডেমো পিতা",
          dateOfBirth: new Date("1980-05-15"),
          presentAddress: "মতিঝিল, ঢাকা",
          permanentAddress: "মতিঝিল, ঢাকা",
          nidNumber: "9876543210123",
          emergencyContactName: "ডেমো ইমার্জেন্সি",
          emergencyContactPhone: "+8801700000004",
          verificationStatus: "approved",
          verifiedAt: new Date(),
          isActive: true,
          countryCode: "BD",
          averageRating: 4.7,
          totalRatings: 250,
        },
      });
    }

    const demoListings = [
      {
        routeName: "ঢাকা - চট্টগ্রাম এক্সপ্রেস",
        vehicleType: "ac_bus",
        vehicleNumber: "ঢাকা মেট্রো ব ১২৩৪",
        vehicleBrand: "Scania",
        originCity: "ঢাকা",
        originStation: "কমলাপুর বাস স্ট্যান্ড",
        destinationCity: "চট্টগ্রাম",
        destinationStation: "দামপাড়া বাস স্ট্যান্ড",
        departureTime: "08:00",
        arrivalTime: "14:00",
        durationMinutes: 360,
        basePrice: 850,
        totalSeats: 40,
        availableSeats: 35,
        amenities: ["এসি", "ওয়াইফাই", "মোবাইল চার্জার", "রিক্লাইনিং সিট"],
      },
      {
        routeName: "ঢাকা - সিলেট ডিলাক্স",
        vehicleType: "coach",
        vehicleNumber: "ঢাকা মেট্রো চ ৫৬৭৮",
        vehicleBrand: "Hyundai",
        originCity: "ঢাকা",
        originStation: "সায়দাবাদ বাস স্ট্যান্ড",
        destinationCity: "সিলেট",
        destinationStation: "কদমতলী বাস স্ট্যান্ড",
        departureTime: "10:30",
        arrivalTime: "16:30",
        durationMinutes: 360,
        basePrice: 750,
        totalSeats: 38,
        availableSeats: 28,
        amenities: ["এসি", "টিভি", "স্ন্যাকস"],
      },
      {
        routeName: "ঢাকা - কক্সবাজার সুপার",
        vehicleType: "ac_bus",
        vehicleNumber: "ঢাকা মেট্রো ক ৯০১২",
        vehicleBrand: "Volvo",
        originCity: "ঢাকা",
        originStation: "ফকিরাপুল বাস স্ট্যান্ড",
        destinationCity: "কক্সবাজার",
        destinationStation: "কক্সবাজার বাস স্ট্যান্ড",
        departureTime: "21:00",
        arrivalTime: "07:00",
        durationMinutes: 600,
        basePrice: 1200,
        totalSeats: 36,
        availableSeats: 20,
        amenities: ["এসি", "ওয়াইফাই", "ব্ল্যাংকেট", "স্লিপার সিট", "টয়লেট"],
      },
      {
        routeName: "ঢাকা - রাজশাহী এক্সপ্রেস",
        vehicleType: "bus",
        vehicleNumber: "ঢাকা মেট্রো গ ৩৪৫৬",
        vehicleBrand: "Ashok Leyland",
        originCity: "ঢাকা",
        originStation: "গাবতলী বাস স্ট্যান্ড",
        destinationCity: "রাজশাহী",
        destinationStation: "রাজশাহী বাস স্ট্যান্ড",
        departureTime: "07:00",
        arrivalTime: "13:00",
        durationMinutes: 360,
        basePrice: 600,
        totalSeats: 44,
        availableSeats: 40,
        amenities: ["পানি", "স্ন্যাকস"],
      },
      {
        routeName: "ঢাকা - খুলনা সুপার ডিলাক্স",
        vehicleType: "coach",
        vehicleNumber: "ঢাকা মেট্রো ঘ ৭৮৯০",
        vehicleBrand: "Mercedes",
        originCity: "ঢাকা",
        originStation: "গাবতলী বাস স্ট্যান্ড",
        destinationCity: "খুলনা",
        destinationStation: "খুলনা বাস স্ট্যান্ড",
        departureTime: "09:00",
        arrivalTime: "15:30",
        durationMinutes: 390,
        basePrice: 700,
        totalSeats: 40,
        availableSeats: 32,
        amenities: ["এসি", "ওয়াইফাই", "টিভি", "মোবাইল চার্জার"],
      },
      {
        routeName: "চট্টগ্রাম - ঢাকা নাইট কোচ",
        vehicleType: "ac_bus",
        vehicleNumber: "চট্টগ্রাম মেট্রো জ ১১২২",
        vehicleBrand: "Scania",
        originCity: "চট্টগ্রাম",
        originStation: "দামপাড়া বাস স্ট্যান্ড",
        destinationCity: "ঢাকা",
        destinationStation: "কমলাপুর বাস স্ট্যান্ড",
        departureTime: "22:00",
        arrivalTime: "04:00",
        durationMinutes: 360,
        basePrice: 900,
        totalSeats: 38,
        availableSeats: 25,
        amenities: ["এসি", "ব্ল্যাংকেট", "বালিশ", "স্লিপার সিট"],
      },
      {
        routeName: "ঢাকা - বরিশাল ওয়াটার বাস",
        vehicleType: "bus",
        vehicleNumber: "ঢাকা মেট্রো ড ৩৩৪৪",
        vehicleBrand: "Tata",
        originCity: "ঢাকা",
        originStation: "গুলিস্তান বাস স্ট্যান্ড",
        destinationCity: "বরিশাল",
        destinationStation: "বরিশাল বাস স্ট্যান্ড",
        departureTime: "06:00",
        arrivalTime: "12:00",
        durationMinutes: 360,
        basePrice: 550,
        totalSeats: 42,
        availableSeats: 38,
        amenities: ["পানি", "টিভি"],
      },
      {
        routeName: "ঢাকা - ময়মনসিংহ লোকাল",
        vehicleType: "bus",
        vehicleNumber: "ঢাকা মেট্রো ঢ ৫৫৬৬",
        vehicleBrand: "Hino",
        originCity: "ঢাকা",
        originStation: "মহাখালী বাস স্ট্যান্ড",
        destinationCity: "ময়মনসিংহ",
        destinationStation: "ময়মনসিংহ বাস স্ট্যান্ড",
        departureTime: "11:00",
        arrivalTime: "14:00",
        durationMinutes: 180,
        basePrice: 300,
        totalSeats: 40,
        availableSeats: 30,
        amenities: ["পানি"],
      },
    ];

    for (const listing of demoListings) {
      await prisma.ticketListing.create({
        data: {
          id: randomUUID(),
          operatorId: operator.id,
          routeName: listing.routeName,
          vehicleType: listing.vehicleType,
          vehicleNumber: listing.vehicleNumber,
          vehicleBrand: listing.vehicleBrand,
          originCity: listing.originCity,
          originStation: listing.originStation,
          destinationCity: listing.destinationCity,
          destinationStation: listing.destinationStation,
          departureTime: listing.departureTime,
          arrivalTime: listing.arrivalTime,
          durationMinutes: listing.durationMinutes,
          basePrice: listing.basePrice,
          totalSeats: listing.totalSeats,
          availableSeats: listing.availableSeats,
          amenities: listing.amenities,
          isActive: true,
        },
      });
    }

    console.log("[BD-Customer] Seeded demo ticket listings");
  } catch (error) {
    console.error("[BD-Customer] Failed to seed demo tickets:", error);
  }
}

export default router;
