import { PrismaClient } from "@prisma/client";
import { BotService } from "./botService";

const prisma = new PrismaClient();

interface EscalationResult {
  escalated: boolean;
  reason: "manual" | "auto_unresolved" | "keywords";
  message: string;
}

/**
 * EscalationService handles escalation from bot to human agent
 */
export class EscalationService {
  // Maximum unresolved attempts before auto-escalation
  private static MAX_UNRESOLVED_COUNT = 3;

  /**
   * Check if conversation should be escalated automatically
   */
  static async checkAutoEscalation(
    conversationId: string
  ): Promise<EscalationResult | null> {
    const conversation = await prisma.supportConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return null;
    }

    // Already escalated
    if (conversation.isEscalated) {
      return null;
    }

    // Check unresolved count
    if (conversation.unresolvedCount >= this.MAX_UNRESOLVED_COUNT) {
      return {
        escalated: true,
        reason: "auto_unresolved",
        message: `After ${this.MAX_UNRESOLVED_COUNT} attempts, I'm connecting you to a human support specialist who can better assist you.`,
      };
    }

    return null;
  }

  /**
   * Check if user message triggers manual escalation
   */
  static checkManualEscalation(userMessage: string): EscalationResult | null {
    if (BotService.detectEscalationIntent(userMessage)) {
      return {
        escalated: true,
        reason: "keywords",
        message:
          "I understand you'd like to speak with a human agent. Connecting you to a SafeGo support specialist now...",
      };
    }

    return null;
  }

  /**
   * Perform escalation - update conversation and send system message
   */
  static async escalateConversation(
    conversationId: string,
    reason: "manual" | "auto_unresolved" | "keywords" | "user_request"
  ): Promise<boolean> {
    try {
      // Update conversation
      await prisma.supportConversation.update({
        where: { id: conversationId },
        data: {
          isEscalated: true,
          escalatedAt: new Date(),
          status: "pending", // Waiting for admin to pick up
        },
      });

      // Add system message
      let systemMessage = "";
      switch (reason) {
        case "manual":
        case "keywords":
        case "user_request":
          systemMessage =
            "🔔 You're now connected to a SafeGo support specialist. A human agent will respond shortly.";
          break;
        case "auto_unresolved":
          systemMessage =
            "🔔 I've connected you to a human support specialist who can better assist with your issue.";
          break;
      }

      await prisma.supportMessage.create({
        data: {
          conversationId,
          senderType: "system",
          body: systemMessage,
        },
      });

      return true;
    } catch (error) {
      console.error("Error escalating conversation:", error);
      return false;
    }
  }

  /**
   * Increment unresolved count when bot fails to help
   */
  static async incrementUnresolvedCount(
    conversationId: string
  ): Promise<number> {
    const updated = await prisma.supportConversation.update({
      where: { id: conversationId },
      data: {
        unresolvedCount: {
          increment: 1,
        },
      },
    });

    return updated.unresolvedCount;
  }

  /**
   * Reset unresolved count when bot successfully helps
   */
  static async resetUnresolvedCount(conversationId: string): Promise<void> {
    await prisma.supportConversation.update({
      where: { id: conversationId },
      data: {
        unresolvedCount: 0,
      },
    });
  }

  /**
   * Check if conversation is escalated
   */
  static async isEscalated(conversationId: string): Promise<boolean> {
    const conversation = await prisma.supportConversation.findUnique({
      where: { id: conversationId },
      select: { isEscalated: true },
    });

    return conversation?.isEscalated || false;
  }
}
