import { prisma } from "../db";
import type { Prisma } from "@prisma/client";

/**
 * Generic Support Service - Domain Config Interface
 * Provides role-specific configuration for support ticket operations
 */
export interface SupportDomainConfig<TTicket, TMessage> {
  role: "restaurant" | "driver" | "customer" | "admin";
  
  // Prisma delegates for ticket and message operations
  ticketDelegate: any;
  messageDelegate: any;
  
  // Field names for foreign keys (e.g., "restaurantId", "driverId")
  profileIdField: string;
  
  // Ticket code prefix (e.g., "RST", "DST", "CST", "AST")
  ticketCodePrefix: string;
  
  // Audit metadata builders
  getAuditMetadata: (profileId: string, displayName: string, ticketId?: string, ticketCode?: string) => any;
}

/**
 * Generic Support Service
 * Handles ticket creation, retrieval, and messaging for all user roles
 */
export class GenericSupportService<TTicket = any, TMessage = any> {
  constructor(private config: SupportDomainConfig<TTicket, TMessage>) {}

  /**
   * Generate unique ticket code with role-specific prefix
   * Role-scoped to prevent cross-role ticket code conflicts
   */
  private async generateTicketCode(): Promise<string> {
    const year = new Date().getFullYear();
    
    // Filter tickets by role-specific prefix to ensure isolation
    const lastTicket = await this.config.ticketDelegate.findFirst({
      where: {
        ticketCode: {
          startsWith: this.config.ticketCodePrefix
        }
      },
      orderBy: { createdAt: "desc" },
      select: { ticketCode: true }
    });

    let nextNumber = 1;
    if (lastTicket?.ticketCode) {
      const match = lastTicket.ticketCode.match(/-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${this.config.ticketCodePrefix}-${year}-${String(nextNumber).padStart(6, "0")}`;
  }

  /**
   * List all tickets for a profile
   */
  async listTickets(profileId: string): Promise<TTicket[]> {
    const tickets = await this.config.ticketDelegate.findMany({
      where: { [this.config.profileIdField]: profileId },
      include: { messages: true },
      orderBy: { createdAt: "desc" }
    });

    return tickets;
  }

  /**
   * Get specific ticket by ID with access control
   */
  async getTicketById(ticketId: string, profileId: string): Promise<TTicket> {
    const ticket = await this.config.ticketDelegate.findUnique({
      where: { id: ticketId },
      include: { messages: { orderBy: { createdAt: "asc" } } }
    });

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    // Access control: Verify ownership
    if (ticket[this.config.profileIdField] !== profileId) {
      throw new Error("Access denied: You can only view your own tickets");
    }

    return ticket;
  }

  /**
   * Create a new support ticket
   */
  async createTicket(data: {
    profileId: string;
    subject: string;
    category: string;
    priority: string;
    description: string;
    channel?: string;
    attachmentUrls?: any;
  }): Promise<TTicket> {
    const ticketCode = await this.generateTicketCode();

    const ticket = await this.config.ticketDelegate.create({
      data: {
        ticketCode,
        [this.config.profileIdField]: data.profileId,
        subject: data.subject,
        category: data.category,
        priority: data.priority,
        status: "open",
        description: data.description,
        channel: data.channel || "web",
        attachmentUrls: data.attachmentUrls || null
      },
      include: { messages: true }
    });

    return ticket;
  }

  /**
   * Add a message to an existing ticket
   */
  async addMessage(data: {
    ticketId: string;
    profileId: string;
    senderRole: string;
    senderName: string;
    messageBody: string;
    attachmentUrls?: any;
  }): Promise<TMessage> {
    // Verify ticket ownership
    const ticket = await this.config.ticketDelegate.findUnique({
      where: { id: data.ticketId },
      select: { id: true, [this.config.profileIdField]: true }
    });

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    if (ticket[this.config.profileIdField] !== data.profileId) {
      throw new Error("Access denied: You can only add messages to your own tickets");
    }

    // Create message
    const message = await this.config.messageDelegate.create({
      data: {
        ticketId: data.ticketId,
        senderRole: data.senderRole,
        senderName: data.senderName,
        messageBody: data.messageBody,
        attachmentUrls: data.attachmentUrls || null
      }
    });

    // Update ticket timestamp
    await this.config.ticketDelegate.update({
      where: { id: data.ticketId },
      data: { updatedAt: new Date() }
    });

    return message;
  }
}

/**
 * Role-Specific Service Adapters
 */

// Restaurant Support Adapter
export const restaurantSupportService = new GenericSupportService({
  role: "restaurant",
  ticketDelegate: prisma.restaurantSupportTicket,
  messageDelegate: prisma.restaurantSupportMessage,
  profileIdField: "restaurantId",
  ticketCodePrefix: "RST",
  getAuditMetadata: (profileId, displayName, ticketId?, ticketCode?) => ({
    restaurantProfileId: profileId,
    restaurantName: displayName,
    ticketId,
    ticketCode
  })
});

// Driver Support Adapter
export const driverSupportService = new GenericSupportService({
  role: "driver",
  ticketDelegate: prisma.driverSupportTicket,
  messageDelegate: prisma.driverSupportMessage,
  profileIdField: "driverId",
  ticketCodePrefix: "DST",
  getAuditMetadata: (profileId, displayName, ticketId?, ticketCode?) => ({
    driverProfileId: profileId,
    driverName: displayName,
    ticketId,
    ticketCode
  })
});

// Customer Support Adapter
export const customerSupportService = new GenericSupportService({
  role: "customer",
  ticketDelegate: prisma.customerSupportTicket,
  messageDelegate: prisma.customerSupportMessage,
  profileIdField: "customerId",
  ticketCodePrefix: "CST",
  getAuditMetadata: (profileId, displayName, ticketId?, ticketCode?) => ({
    customerProfileId: profileId,
    customerName: displayName,
    ticketId,
    ticketCode
  })
});

// Admin Support Adapter
export const adminSupportService = new GenericSupportService({
  role: "admin",
  ticketDelegate: prisma.adminSupportTicket,
  messageDelegate: prisma.adminSupportMessage,
  profileIdField: "adminId",
  ticketCodePrefix: "AST",
  getAuditMetadata: (profileId, displayName, ticketId?, ticketCode?) => ({
    adminProfileId: profileId,
    adminName: displayName,
    ticketId,
    ticketCode
  })
});
