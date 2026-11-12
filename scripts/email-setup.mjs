// Turns on real verification emails (Brevo) everywhere in one go:  npm run email:setup
//   1. asks for the Brevo API key (+ sender address), checks the key and that the sender is verified in Brevo
//   2. sends you a test email
//   3. stores the key as a Cloudflare Pages secret for staging (preview) and production, and in .dev.vars (local)
//   4. writes the sender into wrangler.toml and redeploys staging
// The key is never printed, logged or committed. Cloudflare auth: `npx wrangler login` or CLOUDFLARE_API_TOKEN.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WRANGLER = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const PROJECT = 'characterforge'
const ok = (m) => console.log(`\x1b[32m✔\x1b[0m ${m}`)
const die = (m) => { console.error(`\x1b[31m✘ ${m}\x1b[0m`); process.exit(1) }

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const current = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8').match(/EMAIL_FROM = "CharaForge <([^>]+)>"/)?.[1]
const senderIn = (await rl.question(`Sender address verified in Brevo [${current}]: `)).trim() || current
const key = (process.env.BREVO_API_KEY || (await rl.question('Brevo API key (xkeysib-...): '))).trim()
rl.close()
if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(senderIn)) die('That sender address does not look valid.')
if (!/^xkeysib-[A-Za-z0-9-]{20,}$/.test(key)) die('That does not look like a Brevo API key (it starts with "xkeysib-"). SMTP keys (xsmtpsib-) do not work here.')
const sender = senderIn.toLowerCase()

const brevo = (p, init = {}) =>
  fetch(`https://api.brevo.com/v3${p}`, { ...init, headers: { 'api-key': key, accept: 'application/json', 'content-type': 'application/json' } })

// 1. key + sender
const acc = await brevo('/account')
if (acc.status === 401) die('Brevo refused the key (401). Create a new API key in Brevo → SMTP & API → API keys.')
if (!acc.ok) die(`Brevo answered ${acc.status} for the account check.`)
ok(`Brevo key works (account ${(await acc.json()).email ?? ''})`)
const senders = await brevo('/senders')
if (senders.ok) {
  const list = (await senders.json()).senders ?? []
  const s = list.find((x) => x.email?.toLowerCase() === sender)
  if (!s) die(`"${sender}" is not a sender in Brevo. Add it in Brevo → Senders, Domains & Dedicated IPs → Senders, confirm it, then rerun.`)
  if (s.active === false) die(`"${sender}" is not confirmed yet in Brevo: click the link Brevo emailed to it, then rerun.`)
  ok(`sender ${sender} is verified`)
}

// 2. test email
const test = await brevo('/smtp/email', {
  method: 'POST',
  body: JSON.stringify({
    sender: { name: 'CharaForge', email: sender }, to: [{ email: sender }],
    subject: 'CharaForge: emails are working', textContent: 'Real verification emails are now turned on for CharaForge. Code example: 123456',
  }),
})
if (!test.ok) {
  const body = await test.text()
  die(`Brevo could not send the test email (${test.status}): ${body.slice(0, 300)}\nNew Brevo accounts sometimes need "transactional emails" activated: check the Brevo dashboard notifications.`)
}
ok(`test email sent to ${sender} (check spam the first time)`)

// 3. secrets
const wrangler = (args, input) => spawnSync(process.execPath, [WRANGLER, ...args], { cwd: root, input, encoding: 'utf8', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } })
for (const env of ['preview', 'production']) {
  const r = wrangler(['pages', 'secret', 'put', 'EMAIL_API_KEY', '--project-name', PROJECT, '--env', env], key + '\n')
  if (r.status !== 0) die(`Could not store the secret for ${env}:\n${(r.stderr || r.stdout).slice(-600)}\nRun "npx wrangler login" (or set CLOUDFLARE_API_TOKEN) and rerun.`)
  ok(`EMAIL_API_KEY stored for ${env === 'preview' ? 'staging' : 'production'}`)
}
const devVars = path.join(root, '.dev.vars')
let dv = fs.existsSync(devVars) ? fs.readFileSync(devVars, 'utf8') : ''
dv = dv.split(/\r?\n/).filter((l) => l && !/^(EMAIL_PROVIDER|EMAIL_FROM|EMAIL_API_KEY)=/.test(l)).join('\n')
dv += `\nEMAIL_PROVIDER=brevo\nEMAIL_FROM=CharaForge <${sender}>\nEMAIL_API_KEY=${key}\n`
fs.writeFileSync(devVars, dv.replace(/^\n/, ''))
ok('local .dev.vars updated (real emails in npm run dev too)')

// 4. sender in wrangler.toml + staging deploy
const tomlPath = path.join(root, 'wrangler.toml')
fs.writeFileSync(tomlPath, fs.readFileSync(tomlPath, 'utf8').replace(/EMAIL_FROM = "CharaForge <[^>]+>"/g, (m) => (m.includes('localhost') ? m : `EMAIL_FROM = "CharaForge <${sender}>"`)))
console.log('Deploying staging...')
const d = spawnSync('npm', ['run', 'deploy:staging'], { cwd: root, stdio: 'inherit', shell: true, env: { ...process.env, CI: '1' } })
if (d.status !== 0) die('Staging deploy failed (see above).')
ok('staging deployed: sign up on https://staging.characterforge-3u3.pages.dev with your Gmail to try it')
console.log('\nWhen staging works, put it live with:  npm run deploy:production')
