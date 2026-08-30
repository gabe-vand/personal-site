#!/usr/bin/env python3
"""HTTP entry point for the site API. Listens on 127.0.0.1:8002; Caddy forwards /api/* here.

Routes (Caddy strips the /api prefix before they get here):
    GET  /status   telemetry JSON for the "machine" panel on the page
    POST /chat     {"messages":[{"role":"user","content":"..."}]}  ->  SSE stream
    POST /contact  {"subject","body","from"?}  ->  email to Gabe via api/mail.py
    GET  /health   liveness

Run:  python3 server.py      (in production: the site-api systemd user unit)
"""
import json
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import chat
import config
import limits
import mail
import telemetry

JSON_HEADERS = {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}
SSE_HEADERS = {'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no'}


class Handler(BaseHTTPRequestHandler):
    server_version = 'site-api'
    sys_version = ''

    def log_message(self, fmt, *args):
        sys.stdout.write(f'{time.strftime("%H:%M:%S")} {self.client_ip()} {fmt % args}\n')
        sys.stdout.flush()

    def client_ip(self):
        forwarded = (self.headers.get('X-Forwarded-For') or '').split(',')[0].strip()
        return self.headers.get('CF-Connecting-IP') or forwarded or self.client_address[0]

    def send_json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        for key, value in JSON_HEADERS.items():
            self.send_header(key, value)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/status':
            return self.send_json(200, telemetry.snapshot())
        if self.path == '/health':
            return self.send_json(200, {'ok': True})
        self.send_json(404, {'error': 'not found'})

    def read_json(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0
        if length <= 0 or length > config.MAX_BODY_BYTES:
            return None
        try:
            return json.loads(self.rfile.read(length))
        except ValueError:
            return None

    def do_POST(self):
        if self.path == '/contact':
            return self.do_contact()
        if self.path != '/chat':
            return self.send_json(404, {'error': 'not found'})
        payload = self.read_json()
        try:
            history = chat.clean_history(payload.get('messages'))
        except (ValueError, AttributeError):
            return self.send_json(400, {'error': 'Bad request or message too long.'})
        wait = limits.take_token(self.client_ip())
        if wait > 0:
            return self.send_json(429, {'error': f'You have asked a lot in a short time. Try again in {int(wait) + 1} seconds.'})
        if not limits.global_allow():
            return self.send_json(429, {'error': 'The board is popular right now. Try again in a few minutes.'})
        if not limits.try_enter_queue():
            return self.send_json(503, {'error': 'Two people are already waiting on the one slot. Try again in a minute.'})
        try:
            self.stream_answer(history)
        finally:
            limits.leave_queue()

    def do_contact(self):
        clean, err = mail.validate(self.read_json())
        if err:
            return self.send_json(400, {'error': err})
        if not limits.contact_allow(self.client_ip()):
            return self.send_json(429, {'error': 'That is enough messages for now. Email me directly instead.'})
        err = mail.send(clean, self.client_ip())
        if err:
            return self.send_json(502, {'error': err})
        self.send_json(200, {'ok': True})

    def stream_answer(self, history):
        self.send_response(200)
        for key, value in SSE_HEADERS.items():
            self.send_header(key, value)
        self.end_headers()
        if not self._wait_for_slot():
            self._write(chat.sse('error', {'message': 'Still busy after a long wait. Try again shortly.'}))
            return
        try:
            for event in chat.stream(history):
                if not self._write(event):
                    break  # visitor left; dropping the upstream connection cancels generation
        finally:
            limits.release_slot()

    def _wait_for_slot(self):
        deadline = time.monotonic() + config.WAIT_TIMEOUT_S
        first = True
        while True:
            if limits.acquire_slot(timeout=0.5 if first else 5.0):
                return True
            note = chat.sse('status', {'state': 'queued', 'ahead': max(0, limits.waiting_count() - 1)}) if first else b': waiting\n\n'
            first = False
            if not self._write(note) or time.monotonic() > deadline:
                return False

    def _write(self, data):
        try:
            self.wfile.write(data)
            self.wfile.flush()
            return True
        except (BrokenPipeError, ConnectionResetError, OSError):
            return False


def main():
    server = ThreadingHTTPServer((config.LISTEN_HOST, config.LISTEN_PORT), Handler)
    server.daemon_threads = True
    print(f'site-api listening on {config.LISTEN_HOST}:{config.LISTEN_PORT}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
