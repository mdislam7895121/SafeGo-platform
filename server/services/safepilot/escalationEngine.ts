import { prisma } from "../../lib/prisma";
import { EmotionType } from "./emotionDetection";

export interface EscalationContext {
  userId: string;
  conversationId: string;
  emotion: EmotionType;
  attemptCount: number;
  issueCategory?: string;
  entityIds?: {
    rideId?: string;
    orderId?: string;
    deliveryId?: string;
  };
  toolResults?: Record<string, any>;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface EscalationDecision {
  shouldEscalate: boolean;
  reason: string;
  priority: "low" | "normal" | "high" | "urgent";
}

const ESCALATION_KEYWORDS = [
  "talk to human", "speak to human", "real person", "human agent",
  "customer service", "customer support", "speak to someone",
  "talk to someone", "agent", "representative", "supervisor",
  "manager", "escalate", "speak to a person"
];

const PAYMENT_KEYWORDS = [
  "refund", "charge", "payment", "overcharged", "double charged",
  "money back", "charged twice", "wrong amount", "dispute", "chargeback"
];

const LEGAL_KEYWORDS = [
  "lawyer", "attorney", "legal", "sue", "lawsuit", "court",
  "police", "authorities", "report to", "file complaint"
];

export function checkEscalationTriggers(
  message: string,
  context: EscalationContext
): EscalationDecision {
  const lowerMessage = message.toLowerCase();

  for (const keyword of ESCALATION_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      return {
        shouldEscalate: true,
        reason: "explicit_request",
        priority: "normal",
      };
    }
  }

  for (const keyword of PAYMENT_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      return {
        shouldEscalate: true,
        reason: "payment_dispute",
        priority: "high",
      };
    }
  }

  for (const keyword of LEGAL_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      return {
        shouldEscalate: true,
        reason: "legal_concern",
        priority: "urgent",
      };
    }
  }

  if (context.attemptCount >= 2) {
    return {
      shouldEscalate: true,
      reason: "unresolved_after_attempts",
      priority: "high",
    };
  }

  if (context.emotion === "ANGRY" && context.attemptCount >= 1) {
    return {
      shouldEscalate: true,
      reason: "angry_customer_unresolved",
      priority: "high",
    };
  }

  return {
    shouldEscalate: false,
    reason: "no_escalation_needed",
    priority: "low",
  };
}

export async function createEscalationTicket(
  context: EscalationContext,
  decision: EscalationDecision
): Promise<{ ticketId: string; ticketCode: string }> {
  const ticketCode = `ESC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const conversationSummary = context.conversationHistory
    ?.slice(-10)
    .map((m, i) => `[${m.role}]: ${m.content.substring(0, 500)}`)
    .join("\n---\n") || "No conversation history available";

  const entityInfo: string[] = [];
  if (context.entityIds?.rideId) entityInfo.push(`Ride ID: ${context.entityIds.rideId}`);
  if (context.entityIds?.orderId) entityInfo.push(`Order ID: ${context.entityIds.orderId}`);
  if (context.entityIds?.deliveryId) entityInfo.push(`Delivery ID: ${context.entityIds.deliveryId}`);

  const description = `
## SafePilot Escalation

**Reason:** ${decision.reason.replace(/_/g, " ")}
**Customer Emotion:** ${context.emotion}
**AI Attempts:** ${context.attemptCount}
**Priority:** ${decision.priority.toUpperCase()}

${entityInfo.length > 0 ? `### Related Entities\n${entityInfo.join("\n")}` : ""}

### Conversation History
${conversationSummary}

${context.toolResults ? `### Tool Results\n\`\`\`json\n${JSON.stringify(context.toolResults, null, 2)}\n\`\`\`` : ""}
  `.trim();

  const ticket = await prisma.customerSupportTicket.create({
    data: {
      ticketCode,
      customerId: context.userId,
      subject: `SafePilot Escalation: ${formatEscalationReason(decision.reason)}`,
      category: mapReasonToCategory(decision.reason),
      priority: decision.priority,
      status: "open",
      description,
      channel: "safepilot",
    },
  });

  await prisma.safePilotAuditLog.create({
    data: {
      actorUserId: context.userId,
      actorRole: "CUSTOMER",
      action: "ask",
      metadata: {
        type: "escalation",
        ticketId: ticket.id,
        ticketCode,
        reason: decision.reason,
        emotion: context.emotion,
        attemptCount: context.attemptCount,
        conversationId: context.conversationId,
      },
    },
  });

  return { ticketId: ticket.id, ticketCode };
}

function formatEscalationReason(reason: string): string {
  const reasonMap: Record<string, string> = {
    explicit_request: "Customer Requested Human Agent",
    payment_dispute: "Payment/Refund Issue",
    legal_concern: "Legal/Policy Concern",
    unresolved_after_attempts: "Issue Unresolved After Multiple Attempts",
    angry_customer_unresolved: "Frustrated Customer - Issue Unresolved",
  };
  return reasonMap[reason] || "Support Needed";
}

function mapReasonToCategory(reason: string): "orders" | "payouts" | "menu_pricing" | "account_kyc" | "technical_issue" | "other" {
  switch (reason) {
    case "payment_dispute":
      return "payouts";
    case "legal_concern":
      return "other";
    case "unresolved_after_attempts":
    case "angry_customer_unresolved":
      return "technical_issue";
    default:
      return "other";
  }
}

export function getEscalationConfirmationMessage(ticketCode: string): string {
  return `I've connected you with our support team. Your reference number is **${ticketCode}**.

A support specialist has been assigned and will review your conversation - you won't need to repeat anything. They'll reach out to you shortly.

Is there anything else I can help with in the meantime?`;
}

export async function getConversationAttemptCount(
  conversationId: string,
  issueCategory?: string
): Promise<number> {
  try {
    const messages = await prisma.safePilotMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const userMessages = messages.filter(m => m.direction === "user");
    
    let attemptCount = 0;
    const recentIssues = new Set<string>();
    
    for (const msg of userMessages) {
      const content = msg.content.toLowerCase();
      const hasComplaint = content.includes("still") || 
                          content.includes("again") || 
                          content.includes("same") ||
                          content.includes("not working") ||
                          content.includes("didn't work");
      
      if (hasComplaint) {
        attemptCount++;
      }
    }

    return attemptCount;
  } catch (error) {
    console.error("[SafePilot] Failed to get attempt count:", error);
    return 0;
  }
}

export async function extractEntityIdsFromConversation(
  conversationId: string
): Promise<{ rideId?: string; orderId?: string; deliveryId?: string }> {
  try {
    const messages = await prisma.safePilotMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const allContent = messages.map(m => m.content).join(" ");
    
    const rideIdMatch = allContent.match(/ride[_\s-]?id[:\s]*([a-f0-9-]{36})/i) ||
                        allContent.match(/RD-\d{8}-[A-Z0-9]+/i);
    const orderIdMatch = allContent.match(/order[_\s-]?id[:\s]*([a-f0-9-]{36})/i) ||
                         allContent.match(/FO-\d{8}-[A-Z0-9]+/i);
    const deliveryIdMatch = allContent.match(/delivery[_\s-]?id[:\s]*([a-f0-9-]{36})/i) ||
                            allContent.match(/DL-\d{8}-[A-Z0-9]+/i);

    return {
      rideId: rideIdMatch?.[1] || rideIdMatch?.[0],
      orderId: orderIdMatch?.[1] || orderIdMatch?.[0],
      deliveryId: deliveryIdMatch?.[1] || deliveryIdMatch?.[0],
    };
  } catch (error) {
    console.error("[SafePilot] Failed to extract entity IDs:", error);
    return {};
  }
}
