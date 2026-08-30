#!/usr/bin/env bash
# deploy.sh -- build gabevandevere.com and push it live. Safe to run after every edit.
#
#   ./deploy.sh                  build, reload, smoke-test
#   ./deploy.sh "commit message" the same, then commit everything on master
#
# Steps: build.py -> validate Caddyfile -> reload caddy -> restart site-api only
# if api/ changed -> smoke test local and live. Prints one OK/FAIL line per check;
# exits non-zero on the first failure so a broken build never gets committed.
set -euo pipefail
cd "$(dirname "$0")"
CADDY="$HOME/.local/bin/caddy"
STATE=".deploy-state"
ok()   { printf 'OK    %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; exit 1; }

./build.py --strict >/dev/null || fail "build.py (a source file is over 200 lines, or the build broke)"
ok "build"

"$CADDY" validate --config Caddyfile >/dev/null 2>&1 || fail "Caddyfile invalid: run: $CADDY validate --config Caddyfile"
systemctl --user reload caddy 2>/dev/null || systemctl --user restart caddy
ok "caddy reloaded"

api_hash=$(cat api/*.py | sha256sum | cut -c1-16)
if [ "$(cat "$STATE" 2>/dev/null || true)" != "$api_hash" ]; then
    systemctl --user restart site-api
    sleep 1
    echo "$api_hash" > "$STATE"
    ok "site-api restarted"
else
    ok "site-api unchanged"
fi

code=$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://127.0.0.1:8081/)
[ "$code" = "200" ] || fail "local index returned $code"
code=$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://127.0.0.1:8081/api/health)
[ "$code" = "200" ] || fail "local /api/health returned $code (journalctl --user -u site-api -n 30)"
ok "local 8081 + api"

code=$(curl -s -o /dev/null -w '%{http_code}' -m 15 "https://gabevandevere.com/?deploy=$(date +%s)")
[ "$code" = "200" ] || fail "live site returned $code (systemctl --user status cloudflared)"
code=$(curl -s -o /dev/null -w '%{http_code}' -m 15 https://gabevandevere.com/api/status)
[ "$code" = "200" ] || fail "live /api/status returned $code"
ok "live https://gabevandevere.com"

if [ "${1:-}" != "" ]; then
    git add -A
    if git diff --cached --quiet; then
        ok "nothing to commit"
    else
        git commit -q -m "$1" && ok "committed: $1"
    fi
fi
