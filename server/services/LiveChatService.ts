import { PrismaClient, LiveChatStatus } from "@prisma/client";

const prisma = new PrismaClient();

export class LiveChatService {
  async createSession(restaurantId: string) {
    return await prisma.liveChatSession.create({
      data: {
        restaurantId,
        status: "waiting",
      },
    });
  }

  async getActiveSession(restaurantId: string) {
    return await prisma.liveChatSession.findFirst({
      where: {
        restaurantId,
        status: { in: ["waiting", "active"] },
      },
      include: {
        messages: {
          where: { isTyping: false },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { startedAt: "desc" },
    });
  }

  async getSessionById(sessionId: string, restaurantId: string) {
    const session = await prisma.liveChatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          where: { isTyping: false },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      throw new Error("Session not found");
    }

    if (session.restaurantId !== restaurantId) {
      throw new Error("Access denied: You can only view your own chat sessions");
    }

    return session;
  }

  async sendMessage(data: {
    sessionId: string;
    restaurantId: string;
    senderRole: "restaurant" | "agent";
    senderName: string;
    messageBody: string;
    attachmentUrls?: string[];
  }) {
    const session = await prisma.liveChatSession.findUnique({
      where: { id: data.sessionId },
    });

    if (!session) {
      throw new Error("Session not found");
    }

    if (session.restaurantId !== data.restaurantId) {
      throw new Error("Access denied: You can only send messages in your own chat sessions");
    }

    return await prisma.$transaction(async (tx) => {
      const message = await tx.liveChatMessage.create({
        data: {
          sessionId: data.sessionId,
          senderRole: data.senderRole,
          senderName: data.senderName,
          messageBody: data.messageBody,
          attachmentUrls: data.attachmentUrls ? data.attachmentUrls : undefined,
          isTyping: false,
        },
      });

      await tx.liveChatSession.update({
        where: { id: data.sessionId },
        data: { updatedAt: new Date() },
      });

      return message;
    });
  }

  async assignAgent(sessionId: string, agentId: string, agentName: string) {
    return await prisma.liveChatSession.update({
      where: { id: sessionId },
      data: {
        agentId,
        agentName,
        status: "active",
      },
    });
  }

  async endSession(sessionId: string, restaurantId: string) {
    const session = await prisma.liveChatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error("Session not found");
    }

    if (session.restaurantId !== restaurantId) {
      throw new Error("Access denied: You can only end your own chat sessions");
    }

    return await prisma.liveChatSession.update({
      where: { id: sessionId },
      data: {
        status: "ended",
        endedAt: new Date(),
      },
    });
  }

  async updateTypingStatus(sessionId: string, senderRole: string, senderName: string, isTyping: boolean) {
    if (isTyping) {
      return await prisma.liveChatMessage.create({
        data: {
          sessionId,
          senderRole,
          senderName,
          messageBody: "",
          isTyping: true,
        },
      });
    } else {
      await prisma.liveChatMessage.deleteMany({
        where: {
          sessionId,
          senderRole,
          isTyping: true,
        },
      });
      return null;
    }
  }

  async getRecentMessages(sessionId: string, restaurantId: string, limit = 50) {
    const session = await prisma.liveChatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error("Session not found");
    }

    if (session.restaurantId !== restaurantId) {
      throw new Error("Access denied");
    }

    return await prisma.liveChatMessage.findMany({
      where: {
        sessionId,
        isTyping: false,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}

export const liveChatService = new LiveChatService();
