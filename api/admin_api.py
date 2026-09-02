"""Admin endpoints under /admin/*. Everything except login requires a valid session cookie AND
the X-Admin header (a custom header cannot be sent cross-site without a CORS preflight, which
this server never answers, so this doubles as CSRF protection alongside SameSite=Strict). Any
request carrying an Origin that is not the site is refused outright."""
import urllib.parse

import admin_auth
import admin_queries as aq
import cf_analytics
import config
import security

ORIGIN = 'https://gabevandevere.com'
NO_STORE = {'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow'}


def _guard(h) -> bool:
    origin = h.headers.get('Origin')
    if origin and origin != ORIGIN:
        h.send_json(403, {'error': 'forbidden'}, NO_STORE)
        return False
    if h.headers.get('X-Admin') != '1':
        h.send_json(403, {'error': 'missing header'}, NO_STORE)
        return False
    return True


def _authed(h) -> bool:
    if not _guard(h):
        return False
    if admin_auth.check(h.cookie(config.ADMIN_COOKIE)):
        return True
    h.send_json(401, {'error': 'not logged in'}, NO_STORE)
    return False


def _params(path: str) -> dict:
    qs = urllib.parse.urlsplit(path).query
    return {k: v[0] for k, v in urllib.parse.parse_qs(qs).items()}


def _days(p: dict, default: int = 30) -> int:
    try:
        return max(0, min(365, int(p.get('days', default))))
    except ValueError:
        return default


def login(h, _path):
    if not _guard(h):
        return
    body = h.read_json() or {}
    email, password, code = (str(body.get(k) or '')[:200] for k in ('email', 'password', 'code'))
    token, err = admin_auth.login(email, password, code, h.client_ip(), h.ua(), h.location())
    if err:
        return h.send_json(401, {'error': err}, NO_STORE)
    h.send_json(200, {'ok': True}, {**NO_STORE, 'Set-Cookie': admin_auth.cookie(token)})


def logout(h, _path):
    if not _guard(h):
        return
    admin_auth.logout(h.cookie(config.ADMIN_COOKIE))
    h.send_json(200, {'ok': True}, {**NO_STORE, 'Set-Cookie': admin_auth.cookie('', clear=True)})


def me(h, _path):
    if _authed(h):
        h.send_json(200, {'ok': True, 'totp': admin_auth.totp_required()}, NO_STORE)


def _view(fn):
    def handler(h, path):
        if not _authed(h):
            return
        p = _params(path)
        data = fn(p)
        if data is None:
            return h.send_json(404, {'error': 'not found'}, NO_STORE)
        h.send_json(200, data, NO_STORE)
    return handler


def _int(p, key):
    try:
        return int(p.get(key, ''))
    except ValueError:
        return -1


ROUTES = [
    ('POST', '/admin/login', login), ('POST', '/admin/logout', logout), ('GET', '/admin/me', me),
    ('GET', '/admin/overview', _view(lambda p: {**aq.overview(_days(p, 7)), 'sections': aq.sections(_days(p, 7)), 'clicks': aq.clicks(_days(p, 7)), 'totp': admin_auth.totp_required()})),
    ('GET', '/admin/humans', _view(lambda p: {'sessions': aq.sessions(_days(p)), 'clicks': aq.clicks(_days(p)), 'sections': aq.sections(_days(p))})),
    ('GET', '/admin/visitor', _view(lambda p: aq.visitor(p.get('vid', '')[:32]))),
    ('GET', '/admin/ai', _view(lambda p: aq.ai(_days(p)))),
    ('GET', '/admin/emails', _view(lambda p: {'emails': aq.emails(_days(p, 0))})),
    ('GET', '/admin/conversations', _view(lambda p: {'conversations': aq.conversations(_days(p, 0))})),
    ('GET', '/admin/conversation', _view(lambda p: aq.conversation(_int(p, 'id')))),
    ('GET', '/admin/cloudflare', _view(lambda p: cf_analytics.fetch(_days(p, 7)))),
    ('GET', '/admin/security', _view(lambda p: security.report(_days(p)))),
]
