# Status

Living status page for gabevandevere.com. Updated with every change.

Last updated: 2026-08-29 (evening: page reduced to machine + contact).

## Live

| Feature | Where | State |
|---|---|---|
| Serving: Caddy → Cloudflare Tunnel, loopback-only, security headers, CSP | `Caddyfile` | done |
| Build: partials → `index.html`/`style.css`, `?v=` cache busting, 200-line lint | `build.py` | done |
| Deploy: one command, smoke-tests local + live, commits | `deploy.sh`, skill `deploy-site` | done |
| Hero with drifting contour field that bends around the pointer | `20-hero.html`, `js/contour.js` | done |
| Topo-route navigation (chalk line fills with scroll; bottom bar on phones) | `10-nav.html`, `js/topo.js` | done |
| Ticker with live uptime / GPU temp / watts / token count | `20-hero.html`, `js/ticker.js` | done |
| Machine: streaming chat with the on-device model | `60-machine.html`, `js/chat.js`, `api/` | done; each exchange is logged (truncated) to `journalctl --user -u site-api` for review |
| Machine: live telemetry panel with power sparkline | `js/telemetry.js`, `api/telemetry.py` | done |
| Send it: one SVG group folds the button into a dart, morphs and flies a loop on a breeze; Sent card replaces the form; tags plane-v2-breeze / plane-v3-fold / plane-v4-svg | `site/js/paperplane.js` | done |
| GEO: `src/facts.json` → JSON-LD (Person, WebSite, FAQPage) in the head + `/llms.txt`, both generated at build (`build_facts.py`); nothing rendered. Keep in step with `api/persona.py` | `src/facts.json` | done |
| Production hygiene: http→https and www→apex 301s in Caddy, HSTS, canonical, full OG/Twitter metadata with 1200×630 `og.png` (re-render: `python3 logs/shots/og.py` with `logs/shots/og.html`), sitemap lastmod, Porkbun DNS leftovers removed | `Caddyfile`, `src/page/00-head.html` | done |
| Machine: panel speed = rolling avg of last 20 answers (persisted in `~/.local/state/site-api/tps`), seeded 10.6 tok/s | `api/speed.py` | done |
| Top out: chalk burst on reaching the contact section | `js/chalk.js` | done |
| Contact: mailto form to gabe@gabevandevere.com | `70-contact.html`, `js/contact.js` | done |
| Easter egg: Konami code → MAXN_SUPER theme | `js/reveal.js`, `00-tokens.css` | done |
| Reduced-motion: every animation has an off switch | all CSS/JS | done |
| 404 page in the new style | `site/404.html` | done |

## Archived (built, working, not on the page)

Retired on 2026-08-29 while the page is being rethought. Everything lives in `src/archive/`
and comes back by moving the files into `src/page/`, `src/css/`, `site/js/` and re-adding a
nav hold in `10-nav.html` plus the import in `main.js`.

| Section | Files |
|---|---|
| Climb: V-scale ladder, send log | `page/30-climb.html`, `css/40-climb.css`, `js/ladder.js`, `img/climb-*.svg` |
| Lift: load-the-bar barbell, presets | `page/40-lift.html`, `css/50-lift.css`, `js/barbell.js`, `img/lift-1.svg` |
| Build: tilting project cards | `page/50-code.html`, `css/60-code.css`, `js/tilt.js`, `img/project-*.svg` |

## Placeholders waiting on Gabe

- Hero lede (`20-hero.html`).
- Anything more the model should know: `api/persona.py` (full resume detail; one line on climbing/lifting; nothing about the hardware).

## Deferred

- Contact form sending: code is live (`POST /api/contact` → `api/mail.py` → Zoho SMTP), but
  it sends only once `~/.config/site-api/smtp` exists (SMTP_USER + SMTP_PASS = Zoho app password).
  Until then the form shows "Mail is not set up on this board yet" with the address.
- Cloudflare cache purge on deploy (images are edge-cached for a day).
