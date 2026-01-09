import { Router, Response } from "express";
import { prisma } from "../db";
import { z } from "zod";
import { randomUUID } from "crypto";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { safeAuditLogCreate } from "../utils/audit";

const router = Router();

const searchRentalsSchema = z.object({
  vehicleType: z.enum(["car", "micro", "tourist_bus", "suv", "sedan"]).optional(),
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().transform((val) => new Date(val)),
  passengerCount: z.number().int().positive().optional(),
  location: z.string().optional(),
});

const bookRentalSchema = z.object({
  vehicleId: z.string().uuid(),
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().transform((val) => new Date(val)),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  pickupLocation: z.string().min(5),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  returnLocation: z.string().optional(),
  renterName: z.string().min(2),
  renterPhone: z.string().min(10),
  renterEmail: z.string().email().optional(),
  renterNid: z.string().optional(),
  driverLicenseNumber: z.string().optional(),
  includesDriver: z.boolean().optional().default(true),
  paymentMethod: z.enum(["bkash", "nagad", "cash", "card"]),
});

router.get("/search", async (req, res: Response) => {
  try {
    const { vehicleType, passengerCount, location, page = "1", limit = "20" } = req.query;

    const where: any = {
      isActive: true,
      isAvailable: true,
      operator: {
        isActive: true,
        partnerStatus: "live",
        countryCode: "BD",
        operatorType: { in: ["rental", "both"] },
      },
    };

    if (vehicleType) {
      where.vehicleType = vehicleType;
    }

    if (passengerCount) {
      where.passengerCapacity = { gte: parseInt(passengerCount as string) };
    }

    if (location) {
      where.OR = [
        { currentLocation: { contains: location as string, mode: "insensitive" } },
        { operator: { cityOrArea: { contains: location as string, mode: "insensitive" } } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [vehicles, total] = await Promise.all([
      prisma.rentalVehicle.findMany({
        where,
        take: parseInt(limit as string),
        skip,
        orderBy: [{ pricePerDay: "asc" }],
        include: {
          operator: {
            select: {
              id: true,
              operatorName: true,
              logo: true,
              cityOrArea: true,
              averageRating: true,
              totalRatings: true,
              officePhone: true,
            },
          },
        },
      }),
      prisma.rentalVehicle.count({ where }),
    ]);

    res.json({
      vehicles: vehicles.map((v) => ({
        id: v.id,
        vehicleType: v.vehicleType,
        brand: v.brand,
        model: v.model,
        year: v.year,
        color: v.color,
        passengerCapacity: v.passengerCapacity,
        luggageCapacity: v.luggageCapacity,
        pricePerDay: v.pricePerDay,
        pricePerHour: v.pricePerHour,
        pricePerKm: v.pricePerKm,
        securityDeposit: v.securityDeposit,
        features: v.features,
        images: v.images,
        currentLocation: v.currentLocation,
        isAvailable: v.isAvailable,
        operator: v.operator,
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error("Search rentals error:", error);
    res.status(500).json({ 
      error: "Failed to search rentals",
      errorBn: "রেন্টাল গাড়ি খুঁজতে সমস্যা হয়েছে"
    });
  }
});

router.get("/vehicles/:vehicleId", async (req, res: Response) => {
  try {
    const { vehicleId } = req.params;

    const vehicle = await prisma.rentalVehicle.findUnique({
      where: { id: vehicleId },
      include: {
        operator: {
          select: {
            id: true,
            operatorName: true,
            logo: true,
            officePhone: true,
            officeAddress: true,
            cityOrArea: true,
            averageRating: true,
            totalRatings: true,
          },
        },
        bookings: {
          where: {
            status: { in: ["accepted", "vehicle_assigned", "in_use"] },
            endDate: { gte: new Date() },
          },
          select: {
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    if (!vehicle) {
      return res.status(404).json({ 
        error: "Vehicle not found",
        errorBn: "গাড়ি পাওয়া যায়নি"
      });
    }

    if (!vehicle.isActive) {
      return res.status(400).json({ 
        error: "This vehicle is currently not available",
        errorBn: "এই গাড়ি বর্তমানে উপলব্ধ নয়"
      });
    }

    const bookedDates = vehicle.bookings.map((b) => ({
      startDate: b.startDate,
      endDate: b.endDate,
    }));

    const { bookings, ...vehicleData } = vehicle;

    res.json({
      vehicle: {
        ...vehicleData,
        bookedDates,
      },
    });
  } catch (error) {
    console.error("Get vehicle detail error:", error);
    res.status(500).json({ 
      error: "Failed to fetch vehicle details",
      errorBn: "গাড়ির বিবরণ দেখতে সমস্যা হয়েছে"
    });
  }
});

router.get("/availability", async (req, res: Response) => {
  try {
    const { vehicleId, startDate, endDate } = req.query;

    if (!vehicleId || !startDate || !endDate) {
      return res.status(400).json({ 
        error: "Vehicle ID, start date, and end date are required",
        errorBn: "গাড়ি ও তারিখ প্রয়োজন"
      });
    }

    const vehicle = await prisma.rentalVehicle.findUnique({
      where: { id: vehicleId as string },
      select: { 
        id: true, 
        isActive: true,
        isAvailable: true,
        pricePerDay: true,
        securityDeposit: true,
      },
    });

    if (!vehicle || !vehicle.isActive) {
      return res.status(404).json({ 
        error: "Vehicle not available",
        errorBn: "গাড়ি পাওয়া যায়নি"
      });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    const conflictingBookings = await prisma.rentalBooking.findMany({
      where: {
        vehicleId: vehicleId as string,
        status: { in: ["requested", "accepted", "vehicle_assigned", "in_use"] },
        OR: [
          {
            startDate: { lte: end },
            endDate: { gte: start },
          },
        ],
      },
      select: { 
        id: true, 
        startDate: true, 
        endDate: true,
        status: true,
      },
    });

    const isAvailable = vehicle.isAvailable && conflictingBookings.length === 0;

    const rentalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const estimatedTotal = rentalDays * Number(vehicle.pricePerDay);

    res.json({
      vehicleId,
      startDate,
      endDate,
      rentalDays,
      isAvailable,
      conflictingBookings: isAvailable ? [] : conflictingBookings.map((b) => ({
        startDate: b.startDate,
        endDate: b.endDate,
      })),
      pricing: {
        pricePerDay: vehicle.pricePerDay,
        estimatedSubtotal: estimatedTotal,
        securityDeposit: vehicle.securityDeposit || 0,
        estimatedTotal: estimatedTotal + Number(vehicle.securityDeposit || 0),
      },
    });
  } catch (error) {
    console.error("Check rental availability error:", error);
    res.status(500).json({ 
      error: "Failed to check availability",
      errorBn: "উপলব্ধতা চেক করতে সমস্যা হয়েছে"
    });
  }
});

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
        error: "Rental booking is only available in Bangladesh",
        errorBn: "রেন্টাল বুকিং শুধুমাত্র বাংলাদেশে উপলব্ধ"
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

    const parsed = bookRentalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Validation failed",
        errorBn: "তথ্য সঠিক নয়",
        details: parsed.error.errors 
      });
    }

    const data = parsed.data;

    const vehicle = await prisma.rentalVehicle.findUnique({
      where: { id: data.vehicleId },
      include: {
        operator: {
          select: { 
            id: true, 
            rentalCommissionRate: true, 
            isActive: true,
            partnerStatus: true,
          },
        },
      },
    });

    if (!vehicle || !vehicle.isActive) {
      return res.status(404).json({ 
        error: "Vehicle not available",
        errorBn: "এই গাড়ি বর্তমানে উপলব্ধ নয়"
      });
    }

    if (!vehicle.isAvailable) {
      return res.status(400).json({ 
        error: "Vehicle is not available for the selected dates",
        errorBn: "এই গাড়ি নির্বাচিত তারিখে উপলব্ধ নয়"
      });
    }

    if (!vehicle.operator.isActive || vehicle.operator.partnerStatus !== "live") {
      return res.status(400).json({ 
        error: "Operator is not active",
        errorBn: "অপারেটর বর্তমানে সেবা দিচ্ছে না"
      });
    }

    const conflictingBookings = await prisma.rentalBooking.findMany({
      where: {
        vehicleId: data.vehicleId,
        status: { in: ["requested", "accepted", "vehicle_assigned", "in_use"] },
        OR: [
          {
            startDate: { lte: data.endDate },
            endDate: { gte: data.startDate },
          },
        ],
      },
    });

    if (conflictingBookings.length > 0) {
      return res.status(400).json({ 
        error: "Vehicle is already booked for the selected dates",
        errorBn: "এই তারিখে গাড়ি আগে থেকেই বুক করা আছে",
      });
    }

    const rentalDays = Math.max(1, Math.ceil((data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const pricePerDay = Number(vehicle.pricePerDay);
    const subtotal = rentalDays * pricePerDay;
    const securityDeposit = Number(vehicle.securityDeposit || 0);
    const totalAmount = subtotal + securityDeposit;
    
    const commissionRate = Number(vehicle.operator.rentalCommissionRate) / 100;
    const safegoCommission = subtotal * commissionRate;
    const operatorPayout = subtotal - safegoCommission;

    const bookingNumber = `RNT${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 4).toUpperCase()}`;

    const booking = await prisma.$transaction(async (tx) => {
      const newBooking = await tx.rentalBooking.create({
        data: {
          id: randomUUID(),
          bookingNumber,
          customerId: customer.id,
          operatorId: vehicle.operator.id,
          vehicleId: vehicle.id,
          startDate: data.startDate,
          endDate: data.endDate,
          startTime: data.startTime,
          endTime: data.endTime,
          pickupLocation: data.pickupLocation,
          pickupLat: data.pickupLat,
          pickupLng: data.pickupLng,
          returnLocation: data.returnLocation || data.pickupLocation,
          renterName: data.renterName,
          renterPhone: data.renterPhone,
          renterEmail: data.renterEmail,
          renterNid: data.renterNid,
          driverLicenseNumber: data.driverLicenseNumber,
          includesDriver: data.includesDriver,
          rentalDays,
          pricePerDay,
          subtotal,
          securityDeposit,
          totalAmount,
          safegoCommission,
          operatorPayout,
          paymentMethod: data.paymentMethod,
          paymentStatus: data.paymentMethod === "cash" ? "pending" : "pending",
          status: "requested",
          statusHistory: JSON.stringify([
            { status: "requested", timestamp: new Date().toISOString(), actor: "customer" },
          ]),
        },
      });

      await tx.ticketOperator.update({
        where: { id: vehicle.operator.id },
        data: {
          totalBookings: { increment: 1 },
        },
      });

      return newBooking;
    });

    await safeAuditLogCreate({
      data: {
        id: randomUUID(),
        actorId: userId,
        actorEmail: customer.fullName || "customer",
        actorRole: userRole || "customer",
        actionType: "RENTAL_BOOKED",
        entityType: "rental_booking",
        entityId: booking.id,
        description: `Rental booked: ${bookingNumber} for ${vehicle.brand} ${vehicle.model}`,
        metadata: {
          bookingNumber,
          vehicle: `${vehicle.brand} ${vehicle.model}`,
          startDate: data.startDate.toISOString(),
          endDate: data.endDate.toISOString(),
          rentalDays,
          totalAmount,
        },
        ipAddress: req.ip || null,
      },
    });

    res.status(201).json({
      success: true,
      message: "রেন্টাল বুকিং অনুরোধ জমা হয়েছে",
      booking: {
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        vehicle: {
          brand: vehicle.brand,
          model: vehicle.model,
          vehicleType: vehicle.vehicleType,
          registrationNumber: vehicle.registrationNumber,
        },
        startDate: booking.startDate,
        endDate: booking.endDate,
        rentalDays: booking.rentalDays,
        pickupLocation: booking.pickupLocation,
        subtotal: booking.subtotal,
        securityDeposit: booking.securityDeposit,
        totalAmount: booking.totalAmount,
        paymentMethod: booking.paymentMethod,
        paymentStatus: booking.paymentStatus,
        status: booking.status,
      },
    });
  } catch (error) {
    console.error("Book rental error:", error);
    res.status(500).json({ 
      error: "Failed to book rental",
      errorBn: "রেন্টাল বুক করতে সমস্যা হয়েছে"
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
      prisma.rentalBooking.findMany({
        where,
        take: parseInt(limit as string),
        skip,
        orderBy: { requestedAt: "desc" },
        include: {
          vehicle: {
            select: {
              brand: true,
              model: true,
              vehicleType: true,
              color: true,
              registrationNumber: true,
              passengerCapacity: true,
              images: true,
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
      prisma.rentalBooking.count({ where }),
    ]);

    res.json({
      bookings: bookings.map((b) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        startDate: b.startDate,
        endDate: b.endDate,
        rentalDays: b.rentalDays,
        pickupLocation: b.pickupLocation,
        subtotal: b.subtotal,
        securityDeposit: b.securityDeposit,
        totalAmount: b.totalAmount,
        paymentMethod: b.paymentMethod,
        paymentStatus: b.paymentStatus,
        status: b.status,
        includesDriver: b.includesDriver,
        assignedDriverName: b.assignedDriverName,
        assignedDriverPhone: b.assignedDriverPhone,
        requestedAt: b.requestedAt,
        vehicle: b.vehicle,
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
    console.error("Get my rental bookings error:", error);
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

    const booking = await prisma.rentalBooking.findUnique({
      where: { id: bookingId },
      include: {
        vehicle: true,
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
    console.error("Get rental booking detail error:", error);
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

    const booking = await prisma.rentalBooking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.customerId !== customer.id) {
      return res.status(403).json({ error: "You do not have access to this booking" });
    }

    if (!["requested", "accepted", "vehicle_assigned"].includes(booking.status)) {
      return res.status(400).json({ 
        error: `Cannot cancel booking with status: ${booking.status}`,
        errorBn: "এই বুকিং বাতিল করা যাবে না"
      });
    }

    const startDate = new Date(booking.startDate);
    const now = new Date();
    const hoursUntilStart = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    let refundPercent = 0;
    if (booking.status === "requested") {
      refundPercent = 100;
    } else if (hoursUntilStart >= 48) {
      refundPercent = 100;
    } else if (hoursUntilStart >= 24) {
      refundPercent = 75;
    } else if (hoursUntilStart >= 12) {
      refundPercent = 50;
    } else {
      refundPercent = 25;
    }

    const refundAmount = (Number(booking.subtotal) * refundPercent) / 100;

    const statusHistory = booking.statusHistory ? JSON.parse(booking.statusHistory as string) : [];
    statusHistory.push({ 
      status: "cancelled_by_customer", 
      timestamp: new Date().toISOString(), 
      actor: "customer",
      reason,
    });

    await prisma.$transaction(async (tx) => {
      await tx.rentalBooking.update({
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

      if (booking.status === "vehicle_assigned") {
        await tx.rentalVehicle.update({
          where: { id: booking.vehicleId },
          data: { isAvailable: true },
        });
      }
    });

    res.json({
      success: true,
      message: "বুকিং বাতিল হয়েছে",
      refundInfo: {
        refundPercent,
        refundAmount,
        depositRefund: booking.status !== "in_use" ? booking.securityDeposit : 0,
        refundStatus: refundAmount > 0 ? "pending" : "no_refund",
      },
    });
  } catch (error) {
    console.error("Cancel rental booking error:", error);
    res.status(500).json({ error: "Failed to cancel booking" });
  }
});

// ===================================================
// VOUCHER/TICKET GENERATION & VERIFICATION
// ===================================================

import { ticketGenerationService } from "../services/ticketGenerationService";

router.get("/my-bookings/:bookingId/voucher", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { bookingId } = req.params;
    const { format = "html" } = req.query;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const customer = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const booking = await prisma.rentalBooking.findUnique({
      where: { id: bookingId },
      include: {
        vehicle: {
          include: {
            operator: { select: { operatorName: true } },
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: "বুকিং পাওয়া যায়নি" });
    }

    if (booking.customerId !== customer.id) {
      return res.status(403).json({ error: "এই ভাউচার অ্যাক্সেস করার অনুমতি নেই" });
    }

    if (booking.status === "cancelled" || booking.status === "cancelled_by_customer") {
      return res.status(400).json({ error: "বাতিলকৃত বুকিংয়ের জন্য ভাউচার তৈরি করা সম্ভব নয়" });
    }

    const ticket = await ticketGenerationService.generateTicketForBooking(bookingId, "rental");

    if (!ticket) {
      return res.status(500).json({ error: "ভাউচার তৈরি করতে সমস্যা হয়েছে" });
    }

    if (format === "json") {
      return res.json({
        ticketId: ticket.ticketId,
        qrCodeImage: ticket.qrCodeImage,
        verificationUrl: ticket.verificationUrl,
        bookingCode: booking.bookingCode,
        booking: {
          id: booking.id,
          customerName: booking.customerName,
          vehicleName: booking.vehicle?.vehicleName,
          operatorName: booking.vehicle?.operator?.operatorName,
          startDate: booking.startDate,
          endDate: booking.endDate,
          pickupLocation: booking.pickupLocation,
          totalPrice: Number(booking.totalPrice),
          status: booking.status,
        },
      });
    }

    res.setHeader("Content-Type", "text/html");
    res.send(ticket.ticketHtml);
  } catch (error) {
    console.error("Get voucher error:", error);
    res.status(500).json({ error: "ভাউচার লোড করতে সমস্যা হয়েছে" });
  }
});

router.get("/verify/:bookingId", async (req, res: Response) => {
  try {
    const { bookingId } = req.params;

    const result = await ticketGenerationService.verifyTicket(bookingId, "rental");

    if (!result.valid) {
      return res.status(400).json({
        valid: false,
        error: result.error,
        booking: result.booking,
      });
    }

    res.json({
      valid: true,
      message: "ভাউচার বৈধ",
      booking: result.booking,
    });
  } catch (error) {
    console.error("Verify rental error:", error);
    res.status(500).json({ error: "যাচাই করতে সমস্যা হয়েছে" });
  }
});

export default router;
