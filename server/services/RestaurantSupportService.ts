import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
    const ticketCount = await prisma.restaurantSupportTicket.count();
    const ticketCode = `RST-${new Date().getFullYear()}-${String(ticketCount + 1).padStart(6, "0")}`;

    const ticket = await prisma.restaurantSupportTicket.create({
      data: {
        ticketCode,
        restaurantId: data.restaurantId,
        subject: data.subject,
        category: data.category as any,
        priority: data.priority as any,
        description: data.description,
        channel: data.channel,
        attachmentUrls: data.attachmentUrls || null,
      },
    });

    await prisma.restaurantSupportMessage.create({
      data: {
        ticketId: ticket.id,
        senderRole: "restaurant",
        senderName: "Restaurant",
        messageBody: data.description,
        attachmentUrls: data.attachmentUrls || null,
      },
    });

    return ticket;
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

    const message = await prisma.restaurantSupportMessage.create({
      data: {
        ticketId: data.ticketId,
        senderRole: data.senderRole,
        senderName: data.senderName,
        messageBody: data.messageBody,
        attachmentUrls: data.attachmentUrls || null,
      },
    });

    await prisma.restaurantSupportTicket.update({
      where: { id: data.ticketId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async updateTicketStatus(ticketId: string, restaurantId: string, status: string) {
    const ticket = await prisma.restaurantSupportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    if (ticket.restaurantId !== restaurantId) {
      throw new Error("Access denied: You can only update your own tickets");
    }

    const resolvedAt = status === "resolved" || status === "closed" ? new Date() : null;

    return await prisma.restaurantSupportTicket.update({
      where: { id: ticketId },
      data: {
        status: status as any,
        resolvedAt,
        updatedAt: new Date(),
      },
    });
  }
}

export const restaurantSupportService = new RestaurantSupportService();
