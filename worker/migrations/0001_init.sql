-- Multiplayer lobby + scoreboard for CASHFLOW Companion.
-- Mirrors the old Supabase schema, plus a per-player secret so only the
-- device that joined can update or remove its own row.

CREATE TABLE IF NOT EXISTS games (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  host_name   TEXT,
  status      TEXT NOT NULL DEFAULT 'lobby',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS players (
  id              TEXT PRIMARY KEY,
  game_id         TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  client_id       TEXT NOT NULL,
  secret          TEXT NOT NULL,
  name            TEXT NOT NULL,
  profession      TEXT NOT NULL DEFAULT '',
  cash            REAL NOT NULL DEFAULT 0,
  passive_income  REAL NOT NULL DEFAULT 0,
  total_expenses  REAL NOT NULL DEFAULT 0,
  progress_pct    REAL NOT NULL DEFAULT 0,
  track           TEXT NOT NULL DEFAULT 'rat',
  out_of_rat_race INTEGER NOT NULL DEFAULT 0,
  won             INTEGER NOT NULL DEFAULT 0,
  ft_gain         REAL NOT NULL DEFAULT 0,
  last_action     TEXT NOT NULL DEFAULT '',
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS players_code_idx ON players(code);
CREATE INDEX IF NOT EXISTS players_game_idx ON players(game_id);
