import { prisma } from "../../lib/prisma";

export interface SafePilotKPIFilters {
  startDate: Date;
  endDate: Date;
  country?: "US" | "BD";
  service?: "ride" | "food" | "parcel";
}

export interface SafePilotKPIMetrics {
  totalConversations: number;
  resolvedByAI: number;
  resolvedByAIPercentage: number;
  escalatedToHuman: number;
  escalatedPercentage: number;
  avgResolutionTimeMinutes: number;
  angryResolvedCount: number;
  angryResolvedRate: number;
  followUpsSent: number;
  followUpSuccessRate: number;
  ticketReductionPercentage: number;
  emotionBreakdown: {
    angry: number;
    confused: number;
    normal: number;
  };
  dailyTrend: Array<{
    date: string;
    conversations: number;
    resolved: number;
    escalated: number;
  }>;
}

export async function getSafePilotKPIs(filters: SafePilotKPIFilters): Promise<SafePilotKPIMetrics> {
  const { startDate, endDate, country, service } = filters;

  const conversationWhere: any = {
    createdAt: { gte: startDate, lte: endDate },
    userRole: "CUSTOMER",
  };

  if (country) {
    conversationWhere.country = country;
  }

  const conversations = await prisma.safePilotConversation.findMany({
    where: conversationWhere,
    select: {
      id: true,
      createdAt: true,
      messages: {
        select: { id: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const totalConversations = conversations.length;

  const auditLogs = await prisma.safePilotAuditLog.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      actorRole: "CUSTOMER",
      action: "ask",
    },
    select: {
      id: true,
      metadata: true,
      createdAt: true,
    },
  });

  let resolvedByAI = 0;
  let escalatedToHuman = 0;
  let angryCount = 0;
  let angryResolved = 0;
  let confusedCount = 0;
  let normalCount = 0;
  let followUpsSent = 0;
  let followUpsResolved = 0;
  const resolutionTimes: number[] = [];

  const dailyStats = new Map<string, { conversations: number; resolved: number; escalated: number }>();

  for (const log of auditLogs) {
    const metadata = log.metadata as any;
    if (!metadata) continue;

    const dateKey = log.createdAt.toISOString().split("T")[0];
    if (!dailyStats.has(dateKey)) {
      dailyStats.set(dateKey, { conversations: 0, resolved: 0, escalated: 0 });
    }
    const dayStats = dailyStats.get(dateKey)!;

    if (metadata.type === "monitoring_event") {
      if (metadata.eventType === "ai_resolved") {
        resolvedByAI++;
        dayStats.resolved++;
        if (metadata.resolutionTimeMs) {
          resolutionTimes.push(metadata.resolutionTimeMs);
        }
        if (metadata.emotion === "ANGRY") {
          angryResolved++;
        }
      } else if (metadata.eventType === "escalated") {
        escalatedToHuman++;
        dayStats.escalated++;
      } else if (metadata.eventType === "follow_up_sent") {
        followUpsSent++;
      }
    }

    if (metadata.emotion === "ANGRY") {
      angryCount++;
    } else if (metadata.emotion === "CONFUSED") {
      confusedCount++;
    } else if (metadata.emotion === "NORMAL") {
      normalCount++;
    }

    if (metadata.type === "issue_resolved" && metadata.conditionType) {
      followUpsResolved++;
    }
  }

  for (const conv of conversations) {
    const dateKey = conv.createdAt.toISOString().split("T")[0];
    if (!dailyStats.has(dateKey)) {
      dailyStats.set(dateKey, { conversations: 0, resolved: 0, escalated: 0 });
    }
    dailyStats.get(dateKey)!.conversations++;
  }

  const preAITickets = await getPreAITicketBaseline(startDate);
  const currentTickets = await prisma.customerSupportTicket.count({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      channel: { not: "safepilot" },
    },
  });

  const ticketReduction = preAITickets > 0 
    ? Math.max(0, ((preAITickets - currentTickets) / preAITickets) * 100)
    : 0;

  const avgResolutionTime = resolutionTimes.length > 0
    ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length / 60000
    : 0;

  const dailyTrend = Array.from(dailyStats.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({
      date,
      ...stats,
    }));

  return {
    totalConversations,
    resolvedByAI,
    resolvedByAIPercentage: totalConversations > 0 ? (resolvedByAI / totalConversations) * 100 : 0,
    escalatedToHuman,
    escalatedPercentage: totalConversations > 0 ? (escalatedToHuman / totalConversations) * 100 : 0,
    avgResolutionTimeMinutes: Math.round(avgResolutionTime * 10) / 10,
    angryResolvedCount: angryResolved,
    angryResolvedRate: angryCount > 0 ? (angryResolved / angryCount) * 100 : 0,
    followUpsSent,
    followUpSuccessRate: followUpsSent > 0 ? (followUpsResolved / followUpsSent) * 100 : 0,
    ticketReductionPercentage: Math.round(ticketReduction * 10) / 10,
    emotionBreakdown: {
      angry: angryCount,
      confused: confusedCount,
      normal: normalCount,
    },
    dailyTrend,
  };
}

async function getPreAITicketBaseline(since: Date): Promise<number> {
  const thirtyDaysBeforeStart = new Date(since.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const historicalTickets = await prisma.customerSupportTicket.count({
    where: {
      createdAt: { gte: thirtyDaysBeforeStart, lt: since },
    },
  });

  return historicalTickets;
}

export interface SafePilotCostReport {
  period: { start: Date; end: Date };
  ticketsAvoidedByAI: number;
  avgHandlingTimeMinutes: number;
  humanHoursSaved: number;
  estimatedCostSavedUSD: number;
  aiCostUSD: number;
  netSavingsUSD: number;
  costPerHumanTicketUSD: number;
  costPerAIResolutionUSD: number;
  roiPercentage: number;
  breakdown: {
    preAITicketVolume: number;
    currentTicketVolume: number;
    aiResolvedCount: number;
    escalatedCount: number;
  };
}

const COST_CONSTANTS = {
  AVG_HANDLING_TIME_MINUTES: 15,
  COST_PER_HUMAN_HOUR_USD: 12,
  COST_PER_AI_QUERY_USD: 0.02,
};

export async function getSafePilotCostReport(filters: SafePilotKPIFilters): Promise<SafePilotCostReport> {
  const { startDate, endDate } = filters;
  const kpis = await getSafePilotKPIs(filters);

  const preAITickets = await getPreAITicketBaseline(startDate);
  
  const currentTickets = await prisma.customerSupportTicket.count({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      channel: { not: "safepilot" },
    },
  });

  const ticketsAvoidedByAI = kpis.resolvedByAI;
  
  const humanMinutesSaved = ticketsAvoidedByAI * COST_CONSTANTS.AVG_HANDLING_TIME_MINUTES;
  const humanHoursSaved = humanMinutesSaved / 60;
  
  const estimatedCostSaved = humanHoursSaved * COST_CONSTANTS.COST_PER_HUMAN_HOUR_USD;
  
  const aiCost = kpis.totalConversations * COST_CONSTANTS.COST_PER_AI_QUERY_USD;
  
  const netSavings = estimatedCostSaved - aiCost;
  
  const roi = aiCost > 0 ? ((netSavings / aiCost) * 100) : 0;

  const costPerHumanTicket = COST_CONSTANTS.AVG_HANDLING_TIME_MINUTES / 60 * COST_CONSTANTS.COST_PER_HUMAN_HOUR_USD;
  const costPerAIResolution = COST_CONSTANTS.COST_PER_AI_QUERY_USD;

  return {
    period: { start: startDate, end: endDate },
    ticketsAvoidedByAI,
    avgHandlingTimeMinutes: COST_CONSTANTS.AVG_HANDLING_TIME_MINUTES,
    humanHoursSaved: Math.round(humanHoursSaved * 10) / 10,
    estimatedCostSavedUSD: Math.round(estimatedCostSaved * 100) / 100,
    aiCostUSD: Math.round(aiCost * 100) / 100,
    netSavingsUSD: Math.round(netSavings * 100) / 100,
    costPerHumanTicketUSD: Math.round(costPerHumanTicket * 100) / 100,
    costPerAIResolutionUSD: costPerAIResolution,
    roiPercentage: Math.round(roi * 10) / 10,
    breakdown: {
      preAITicketVolume: preAITickets,
      currentTicketVolume: currentTickets,
      aiResolvedCount: kpis.resolvedByAI,
      escalatedCount: kpis.escalatedToHuman,
    },
  };
}

export function generateCostReportCSV(report: SafePilotCostReport): string {
  const lines = [
    "SafePilot Cost & Savings Report",
    `Period,${report.period.start.toISOString()},${report.period.end.toISOString()}`,
    "",
    "Metric,Value",
    `Tickets Avoided by AI,${report.ticketsAvoidedByAI}`,
    `Avg Handling Time (min),${report.avgHandlingTimeMinutes}`,
    `Human Hours Saved,${report.humanHoursSaved}`,
    `Estimated Cost Saved (USD),$${report.estimatedCostSavedUSD}`,
    `AI Cost (USD),$${report.aiCostUSD}`,
    `Net Savings (USD),$${report.netSavingsUSD}`,
    `ROI,${report.roiPercentage}%`,
    "",
    "Cost Comparison",
    `Cost per Human Ticket (USD),$${report.costPerHumanTicketUSD}`,
    `Cost per AI Resolution (USD),$${report.costPerAIResolutionUSD}`,
    "",
    "Volume Breakdown",
    `Pre-AI Ticket Volume (30-day baseline),${report.breakdown.preAITicketVolume}`,
    `Current Ticket Volume,${report.breakdown.currentTicketVolume}`,
    `AI Resolved Count,${report.breakdown.aiResolvedCount}`,
    `Escalated to Human Count,${report.breakdown.escalatedCount}`,
  ];

  return lines.join("\n");
}
