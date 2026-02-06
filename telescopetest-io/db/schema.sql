-- Telescope Web UI - D1 Database Schema

-- test - stores info for results cards: URL, test time (date), browser
CREATE TABLE IF NOT EXISTS tests (
  test_id TEXT PRIMARY KEY,
  zip_key TEXT UNIQUE NOT NULL, -- upload.ts: generated hash used as R2 storage key
  name TEXT, -- UI
  description TEXT, -- UI 
  source TEXT, -- upload.ts
  url TEXT NOT NULL,
  test_date INTEGER NOT NULL,
  browser TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()), -- for SQL entry
  updated_at INTEGER DEFAULT (unixepoch()) -- for SQL entry
);

CREATE INDEX IF NOT EXISTS idx_tests_created_at ON tests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tests_updated_at ON tests(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tests_file_key ON tests(zip_key);