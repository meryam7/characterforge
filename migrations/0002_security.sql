-- Security upgrade: cookie sessions, MFA (TOTP + recovery codes), login challenges, security event log.

-- Server-side sessions. The cookie holds a random token; only its SHA-256 hash is stored.
CREATE TABLE sessions (
  id_hash    TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mfa        INTEGER NOT NULL DEFAULT 0,      -- 1 = second factor verified for this session
  expires_at INTEGER NOT NULL,                -- unix seconds (absolute)
  last_seen  INTEGER NOT NULL,                -- unix seconds (idle timeout)
  ip_hash    TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX ix_sessions_user ON sessions(user_id);

ALTER TABLE users ADD COLUMN mfa_secret TEXT;                       -- AES-GCM encrypted (MFA_ENCRYPTION_KEY)
ALTER TABLE users ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN mfa_last_step INTEGER NOT NULL DEFAULT 0; -- replay protection
ALTER TABLE users ADD COLUMN password_changed_at TEXT;

CREATE TABLE mfa_recovery_codes (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at   TEXT,
  PRIMARY KEY (user_id, code_hash)
);

-- Short-lived step between "password OK" and "MFA OK" (or MFA enrolment for admins).
CREATE TABLE auth_challenges (
  id_hash    TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,                   -- mfa_verify | mfa_enrol
  attempts   INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);

-- Security log. Never contains passwords, tokens, codes or secrets (see server/security-log.ts).
CREATE TABLE security_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         INTEGER NOT NULL,                -- unix seconds
  type       TEXT NOT NULL,
  severity   TEXT NOT NULL,                   -- info | warn | alert
  user_id    INTEGER,
  subject    TEXT,                            -- hashed email / rate-limit key, for correlation
  ip_hash    TEXT,
  path       TEXT,
  detail     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX ix_sec_ts ON security_events(ts);
CREATE INDEX ix_sec_type_ts ON security_events(type, ts);
CREATE INDEX ix_sec_subject ON security_events(subject, type, ts);
CREATE INDEX ix_sec_ip ON security_events(ip_hash, type, ts);
