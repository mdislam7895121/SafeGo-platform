import QRCode from "qrcode";
import { randomUUID } from "crypto";
import { prisma } from "../db";

export interface TicketData {
  bookingId: string;
  bookingType: "ticket" | "rental";
  passengerName: string;
  passengerPhone: string;
  routeOrVehicle: string;
  operatorName: string;
  departureTime?: string;
  arrivalTime?: string;
  startDate?: string;
  endDate?: string;
  seats?: number;
  totalFare: number;
  currency: string;
  bookingCode: string;
  travelDate?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
}

export interface GeneratedTicket {
  ticketId: string;
  qrCodeData: string;
  qrCodeImage: string;
  ticketHtml: string;
  verificationUrl: string;
  createdAt: Date;
}

export class TicketGenerationService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.BASE_URL || "https://safego.replit.app";
  }

  async generateBookingCode(): Promise<string> {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "SG-";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async generateTicketQR(ticketData: TicketData): Promise<GeneratedTicket> {
    const ticketId = randomUUID();
    const verificationUrl = `${this.baseUrl}/verify/${ticketData.bookingType}/${ticketData.bookingId}`;
    
    const qrPayload = {
      id: ticketId,
      bookingId: ticketData.bookingId,
      type: ticketData.bookingType,
      code: ticketData.bookingCode,
      passenger: ticketData.passengerName,
      route: ticketData.routeOrVehicle,
      date: ticketData.travelDate || ticketData.startDate,
      fare: ticketData.totalFare,
      url: verificationUrl,
      timestamp: Date.now(),
    };

    const qrCodeData = JSON.stringify(qrPayload);
    
    const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
      width: 200,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "H",
    });

    const ticketHtml = this.generateTicketHtml(ticketData, qrCodeImage, ticketId);

    return {
      ticketId,
      qrCodeData,
      qrCodeImage,
      ticketHtml,
      verificationUrl,
      createdAt: new Date(),
    };
  }

  private generateTicketHtml(
    data: TicketData,
    qrCodeImage: string,
    ticketId: string
  ): string {
    const isTicketBooking = data.bookingType === "ticket";

    return `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SafeGo ${isTicketBooking ? "টিকেট" : "রেন্টাল"} - ${data.bookingCode}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      background: #f0f0f0;
      padding: 20px;
    }
    .ticket-container {
      max-width: 400px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #10B981 0%, #059669 100%);
      color: white;
      padding: 20px;
      text-align: center;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .booking-code {
      font-size: 18px;
      background: rgba(255,255,255,0.2);
      padding: 8px 16px;
      border-radius: 8px;
      display: inline-block;
      margin-top: 10px;
    }
    .content {
      padding: 20px;
    }
    .section {
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px dashed #e0e0e0;
    }
    .section:last-child {
      border-bottom: none;
      margin-bottom: 0;
    }
    .label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }
    .value {
      font-size: 16px;
      color: #333;
      font-weight: 500;
    }
    .route {
      font-size: 20px;
      font-weight: bold;
      color: #10B981;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .col {
      flex: 1;
    }
    .fare {
      font-size: 28px;
      font-weight: bold;
      color: #10B981;
      text-align: center;
      padding: 15px;
      background: #f0fdf4;
      border-radius: 12px;
    }
    .qr-section {
      text-align: center;
      padding: 20px;
      background: #f9fafb;
    }
    .qr-code {
      margin: 10px auto;
    }
    .qr-instruction {
      font-size: 12px;
      color: #666;
      margin-top: 10px;
    }
    .footer {
      background: #1f2937;
      color: white;
      padding: 15px;
      text-align: center;
      font-size: 12px;
    }
    .ticket-id {
      font-family: monospace;
      font-size: 10px;
      color: #999;
      margin-top: 5px;
    }
    .status-badge {
      display: inline-block;
      background: #10B981;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    @media print {
      body { background: white; padding: 0; }
      .ticket-container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="ticket-container">
    <div class="header">
      <div class="logo">🚌 SafeGo</div>
      <div>${isTicketBooking ? "বাস টিকেট" : "গাড়ি রেন্টাল"}</div>
      <div class="booking-code">${data.bookingCode}</div>
    </div>
    
    <div class="content">
      <div class="section">
        <div class="label">যাত্রী / গ্রাহক</div>
        <div class="value">${data.passengerName}</div>
        <div style="font-size: 14px; color: #666; margin-top: 5px;">${data.passengerPhone}</div>
      </div>

      <div class="section">
        <div class="label">${isTicketBooking ? "রুট" : "গাড়ি"}</div>
        <div class="route">${data.routeOrVehicle}</div>
        <div style="font-size: 14px; color: #666; margin-top: 5px;">অপারেটর: ${data.operatorName}</div>
      </div>

      ${isTicketBooking ? `
      <div class="section">
        <div class="row">
          <div class="col">
            <div class="label">যাত্রার তারিখ</div>
            <div class="value">${data.travelDate || "N/A"}</div>
          </div>
          <div class="col">
            <div class="label">সিট সংখ্যা</div>
            <div class="value">${data.seats || 1}</div>
          </div>
        </div>
        ${data.departureTime ? `
        <div class="row">
          <div class="col">
            <div class="label">ছাড়ার সময়</div>
            <div class="value">${data.departureTime}</div>
          </div>
          ${data.arrivalTime ? `
          <div class="col">
            <div class="label">পৌঁছানোর সময়</div>
            <div class="value">${data.arrivalTime}</div>
          </div>
          ` : ""}
        </div>
        ` : ""}
      </div>
      ` : `
      <div class="section">
        <div class="row">
          <div class="col">
            <div class="label">শুরুর তারিখ</div>
            <div class="value">${data.startDate || "N/A"}</div>
          </div>
          <div class="col">
            <div class="label">শেষ তারিখ</div>
            <div class="value">${data.endDate || "N/A"}</div>
          </div>
        </div>
        ${data.pickupLocation ? `
        <div>
          <div class="label">পিকআপ</div>
          <div class="value">${data.pickupLocation}</div>
        </div>
        ` : ""}
      </div>
      `}

      <div class="section">
        <div class="label">মোট ভাড়া</div>
        <div class="fare">${data.currency} ${data.totalFare.toFixed(2)}</div>
      </div>

      <div class="section" style="text-align: center;">
        <span class="status-badge">✓ নিশ্চিত</span>
      </div>
    </div>

    <div class="qr-section">
      <div class="label">ভেরিফিকেশন QR কোড</div>
      <img src="${qrCodeImage}" alt="QR Code" class="qr-code" />
      <div class="qr-instruction">এই QR কোড স্ক্যান করে টিকেট যাচাই করুন</div>
      <div class="ticket-id">Ticket ID: ${ticketId}</div>
    </div>

    <div class="footer">
      <div>SafeGo Bangladesh</div>
      <div>সাহায্যের জন্য: 09612-SAFEGO</div>
      <div style="margin-top: 5px;">www.safego.com.bd</div>
    </div>
  </div>
</body>
</html>
    `;
  }

  async verifyTicket(
    bookingId: string,
    bookingType: "ticket" | "rental"
  ): Promise<{
    valid: boolean;
    booking?: any;
    error?: string;
  }> {
    try {
      if (bookingType === "ticket") {
        const booking = await prisma.ticketBooking.findUnique({
          where: { id: bookingId },
          include: {
            listing: {
              include: {
                operator: { select: { operatorName: true } },
              },
            },
          },
        });

        if (!booking) {
          return { valid: false, error: "বুকিং পাওয়া যায়নি" };
        }

        if (booking.status === "cancelled") {
          return { valid: false, error: "এই বুকিং বাতিল করা হয়েছে", booking };
        }

        return {
          valid: true,
          booking: {
            id: booking.id,
            bookingCode: booking.bookingCode,
            passengerName: booking.passengerName,
            routeName: booking.listing?.routeName,
            operatorName: booking.listing?.operator?.operatorName,
            travelDate: booking.travelDate,
            seats: booking.seats,
            totalFare: Number(booking.totalFare),
            status: booking.status,
          },
        };
      } else {
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
          return { valid: false, error: "বুকিং পাওয়া যায়নি" };
        }

        if (booking.status === "cancelled") {
          return { valid: false, error: "এই বুকিং বাতিল করা হয়েছে", booking };
        }

        return {
          valid: true,
          booking: {
            id: booking.id,
            bookingCode: booking.bookingCode,
            customerName: booking.customerName,
            vehicleName: booking.vehicle?.vehicleName,
            operatorName: booking.vehicle?.operator?.operatorName,
            startDate: booking.startDate,
            endDate: booking.endDate,
            totalPrice: Number(booking.totalPrice),
            status: booking.status,
          },
        };
      }
    } catch (error) {
      console.error("Verify ticket error:", error);
      return { valid: false, error: "যাচাই করতে সমস্যা হয়েছে" };
    }
  }

  async generateTicketForBooking(
    bookingId: string,
    bookingType: "ticket" | "rental"
  ): Promise<GeneratedTicket | null> {
    try {
      if (bookingType === "ticket") {
        const booking = await prisma.ticketBooking.findUnique({
          where: { id: bookingId },
          include: {
            listing: {
              include: {
                operator: { select: { operatorName: true } },
              },
            },
          },
        });

        if (!booking) return null;

        const ticketData: TicketData = {
          bookingId: booking.id,
          bookingType: "ticket",
          passengerName: booking.passengerName,
          passengerPhone: booking.passengerPhone,
          routeOrVehicle: booking.listing?.routeName || "Unknown Route",
          operatorName: booking.listing?.operator?.operatorName || "Unknown",
          departureTime: booking.listing?.departureTime || undefined,
          arrivalTime: booking.listing?.arrivalTime || undefined,
          seats: booking.seats,
          totalFare: Number(booking.totalFare),
          currency: "৳",
          bookingCode: booking.bookingCode || await this.generateBookingCode(),
          travelDate: booking.travelDate?.toISOString().split("T")[0],
        };

        return await this.generateTicketQR(ticketData);
      } else {
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

        if (!booking) return null;

        const ticketData: TicketData = {
          bookingId: booking.id,
          bookingType: "rental",
          passengerName: booking.customerName,
          passengerPhone: booking.customerPhone,
          routeOrVehicle: booking.vehicle?.vehicleName || "Unknown Vehicle",
          operatorName: booking.vehicle?.operator?.operatorName || "Unknown",
          startDate: booking.startDate?.toISOString().split("T")[0],
          endDate: booking.endDate?.toISOString().split("T")[0],
          totalFare: Number(booking.totalPrice),
          currency: "৳",
          bookingCode: booking.bookingCode || await this.generateBookingCode(),
          pickupLocation: booking.pickupLocation || undefined,
        };

        return await this.generateTicketQR(ticketData);
      }
    } catch (error) {
      console.error("Generate ticket for booking error:", error);
      return null;
    }
  }
}

export const ticketGenerationService = new TicketGenerationService();
