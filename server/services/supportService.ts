import { PrismaClient, SupportConversationStatus, SupportChannel, SupportPriority, SupportSenderType, SupportMessageType } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { logAuditEvent, ActionType, EntityType } from "../utils/audit";

const prisma = db;

export interface RequesterContext {
  userId: string;
  userType: "driver" | "customer" | "restaurant" | "admin";
  permissions?: string[];
}

function hasPermission(context: RequesterContext, permission: string): boolean {
  return context.permissions?.includes(permission) ?? false;
}

function canAccessConversation(context: RequesterContext, conversation: any): boolean {
  if (context.userType === "admin") {
    return true;
  }
  
  return conversation.userId === context.userId && conversation.userType === context.userType;
}

function canSendMessage(context: RequesterContext, conversation: any): boolean {
  if (context.userType !== "admin") {
    return conversation.userId === context.userId && conversation.userType === context.userType;
  }
  
  if (!hasPermission(context, "REPLY_SUPPORT_CONVERSATIONS")) {
    return false;
  }
  
  if (!conversation.assignedAdminId) {
    return true;
  }
  
  return conversation.assignedAdminId === context.userId || hasPermission(context, "MANAGE_SUPPORT_SETTINGS");
}

function canModifyConversation(context: RequesterContext, conversation: any): boolean {
  if (context.userType !== "admin") {
    return false;
  }
  
  const canAssign = hasPermission(context, "ASSIGN_SUPPORT_CONVERSATIONS");
  const canManage = hasPermission(context, "MANAGE_SUPPORT_SETTINGS");
  
  return canAssign || canManage;
}

function canAssignConversation(context: RequesterContext): boolean {
  if (context.userType !== "admin") {
    return false;
  }
  
  const hasReplyPermission = hasPermission(context, "REPLY_SUPPORT_CONVERSATIONS");
  const canManage = hasPermission(context, "MANAGE_SUPPORT_SETTINGS");
  
  return hasReplyPermission && (hasPermission(context, "ASSIGN_SUPPORT_CONVERSATIONS") || canManage);
}

export const createConversationSchema = z.object({
  userId: z.string(),
  userType: z.enum(["driver", "customer", "restaurant"]),
  countryCode: z.enum(["BD", "US"]),
  subject: z.string().min(1).max(200),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  initialMessage: z.string().min(1).max(5000),
  metadata: z.record(z.any()).optional(),
});

export const sendMessageSchema = z.object({
  conversationId: z.string(),
  senderType: z.enum(["user", "admin", "system"]),
  senderId: z.string().optional(),
  content: z.string().min(1).max(5000),
  messageType: z.enum(["text", "system", "attachment"]).optional(),
  metadata: z.record(z.any()).optional(),
});

export const updateConversationSchema = z.object({
  status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignedAdminId: z.string().nullable().optional(),
});

export const listConversationsSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
  userType: z.enum(["driver", "customer", "restaurant"]).optional(),
  countryCode: z.enum(["BD", "US"]).optional(),
  assignedAdminId: z.string().optional(),
  userId: z.string().optional(),
  search: z.string().optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type ListConversationsInput = z.infer<typeof listConversationsSchema>;

function sanitizeMessageContent(content: string): string {
  return content
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .trim();
}

function sanitizeMetadata(metadata: any): any {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  const cleaned = { ...metadata };
  const sensitiveKeys = [
    "password",
    "token",
    "secret",
    "nid",
    "ssn",
    "apiKey",
    "privateKey",
  ];

  for (const key of Object.keys(cleaned)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      delete cleaned[key];
    }
  }

  return cleaned;
}

export async function createConversation(input: CreateConversationInput, requester: RequesterContext) {
  const validated = createConversationSchema.parse(input);

  if (validated.userId !== requester.userId || validated.userType !== requester.userType) {
    throw new Error("Unauthorized: You can only create conversations for yourself");
  }

  const existingOpen = await prisma.supportConversation.findFirst({
    where: {
      userId: validated.userId,
      userType: validated.userType as SupportChannel,
      status: {
        in: ["open", "pending"],
      },
    },
  });

  if (existingOpen) {
    return {
      conversation: existingOpen,
      message: null,
      isExisting: true,
    };
  }

  const sanitizedContent = sanitizeMessageContent(validated.initialMessage);
  const sanitizedMetadata = sanitizeMetadata(validated.metadata);

  const conversation = await prisma.supportConversation.create({
    data: {
      userId: validated.userId,
      userType: validated.userType as SupportChannel,
      channel: validated.userType as SupportChannel,
      countryCode: validated.countryCode,
      subject: validated.subject,
      priority: (validated.priority as SupportPriority) || "normal",
      lastMessageAt: new Date(),
      lastMessagePreview: sanitizedContent.substring(0, 100),
      unreadCountAdmin: 1,
      metadata: sanitizedMetadata,
    },
  });

  const message = await prisma.supportMessage.create({
    data: {
      conversationId: conversation.id,
      senderType: "user",
      senderId: validated.userId,
      content: sanitizedContent,
      messageType: "text",
      isReadByAdmin: false,
      isReadByUser: true,
    },
  });

  await logAuditEvent({
    actorId: validated.userId,
    actorEmail: "user",
    actorRole: validated.userType,
    actionType: ActionType.SUPPORT_CONVERSATION_CREATED,
    entityType: EntityType.SUPPORT_CONVERSATION,
    entityId: conversation.id,
    description: `${validated.userType} created support conversation: ${validated.subject}`,
    metadata: { subject: validated.subject, priority: validated.priority },
    success: true,
  });

  return {
    conversation,
    message,
    isExisting: false,
  };
}

export async function sendMessage(input: SendMessageInput, requester: RequesterContext) {
  const validated = sendMessageSchema.parse(input);

  const conversation = await prisma.supportConversation.findUnique({
    where: { id: validated.conversationId },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (!canSendMessage(requester, conversation)) {
    throw new Error("Unauthorized: You cannot send messages to this conversation");
  }

  if (conversation.status === "closed") {
    throw new Error("Cannot send messages to a closed conversation");
  }

  const sanitizedContent = sanitizeMessageContent(validated.content);
  const sanitizedMetadata = sanitizeMetadata(validated.metadata);

  const isAdminMessage = validated.senderType === "admin";
  const isUserMessage = validated.senderType === "user";

  const message = await prisma.supportMessage.create({
    data: {
      conversationId: validated.conversationId,
      senderType: validated.senderType as SupportSenderType,
      senderId: validated.senderId || null,
      content: sanitizedContent,
      messageType: (validated.messageType as SupportMessageType) || "text",
      isReadByAdmin: isUserMessage ? false : true,
      isReadByUser: isAdminMessage ? false : true,
      metadata: sanitizedMetadata,
    },
  });

  await prisma.supportConversation.update({
    where: { id: validated.conversationId },
    data: {
      lastMessageAt: new Date(),
      lastMessagePreview: sanitizedContent.substring(0, 100),
      unreadCountAdmin: isUserMessage
        ? { increment: 1 }
        : undefined,
      unreadCountUser: isAdminMessage
        ? { increment: 1 }
        : undefined,
    },
  });

  return message;
}

export async function getConversation(conversationId: string, requester: RequesterContext, includeMessages: boolean = false) {
  const conversation = await prisma.supportConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: includeMessages
        ? {
            orderBy: { createdAt: "asc" },
            take: 50,
          }
        : false,
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (!canAccessConversation(requester, conversation)) {
    throw new Error("Unauthorized: You cannot access this conversation");
  }

  return conversation;
}

export async function listConversations(input: ListConversationsInput, requester: RequesterContext) {
  const validated = listConversationsSchema.parse(input);

  const page = validated.page || 1;
  const pageSize = validated.pageSize || 20;
  const skip = (page - 1) * pageSize;

  const where: any = {};

  if (requester.userType !== "admin") {
    where.userId = requester.userId;
    where.userType = requester.userType;
  }

  if (validated.status) {
    where.status = validated.status;
  }

  if (validated.userType) {
    where.userType = validated.userType;
  }

  if (validated.countryCode) {
    where.countryCode = validated.countryCode;
  }

  if (validated.assignedAdminId !== undefined) {
    where.assignedAdminId = validated.assignedAdminId;
  }

  if (validated.userId) {
    where.userId = validated.userId;
  }

  if (validated.search) {
    where.OR = [
      { subject: { contains: validated.search, mode: "insensitive" } },
      { userId: { contains: validated.search, mode: "insensitive" } },
    ];
  }

  const [conversations, total] = await Promise.all([
    prisma.supportConversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.supportConversation.count({ where }),
  ]);

  return {
    conversations,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function updateConversation(conversationId: string, input: UpdateConversationInput, requester: RequesterContext) {
  const validated = updateConversationSchema.parse(input);

  const conversation = await prisma.supportConversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (!canModifyConversation(requester, conversation)) {
    throw new Error("Unauthorized: You cannot modify this conversation");
  }

  const updateData: any = {};

  if (validated.status) {
    updateData.status = validated.status;
    if (validated.status === "closed") {
      updateData.closedAt = new Date();
    }
  }

  if (validated.priority) {
    updateData.priority = validated.priority;
  }

  if (validated.assignedAdminId !== undefined) {
    if (!canAssignConversation(requester)) {
      throw new Error("Unauthorized: You must have REPLY_SUPPORT_CONVERSATIONS permission to assign conversations");
    }
    
    if (validated.assignedAdminId !== null) {
      const targetAdmin = await prisma.adminProfile.findUnique({
        where: { userId: validated.assignedAdminId },
        select: {
          id: true,
          userId: true,
          adminRole: true,
          isActive: true,
        },
      });

      if (!targetAdmin || !targetAdmin.isActive) {
        throw new Error("Target admin not found or inactive");
      }

      // Check if admin has required permission using role permissions
      const { getRolePermissions, Permission } = await import("../utils/permissions");
      const adminPermissions = getRolePermissions(targetAdmin.adminRole);
      const hasReplyPermission = adminPermissions?.has(Permission.REPLY_SUPPORT_CONVERSATIONS) ?? false;
      if (!hasReplyPermission) {
        throw new Error("Cannot assign conversation to admin without REPLY_SUPPORT_CONVERSATIONS permission");
      }
    }
    
    updateData.assignedAdminId = validated.assignedAdminId;
  }

  const updatedConversation = await prisma.supportConversation.update({
    where: { id: conversationId },
    data: updateData,
  });

  return conversation;
}

export async function getConversationMessages(
  conversationId: string,
  page: number = 1,
  pageSize: number = 50
) {
  const skip = (page - 1) * pageSize;

  const [messages, total] = await Promise.all([
    prisma.supportMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      skip,
      take: pageSize,
    }),
    prisma.supportMessage.count({ where: { conversationId } }),
  ]);

  return {
    messages,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function markMessagesAsRead(
  conversationId: string,
  asAdmin: boolean
) {
  if (asAdmin) {
    await prisma.supportMessage.updateMany({
      where: {
        conversationId,
        isReadByAdmin: false,
      },
      data: {
        isReadByAdmin: true,
      },
    });

    await prisma.supportConversation.update({
      where: { id: conversationId },
      data: { unreadCountAdmin: 0 },
    });
  } else {
    await prisma.supportMessage.updateMany({
      where: {
        conversationId,
        isReadByUser: false,
      },
      data: {
        isReadByUser: true,
      },
    });

    await prisma.supportConversation.update({
      where: { id: conversationId },
      data: { unreadCountUser: 0 },
    });
  }
}

export async function getUserSummary(userId: string, userType: SupportChannel) {
  try {
    if (userType === "driver") {
      const driver = await prisma.driverProfile.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              email: true,
              countryCode: true,
            },
          },
        },
      });

      return driver
        ? {
            id: userId,
            name: driver.fullName || "N/A",
            email: driver.user.email,
            phone: driver.phoneNumber || "N/A",
            country: driver.user.countryCode,
          }
        : null;
    }

    if (userType === "customer") {
      const customer = await prisma.customerProfile.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              email: true,
              countryCode: true,
            },
          },
        },
      });

      return customer
        ? {
            id: userId,
            name: customer.fullName || "N/A",
            email: customer.user.email,
            phone: customer.phoneNumber || "N/A",
            country: customer.user.countryCode,
          }
        : null;
    }

    if (userType === "restaurant") {
      const restaurant = await prisma.restaurantProfile.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              email: true,
              countryCode: true,
            },
          },
        },
      });

      return restaurant
        ? {
            id: userId,
            name: restaurant.restaurantName || "N/A",
            email: restaurant.user.email,
            phone: "N/A",
            country: restaurant.user.countryCode,
          }
        : null;
    }

    return null;
  } catch (error) {
    console.error("Error fetching user summary:", error);
    return null;
  }
}
