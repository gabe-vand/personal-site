# gabevandevere.com

A hand-written static site, served by Caddy from this machine (`orin`,
a Jetson Orin Nano). No build step, no framework, no `node_modules`. You edit
an HTML file, save it, refresh the browser. That's the whole workflow.

```
gabevandevere.com/
├── site/              <- everything in here is public
│   ├── index.html     <- front page
│   ├── projects.html
│   ├── 404.html
│   ├── style.css      <- all styling; variables at the top
│   ├── main.js        <- tiny; footer year + the "Ask" box
│   ├── favicon.svg
│   ├── robots.txt
│   └── sitemap.xml
├── Caddyfile          <- web server config
├── access.log         <- request log (gitignored)
└── README.md
```

## Editing

Change a file in `site/` and reload the page. Nothing to rebuild, nothing to
restart — Caddy reads from disk on every request.

Start with these, in order:

1. `site/index.html` — the `<!-- EDIT -->` comments mark every spot that has
   placeholder text. The intro paragraph and the links list are the two that
   matter.
2. `site/style.css` — the `:root` block at the top holds colors, fonts, and
   the text column width. Change `--accent` to recolor every link at once.
   Dark mode is a second block a few lines below; change both.
3. `site/projects.html` — copy an `<article class="entry">` block to add an
   entry.

To add a page: copy `projects.html`, rename it, edit the contents, then add a
link to it in the `<nav>` of every page and a `<url>` entry in `sitemap.xml`.

### Version control

The directory is a git repo. After a round of edits:

```bash
cd ~/gabevandevere.com
git add -A && git commit -m "update intro"
```

That's your undo button. `git diff` before committing shows what changed, and
`git checkout -- site/index.html` throws away a bad edit.

## Running it

Caddy runs as a **user** systemd service, so none of this needs `sudo`.

```bash
systemctl --user status caddy      # is it up?
systemctl --user reload caddy      # after editing the Caddyfile
systemctl --user restart caddy     # if reload isn't enough
journalctl --user -u caddy -f      # live logs
```

Lingering is enabled (`loginctl enable-linger gabevandevere`), so it starts at
boot without anyone logging in.

Check a config change before applying it:

```bash
~/.local/bin/caddy validate --config ~/gabevandevere.com/Caddyfile
```

### Ports on this machine

| Port | What |
|-----:|------|
| 8080 | `llama.cpp` (`oracle-llm.service`) — **do not touch** |
| 8000 | reserved — **left free deliberately** |
| 8081 | this website |
| 22   | ssh |

## Wiring in the LLM

`index.html` has an `<section id="ask" hidden>` block and `main.js` has the
code to drive it. It posts to `/api/ask` on this same site. It is switched off
until a backend exists.

**The one rule: the llama.cpp API key must never reach the browser.**
It lives in `/etc/oracle-llm/api-key`. A page that calls `:8080` directly would
have to ship that key in JavaScript, where anyone can read it with View Source.

So the shape is:

```
browser  ──POST /api/ask──>  Caddy :8081  ──>  proxy :8002  ──>  llama.cpp :8080
                                                  ^                    ^
                                          holds the API key,    never exposed
                                          rate limits,          to the internet
                                          caps max_tokens,
                                          fixes the system prompt
```

Two things make the proxy non-optional rather than nice-to-have:

- **`--parallel 1`.** The model serves exactly one request at a time. A single
  person holding down refresh takes the site's LLM offline for everyone. Rate
  limiting is the feature, not an add-on.
- **Cost is heat and power.** This is a 7–25 W board doing GPU inference in a
  room in your apartment. Unmetered public inference is a bad night.

When you're ready: build the proxy, run it on 8002, uncomment the
`handle /api/*` block in the `Caddyfile`, reload, and delete the `hidden`
attribute from the `<section id="ask">` in `index.html`.
