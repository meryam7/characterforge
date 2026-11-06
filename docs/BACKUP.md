# Backups and restore

Two independent layers:

| Layer | What | Retention | How to restore |
|---|---|---|---|
| **D1 Time Travel** (built in) | point-in-time history of the production DB | 7 days (free) / 30 days (paid) | `npx wrangler d1 time-travel restore characterforge --timestamp=<ISO time>` |
| **Encrypted exports** (ours) | full SQL dump incl. images, gzip + AES-256-GCM | GitHub artifacts 30 days (daily) + any copies you keep | decrypt + import (below) |

Backup passphrase: on this PC it's in `C:\Users\boual\.charaforge-backup-passphrase.txt` (outside the repo).
**Copy it into a password manager and set it as the GitHub secret `BACKUP_PASSPHRASE`.** Without it, backups can't be decrypted. That's the point of the encryption.

## Make a backup
```powershell
$env:BACKUP_PASSPHRASE = Get-Content $HOME\.charaforge-backup-passphrase.txt
npm run backup -- characterforge            # production   → backups/characterforge-<UTC>.cfbk + .json manifest
npm run backup -- characterforge-staging    # staging
```
The manifest stores row counts and a data fingerprint, plus the SHA-256 of the encrypted file (tamper check).
`backups/` is git-ignored. Store copies somewhere off this PC (encrypted already, so cloud storage is fine).
Automatic: `.github/workflows/backup.yml` runs daily at 03:17 UTC and uploads the encrypted file as a private artifact.

## Restore test (run regularly; the workflow does it weekly)
```powershell
npm run restore:test -- backups/characterforge-<UTC>.cfbk
```
It verifies the file hash and checks that a wrong passphrase is rejected. Then it decrypts, wipes and imports into the
**scratch database `characterforge-restore-test`** (it refuses to touch `characterforge` or `characterforge-staging`),
and compares every table's row count, the total image bytes, the data fingerprint and referential integrity.
Verified on 2026-11-06 with the staging backup (5 users, 9 designs, 18 images / 430,628 bytes): all checks passed.

Why the restore script rewrites some statements: D1 rejects SQL statements over about 100 KB, but `wrangler d1 export`
writes each image as one INSERT with an inline hex literal. `splitLargeInserts()` turns those into an INSERT with an
empty BLOB plus `UPDATE ... data || X'chunk'` statements. Without this, a plain import fails with `SQLITE_TOOBIG`.

## Real disaster recovery (production)
1. Quickest, if within the Time Travel window: `npx wrangler d1 time-travel restore characterforge --timestamp=...`
2. Otherwise restore an encrypted export into a **new** database and switch the app to it:
   - `npm run restore:test -- backups/<file>.cfbk --target characterforge-recovered` (creates, imports and verifies)
   - in `wrangler.toml` `[env.production]`, set `database_name`/`database_id` to the recovered database
   - deploy with the normal production procedure (`docs/DEPLOY.md`), then run `npm run smoke` against production
   This never overwrites the damaged database, so you can still compare or investigate it.

Pre-security-migration bookmark of production (2026-11-06): `00000014-00000000-0000511b-8039a7c659ab1e6ebff787236869d48f`.
