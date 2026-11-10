// Translation check:  node scripts/check-i18n.mjs [--list]
// Collects every UI string passed to t(...) (plus labels kept in constant tables) and fails if French is missing.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'src')
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : [])

const unq = (s) => s.replace(/\\'/g, "'").replace(/\\"/g, '"')
const keys = new Set()
for (const file of walk(root)) {
  if (/i18n\.fr\.ts$|legal\.ts$/.test(file)) continue
  const src = fs.readFileSync(file, 'utf8')
  for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) keys.add(unq(m[1]))
  for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(unq(m[1]))
  // labels stored in constant tables and translated later with t(variable)
  for (const m of src.matchAll(/\b(?:label|title|text): '((?:[^'\\]|\\.)*)'/g)) keys.add(unq(m[1]))
  for (const m of src.matchAll(/^\s+[\w']+: "((?:[^"\\]|\\.)*)",?$/gm)) keys.add(unq(m[1]))
  for (const m of src.matchAll(/^\s+[\w']+: '([A-Z](?:[^'\\]|\\.)*)',?$/gm)) keys.add(unq(m[1]))
  for (const m of src.matchAll(/const (?:IDEAS|STYLES) = \[([^\]]+)\]/g)) for (const s of m[1].matchAll(/'([^']+)'/g)) keys.add(s[1])
}

const { fr } = await import(new URL('../frontend/src/lib/i18n.fr.ts', import.meta.url))
const missing = [...keys].filter((k) => !(k in fr)).sort()
if (process.argv.includes('--list')) console.log([...keys].sort().join('\n'))
for (const k of missing) console.log(`MISSING fr: ${JSON.stringify(k)}`)
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
const badVars = Object.entries(fr).filter(([en, f]) => placeholders(en) !== placeholders(f))
for (const [en] of badVars) console.log(`PLACEHOLDER mismatch: ${JSON.stringify(en)}`)
console.log(missing.length || badVars.length ? `\n${missing.length} missing, ${badVars.length} placeholder problems` : `i18n ok: ${keys.size} strings translated`)
process.exit(missing.length || badVars.length ? 1 : 0)
