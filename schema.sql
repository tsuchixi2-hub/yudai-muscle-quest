CREATE TABLE IF NOT EXISTS workout_logs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  part TEXT NOT NULL,
  exercise TEXT NOT NULL,
  weight REAL NOT NULL,
  reps INTEGER NOT NULL,
  sets INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workout_logs_date ON workout_logs(date, created_at);
CREATE INDEX IF NOT EXISTS idx_workout_logs_part ON workout_logs(part, date);

CREATE TABLE IF NOT EXISTS photo_records (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  memo TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT 'photo',
  image_data TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_photo_records_date ON photo_records(date, created_at);
