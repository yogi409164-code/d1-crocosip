-- Migration number: 0006 	 2026-05-18T12:00:00.000Z

ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;
