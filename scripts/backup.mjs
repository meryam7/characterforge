// Encrypted D1 backup.
//   BACKUP_PASSPHRASE=... node scripts/backup.mjs [database] [--env production|preview]
// 1. records per-table row counts + a content fingerprint (for the restore test)
// 2. `wrangler d1 export --remote` (schema + data, incl. image BLOBs)
// 3. gzip + AES-256-GCM (key = scrypt(passphrase)), writes backups/<db>-<UTC timestamp>.cfbk + manifest .json
// The plaintext export only exists for a moment in the OS temp folder and is deleted.
// Needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (or `wrangler login`).
import { execFileSync } from 'node:child_process'
import { createCipheriv, createHash, randomBytes, scryptSync } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

/** All user tables of the database (schema differs between versions, so read it from sqlite_master). */
export const tables = (db, extra = []) =>
  query(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name", extra).map((r) => r.name)
export const MAGIC = Buffer.from('CFBK1')
export const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

const WRANGLER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', 'wrangler', 'bin', 'wrangler.js')
/** Runs wrangler without a shell, so SQL arguments are passed through untouched. */
export function wrangler(args, opts = {}) {
  return execFileSync(process.execPath, [WRANGLER, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024, ...opts })
}

export function query(db, sql, extra = []) {
  const out = wrangler(['d1', 'execute', db, '--remote', '--json', '--command', sql, ...extra])
  return JSON.parse(out.slice(out.indexOf('[')))[0].results
}

/** Row counts + fingerprint of the data that matters (users, characters, designs, image bytes). */
export function fingerprint(db, extra = []) {
  const counts = {}
  for (const t of tables(db, extra)) counts[t] = query(db, `SELECT COUNT(*) AS n FROM "${t}"`, extra)[0].n
  const f = query(db, 'SELECT COALESCE(SUM(LENGTH(data)), 0) AS bytes, COALESCE(GROUP_CONCAT(key), \'\') AS keys FROM (SELECT key, data FROM files ORDER BY key)', extra)[0]
  const u = query(db, "SELECT COALESCE(GROUP_CONCAT(id || ':' || email || ':' || password_hash), '') AS v FROM (SELECT * FROM users ORDER BY id)", extra)[0]
  const d = query(db, "SELECT COALESCE(GROUP_CONCAT(id || ':' || character_id || ':' || image_key), '') AS v FROM (SELECT * FROM designs ORDER BY id)", extra)[0]
  const hash = createHash('sha256').update(`${f.keys}|${f.bytes}|${u.v}|${d.v}`).digest('hex')
  return { counts, file_bytes: f.bytes, digest: hash }
}

/** D1 rejects statements over ~100 KB, but `d1 export` writes each image as one INSERT with an inline X'..' literal.
 * Rewrite oversized image INSERTs into an INSERT with an empty BLOB + UPDATEs appending <=40 KB chunks. */
export function splitLargeInserts(sql, maxLen = 90_000, chunkHex = 80_000) {
  const re = /^INSERT INTO "files" \("key","user_id","content_type","data","created_at"\) VALUES\('([drt]\/[a-f0-9]{32}\.(?:webp|png|jpg))',(\d+),'([a-z/]+)',X'([0-9a-fA-F]*)','([0-9TZ:-]+)'\);$/
  let split = 0
  const out = sql.split('\n').map((line) => {
    if (line.length <= maxLen) return line
    const m = re.exec(line)
    if (!m) throw new Error(`Statement of ${line.length} chars cannot be restored: ${line.slice(0, 80)}`)
    const [, key, uid, type, hex, created] = m
    split++
    const parts = [`INSERT INTO "files" ("key","user_id","content_type","data","created_at") VALUES('${key}',${uid},'${type}',X'','${created}');`]
    for (let i = 0; i < hex.length; i += chunkHex) {
      parts.push(`UPDATE "files" SET "data" = CAST("data" || X'${hex.slice(i, i + chunkHex)}' AS BLOB) WHERE "key" = '${key}';`)
    }
    return parts.join('\n')
  })
  return { sql: out.join('\n'), split }
}

export function encrypt(plain, passphrase) {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = scryptSync(passphrase, salt, 32, SCRYPT)
  const c = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([c.update(gzipSync(plain, { level: 9 })), c.final()])
  return Buffer.concat([MAGIC, salt, iv, c.getAuthTag(), ct])
}

async function main() {
  const args = process.argv.slice(2)
  const db = args.find((a) => !a.startsWith('--')) ?? 'characterforge'
  const envFlag = args.includes('--env') ? ['--env', args[args.indexOf('--env') + 1]] : []
  const pass = process.env.BACKUP_PASSPHRASE ?? ''
  if (pass.length < 16) {
    console.error('Set BACKUP_PASSPHRASE (16+ characters, keep it in a password manager - without it backups cannot be restored).')
    process.exit(1)
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cfbk-')), 'export.sql')
  try {
    console.log(`fingerprinting ${db}...`)
    const before = fingerprint(db, envFlag)
    console.log(`exporting ${db} (remote)...`)
    wrangler(['d1', 'export', db, '--remote', '--output', tmp, ...envFlag])
    const sql = fs.readFileSync(tmp)
    const box = encrypt(sql, pass)
    const dir = path.resolve('backups')
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `${db}-${stamp}.cfbk`)
    fs.writeFileSync(file, box, { mode: 0o600 })
    const manifest = {
      database: db, created_at: new Date().toISOString(), format: 'CFBK1 = magic|salt16|iv12|tag16|AES-256-GCM(gzip(sql))',
      sql_bytes: sql.length, encrypted_bytes: box.length, sha256: createHash('sha256').update(box).digest('hex'), source: before,
    }
    fs.writeFileSync(`${file}.json`, JSON.stringify(manifest, null, 2))
    console.log(`backup written: ${path.relative(process.cwd(), file)} (${box.length} bytes, encrypted)`)
    console.log(`rows: ${JSON.stringify(before.counts)}`)
  } finally {
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true })
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
