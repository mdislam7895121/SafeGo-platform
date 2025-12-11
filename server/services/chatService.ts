/**
 * SafeGo Phase 1B: Chat Service
 * In-trip text messaging for rides, food orders, and parcel deliveries
 */

import { prisma } from '../db';
import { getDispatchFeatureConfig, isChatEnabledForService } from '../config/dispatchFeatures';
import { DeliveryServiceType } from '@prisma/client';

export type SenderRole = 'customer' | 'driver' | 'restaurant' | 'admin';
export type ServiceType = 'ride' | 'food' | 'parcel';

export interface Message {
  id: string;
  conversationId: string;
  senderRole: SenderRole;
  senderId: string;
  text: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  serviceType: ServiceType;
  entityId: string;
  customerId: string;
  driverId?: string;
  restaurantId?: string;
  isActive: boolean;
  createdAt: Date;
  messages?: Message[];
}

export interface SendMessageResult {
  success: boolean;
  message?: Message;
  error?: string;
}

class ChatService {
  async getOrCreateConversation(
    serviceType: ServiceType,
    entityId: string,
    customerId: string,
    driverId?: string,
    restaurantId?: string
  ): Promise<Conversation | null> {
    if (!isChatEnabledForService(serviceType)) {
      return null;
    }

    const prismaServiceType = this.mapServiceType(serviceType);

    const existing = await prisma.tripConversation.findUnique({
      where: {
        serviceType_entityId: {
          serviceType: prismaServiceType,
          entityId,
        },
      },
    });

    if (existing) {
      if (driverId && !existing.driverId) {
        await prisma.tripConversation.update({
          where: { id: existing.id },
          data: { driverId },
        });
      }

      return {
        id: existing.id,
        serviceType,
        entityId: existing.entityId,
        customerId: existing.customerId,
        driverId: existing.driverId || undefined,
        restaurantId: existing.restaurantId || undefined,
        isActive: existing.isActive,
        createdAt: existing.createdAt,
      };
    }

    const conversation = await prisma.tripConversation.create({
      data: {
        serviceType: prismaServiceType,
        entityId,
        customerId,
        driverId,
        restaurantId,
      },
    });

    return {
      id: conversation.id,
      serviceType,
      entityId: conversation.entityId,
      customerId: conversation.customerId,
      driverId: conversation.driverId || undefined,
      restaurantId: conversation.restaurantId || undefined,
      isActive: conversation.isActive,
      createdAt: conversation.createdAt,
    };
  }

  async sendMessage(
    conversationId: string,
    senderRole: SenderRole,
    senderId: string,
    text: string
  ): Promise<SendMessageResult> {
    const config = getDispatchFeatureConfig();

    if (!config.inTripChat.enabled) {
      return { success: false, error: 'Chat is disabled' };
    }

    if (text.length > config.inTripChat.maxMessageLength) {
      return {
        success: false,
        error: `Message exceeds maximum length of ${config.inTripChat.maxMessageLength} characters`,
      };
    }

    const conversation = await prisma.tripConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return { success: false, error: 'Conversation not found' };
    }

    if (!conversation.isActive) {
      return { success: false, error: 'Conversation is closed' };
    }

    const isParticipant = this.isParticipant(conversation, senderRole, senderId);
    if (!isParticipant) {
      return { success: false, error: 'Not a participant of this conversation' };
    }

    const sanitizedText = this.sanitizeMessage(text);

    const message = await prisma.tripMessage.create({
      data: {
        conversationId,
        senderRole,
        senderId,
        text: sanitizedText,
      },
    });

    return {
      success: true,
      message: {
        id: message.id,
        conversationId: message.conversationId,
        senderRole: message.senderRole as SenderRole,
        senderId: message.senderId,
        text: message.text,
        isRead: message.isRead,
        readAt: message.readAt || undefined,
        createdAt: message.createdAt,
      },
    };
  }

  async getMessages(
    conversationId: string,
    requesterId: string,
    requesterRole: SenderRole,
    limit = 50,
    before?: string
  ): Promise<Message[]> {
    const conversation = await prisma.tripConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return [];
    }

    if (!this.isParticipant(conversation, requesterRole, requesterId)) {
      return [];
    }

    const where: { conversationId: string; createdAt?: { lt: Date } } = {
      conversationId,
    };

    if (before) {
      const beforeMessage = await prisma.tripMessage.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      if (beforeMessage) {
        where.createdAt = { lt: beforeMessage.createdAt };
      }
    }

    const messages = await prisma.tripMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.reverse().map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderRole: m.senderRole as SenderRole,
      senderId: m.senderId,
      text: m.text,
      isRead: m.isRead,
      readAt: m.readAt || undefined,
      createdAt: m.createdAt,
    }));
  }

  async markMessagesAsRead(
    conversationId: string,
    readerId: string,
    readerRole: SenderRole
  ): Promise<number> {
    const conversation = await prisma.tripConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return 0;
    }

    if (!this.isParticipant(conversation, readerRole, readerId)) {
      return 0;
    }

    const result = await prisma.tripMessage.updateMany({
      where: {
        conversationId,
        isRead: false,
        senderId: { not: readerId },
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return result.count;
  }

  async getUnreadCount(
    conversationId: string,
    userId: string
  ): Promise<number> {
    return prisma.tripMessage.count({
      where: {
        conversationId,
        isRead: false,
        senderId: { not: userId },
      },
    });
  }

  async closeConversation(conversationId: string): Promise<boolean> {
    try {
      await prisma.tripConversation.update({
        where: { id: conversationId },
        data: {
          isActive: false,
          closedAt: new Date(),
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async getConversationByEntity(
    serviceType: ServiceType,
    entityId: string
  ): Promise<Conversation | null> {
    const prismaServiceType = this.mapServiceType(serviceType);

    const conversation = await prisma.tripConversation.findUnique({
      where: {
        serviceType_entityId: {
          serviceType: prismaServiceType,
          entityId,
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!conversation) {
      return null;
    }

    return {
      id: conversation.id,
      serviceType,
      entityId: conversation.entityId,
      customerId: conversation.customerId,
      driverId: conversation.driverId || undefined,
      restaurantId: conversation.restaurantId || undefined,
      isActive: conversation.isActive,
      createdAt: conversation.createdAt,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderRole: m.senderRole as SenderRole,
        senderId: m.senderId,
        text: m.text,
        isRead: m.isRead,
        readAt: m.readAt || undefined,
        createdAt: m.createdAt,
      })),
    };
  }

  private isParticipant(
    conversation: {
      customerId: string;
      driverId: string | null;
      restaurantId: string | null;
    },
    role: SenderRole,
    id: string
  ): boolean {
    switch (role) {
      case 'customer':
        return conversation.customerId === id;
      case 'driver':
        return conversation.driverId === id;
      case 'restaurant':
        return conversation.restaurantId === id;
      case 'admin':
        return true;
      default:
        return false;
    }
  }

  private sanitizeMessage(text: string): string {
    const nidPatterns = [
      /\b\d{10,17}\b/g,
      /\bSSN[:\s]*\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/gi,
      /\bNID[:\s]*\d+\b/gi,
    ];

    let sanitized = text;
    for (const pattern of nidPatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    return sanitized.trim();
  }

  private mapServiceType(serviceType: ServiceType): DeliveryServiceType {
    switch (serviceType) {
      case 'ride':
        return DeliveryServiceType.ride;
      case 'food':
        return DeliveryServiceType.food;
      case 'parcel':
        return DeliveryServiceType.parcel;
      default:
        return DeliveryServiceType.ride;
    }
  }
}

export const chatService = new ChatService();
