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

      await prisma.shopPartner.create({
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
    }

    console.log("[BD-Customer] Seeded demo shops");
  } catch (error) {
    console.error("[BD-Customer] Failed to seed demo shops:", error);
  }
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
