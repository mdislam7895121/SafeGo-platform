-- Migration: Create stripe_webhook_events table for Drizzle ORM
-- This table is used for Stripe webhook event deduplication
-- NOTE: Column names use camelCase to match existing Prisma-created schema

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT PRIMARY KEY,
  "stripeEventId" TEXT NOT NULL UNIQUE,
  "eventType" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  "errorMessage" TEXT,
  "processedAt" TIMESTAMP DEFAULT NOW(),
  "createdAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_stripe_event_id_idx ON stripe_webhook_events("stripeEventId");
CREATE INDEX IF NOT EXISTS stripe_webhook_events_event_type_idx ON stripe_webhook_events("eventType");
CREATE INDEX IF NOT EXISTS stripe_webhook_events_processed_at_idx ON stripe_webhook_events("processedAt");
