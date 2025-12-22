import { prisma } from "../../lib/prisma";
import { chatCompletion, moderateText } from "./openaiClient";
import { searchKB } from "./kbSearch";
import { Role, Country, ServiceScope, sanitizeSourcesForRole, getCountryRules, getToolPermissions } from "./rbac";

export interface ChatRequest {
  message: string;
  country: Country;
  role: Role;
  service: ServiceScope;
  userId: string;
  conversationId?: string;
}

export interface ChatResponse {
  reply: string;
  conversationId: string;
  sources: Array<{ id: string; title: string }>;
  suggestedActions?: string[];
  moderationFlags?: {
    inputFlagged: boolean;
    outputFlagged: boolean;
  };
}

function buildSystemPrompt(role: Role, country: Country, service: ServiceScope): string {
  const countryRules = getCountryRules(country);
  const permissions = getToolPermissions(role);
  
  const privacyRules = permissions.restrictedFields.length > 0
    ? `You must NEVER reveal or discuss these restricted data types: ${permissions.restrictedFields.join(", ")}.`
    : "You have access to all data types.";

  return `You are SafePilot, the in-app AI assistant for SafeGo - a super-app offering ride-hailing, food delivery, and parcel delivery services.

## Your Role
- You help ${role.toLowerCase()}s with questions about ${service === "ALL" ? "all services" : service.toLowerCase()} in ${country === "GLOBAL" ? "any country" : country}.
- You provide accurate, helpful, and concise answers.
- You are professional, friendly, and supportive.

## Privacy & Security Rules (CRITICAL)
${privacyRules}
- Never expose sensitive documents, NID numbers, government IDs, or personal data of other users.
- If asked for restricted information, politely refuse and suggest contacting SafeGo Support.
- Always verify that requested data belongs to the asking user before discussing it.

## Country-Specific Information for ${country}
- Currency: ${countryRules.currency}
- Available payment methods: ${countryRules.paymentMethods.join(", ")}
- KYC requirements: ${countryRules.kycFields.join(", ")}
- Regulations: ${countryRules.regulations.join("; ")}

## Service Status Flows
### Ride-hailing
requested → searching_driver → accepted → driver_arriving → in_progress → completed OR cancelled

### Food Delivery
placed → accepted → preparing → ready_for_pickup → picked_up → on_the_way → delivered OR cancelled

### Parcel Delivery
requested → searching_driver → accepted → picked_up → on_the_way → delivered OR cancelled

## Guidelines
1. Be concise but complete in your answers.
2. If you don't know something, say so and suggest contacting SafeGo Support.
3. Always prioritize user safety and data privacy.
4. Provide step-by-step guidance when explaining processes.
5. Use simple, everyday language - avoid technical jargon.

## Role-Specific Context
${getRoleSpecificContext(role)}

Answer the user's question based on the provided context and your knowledge of SafeGo operations.`;
}

function getRoleSpecificContext(role: Role): string {
  switch (role) {
    case "CUSTOMER":
      return `You are helping a customer who may want to:
- Book rides, order food, or send parcels
- Track their orders and deliveries
- Manage their payment methods
- Report issues or provide feedback
- Understand pricing and promotions`;
    
    case "DRIVER":
      return `You are helping a driver/delivery partner who may want to:
- Understand their earnings and commissions
- Manage their wallet and payouts
- Complete verification/KYC requirements
- Understand trip/delivery assignments
- Report issues or get support
- Understand negative balance and settlement processes`;
    
    case "RESTAURANT":
      return `You are helping a restaurant partner who may want to:
- Manage their menu and availability
- Track orders and order status
- Understand commissions and payouts
- Handle customer feedback
- Complete verification requirements
- Understand negative balance for COD orders`;
    
    case "ADMIN":
      return `You are helping a SafeGo admin who may need to:
- Verify and approve users, drivers, restaurants
- Manage pricing, fees, and commissions
- Handle complaints and support tickets
- Monitor platform health and metrics
- Manage payouts and settlements
- Access compliance and audit information`;
    
    default:
      return "You are helping a SafeGo user with general inquiries.";
  }
}

export async function safepilotChat(request: ChatRequest): Promise<ChatResponse> {
  const { message, country, role, service, userId, conversationId } = request;

  const inputModeration = await moderateText(message);
  
  if (inputModeration.flagged) {
    await logAuditEvent(userId, role, "ask", {
      message,
      moderationFlagged: true,
      categories: inputModeration.categories,
    });
    
    return {
      reply: "I'm sorry, but I can't respond to that message. Please rephrase your question or contact SafeGo Support for assistance.",
      conversationId: conversationId || "",
      sources: [],
      moderationFlags: {
        inputFlagged: true,
        outputFlagged: false,
      },
    };
  }

  const kbResults = await searchKB({
    query: message,
    country,
    role,
    service,
    limit: 6,
  });

  const context = kbResults.length > 0
    ? kbResults.map((r, i) => `[Source ${i + 1}: ${r.title}]\n${r.chunkText}`).join("\n\n---\n\n")
    : "";

  const systemPrompt = buildSystemPrompt(role, country, service);
  
  const userPrompt = context
    ? `Context from SafeGo knowledge base:\n\n${context}\n\n---\n\nUser question: ${message}`
    : `User question: ${message}`;

  let conversation = conversationId
    ? await prisma.safePilotConversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: "desc" }, take: 10 } },
      })
    : null;

  if (!conversation) {
    conversation = await prisma.safePilotConversation.create({
      data: {
        userId,
        userRole: role,
        country,
      },
      include: { messages: true },
    });
  }

  const conversationHistory = conversation.messages
    .reverse()
    .map((m) => ({
      role: m.direction === "user" ? "user" as const : "assistant" as const,
      content: m.content,
    }));

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...conversationHistory,
    { role: "user" as const, content: userPrompt },
  ];

  const reply = await chatCompletion(messages, { maxTokens: 2048 });

  const outputModeration = await moderateText(reply);
  
  if (outputModeration.flagged) {
    await logAuditEvent(userId, role, "answer", {
      query: message,
      outputModerationFlagged: true,
    });
    
    return {
      reply: "I apologize, but I'm unable to provide a response at this time. Please contact SafeGo Support for assistance.",
      conversationId: conversation.id,
      sources: [],
      moderationFlags: {
        inputFlagged: false,
        outputFlagged: true,
      },
    };
  }

  await prisma.safePilotMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "user",
      content: message,
      moderationFlags: inputModeration,
    },
  });

  const sanitizedSources = sanitizeSourcesForRole(role, kbResults);
  
  await prisma.safePilotMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "assistant",
      content: reply,
      moderationFlags: outputModeration,
      sources: sanitizedSources,
    },
  });

  await prisma.safePilotConversation.update({
    where: { id: conversation.id },
    data: { lastSeenAt: new Date() },
  });

  await logAuditEvent(userId, role, "answer", {
    query: message,
    sourceCount: kbResults.length,
    conversationId: conversation.id,
  });

  const suggestedActions = generateSuggestedActions(message, role, service);

  return {
    reply,
    conversationId: conversation.id,
    sources: sanitizedSources,
    suggestedActions,
    moderationFlags: {
      inputFlagged: inputModeration.flagged,
      outputFlagged: outputModeration.flagged,
    },
  };
}

function generateSuggestedActions(query: string, role: Role, service: ServiceScope): string[] {
  const actions: string[] = [];
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes("verify") || lowerQuery.includes("kyc") || lowerQuery.includes("document")) {
    actions.push("Go to Profile > Verification");
  }
  
  if (lowerQuery.includes("payment") || lowerQuery.includes("wallet") || lowerQuery.includes("balance")) {
    if (role === "DRIVER" || role === "RESTAURANT") {
      actions.push("Check Wallet & Earnings");
    } else {
      actions.push("Manage Payment Methods");
    }
  }
  
  if (lowerQuery.includes("order") || lowerQuery.includes("track")) {
    actions.push("View Order History");
  }
  
  if (lowerQuery.includes("support") || lowerQuery.includes("help") || lowerQuery.includes("contact")) {
    actions.push("Contact SafeGo Support");
  }

  return actions.slice(0, 3);
}

async function logAuditEvent(
  userId: string,
  role: Role,
  action: "ask" | "answer" | "tool_call" | "kb_upload" | "kb_disable" | "kb_reembed" | "kb_update",
  metadata: Record<string, any>
): Promise<void> {
  try {
    await prisma.safePilotAuditLog.create({
      data: {
        actorUserId: userId,
        actorRole: role,
        action,
        metadata,
      },
    });
  } catch (error) {
    console.error("[SafePilot] Audit log error:", error);
  }
}

export async function getConversationHistory(
  userId: string,
  conversationId: string
): Promise<Array<{
  id: string;
  direction: string;
  content: string;
  sources: any;
  createdAt: Date;
}>> {
  const conversation = await prisma.safePilotConversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          direction: true,
          content: true,
          sources: true,
          createdAt: true,
        },
      },
    },
  });

  return conversation?.messages || [];
}

export async function getUserConversations(
  userId: string,
  limit: number = 20
): Promise<Array<{
  id: string;
  country: string;
  lastSeenAt: Date;
  createdAt: Date;
  messageCount: number;
}>> {
  const conversations = await prisma.safePilotConversation.findMany({
    where: { userId },
    orderBy: { lastSeenAt: "desc" },
    take: limit,
    include: {
      _count: {
        select: { messages: true },
      },
    },
  });

  return conversations.map((c) => ({
    id: c.id,
    country: c.country,
    lastSeenAt: c.lastSeenAt,
    createdAt: c.createdAt,
    messageCount: c._count.messages,
  }));
}
