export interface TrustGuardrails {
  noRefundPromises: boolean;
  explainWhy: boolean;
  noBlame: boolean;
  alwaysNextStep: boolean;
}

const REFUND_PATTERNS = [
  /will refund/i,
  /will give you a refund/i,
  /refund has been processed/i,
  /refund of \$?\d+/i,
  /credit of \$?\d+/i,
  /we'll credit/i,
  /will be credited/i,
  /compensation of/i,
  /will compensate/i,
];

const BLAME_PATTERNS = [
  /your fault/i,
  /you should have/i,
  /you failed to/i,
  /you didn't/i,
  /driver's fault/i,
  /the driver was wrong/i,
  /restaurant made a mistake/i,
  /it's because you/i,
];

const NEXT_STEP_INDICATORS = [
  /you can/i,
  /please/i,
  /next step/i,
  /to proceed/i,
  /to resolve/i,
  /would you like/i,
  /i can help/i,
  /let me/i,
  /i'll/i,
  /contact/i,
];

export function checkTrustGuardrails(response: string): TrustGuardrails {
  const hasRefundPromise = REFUND_PATTERNS.some(pattern => pattern.test(response));
  const hasBlame = BLAME_PATTERNS.some(pattern => pattern.test(response));
  const hasNextStep = NEXT_STEP_INDICATORS.some(pattern => pattern.test(response));

  return {
    noRefundPromises: !hasRefundPromise,
    explainWhy: response.includes("because") || response.includes("due to") || response.includes("reason"),
    noBlame: !hasBlame,
    alwaysNextStep: hasNextStep,
  };
}

export function applyTrustGuardrails(response: string): { sanitized: string; violations: string[] } {
  let sanitized = response;
  const violations: string[] = [];

  for (const pattern of REFUND_PATTERNS) {
    if (pattern.test(sanitized)) {
      violations.push("refund_promise");
      sanitized = sanitized.replace(pattern, "Our team will review this and follow up with you about any applicable resolution");
    }
  }

  for (const pattern of BLAME_PATTERNS) {
    if (pattern.test(sanitized)) {
      violations.push("blame_language");
      sanitized = sanitized.replace(pattern, "");
    }
  }

  const hasNextStep = NEXT_STEP_INDICATORS.some(pattern => pattern.test(sanitized));
  if (!hasNextStep && sanitized.length > 50) {
    violations.push("missing_next_step");
    sanitized += "\n\nIs there anything else I can help you with?";
  }

  return { sanitized, violations };
}

export interface CountryTrustTemplate {
  country: "US" | "BD";
  kycExplanation: string;
  paymentExplanation: string;
  complianceNote: string;
}

export const US_TRUST_TEMPLATE: CountryTrustTemplate = {
  country: "US",
  kycExplanation: `For your security, SafeGo verifies your identity using your government-issued ID. This helps prevent fraud and ensures a safe experience for everyone. Your information is encrypted and handled according to US privacy regulations.`,
  paymentExplanation: `SafeGo accepts major credit cards, debit cards, and digital wallets. All payments are processed securely through our payment partners. You can manage your payment methods in your account settings.`,
  complianceNote: `SafeGo operates in compliance with US federal and state regulations. If you have questions about our policies, please visit our Help Center or contact support.`,
};

export const BD_TRUST_TEMPLATE: CountryTrustTemplate = {
  country: "BD",
  kycExplanation: `For your security, SafeGo verifies your identity using your NID (National ID). This is required by Bangladesh regulations and helps ensure a safe experience for everyone. Your NID information is encrypted and stored securely.`,
  paymentExplanation: `SafeGo accepts bKash, Nagad, and cash payments. For digital payments, you can link your bKash or Nagad account in your settings. Cash on delivery is also available for eligible orders.`,
  complianceNote: `SafeGo operates in compliance with Bangladesh regulations including BTRC and local commerce laws. If you have questions about our policies, please visit our Help Center or contact support.`,
};

export function getCountryTrustTemplate(country: "US" | "BD"): CountryTrustTemplate {
  return country === "BD" ? BD_TRUST_TEMPLATE : US_TRUST_TEMPLATE;
}

export function getTrustGuidelines(country: "US" | "BD"): string {
  const template = getCountryTrustTemplate(country);
  
  return `## Trust & Brand Voice Guidelines

NEVER:
- Promise refunds, credits, or compensation without backend confirmation
- Blame the customer, driver, or restaurant partner
- Use technical jargon without explanation
- Leave the customer without a clear next step

ALWAYS:
- Explain "why" in simple language
- Offer a concrete next step or action
- Acknowledge the customer's concern
- Stay calm, professional, and helpful

### Country-Specific Information (${country})

**Identity Verification:**
${template.kycExplanation}

**Payment Methods:**
${template.paymentExplanation}

**Compliance:**
${template.complianceNote}`;
}

export interface AdminReviewSample {
  conversationId: string;
  userId: string;
  userMessage: string;
  aiResponse: string;
  emotion: string;
  escalationReason?: string;
  trustViolations: string[];
  timestamp: Date;
}

export async function sampleResponsesForReview(
  prisma: any,
  limit: number = 10
): Promise<AdminReviewSample[]> {
  const recentConversations = await prisma.safePilotConversation.findMany({
    where: { userRole: "CUSTOMER" },
    orderBy: { updatedAt: "desc" },
    take: limit * 2,
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 4,
      },
    },
  });

  const samples: AdminReviewSample[] = [];

  for (const conv of recentConversations) {
    if (samples.length >= limit) break;

    const userMsg = conv.messages.find((m: any) => m.direction === "user");
    const aiMsg = conv.messages.find((m: any) => m.direction === "assistant");

    if (userMsg && aiMsg) {
      const guardrails = checkTrustGuardrails(aiMsg.content);
      const violations: string[] = [];
      
      if (!guardrails.noRefundPromises) violations.push("refund_promise");
      if (!guardrails.noBlame) violations.push("blame_language");
      if (!guardrails.alwaysNextStep) violations.push("missing_next_step");

      const auditLog = await prisma.safePilotAuditLog.findFirst({
        where: {
          actorUserId: conv.userId,
          metadata: { path: ["conversationId"], equals: conv.id },
        },
        orderBy: { createdAt: "desc" },
      });

      const metadata = auditLog?.metadata as any;

      samples.push({
        conversationId: conv.id,
        userId: conv.userId,
        userMessage: userMsg.content,
        aiResponse: aiMsg.content,
        emotion: metadata?.emotion || "NORMAL",
        escalationReason: metadata?.escalationReason,
        trustViolations: violations,
        timestamp: aiMsg.createdAt,
      });
    }
  }

  return samples;
}
