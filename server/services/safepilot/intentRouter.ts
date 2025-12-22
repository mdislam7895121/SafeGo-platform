import { Role } from "./rbac";

export type IntentRoute = "TOOL_FIRST" | "KB_FIRST" | "REFUSE";

interface IntentResult {
  route: IntentRoute;
  reason: string;
  matchedKeywords: string[];
}

const TOOL_FIRST_PATTERNS = [
  { keywords: ["my ride", "ride status", "where is my ride", "track ride", "ride details"], category: "ride_status" },
  { keywords: ["my order", "order status", "where is my order", "track order", "food order", "order details"], category: "order_status" },
  { keywords: ["my delivery", "delivery status", "where is my package", "parcel status", "track parcel", "delivery details"], category: "delivery_status" },
  { keywords: ["verification status", "kyc status", "am i verified", "my verification", "document status", "approval status"], category: "verification" },
  { keywords: ["wallet balance", "my balance", "my earnings", "my wallet", "how much do i have", "negative balance"], category: "wallet" },
];

const KB_FIRST_PATTERNS = [
  { keywords: ["how to", "how do i", "what is", "what are", "explain", "policy", "procedure", "process", "requirement"], category: "how_to" },
  { keywords: ["pricing", "fare", "fee", "commission", "charge", "cost", "rate"], category: "pricing" },
  { keywords: ["kyc requirements", "documents needed", "what documents", "required documents", "id requirements"], category: "kyc_docs" },
  { keywords: ["cancel policy", "refund policy", "cancellation", "refund"], category: "policies" },
  { keywords: ["payment methods", "accepted payments", "how to pay", "add payment"], category: "payment_info" },
  { keywords: ["contact support", "help", "customer service", "support number"], category: "support" },
  { keywords: ["steps", "flow", "guide", "tutorial", "instructions"], category: "guides" },
];

const REFUSE_PATTERNS = [
  { keywords: ["show me customer nid", "customer id", "customer documents", "user nid", "driver nid", "driver license image"], category: "restricted_pii" },
  { keywords: ["all users", "list all customers", "all drivers", "dump database", "export users"], category: "bulk_data" },
  { keywords: ["change commission", "update pricing", "modify fees", "admin password", "delete user"], category: "admin_only" },
  { keywords: ["other user", "someone else", "another customer", "another driver"], category: "other_user_data" },
];

function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/[^\w\s]/g, "");
}

function matchPatterns(normalizedQuery: string, patterns: Array<{ keywords: string[]; category: string }>): { matched: boolean; keywords: string[]; category: string } {
  for (const pattern of patterns) {
    const matchedKeywords = pattern.keywords.filter(kw => normalizedQuery.includes(kw.toLowerCase()));
    if (matchedKeywords.length > 0) {
      return { matched: true, keywords: matchedKeywords, category: pattern.category };
    }
  }
  return { matched: false, keywords: [], category: "" };
}

export function classifyIntent(message: string, role: Role): IntentResult {
  const normalized = normalizeQuery(message);

  const refuseMatch = matchPatterns(normalized, REFUSE_PATTERNS);
  if (refuseMatch.matched) {
    if (role !== "ADMIN") {
      return {
        route: "REFUSE",
        reason: `Restricted data request: ${refuseMatch.category}`,
        matchedKeywords: refuseMatch.keywords,
      };
    }
  }

  const toolMatch = matchPatterns(normalized, TOOL_FIRST_PATTERNS);
  if (toolMatch.matched) {
    return {
      route: "TOOL_FIRST",
      reason: `User data query: ${toolMatch.category}`,
      matchedKeywords: toolMatch.keywords,
    };
  }

  const kbMatch = matchPatterns(normalized, KB_FIRST_PATTERNS);
  if (kbMatch.matched) {
    return {
      route: "KB_FIRST",
      reason: `Policy/info query: ${kbMatch.category}`,
      matchedKeywords: kbMatch.keywords,
    };
  }

  return {
    route: "KB_FIRST",
    reason: "Default to KB search for general questions",
    matchedKeywords: [],
  };
}

export function getRefusalResponse(reason: string): string {
  if (reason.includes("restricted_pii")) {
    return "I can't share other users' personal documents or identification details for privacy and security reasons. If you need to verify information about a user, please use the appropriate admin verification panel or contact SafeGo Support.";
  }
  if (reason.includes("bulk_data")) {
    return "I can't export or list bulk user data. For data exports, please use the Admin Data Export Center or contact your administrator.";
  }
  if (reason.includes("admin_only")) {
    return "That action requires administrator privileges. Please contact your admin or use the Admin Panel for system configuration changes.";
  }
  if (reason.includes("other_user_data")) {
    return "I can only access your own data for privacy reasons. Each user can only view their own information through SafePilot.";
  }
  return "I can't help with that request. Please contact SafeGo Support for assistance.";
}

export function getNextActionsForNoKB(): string[] {
  return [
    "Check the Help section in the app for guides",
    "Contact SafeGo Support for personalized assistance",
    "Ask your admin for internal documentation",
  ];
}
