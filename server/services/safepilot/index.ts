export { growthEngine } from './growthEngine';
export { costReductionEngine } from './costReductionEngine';
export { fraudShield } from './fraudShield';
export { partnerSuccessCoach } from './partnerSuccessCoach';
export { customerRetentionAI } from './customerRetentionAI';
export { marketingAI } from './marketingAI';
export { financialIntelligence } from './financialIntelligence';
export { complianceGuard } from './complianceGuard';

export * from './workforceAutomation';
export * from './systemHealthMonitoring';
export * from './dynamicPolicyGenerator';
export * from './supportAutomationAI';
export * from './growthAdvisor';

export { safetyIncidentDetection } from './safetyIncidentDetection';
export { locationIntegrity } from './locationIntegrity';
export { adminInsiderThreat } from './adminInsiderThreat';
export { predictiveAnalytics } from './predictiveAnalytics';
export { autoDecisionEngine } from './autoDecisionEngine';

// SafePilot RAG AI Assistant exports
export { openai, SAFEPILOT_MODEL, SAFEPILOT_EMBED_MODEL, generateEmbedding, moderateText, chatCompletion, chatCompletionWithTools } from "./openaiClient";
export type { ToolDefinition, ToolCallResult } from "./openaiClient";
export { canUseAdminKB, canAccessDocument, sanitizeSourcesForRole, getToolPermissions, getCountryRules, validatePrivacyRequest } from "./rbac";
export type { Role, Country, ServiceScope } from "./rbac";
export { searchKB, getDocumentById, createDocumentWithEmbeddings, reembedDocument, updateDocumentStatus, listDocuments } from "./kbSearch";
export { safepilotChat, getConversationHistory, getUserConversations } from "./chatHandler";
export type { ChatRequest, ChatResponse } from "./chatHandler";
export { getAuditLogs, logAdminAction, getAuditStats } from "./auditService";
export { executeTool, getRideStatus, getOrderStatus, getDeliveryStatus, getVerificationStatus, getWalletBalance } from "./tools";
export type { ToolContext, ToolResult, ToolName } from "./tools";
