-- Telescope Web UI - D1 Database Schema

-- Test results table - stores info for card: URL, test time (date), browser
-- not final screenshot
CREATE TABLE IF NOT EXISTS tests (
  test_id TEXT PRIMARY KEY,
  name TEXT, -- UI
  description TEXT, -- UI 
  source TEXT, -- derived
  url TEXT NOT NULL,
  test_date DATE NOT NULL,
  browser TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tests_created_at ON tests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tests_updated_at ON tests(updated_at DESC);