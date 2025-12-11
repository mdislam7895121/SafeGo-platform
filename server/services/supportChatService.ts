import { db } from "../db";
import { logAuditEvent, ActionType, EntityType } from "../utils/audit";

const prisma = db;

// HTML sanitization function
function sanitizeHtml(input: string): string {
  return input
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .trim();
}

// Types
export interface ConversationPayload {
  userId: string;
  userType: "driver" | "customer" | "restaurant";
}

export interface MessagePayload {
  conversationId: string;
  senderType: "user" | "admin";
  body?: string;
  messageType: "text" | "image" | "file";
  attachmentId?: string;
}

// Service Functions
export async function createConversation(payload: ConversationPayload) {
  const { userId, userType } = payload;
  
  const conversation = await prisma.supportConversation.create({
    data: {
      userId,
      userType,
      adminUserId: null,
    },
  });

  await logAuditEvent({
    actorId: userId,
    actorEmail: null,
    actorRole: userType,
    ipAddress: null,
    actionType: ActionType.SUPPORT_CONVERSATION_CREATED,
    entityType: EntityType.SUPPORT_CONVERSATION,
    entityId: conversation.id,
    description: `${userType} ${userId} created support conversation`,
    success: true,
  });

  return conversation;
}

export async function listUserConversations(userId: string, userType: string) {
  return prisma.supportConversation.findMany({
    where: {
      userId,
      userType,
    },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAdminConversations() {
  return prisma.supportConversation.findMany({
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function sendMessage(payload: MessagePayload) {
  const { conversationId, senderType, body, messageType, attachmentId } = payload;

  // Verify conversation exists
  const conversation = await prisma.supportConversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Sanitize message body
  const sanitizedBody = body ? sanitizeHtml(body) : null;

  const message = await prisma.supportMessage.create({
    data: {
      conversationId,
      senderType,
      body: sanitizedBody,
      messageType,
      attachmentId: attachmentId || undefined,
      read: false,
    },
  });

  await logAuditEvent({
    actorId: null,
    actorEmail: null,
    actorRole: senderType,
    ipAddress: null,
    actionType: ActionType.SUPPORT_MESSAGE_SENT,
    entityType: EntityType.SUPPORT_CONVERSATION,
    entityId: conversationId,
    description: `Support message sent in conversation ${conversationId}`,
    success: true,
  });

  return message;
}

export async function uploadAttachment(
  conversationId: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  secureStoragePath: string
) {
  // Verify conversation exists
  const conversation = await prisma.supportConversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const attachment = await prisma.supportAttachment.create({
    data: {
      conversationId,
      fileName,
      fileType,
      fileSize,
      secureStoragePath,
    },
  });

  await logAuditEvent({
    actorId: null,
    actorEmail: null,
    actorRole: "user",
    ipAddress: null,
    actionType: ActionType.SUPPORT_MESSAGE_SENT,
    entityType: EntityType.SUPPORT_CONVERSATION,
    entityId: conversationId,
    description: `Support attachment uploaded: ${fileName}`,
    success: true,
  });

  return attachment;
}

export async function markAsRead(messageId: string) {
  return prisma.supportMessage.update({
    where: { id: messageId },
    data: { read: true },
  });
}

export async function getConversation(id: string) {
  return prisma.supportConversation.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function getConversationMessages(conversationId: string, limit = 50) {
  return prisma.supportMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
