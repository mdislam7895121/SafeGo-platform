import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { z } from "zod";
import { randomUUID } from "crypto";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();

// Apply authentication middleware to all ticket-operator routes
router.use(authenticateToken);

const operatorRegisterSchema = z.object({
  operatorName: z.string().min(2, "Operator name must be at least 2 characters"),
  operatorType: z.enum(["ticket", "rental", "both"]),
  description: z.string().optional(),
  officeAddress: z.string().min(5, "Office address is required"),
  officeLat: z.number().optional(),
  officeLng: z.number().optional(),
  officePhone: z.string().min(10, "Office phone is required"),
  officeEmail: z.string().email().optional(),
  ownerName: z.string().min(2, "Owner name is required"),
  fatherName: z.string().min(2, "Father's name is required (BD requirement)"),
  dateOfBirth: z.string().transform((val) => new Date(val)),
  presentAddress: z.string().min(5, "Present address is required"),
  permanentAddress: z.string().min(5, "Permanent address is required"),
  nidNumber: z.string().min(10, "NID number is required"),
  routePermitNumber: z.string().optional(),
  routePermitExpiry: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  emergencyContactName: z.string().min(2, "Emergency contact name is required"),
  emergencyContactPhone: z.string().min(10, "Emergency contact phone is required"),
  emergencyContactRelation: z.string().optional(),
});

const operatorKycSchema = z.object({
  nidFrontImage: z.string().url("NID front image URL is required"),
  nidBackImage: z.string().url("NID back image URL is required"),
  logo: z.string().url().optional(),
  routePermitImage: z.string().url().optional(),
  vehicleDocuments: z.array(z.object({
    type: z.string(),
    url: z.string().url(),
    expiry: z.string().optional(),
  })).optional(),
});

router.post("/register", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { ticketOperator: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.countryCode !== "BD") {
      return res.status(403).json({ error: "Ticket/Rental Operator registration is only available in Bangladesh" });
    }

    if (user.ticketOperator) {
      return res.status(400).json({ error: "You are already registered as a Ticket/Rental Operator" });
    }

    const parsed = operatorRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parsed.error.errors 
      });
    }

    const data = parsed.data;

    const operator = await prisma.ticketOperator.create({
      data: {
        id: randomUUID(),
        userId,
        operatorName: data.operatorName,
        operatorType: data.operatorType,
        description: data.description,
        officeAddress: data.officeAddress,
        officeLat: data.officeLat,
        officeLng: data.officeLng,
        officePhone: data.officePhone,
        officeEmail: data.officeEmail,
        ownerName: data.ownerName,
        fatherName: data.fatherName,
        dateOfBirth: data.dateOfBirth,
        presentAddress: data.presentAddress,
        permanentAddress: data.permanentAddress,
        nidNumber: data.nidNumber,
        routePermitNumber: data.routePermitNumber,
        routePermitExpiry: data.routePermitExpiry,
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        emergencyContactRelation: data.emergencyContactRelation,
        verificationStatus: "pending",
        countryCode: "BD",
      },
    });

    res.status(201).json({
      message: "Ticket/Rental Operator registration submitted successfully",
      operator: {
        id: operator.id,
        operatorName: operator.operatorName,
        operatorType: operator.operatorType,
        verificationStatus: operator.verificationStatus,
      },
    });
  } catch (error) {
    console.error("Ticket Operator registration error:", error);
    res.status(500).json({ error: "Failed to register operator" });
  }
});

router.post("/kyc", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Operator profile not found. Please register first." });
    }

    if (operator.verificationStatus === "approved") {
      return res.status(400).json({ error: "Your operator account is already verified" });
    }

    const parsed = operatorKycSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parsed.error.errors 
      });
    }

    const data = parsed.data;

    const updated = await prisma.ticketOperator.update({
      where: { id: operator.id },
      data: {
        nidFrontImage: data.nidFrontImage,
        nidBackImage: data.nidBackImage,
        logo: data.logo,
        routePermitImage: data.routePermitImage,
        vehicleDocuments: data.vehicleDocuments,
        verificationStatus: "under_review",
        updatedAt: new Date(),
      },
    });

    res.json({
      message: "KYC documents uploaded successfully. Your application is under review.",
      operator: {
        id: updated.id,
        operatorName: updated.operatorName,
        verificationStatus: updated.verificationStatus,
      },
    });
  } catch (error) {
    console.error("Ticket Operator KYC error:", error);
    res.status(500).json({ error: "Failed to upload KYC documents" });
  }
});

router.get("/profile", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
      include: {
        _count: {
          select: {
            ticketListings: true,
            ticketBookings: true,
            rentalVehicles: true,
            rentalBookings: true,
          },
        },
      },
    });

    if (!operator) {
      return res.status(404).json({ error: "Operator profile not found" });
    }

    res.json({
      operator: {
        id: operator.id,
        operatorName: operator.operatorName,
        operatorType: operator.operatorType,
        description: operator.description,
        logo: operator.logo,
        officeAddress: operator.officeAddress,
        officePhone: operator.officePhone,
        officeEmail: operator.officeEmail,
        verificationStatus: operator.verificationStatus,
        rejectionReason: operator.rejectionReason,
        isActive: operator.isActive,
        ticketCommissionRate: operator.ticketCommissionRate,
        rentalCommissionRate: operator.rentalCommissionRate,
        walletBalance: operator.walletBalance,
        negativeBalance: operator.negativeBalance,
        totalEarnings: operator.totalEarnings,
        pendingPayout: operator.pendingPayout,
        averageRating: operator.averageRating,
        totalRatings: operator.totalRatings,
        totalBookings: operator.totalBookings,
        ticketListingCount: operator._count.ticketListings,
        ticketBookingCount: operator._count.ticketBookings,
        rentalVehicleCount: operator._count.rentalVehicles,
        rentalBookingCount: operator._count.rentalBookings,
      },
    });
  } catch (error) {
    console.error("Ticket Operator profile error:", error);
    res.status(500).json({ error: "Failed to fetch operator profile" });
  }
});

router.get("/dashboard", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Operator profile not found" });
    }

    if (!operator.isActive) {
      return res.status(403).json({ 
        error: "Your operator account is not active. Please complete verification first.",
        verificationStatus: operator.verificationStatus,
        rejectionReason: operator.rejectionReason,
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      todaysTicketBookings,
      pendingTicketBookings,
      recentTicketBookings,
      todaysRentalBookings,
      pendingRentalBookings,
      recentRentalBookings,
      availableVehicles,
    ] = await Promise.all([
      prisma.ticketBooking.count({
        where: {
          operatorId: operator.id,
          bookedAt: { gte: today },
        },
      }),
      prisma.ticketBooking.count({
        where: {
          operatorId: operator.id,
          status: "booked",
        },
      }),
      prisma.ticketBooking.findMany({
        where: { operatorId: operator.id },
        take: 10,
        orderBy: { bookedAt: "desc" },
        include: {
          listing: true,
          customer: {
            select: { fullName: true, phoneNumber: true },
          },
        },
      }),
      prisma.rentalBooking.count({
        where: {
          operatorId: operator.id,
          requestedAt: { gte: today },
        },
      }),
      prisma.rentalBooking.count({
        where: {
          operatorId: operator.id,
          status: { in: ["requested", "accepted", "vehicle_assigned"] },
        },
      }),
      prisma.rentalBooking.findMany({
        where: { operatorId: operator.id },
        take: 10,
        orderBy: { requestedAt: "desc" },
        include: {
          vehicle: true,
          customer: {
            select: { fullName: true, phoneNumber: true },
          },
        },
      }),
      prisma.rentalVehicle.count({
        where: {
          operatorId: operator.id,
          isAvailable: true,
          isActive: true,
        },
      }),
    ]);

    res.json({
      dashboard: {
        operatorName: operator.operatorName,
        operatorType: operator.operatorType,
        walletBalance: operator.walletBalance,
        negativeBalance: operator.negativeBalance,
        pendingPayout: operator.pendingPayout,
        averageRating: operator.averageRating,
        totalBookings: operator.totalBookings,
        tickets: {
          todaysBookings: todaysTicketBookings,
          pendingBookings: pendingTicketBookings,
          recentBookings: recentTicketBookings,
        },
        rentals: {
          todaysBookings: todaysRentalBookings,
          pendingBookings: pendingRentalBookings,
          recentBookings: recentRentalBookings,
          availableVehicles,
        },
      },
    });
  } catch (error) {
    console.error("Ticket Operator dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

router.post("/tickets", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Operator profile not found" });
    }

    if (!operator.isActive) {
      return res.status(403).json({ error: "Your operator account is not active" });
    }

    if (operator.operatorType === "rental") {
      return res.status(403).json({ error: "Your operator type does not support ticket listings" });
    }

    const ticketSchema = z.object({
      routeName: z.string().min(2),
      vehicleType: z.enum(["bus", "coach", "ac_bus", "train"]),
      vehicleNumber: z.string().optional(),
      vehicleBrand: z.string().optional(),
      originCity: z.string().min(2),
      originStation: z.string().optional(),
      originLat: z.number().optional(),
      originLng: z.number().optional(),
      destinationCity: z.string().min(2),
      destinationStation: z.string().optional(),
      destinationLat: z.number().optional(),
      destinationLng: z.number().optional(),
      departureTime: z.string(),
      arrivalTime: z.string(),
      durationMinutes: z.number().int().positive().optional(),
      daysOfOperation: z.array(z.string()).optional(),
      basePrice: z.number().positive(),
      discountPrice: z.number().positive().optional(),
      totalSeats: z.number().int().positive(),
      seatMap: z.any().optional(),
      amenities: z.array(z.string()).optional(),
    });

    const parsed = ticketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parsed.error.errors 
      });
    }

    const data = parsed.data;

    const listing = await prisma.ticketListing.create({
      data: {
        id: randomUUID(),
        operatorId: operator.id,
        routeName: data.routeName,
        vehicleType: data.vehicleType,
        vehicleNumber: data.vehicleNumber,
        vehicleBrand: data.vehicleBrand,
        originCity: data.originCity,
        originStation: data.originStation,
        originLat: data.originLat,
        originLng: data.originLng,
        destinationCity: data.destinationCity,
        destinationStation: data.destinationStation,
        destinationLat: data.destinationLat,
        destinationLng: data.destinationLng,
        departureTime: data.departureTime,
        arrivalTime: data.arrivalTime,
        durationMinutes: data.durationMinutes,
        daysOfOperation: data.daysOfOperation,
        basePrice: data.basePrice,
        discountPrice: data.discountPrice,
        totalSeats: data.totalSeats,
        availableSeats: data.totalSeats,
        seatMap: data.seatMap,
        amenities: data.amenities,
        isActive: true,
      },
    });

    res.status(201).json({
      message: "Ticket listing created successfully",
      listing,
    });
  } catch (error) {
    console.error("Create ticket listing error:", error);
    res.status(500).json({ error: "Failed to create ticket listing" });
  }
});

router.get("/tickets", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Operator profile not found" });
    }

    const { isActive, page = "1", limit = "20" } = req.query;

    const where: any = { operatorId: operator.id };
    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [listings, total] = await Promise.all([
      prisma.ticketListing.findMany({
        where,
        take: parseInt(limit as string),
        skip,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { bookings: true } },
        },
      }),
      prisma.ticketListing.count({ where }),
    ]);

    res.json({
      listings,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error("Get ticket listings error:", error);
    res.status(500).json({ error: "Failed to fetch ticket listings" });
  }
});

router.get("/ticket-bookings", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Operator profile not found" });
    }

    const { status, journeyDate, page = "1", limit = "20" } = req.query;

    const where: any = { operatorId: operator.id };
    if (status) {
      where.status = status;
    }
    if (journeyDate) {
      const date = new Date(journeyDate as string);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      where.journeyDate = { gte: date, lt: nextDay };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [bookings, total] = await Promise.all([
      prisma.ticketBooking.findMany({
        where,
        take: parseInt(limit as string),
        skip,
        orderBy: { bookedAt: "desc" },
        include: {
          listing: true,
          customer: {
            select: { fullName: true, phoneNumber: true },
          },
        },
      }),
      prisma.ticketBooking.count({ where }),
    ]);

    res.json({
      bookings,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error("Get ticket bookings error:", error);
    res.status(500).json({ error: "Failed to fetch ticket bookings" });
  }
});

router.patch("/ticket-bookings/:bookingId/status", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { bookingId } = req.params;
    const { status } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Operator profile not found" });
    }

    const booking = await prisma.ticketBooking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.operatorId !== operator.id) {
      return res.status(403).json({ error: "You do not own this booking" });
    }

    const validTransitions: Record<string, string[]> = {
      booked: ["confirmed", "cancelled_by_operator"],
      confirmed: ["completed", "no_show", "cancelled_by_operator"],
    };

    if (!validTransitions[booking.status]?.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status transition from ${booking.status} to ${status}` 
      });
    }

    const now = new Date();
    const statusTimestamps: Record<string, any> = {
      confirmed: { confirmedAt: now },
      completed: { completedAt: now },
      cancelled_by_operator: { cancelledAt: now, cancelledBy: "operator" },
      no_show: { cancelledAt: now, cancelledBy: "no_show" },
    };

    const statusHistory = booking.statusHistory ? JSON.parse(booking.statusHistory as string) : [];
    statusHistory.push({ status, timestamp: now.toISOString(), actor: "operator" });

    const updateData: any = {
      status,
      statusHistory: JSON.stringify(statusHistory),
      updatedAt: now,
      ...statusTimestamps[status],
    };

    const updated = await prisma.ticketBooking.update({
      where: { id: bookingId },
      data: updateData,
    });

    res.json({
      message: `Booking status updated to ${status}`,
      booking: {
        id: updated.id,
        bookingNumber: updated.bookingNumber,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error("Update ticket booking status error:", error);
    res.status(500).json({ error: "Failed to update booking status" });
  }
});

router.post("/vehicles", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Operator profile not found" });
    }

    if (!operator.isActive) {
      return res.status(403).json({ error: "Your operator account is not active" });
    }

    if (operator.operatorType === "ticket") {
      return res.status(403).json({ error: "Your operator type does not support rental vehicles" });
    }

    const vehicleSchema = z.object({
      vehicleType: z.enum(["car", "micro", "tourist_bus", "suv", "sedan"]),
      brand: z.string().min(2),
      model: z.string().min(1),
      year: z.number().int().min(1990).max(new Date().getFullYear() + 1).optional(),
      color: z.string().optional(),
      registrationNumber: z.string().min(3),
      registrationImage: z.string().url().optional(),
      registrationExpiry: z.string().optional().transform((val) => val ? new Date(val) : undefined),
      passengerCapacity: z.number().int().positive(),
      luggageCapacity: z.number().int().min(0).optional(),
      pricePerDay: z.number().positive(),
      pricePerHour: z.number().positive().optional(),
      pricePerKm: z.number().positive().optional(),
      securityDeposit: z.number().min(0).optional(),
      features: z.array(z.string()).optional(),
      images: z.array(z.string().url()).optional(),
      currentLocation: z.string().optional(),
      currentLat: z.number().optional(),
      currentLng: z.number().optional(),
    });

    const parsed = vehicleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parsed.error.errors 
      });
    }

    const data = parsed.data;

    const vehicle = await prisma.rentalVehicle.create({
      data: {
        id: randomUUID(),
        operatorId: operator.id,
        vehicleType: data.vehicleType,
        brand: data.brand,
        model: data.model,
        year: data.year,
        color: data.color,
        registrationNumber: data.registrationNumber,
        registrationImage: data.registrationImage,
        registrationExpiry: data.registrationExpiry,
        passengerCapacity: data.passengerCapacity,
        luggageCapacity: data.luggageCapacity,
        pricePerDay: data.pricePerDay,
        pricePerHour: data.pricePerHour,
        pricePerKm: data.pricePerKm,
        securityDeposit: data.securityDeposit,
        features: data.features,
        images: data.images,
        currentLocation: data.currentLocation,
        currentLat: data.currentLat,
        currentLng: data.currentLng,
        isAvailable: true,
        isActive: true,
      },
    });

    res.status(201).json({
      message: "Rental vehicle created successfully",
      vehicle,
    });
  } catch (error) {
    console.error("Create rental vehicle error:", error);
    res.status(500).json({ error: "Failed to create rental vehicle" });
  }
});

router.get("/vehicles", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Operator profile not found" });
    }

    const { vehicleType, isAvailable, page = "1", limit = "20" } = req.query;

    const where: any = { operatorId: operator.id, isActive: true };
    if (vehicleType) {
      where.vehicleType = vehicleType;
    }
    if (isAvailable !== undefined) {
      where.isAvailable = isAvailable === "true";
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [vehicles, total] = await Promise.all([
      prisma.rentalVehicle.findMany({
        where,
        take: parseInt(limit as string),
        skip,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { bookings: true } },
        },
      }),
      prisma.rentalVehicle.count({ where }),
    ]);

    res.json({
      vehicles,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error("Get rental vehicles error:", error);
    res.status(500).json({ error: "Failed to fetch rental vehicles" });
  }
});

router.get("/rental-bookings", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Operator profile not found" });
    }

    const { status, page = "1", limit = "20" } = req.query;

    const where: any = { operatorId: operator.id };
    if (status) {
      where.status = status;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [bookings, total] = await Promise.all([
      prisma.rentalBooking.findMany({
        where,
        take: parseInt(limit as string),
        skip,
        orderBy: { requestedAt: "desc" },
        include: {
          vehicle: true,
          customer: {
            select: { fullName: true, phoneNumber: true },
          },
        },
      }),
      prisma.rentalBooking.count({ where }),
    ]);

    res.json({
      bookings,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error("Get rental bookings error:", error);
    res.status(500).json({ error: "Failed to fetch rental bookings" });
  }
});

router.patch("/rental-bookings/:bookingId/status", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { bookingId } = req.params;
    const { status, assignedDriverName, assignedDriverPhone } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Operator profile not found" });
    }

    const booking = await prisma.rentalBooking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.operatorId !== operator.id) {
      return res.status(403).json({ error: "You do not own this booking" });
    }

    const validTransitions: Record<string, string[]> = {
      requested: ["accepted", "cancelled_by_operator"],
      accepted: ["vehicle_assigned", "cancelled_by_operator"],
      vehicle_assigned: ["in_use", "cancelled_by_operator"],
      in_use: ["returned"],
      returned: ["completed"],
    };

    if (!validTransitions[booking.status]?.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status transition from ${booking.status} to ${status}` 
      });
    }

    const now = new Date();
    const statusTimestamps: Record<string, any> = {
      accepted: { acceptedAt: now },
      vehicle_assigned: { vehicleAssignedAt: now, assignedDriverName, assignedDriverPhone },
      in_use: { inUseAt: now },
      returned: { returnedAt: now },
      completed: { completedAt: now },
      cancelled_by_operator: { cancelledAt: now, cancelledBy: "operator" },
    };

    const statusHistory = booking.statusHistory ? JSON.parse(booking.statusHistory as string) : [];
    statusHistory.push({ status, timestamp: now.toISOString(), actor: "operator" });

    const updateData: any = {
      status,
      statusHistory: JSON.stringify(statusHistory),
      updatedAt: now,
      ...statusTimestamps[status],
    };

    if (status === "vehicle_assigned") {
      await prisma.rentalVehicle.update({
        where: { id: booking.vehicleId },
        data: { isAvailable: false },
      });
    }

    if (status === "completed" || status === "cancelled_by_operator") {
      await prisma.rentalVehicle.update({
        where: { id: booking.vehicleId },
        data: { isAvailable: true },
      });
    }

    const updated = await prisma.rentalBooking.update({
      where: { id: bookingId },
      data: updateData,
    });

    res.json({
      message: `Booking status updated to ${status}`,
      booking: {
        id: updated.id,
        bookingNumber: updated.bookingNumber,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error("Update rental booking status error:", error);
    res.status(500).json({ error: "Failed to update booking status" });
  }
});

router.get("/earnings", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Operator profile not found" });
    }

    const { startDate, endDate, type } = req.query;

    let ticketEarnings = { total: 0, commission: 0, payout: 0, count: 0 };
    let rentalEarnings = { total: 0, commission: 0, payout: 0, count: 0 };

    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate as string);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate as string);
    }

    if (!type || type === "ticket") {
      const ticketBookings = await prisma.ticketBooking.findMany({
        where: {
          operatorId: operator.id,
          status: "completed",
          ...(Object.keys(dateFilter).length > 0 && { completedAt: dateFilter }),
        },
        select: {
          totalAmount: true,
          safegoCommission: true,
          operatorPayout: true,
        },
      });

      ticketEarnings = ticketBookings.reduce(
        (acc, b) => ({
          total: acc.total + Number(b.totalAmount),
          commission: acc.commission + Number(b.safegoCommission),
          payout: acc.payout + Number(b.operatorPayout),
          count: acc.count + 1,
        }),
        { total: 0, commission: 0, payout: 0, count: 0 }
      );
    }

    if (!type || type === "rental") {
      const rentalBookings = await prisma.rentalBooking.findMany({
        where: {
          operatorId: operator.id,
          status: "completed",
          ...(Object.keys(dateFilter).length > 0 && { completedAt: dateFilter }),
        },
        select: {
          totalAmount: true,
          safegoCommission: true,
          operatorPayout: true,
        },
      });

      rentalEarnings = rentalBookings.reduce(
        (acc, b) => ({
          total: acc.total + Number(b.totalAmount),
          commission: acc.commission + Number(b.safegoCommission),
          payout: acc.payout + Number(b.operatorPayout),
          count: acc.count + 1,
        }),
        { total: 0, commission: 0, payout: 0, count: 0 }
      );
    }

    res.json({
      earnings: {
        walletBalance: operator.walletBalance,
        negativeBalance: operator.negativeBalance,
        pendingPayout: operator.pendingPayout,
        totalEarnings: operator.totalEarnings,
        ticketCommissionRate: operator.ticketCommissionRate,
        rentalCommissionRate: operator.rentalCommissionRate,
        tickets: ticketEarnings,
        rentals: rentalEarnings,
        combined: {
          total: ticketEarnings.total + rentalEarnings.total,
          commission: ticketEarnings.commission + rentalEarnings.commission,
          payout: ticketEarnings.payout + rentalEarnings.payout,
          count: ticketEarnings.count + rentalEarnings.count,
        },
      },
    });
  } catch (error) {
    console.error("Get operator earnings error:", error);
    res.status(500).json({ error: "Failed to fetch earnings" });
  }
});

export default router;
