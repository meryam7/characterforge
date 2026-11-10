-- Email ownership verification (6-digit code sent by email) + password reset by email code.

ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
-- accounts created before verification existed (only test accounts at the time) keep working
UPDATE users SET email_verified = 1;

-- One-time email codes. Only a hash is stored; codes expire after 15 minutes and allow 5 attempts.
CREATE TABLE email_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT NOT NULL,                 -- verify | reset
  code_hash  TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,              -- unix seconds
  created_at INTEGER NOT NULL               -- unix seconds (resend cooldown)
);
CREATE INDEX ix_email_codes_user ON email_codes(user_id, purpose, id);

-- Test inbox: in staging/development only, codes for @example.com addresses (which cannot receive mail) are stored
-- here so automated tests can read them. Never written in production (server/email.ts).
CREATE TABLE test_inbox (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL,
  purpose    TEXT NOT NULL,
  code       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX ix_test_inbox_email ON test_inbox(email, id);
