import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  safepilotChat,
  getConversationHistory,
  getUserConversations,
  createDocumentWithEmbeddings,
  reembedDocument,
  updateDocumentStatus,
  listDocuments,
  getDocumentById,
  getAuditLogs,
  getAuditStats,
  logAdminAction,
  canUseAdminKB,
  executeTool,
  generateEmbedding,
  searchKB,
} from "../services/safepilot";
import type { ToolName } from "../services/safepilot";
import { prisma } from "../lib/prisma";

const router = Router();

const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  country: z.enum(["BD", "US", "GLOBAL"]).default("GLOBAL"),
  role: z.enum(["CUSTOMER", "DRIVER", "RESTAURANT", "ADMIN"]),
  service: z.enum(["RIDE", "FOOD", "PARCEL", "ALL"]).default("ALL"),
  conversationId: z.string().uuid().optional(),
});

const kbUploadSchema = z.object({
  title: z.string().min(1).max(500),
  body: z.string().min(1).max(100000),
  tags: z.array(z.string()).default([]),
  countryScope: z.enum(["GLOBAL", "BD", "US"]).default("GLOBAL"),
  roleScope: z.enum(["ALL", "CUSTOMER", "DRIVER", "RESTAURANT", "ADMIN"]).default("ALL"),
  serviceScope: z.enum(["ALL", "RIDE", "FOOD", "PARCEL"]).default("ALL"),
  source: z.enum(["admin_upload", "policy", "faq", "runbook"]).default("admin_upload"),
});

const kbUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  title: z.string().min(1).max(500).optional(),
  body: z.string().min(1).max(100000).optional(),
  tags: z.array(z.string()).optional(),
  countryScope: z.enum(["GLOBAL", "BD", "US"]).optional(),
  roleScope: z.enum(["ALL", "CUSTOMER", "DRIVER", "RESTAURANT", "ADMIN"]).optional(),
  serviceScope: z.enum(["ALL", "RIDE", "FOOD", "PARCEL"]).optional(),
});

const auditFiltersSchema = z.object({
  actorUserId: z.string().uuid().optional(),
  actorRole: z.enum(["CUSTOMER", "DRIVER", "RESTAURANT", "ADMIN"]).optional(),
  action: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

interface AuthRequest extends Request {
  user?: {
    id: string;
    userId?: string;
    role?: string;
    adminRole?: string;
    country?: string;
  };
}

function getUserRole(req: AuthRequest): "CUSTOMER" | "DRIVER" | "RESTAURANT" | "ADMIN" {
  if (req.user?.adminRole) return "ADMIN";
  const role = req.user?.role?.toUpperCase();
  if (role === "DRIVER") return "DRIVER";
  if (role === "RESTAURANT") return "RESTAURANT";
  return "CUSTOMER";
}

function getUserCountry(req: AuthRequest): "BD" | "US" | "GLOBAL" {
  const country = req.user?.country?.toUpperCase();
  if (country === "BD") return "BD";
  if (country === "US") return "US";
  return "GLOBAL";
}

router.post("/chat", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
    }

    const { message, country, role, service, conversationId } = parsed.data;
    
    const effectiveRole = getUserRole(req);
    const effectiveCountry = country !== "GLOBAL" ? country : getUserCountry(req);

    const response = await safepilotChat({
      message,
      country: effectiveCountry,
      role: effectiveRole,
      service,
      userId: req.user.id,
      conversationId,
    });

    res.json(response);
  } catch (error) {
    console.error("[SafePilot] Chat error:", error);
    res.status(500).json({ error: "Failed to process chat request" });
  }
});

router.get("/conversations", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const conversations = await getUserConversations(req.user.id, limit);

    res.json({ conversations });
  } catch (error) {
    console.error("[SafePilot] Get conversations error:", error);
    res.status(500).json({ error: "Failed to get conversations" });
  }
});

router.get("/conversations/:conversationId", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { conversationId } = req.params;
    const messages = await getConversationHistory(req.user.id, conversationId);

    res.json({ messages });
  } catch (error) {
    console.error("[SafePilot] Get conversation error:", error);
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

router.post("/kb/upload", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = getUserRole(req);
    if (!canUseAdminKB(userRole)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const parsed = kbUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
    }

    const { title, body, tags, countryScope, roleScope, serviceScope, source } = parsed.data;

    const documentId = await createDocumentWithEmbeddings({
      title,
      body,
      tags,
      countryScope,
      roleScope,
      serviceScope,
      source,
      createdByAdminId: req.user.id,
    });

    await logAdminAction(req.user.id, "kb_upload", {
      documentId,
      title,
      countryScope,
      roleScope,
      serviceScope,
    });

    res.json({ success: true, documentId });
  } catch (error) {
    console.error("[SafePilot] KB upload error:", error);
    res.status(500).json({ error: "Failed to upload document" });
  }
});

router.post("/kb/reembed", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = getUserRole(req);
    if (!canUseAdminKB(userRole)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { documentId } = req.body;
    if (!documentId) {
      return res.status(400).json({ error: "documentId is required" });
    }

    const success = await reembedDocument(documentId);
    if (!success) {
      return res.status(404).json({ error: "Document not found" });
    }

    await logAdminAction(req.user.id, "kb_reembed", { documentId });

    res.json({ success: true });
  } catch (error) {
    console.error("[SafePilot] KB reembed error:", error);
    res.status(500).json({ error: "Failed to reembed document" });
  }
});

router.patch("/kb/:documentId", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = getUserRole(req);
    if (!canUseAdminKB(userRole)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { documentId } = req.params;
    const parsed = kbUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
    }

    const updates = parsed.data;

    if (updates.isActive !== undefined) {
      const success = await updateDocumentStatus(documentId, updates.isActive);
      if (!success) {
        return res.status(404).json({ error: "Document not found" });
      }
    }

    if (updates.title || updates.body || updates.tags || updates.countryScope || updates.roleScope || updates.serviceScope) {
      await prisma.safePilotKBDocument.update({
        where: { id: documentId },
        data: {
          ...(updates.title && { title: updates.title }),
          ...(updates.body && { body: updates.body }),
          ...(updates.tags && { tags: updates.tags }),
          ...(updates.countryScope && { countryScope: updates.countryScope }),
          ...(updates.roleScope && { roleScope: updates.roleScope }),
          ...(updates.serviceScope && { serviceScope: updates.serviceScope }),
          version: { increment: 1 },
        },
      });

      if (updates.body) {
        await reembedDocument(documentId);
      }
    }

    const action = updates.isActive === false ? "kb_disable" : "kb_update";
    await logAdminAction(req.user.id, action, { documentId, updates });

    res.json({ success: true });
  } catch (error) {
    console.error("[SafePilot] KB update error:", error);
    res.status(500).json({ error: "Failed to update document" });
  }
});

router.get("/kb/list", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = getUserRole(req);
    if (!canUseAdminKB(userRole)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const filters: any = {};
    if (req.query.countryScope) filters.countryScope = req.query.countryScope;
    if (req.query.roleScope) filters.roleScope = req.query.roleScope;
    if (req.query.serviceScope) filters.serviceScope = req.query.serviceScope;
    if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === "true";
    if (req.query.source) filters.source = req.query.source;

    const documents = await listDocuments(filters);

    res.json({ documents });
  } catch (error) {
    console.error("[SafePilot] KB list error:", error);
    res.status(500).json({ error: "Failed to list documents" });
  }
});

router.get("/kb/:documentId", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = getUserRole(req);
    if (!canUseAdminKB(userRole)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { documentId } = req.params;
    const document = await getDocumentById(documentId);

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json({ document });
  } catch (error) {
    console.error("[SafePilot] KB get error:", error);
    res.status(500).json({ error: "Failed to get document" });
  }
});

router.get("/audit", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = getUserRole(req);
    if (!canUseAdminKB(userRole)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const parsed = auditFiltersSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid filters", details: parsed.error.errors });
    }

    const filters = parsed.data;
    const { logs, total } = await getAuditLogs({
      ...filters,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    });

    res.json({ logs, total, limit: filters.limit, offset: filters.offset });
  } catch (error) {
    console.error("[SafePilot] Audit logs error:", error);
    res.status(500).json({ error: "Failed to get audit logs" });
  }
});

router.get("/audit/stats", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = getUserRole(req);
    if (!canUseAdminKB(userRole)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const days = parseInt(req.query.days as string) || 30;
    const stats = await getAuditStats(days);

    res.json({ stats });
  } catch (error) {
    console.error("[SafePilot] Audit stats error:", error);
    res.status(500).json({ error: "Failed to get audit stats" });
  }
});

const toolRequestSchema = z.object({
  tool: z.enum([
    "get_ride_status",
    "get_order_status",
    "get_delivery_status",
    "get_verification_status",
    "get_wallet_balance",
  ]),
  params: z.record(z.string()).optional(),
});

router.post("/tools/execute", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const parsed = toolRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
    }

    const { tool, params } = parsed.data;
    const userRole = getUserRole(req);
    const userCountry = getUserCountry(req);

    const result = await executeTool(tool as ToolName, {
      userId: req.user.id,
      role: userRole,
      country: userCountry,
    }, params);

    await prisma.safePilotAuditLog.create({
      data: {
        actorUserId: req.user.id,
        actorRole: userRole,
        action: "tool_call",
        metadata: {
          tool,
          params,
          success: result.success,
          source: result.source,
        },
      },
    });

    res.json(result);
  } catch (error) {
    console.error("[SafePilot] Tool execution error:", error);
    res.status(500).json({ error: "Failed to execute tool" });
  }
});

router.post("/demo/rag-flow", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = getUserRole(req);
    if (!canUseAdminKB(userRole)) {
      return res.status(403).json({ error: "Admin access required for RAG demo" });
    }

    const { query } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query string is required" });
    }

    const startTime = Date.now();

    const embedding = await generateEmbedding(query);
    const embeddingTime = Date.now() - startTime;

    const searchStart = Date.now();
    const searchResults = await searchKB({
      query,
      country: getUserCountry(req),
      role: userRole,
      service: "ALL",
      limit: 5,
    });
    const searchTime = Date.now() - searchStart;

    res.json({
      step1_query: query,
      step2_embedding: {
        model: "text-embedding-3-large",
        dimensions: embedding.length,
        first10Values: embedding.slice(0, 10),
        timeMs: embeddingTime,
      },
      step3_vectorSearch: {
        resultsFound: searchResults.length,
        timeMs: searchTime,
        results: searchResults.map((r) => ({
          documentId: r.documentId,
          title: r.title,
          similarity: r.similarity.toFixed(4),
          chunkPreview: r.chunkText.substring(0, 200) + (r.chunkText.length > 200 ? "..." : ""),
        })),
      },
      step4_context: searchResults.length > 0
        ? `Context from ${searchResults.length} documents would be passed to GPT for grounded answer.`
        : "No matching documents found - GPT would answer from general knowledge.",
      totalTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error("[SafePilot] RAG demo error:", error);
    res.status(500).json({ error: "Failed to run RAG demo" });
  }
});

router.post("/demo/full-execution", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = getUserRole(req);
    if (!canUseAdminKB(userRole)) {
      return res.status(403).json({ error: "Admin access required for execution demo" });
    }

    const { query, simulateRole, simulateCountry } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query string is required" });
    }

    const testRole = (simulateRole || "DRIVER") as "CUSTOMER" | "DRIVER" | "RESTAURANT" | "ADMIN";
    const testCountry = (simulateCountry || "BD") as "BD" | "US" | "GLOBAL";

    const executionLog: any = {
      step1_input: { query, role: testRole, country: testCountry, userId: req.user.id },
      step2_inputModeration: null,
      step3_kbSearch: null,
      step4_toolDefinitions: null,
      step5_modelCalls: [],
      step6_toolExecutions: [],
      step7_finalResponse: null,
      step8_auditLogs: null,
      hallucinationPrevention: null,
    };

    const { moderateText: moderate, chatCompletionWithTools: chatWithTools } = await import("../services/safepilot/openaiClient");
    const { searchKB: kbSearch } = await import("../services/safepilot/kbSearch");
    const { getToolPermissions, getCountryRules } = await import("../services/safepilot/rbac");
    const { executeTool: execTool } = await import("../services/safepilot/tools");

    const inputMod = await moderate(query);
    executionLog.step2_inputModeration = {
      flagged: inputMod.flagged,
      passed: !inputMod.flagged,
    };

    if (inputMod.flagged) {
      executionLog.hallucinationPrevention = "Input was flagged by moderation - execution stopped.";
      return res.json(executionLog);
    }

    const kbResults = await kbSearch({ query, country: testCountry, role: testRole, service: "ALL", limit: 5 });
    executionLog.step3_kbSearch = {
      resultsFound: kbResults.length,
      kbHasContext: kbResults.length > 0,
      results: kbResults.map((r) => ({
        title: r.title,
        similarity: r.similarity.toFixed(4),
        preview: r.chunkText.substring(0, 100) + "...",
      })),
    };

    executionLog.hallucinationPrevention = kbResults.length > 0
      ? "KB context found - model will be grounded on this context."
      : "NO KB context found - system prompt instructs model to NOT make up policies and recommend contacting SafeGo Support.";

    const permissions = getToolPermissions(testRole);
    const countryRules = getCountryRules(testCountry);

    const tools: any[] = [];
    if (permissions.allowedTools.includes("read_ride_status")) {
      tools.push({ type: "function", function: { name: "get_ride_status", description: "Get ride status", parameters: { type: "object", properties: {} } } });
    }
    if (permissions.allowedTools.includes("read_verification_status")) {
      tools.push({ type: "function", function: { name: "get_verification_status", description: "Get verification status", parameters: { type: "object", properties: {} } } });
    }
    if (permissions.allowedTools.includes("read_wallet")) {
      tools.push({ type: "function", function: { name: "get_wallet_balance", description: "Get wallet balance", parameters: { type: "object", properties: {} } } });
    }

    executionLog.step4_toolDefinitions = {
      rolePermissions: permissions.allowedTools,
      toolsRegistered: tools.map((t) => t.function.name),
      rbacEnforcement: `Role ${testRole} has access to: ${permissions.allowedTools.join(", ")}`,
    };

    const kbContext = kbResults.length > 0
      ? kbResults.map((r, i) => `[Source ${i + 1}: ${r.title}]\n${r.chunkText}`).join("\n\n---\n\n")
      : "";

    const systemPrompt = `You are SafePilot, the in-app AI assistant for SafeGo.
${kbResults.length === 0 ? "CRITICAL: No knowledge base context available. DO NOT make up policies or procedures. If you don't know, say so and recommend contacting SafeGo Support." : `Knowledge Base Context:\n${kbContext}`}
Country: ${testCountry}, Currency: ${countryRules.currency}
User role: ${testRole}
Use tools to get user's real data when needed.`;

    type MsgType = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_call_id?: string; tool_calls?: any[] };
    const messages: MsgType[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ];

    let finalAnswer = "";
    let iteration = 0;

    while (iteration < 3) {
      iteration++;
      const result = await chatWithTools(messages, tools, { maxTokens: 1024 });

      executionLog.step5_modelCalls.push({
        iteration,
        finishReason: result.finishReason,
        hasToolCalls: result.toolCalls.length > 0,
        toolCallsRequested: result.toolCalls.map((tc) => tc.name),
        contentPreview: result.content?.substring(0, 200) || null,
      });

      if (result.finishReason === "tool_calls" && result.toolCalls.length > 0) {
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: result.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.arguments },
          })),
        });

        for (const tc of result.toolCalls) {
          const args = JSON.parse(tc.arguments || "{}");
          const toolResult = await execTool(tc.name as any, { userId: req.user.id, role: testRole, country: testCountry }, args);

          executionLog.step6_toolExecutions.push({
            tool: tc.name,
            args,
            success: toolResult.success,
            source: toolResult.source,
            rbacDenied: toolResult.source === "rbac_check" && !toolResult.success,
            dataPreview: toolResult.success ? JSON.stringify(toolResult.data).substring(0, 200) : toolResult.error,
          });

          messages.push({
            role: "tool",
            content: JSON.stringify(toolResult.success ? toolResult.data : { error: toolResult.error, rbac_denied: true }),
            tool_call_id: tc.id,
          });

          await prisma.safePilotAuditLog.create({
            data: {
              actorUserId: req.user.id,
              actorRole: testRole,
              action: "tool_call",
              metadata: { tool: tc.name, args, success: toolResult.success, source: toolResult.source, demo: true },
            },
          });
        }
      } else {
        finalAnswer = result.content || "Could not generate response.";
        break;
      }
    }

    executionLog.step7_finalResponse = {
      answer: finalAnswer,
      wasGrounded: kbResults.length > 0 || executionLog.step6_toolExecutions.length > 0,
      groundingSources: kbResults.length > 0 ? "KB documents" : executionLog.step6_toolExecutions.length > 0 ? "Tool results" : "None - may contain general knowledge only",
    };

    const auditCount = await prisma.safePilotAuditLog.count({
      where: {
        actorUserId: req.user.id,
        createdAt: { gte: new Date(Date.now() - 60000) },
      },
    });

    executionLog.step8_auditLogs = {
      logsCreatedInLastMinute: auditCount,
      auditTableUsed: "safepilot_audit_logs",
      insertStatement: `prisma.safePilotAuditLog.create({ data: { actorUserId, actorRole, action, metadata } })`,
    };

    res.json(executionLog);
  } catch (error) {
    console.error("[SafePilot] Full execution demo error:", error);
    res.status(500).json({ error: "Failed to run full execution demo", details: String(error) });
  }
});

export default router;
