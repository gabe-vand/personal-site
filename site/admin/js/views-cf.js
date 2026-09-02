import { api } from './api.js?v=28c88bc3';
import { el, table, num, bytes, section, stat, bars } from './ui.js?v=28c88bc3';

export async function cloudflare({ days }) {
    const d = await api(`/cloudflare?days=${days || 90}`);
    if (!d.configured) {
        return el('div', { class: 'view' }, [
            el('h2', { text: 'Cloudflare' }),
            el('p', { class: 'notice' }, [
                'Edge analytics need a read token. In Cloudflare: My Profile → API Tokens → Create Token → Custom, permission ',
                el('code', { text: 'Zone · Analytics · Read' }), ' for gabevandevere.com. Save it as ', el('code', { text: '~/.config/site-api/cf-token-read' }),
                ' (mode 600) and reload this page. The existing DNS token deliberately cannot read analytics.',
            ]),
        ]);
    }
    if (d.error) return el('div', { class: 'view' }, [el('h2', { text: 'Cloudflare' }), el('p', { class: 'notice', text: `Cloudflare API error: ${d.error}` })]);
    const t = d.totals;
    const cols = [
        { label: 'day', key: 'day' }, { label: 'requests', render: (r) => num(r.requests) }, { label: 'page views', render: (r) => num(r.pageViews) },
        { label: 'unique visitors', render: (r) => num(r.uniques) }, { label: 'cached', render: (r) => `${r.requests ? Math.round((100 * r.cached) / r.requests) : 0}%` },
        { label: 'bytes', render: (r) => bytes(r.bytes) }, { label: 'threats blocked', render: (r) => num(r.threats) },
    ];
    return el('div', { class: 'view' }, [
        el('h2', { text: 'Cloudflare edge' }),
        el('p', { class: 'muted', text: `What Cloudflare saw ${d.since} → ${d.until}, including requests it answered from cache or blocked (those never reach the board). Cached 10 minutes.` }),
        el('div', { class: 'stats' }, [
            stat(num(t.requests), 'requests'), stat(num(t.pageViews), 'page views'), stat(num(t.uniques), 'unique visitors (sum of daily)'),
            stat(t.requests ? `${Math.round((100 * t.cached) / t.requests)}%` : '—', 'served from cache'), stat(bytes(t.bytes), 'transferred'), stat(num(t.threats), 'threats blocked', 'hot'),
        ]),
        el('div', { class: 'grid-2' }, [
            section('Countries (requests)', bars(d.countries)), section('Browsers (page views)', bars(d.browsers)), section('Edge status codes', bars(d.statuses)),
        ]),
        section('Per day', table(cols, d.days.slice().reverse())),
    ]);
}
