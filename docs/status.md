# Status

Living status page for gabevandevere.com. Updated with every change.

Last updated: 2026-08-29.

## Live

| Feature | Where | State |
|---|---|---|
| Serving: Caddy → Cloudflare Tunnel, loopback-only, security headers, CSP | `Caddyfile` | done |
| Build: partials → `index.html`/`style.css`, `?v=` cache busting, 200-line lint | `build.py` | done |
| Deploy: one command, smoke-tests local + live, commits | `deploy.sh`, skill `deploy-site` | done |
| Hero with drifting contour field that bends around the pointer | `20-hero.html`, `js/contour.js` | done |
| Topo-route navigation (chalk line fills with scroll; bottom bar on phones) | `10-nav.html`, `js/topo.js` | done |
| Ticker with live uptime / GPU temp / watts / token count | `20-hero.html`, `js/ticker.js` | done |
| Climb: V-scale ladder with notes, send log | `30-climb.html`, `js/ladder.js` | done, notes and log are placeholders |
| Lift: load-the-bar barbell, presets | `40-lift.html`, `js/barbell.js` | done, preset numbers are placeholders |
| Build: project cards that tilt toward the pointer | `50-code.html`, `js/tilt.js` | done, images and links are placeholders |
| Machine: streaming chat with the on-device model | `60-machine.html`, `js/chat.js`, `api/` | done; each exchange is logged (truncated) to `journalctl --user -u site-api` for review |
| Machine: live telemetry panel with power sparkline | `js/telemetry.js`, `api/telemetry.py` | done |
| Machine: request pipeline diagram with in-flight packet | `60-machine.html` | done |
| Top out: chalk burst on reaching the contact section | `js/chalk.js` | done |
| Contact: mailto form to gabe@gabevandevere.com | `70-contact.html`, `js/contact.js` | done |
| Easter egg: Konami code → MAXN_SUPER theme | `js/reveal.js`, `00-tokens.css` | done |
| Reduced-motion: every animation has an off switch | all CSS/JS | done |
| 404 page in the new style | `site/404.html` | done |

## Placeholders waiting on Gabe

- Hero lede and climbing/lifting paragraphs (lorem where marked `<!-- EDIT -->`).
- Photos: `site/img/climb-1.svg`, `climb-2.svg`, `lift-1.svg`, `project-1..4.svg`.
- Ladder notes per grade, the send log, real PRs for the presets.
- GitHub / LinkedIn links in the contact section; repo links on the cards.
- Anything more the model should know: `api/persona.py`.

## Deferred

- Email: Cloudflare Email Routing for `gabe@gabevandevere.com` → hotmail, then delete the
  Porkbun MX/SPF records and switch the site's address. See `docs/deploy-research.md`.
- Cloudflare cache purge on deploy (images are edge-cached for a day).
