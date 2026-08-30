# gabevandevere.com

A hand-written site served by Caddy from this machine (`orin`, a Jetson Orin
Nano Super) and reached through an outbound-only Cloudflare Tunnel. The "machine"
section talks to the local LLM (`llama.cpp` on :8080) through a small Python proxy
that holds the API key. No framework, no `node_modules`, no cloud AI.

Docs live in `docs/`. The feature list and what is still placeholder is in
[`docs/status.md`](docs/status.md).

```
gabevandevere.com/
├── deploy.sh          <- THE command. Build, reload, restart API if changed, smoke test, commit.
├── build.py           <- assembles site/index.html + site/style.css from src/
├── src/
│   ├── page/          <- one HTML file per section, in order (00-head ... 90-tail)
│   └── css/           <- one stylesheet per concern; 00-tokens.css holds colors + fonts
├── site/              <- the public web root (Caddy serves this directory as-is)
│   ├── index.html     <- GENERATED. Do not edit; edit src/page/ and run ./deploy.sh
│   ├── style.css      <- GENERATED from src/css/
│   ├── js/            <- ES modules, one per feature (hand-written, served as-is)
│   ├── img/           <- placeholder art; drop real photos here with the same names
│   ├── fonts/         <- Instrument Serif / Instrument Sans / JetBrains Mono (self-hosted)
│   └── 404.html, favicon.*, site.webmanifest, robots.txt, sitemap.xml
├── api/               <- the LLM proxy + telemetry (Python stdlib, runs as site-api.service)
│   ├── persona.py     <- what the model knows about you. EDIT THIS to teach it more.
│   ├── config.py      <- limits, token caps, ports
│   └── server.py, chat.py, telemetry.py, limits.py
├── Caddyfile          <- web server config
└── docs/              <- status page, deployment research
```

## The editing loop

1. Edit something under `src/` (page text, styles), `site/js/` (behaviour), or `api/persona.py`.
2. Run `./deploy.sh "what you changed"`.

That's it. `deploy.sh` rebuilds, validates and reloads Caddy, restarts the API only if
`api/` changed, checks the site locally and through Cloudflare, and commits. It prints
`OK`/`FAIL` per step and stops at the first failure. Prod is served straight from
`site/` on disk, so a green run *is* the deploy.

### Where things are

| You want to change | Edit |
|---|---|
| The intro sentence | `src/page/20-hero.html` (the `.hero-lede` paragraph) |
| Suggested questions for the model | `src/page/60-machine.html` (the `.chip` buttons) |
| Bring back a retired section (climb, lift, build) | move it from `src/archive/` back into `src/page/`, `src/css/`, `site/js/` (and re-add the nav hold + `main.js` import) |
| What the model knows / how it talks | `api/persona.py` |
| Email address, LinkedIn link | `api/config.py` (CONTACT_TO), `site/js/contact.js`, links in `src/page/70-contact.html`, `api/persona.py` |
| Colors, fonts | `src/css/00-tokens.css` |
| Ticker items | `src/page/20-hero.html` (the `.ticker-track` list) |

Every spot with placeholder content is marked `<!-- EDIT -->`.

### House rules for this repo

- Every hand-written file stays under 200 lines (`build.py --strict` refuses otherwise; the
  two generated files are exempt).
- No inline `style=""` attributes: the Content-Security-Policy is `style-src 'self'`.
  Styles go in `src/css/`; JS may set `el.style.x` (that's allowed).
- Documentation lives in `docs/` and `docs/status.md` is updated with every change.

## Running it

Three `systemctl --user` units (no `sudo` needed; lingering is enabled so they survive logout/reboot):

| Unit | What | Logs |
|---|---|---|
| `caddy` | serves `site/` on 127.0.0.1:8081 | `journalctl --user -u caddy -f` |
| `cloudflared` | tunnel to Cloudflare's edge | `journalctl --user -u cloudflared -f` |
| `site-api` | `api/server.py` on 127.0.0.1:8002 | `journalctl --user -u site-api -f` |

`systemctl --user status caddy cloudflared site-api` shows all three.

| Port | What |
|-----:|------|
| 8080 | `llama.cpp` (`oracle-llm.service`, system unit) — **do not touch** |
| 8000 | reserved — **left free deliberately** |
| 8081 | Caddy (loopback only; only cloudflared can reach it) |
| 8002 | site API (loopback only; only Caddy can reach it) |

## The API

Caddy forwards `/api/*` to `api/server.py` and strips the prefix.

- `GET /api/status` — board telemetry: temperatures, INA3221 power rails, GPU load,
  memory, uptime, llama.cpp token counters, model info. Cached 2 s.
- `POST /api/contact` — `{"subject","body","from"?}` → emails Gabe via Zoho SMTP (`api/mail.py`);
  creds in `/etc/site-api/smtp`; 3 per IP per hour, 40 per day.
- `POST /api/chat` — `{"messages":[{"role":"user","content":"..."}]}` → server-sent
  events (`status`, `token`…, `done` with real tokens/s). The system prompt from
  `persona.py` is added server-side; it is about Gabe, not the hardware (the panel shows that).

**The API key for llama.cpp lives in `/etc/oracle-llm/api-key` and never leaves the
proxy.** The proxy also caps output at 260 tokens, keeps 6 messages of history, allows
6 questions per visitor then 1/minute, 40 site-wide per 10 minutes, 600 a day, and lets
two people queue behind the single model slot. All numbers are in `api/config.py`.

The model is shared with the Raspberry Pi "Oracle" that uses the same llama.cpp server;
the proxy waits its turn rather than competing.

## Caches

HTML is never cached. CSS/JS are cached for 10 minutes but linked with a `?v=` hash, so a
new build is picked up on the next page load. Images are cached for a day at the
Cloudflare edge: after replacing a photo, either rename it or wait.
