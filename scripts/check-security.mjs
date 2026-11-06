// Static security checks (run in CI and before deploys):  node scripts/check-security.mjs
// 1. SQL: every `${...}` inside a prepare(`...`) template must be a known-safe construct (placeholder lists or
//    constant clause builders), never user input -> parameterized queries only.
// 2. Frontend bundle (frontend/dist): must not contain secrets, secret names or server-only code.
// 3. Frontend source: no dangerouslySetInnerHTML / innerHTML / eval / new Function (XSS sinks).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let problems = 0
let scanned = 0
const report = (file, msg) => {
  problems++
  console.log(`FAIL ${path.relative(root, file)}: ${msg}`)
}
const walk = (dir, exts) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name), exts) : exts.some((x) => e.name.endsWith(x)) ? [path.join(dir, e.name)] : [])
    : []

// ---- 1. SQL interpolation whitelist
const SAFE_INTERPOLATIONS = [
  /^\w+\.map\(\(\) => '\?'\)\.join\(','\)$/, // placeholder lists: ids.map(() => '?').join(',')
  /^ks\.map\(\(\) => '\?'\)\.join\(','\)$/,
  /^where\.join\(' AND '\)$/, // clauses built from constant strings only
  /^where\.length \? `WHERE \$\{where\.join\(' AND '\)\}` : ''$/,
  /^before !== null \? 'AND d\.id < \?' : ''$/,
  /^rule\.by$/, // column name from the constant RULES table ('subject' | 'ip_hash')
]
for (const file of walk(path.join(root, 'server'), ['.ts'])) {
  scanned++
  const src = fs.readFileSync(file, 'utf8')
  const re = /prepare\(\s*`([\s\S]*?)`\s*,?\s*\)/g
  let m
  while ((m = re.exec(src))) {
    for (const [, expr] of m[1].matchAll(/\$\{((?:[^{}]|\{[^{}]*\})*)\}/g)) {
      if (!SAFE_INTERPOLATIONS.some((ok) => ok.test(expr.trim()))) report(file, `SQL template interpolates "${expr.trim()}" - use a bound parameter (?)`)
    }
  }
  if (/prepare\(\s*['"][^'"]*['"]\s*\+/.test(src)) report(file, 'SQL built with string concatenation')
}

// ---- 2. bundle must not leak secrets
const SECRET_PATTERNS = [
  [/MFA_ENCRYPTION_KEY|LOG_HASH_SALT|ALERT_WEBHOOK_URL|CLOUDFLARE_API_TOKEN/, 'secret variable name'],
  [/cfat_[A-Za-z0-9]{20,}/, 'Cloudflare API token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/https:\/\/(discord(app)?\.com\/api\/webhooks|hooks\.slack\.com)\//, 'webhook URL'],
  [/password_hash|mfa_secret|security_events/, 'server-only database field'],
]
const dist = path.join(root, 'frontend', 'dist')
if (!fs.existsSync(dist)) console.log('note: frontend/dist missing - run npm run build first to scan the bundle')
for (const file of walk(dist, ['.js', '.html', '.css', '.json', '.txt'])) {
  const src = fs.readFileSync(file, 'utf8')
  for (const [re, what] of SECRET_PATTERNS) if (re.test(src)) report(file, `bundle contains ${what}`)
}

// ---- 3. XSS sinks in frontend source
for (const file of walk(path.join(root, 'frontend', 'src'), ['.ts', '.tsx'])) {
  const src = fs.readFileSync(file, 'utf8')
  for (const [re, what] of [
    [/dangerouslySetInnerHTML/, 'dangerouslySetInnerHTML'],
    [/\.innerHTML\s*=/, 'innerHTML assignment'],
    [/\beval\s*\(/, 'eval()'],
    [/new Function\s*\(/, 'new Function()'],
    [/localStorage\.setItem\([^)]*token/i, 'token stored in localStorage'],
  ]) if (re.test(src)) report(file, `XSS-prone construct: ${what}`)
}

if (scanned < 5) report(root, `only ${scanned} server files scanned - wrong path?`)
console.log(problems ? `\n${problems} security check(s) FAILED` : 'security checks passed (SQL parameterized, bundle clean, no XSS sinks)')
process.exit(problems ? 1 : 0)
