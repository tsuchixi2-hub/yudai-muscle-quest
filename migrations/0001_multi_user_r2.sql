CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  line_user_id TEXT UNIQUE,
  demo_key TEXT UNIQUE,
  display_name TEXT NOT NULL,
  public_name TEXT NOT NULL,
  picture_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_public_name ON users(public_name);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

INSERT OR IGNORE INTO users (id, line_user_id, demo_key, display_name, public_name, picture_url, created_at, updated_at)
VALUES ('user-yudai', NULL, 'demo:yudai', '優大', '優大', '', datetime('now'), datetime('now'));

ALTER TABLE workout_logs ADD COLUMN user_id TEXT NOT NULL DEFAULT 'user-yudai';
ALTER TABLE photo_records ADD COLUMN user_id TEXT NOT NULL DEFAULT 'user-yudai';
ALTER TABLE photo_records ADD COLUMN object_key TEXT;
ALTER TABLE photo_records ADD COLUMN content_type TEXT NOT NULL DEFAULT 'image/jpeg';
ALTER TABLE photo_records ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date ON workout_logs(user_id, date, created_at);
CREATE INDEX IF NOT EXISTS idx_photo_records_user_date ON photo_records(user_id, date, created_at);
CREATE INDEX IF NOT EXISTS idx_photo_records_public_date ON photo_records(is_public, date);
