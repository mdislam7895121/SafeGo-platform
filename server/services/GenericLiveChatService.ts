import { prisma } from "../db";

/**
 * Generic Live Chat Service - Domain Config Interface
 */
export interface LiveChatDomainConfig {
  role: "restaurant" | "driver" | "customer" | "admin";
  sessionDelegate: any;
  messageDelegate: any;
  profileIdField: string;
  supportsAgentAssignment?: boolean;
  supportsActiveSessionQuery?: boolean;
}

/**
 * Generic Live Chat Service
 * Handles live chat session management for all user roles
 */
export class GenericLiveChatService {
  constructor(private config: LiveChatDomainConfig) {}

  /**
   * Start a new live chat session
   */
  async startSession(data: {
    profileId: string;
    customerName: string;
    initialMessage?: string;
  }) {
    const session = await this.config.sessionDelegate.create({
      data: {
        [this.config.profileIdField]: data.profileId,
        status: "waiting",
        startedAt: new Date()
      },
      include: { messages: true }
    });

    // Send initial message if provided
    if (data.initialMessage) {
      await this.config.messageDelegate.create({
        data: {
          sessionId: session.id,
          senderRole: this.config.role,
          senderName: data.customerName,
          messageBody: data.initialMessage,
          isTyping: false
        }
      });
    }

    return session;
  }

  /**
   * Get live chat session with access control
   */
  async getSession(sessionId: string, profileId: string) {
    const session = await this.config.sessionDelegate.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!session) {
      throw new Error("Chat session not found");
    }

    // Access control
    if (session[this.config.profileIdField] !== profileId) {
      throw new Error("Access denied: You can only view your own chat sessions");
    }

    return session;
  }

  /**
   * Send a message in live chat
   */
  async sendMessage(data: {
    sessionId: string;
    profileId: string;
    senderRole: string;
    senderName: string;
    messageBody: string;
    attachmentUrls?: string[];
  }) {
    // Verify session ownership
    const session = await this.config.sessionDelegate.findUnique({
      where: { id: data.sessionId },
      select: { id: true, [this.config.profileIdField]: true }
    });

    if (!session) {
      throw new Error("Chat session not found");
    }

    if (session[this.config.profileIdField] !== data.profileId) {
      throw new Error("Access denied: You can only send messages in your own chat sessions");
    }

    // Create message
    const message = await this.config.messageDelegate.create({
      data: {
        sessionId: data.sessionId,
        senderRole: data.senderRole,
        senderName: data.senderName,
        messageBody: data.messageBody,
        attachmentUrls: data.attachmentUrls || undefined,
        isTyping: false
      }
    });

    // Update session timestamp
    await this.config.sessionDelegate.update({
      where: { id: data.sessionId },
      data: { updatedAt: new Date() }
    });

    return message;
  }

  /**
   * End a live chat session
   */
  async endSession(sessionId: string, profileId: string) {
    // Verify session ownership
    const session = await this.config.sessionDelegate.findUnique({
      where: { id: sessionId },
      select: { id: true, [this.config.profileIdField]: true }
    });

    if (!session) {
      throw new Error("Chat session not found");
    }

    if (session[this.config.profileIdField] !== profileId) {
      throw new Error("Access denied: You can only end your own chat sessions");
    }

    // Update session status
    return await this.config.sessionDelegate.update({
      where: { id: sessionId },
      data: {
        status: "closed",
        endedAt: new Date()
      },
      include: { messages: true }
    });
  }

  /**
   * Backwards compatibility: createSession (alias for startSession)
   */
  async createSession(profileId: string) {
    return await this.startSession({
      profileId,
      customerName: "User",
      initialMessage: undefined
    });
  }

  /**
   * Backwards compatibility: getSessionById (alias for getSession)
   */
  async getSessionById(sessionId: string, profileId: string) {
    return await this.getSession(sessionId, profileId);
  }

  /**
   * Get active session (if supported)
   */
  async getActiveSession(profileId: string) {
    if (!this.config.supportsActiveSessionQuery) {
      return null;
    }

    return await this.config.sessionDelegate.findFirst({
      where: {
        [this.config.profileIdField]: profileId,
        status: { in: ["waiting", "active"] }
      },
      include: {
        messages: {
          where: { isTyping: false },
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: { startedAt: "desc" }
    });
  }

  /**
   * Assign agent to session (if supported)
   */
  async assignAgent(sessionId: string, agentId: string, agentName: string) {
    if (!this.config.supportsAgentAssignment) {
      throw new Error("Agent assignment not supported for this role");
    }

    return await this.config.sessionDelegate.update({
      where: { id: sessionId },
      data: {
        agentId,
        agentName,
        status: "active"
      }
    });
  }
}

/**
 * Role-Specific Live Chat Service Adapters
 */

// Restaurant Live Chat
export const restaurantLiveChatService = new GenericLiveChatService({
  role: "restaurant",
  sessionDelegate: prisma.liveChatSession,
  messageDelegate: prisma.liveChatMessage,
  profileIdField: "restaurantId",
  supportsAgentAssignment: true,
  supportsActiveSessionQuery: true
});

// Driver Live Chat
export const driverLiveChatService = new GenericLiveChatService({
  role: "driver",
  sessionDelegate: prisma.driverLiveChatSession,
  messageDelegate: prisma.driverLiveChatMessage,
  profileIdField: "driverId"
});

// Customer Live Chat
export const customerLiveChatService = new GenericLiveChatService({
  role: "customer",
  sessionDelegate: prisma.customerLiveChatSession,
  messageDelegate: prisma.customerLiveChatMessage,
  profileIdField: "customerId"
});

// Admin Live Chat
export const adminLiveChatService = new GenericLiveChatService({
  role: "admin",
  sessionDelegate: prisma.adminLiveChatSession,
  messageDelegate: prisma.adminLiveChatMessage,
  profileIdField: "adminId"
});
