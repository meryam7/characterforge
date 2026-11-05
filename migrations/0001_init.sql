-- CharacterForge schema (Cloudflare D1 / SQLite).
-- Apply: npm run db:migrate:local  |  npm run db:migrate:remote
-- Timestamps are ISO-8601 UTC strings ending in "Z".

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE characters (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  style         TEXT NOT NULL DEFAULT 'anime',
  seed          INTEGER NOT NULL,            -- identity seed reused by every generation
  reference_key TEXT,                        -- files.key of the uploaded reference
  embedding     TEXT,                        -- JSON number[]: identity vector (colour histogram)
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX ix_characters_user ON characters(user_id);

CREATE TABLE designs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  parent_id    INTEGER,                      -- source design of an edit
  kind         TEXT NOT NULL,                -- generate | edit
  source       TEXT NOT NULL DEFAULT 'mock', -- ai | mock
  prompt       TEXT NOT NULL DEFAULT '',
  image_key    TEXT NOT NULL,
  consistency  REAL,
  is_public    INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX ix_designs_character ON designs(character_id);
CREATE INDEX ix_designs_public ON designs(is_public, id);

-- History. No foreign keys on purpose: entries survive deleting the character.
CREATE TABLE activities (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL,
  action         TEXT NOT NULL,
  character_id   INTEGER,
  character_name TEXT NOT NULL DEFAULT '',
  design_id      INTEGER,
  detail         TEXT NOT NULL DEFAULT '',
  thumb_key      TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX ix_activities_user ON activities(user_id, id);

-- Images live in D1 (R2 not enabled on the account). Keys: d/ designs, r/ references, t/ history thumbnails.
CREATE TABLE files (
  key          TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  data         BLOB NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX ix_files_user ON files(user_id);

CREATE TABLE rate_limits (
  key          TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);

CREATE TABLE ai_usage (
  user_id INTEGER NOT NULL,
  day     TEXT NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
