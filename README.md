# gabevandevere.com

A hand-written site served by Caddy from this machine (the orin, a Jetson Orin
Nano Super) and reached through an outbound-only Cloudflare Tunnel. The "machine"
section talks to the local LLM (`llama.cpp` on :8080) through a small Python proxy
that holds the API key. No framework, no `node_modules`, no cloud AI.

Docs live in `docs/`. The feature list and what is still placeholder is in
[`docs/status.md`](docs/status.md).

```
gabevandevere.com/
├── deploy.sh          <- THE command. Build, reload, restart API if changed, smoke test, commit.
├── build.py           <- fills src/index.html's placeholders (?v= hash, JSON-LD) into site/index.html
├── bake.py            <- regenerates the baked passages in site/data/ from the model (see below)
├── src/
│   ├── index.html     <- THE PAGE. Folios, the hand-written record in each margin, the letter.
│   ├── facts.json     <- JSON-LD + /llms.txt source
│   └── admin/         <- admin page template
├── site/              <- the public web root (Caddy serves this directory as-is)
│   ├── index.html     <- GENERATED. Do not edit; edit src/index.html and run ./deploy.sh
│   ├── css/           <- stylesheets, served as-is
│   ├── js/            <- ES modules, one per feature (hand-written, served as-is)
│   ├── data/          <- baked passages: every token the model wrote, with its alternatives
│   ├── img/, fonts/   <- photographs and self-hosted fonts
│   └── 404.html, favicon.*, site.webmanifest, robots.txt, sitemap.xml
├── api/               <- the LLM proxy + telemetry (Python stdlib, runs as site-api.service)
│   ├── persona.py     <- what the model knows about you. EDIT THIS to teach it more.
│   ├── forks.py       <- rebuilds a fork's words-so-far server-side (never trusts the browser)
│   ├── config.py      <- limits, token caps, ports
│   └── server.py, chat.py, telemetry.py, limits.py
├── labs/              <- frontend experiments + local dev server (not served in production)
├── Caddyfile          <- web server config
└── docs/              <- status page
```

## The page: "almost"

Since 2026-09-29 the homepage is **almost**: the folio written word by word by the model on this
board, with the words it almost chose printed above the line. Pointing at a word shows the five
candidates it weighed; choosing another forks the passage and the model rewrites the rest live.
The facts that matter (roles, numbers, links) are hand-written in each folio's margin in
`src/index.html`, never model output.

The previous site (dark stone, contour hero, edit-in-place) is retired. It lives in git as the
tag `classic-site`: `git checkout classic-site -- src/page src/css site/js site/style.css` brings
its sources back. Edit mode (`/#edit`) belonged to that page and does nothing on this one.

**Re-baking the passages** (after changing `api/persona.py`, or to refresh the wording): on a
machine running `labs/run.sh`, `python3 bake.py` asks the model each folio's question again and
rewrites `site/data/*.json`. Read what comes back before deploying: it is printed on the homepage.

**Forks are safe by construction.** `/api/chat` takes `fork: {src, i, a}` — a baked passage or a
recent live answer, a word position, and one of the alternatives the model listed there — and
`api/forks.py` rebuilds the prefix from its own copy. There is no way to send the model arbitrary
words to continue from.


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
| Any hand-written text, the record in a margin, a photo caption | `src/index.html` |
| What the model says in a passage | `api/persona.py`, then `python3 bake.py` (see above) |
| What the model knows / how it talks | `api/persona.py` |
| Styles, colors, fonts | `site/css/` (`base.css` holds the tokens) |
| Facts for search/answer engines (JSON-LD + /llms.txt) | `src/facts.json` — keep in step with `api/persona.py` |
| Link-preview card (og.png) | `logs/shots/og.html` + `og.css`, render with `python3 logs/shots/og.py` (needs Caddy up) |
| Email address, LinkedIn link | `api/config.py` (CONTACT_TO), `src/index.html`, `api/persona.py` |

Every spot with placeholder content is marked `<!-- EDIT -->`.

### House rules for this repo

- Every hand-written file stays under 200 lines (`build.py --strict` refuses otherwise; the
  two generated files are exempt).
- No inline `style=""` attributes: the Content-Security-Policy is `style-src 'self'`.
  Styles go in `src/css/`; JS may set `el.style.x` (that's allowed).
- Documentation lives in `docs/` and `docs/status.md` is updated with every change.

## What lives outside the repo

Secrets and runtime state are never committed. A working clone needs, on the box:

| Path | Holds |
|---|---|
| `/etc/oracle-llm/api-key` | llama.cpp bearer key (readable by group `oracle-llm`) |
| `~/.config/site-api/smtp` | `SMTP_USER` / `SMTP_PASS` for Zoho, mode 0600 |
| `~/.config/site-api/admin` | admin login: scrypt hash, salt, TOTP secret, mode 0600 |
| `~/.config/site-api/cf-token`, `cf-token-read` | Cloudflare API tokens (zone admin / Analytics: Read) |
| `~/.local/state/site-api/` | SQLite analytics db and the tok/s cache |
| `~/.ssh/id_ed25519` | deploy key with write access to the GitHub mirror |
| `logs/` | screenshots, headless-browser scripts, private notes (gitignored) |

`deploy.sh` refuses to commit logs, databases, caches, or anything shaped like a token or
private key. Infrastructure notes go in `logs/private/`, never in `docs/`.

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

**Admin** lives at `/admin/` (static SPA in `site/admin/`, API under `/api/admin/*`) and is reachable
**only from the tailnet**: Caddy's public listener 404s `/admin` and `/api/admin`. Tailnet devices resolve
`gabevandevere.com` to the node itself (split DNS), where `tailscale serve` forwards :443 to Caddy's TLS
listener (:8443, real certificate, see `Caddyfile.tailnet`), so `https://gabevandevere.com/admin/` just works
there (fallback: `ssh -L 8082:127.0.0.1:8082` then `http://127.0.0.1:8082/admin/`). Edit mode lives there too. One account;
credentials are an scrypt hash in `~/.config/site-api/admin` (0600). To reset the password:
`cd api && python3 -c "import admin_auth; print(admin_auth.make_secret_file('gabe@gabevandevere.com', 'NEW-PASSWORD'))"`
(prints a fresh otpauth URI; set `TOTP_ENABLED=1` in that file to require an authenticator code).
Data is SQLite at `~/.local/state/site-api/site.db`: visitors/sessions/events from the beacon,
`requests` from the access log (bot classification in `api/bots.py`), `conversations`/`messages`,
`emails`, `admin_sessions`, `audit`. Cloudflare edge stats appear once `~/.config/site-api/cf-token-read`
holds a token with Zone → Analytics: Read.

- `GET /api/status` — board telemetry: temperatures, INA3221 power rails, GPU load,
  memory, uptime, llama.cpp token counters, model info. Cached 2 s.
- `POST /api/contact` — `{"subject","body","from"?}` → emails Gabe via Zoho SMTP (`api/mail.py`);
  creds in `~/.config/site-api/smtp`; 3 per IP per hour, 40 per day.
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
