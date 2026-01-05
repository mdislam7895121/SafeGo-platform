import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as stripeWebhookEventsSchema from "./schema/stripeWebhookEvents";
import * as authRefreshTokensSchema from "./schema/authRefreshTokens";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const drizzleDb = drizzle(pool, {
  schema: {
    ...stripeWebhookEventsSchema,
    ...authRefreshTokensSchema,
  },
});

export { stripeWebhookEvents } from "./schema/stripeWebhookEvents";
export { authRefreshTokens } from "./schema/authRefreshTokens";
