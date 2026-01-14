import { drizzleDb, stripeWebhookEvents } from "../db/drizzle";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface WebhookDedupResult {
  isDuplicate: boolean;
  eventId?: string;
}

export async function recordStripeEventOnce(
  stripeEventId: string,
  eventType: string
): Promise<WebhookDedupResult> {
  try {
    const id = randomUUID();
    const [inserted] = await drizzleDb
      .insert(stripeWebhookEvents)
      .values({
        id,
        stripeEventId,
        eventType,
        status: "processing",
      } as any)
      .returning({ id: stripeWebhookEvents.id });

    if (process.env.NODE_ENV === "development") {
      console.log(`[WebhookDedupe] New event recorded: ${stripeEventId} (${eventType})`);
    }

    return { isDuplicate: false, eventId: inserted.id };
  } catch (error: any) {
    if (error?.code === "23505") {
      if (process.env.NODE_ENV === "development") {
        console.log(`[WebhookDedupe] Duplicate event detected: ${stripeEventId} (${eventType})`);
      }
      return { isDuplicate: true };
    }
    throw error;
  }
}

export async function markEventProcessed(
  eventId: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    await drizzleDb
      .update(stripeWebhookEvents)
      .set({
        status: success ? "processed" : "failed",
        errorMessage: errorMessage || null,
        processedAt: new Date(),
      } as any)
      .where(eq(stripeWebhookEvents.id, eventId));
  } catch (error) {
    console.error(`[WebhookDedupe] Failed to update event status: ${eventId}`, error);
  }
}

export async function getRecentEvents(limit: number = 100) {
  return drizzleDb
    .select({
      id: stripeWebhookEvents.id,
      stripeEventId: stripeWebhookEvents.stripeEventId,
      eventType: stripeWebhookEvents.eventType,
      status: stripeWebhookEvents.status,
      processedAt: stripeWebhookEvents.processedAt,
    })
    .from(stripeWebhookEvents)
    .orderBy(stripeWebhookEvents.processedAt)
    .limit(limit);
}
