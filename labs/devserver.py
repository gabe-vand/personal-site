#!/usr/bin/env python3
"""Local dev server for the frontend labs. One process, one port per lab.

Each lab is a folder under labs/ with its own index.html. Anything a lab does not have
falls back to site/ (photographs, fonts, the resume PDF), so labs share assets with prod.

The API is as real as it can be off the board:
  /api/status   proxied to the live site, so the numbers are the Jetson's, right now
  /api/chat     the real api/chat.py, talking to llama.cpp on the Jetson through an ssh
                tunnel (labs/run.sh opens it on 127.0.0.1:18080). Supports alts + prefix.
  /api/contact  NOT sent: logged to the terminal and answered {ok: true}
  /api/beacon   swallowed
  /api/whereami a fixed sample (Newark, DE via EWR): off Cloudflare there are no location headers

Run:  labs/run.sh      (or: python3 labs/devserver.py, with the tunnel already open)
"""
import json
import mimetypes
import os
import sys
import threading
import time
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'api'))

import config  # noqa: E402

config.UPSTREAM = os.environ.get('LLM_UPSTREAM', 'http://127.0.0.1:18080')
config.API_KEY_PATH = os.path.expanduser('~/.config/site-api/oracle-api-key')
config.PER_IP_CAPACITY = 1000  # dev: no per-visitor limit, the model still serves one at a time
config.GLOBAL_PER_10MIN = 1000

import chat  # noqa: E402
import convo  # noqa: E402
import public_routes  # noqa: E402
import server  # noqa: E402
import speed  # noqa: E402

convo.record_turn = lambda *a, **k: None   # no local database in dev
speed.note = lambda *a, **k: None

LIVE = os.environ.get('LIVE_ORIGIN', 'https://gabevandevere.com')
LABS = {5100: ROOT / 'site', 5101: ROOT / 'labs' / 'almost', 5102: ROOT / 'labs' / 'wall', 5103: ROOT / 'labs' / 'zoom'}
_cache = {}
DEV_WHERE = {'city': 'Newark', 'region': 'Delaware', 'country': 'US', 'lat': 39.68, 'lon': -75.75, 'colo': 'EWR', 'dev': True}


def fetch_live(path, ttl=2.0):
    hit = _cache.get(path)
    if hit and time.monotonic() - hit[0] < ttl:
        return hit[1], hit[2]
    req = urllib.request.Request(LIVE + path, headers={'User-Agent': 'labs-devserver'})
    with urllib.request.urlopen(req, timeout=8) as resp:
        body, ctype = resp.read(), resp.headers.get('Content-Type', 'application/json')
    _cache[path] = (time.monotonic(), body, ctype)
    return body, ctype


def make_handler(root: Path):
    class Handler(server.Handler):
        def log_message(self, fmt, *args):
            if '/api/status' not in self.path:
                super().log_message(fmt, *args)

        def send_raw(self, status, body, ctype):
            self.send_response(status)
            self.send_header('Content-Type', ctype)
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            path = self.path.split('?', 1)[0]
            if path == '/api/whereami':
                return self.send_json(200, DEV_WHERE)
            if path == '/api/status':
                try:
                    body, ctype = fetch_live(path)
                    return self.send_raw(200, body, ctype)
                except OSError as exc:
                    return self.send_json(502, {'error': f'live site unreachable: {exc}'})
            if path.startswith('/api/'):
                return self.send_json(404, {'error': 'not found'})
            self.serve_static(path)

        def do_POST(self):
            path = self.path.split('?', 1)[0]
            self.close_connection = True
            if path == '/api/chat':
                return public_routes.chat_route(self, path)
            if path == '/api/contact':
                print('contact (dev, NOT sent):', json.dumps(self.read_json()), flush=True)
                return self.send_json(200, {'ok': True})
            if path == '/api/beacon':
                self.read_json(config.BEACON_MAX_BYTES)
                return self.send_json(200, {'ok': True})
            self.send_json(404, {'error': 'not found'})

        def serve_static(self, path):
            rel = urllib.request.unquote(path).lstrip('/')
            for base in (root, ROOT / 'site'):
                target = (base / rel).resolve()
                if target.is_dir():
                    target = target / 'index.html'
                if base.resolve() in target.parents and target.is_file():
                    ctype = mimetypes.guess_type(target.name)[0] or 'application/octet-stream'
                    if ctype.startswith('text/') or ctype.endswith(('javascript', 'json', 'svg+xml')):
                        ctype += '; charset=utf-8'
                    return self.send_raw(200, target.read_bytes(), ctype)
            self.send_raw(404, b'not found', 'text/plain')

    return Handler


def main():
    mimetypes.add_type('text/javascript', '.js')
    mimetypes.add_type('font/woff2', '.woff2')
    servers = []
    for port, root in LABS.items():
        httpd = ThreadingHTTPServer(('127.0.0.1', port), make_handler(root))
        httpd.daemon_threads = True
        servers.append(httpd)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        print(f'  http://localhost:{port}/  ->  {root.relative_to(ROOT)}', flush=True)
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
