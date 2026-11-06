// Restore test: proves a backup can be brought back, in an isolated TEST database (never production).
//   BACKUP_PASSPHRASE=... node scripts/restore-test.mjs backups/<file>.cfbk [--target characterforge-restore-test]
// Steps: verify file hash → decrypt (wrong passphrase = authentication error) → reset the scratch database →
// import → compare row counts and the data fingerprint with the values recorded at backup time.
import { createDecipheriv, createHash, scryptSync } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { fingerprint, MAGIC, query, SCRYPT, splitLargeInserts, wrangler } from './backup.mjs'

const PROTECTED = new Set(['characterforge', 'characterforge-staging'])

function decrypt(box, passphrase) {
  if (!box.subarray(0, 5).equals(MAGIC)) throw new Error('Not a CharaForge backup file')
  const salt = box.subarray(5, 21)
  const iv = box.subarray(21, 33)
  const tag = box.subarray(33, 49)
  const key = scryptSync(passphrase, salt, 32, SCRYPT)
  const d = createDecipheriv('aes-256-gcm', key, iv)
  d.setAuthTag(tag)
  return gunzipSync(Buffer.concat([d.update(box.subarray(49)), d.final()]))
}

const args = process.argv.slice(2)
const file = args.find((a) => a.endsWith('.cfbk'))
const target = args.includes('--target') ? args[args.indexOf('--target') + 1] : 'characterforge-restore-test'
if (!file) {
  console.error('usage: node scripts/restore-test.mjs backups/<file>.cfbk [--target <scratch database>]')
  process.exit(1)
}
if (PROTECTED.has(target)) {
  console.error(`Refusing to restore into ${target}: the restore test only writes to a scratch database.`)
  process.exit(1)
}
const manifest = JSON.parse(fs.readFileSync(`${file}.json`, 'utf8'))
const box = fs.readFileSync(file)
const ok = (cond, label) => console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`) || cond
let good = true

good &&= ok(createHash('sha256').update(box).digest('hex') === manifest.sha256, 'backup file hash matches manifest (not tampered)')
let wrongRejected = false
try {
  decrypt(box, 'definitely-not-the-passphrase')
} catch {
  wrongRejected = true
}
good &&= ok(wrongRejected, 'wrong passphrase cannot decrypt the backup')
const sql = decrypt(box, process.env.BACKUP_PASSPHRASE ?? '')
good &&= ok(sql.length === manifest.sql_bytes, `decrypted ${sql.length} bytes of SQL`)

// scratch database: create if missing, otherwise drop its tables
const dbs = JSON.parse(wrangler(['d1', 'list', '--json']))
if (!dbs.some((d) => d.name === target)) {
  console.log(`creating scratch database ${target}...`)
  wrangler(['d1', 'create', target])
} else {
  const existing = query(target, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'")
  if (existing.length) {
    console.log(`resetting scratch database ${target} (${existing.length} tables)...`)
    const drop = ['PRAGMA defer_foreign_keys = true;', ...existing.map((t) => `DROP TABLE IF EXISTS "${t.name}";`)].join('\n')
    const dropFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cfrs-')), 'drop.sql')
    fs.writeFileSync(dropFile, drop)
    wrangler(['d1', 'execute', target, '--remote', '--yes', '--file', dropFile])
    fs.rmSync(path.dirname(dropFile), { recursive: true, force: true })
  }
}

const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cfrs-')), 'restore.sql')
try {
  const prepared = splitLargeInserts(sql.toString('utf8'))
  console.log(`${prepared.split} large image rows split into chunks (D1 100 KB statement limit)`)
  fs.writeFileSync(tmp, prepared.sql, { mode: 0o600 })
  console.log(`importing into ${target}...`)
  wrangler(['d1', 'execute', target, '--remote', '--yes', '--file', tmp])
} finally {
  fs.rmSync(path.dirname(tmp), { recursive: true, force: true })
}

const after = fingerprint(target)
for (const t of Object.keys(manifest.source.counts)) good &&= ok(after.counts[t] === manifest.source.counts[t], `${t}: ${after.counts[t]} rows (expected ${manifest.source.counts[t]})`)
good &&= ok(after.file_bytes === manifest.source.file_bytes, `image bytes restored: ${after.file_bytes}`)
good &&= ok(after.digest === manifest.source.digest, 'data fingerprint identical (users, designs, image keys)')
const orphans = query(target, 'SELECT (SELECT COUNT(*) FROM designs WHERE character_id NOT IN (SELECT id FROM characters)) AS designs, (SELECT COUNT(*) FROM characters WHERE user_id NOT IN (SELECT id FROM users)) AS characters')[0]
good &&= ok(orphans.designs === 0 && orphans.characters === 0, 'referential integrity intact')

console.log(good ? `\nRESTORE TEST PASSED: ${path.basename(file)} restored into ${target}` : '\nRESTORE TEST FAILED')
process.exit(good ? 0 : 1)
