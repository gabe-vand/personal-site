# Status

Living status page for gabevandevere.com. Updated with every change.

Last updated: 2026-09-01 (repo scrubbed, mirrored to GitHub).

## Live

| Feature | Where | State |
|---|---|---|
| Serving: Caddy → Cloudflare Tunnel, loopback-only, security headers, CSP | `Caddyfile` | done |
| Build: partials → `index.html`/`style.css`, `?v=` cache busting, 200-line lint | `build.py` | done |
| Deploy: one command, smoke-tests local + live, commits, mirrors to GitHub (`gabe-vand/personal-site`, deploy key on the orin; push failure warns, never blocks) | `deploy.sh`, skill `deploy-site` | done |
| Public repo hygiene: history rewritten 2026-09-01 to drop infrastructure notes, logs and caches; `deploy.sh` refuses runtime files and secret-shaped text; private notes live in `logs/private/` (gitignored) | `deploy.sh`, `.gitignore` | done |
| Hero with drifting contour field that bends around the pointer | `20-hero.html`, `js/contour.js` | done |
| Topo-route navigation (chalk line fills with scroll; bottom bar on phones) | `10-nav.html`, `js/topo.js` | done |
| Ticker with live uptime / GPU temp / watts / token count | `20-hero.html`, `js/ticker.js` | done |
| Machine: streaming chat with the on-device model | `60-machine.html`, `js/chat.js`, `api/` | done; each exchange is logged (truncated) to `journalctl --user -u site-api` for review |
| Machine: live telemetry panel with power sparkline | `js/telemetry.js`, `api/telemetry.py` | done |
| Send it: one SVG group folds the button into a dart, morphs and flies a loop on a breeze; Sent card replaces the form; tags plane-v2-breeze / plane-v3-fold / plane-v4-svg | `site/js/paperplane.js` | done |
| Admin at `/admin/` (login gabe@…; scrypt hash in `~/.config/site-api/admin`, TOTP ready): Overview, Humans (visits, time, sections, link-offs, per-visitor history), AI & bots (access-log ingest classified by UA), Conversations (CRM: every chat thread; email after 5 min idle), Emails (everything sent), Cloudflare edge (needs `~/.config/site-api/cf-token-read` with Analytics:Read), Audit (logins). SQLite at `~/.local/state/site-api/site.db` | `api/admin_*.py`, `api/track.py`, `api/convo.py`, `api/logs_ingest.py`, `site/admin/` | done |
| First-party beacon `site/js/track.js` → `/api/beacon` (view, section, click, chat, contact, time on page; honors DNT/GPC) | `site/js/track.js` | done |
| About strip (crawlable bio + facts) between ticker and machine; title lengthened for Bing; IndexNow ping in deploy.sh (key in `.indexnow-key`, file `site/<key>.txt`) | `src/page/30-about.html`, `src/css/35-about.css` | done |
| GEO: `src/facts.json` → JSON-LD (Person, WebSite, FAQPage) in the head + `/llms.txt`, both generated at build (`build_facts.py`); nothing rendered. Keep in step with `api/persona.py` | `src/facts.json` | done |
| Production hygiene: http→https and www→apex 301s in Caddy, HSTS, canonical, full OG/Twitter metadata with 1200×630 `og.png` (re-render: `python3 logs/shots/og.py` with `logs/shots/og.html`), sitemap lastmod, Porkbun DNS leftovers removed | `Caddyfile`, `src/page/00-head.html` | done |
| Machine: panel speed = rolling avg of last 20 answers (persisted in `~/.local/state/site-api/tps`), seeded 10.6 tok/s | `api/speed.py` | done |
| Top out: chalk burst on reaching the contact section | `js/chalk.js` | done |
| Contact: mailto form to gabe@gabevandevere.com | `70-contact.html`, `js/contact.js` | done |
| Easter egg: Konami code → MAXN_SUPER theme | `js/reveal.js`, `00-tokens.css` | done |
| Reduced-motion: every animation has an off switch | all CSS/JS | done |
| 404 page in the new style | `site/404.html` | done |

## Archived (built, working, not on the page)

Climb (V-scale ladder, send log), Lift (load-the-bar barbell) and Build (tilting project cards)
were retired on 2026-08-29 and removed from the tree on 2026-09-01 to keep the public repo lean.
They are in history: `git log --oneline -- src/archive` finds the last commit that had them and
`git checkout <that-commit>^ -- src/archive` restores the folder. To bring one back, move its files
into `src/page/`, `src/css/`, `site/js/`, then re-add the nav hold in `10-nav.html` and the import
in `main.js`.

## Placeholders waiting on Gabe

- Hero lede (`20-hero.html`).
- Anything more the model should know: `api/persona.py` (full resume detail; one line on climbing/lifting; nothing about the hardware).

## Deferred

- Cloudflare cache purge on deploy (images are edge-cached for a day).
