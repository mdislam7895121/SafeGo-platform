import { prisma } from "../../lib/prisma";
import { chatCompletionWithTools, moderateText, ToolDefinition } from "./openaiClient";
import { searchKBWithMetadata, KBSearchResult } from "./kbSearch";
import { Role, Country, ServiceScope, sanitizeSourcesForRole, getCountryRules, getToolPermissions } from "./rbac";
import { executeTool, ToolName } from "./tools";
import { classifyIntent, getRefusalResponse, getNextActionsForNoKB, IntentRoute } from "./intentRouter";
import { checkRateLimit, incrementRateLimit } from "./rateLimit";
import { z } from "zod";
import { detectEmotion, getEmotionAwareResponseGuidelines, EmotionType } from "./emotionDetection";
import { checkEscalationTriggers, createEscalationTicket, getEscalationConfirmationMessage, getConversationAttemptCount, extractEntityIdsFromConversation, EscalationContext } from "./escalationEngine";

export interface ChatRequest {
  message: string;
  country: Country;
  role: Role;
  service: ServiceScope;
  userId: string;
  conversationId?: string;
  explain?: boolean;
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
  rateLimitInfo?: {
    remaining: number;
    resetAt: Date;
  };
  explanation?: {
    route: IntentRoute;
    kbTitlesUsed: string[];
    toolsExecuted: string[];
    countryRulesApplied: string;
    cacheHit: boolean;
  };
  escalated?: {
    ticketId: string;
    ticketCode: string;
    reason: string;
  };
  emotion?: EmotionType;
}

const TOOL_ARG_SCHEMAS: Record<string, z.ZodSchema> = {
  get_ride_status: z.object({ rideId: z.string().optional() }),
  get_order_status: z.object({ orderId: z.string().optional() }),
  get_delivery_status: z.object({ deliveryId: z.string().optional() }),
  get_verification_status: z.object({}),
  get_wallet_balance: z.object({}),
  get_top_rejection_reasons: z.object({ country: z.string().optional(), days: z.number().optional() }),
  get_high_cancellation_cities: z.object({ country: z.string().optional(), days: z.number().optional(), service: z.string().optional() }),
  get_negative_balance_leaders: z.object({ country: z.string().optional(), role: z.string().optional(), limit: z.number().optional() }),
};

const MAX_TOOL_ITERATIONS = 2;

function getRoleTonePreset(role: Role): string {
  switch (role) {
    case "CUSTOMER":
      return `Tone: Calm, helpful, and reassuring. Use simple everyday language. Provide short, actionable steps. Always express empathy when there are issues. Never use technical jargon.`;
    case "DRIVER":
      return `Tone: Direct and operational. Be compliance-aware and practical. Focus on what they need to do next. Mention earnings, ratings, and performance impacts when relevant. Use clear, no-nonsense language.`;
    case "RESTAURANT":
      return `Tone: Professional and order-focused. Emphasize efficiency and business impact. Discuss commission, payout timing, and operational matters clearly. Be respectful of their time.`;
    case "ADMIN":
      return `Tone: Analytical and metrics-first. Provide data-driven insights. Be comprehensive but organized. Include relevant statistics and trends when available. Support decision-making with facts.`;
    default:
      return `Tone: Helpful and professional.`;
  }
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
        parameters: { type: "object", properties: { rideId: { type: "string", description: "Optional specific ride ID to look up" } } },
      },
    });
  }

  if (permissions.allowedTools.includes("read_order_status")) {
    tools.push({
      type: "function",
      function: {
        name: "get_order_status",
        description: "Get the status of food orders. Returns recent orders with their current status, subtotal, delivery fee, and total amount.",
        parameters: { type: "object", properties: { orderId: { type: "string", description: "Optional specific order ID to look up" } } },
      },
    });
  }

  if (permissions.allowedTools.includes("read_delivery_status")) {
    tools.push({
      type: "function",
      function: {
        name: "get_delivery_status",
        description: "Get the status of parcel deliveries. Returns recent deliveries with their current status and addresses.",
        parameters: { type: "object", properties: { deliveryId: { type: "string", description: "Optional specific delivery ID to look up" } } },
      },
    });
  }

  if (permissions.allowedTools.includes("read_verification_status")) {
    tools.push({
      type: "function",
      function: {
        name: "get_verification_status",
        description: "Get the user's account verification status and any rejection reasons if applicable.",
        parameters: { type: "object", properties: {} },
      },
    });
  }

  if (permissions.allowedTools.includes("read_wallet")) {
    tools.push({
      type: "function",
      function: {
        name: "get_wallet_balance",
        description: "Get the user's wallet balance, including any negative balance and available payment methods.",
        parameters: { type: "object", properties: {} },
      },
    });
  }

  if (role === "ADMIN") {
    tools.push(
      {
        type: "function",
        function: {
          name: "get_top_rejection_reasons",
          description: "Get aggregated top verification rejection reasons for a country over a time period.",
          parameters: {
            type: "object",
            properties: {
              country: { type: "string", description: "Country code (BD, US, or GLOBAL)" },
              days: { type: "number", description: "Number of days to analyze (default 30)" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_high_cancellation_cities",
          description: "Get cities with the highest cancellation rates for rides or food orders.",
          parameters: {
            type: "object",
            properties: {
              country: { type: "string", description: "Country code" },
              days: { type: "number", description: "Number of days to analyze" },
              service: { type: "string", description: "Service type: ride, food, or all" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_negative_balance_leaders",
          description: "Get drivers or restaurants with the highest negative wallet balances.",
          parameters: {
            type: "object",
            properties: {
              country: { type: "string", description: "Country code" },
              role: { type: "string", description: "DRIVER, RESTAURANT, or ALL" },
              limit: { type: "number", description: "Max results to return" },
            },
          },
        },
      }
    );
  }

  return tools;
}

function buildSystemPrompt(
  role: Role,
  country: Country,
  service: ServiceScope,
  kbContext: string,
  kbHasResults: boolean,
  route: IntentRoute,
  emotion?: EmotionType
): string {
  const countryRules = getCountryRules(country);
  const permissions = getToolPermissions(role);
  const tonePreset = getRoleTonePreset(role);
  
  const privacyRules = permissions.restrictedFields.length > 0
    ? `You must NEVER reveal or discuss these restricted data types: ${permissions.restrictedFields.join(", ")}.`
    : "You have access to all data types.";

  let hallucinationPrevention: string;
  if (route === "KB_FIRST" && !kbHasResults) {
    hallucinationPrevention = `CRITICAL: No relevant documents were found in the SafeGo knowledge base. You MUST NOT make up any policies, procedures, or specific information about SafeGo. Instead:
1. Clearly state: "I don't have verified information about that topic."
2. Suggest checking the Help section in the app
3. Recommend contacting SafeGo Support for accurate information
4. DO NOT fabricate answers.`;
  } else if (kbHasResults) {
    hallucinationPrevention = `You have been provided context from the SafeGo knowledge base. Base your answer on this context. If the context doesn't fully answer the question, acknowledge what you know and suggest contacting SafeGo Support for complete information.`;
  } else {
    hallucinationPrevention = `Use the tools provided to get the user's real data. If tools don't return the needed information, be honest about what you couldn't find.`;
  }

  const emotionGuidelines = emotion ? getEmotionAwareResponseGuidelines(emotion) : "";

  const brandRules = `
## Brand & Response Rules
${tonePreset}
- Never promise actions you cannot perform
- Always specify clear next steps
- Never expose restricted fields or other users' data
- If uncertain, recommend contacting SafeGo Support
- NEVER blame the customer for any issue
- NEVER promise refunds, compensation, or policy changes without backend confirmation`;

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
${brandRules}

${emotionGuidelines ? `## ${emotionGuidelines}` : ""}

## Service Status Flows
### Ride-hailing
requested → searching_driver → accepted → driver_arriving → in_progress → completed OR cancelled

### Food Delivery
placed → accepted → preparing → ready_for_pickup → picked_up → on_the_way → delivered OR cancelled

### Parcel Delivery
requested → searching_driver → accepted → picked_up → on_the_way → delivered OR cancelled

${kbContext ? `## Knowledge Base Context\n${kbContext}` : ""}

Answer the user's question based on the provided context, tool results, and your knowledge of SafeGo operations.`;
}

export async function safepilotChat(request: ChatRequest): Promise<ChatResponse> {
  const { message, country, role, service, userId, conversationId, explain = false } = request;

  const rateLimitCheck = await checkRateLimit(userId, role);
  if (!rateLimitCheck.allowed) {
    return {
      reply: "You've reached your message limit for this hour. Please try again later, or contact SafeGo Support if you need immediate assistance.",
      conversationId: conversationId || "",
      sources: [],
      rateLimitInfo: { remaining: 0, resetAt: rateLimitCheck.resetAt },
    };
  }

  const intentResult = classifyIntent(message, role);
  
  if (intentResult.route === "REFUSE") {
    await logAuditEvent(userId, role, "ask", {
      message,
      route: "REFUSE",
      reason: intentResult.reason,
    });
    
    return {
      reply: getRefusalResponse(intentResult.reason),
      conversationId: conversationId || "",
      sources: [],
      suggestedActions: ["Contact SafeGo Support"],
    };
  }

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

  const emotionResult = detectEmotion(message);
  const detectedEmotion = emotionResult.emotion;

  const { results: kbResults, metadata: kbMetadata } = await searchKBWithMetadata({ query: message, country, role, service, limit: 6 });
  const kbHasResults = kbResults.length > 0;

  const kbContext = kbHasResults
    ? kbResults.map((r, i) => `[Source ${i + 1}: ${r.title}]\n${r.chunkText}`).join("\n\n---\n\n")
    : "";

  const tools = buildToolDefinitions(role);
  const systemPrompt = buildSystemPrompt(role, country, service, kbContext, kbHasResults, intentResult.route, detectedEmotion);

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

  const attemptCount = await getConversationAttemptCount(conversation.id);
  const entityIds = await extractEntityIdsFromConversation(conversation.id);

  const escalationContext: EscalationContext = {
    userId,
    conversationId: conversation.id,
    emotion: detectedEmotion,
    attemptCount,
    entityIds,
    conversationHistory: conversation.messages.map(m => ({
      role: m.direction === "user" ? "user" : "assistant",
      content: m.content,
    })),
  };

  const escalationDecision = checkEscalationTriggers(message, escalationContext);

  if (escalationDecision.shouldEscalate && role === "CUSTOMER") {
    const { ticketId, ticketCode } = await createEscalationTicket(escalationContext, escalationDecision);
    const escalationMessage = getEscalationConfirmationMessage(ticketCode);

    await prisma.safePilotMessage.create({
      data: {
        conversationId: conversation.id,
        direction: "user",
        content: message,
        moderationFlags: inputModeration,
      },
    });

    await prisma.safePilotMessage.create({
      data: {
        conversationId: conversation.id,
        direction: "assistant",
        content: escalationMessage,
      },
    });

    await incrementRateLimit(userId, role);

    return {
      reply: escalationMessage,
      conversationId: conversation.id,
      sources: [],
      suggestedActions: ["View Support Tickets"],
      escalated: {
        ticketId,
        ticketCode,
        reason: escalationDecision.reason,
      },
      emotion: detectedEmotion,
    };
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

  while (iterations < MAX_TOOL_ITERATIONS) {
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
          const rawArgs = JSON.parse(toolCall.arguments || "{}");
          
          const schema = TOOL_ARG_SCHEMAS[toolCall.name];
          let validatedArgs = rawArgs;
          if (schema) {
            const parseResult = schema.safeParse(rawArgs);
            if (!parseResult.success) {
              toolResult = JSON.stringify({ error: "Invalid tool arguments", details: parseResult.error.format() });
              messages.push({ role: "tool", content: toolResult, tool_call_id: toolCall.id });
              continue;
            }
            validatedArgs = parseResult.data;
          }
          
          const toolResponse = await executeTool(toolCall.name as ToolName, {
            userId,
            role,
            country,
          }, validatedArgs);

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
            args: validatedArgs,
            success: toolResponse.success,
            source: toolResponse.source,
          });

        } catch (error) {
          console.error(`[SafePilot] Tool ${toolCall.name} error:`, error);
          toolResult = JSON.stringify({ error: "Tool execution failed. Please try again." });
          
          await logAuditEvent(userId, role, "tool_call", {
            tool: toolCall.name,
            error: "execution_failed",
            errorCode: "TOOL_ERROR",
          });
        }

        messages.push({
          role: "tool",
          content: toolResult,
          tool_call_id: toolCall.id,
        });
      }
    } else {
      finalReply = result.content || "";
      break;
    }
  }

  if (!finalReply && iterations >= MAX_TOOL_ITERATIONS) {
    finalReply = "I apologize, but I couldn't complete your request in the allowed number of steps. Please try rephrasing your question or contact SafeGo Support for assistance.";
  }

  if (!finalReply) {
    if (intentResult.route === "KB_FIRST" && !kbHasResults) {
      const nextActions = getNextActionsForNoKB();
      finalReply = `I don't have enough verified information to answer that question. Here's what you can do:\n\n${nextActions.map((a, i) => `${i + 1}. ${a}`).join("\n")}`;
    } else {
      finalReply = "I apologize, but I couldn't generate a response. Please contact SafeGo Support.";
    }
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

  const rateResult = await incrementRateLimit(userId, role);

  await logAuditEvent(userId, role, "answer", {
    query: message,
    route: intentResult.route,
    sourceCount: kbResults.length,
    toolsUsed,
    conversationId: conversation.id,
    cache: { hit: kbMetadata.cacheHit, kind: kbMetadata.cacheKind },
    emotion: detectedEmotion,
    emotionSignals: emotionResult.signals,
  });

  const suggestedActions = generateSuggestedActions(message, role, intentResult.route);

  const response: ChatResponse = {
    reply: finalReply,
    conversationId: conversation.id,
    sources: sanitizedSources,
    suggestedActions,
    toolsUsed,
    moderationFlags: {
      inputFlagged: inputModeration.flagged,
      outputFlagged: outputModeration.flagged,
    },
    rateLimitInfo: {
      remaining: rateResult.remaining,
      resetAt: rateResult.resetAt,
    },
    emotion: detectedEmotion,
  };

  if (explain || role === "ADMIN") {
    response.explanation = {
      route: intentResult.route,
      kbTitlesUsed: kbResults.map(r => r.title),
      toolsExecuted: toolsUsed,
      countryRulesApplied: country,
      cacheHit: kbMetadata.cacheHit,
    };
  }

  return response;
}

function generateSuggestedActions(query: string, role: Role, route: IntentRoute): string[] {
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

  if (route === "KB_FIRST" && actions.length === 0) {
    actions.push("Check Help Center for guides");
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
