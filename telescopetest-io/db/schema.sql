-- Telescope Web UI - D1 Database Schema
-- This schema stores test results metadata

-- Test results table - stores metadata about each test run
CREATE TABLE IF NOT EXISTS tests (
  test_id TEXT PRIMARY KEY,
  name TEXT,  -- **optional from UI? 
  description TEXT, --**optional from UI as well? added 
  source TEXT, -- basic, advanced, upload, api, cli
  owner TEXT, -- user id or email?
  cli_command TEXT,
  url TEXT NOT NULL,
  browser TEXT NOT NULL,
  -- all the cli options for the test, these would be overrides of the default options
  device TEXT,  -- **where is this from ? -> Joe B.'s PR ? 
  headers TEXT,
  cookies TEXT,
  flags TEXT,
  block_domains TEXT,
  block TEXT,
  firefox_prefs TEXT,
  cpu_throttle REAL,
  connection_type TEXT,
  width INTEGER,
  height INTEGER,
  frame_rate INTEGER,
  disable_js BOOLEAN,
  debug BOOLEAN,
  auth TEXT,  -- **change to boolean -> or just slug like username;password
  timeout INTEGER,
  status INTEGER NOT NULL DEFAULT 0, -- 0: pending, 1: running, 2: completed, 3: aborted, 4: failed
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_tests_status ON tests(status DESC);
CREATE INDEX IF NOT EXISTS idx_tests_owner ON tests(owner);
CREATE INDEX IF NOT EXISTS idx_tests_created_at ON tests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tests_updated_at ON tests(updated_at DESC);