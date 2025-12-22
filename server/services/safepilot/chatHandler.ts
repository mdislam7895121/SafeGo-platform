import { prisma } from "../../lib/prisma";
import { chatCompletionWithTools, moderateText, ToolDefinition } from "./openaiClient";
import { searchKB } from "./kbSearch";
import { Role, Country, ServiceScope, sanitizeSourcesForRole, getCountryRules, getToolPermissions } from "./rbac";
import { executeTool, ToolName } from "./tools";

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
  toolsUsed?: string[];
  moderationFlags?: {
    inputFlagged: boolean;
    outputFlagged: boolean;
  };
}

function buildToolDefinitions(role: Role): ToolDefinition[] {
  const permissions = getToolPermissions(role);
  const tools: ToolDefinition[] = [];

  if (permissions.allowedTools.includes("read_ride_status")) {
    tools.push({
      type: "function",
      function: {
        name: "get_ride_status",
        description: "Get the status of the user's ride bookings. Returns recent rides with their current status, pickup/dropoff addresses, and fares.",
        parameters: {
          type: "object",
          properties: {
            rideId: { type: "string", description: "Optional specific ride ID to look up" },
          },
        },
      },
    });
  }

  if (permissions.allowedTools.includes("read_order_status")) {
    tools.push({
      type: "function",
      function: {
        name: "get_order_status",
        description: "Get the status of food orders. Returns recent orders with their current status, subtotal, delivery fee, and total amount.",
        parameters: {
          type: "object",
          properties: {
            orderId: { type: "string", description: "Optional specific order ID to look up" },
          },
        },
      },
    });
  }

  if (permissions.allowedTools.includes("read_delivery_status")) {
    tools.push({
      type: "function",
      function: {
        name: "get_delivery_status",
        description: "Get the status of parcel deliveries. Returns recent deliveries with their current status and addresses.",
        parameters: {
          type: "object",
          properties: {
            deliveryId: { type: "string", description: "Optional specific delivery ID to look up" },
          },
        },
      },
    });
  }

  if (permissions.allowedTools.includes("read_verification_status")) {
    tools.push({
      type: "function",
      function: {
        name: "get_verification_status",
        description: "Get the user's account verification status and any rejection reasons if applicable.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    });
  }

  if (permissions.allowedTools.includes("read_wallet")) {
    tools.push({
      type: "function",
      function: {
        name: "get_wallet_balance",
        description: "Get the user's wallet balance, including any negative balance and available payment methods.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    });
  }

  return tools;
}

function buildSystemPrompt(role: Role, country: Country, service: ServiceScope, kbContext: string, kbHasResults: boolean): string {
  const countryRules = getCountryRules(country);
  const permissions = getToolPermissions(role);
  
  const privacyRules = permissions.restrictedFields.length > 0
    ? `You must NEVER reveal or discuss these restricted data types: ${permissions.restrictedFields.join(", ")}.`
    : "You have access to all data types.";

  const hallucinationPrevention = kbHasResults
    ? `You have been provided context from the SafeGo knowledge base. Base your answer on this context. If the context doesn't fully answer the question, say so and suggest contacting SafeGo Support.`
    : `No relevant documents were found in the SafeGo knowledge base for this query. If you don't have specific information about SafeGo policies or procedures, clearly state that you don't have that information and recommend the user contact SafeGo Support. DO NOT make up policies or procedures.`;

  return `You are SafePilot, the in-app AI assistant for SafeGo - a super-app offering ride-hailing, food delivery, and parcel delivery services.

## Your Role
- You help ${role.toLowerCase()}s with questions about ${service === "ALL" ? "all services" : service.toLowerCase()} in ${country === "GLOBAL" ? "any country" : country}.
- You provide accurate, helpful, and concise answers.

## CRITICAL: Hallucination Prevention
${hallucinationPrevention}

## Privacy & Security Rules (CRITICAL)
${privacyRules}
- Never expose sensitive documents, NID numbers, government IDs, or personal data of other users.
- If asked for restricted information, politely refuse and suggest contacting SafeGo Support.

## Country-Specific Information for ${country}
- Currency: ${countryRules.currency}
- Available payment methods: ${countryRules.paymentMethods.join(", ")}
- KYC requirements: ${countryRules.kycFields.join(", ")}

## Service Status Flows
### Ride-hailing
requested → searching_driver → accepted → driver_arriving → in_progress → completed OR cancelled

### Food Delivery
placed → accepted → preparing → ready_for_pickup → picked_up → on_the_way → delivered OR cancelled

### Parcel Delivery
requested → searching_driver → accepted → picked_up → on_the_way → delivered OR cancelled

## Tool Usage
You have access to tools to look up the user's real data. Use these tools to provide accurate, personalized information rather than generic responses. When a user asks about their rides, orders, deliveries, verification status, or wallet balance, USE THE APPROPRIATE TOOL to get their actual data.

## Guidelines
1. Be concise but complete in your answers.
2. If you don't know something, say so and suggest contacting SafeGo Support.
3. Always prioritize user safety and data privacy.
4. Use simple, everyday language.

${kbContext ? `## Knowledge Base Context\n${kbContext}` : ""}

Answer the user's question based on the provided context, tool results, and your knowledge of SafeGo operations.`;
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
      moderationFlags: { inputFlagged: true, outputFlagged: false },
    };
  }

  const kbResults = await searchKB({ query: message, country, role, service, limit: 6 });
  const kbHasResults = kbResults.length > 0;

  const kbContext = kbHasResults
    ? kbResults.map((r, i) => `[Source ${i + 1}: ${r.title}]\n${r.chunkText}`).join("\n\n---\n\n")
    : "";

  const tools = buildToolDefinitions(role);
  const systemPrompt = buildSystemPrompt(role, country, service, kbContext, kbHasResults);

  let conversation = conversationId
    ? await prisma.safePilotConversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: "desc" }, take: 10 } },
      })
    : null;

  if (!conversation) {
    conversation = await prisma.safePilotConversation.create({
      data: { userId, userRole: role, country },
      include: { messages: true },
    });
  }

  const conversationHistory = conversation.messages
    .reverse()
    .map((m) => ({
      role: m.direction === "user" ? "user" as const : "assistant" as const,
      content: m.content,
    }));

  type MessageType = {
    role: "system" | "user" | "assistant" | "tool";
    content: string | null;
    tool_call_id?: string;
    tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  };

  const messages: MessageType[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: message },
  ];

  const toolsUsed: string[] = [];
  let finalReply = "";
  let iterations = 0;
  const maxIterations = 3;

  while (iterations < maxIterations) {
    iterations++;

    const result = await chatCompletionWithTools(messages, tools, { maxTokens: 2048 });

    if (result.finishReason === "tool_calls" && result.toolCalls.length > 0) {
      const assistantMessage: MessageType = {
        role: "assistant",
        content: null,
        tool_calls: result.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
      messages.push(assistantMessage);

      for (const toolCall of result.toolCalls) {
        let toolResult: string;
        
        try {
          const args = JSON.parse(toolCall.arguments || "{}");
          
          const toolResponse = await executeTool(toolCall.name as ToolName, {
            userId,
            role,
            country,
          }, args);

          if (!toolResponse.success) {
            toolResult = JSON.stringify({
              error: toolResponse.error,
              rbac_denied: toolResponse.source === "rbac_check",
            });
          } else {
            toolResult = JSON.stringify(toolResponse.data);
          }

          toolsUsed.push(toolCall.name);

          await logAuditEvent(userId, role, "tool_call", {
            tool: toolCall.name,
            args,
            success: toolResponse.success,
            source: toolResponse.source,
          });

        } catch (error) {
          toolResult = JSON.stringify({ error: "Tool execution failed" });
        }

        messages.push({
          role: "tool",
          content: toolResult,
          tool_call_id: toolCall.id,
        });
      }
    } else {
      finalReply = result.content || "I apologize, but I couldn't generate a response. Please contact SafeGo Support.";
      break;
    }
  }

  if (!finalReply) {
    finalReply = "I apologize, but I couldn't complete your request. Please contact SafeGo Support for assistance.";
  }

  const outputModeration = await moderateText(finalReply);
  
  if (outputModeration.flagged) {
    await logAuditEvent(userId, role, "answer", {
      query: message,
      outputModerationFlagged: true,
      toolsUsed,
    });
    
    return {
      reply: "I apologize, but I'm unable to provide a response at this time. Please contact SafeGo Support for assistance.",
      conversationId: conversation.id,
      sources: [],
      toolsUsed,
      moderationFlags: { inputFlagged: false, outputFlagged: true },
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
      content: finalReply,
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
    toolsUsed,
    conversationId: conversation.id,
  });

  const suggestedActions = generateSuggestedActions(message, role);

  return {
    reply: finalReply,
    conversationId: conversation.id,
    sources: sanitizedSources,
    suggestedActions,
    toolsUsed,
    moderationFlags: {
      inputFlagged: inputModeration.flagged,
      outputFlagged: outputModeration.flagged,
    },
  };
}

function generateSuggestedActions(query: string, role: Role): string[] {
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
    where: { id: conversationId, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, direction: true, content: true, sources: true, createdAt: true },
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
    include: { _count: { select: { messages: true } } },
  });

  return conversations.map((c) => ({
    id: c.id,
    country: c.country,
    lastSeenAt: c.lastSeenAt,
    createdAt: c.createdAt,
    messageCount: c._count.messages,
  }));
}
