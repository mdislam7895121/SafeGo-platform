import { db } from "../db";
import { getBotResponse, createBotMessage, createSystemMessage } from "./supportBotService";
import { logAuditEvent, ActionType } from "../utils/audit";

const prisma = db;

export async function startOrGetChat(userId: string, userType: string, userName?: string) {
  const existingConversation = await prisma.supportConversation.findFirst({
    where: {
      userId,
      userType,
      status: {
        in: ["open", "bot", "pending", "assigned"],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (existingConversation) {
    const messages = await prisma.supportMessage.findMany({
      where: { conversationId: existingConversation.id },
      orderBy: { createdAt: "asc" },
    });

    return {
      conversation: existingConversation,
      messages,
      isNew: false,
    };
  }

  const newConversation = await prisma.supportConversation.create({
    data: {
      userId,
      userType,
      status: "open",
    },
  });

  await createSystemMessage(
    newConversation.id,
    "You're now connected to SafeGo Support."
  );

  const greeting = userName
    ? `Hi ${userName}, I'm SafeGo Assistant. How can I help you today?`
    : "Hi! I'm SafeGo Assistant. How can I help you today?";

  await createBotMessage(newConversation.id, greeting);

  await logAuditEvent({
    actionType: ActionType.CREATE,
    entityType: "SUPPORT_CHAT" as any,
    entityId: newConversation.id,
    actorId: userId,
    actorEmail: "",
    actorRole: userType,
    description: `Support conversation created for ${userType}`,
    metadata: {
      userType,
      status: "open",
    },
  });

  const messages = await prisma.supportMessage.findMany({
    where: { conversationId: newConversation.id },
    orderBy: { createdAt: "asc" },
  });

  return {
    conversation: newConversation,
    messages,
    isNew: true,
  };
}

export async function getMessages(
  conversationId: string,
  userId: string,
  since?: Date
) {
  const conversation = await prisma.supportConversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found or access denied");
  }

  const messages = await prisma.supportMessage.findMany({
    where: {
      conversationId,
      ...(since ? { createdAt: { gt: since } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  return messages;
}

export async function sendMessage(
  conversationId: string,
  userId: string,
  content: string,
  userName?: string
) {
  const conversation = await prisma.supportConversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found or access denied");
  }

  if (conversation.status === "closed") {
    throw new Error("Cannot send messages to closed conversations");
  }

  const userMessage = await prisma.supportMessage.create({
    data: {
      conversationId,
      senderType: "user",
      messageType: "text",
      body: content,
      read: false,
    },
  });

  if (conversation.status === "open" || conversation.status === "bot") {
    const botResponse = getBotResponse(content, userName);

    await createBotMessage(conversationId, botResponse.message);

    await prisma.supportConversation.update({
      where: { id: conversationId },
      data: { status: "bot", updatedAt: new Date() },
    });
  }

  const allMessages = await prisma.supportMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  return {
    userMessage,
    conversation,
    allMessages,
  };
}

export async function escalateToHuman(
  conversationId: string,
  userId: string
) {
  const conversation = await prisma.supportConversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found or access denied");
  }

  if (conversation.status === "assigned" || conversation.status === "pending") {
    return {
      conversation,
      message: "Your conversation is already with a support agent",
    };
  }

  const updatedConversation = await prisma.supportConversation.update({
    where: { id: conversationId },
    data: {
      status: "pending",
      escalatedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await createSystemMessage(
    conversationId,
    "Your conversation has been forwarded to a SafeGo support agent. They will respond shortly."
  );

  await logAuditEvent({
    actionType: ActionType.UPDATE,
    entityType: "SUPPORT_CHAT" as any,
    entityId: conversationId,
    actorId: userId,
    actorEmail: "",
    actorRole: conversation.userType,
    description: `Support conversation escalated to human agent`,
    metadata: {
      action: "escalated_to_human",
      previousStatus: conversation.status,
      newStatus: "pending",
    },
  });

  return {
    conversation: updatedConversation,
    message: "Escalated to human support successfully",
  };
}

export async function getAdminConversations(
  status?: string,
  limit: number = 50
) {
  const where = status
    ? { status: status as any }
    : {
        status: {
          in: ["pending", "assigned", "open", "bot"],
        },
      };

  const conversations = await prisma.supportConversation.findMany({
    where,
    orderBy: [
      { status: "asc" },
      { updatedAt: "desc" },
    ],
    take: limit,
  });

  const conversationsWithDetails = await Promise.all(
    conversations.map(async (conv: any) => {
      const lastMessage = await prisma.supportMessage.findFirst({
        where: { conversationId: conv.id },
        orderBy: { createdAt: "desc" },
      });

      const messageCount = await prisma.supportMessage.count({
        where: { conversationId: conv.id },
      });

      return {
        ...conv,
        lastMessage: lastMessage?.body?.substring(0, 100),
        messageCount,
      };
    })
  );

  return conversationsWithDetails;
}

export async function getAdminMessages(conversationId: string) {
  const messages = await prisma.supportMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  return messages;
}

export async function sendAdminReply(
  conversationId: string,
  adminUserId: string,
  content: string
) {
  const conversation = await prisma.supportConversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const adminMessage = await prisma.supportMessage.create({
    data: {
      conversationId,
      senderType: "admin",
      messageType: "text",
      body: content,
      read: false,
    },
  });

  const updatedConversation = await prisma.supportConversation.update({
    where: { id: conversationId },
    data: {
      status: "assigned",
      assignedAdminId: conversation.assignedAdminId || adminUserId,
      updatedAt: new Date(),
    },
  });

  await logAuditEvent({
    actionType: ActionType.UPDATE,
    entityType: "SUPPORT_CHAT" as any,
    entityId: conversationId,
    actorId: adminUserId,
    actorEmail: "",
    actorRole: "admin",
    description: `Admin replied to support conversation`,
    metadata: {
      action: "admin_reply",
      assignedAdminId: conversation.assignedAdminId || adminUserId,
    },
  });

  return {
    message: adminMessage,
    conversation: updatedConversation,
  };
}

export async function closeConversation(
  conversationId: string,
  adminUserId: string
) {
  const updatedConversation = await prisma.supportConversation.update({
    where: { id: conversationId },
    data: {
      status: "closed",
      updatedAt: new Date(),
    },
  });

  await createSystemMessage(
    conversationId,
    "This conversation has been closed by support. Start a new chat if you need further assistance."
  );

  await logAuditEvent({
    actionType: ActionType.UPDATE,
    entityType: "SUPPORT_CHAT" as any,
    entityId: conversationId,
    actorId: adminUserId,
    actorEmail: "",
    actorRole: "admin",
    description: `Support conversation closed by admin`,
    metadata: {
      action: "conversation_closed",
    },
  });

  return updatedConversation;
}
