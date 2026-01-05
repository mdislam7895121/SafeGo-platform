import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
  id: text("id").primaryKey(),
  stripeEventId: text("stripeEventId").notNull().unique(),
  eventType: text("eventType").notNull(),
  status: text("status").notNull().default("processing"),
  errorMessage: text("errorMessage"),
  processedAt: timestamp("processedAt").defaultNow(),
}, (table) => [
  index("stripe_webhook_events_stripe_event_id_idx").on(table.stripeEventId),
  index("stripe_webhook_events_event_type_idx").on(table.eventType),
  index("stripe_webhook_events_processed_at_idx").on(table.processedAt),
]);
