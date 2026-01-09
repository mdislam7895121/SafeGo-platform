import { Router, Response } from "express";
import { prisma } from "../db";
import { z } from "zod";
import { randomUUID } from "crypto";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { safeAuditLogCreate } from "../utils/audit";

const router = Router();

const searchTicketsSchema = z.object({
  originCity: z.string().min(2),
  destinationCity: z.string().min(2),
  journeyDate: z.string().transform((val) => new Date(val)),
  passengerCount: z.number().int().positive().optional().default(1),
  vehicleType: z.enum(["bus", "coach", "ac_bus", "train"]).optional(),
});

const bookTicketSchema = z.object({
  listingId: z.string().uuid(),
  journeyDate: z.string().transform((val) => new Date(val)),
  seatNumbers: z.array(z.string()).min(1),
  passengerName: z.string().min(2),
  passengerPhone: z.string().min(10),
  passengerEmail: z.string().email().optional(),
  passengerNid: z.string().optional(),
  paymentMethod: z.enum(["bkash", "nagad", "cash", "card"]),
});

router.get("/search", async (req, res: Response) => {
  try {
    const { originCity, destinationCity, journeyDate, vehicleType, page = "1", limit = "20" } = req.query;

    if (!originCity || !destinationCity || !journeyDate) {
      return res.status(400).json({ 
        error: "Origin city, destination city, and journey date are required",
        errorBn: "যাত্রার তথ্য সম্পূর্ণ করুন"
      });
    }

    const where: any = {
      isActive: true,
      originCity: { contains: originCity as string, mode: "insensitive" },
      destinationCity: { contains: destinationCity as string, mode: "insensitive" },
      availableSeats: { gt: 0 },
      operator: {
        isActive: true,
        partnerStatus: "live",
        countryCode: "BD",
      },
    };

    if (vehicleType) {
      where.vehicleType = vehicleType;
    }

    const journeyDay = new Date(journeyDate as string);
    const dayOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][journeyDay.getDay()];

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [listings, total] = await Promise.all([
      prisma.ticketListing.findMany({
        where,
        take: parseInt(limit as string),
        skip,
        orderBy: [{ departureTime: "asc" }, { basePrice: "asc" }],
        include: {
          operator: {
            select: {
              id: true,
              operatorName: true,
              logo: true,
              averageRating: true,
              totalRatings: true,
            },
          },
        },
      }),
      prisma.ticketListing.count({ where }),
    ]);

    const filteredListings = listings.filter((listing) => {
      if (!listing.daysOfOperation) return true;
      const days = listing.daysOfOperation as string[];
      return days.length === 0 || days.includes(dayOfWeek);
    });

    res.json({
      listings: filteredListings.map((l) => ({
        id: l.id,
        routeName: l.routeName,
        vehicleType: l.vehicleType,
        vehicleBrand: l.vehicleBrand,
        originCity: l.originCity,
        originStation: l.originStation,
        destinationCity: l.destinationCity,
        destinationStation: l.destinationStation,
        departureTime: l.departureTime,
        arrivalTime: l.arrivalTime,
        durationMinutes: l.durationMinutes,
        basePrice: l.basePrice,
        discountPrice: l.discountPrice,
        availableSeats: l.availableSeats,
        totalSeats: l.totalSeats,
        amenities: l.amenities,
        operator: l.operator,
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
      searchParams: {
        originCity,
        destinationCity,
        journeyDate,
        dayOfWeek,
      },
    });
  } catch (error) {
    console.error("Search tickets error:", error);
    res.status(500).json({ 
      error: "Failed to search tickets",
      errorBn: "টিকেট খুঁজতে সমস্যা হয়েছে"
    });
  }
});

router.get("/listings/:listingId", async (req, res: Response) => {
  try {
    const { listingId } = req.params;
    const { journeyDate } = req.query;

    const listing = await prisma.ticketListing.findUnique({
      where: { id: listingId },
      include: {
        operator: {
          select: {
            id: true,
            operatorName: true,
            logo: true,
            officePhone: true,
            averageRating: true,
            totalRatings: true,
          },
        },
      },
    });

    if (!listing) {
      return res.status(404).json({ 
        error: "Listing not found",
        errorBn: "রুট পাওয়া যায়নি"
      });
    }

    if (!listing.isActive) {
      return res.status(400).json({ 
        error: "This route is currently not available",
        errorBn: "এই রুট বর্তমানে চালু নেই"
      });
    }

    let bookedSeats: string[] = [];
    if (journeyDate) {
      const date = new Date(journeyDate as string);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const bookings = await prisma.ticketBooking.findMany({
        where: {
          listingId,
          journeyDate: { gte: date, lt: nextDay },
          status: { in: ["booked", "confirmed"] },
        },
        select: { seatNumbers: true },
      });

      bookedSeats = bookings.flatMap((b) => (b.seatNumbers as string[]) || []);
    }

    res.json({
      listing: {
        ...listing,
        bookedSeats,
        effectivePrice: listing.discountPrice || listing.basePrice,
      },
    });
  } catch (error) {
    console.error("Get listing detail error:", error);
    res.status(500).json({ 
      error: "Failed to fetch listing details",
      errorBn: "রুটের বিবরণ দেখতে সমস্যা হয়েছে"
    });
  }
});

router.get("/availability", async (req, res: Response) => {
  try {
    const { listingId, journeyDate } = req.query;

    if (!listingId || !journeyDate) {
      return res.status(400).json({ 
        error: "Listing ID and journey date are required",
        errorBn: "রুট ও যাত্রার তারিখ প্রয়োজন"
      });
    }

    const listing = await prisma.ticketListing.findUnique({
      where: { id: listingId as string },
      select: { 
        id: true, 
        totalSeats: true, 
        availableSeats: true,
        seatMap: true,
        isActive: true,
      },
    });

    if (!listing || !listing.isActive) {
      return res.status(404).json({ 
        error: "Listing not available",
        errorBn: "রুট পাওয়া যায়নি"
      });
    }

    const date = new Date(journeyDate as string);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const bookings = await prisma.ticketBooking.findMany({
      where: {
        listingId: listingId as string,
        journeyDate: { gte: date, lt: nextDay },
        status: { in: ["booked", "confirmed"] },
      },
      select: { seatNumbers: true, numberOfSeats: true },
    });

    const bookedSeats = bookings.flatMap((b) => (b.seatNumbers as string[]) || []);
    const totalBooked = bookedSeats.length;
    const availableForDate = listing.totalSeats - totalBooked;

    res.json({
      listingId,
      journeyDate,
      totalSeats: listing.totalSeats,
      bookedSeats,
      availableSeats: availableForDate,
      seatMap: listing.seatMap,
      isAvailable: availableForDate > 0,
    });
  } catch (error) {
    console.error("Check availability error:", error);
    res.status(500).json({ 
      error: "Failed to check availability",
      errorBn: "সিট চেক করতে সমস্যা হয়েছে"
    });
  }
});

// ===================================================
// PUBLIC TICKET VERIFICATION (No auth required)
// ===================================================

import { ticketGenerationService } from "../services/ticketGenerationService";

router.get("/verify/:bookingId", async (req, res: Response) => {
  try {
    const { bookingId } = req.params;

    const result = await ticketGenerationService.verifyTicket(bookingId, "ticket");

    if (!result.valid) {
      return res.status(400).json({
        valid: false,
        error: result.error,
        booking: result.booking,
      });
    }

    res.json({
      valid: true,
      message: "টিকেট বৈধ",
      booking: result.booking,
    });
  } catch (error) {
    console.error("Verify ticket error:", error);
    res.status(500).json({ error: "যাচাই করতে সমস্যা হয়েছে" });
  }
});

// ===================================================
// AUTHENTICATED ROUTES (All routes below require auth)
// ===================================================
router.use(authenticateToken);

router.post("/book", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const userCountry = req.user?.countryCode;

    if (!userId) {
      return res.status(401).json({ 
        error: "Unauthorized",
        errorBn: "অনুগ্রহ করে লগইন করুন"
      });
    }

    if (userCountry !== "BD") {
      return res.status(403).json({ 
        error: "Ticket booking is only available in Bangladesh",
        errorBn: "টিকেট বুকিং শুধুমাত্র বাংলাদেশে উপলব্ধ"
      });
    }

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customer) {
      return res.status(404).json({ 
        error: "Customer profile not found",
        errorBn: "গ্রাহক প্রোফাইল পাওয়া যায়নি"
      });
    }

    const parsed = bookTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Validation failed",
        errorBn: "তথ্য সঠিক নয়",
        details: parsed.error.errors 
      });
    }

    const data = parsed.data;

    const listing = await prisma.ticketListing.findUnique({
      where: { id: data.listingId },
      include: {
        operator: {
          select: { 
            id: true, 
            ticketCommissionRate: true, 
            isActive: true,
            partnerStatus: true,
          },
        },
      },
    });

    if (!listing || !listing.isActive) {
      return res.status(404).json({ 
        error: "Route not available",
        errorBn: "এই রুট বর্তমানে বন্ধ আছে"
      });
    }

    if (!listing.operator.isActive || listing.operator.partnerStatus !== "live") {
      return res.status(400).json({ 
        error: "Operator is not active",
        errorBn: "অপারেটর বর্তমানে সেবা দিচ্ছে না"
      });
    }

    const nextDay = new Date(data.journeyDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const existingBookings = await prisma.ticketBooking.findMany({
      where: {
        listingId: data.listingId,
        journeyDate: { gte: data.journeyDate, lt: nextDay },
        status: { in: ["booked", "confirmed"] },
      },
      select: { seatNumbers: true },
    });

    const bookedSeats = existingBookings.flatMap((b) => (b.seatNumbers as string[]) || []);
    const requestedSeats = data.seatNumbers;

    const conflictingSeats = requestedSeats.filter((seat) => bookedSeats.includes(seat));
    if (conflictingSeats.length > 0) {
      return res.status(400).json({ 
        error: `Seats already booked: ${conflictingSeats.join(", ")}`,
        errorBn: `এই সিটগুলো ইতিমধ্যে বুক করা হয়েছে: ${conflictingSeats.join(", ")}`,
        conflictingSeats,
      });
    }

    const pricePerSeat = Number(listing.discountPrice || listing.basePrice);
    const numberOfSeats = requestedSeats.length;
    const totalAmount = pricePerSeat * numberOfSeats;
    const commissionRate = Number(listing.operator.ticketCommissionRate) / 100;
    const safegoCommission = totalAmount * commissionRate;
    const operatorPayout = totalAmount - safegoCommission;

    const bookingNumber = `TKT${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 4).toUpperCase()}`;

    const booking = await prisma.$transaction(async (tx) => {
      const newBooking = await tx.ticketBooking.create({
        data: {
          id: randomUUID(),
          bookingNumber,
          customerId: customer.id,
          operatorId: listing.operator.id,
          listingId: listing.id,
          journeyDate: data.journeyDate,
          departureTime: listing.departureTime,
          passengerName: data.passengerName,
          passengerPhone: data.passengerPhone,
          passengerEmail: data.passengerEmail,
          passengerNid: data.passengerNid,
          seatNumbers: requestedSeats,
          numberOfSeats,
          pricePerSeat,
          totalAmount,
          safegoCommission,
          operatorPayout,
          paymentMethod: data.paymentMethod,
          paymentStatus: data.paymentMethod === "cash" ? "pending" : "pending",
          status: "booked",
          statusHistory: JSON.stringify([
            { status: "booked", timestamp: new Date().toISOString(), actor: "customer" },
          ]),
        },
      });

      await tx.ticketListing.update({
        where: { id: listing.id },
        data: {
          availableSeats: { decrement: numberOfSeats },
        },
      });

      await tx.ticketOperator.update({
        where: { id: listing.operator.id },
        data: {
          totalBookings: { increment: 1 },
        },
      });

      return newBooking;
    });

    // Safe audit log - won't crash on failure
    await safeAuditLogCreate({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: customer.fullName || "customer",
        actorRole: userRole || "customer",
        actionType: "TICKET_BOOKED",
        entityType: "ticket_booking",
        entityId: booking.id,
        description: `Ticket booked: ${bookingNumber} for ${listing.routeName}`,
        metadata: {
          bookingNumber,
          route: listing.routeName,
          journeyDate: data.journeyDate.toISOString(),
          seats: requestedSeats,
          totalAmount,
        },
        ipAddress: req.ip || null,
      },
    });

    res.status(201).json({
      success: true,
      message: "টিকেট বুকিং সফল হয়েছে",
      booking: {
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        routeName: listing.routeName,
        originCity: listing.originCity,
        destinationCity: listing.destinationCity,
        journeyDate: booking.journeyDate,
        departureTime: booking.departureTime,
        seatNumbers: booking.seatNumbers,
        numberOfSeats: booking.numberOfSeats,
        totalAmount: booking.totalAmount,
        paymentMethod: booking.paymentMethod,
        paymentStatus: booking.paymentStatus,
        status: booking.status,
      },
    });
  } catch (error) {
    console.error("Book ticket error:", error);
    res.status(500).json({ 
      error: "Failed to book ticket",
      errorBn: "টিকেট বুক করতে সমস্যা হয়েছে"
    });
  }
});

router.get("/my-bookings", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const { status, page = "1", limit = "20" } = req.query;

    const where: any = { customerId: customer.id };
    if (status) {
      where.status = status;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [bookings, total] = await Promise.all([
      prisma.ticketBooking.findMany({
        where,
        take: parseInt(limit as string),
        skip,
        orderBy: { bookedAt: "desc" },
        include: {
          listing: {
            select: {
              routeName: true,
              originCity: true,
              originStation: true,
              destinationCity: true,
              destinationStation: true,
              vehicleType: true,
              vehicleBrand: true,
              amenities: true,
            },
          },
          operator: {
            select: {
              operatorName: true,
              logo: true,
              officePhone: true,
            },
          },
        },
      }),
      prisma.ticketBooking.count({ where }),
    ]);

    res.json({
      bookings: bookings.map((b) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        journeyDate: b.journeyDate,
        departureTime: b.departureTime,
        seatNumbers: b.seatNumbers,
        numberOfSeats: b.numberOfSeats,
        totalAmount: b.totalAmount,
        paymentMethod: b.paymentMethod,
        paymentStatus: b.paymentStatus,
        status: b.status,
        bookedAt: b.bookedAt,
        listing: b.listing,
        operator: b.operator,
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error("Get my bookings error:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

router.get("/my-bookings/:bookingId", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { bookingId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const booking = await prisma.ticketBooking.findUnique({
      where: { id: bookingId },
      include: {
        listing: true,
        operator: {
          select: {
            operatorName: true,
            logo: true,
            officePhone: true,
            officeAddress: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.customerId !== customer.id) {
      return res.status(403).json({ error: "You do not have access to this booking" });
    }

    res.json({
      booking: {
        ...booking,
        statusHistory: booking.statusHistory ? JSON.parse(booking.statusHistory as string) : [],
      },
    });
  } catch (error) {
    console.error("Get booking detail error:", error);
    res.status(500).json({ error: "Failed to fetch booking details" });
  }
});

router.post("/my-bookings/:bookingId/cancel", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { bookingId } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const booking = await prisma.ticketBooking.findUnique({
      where: { id: bookingId },
      include: { listing: true },
    });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.customerId !== customer.id) {
      return res.status(403).json({ error: "You do not have access to this booking" });
    }

    if (!["booked", "confirmed"].includes(booking.status)) {
      return res.status(400).json({ 
        error: `Cannot cancel booking with status: ${booking.status}`,
        errorBn: "এই বুকিং বাতিল করা যাবে না"
      });
    }

    const journeyDate = new Date(booking.journeyDate);
    const now = new Date();
    const hoursUntilDeparture = (journeyDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    let refundPercent = 0;
    if (hoursUntilDeparture >= 24) {
      refundPercent = 100;
    } else if (hoursUntilDeparture >= 12) {
      refundPercent = 75;
    } else if (hoursUntilDeparture >= 6) {
      refundPercent = 50;
    } else if (hoursUntilDeparture >= 2) {
      refundPercent = 25;
    }

    const refundAmount = (Number(booking.totalAmount) * refundPercent) / 100;

    const statusHistory = booking.statusHistory ? JSON.parse(booking.statusHistory as string) : [];
    statusHistory.push({ 
      status: "cancelled_by_customer", 
      timestamp: new Date().toISOString(), 
      actor: "customer",
      reason,
    });

    await prisma.$transaction(async (tx) => {
      await tx.ticketBooking.update({
        where: { id: bookingId },
        data: {
          status: "cancelled_by_customer",
          statusHistory: JSON.stringify(statusHistory),
          cancelledAt: new Date(),
          cancelledBy: "customer",
          cancellationReason: reason,
          refundAmount,
          refundStatus: refundAmount > 0 ? "pending" : null,
        },
      });

      await tx.ticketListing.update({
        where: { id: booking.listingId },
        data: {
          availableSeats: { increment: booking.numberOfSeats },
        },
      });
    });

    res.json({
      success: true,
      message: "বুকিং বাতিল হয়েছে",
      refundInfo: {
        refundPercent,
        refundAmount,
        refundStatus: refundAmount > 0 ? "pending" : "no_refund",
      },
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({ error: "Failed to cancel booking" });
  }
});

// ===================================================
// TICKET GENERATION (auth required)
// ===================================================

router.get("/bookings/:bookingId/ticket", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { bookingId } = req.params;
    const { format = "html" } = req.query;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get booking with customer profile to verify ownership
    const booking = await prisma.ticketBooking.findUnique({
      where: { id: bookingId },
      include: {
        customer: { select: { userId: true } },
        listing: {
          include: {
            operator: { select: { operatorName: true } },
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: "বুকিং পাওয়া যায়নি" });
    }

    // Verify ownership - try included relation first, fallback to profile lookup
    let ownerUserId = booking.customer?.userId;
    if (!ownerUserId && booking.customerId) {
      // Fallback: lookup customer profile separately if relation didn't load
      const customerProfile = await prisma.customerProfile.findUnique({
        where: { id: booking.customerId },
        select: { userId: true },
      });
      ownerUserId = customerProfile?.userId;
    }

    if (ownerUserId !== userId) {
      return res.status(403).json({ error: "এই টিকেট অ্যাক্সেস করার অনুমতি নেই" });
    }

    if (booking.status === "cancelled" || booking.status === "cancelled_by_customer") {
      return res.status(400).json({ error: "বাতিলকৃত বুকিংয়ের জন্য টিকেট তৈরি করা সম্ভব নয়" });
    }

    const ticket = await ticketGenerationService.generateTicketForBooking(bookingId, "ticket");

    if (!ticket) {
      return res.status(500).json({ error: "টিকেট তৈরি করতে সমস্যা হয়েছে" });
    }

    if (format === "json") {
      return res.json({
        ticketId: ticket.ticketId,
        qrCodeImage: ticket.qrCodeImage,
        verificationUrl: ticket.verificationUrl,
        bookingCode: booking.bookingCode,
        booking: {
          id: booking.id,
          passengerName: booking.passengerName,
          routeName: booking.listing?.routeName,
          operatorName: booking.listing?.operator?.operatorName,
          travelDate: booking.travelDate,
          departureTime: booking.listing?.departureTime,
          seats: booking.seats,
          totalFare: Number(booking.totalFare),
          status: booking.status,
        },
      });
    }

    res.setHeader("Content-Type", "text/html");
    res.send(ticket.ticketHtml);
  } catch (error) {
    console.error("Get ticket error:", error);
    res.status(500).json({ error: "টিকেট লোড করতে সমস্যা হয়েছে" });
  }
});

export default router;
