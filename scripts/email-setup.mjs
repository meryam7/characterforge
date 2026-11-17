// Sets (or changes) the Gmail app password used to send verification codes:  npm run email:setup
//   stores it as the EMAIL_API_KEY Pages secret for staging (preview) + production and in .dev.vars (local),
//   sets EMAIL_FROM in wrangler.toml to the Gmail address, then redeploys staging (production: npm run deploy:production).
// Make an app password at https://myaccount.google.com/apppasswords (needs 2-Step Verification on the Google account).
// The password is never printed, logged or committed. Cloudflare auth: `npx wrangler login` or CLOUDFLARE_API_TOKEN.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WRANGLER = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const tomlPath = path.join(root, 'wrangler.toml')
const ok = (m) => console.log(`\x1b[32m✔\x1b[0m ${m}`)
const die = (m) => { console.error(`\x1b[31m✘ ${m}\x1b[0m`); process.exit(1) }

const toml = fs.readFileSync(tomlPath, 'utf8')
const current = toml.match(/EMAIL_FROM = "CharaForge <([^>]+@gmail\.com)>"/)?.[1] ?? ''
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const gmail = ((await rl.question(`Gmail address [${current}]: `)).trim() || current).toLowerCase()
const pass = (process.env.GMAIL_APP_PASSWORD || (await rl.question('Gmail app password (16 letters): '))).replace(/\s+/g, '')
rl.close()
if (!/^[^@\s]+@(gmail|googlemail)\.com$/.test(gmail)) die('Enter a Gmail address.')
if (!/^[a-z]{16}$/i.test(pass)) die('A Gmail app password is 16 letters (spaces are ignored).')

for (const env of ['preview', 'production']) {
  const r = spawnSync(process.execPath, [WRANGLER, 'pages', 'secret', 'put', 'EMAIL_API_KEY', '--project-name', 'characterforge', '--env', env], {
    cwd: root, input: pass, encoding: 'utf8', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  })
  if (r.status !== 0) die(`Could not store the secret for ${env}:\n${(r.stderr || r.stdout).slice(-600)}\nRun "npx wrangler login" and retry.`)
  ok(`password stored for ${env === 'preview' ? 'staging' : 'production'}`)
}

const devVars = path.join(root, '.dev.vars')
const keep = (fs.existsSync(devVars) ? fs.readFileSync(devVars, 'utf8') : '').split(/\r?\n/).filter((l) => l && !/^EMAIL_(PROVIDER|FROM|API_KEY)=/.test(l))
fs.writeFileSync(devVars, [...keep, 'EMAIL_PROVIDER=gmail', `EMAIL_FROM=CharaForge <${gmail}>`, `EMAIL_API_KEY=${pass}`, ''].join('\n'))
ok('.dev.vars updated (npm run dev sends real emails too)')

fs.writeFileSync(tomlPath, toml.replace(/EMAIL_FROM = "CharaForge <[^>]+>"/g, (m) => (m.includes('localhost') ? m : `EMAIL_FROM = "CharaForge <${gmail}>"`)))
console.log('Deploying staging...')
const d = spawnSync('npm', ['run', 'deploy:staging'], { cwd: root, stdio: 'inherit', shell: true, env: { ...process.env, CI: '1' } })
if (d.status !== 0) die('Staging deploy failed (see above).')
ok('staging deployed. Sign up on https://staging.characterforge-3u3.pages.dev to check the email arrives.')
console.log('Then put it live with:  npm run deploy:production')
