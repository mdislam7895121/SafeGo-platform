import { PrismaClient, RestaurantSupportCategory, RestaurantSupportPriority, RestaurantSupportStatus } from "@prisma/client";

const prisma = new PrismaClient();

const VALID_CATEGORIES: RestaurantSupportCategory[] = ["orders", "payouts", "menu_pricing", "account_kyc", "technical", "other"];
const VALID_PRIORITIES: RestaurantSupportPriority[] = ["low", "normal", "high", "urgent"];

export class RestaurantSupportService {
  async listTickets(restaurantId: string) {
    return await prisma.restaurantSupportTicket.findMany({
      where: { restaurantId },
      include: {
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getTicketById(ticketId: string, restaurantId: string) {
    const ticket = await prisma.restaurantSupportTicket.findUnique({
      where: { id: ticketId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    if (ticket.restaurantId !== restaurantId) {
      throw new Error("Access denied: You can only view your own tickets");
    }

    return ticket;
  }

  async createTicket(data: {
    restaurantId: string;
    subject: string;
    category: string;
    priority: string;
    description: string;
    channel: string;
    attachmentUrls?: string[];
  }) {
    if (!VALID_CATEGORIES.includes(data.category as RestaurantSupportCategory)) {
      throw new Error("Invalid category");
    }

    if (!VALID_PRIORITIES.includes(data.priority as RestaurantSupportPriority)) {
      throw new Error("Invalid priority");
    }

    return await prisma.$transaction(async (tx) => {
      const uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const timestamp = Date.now().toString(36).toUpperCase();
      const ticketCode = `RST-${new Date().getFullYear()}-${timestamp}${uniqueId}`;

      const ticket = await tx.restaurantSupportTicket.create({
        data: {
          ticketCode,
          restaurantId: data.restaurantId,
          subject: data.subject,
          category: data.category as RestaurantSupportCategory,
          priority: data.priority as RestaurantSupportPriority,
          description: data.description,
          channel: data.channel,
          attachmentUrls: data.attachmentUrls || null,
        },
      });

      await tx.restaurantSupportMessage.create({
        data: {
          ticketId: ticket.id,
          senderRole: "restaurant",
          senderName: "Restaurant",
          messageBody: data.description,
          attachmentUrls: data.attachmentUrls || null,
        },
      });

      return ticket;
    });
  }

  async addMessage(data: {
    ticketId: string;
    restaurantId: string;
    senderRole: "restaurant" | "support";
    senderName: string;
    messageBody: string;
    attachmentUrls?: string[];
  }) {
    const ticket = await prisma.restaurantSupportTicket.findUnique({
      where: { id: data.ticketId },
    });

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    if (ticket.restaurantId !== data.restaurantId) {
      throw new Error("Access denied: You can only reply to your own tickets");
    }

    return await prisma.$transaction(async (tx) => {
      const message = await tx.restaurantSupportMessage.create({
        data: {
          ticketId: data.ticketId,
          senderRole: data.senderRole,
          senderName: data.senderName,
          messageBody: data.messageBody,
          attachmentUrls: data.attachmentUrls || null,
        },
      });

      await tx.restaurantSupportTicket.update({
        where: { id: data.ticketId },
        data: { updatedAt: new Date() },
      });

      return message;
    });
  }

}

export const restaurantSupportService = new RestaurantSupportService();
