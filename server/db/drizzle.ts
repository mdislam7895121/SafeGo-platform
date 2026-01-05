import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as stripeWebhookEventsSchema from "./schema/stripeWebhookEvents";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const drizzleDb = drizzle(pool, {
  schema: {
    ...stripeWebhookEventsSchema,
  },
});

export { stripeWebhookEvents } from "./schema/stripeWebhookEvents";
