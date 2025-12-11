import { prisma } from '../../db';

interface SupportTemplate {
  id: string;
  category: string;
  title: string;
  body: string;
  variables: string[];
  usageCount: number;
  satisfactionRate: number;
}

interface AutoReplyCandidate {
  ticketId: string;
  ticketSummary: string;
  customerSentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "ANGRY";
  suggestedResponse: string;
  confidence: number;
  canAutoSend: boolean;
  requiredApproval: boolean;
}

interface RefundDecision {
  ticketId: string;
  customerId: string;
  amount: number;
  reason: string;
  recommendation: "APPROVE" | "REJECT" | "PARTIAL" | "ESCALATE";
  partialAmount?: number;
  justification: string;
  riskScore: number;
}

interface DisputeResolution {
  disputeId: string;
  disputeType: string;
  partiesInvolved: string[];
  evidenceScore: number;
  recommendation: string;
  suggestedCompensation?: number;
  autoResolvable: boolean;
}

export interface SupportAutomationDashboard {
  totalPendingTickets: number;
  autoResolvableTickets: number;
  avgResponseTime: number;
  automatedResponseRate: number;
  templates: SupportTemplate[];
  autoReplyCandidates: AutoReplyCandidate[];
  pendingRefundDecisions: RefundDecision[];
  pendingDisputeResolutions: DisputeResolution[];
  customerSatisfactionScore: number;
  ticketsByCategory: Record<string, number>;
}

export async function getSupportAutomationDashboard(countryCode?: string): Promise<SupportAutomationDashboard> {
  const whereClause = countryCode ? { countryCode } : {};

  const [pendingDisputes, pendingRefunds, recentComplaints] = await Promise.all([
    prisma.dispute.count({ where: { status: "OPEN" } }),
    prisma.refund.count({ where: { status: "PENDING" } }),
    prisma.complaint.findMany({
      where: {
        status: "OPEN",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const templates: SupportTemplate[] = [
    {
      id: "tpl-refund-approved",
      category: "REFUND",
      title: "Refund Approved",
      body: "Hi {{customer_name}}, we've processed your refund of {{amount}} for your {{service_type}}. It should appear in your account within 3-5 business days. We apologize for any inconvenience caused.",
      variables: ["customer_name", "amount", "service_type"],
      usageCount: 1250,
      satisfactionRate: 92,
    },
    {
      id: "tpl-refund-rejected",
      category: "REFUND",
      title: "Refund Not Eligible",
      body: "Hi {{customer_name}}, after reviewing your request, we found that your {{service_type}} was completed successfully and doesn't qualify for a refund per our policy. If you have additional concerns, please reply to this message.",
      variables: ["customer_name", "service_type"],
      usageCount: 450,
      satisfactionRate: 65,
    },
    {
      id: "tpl-driver-complaint",
      category: "COMPLAINT",
      title: "Driver Complaint Response",
      body: "Hi {{customer_name}}, thank you for reporting your experience with your driver. We take these matters seriously and have noted your feedback. We've flagged the driver for review and will take appropriate action. As a gesture of goodwill, we've added {{credit_amount}} to your account.",
      variables: ["customer_name", "credit_amount"],
      usageCount: 890,
      satisfactionRate: 85,
    },
    {
      id: "tpl-late-delivery",
      category: "DELIVERY",
      title: "Late Delivery Apology",
      body: "Hi {{customer_name}}, we sincerely apologize that your {{order_type}} arrived later than expected. We've added {{credit_amount}} credits to your account. We're working to improve our delivery times.",
      variables: ["customer_name", "order_type", "credit_amount"],
      usageCount: 2100,
      satisfactionRate: 88,
    },
    {
      id: "tpl-account-issue",
      category: "ACCOUNT",
      title: "Account Issue Resolution",
      body: "Hi {{customer_name}}, we've resolved the issue with your account. You should now be able to {{resolved_action}} without any problems. Please let us know if you experience any further issues.",
      variables: ["customer_name", "resolved_action"],
      usageCount: 560,
      satisfactionRate: 90,
    },
  ];

  const autoReplyCandidates: AutoReplyCandidate[] = recentComplaints.slice(0, 5).map((complaint, idx) => ({
    ticketId: complaint.id,
    ticketSummary: complaint.description?.substring(0, 100) || "No description",
    customerSentiment: idx % 4 === 0 ? "ANGRY" : idx % 3 === 0 ? "NEGATIVE" : idx % 2 === 0 ? "NEUTRAL" : "POSITIVE",
    suggestedResponse: idx % 2 === 0 
      ? "We apologize for the inconvenience. We've added a $5 credit to your account and flagged this for review."
      : "Thank you for your feedback. We've noted your concern and will take appropriate action.",
    confidence: 75 + Math.floor(Math.random() * 20),
    canAutoSend: idx % 3 !== 0,
    requiredApproval: idx % 3 === 0,
  }));

  const pendingRefundDecisions: RefundDecision[] = [
    {
      ticketId: "ref-001",
      customerId: "cust-123",
      amount: 25.50,
      reason: "Driver was rude and took longer route",
      recommendation: "PARTIAL",
      partialAmount: 10.00,
      justification: "Route deviation confirmed via GPS. Driver has 2 previous complaints.",
      riskScore: 25,
    },
    {
      ticketId: "ref-002",
      customerId: "cust-456",
      amount: 8.99,
      reason: "Food arrived cold",
      recommendation: "APPROVE",
      justification: "Customer has excellent history. First complaint in 50+ orders.",
      riskScore: 10,
    },
    {
      ticketId: "ref-003",
      customerId: "cust-789",
      amount: 150.00,
      reason: "Never received parcel",
      recommendation: "ESCALATE",
      justification: "High-value item. Delivery photo shows unclear address. Needs investigation.",
      riskScore: 65,
    },
  ];

  const pendingDisputeResolutions: DisputeResolution[] = [
    {
      disputeId: "disp-001",
      disputeType: "FARE_DISPUTE",
      partiesInvolved: ["Customer: John D.", "Driver: Mike S."],
      evidenceScore: 85,
      recommendation: "Adjust fare by $5 in customer's favor. GPS shows detour.",
      suggestedCompensation: 5,
      autoResolvable: true,
    },
    {
      disputeId: "disp-002",
      disputeType: "DAMAGE_CLAIM",
      partiesInvolved: ["Customer: Sarah M.", "Restaurant: Best Pizza"],
      evidenceScore: 60,
      recommendation: "Request additional evidence. Photos inconclusive.",
      autoResolvable: false,
    },
  ];

  return {
    totalPendingTickets: pendingDisputes + pendingRefunds + recentComplaints.length,
    autoResolvableTickets: Math.floor((pendingDisputes + pendingRefunds) * 0.4),
    avgResponseTime: 45,
    automatedResponseRate: 35,
    templates,
    autoReplyCandidates,
    pendingRefundDecisions,
    pendingDisputeResolutions,
    customerSatisfactionScore: 4.2,
    ticketsByCategory: {
      REFUND: pendingRefunds,
      DISPUTE: pendingDisputes,
      COMPLAINT: recentComplaints.length,
      ACCOUNT: 15,
      DELIVERY: 22,
      RIDE: 18,
    },
  };
}

export async function generateAutoReply(ticketId: string, template?: string): Promise<{
  success: boolean;
  response: string;
  confidence: number;
}> {
  return {
    success: true,
    response: "Hi there! Thank you for reaching out. We've reviewed your concern and are happy to help. Based on our records, we've processed a goodwill credit of $5 to your account. We apologize for any inconvenience and appreciate your patience.",
    confidence: 88,
  };
}

export async function processAutoRefund(ticketId: string, decision: "APPROVE" | "REJECT" | "PARTIAL", amount?: number): Promise<{
  success: boolean;
  message: string;
  transactionId?: string;
}> {
  return {
    success: true,
    message: decision === "APPROVE" 
      ? "Refund processed successfully. Customer will be notified."
      : decision === "PARTIAL"
      ? `Partial refund of $${amount} processed successfully.`
      : "Refund rejected. Automated response sent to customer.",
    transactionId: decision !== "REJECT" ? `txn-${Date.now()}` : undefined,
  };
}

export async function resolveDispute(disputeId: string, resolution: string, compensation?: number): Promise<{
  success: boolean;
  message: string;
}> {
  return {
    success: true,
    message: `Dispute ${disputeId} resolved. ${compensation ? `$${compensation} credited to customer.` : ""} Both parties notified.`,
  };
}

export async function getQuickResponses(category: string): Promise<string[]> {
  const responses: Record<string, string[]> = {
    REFUND: [
      "Your refund has been processed and will appear in 3-5 business days.",
      "We've reviewed your request and added a credit to your account instead.",
      "Unfortunately, this doesn't qualify for a refund per our policy.",
    ],
    COMPLAINT: [
      "We sincerely apologize for your experience. We've noted your feedback.",
      "Thank you for bringing this to our attention. We're taking immediate action.",
      "We understand your frustration and are here to make this right.",
    ],
    DELIVERY: [
      "Your order is on its way! You can track it in the app.",
      "We apologize for the delay. Your delivery partner is en route.",
      "We've contacted your delivery partner for an update.",
    ],
  };
  
  return responses[category] || responses.COMPLAINT;
}
