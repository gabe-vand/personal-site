#!/usr/bin/env python3
"""HTTP entry point for the site API. Listens on 127.0.0.1:8002; Caddy forwards /api/* here
and strips the prefix. Routes live in public_routes.py (site) and admin_api.py (admin UI);
this file is the request plumbing: dispatch, JSON in/out, client identity, streaming writes.

Run:  python3 server.py      (in production: the site-api systemd user unit)
"""
import json
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import admin_api
import config
import convo
import logs_ingest
import public_routes

JSON_HEADERS = {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}
ROUTES = public_routes.ROUTES + admin_api.ROUTES


class Handler(BaseHTTPRequestHandler):
    server_version = 'site-api'
    sys_version = ''

    def log_message(self, fmt, *args):
        sys.stdout.write(f'{time.strftime("%H:%M:%S")} {self.client_ip()} {fmt % args}\n')
        sys.stdout.flush()

    # --- request identity (all requests arrive through Caddy from cloudflared; these headers are Cloudflare's) ---
    def client_ip(self):
        forwarded = (self.headers.get('X-Forwarded-For') or '').split(',')[0].strip()
        return self.headers.get('CF-Connecting-IP') or forwarded or self.client_address[0]

    def country(self):
        return (self.headers.get('CF-IPCountry') or '')[:2]

    def ua(self):
        return (self.headers.get('User-Agent') or '')[:300]

    def cookie(self, name):
        for part in (self.headers.get('Cookie') or '').split(';'):
            k, _, v = part.strip().partition('=')
            if k == name:
                return v
        return ''

    # --- body / response helpers ---
    def read_json(self, limit=config.MAX_BODY_BYTES):
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0
        if length <= 0 or length > limit:
            if length > 0:
                self.rfile.read(min(length, limit))
            return None
        try:
            return json.loads(self.rfile.read(length))
        except ValueError:
            return None

    def send_json(self, status, payload, extra=None):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        for key, value in {**JSON_HEADERS, **(extra or {})}.items():
            self.send_header(key, value)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def write(self, data):
        try:
            self.wfile.write(data)
            self.wfile.flush()
            return True
        except (BrokenPipeError, ConnectionResetError, OSError):
            return False

    # --- dispatch ---
    def dispatch(self):
        path = self.path.split('?', 1)[0]
        for method, route, fn in ROUTES:
            if method == self.command and path == route:
                try:
                    return fn(self, self.path)
                except Exception as exc:  # a bug in one handler must not take the server down
                    print(f'handler error {self.command} {path}: {type(exc).__name__}: {exc}', flush=True)
                    if not self.wfile.closed:
                        try:
                            return self.send_json(500, {'error': 'internal error'})
                        except OSError:
                            return
        self.send_json(404, {'error': 'not found'})

    def do_GET(self):
        self.dispatch()

    def do_POST(self):
        self.dispatch()
        self.close_connection = True  # streams and one-shot posts alike: keep it simple


def main():
    server = ThreadingHTTPServer((config.LISTEN_HOST, config.LISTEN_PORT), Handler)
    server.daemon_threads = True
    logs_ingest.start()
    convo.start()
    print(f'site-api listening on {config.LISTEN_HOST}:{config.LISTEN_PORT}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
