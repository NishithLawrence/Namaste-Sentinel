-- NAMASTE Sentinel — Supabase PostgreSQL Database Migration Script

CREATE TABLE IF NOT EXISTS telemetry (
  id SERIAL PRIMARY KEY,
  timestamp TEXT NOT NULL,
  site_id TEXT NOT NULL,
  h2s REAL NOT NULL,
  ch4 REAL NOT NULL,
  o2 REAL NOT NULL,
  temperature REAL NOT NULL,
  humidity REAL NOT NULL,
  anomaly_score REAL,
  risk_score REAL,
  rule_state TEXT,
  final_decision TEXT,
  reason TEXT,
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS telemetry_logs (
  id SERIAL PRIMARY KEY,
  timestamp TEXT NOT NULL,
  h2s REAL NOT NULL,
  ch4 REAL NOT NULL,
  o2 REAL NOT NULL,
  temperature REAL NOT NULL,
  humidity REAL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  timestamp TEXT NOT NULL,
  site_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  acknowledged INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast site telemetry & status queries
CREATE INDEX IF NOT EXISTS idx_telemetry_site_id ON telemetry(site_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_logs_timestamp ON telemetry_logs(id DESC);
CREATE INDEX IF NOT EXISTS idx_events_site_id ON events(site_id, id DESC);
