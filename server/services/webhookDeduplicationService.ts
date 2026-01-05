import { prisma } from "../db";

export interface WebhookDeduplicationResult {
  isDuplicate: boolean;
  eventId?: string;
}

export async function checkAndRecordWebhookEvent(
  stripeEventId: string,
  eventType: string
): Promise<WebhookDeduplicationResult> {
  try {
    const existing = await prisma.stripeWebhookEvent.findUnique({
      where: { stripeEventId },
      select: { id: true, status: true },
    });

    if (existing) {
      console.log(`[WebhookDedupe] Duplicate event detected: ${stripeEventId} (${eventType})`);
      return { isDuplicate: true, eventId: existing.id };
    }

    const created = await prisma.stripeWebhookEvent.create({
      data: {
        stripeEventId,
        eventType,
        status: "processing",
      },
    });

    return { isDuplicate: false, eventId: created.id };
  } catch (error: any) {
    if (error?.code === "P2002") {
      console.log(`[WebhookDedupe] Concurrent duplicate detected: ${stripeEventId}`);
      return { isDuplicate: true };
    }
    throw error;
  }
}

export async function markWebhookEventProcessed(
  eventId: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    await prisma.stripeWebhookEvent.update({
      where: { id: eventId },
      data: {
        status: success ? "processed" : "failed",
        errorMessage: errorMessage || null,
        processedAt: new Date(),
      },
    });
  } catch (error) {
    console.error(`[WebhookDedupe] Failed to update event status: ${eventId}`, error);
  }
}

export async function getRecentWebhookEvents(
  limit: number = 100
): Promise<Array<{
  id: string;
  stripeEventId: string;
  eventType: string;
  status: string;
  processedAt: Date;
}>> {
  return prisma.stripeWebhookEvent.findMany({
    select: {
      id: true,
      stripeEventId: true,
      eventType: true,
      status: true,
      processedAt: true,
    },
    orderBy: { processedAt: "desc" },
    take: limit,
  });
}

export async function cleanupOldWebhookEvents(olderThanDays: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await prisma.stripeWebhookEvent.deleteMany({
    where: {
      processedAt: { lt: cutoffDate },
      status: "processed",
    },
  });

  console.log(`[WebhookDedupe] Cleaned up ${result.count} old webhook events`);
  return result.count;
}
