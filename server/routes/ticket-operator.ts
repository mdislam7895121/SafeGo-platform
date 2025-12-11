import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { z } from "zod";
import { randomUUID } from "crypto";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { uploadShopImage, getFileUrl } from "../middleware/upload";

const router = Router();

// Apply authentication middleware to all ticket-operator routes
router.use(authenticateToken);

// POST /api/ticket-operator/upload-image - Upload images for ticket operator onboarding
router.post("/upload-image", (req: AuthRequest, res, next) => {
  uploadShopImage(req, res, (err) => {
    if (err) {
      console.error("Ticket operator image upload error:", err);
      return res.status(400).json({ 
        error: "ছবি আপলোড ব্যর্থ হয়েছে",
        errorEn: err.message || "Failed to upload image"
      });
    }
    next();
  });
}, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const file = req.file;

    if (!userId) {
      return res.status(401).json({ 
        error: "সেশন শেষ হয়ে গেছে। পুনরায় লগইন করুন।",
        errorEn: "Session expired. Please login again." 
      });
    }

    if (!file) {
      return res.status(400).json({ 
        error: "কোন ফাইল পাওয়া যায়নি",
        errorEn: "No file provided"
      });
    }

    // Validate image type from query param
    const imageType = req.query.type as string;
    const validTypes = ["logo", "nid_front", "nid_back", "route_permit", "vehicle_doc"];
    if (!imageType || !validTypes.includes(imageType)) {
      return res.status(400).json({ 
        error: "অবৈধ ছবির ধরণ",
        errorEn: "Invalid image type. Must be 'logo', 'nid_front', 'nid_back', 'route_permit', or 'vehicle_doc'"
      });
    }

    // Generate the URL for the uploaded file
    const fileUrl = getFileUrl(file.filename);

    const messages: Record<string, string> = {
      logo: "লোগো আপলোড সফল হয়েছে",
      nid_front: "NID সামনের ছবি আপলোড সফল হয়েছে",
      nid_back: "NID পেছনের ছবি আপলোড সফল হয়েছে",
      route_permit: "রুট পারমিট আপলোড সফল হয়েছে",
      vehicle_doc: "গাড়ির ডকুমেন্ট আপলোড সফল হয়েছে"
    };

    res.json({
      success: true,
      url: fileUrl,
      type: imageType,
      filename: file.filename,
      message: messages[imageType] || "আপলোড সফল হয়েছে"
    });
  } catch (error) {
    console.error("Ticket operator image upload error:", error);
    res.status(500).json({ 
      error: "ছবি আপলোড ব্যর্থ হয়েছে",
      errorEn: "Failed to upload image"
    });
  }
});

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
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Allow both pending_ticket_operator and ticket_operator roles
    if (userRole !== "pending_ticket_operator" && userRole !== "ticket_operator") {
      return res.status(403).json({ error: "Only ticket operators can access this endpoint" });
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

    // If user has final role (ticket_operator), they can't re-register
    if (user.role === "ticket_operator" && user.ticketOperator) {
      return res.status(400).json({ error: "You are already approved as a Ticket/Rental Operator" });
    }

    // For pending role, allow resubmission if profile exists but not yet approved
    if (user.ticketOperator && user.ticketOperator.verificationStatus === "approved") {
      return res.status(400).json({ error: "You are already approved as a Ticket/Rental Operator" });
    }

    const parsed = operatorRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parsed.error.errors 
      });
    }

    const data = parsed.data;

    // Use upsert to handle both new registration and resubmission for pending roles
    const operator = await prisma.ticketOperator.upsert({
      where: { userId },
      create: {
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
      update: {
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
        rejectionReason: null,
      },
    });

    const isUpdate = user.ticketOperator !== null;
    res.status(isUpdate ? 200 : 201).json({
      message: isUpdate 
        ? "Ticket/Rental Operator registration updated successfully" 
        : "Ticket/Rental Operator registration submitted successfully",
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

    // Allow listing creation once KYC is approved (setup_incomplete, ready_for_review, or live)
    const allowedStatuses = ["setup_incomplete", "ready_for_review", "live"];
    if (!allowedStatuses.includes(operator.partnerStatus)) {
      return res.status(403).json({ 
        error: "KYC অনুমোদনের পর টিকেট যোগ করতে পারবেন",
        partnerStatus: operator.partnerStatus,
      });
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

    // Allow vehicle creation once KYC is approved (setup_incomplete, ready_for_review, or live)
    const allowedStatuses = ["setup_incomplete", "ready_for_review", "live"];
    if (!allowedStatuses.includes(operator.partnerStatus)) {
      return res.status(403).json({ 
        error: "KYC অনুমোদনের পর রেন্টাল গাড়ি যোগ করতে পারবেন",
        partnerStatus: operator.partnerStatus,
      });
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

// ===================================================
// STAGED ONBOARDING ENDPOINTS (BD Partner Engine)
// ===================================================

// Stage 1: Light Form Schema - Easy Start
const stage1OperatorSchema = z.object({
  operatorName: z.string().min(2, "অপারেটরের নাম কমপক্ষে ২ অক্ষরের হতে হবে"),
  operatorType: z.enum(["ticket", "rental", "both"], {
    errorMap: () => ({ message: "অপারেটর ধরণ নির্বাচন করুন" }),
  }),
  cityOrArea: z.string().min(2, "এলাকা/শহরের নাম লিখুন"),
  contactPhone: z.string().min(10, "সঠিক ফোন নম্বর লিখুন"),
});

// Stage 2: Full KYC Schema - High Security
const stage2OperatorKycSchema = z.object({
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
  routePermitNumber: z.string().optional(),
  routePermitImage: z.string().url().optional(),
});

// Stage 3: Business Setup Schema
const stage3OperatorSetupSchema = z.object({
  logo: z.string().url("অপারেটরের লোগো আপলোড করুন"),
  officeAddress: z.string().min(5, "অফিসের সম্পূর্ণ ঠিকানা লিখুন"),
  officePhone: z.string().min(10, "অফিসের ফোন নম্বর লিখুন"),
  officeEmail: z.string().email().optional(),
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
      return res.status(403).json({ error: "Ticket/Rental Operator is only available in Bangladesh" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
      include: {
        _count: { select: { ticketListings: true, rentalVehicles: true } },
      },
    });

    if (!operator) {
      return res.json({
        hasProfile: false,
        partnerStatus: null,
        checklist: {
          stage1Complete: false,
          stage2Complete: false,
          stage3Complete: false,
        },
        nextStep: "stage1",
        message: "টিকেট/রেন্টাল অপারেটর হতে প্রথম ধাপ শুরু করুন",
      });
    }

    // Check completion status for each stage
    const stage1Complete = !!(operator.operatorName && operator.operatorType && operator.cityOrArea);
    const stage2Complete = !!(
      operator.ownerName &&
      operator.fatherName &&
      operator.dateOfBirth &&
      operator.presentAddress &&
      operator.permanentAddress &&
      operator.nidNumber &&
      operator.nidFrontImage &&
      operator.nidBackImage &&
      operator.emergencyContactName &&
      operator.emergencyContactPhone
    );
    
    // Stage 3 requirement: logo + (1+ route for ticket OR 1+ vehicle for rental)
    const hasListings = operator._count.ticketListings >= 1 || operator._count.rentalVehicles >= 1;
    const stage3Complete = !!(operator.logo && operator.officeAddress && hasListings);

    // Determine next step
    let nextStep = "complete";
    if (!stage1Complete) {
      nextStep = "stage1";
    } else if (!stage2Complete) {
      nextStep = "stage2";
    } else if (operator.partnerStatus === "kyc_pending") {
      nextStep = "waiting_kyc_approval";
    } else if (operator.partnerStatus === "setup_incomplete" && !stage3Complete) {
      nextStep = "stage3";
    } else if (operator.partnerStatus === "ready_for_review") {
      nextStep = "waiting_final_approval";
    } else if (operator.partnerStatus === "rejected") {
      nextStep = "rejected";
    } else if (operator.partnerStatus === "live") {
      nextStep = "complete";
    }

    res.json({
      hasProfile: true,
      partnerStatus: operator.partnerStatus,
      verificationStatus: operator.verificationStatus,
      rejectionReason: operator.rejectionReason,
      checklist: {
        stage1Complete,
        stage2Complete,
        stage3Complete,
        ticketListingCount: operator._count.ticketListings,
        rentalVehicleCount: operator._count.rentalVehicles,
        requiredListings: 1,
      },
      nextStep,
      profile: {
        id: operator.id,
        operatorName: operator.operatorName,
        operatorType: operator.operatorType,
        cityOrArea: operator.cityOrArea,
        isActive: operator.isActive,
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

    // Allow customer, pending_ticket_operator, or ticket_operator roles
    if (!["customer", "pending_ticket_operator", "ticket_operator"].includes(userRole || "")) {
      return res.status(403).json({ error: "Invalid role for ticket operator onboarding" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { ticketOperator: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.countryCode !== "BD") {
      return res.status(403).json({ error: "Ticket/Rental Operator is only available in Bangladesh" });
    }

    // Check if already live
    if (user.ticketOperator?.partnerStatus === "live") {
      return res.status(400).json({ error: "আপনি ইতিমধ্যে একজন অনুমোদিত অপারেটর" });
    }

    const parsed = stage1OperatorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parsed.error.errors 
      });
    }

    const data = parsed.data;

    // Create or update operator with Stage 1 data
    const operator = await prisma.ticketOperator.upsert({
      where: { userId },
      create: {
        id: randomUUID(),
        userId,
        operatorName: data.operatorName,
        operatorType: data.operatorType,
        cityOrArea: data.cityOrArea,
        contactPhone: data.contactPhone,
        officeAddress: data.cityOrArea, // Temporary, will be updated in Stage 3
        officePhone: data.contactPhone,
        partnerStatus: "draft",
        verificationStatus: "pending",
        countryCode: "BD",
      },
      update: {
        operatorName: data.operatorName,
        operatorType: data.operatorType,
        cityOrArea: data.cityOrArea,
        contactPhone: data.contactPhone,
      },
    });

    // Update user role to pending_ticket_operator if they're a customer
    if (user.role === "customer") {
      await prisma.user.update({
        where: { id: userId },
        data: { role: "pending_ticket_operator" },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: user.email || "unknown",
        actorRole: user.role || "pending_ticket_operator",
        actionType: "TICKET_OPERATOR_STAGE1_SUBMITTED",
        entityType: "ticket_operator",
        entityId: operator.id,
        description: `Ticket Operator Stage 1 submitted: ${data.operatorName}`,
        metadata: { operatorName: data.operatorName, operatorType: data.operatorType, cityOrArea: data.cityOrArea },
        ipAddress: req.ip || null,
      },
    });

    res.status(201).json({
      success: true,
      message: "অভিনন্দন! প্রথম ধাপ সম্পন্ন হয়েছে।",
      operator: {
        id: operator.id,
        operatorName: operator.operatorName,
        partnerStatus: operator.partnerStatus,
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

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Please complete Stage 1 first" });
    }

    // Only allow if in draft or rejected status
    if (!["draft", "rejected"].includes(operator.partnerStatus)) {
      return res.status(400).json({ 
        error: "KYC already submitted or not in valid state",
        currentStatus: operator.partnerStatus,
      });
    }

    const parsed = stage2OperatorKycSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parsed.error.errors 
      });
    }

    const data = parsed.data;

    // Update with KYC data and move to kyc_pending
    const updated = await prisma.ticketOperator.update({
      where: { id: operator.id },
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
        routePermitNumber: data.routePermitNumber,
        routePermitImage: data.routePermitImage,
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
        actorRole: user?.role || "pending_ticket_operator",
        actionType: "TICKET_OPERATOR_KYC_SUBMITTED",
        entityType: "ticket_operator",
        entityId: operator.id,
        description: `Ticket Operator KYC submitted: ${data.ownerName}`,
        metadata: { ownerName: data.ownerName, nidLastFour: data.nidNumber.slice(-4) },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "KYC তথ্য জমা হয়েছে। অনুমোদনের জন্য অপেক্ষা করুন।",
      operator: {
        id: updated.id,
        operatorName: updated.operatorName,
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

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
      include: { _count: { select: { ticketListings: true, rentalVehicles: true } } },
    });

    if (!operator) {
      return res.status(404).json({ error: "Please complete Stage 1 and 2 first" });
    }

    // Only allow if KYC approved (setup_incomplete status)
    if (operator.partnerStatus !== "setup_incomplete") {
      return res.status(400).json({ 
        error: "KYC must be approved before completing setup",
        currentStatus: operator.partnerStatus,
      });
    }

    const parsed = stage3OperatorSetupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parsed.error.errors 
      });
    }

    const data = parsed.data;

    // Check if minimum listings/vehicles exist based on operator type
    const hasListings = operator._count.ticketListings >= 1 || operator._count.rentalVehicles >= 1;
    if (!hasListings) {
      return res.status(400).json({ 
        error: operator.operatorType === "rental" 
          ? "কমপক্ষে ১টি রেন্টাল গাড়ি যোগ করুন" 
          : "কমপক্ষে ১টি টিকেট রুট যোগ করুন",
        ticketListings: operator._count.ticketListings,
        rentalVehicles: operator._count.rentalVehicles,
        required: 1,
      });
    }

    // Update with setup data and move to ready_for_review
    const updated = await prisma.ticketOperator.update({
      where: { id: operator.id },
      data: {
        logo: data.logo,
        officeAddress: data.officeAddress,
        officePhone: data.officePhone,
        officeEmail: data.officeEmail,
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
        actorRole: user?.role || "pending_ticket_operator",
        actionType: "TICKET_OPERATOR_SETUP_COMPLETED",
        entityType: "ticket_operator",
        entityId: operator.id,
        description: `Ticket Operator setup completed: ${operator.operatorName}`,
        metadata: { 
          officeAddress: data.officeAddress, 
          ticketListings: operator._count.ticketListings,
          rentalVehicles: operator._count.rentalVehicles 
        },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "সেটআপ সম্পন্ন! চূড়ান্ত অনুমোদনের জন্য অপেক্ষা করুন।",
      operator: {
        id: updated.id,
        operatorName: updated.operatorName,
        partnerStatus: updated.partnerStatus,
      },
      nextStep: "waiting_final_approval",
    });
  } catch (error) {
    console.error("Stage 3 setup error:", error);
    res.status(500).json({ error: "সেটআপ সম্পন্ন করতে সমস্যা হয়েছে" });
  }
});

// ===================================================
// WALLET & EARNINGS ENDPOINTS
// ===================================================

import { WalletService } from "../services/walletService";
const walletService = new WalletService();

// Get operator wallet balance
router.get("/wallet", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Ticket operator profile not found" });
    }

    const wallet = await walletService.getWallet(operator.id, "ticket_operator");

    if (!wallet) {
      return res.json({
        balance: {
          available: 0,
          pending: 0,
          negative: 0,
          total: 0,
        },
        currency: "BDT",
        message: "Wallet will be created when you receive your first booking",
      });
    }

    res.json({
      balance: {
        available: Number(wallet.availableBalance),
        pending: Number(wallet.holdAmount || 0),
        negative: Number(wallet.negativeBalance),
        total: Number(wallet.availableBalance) - Number(wallet.negativeBalance),
      },
      currency: wallet.currency,
      walletId: wallet.id,
    });
  } catch (error) {
    console.error("Get wallet error:", error);
    res.status(500).json({ error: "ওয়ালেট লোড করতে সমস্যা হয়েছে" });
  }
});

// Get wallet transaction history
router.get("/wallet/transactions", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Ticket operator profile not found" });
    }

    const wallet = await walletService.getWallet(operator.id, "ticket_operator");
    
    if (!wallet) {
      return res.json({
        transactions: [],
        total: 0,
        page: 1,
        limit: 20,
      });
    }

    const { page = "1", limit = "20", serviceType, direction } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = { walletId: wallet.id };
    if (serviceType) where.serviceType = serviceType;
    if (direction) where.direction = direction;

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit as string),
        skip,
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    res.json({
      transactions: transactions.map((tx) => ({
        id: tx.id,
        serviceType: tx.serviceType,
        direction: tx.direction,
        amount: Number(tx.amount),
        balanceSnapshot: Number(tx.balanceSnapshot),
        description: tx.description,
        referenceType: tx.referenceType,
        referenceId: tx.referenceId,
        createdAt: tx.createdAt,
      })),
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ error: "লেনদেনের ইতিহাস লোড করতে সমস্যা হয়েছে" });
  }
});

// Get earnings summary (by service type and period)
router.get("/earnings/summary", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Ticket operator profile not found" });
    }

    const wallet = await walletService.getWallet(operator.id, "ticket_operator");
    
    if (!wallet) {
      return res.json({
        ticketEarnings: 0,
        rentalEarnings: 0,
        totalEarnings: 0,
        todayEarnings: 0,
        weekEarnings: 0,
        monthEarnings: 0,
        currency: "BDT",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [ticketEarnings, rentalEarnings, todayEarnings, weekEarnings, monthEarnings] = await Promise.all([
      prisma.walletTransaction.aggregate({
        where: { walletId: wallet.id, serviceType: "ticket", direction: "credit" },
        _sum: { amount: true },
      }),
      prisma.walletTransaction.aggregate({
        where: { walletId: wallet.id, serviceType: "rental", direction: "credit" },
        _sum: { amount: true },
      }),
      prisma.walletTransaction.aggregate({
        where: { 
          walletId: wallet.id, 
          direction: "credit",
          serviceType: { in: ["ticket", "rental"] },
          createdAt: { gte: today } 
        },
        _sum: { amount: true },
      }),
      prisma.walletTransaction.aggregate({
        where: { 
          walletId: wallet.id, 
          direction: "credit",
          serviceType: { in: ["ticket", "rental"] },
          createdAt: { gte: weekStart } 
        },
        _sum: { amount: true },
      }),
      prisma.walletTransaction.aggregate({
        where: { 
          walletId: wallet.id, 
          direction: "credit",
          serviceType: { in: ["ticket", "rental"] },
          createdAt: { gte: monthStart } 
        },
        _sum: { amount: true },
      }),
    ]);

    const ticketTotal = Number(ticketEarnings._sum.amount || 0);
    const rentalTotal = Number(rentalEarnings._sum.amount || 0);

    res.json({
      ticketEarnings: ticketTotal,
      rentalEarnings: rentalTotal,
      totalEarnings: ticketTotal + rentalTotal,
      todayEarnings: Number(todayEarnings._sum.amount || 0),
      weekEarnings: Number(weekEarnings._sum.amount || 0),
      monthEarnings: Number(monthEarnings._sum.amount || 0),
      currency: wallet.currency,
      commissionRate: operator.commissionRate,
    });
  } catch (error) {
    console.error("Get earnings summary error:", error);
    res.status(500).json({ error: "আয়ের সারাংশ লোড করতে সমস্যা হয়েছে" });
  }
});

// Get booking earnings details
router.get("/earnings/bookings", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Ticket operator profile not found" });
    }

    const { type = "all", page = "1", limit = "20", status } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    let ticketBookings: any[] = [];
    let rentalBookings: any[] = [];
    let ticketTotal = 0;
    let rentalTotal = 0;

    const statusFilter = status ? { status: status as any } : { status: { in: ["confirmed", "completed"] } };

    if (type === "all" || type === "ticket") {
      const listings = await prisma.ticketListing.findMany({
        where: { operatorId: operator.id },
        select: { id: true },
      });
      const listingIds = listings.map((l) => l.id);

      [ticketBookings, ticketTotal] = await Promise.all([
        prisma.ticketBooking.findMany({
          where: { listingId: { in: listingIds }, ...statusFilter },
          include: {
            listing: { select: { routeName: true, vehicleType: true } },
          },
          orderBy: { createdAt: "desc" },
          take: parseInt(limit as string),
          skip,
        }),
        prisma.ticketBooking.count({ where: { listingId: { in: listingIds }, ...statusFilter } }),
      ]);
    }

    if (type === "all" || type === "rental") {
      const vehicles = await prisma.rentalVehicle.findMany({
        where: { operatorId: operator.id },
        select: { id: true },
      });
      const vehicleIds = vehicles.map((v) => v.id);

      [rentalBookings, rentalTotal] = await Promise.all([
        prisma.rentalBooking.findMany({
          where: { vehicleId: { in: vehicleIds }, ...statusFilter },
          include: {
            vehicle: { select: { vehicleName: true, vehicleType: true } },
          },
          orderBy: { createdAt: "desc" },
          take: parseInt(limit as string),
          skip,
        }),
        prisma.rentalBooking.count({ where: { vehicleId: { in: vehicleIds }, ...statusFilter } }),
      ]);
    }

    res.json({
      ticketBookings: ticketBookings.map((b) => ({
        id: b.id,
        routeName: b.listing?.routeName,
        vehicleType: b.listing?.vehicleType,
        passengerName: b.passengerName,
        seats: b.seats,
        totalFare: Number(b.totalFare),
        operatorEarnings: Number(b.operatorEarnings || 0),
        platformFee: Number(b.platformFee || 0),
        status: b.status,
        travelDate: b.travelDate,
        createdAt: b.createdAt,
      })),
      rentalBookings: rentalBookings.map((b) => ({
        id: b.id,
        vehicleName: b.vehicle?.vehicleName,
        vehicleType: b.vehicle?.vehicleType,
        customerName: b.customerName,
        totalPrice: Number(b.totalPrice),
        operatorEarnings: Number(b.operatorEarnings || 0),
        platformFee: Number(b.platformFee || 0),
        status: b.status,
        startDate: b.startDate,
        endDate: b.endDate,
        createdAt: b.createdAt,
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        ticketTotal,
        rentalTotal,
      },
    });
  } catch (error) {
    console.error("Get booking earnings error:", error);
    res.status(500).json({ error: "বুকিং আয় লোড করতে সমস্যা হয়েছে" });
  }
});

// ===================================================
// PAYOUT ENDPOINTS
// ===================================================

import { PayoutService } from "../services/payoutService";
const payoutService = new PayoutService();

// Get payout history
router.get("/payouts", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Ticket operator profile not found" });
    }

    const { page = "1", limit = "20", status } = req.query;

    const result = await payoutService.getPayoutHistory({
      ownerId: operator.id,
      ownerType: "ticket_operator",
      status: status as any,
      limit: parseInt(limit as string),
      offset: (parseInt(page as string) - 1) * parseInt(limit as string),
    });

    res.json({
      payouts: result.payouts.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status,
        method: p.method,
        currency: p.wallet?.currency || "BDT",
        createdAt: p.createdAt,
        processedAt: p.processedAt,
        failureReason: p.failureReason,
      })),
      total: result.total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error("Get payouts error:", error);
    res.status(500).json({ error: "পেআউট ইতিহাস লোড করতে সমস্যা হয়েছে" });
  }
});

// Request payout
router.post("/payouts/request", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Ticket operator profile not found" });
    }

    if (operator.partnerStatus !== "live") {
      return res.status(400).json({ error: "শুধুমাত্র লাইভ অপারেটরগণ পেআউট অনুরোধ করতে পারবেন" });
    }

    const { amount, payoutAccountId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "বৈধ পরিমাণ প্রদান করুন" });
    }

    const wallet = await walletService.getWallet(operator.id, "ticket_operator");
    
    if (!wallet) {
      return res.status(400).json({ error: "ওয়ালেট পাওয়া যায়নি। প্রথমে কিছু বুকিং উপার্জন করুন।" });
    }

    const payout = await payoutService.createPayout({
      walletId: wallet.id,
      ownerId: operator.id,
      ownerType: "ticket_operator",
      amount,
      method: "manual_request",
      countryCode: "BD",
      payoutAccountId,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: "unknown",
        actorRole: "ticket_operator",
        actionType: "TICKET_OPERATOR_PAYOUT_REQUESTED",
        entityType: "payout",
        entityId: payout.id,
        description: `Ticket operator ${operator.operatorName} requested payout of BDT ${amount}`,
        metadata: { operatorId: operator.id, amount },
        ipAddress: req.ip || null,
      },
    });

    res.json({
      success: true,
      message: "পেআউট অনুরোধ সফলভাবে জমা দেওয়া হয়েছে",
      payout: {
        id: payout.id,
        amount: Number(payout.amount),
        status: payout.status,
        createdAt: payout.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Request payout error:", error);
    res.status(400).json({ error: error.message || "পেআউট অনুরোধ করতে সমস্যা হয়েছে" });
  }
});

// Get payout accounts
router.get("/payout-accounts", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Ticket operator profile not found" });
    }

    const accounts = await prisma.payoutAccount.findMany({
      where: {
        ownerId: operator.id,
        ownerType: "ticket_operator",
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        payoutType: true,
        provider: true,
        displayName: true,
        accountHolderName: true,
        maskedAccount: true,
        isDefault: true,
        status: true,
        createdAt: true,
      },
    });

    res.json({ accounts });
  } catch (error) {
    console.error("Get payout accounts error:", error);
    res.status(500).json({ error: "পেআউট অ্যাকাউন্ট লোড করতে সমস্যা হয়েছে" });
  }
});

// Add payout account (bKash/Nagad)
router.post("/payout-accounts", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const operator = await prisma.ticketOperator.findUnique({
      where: { userId },
    });

    if (!operator) {
      return res.status(404).json({ error: "Ticket operator profile not found" });
    }

    const { 
      payoutType, 
      provider, 
      accountNumber, 
      accountHolderName,
      displayName,
      isDefault = false 
    } = req.body;

    if (!payoutType || !provider || !accountNumber || !accountHolderName) {
      return res.status(400).json({ error: "সব তথ্য প্রদান করুন" });
    }

    // Validate provider for BD
    const validProviders = ["bkash", "nagad", "bank"];
    if (!validProviders.includes(provider.toLowerCase())) {
      return res.status(400).json({ error: "সমর্থিত প্রদানকারী: bKash, Nagad, Bank" });
    }

    // Mask account number for display
    const maskedAccount = accountNumber.slice(-4).padStart(accountNumber.length, "*");

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.payoutAccount.updateMany({
        where: { ownerId: operator.id, ownerType: "ticket_operator" },
        data: { isDefault: false },
      });
    }

    const account = await prisma.payoutAccount.create({
      data: {
        ownerId: operator.id,
        ownerType: "ticket_operator",
        payoutType,
        provider: provider.toLowerCase(),
        encryptedDetails: accountNumber, // In production, encrypt this
        accountHolderName,
        displayName: displayName || `${provider} - ${maskedAccount}`,
        maskedAccount,
        isDefault,
        status: "active",
        countryCode: "BD",
      },
    });

    res.json({
      success: true,
      message: "পেআউট অ্যাকাউন্ট সফলভাবে যোগ করা হয়েছে",
      account: {
        id: account.id,
        payoutType: account.payoutType,
        provider: account.provider,
        displayName: account.displayName,
        maskedAccount: account.maskedAccount,
        isDefault: account.isDefault,
        status: account.status,
      },
    });
  } catch (error) {
    console.error("Add payout account error:", error);
    res.status(500).json({ error: "পেআউট অ্যাকাউন্ট যোগ করতে সমস্যা হয়েছে" });
  }
});

export default router;
