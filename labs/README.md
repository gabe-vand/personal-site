# Labs

Frontend experiments for gabevandevere.com, on the `creative-frontends` branch. Nothing here is
served in production: Caddy's web root is `site/`, and `labs/` sits beside it.

```
labs/run.sh        # opens an ssh tunnel to llama.cpp on the Jetson, then serves:
  http://localhost:5100/   the current site (site/), for comparison
  http://localhost:5101/   almost  — the bio as the model wrote it, with every word it didn't choose
  http://localhost:5102/   wall    — the page is a boulder problem; scrolling climbs it
  http://localhost:5103/   zoom    — Powers of Ten, from the visitor down to the model's weights
```

Off the personal tailnet: `ORIN_HOST=orin-lan labs/run.sh`.

## What the dev server does (`labs/devserver.py`)

Each lab is a folder with its own `index.html`; missing paths fall back to `site/`, so `/img/`,
`/fonts/` and the résumé PDF are shared. The API is as real as it can be off the board:

| Path | In dev |
|---|---|
| `GET /api/status` | proxied to the live site: the Jetson's real numbers |
| `POST /api/chat` | the real `api/chat.py`, through the tunnel to llama.cpp (needs `~/.config/site-api/oracle-api-key`) |
| `GET /api/whereami` | a fixed sample (Newark, DE via EWR); in prod it reads Cloudflare's location headers |
| `POST /api/contact` | printed to the terminal, **not sent** |
| `POST /api/beacon` | swallowed |

## API additions made for the labs

- `POST /api/chat` accepts `alts` (1–5): each `token` event then carries `p` (its probability) and
  `alts` (`[{t, p}]`, the alternatives llama.cpp weighed there). Also `prefix`: text the answer must
  start with, sent as an assistant prefill and not echoed back. That is how "almost" forks an answer.
  **Before shipping:** `prefix` lets a visitor put words in the model's mouth. It is capped at
  `MAX_PREFIX_CHARS`, but if a lab using it goes live, consider signing the canonical text server-side.
- `GET /api/whereami`: city/region/country/lat/lon from Cloudflare's visitor-location headers and
  the edge colo from the `CF-Ray` suffix. Stores nothing.

Same house rules as the site: files under 200 lines, no inline styles or scripts (CSP), no
external requests at runtime, no build step.
