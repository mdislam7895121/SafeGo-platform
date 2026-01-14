import { prisma } from "../../lib/prisma";

export interface SafePilotFeatureFlags {
  customerSafePilotEnabled: boolean;
  rolloutPercentage: number;
  proactiveTriggersEnabled: boolean;
  autoFollowUpsEnabled: boolean;
  autoEscalationEnabled: boolean;
  adminReviewModeEnabled: boolean;
}

const DEFAULT_FLAGS: SafePilotFeatureFlags = {
  customerSafePilotEnabled: true,
  rolloutPercentage: 100,
  proactiveTriggersEnabled: true,
  autoFollowUpsEnabled: true,
  autoEscalationEnabled: true,
  adminReviewModeEnabled: false,
};

const FLAG_KEYS = [
  "safepilot_customer_enabled",
  "safepilot_rollout_percentage",
  "safepilot_proactive_triggers",
  "safepilot_auto_followups",
  "safepilot_auto_escalation",
  "safepilot_admin_review_mode",
] as const;

export async function getSafePilotFlags(): Promise<SafePilotFeatureFlags> {
  try {
    const flags = await prisma.featureFlag.findMany({
      where: { key: { in: [...FLAG_KEYS] } },
    }) as any[];

    const flagMap = new Map<string, any>(flags.map(f => [f.key, f]));

    const rolloutFlag = flagMap.get("safepilot_rollout_percentage") as any;
    const rolloutValue = rolloutFlag?.rolloutPercentage ?? DEFAULT_FLAGS.rolloutPercentage;

    return {
      customerSafePilotEnabled: flagMap.get("safepilot_customer_enabled")?.isEnabled ?? DEFAULT_FLAGS.customerSafePilotEnabled,
      rolloutPercentage: rolloutValue,
      proactiveTriggersEnabled: flagMap.get("safepilot_proactive_triggers")?.isEnabled ?? DEFAULT_FLAGS.proactiveTriggersEnabled,
      autoFollowUpsEnabled: flagMap.get("safepilot_auto_followups")?.isEnabled ?? DEFAULT_FLAGS.autoFollowUpsEnabled,
      autoEscalationEnabled: flagMap.get("safepilot_auto_escalation")?.isEnabled ?? DEFAULT_FLAGS.autoEscalationEnabled,
      adminReviewModeEnabled: flagMap.get("safepilot_admin_review_mode")?.isEnabled ?? DEFAULT_FLAGS.adminReviewModeEnabled,
    };
  } catch {
    return DEFAULT_FLAGS;
  }
}

export async function updateSafePilotFlag(
  key: string,
  enabled: boolean,
  rolloutPercentage?: number
): Promise<boolean> {
  try {
    await prisma.featureFlag.upsert({
      where: { key },
      update: { 
        isEnabled: enabled, 
        rolloutPercentage: rolloutPercentage ?? 100,
        updatedAt: new Date(),
      },
      create: {
        key,
        isEnabled: enabled,
        rolloutPercentage: rolloutPercentage ?? 100,
        description: `SafePilot feature flag: ${key}`,
      },
    });
    return true;
  } catch (error) {
    console.error("[SafePilot] Failed to update feature flag:", error);
    return false;
  }
}

export async function isUserInRollout(userId: string): Promise<boolean> {
  const flags = await getSafePilotFlags();
  
  if (!flags.customerSafePilotEnabled) {
    return false;
  }

  if (flags.rolloutPercentage >= 100) {
    return true;
  }

  if (flags.rolloutPercentage <= 0) {
    return false;
  }

  const hash = simpleHash(userId);
  const bucket = hash % 100;
  return bucket < flags.rolloutPercentage;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export async function isProactiveTriggersEnabled(): Promise<boolean> {
  const flags = await getSafePilotFlags();
  return flags.customerSafePilotEnabled && flags.proactiveTriggersEnabled;
}

export async function isAutoFollowUpsEnabled(): Promise<boolean> {
  const flags = await getSafePilotFlags();
  return flags.customerSafePilotEnabled && flags.autoFollowUpsEnabled;
}

export async function isAutoEscalationEnabled(): Promise<boolean> {
  const flags = await getSafePilotFlags();
  return flags.customerSafePilotEnabled && flags.autoEscalationEnabled;
}

export async function isAdminReviewModeEnabled(): Promise<boolean> {
  const flags = await getSafePilotFlags();
  return flags.adminReviewModeEnabled;
}

export async function initializeSafePilotFlags(): Promise<void> {
  const flagConfigs = [
    { key: "safepilot_customer_enabled", isEnabled: true, rolloutPercentage: 100, description: "Master switch for SafePilot customer features" },
    { key: "safepilot_rollout_percentage", isEnabled: true, rolloutPercentage: 100, description: "Percentage of customers with SafePilot enabled (0-100)" },
    { key: "safepilot_proactive_triggers", isEnabled: true, rolloutPercentage: 100, description: "Enable proactive help triggers" },
    { key: "safepilot_auto_followups", isEnabled: true, rolloutPercentage: 100, description: "Enable automatic follow-up messages" },
    { key: "safepilot_auto_escalation", isEnabled: true, rolloutPercentage: 100, description: "Enable automatic escalation to human support" },
    { key: "safepilot_admin_review_mode", isEnabled: false, rolloutPercentage: 100, description: "Enable admin review mode for sampling AI responses" },
  ];

  for (const config of flagConfigs) {
    await prisma.featureFlag.upsert({
      where: { key: config.key },
      update: {},
      create: config,
    });
  }
}

export interface SafePilotMonitoringEvent {
  userId: string;
  conversationId: string;
  eventType: "ai_resolved" | "escalated" | "follow_up_sent" | "proactive_trigger";
  emotion?: string;
  resolutionTimeMs?: number;
  metadata?: Record<string, unknown>;
}

export async function logMonitoringEvent(event: SafePilotMonitoringEvent): Promise<void> {
  try {
    await prisma.safePilotAuditLog.create({
      data: {
        actorUserId: event.userId,
        actorRole: "CUSTOMER",
        action: "ask",
        metadata: {
          type: "monitoring_event",
          eventType: event.eventType,
          conversationId: event.conversationId,
          emotion: event.emotion,
          resolutionTimeMs: event.resolutionTimeMs,
          ...event.metadata,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("[SafePilot] Failed to log monitoring event:", error);
  }
}
