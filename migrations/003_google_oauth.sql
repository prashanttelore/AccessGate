-- Migration 003: Google OAuth2 Schema
-- Makes password_hash nullable for OAuth-only users
-- Adds google_id column with unique constraint

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
