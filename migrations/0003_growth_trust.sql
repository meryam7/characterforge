-- Growth (likes, remix lineage) + trust (content reports, terms acceptance). Additive only.

-- Likes on community designs. like_count is denormalised for the "Popular" sort.
CREATE TABLE likes (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  design_id  INTEGER NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (user_id, design_id)
);
CREATE INDEX ix_likes_design ON likes(design_id);
ALTER TABLE designs ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX ix_designs_popular ON designs(is_public, like_count, id);

-- "Start from this": a character created from a community design remembers where it came from.
ALTER TABLE characters ADD COLUMN remixed_from INTEGER; -- designs.id (no FK: the source may be deleted later)

-- Content reports on community designs (one per user and design).
CREATE TABLE reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  design_id   INTEGER NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,                 -- see server/routes/gallery.ts REPORT_REASONS
  note        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'open',  -- open | dismissed | removed
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  resolved_at TEXT,
  UNIQUE (design_id, reporter_id)
);
CREATE INDEX ix_reports_status ON reports(status, design_id);

-- Terms of Use / Privacy Policy acceptance (version string of the accepted documents).
ALTER TABLE users ADD COLUMN terms_version TEXT;
ALTER TABLE users ADD COLUMN terms_accepted_at TEXT;
