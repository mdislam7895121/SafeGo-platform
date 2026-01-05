import { pgTable, text, timestamp, index, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const authRefreshTokens = pgTable("auth_refresh_tokens", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  replacedByTokenId: uuid("replaced_by_token_id"),
  deviceId: text("device_id"),
  ip: text("ip"),
  userAgent: text("user_agent"),
}, (table) => [
  index("auth_refresh_tokens_user_id_idx").on(table.userId),
  index("auth_refresh_tokens_token_hash_idx").on(table.tokenHash),
]);
