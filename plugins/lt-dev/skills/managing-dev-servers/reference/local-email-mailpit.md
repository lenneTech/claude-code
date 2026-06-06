# Local Email — Mailpit

lenneTech projects send transactional mail (welcome / password-reset / email-verification,
plus any custom mails) through SMTP. Locally that SMTP target is a shared **Mailpit**
instance — a mail *catcher*: it accepts every message and never delivers it onward, so you
can inspect exactly what the app would have sent without spamming real inboxes.

Mailpit is the modern successor to **MailHog** (the lenneTech instance was migrated from
MailHog to Mailpit). The hostname was kept for compatibility, so the SMTP/host config in
projects may still read `mailhog.lenne.tech` even though it now runs Mailpit. The web UI is
basic-auth protected — **credentials live in the team vault (1Password); never hardcode them
in code, configs, or this plugin.**

## How lt projects wire into it

- **nest-server (`projects/api`)** sends via `EmailService` over SMTP. The local env config
  points SMTP at the shared catcher (`host: …, port: 1025, secure: false`). Override per
  environment with `NSC__EMAIL__SMTP__HOST` / `…__PORT` / `…__AUTH__USER` / `…__AUTH__PASS`
  (or the `SMTP_*` knobs a project exposes).
- **jsonTransport guard:** when no SMTP host is configured, nest-server falls back to
  nodemailer's `jsonTransport` — mail is serialized but **not transmitted**. This is why the
  automated test envs do not actually send. Production/staging hard-fail if `jsonTransport`
  is active (a misconfig would silently drop password-reset/2FA mail).
- **Tests must verify content without sending.** Either rely on `jsonTransport`, or override
  `EmailService` with a recording mock and assert recipient / subject / link / attachments.
  Never point the test suite at a real SMTP host.

## Why Mailpit matters (vs. old MailHog)

The decisive upgrade: **Mailpit's HTML preview renders `multipart/related` with inline CID
images correctly** (it shows an `Inline image (N)` badge and resolves `cid:` references).

Old MailHog's preview could **not** extract/decode a `text/html` part nested inside
`multipart/related` — it dumped the raw container, so a branded email with an embedded logo
showed raw MIME boundaries (`----_NmP-…Part_1`) and quoted-printable artifacts (`=3D`,
`Welcome =` soft-breaks). **That was a preview limitation, not a mail defect** — the message
was valid and rendered fine in real clients. If you ever see that raw-MIME mess in a
preview, you're looking at old MailHog (or a tool that can't do `multipart/related`); confirm
with Mailpit or a real client.

## Web UI capabilities (open via Chrome DevTools MCP)

Per message, Mailpit exposes tabs + tools that are genuinely useful for hardening templates:

- **HTML / HTML Source / Text / Headers / Raw** — the rendered mail and its sources.
- **Responsive preview toggle** (phone / tablet / desktop icons, top-right of the preview) —
  switch to **phone view** to verify a responsive email actually reflows (fluid card width
  + `@media (max-width:600px)` padding/logo tweaks), not just scales down.
- **HTML Check** — a client-compatibility score (`% supported`) computed across dozens of
  clients (Outlook desktop/web, Gmail, Apple Mail, Yahoo, GMX, web.de, Orange, AOL, …) with
  per-CSS-feature warnings. Use it to harden templates. **~90% is a good score for a styled
  HTML email** — the remaining warnings are almost always *graceful degradations* in old
  Outlook (Word engine: partial `margin`/`padding`/`border-radius`/`max-width`) and niche EU
  webmail, not breakages. Worthwhile, low-risk hardening it nudges you toward:
  `mso-padding-alt` on button cells (Outlook ignores `<a>` padding), `bgcolor=""` attributes
  alongside CSS `background-color`, dropping unsupported `outline`, `overflow-wrap:break-word`
  on long fallback links.
- **Link Check** — validates the URLs in the mail.

## REST API (scriptable; same host, basic-auth)

Drive Mailpit headlessly to assert what was sent. All endpoints sit under the instance base
URL and require the basic-auth header. Self-signed/possibly-expired cert on the shared host →
use `rejectUnauthorized: false` in Node scripts (browser: accept/bypass once).

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/info` | version + counters (messages, SMTP accepted/rejected) |
| `GET /api/v1/messages?limit=N` | list newest-first (`ID`, `From`, `To`, `Subject`, `Snippet`, `Size`, `Created`) |
| `GET /api/v1/message/{ID}` | full message: HTML, Text, parts, headers |
| `GET /api/v1/message/{ID}/html-check` | compatibility report → `Total.Supported` (%), `Warnings[]` |
| `GET /api/v1/message/{ID}/link-check` | link validation report |
| `GET /api/v1/message/{ID}/part/{n}` | a single MIME part (e.g. the inline logo) |
| `DELETE /api/v1/messages` | body `{"IDs":[…]}` deletes those; empty/no body clears all |
| `GET /view/{ID}` | the web-UI view URL for a message |

> Note: Mailpit's list/detail JSON shape differs from MailHog's (`/api/v1/messages` with a
> `messages[]` array of `{ID, Subject, …}` vs. MailHog's `/api/v2/messages` `items[]` with a
> nested `Content.Headers`). If you have old MailHog-shaped scripts, update the field paths.

## Sending a one-off test mail (faithful to the app)

To eyeball a real send without driving the whole app, render the project's actual EJS
template with the same `templateData` the service uses and post it to the catcher's SMTP:

```js
const nodemailer = require('<api>/node_modules/nodemailer');
const ejs = require('<api>/node_modules/ejs');
// render <api>/src/assets/templates/welcome.ejs with { appName, link, logoSrc, name }
const transport = nodemailer.createTransport({ host: '<catcher-host>', port: 1025, secure: false, tls: { rejectUnauthorized: false } });
await transport.sendMail({ from: '"…" <…>', to: 't@test.local', subject: '…', html, attachments: [{ cid: 'logo', path: '<logo>.png' }] });
```

Then open the message in the Mailpit web UI (phone view + HTML Check) or pull
`/api/v1/message/{ID}/html-check` via the REST API. Clean up afterwards with
`DELETE /api/v1/messages`.

## Inline logo: CID vs. hosted URL (preview implications)

- **CID embed** (`<img src="cid:logo">` + a matching inline attachment → `multipart/related`):
  renders inline in every real client *and* in Mailpit; no hosting dependency. Old MailHog
  could not preview it (see above). Makes the message larger.
- **Hosted URL** (`<img src="https://…/logo.png">` → single `text/html` part): previewable in
  every tool incl. old MailHog, smaller message, but some clients block remote images until
  the recipient allows them.

A project can make this configurable (e.g. an `EMAIL_LOGO_MODE=cid|url` env). Default to CID
when no stable public logo URL exists; switch to URL once one does.
