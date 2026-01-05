-- Migration: Create stripe_webhook_events table for Drizzle ORM
-- This table is used for Stripe webhook event deduplication

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  error_message TEXT,
  processed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_stripe_event_id_idx ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS stripe_webhook_events_event_type_idx ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS stripe_webhook_events_processed_at_idx ON stripe_webhook_events(processed_at);
