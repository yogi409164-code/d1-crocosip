-- Migration number: 0006 	 2026-05-18T12:00:00.000Z

ALTER TABLE users ADD COLUMN google_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
