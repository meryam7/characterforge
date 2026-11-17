/** Minimal SMTP client over Cloudflare TCP sockets (implicit TLS, port 465), used for Gmail with an app password.
 * Only I/O wait, almost no CPU (fits the free plan). Errors name the SMTP step + reply code, never the credentials. */
import { connect } from 'cloudflare:sockets'

export interface SmtpMessage {
  host: string
  port: number
  user: string
  pass: string
  fromName: string
  fromEmail: string
  to: string
  subject: string
  text: string
  html: string
}

const enc = new TextEncoder()
const b64 = (s: string) => {
  const bytes = enc.encode(s)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
const wrap76 = (s: string) => s.replace(/.{1,76}/g, '$&\r\n')
const word = (s: string) => `=?UTF-8?B?${b64(s)}?=` // RFC 2047 header encoding (accents in French subjects)
const clean = (s: string) => s.replace(/[\r\n<>]/g, '') // no header injection

function build(m: SmtpMessage) {
  const boundary = `cf-${crypto.randomUUID()}`
  return [
    `From: ${word(m.fromName)} <${clean(m.fromEmail)}>`,
    `To: <${clean(m.to)}>`,
    `Subject: ${word(m.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${clean(m.fromEmail).split('@')[1]}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(m.text)),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(m.html)),
    `--${boundary}--`,
  ].join('\r\n') // base64 lines never start with ".", so no dot-stuffing is needed
}

export async function smtpSend(m: SmtpMessage, timeoutMs = 15000): Promise<void> {
  const socket = connect({ hostname: m.host, port: m.port }, { secureTransport: 'on', allowHalfOpen: false })
  const writer = socket.writable.getWriter()
  const reader = socket.readable.getReader()
  const dec = new TextDecoder()
  let buf = ''

  const reply = async (): Promise<number> => {
    for (;;) {
      const i = buf.indexOf('\r\n')
      if (i >= 0) {
        const line = buf.slice(0, i)
        buf = buf.slice(i + 2)
        if (/^\d{3}(?: |$)/.test(line)) return Number(line.slice(0, 3)) // last line of a (multi-line) reply
        continue
      }
      const { value, done } = await reader.read()
      if (done) throw new Error('SMTP connection closed')
      buf += dec.decode(value, { stream: true })
    }
  }
  const step = async (name: string, line: string | null, expect: number) => {
    if (line !== null) await writer.write(enc.encode(line + '\r\n'))
    const code = await reply()
    if (code !== expect) throw new Error(`SMTP ${name} failed (${code})`)
  }

  const run = async () => {
    await step('greeting', null, 220)
    await step('EHLO', 'EHLO charaforge', 250)
    await step('AUTH', `AUTH PLAIN ${b64(`\0${m.user}\0${m.pass}`)}`, 235) // 535 = wrong user/app password
    await step('MAIL FROM', `MAIL FROM:<${clean(m.fromEmail)}>`, 250)
    await step('RCPT TO', `RCPT TO:<${clean(m.to)}>`, 250)
    await step('DATA', 'DATA', 354)
    await step('message', `${build(m)}\r\n.`, 250)
    await writer.write(enc.encode('QUIT\r\n')).catch(() => {})
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      run(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('SMTP timeout')), timeoutMs) }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    socket.close().catch(() => {})
  }
}
