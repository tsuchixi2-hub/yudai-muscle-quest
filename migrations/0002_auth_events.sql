CREATE TABLE IF NOT EXISTS auth_events (
  id TEXT PRIMARY KEY,
  stage TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_events_created ON auth_events(created_at);
