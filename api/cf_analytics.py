"""Cloudflare edge analytics (what the free plan exposes over GraphQL): requests, page views,
unique visitors, bytes, cached share, threats, per day; plus top countries and browser families.
Needs a token with Zone -> Analytics:Read at CF_READ_TOKEN_PATH; without it, reports
configured=False and the admin UI explains what to create. Cached for 10 minutes."""
import json
import time
import urllib.request

import config

_cache = {'ts': 0.0, 'days': 0, 'data': None}
QUERY = """
query($zone: String!, $since: Date!, $until: Date!) {
  viewer { zones(filter: {zoneTag: $zone}) {
    days: httpRequests1dGroups(limit: 90, filter: {date_geq: $since, date_leq: $until}, orderBy: [date_ASC]) {
      dimensions { date }
      sum { requests pageViews bytes cachedRequests threats
            countryMap { clientCountryName requests }
            browserMap { uaBrowserFamily pageViews }
            responseStatusMap { edgeResponseStatus requests } }
      uniq { uniques }
    }
  } }
}"""


def _token():
    try:
        with open(config.CF_READ_TOKEN_PATH, encoding='utf-8') as fh:
            return fh.read().strip()
    except OSError:
        return ''


def fetch(days: int) -> dict:
    days = max(1, min(90, days))
    if _cache['data'] and _cache['days'] == days and time.time() - _cache['ts'] < 600:
        return _cache['data']
    token = _token()
    if not token:
        return {'configured': False}
    until = time.strftime('%Y-%m-%d', time.gmtime())
    since = time.strftime('%Y-%m-%d', time.gmtime(time.time() - (days - 1) * 86400))
    body = json.dumps({'query': QUERY, 'variables': {'zone': config.CF_ZONE_ID, 'since': since, 'until': until}}).encode()
    req = urllib.request.Request('https://api.cloudflare.com/client/v4/graphql', data=body, method='POST',
                                 headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.load(resp)
    except (OSError, ValueError) as exc:
        return {'configured': True, 'error': f'{type(exc).__name__}: {exc}'}
    if data.get('errors'):
        return {'configured': True, 'error': '; '.join(e.get('message', '?') for e in data['errors'])}
    zones = (data.get('data') or {}).get('viewer', {}).get('zones') or [{}]
    rows = zones[0].get('days') or []
    countries: dict[str, int] = {}
    browsers: dict[str, int] = {}
    statuses: dict[str, int] = {}
    series = []
    for r in rows:
        s = r['sum']
        series.append({'day': r['dimensions']['date'], 'requests': s['requests'], 'pageViews': s['pageViews'], 'uniques': r['uniq']['uniques'],
                       'bytes': s['bytes'], 'cached': s['cachedRequests'], 'threats': s['threats']})
        for c in s.get('countryMap') or []:
            countries[c['clientCountryName']] = countries.get(c['clientCountryName'], 0) + c['requests']
        for b in s.get('browserMap') or []:
            browsers[b['uaBrowserFamily']] = browsers.get(b['uaBrowserFamily'], 0) + b['pageViews']
        for st in s.get('responseStatusMap') or []:
            statuses[str(st['edgeResponseStatus'])] = statuses.get(str(st['edgeResponseStatus']), 0) + st['requests']
    top = lambda d: sorted(d.items(), key=lambda kv: -kv[1])[:12]
    out = {'configured': True, 'since': since, 'until': until, 'days': series, 'countries': top(countries), 'browsers': top(browsers), 'statuses': top(statuses),
           'totals': {k: sum(d[k] for d in series) for k in ('requests', 'pageViews', 'uniques', 'bytes', 'cached', 'threats')}}
    _cache.update({'ts': time.time(), 'days': days, 'data': out})
    return out
