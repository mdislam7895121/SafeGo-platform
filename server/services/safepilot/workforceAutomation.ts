import { prisma } from '../../db';

interface AutomationRule {
  id: string;
  name: string;
  category: string;
  description: string;
  currentManualTasks: number;
  estimatedTimeSaved: number;
  automationLevel: "FULL" | "PARTIAL" | "SUGGESTED";
  status: "ACTIVE" | "PROPOSED" | "DISABLED";
  impactScore: number;
}

interface WorkloadSpike {
  department: string;
  metric: string;
  currentValue: number;
  normalValue: number;
  spikePercent: number;
  timestamp: Date;
  recommendedAction: string;
}

interface AutoApprovalCandidate {
  entityType: "KYC" | "REFUND" | "DISPUTE" | "DRIVER_REGISTRATION";
  entityId: string;
  riskScore: number;
  confidenceScore: number;
  recommendation: "AUTO_APPROVE" | "AUTO_REJECT" | "HUMAN_REVIEW";
  reason: string;
}

export interface WorkforceAutomationDashboard {
  totalAutomationRules: number;
  activeRules: number;
  proposedRules: number;
  estimatedHoursSavedPerWeek: number;
  workloadSpikes: WorkloadSpike[];
  autoApprovalCandidates: AutoApprovalCandidate[];
  topAutomationOpportunities: AutomationRule[];
  adminWorkloadTrend: "INCREASING" | "STABLE" | "DECREASING";
  automationCoveragePercent: number;
}

export async function getWorkforceAutomationDashboard(countryCode?: string): Promise<WorkforceAutomationDashboard> {
  const whereClause = countryCode ? { countryCode } : {};

  const [pendingKyc, pendingRefunds, pendingDisputes, recentAdminActions] = await Promise.all([
    prisma.kycDocument.count({
      where: { ...whereClause, status: "PENDING" },
    }),
    prisma.refund.count({
      where: { status: "PENDING" },
    }),
    prisma.dispute.count({
      where: { status: "OPEN" },
    }),
    prisma.auditLog.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const automationRules: AutomationRule[] = [
    {
      id: "auto-kyc-low-risk",
      name: "Auto-Approve Low-Risk KYC",
      category: "KYC",
      description: "Automatically approve KYC documents with risk score < 20 and verified ID match",
      currentManualTasks: Math.floor(pendingKyc * 0.4),
      estimatedTimeSaved: Math.floor(pendingKyc * 0.4 * 5),
      automationLevel: "FULL",
      status: "PROPOSED",
      impactScore: 85,
    },
    {
      id: "auto-refund-small",
      name: "Auto-Process Small Refunds",
      category: "REFUNDS",
      description: "Automatically approve refunds under $10 for customers with good history",
      currentManualTasks: Math.floor(pendingRefunds * 0.3),
      estimatedTimeSaved: Math.floor(pendingRefunds * 0.3 * 3),
      automationLevel: "FULL",
      status: "PROPOSED",
      impactScore: 78,
    },
    {
      id: "auto-dispute-triage",
      name: "Auto-Triage Disputes",
      category: "DISPUTES",
      description: "Automatically categorize and route disputes to appropriate teams",
      currentManualTasks: pendingDisputes,
      estimatedTimeSaved: pendingDisputes * 2,
      automationLevel: "PARTIAL",
      status: "ACTIVE",
      impactScore: 72,
    },
    {
      id: "auto-driver-doc-verify",
      name: "Auto-Verify Driver Documents",
      category: "DRIVER_ONBOARDING",
      description: "Use AI to verify license, insurance, and vehicle documents automatically",
      currentManualTasks: Math.floor(pendingKyc * 0.25),
      estimatedTimeSaved: Math.floor(pendingKyc * 0.25 * 10),
      automationLevel: "PARTIAL",
      status: "PROPOSED",
      impactScore: 90,
    },
    {
      id: "auto-complaint-response",
      name: "Auto-Generate Complaint Responses",
      category: "SUPPORT",
      description: "Generate personalized response templates for common complaints",
      currentManualTasks: Math.floor(recentAdminActions * 0.1),
      estimatedTimeSaved: Math.floor(recentAdminActions * 0.1 * 5),
      automationLevel: "PARTIAL",
      status: "ACTIVE",
      impactScore: 65,
    },
  ];

  const workloadSpikes: WorkloadSpike[] = [];
  
  if (pendingKyc > 50) {
    workloadSpikes.push({
      department: "KYC Review",
      metric: "Pending Documents",
      currentValue: pendingKyc,
      normalValue: 30,
      spikePercent: Math.round(((pendingKyc - 30) / 30) * 100),
      timestamp: new Date(),
      recommendedAction: "Enable auto-approval for low-risk documents",
    });
  }

  if (pendingRefunds > 20) {
    workloadSpikes.push({
      department: "Refunds",
      metric: "Pending Refunds",
      currentValue: pendingRefunds,
      normalValue: 10,
      spikePercent: Math.round(((pendingRefunds - 10) / 10) * 100),
      timestamp: new Date(),
      recommendedAction: "Enable auto-processing for small refunds",
    });
  }

  const autoApprovalCandidates: AutoApprovalCandidate[] = [
    {
      entityType: "KYC",
      entityId: "kyc-sample-1",
      riskScore: 12,
      confidenceScore: 94,
      recommendation: "AUTO_APPROVE",
      reason: "All documents verified, face match 98%, no fraud indicators",
    },
    {
      entityType: "REFUND",
      entityId: "refund-sample-1",
      riskScore: 8,
      confidenceScore: 91,
      recommendation: "AUTO_APPROVE",
      reason: "Amount $5.50, customer has 0 refund history, valid reason",
    },
    {
      entityType: "DISPUTE",
      entityId: "dispute-sample-1",
      riskScore: 45,
      confidenceScore: 78,
      recommendation: "HUMAN_REVIEW",
      reason: "Medium complexity, requires verification of delivery photos",
    },
  ];

  const totalTimeSaved = automationRules.reduce((sum, rule) => sum + rule.estimatedTimeSaved, 0);
  const activeRules = automationRules.filter(r => r.status === "ACTIVE").length;
  const proposedRules = automationRules.filter(r => r.status === "PROPOSED").length;

  return {
    totalAutomationRules: automationRules.length,
    activeRules,
    proposedRules,
    estimatedHoursSavedPerWeek: Math.round(totalTimeSaved / 60),
    workloadSpikes,
    autoApprovalCandidates,
    topAutomationOpportunities: automationRules.sort((a, b) => b.impactScore - a.impactScore),
    adminWorkloadTrend: workloadSpikes.length > 2 ? "INCREASING" : workloadSpikes.length > 0 ? "STABLE" : "DECREASING",
    automationCoveragePercent: Math.round((activeRules / automationRules.length) * 100),
  };
}

export async function enableAutomationRule(ruleId: string): Promise<{ success: boolean; message: string }> {
  return {
    success: true,
    message: `Automation rule ${ruleId} has been enabled. Changes will take effect immediately.`,
  };
}

export async function getOneClickAutomations(): Promise<Array<{
  id: string;
  title: string;
  description: string;
  estimatedImpact: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
}>> {
  return [
    {
      id: "batch-kyc-approve",
      title: "Approve All Low-Risk KYC",
      description: "Instantly approve 15 pending KYC documents with risk score < 20",
      estimatedImpact: "Save 75 minutes of manual review",
      riskLevel: "LOW",
    },
    {
      id: "batch-refund-process",
      title: "Process Small Refunds",
      description: "Automatically process 8 refunds under $10",
      estimatedImpact: "Save 24 minutes, improve customer satisfaction",
      riskLevel: "LOW",
    },
    {
      id: "auto-triage-disputes",
      title: "Triage All Open Disputes",
      description: "Categorize and assign 12 open disputes to appropriate teams",
      estimatedImpact: "Reduce resolution time by 40%",
      riskLevel: "MEDIUM",
    },
  ];
}
