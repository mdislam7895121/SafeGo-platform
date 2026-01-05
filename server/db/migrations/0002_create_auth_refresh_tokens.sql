-- Migration: Create auth_refresh_tokens table for secure refresh token rotation
-- Implements refresh token rotation with reuse detection and global revocation

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  replaced_by_token_id UUID,
  device_id TEXT,
  ip TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS auth_refresh_tokens_user_id_idx ON auth_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS auth_refresh_tokens_token_hash_idx ON auth_refresh_tokens(token_hash);
