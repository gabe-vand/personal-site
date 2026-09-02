// Security: admin login audit plus rule-based findings over the request log and chat.
// Every finding shows the rule that fired and that rule's fixed explanation. No model anywhere.
import { api } from './api.js?v=28c88bc3';
import { el, table, when, num, tag, section, stat, ago } from './ui.js?v=28c88bc3';

const SEVERITIES = ['high', 'medium', 'low', 'info'];
const LABEL = { high: 'high', medium: 'medium', low: 'low', info: 'info · welcome' };
let filter = 'all';

function card(f) {
    const head = el('div', { class: 'finding-head' }, [
        el('span', { class: `sev ${f.severity}`, text: LABEL[f.severity] }),
        el('b', { text: f.title }),
        el('span', { class: 'actor', text: f.bot ? `${f.bot} · ${f.actor}` : f.actor }),
        el('span', { class: 'meta', text: `${f.where} · ${num(f.count)} ${f.count === 1 ? 'request' : 'requests'} · last ${ago(f.last_ts)}` }),
        f.host ? el('span', { class: 'meta', text: `rDNS ${f.host}` }) : null,
        f.conv_id ? el('a', { href: `#conversation/${f.conv_id}`, class: 'back', text: 'open thread →' }) : null,
    ]);
    const sample = f.sample && f.sample.length ? el('div', { class: 'sample' }, f.sample.map((s) => el('span', { text: s }))) : null;
    return el('article', { class: `finding ${f.severity}` }, [head, el('p', { text: f.explain }), sample]);
}

function filters(onChange) {
    const btn = (key, label) => el('button', { type: 'button', class: `btn btn-small${filter === key ? ' is-on' : ''}`, text: label, onclick: () => { filter = key; onChange(); } });
    return el('div', { class: 'filters' }, [btn('all', 'all'), ...SEVERITIES.map((s) => btn(s, LABEL[s]))]);
}

export async function security({ days }) {
    const d = await api(`/security?days=${days}`);
    const c = d.counts;
    const loginCols = [
        { label: 'when', render: (r) => when(r.ts) },
        { label: 'action', render: (r) => tag(r.action === 'login_ok' ? 'ok' : 'fail', r.action === 'login_ok' ? 'ok' : 'fail') },
        { label: 'from', render: (r) => `${r.loc || '?'} · ${r.ip}` },
        { label: 'detail', key: 'detail' },
        { label: 'user agent', key: 'ua' },
    ];
    const list = el('div', { class: 'findings' });
    const draw = () => {
        const rows = d.findings.filter((f) => filter === 'all' || f.severity === filter);
        list.replaceChildren(...(rows.length ? rows.map(card) : [el('p', { class: 'muted mono', text: 'nothing in this window' })]));
        bar.replaceWith((bar = filters(draw)));
    };
    let bar = filters(draw);
    draw();
    const rulebook = el('div', { class: 'rulebook' }, Object.values(d.rules).map((r) => el('div', {}, [
        el('span', { class: `sev ${r.severity}`, text: LABEL[r.severity] }), ' ', el('b', { text: r.title }), ' — ', r.explain,
    ])));
    return el('div', { class: 'view' }, [
        el('h2', { text: 'Security' }),
        el('p', { class: 'muted', text: 'Who is knocking, and what they wanted. Findings come from fixed rules over the access log, the admin login audit and the chat transcripts: counts, paths, status codes and a reverse-DNS check for crawlers that claim to be a search engine. No model, no scoring, no external service. Nothing here blocks anyone; Cloudflare does that at the edge. AI crawlers and assistant fetchers are welcome and listed for interest only.' }),
        el('div', { class: 'stats' }, [
            stat(num(c.high || 0), 'high', 'hot'), stat(num(c.medium || 0), 'medium', 'warn'), stat(num(c.low || 0), 'low'),
            stat(num(c.crawler_verified || 0), 'verified search crawlers', 'ok'), stat(num(c.impostor || 0), 'fake crawlers', c.impostor ? 'hot' : ''),
            stat(num((c.ai_crawler || 0) + (c.ai_user_fetch || 0)), 'AI visitors (welcome)', 'ai'), stat(num(c.login_fail || 0), 'addresses with failed logins', c.login_fail ? 'hot' : ''),
        ]),
        section('Admin logins', table(loginCols, d.audit)),
        el('section', {}, [el('h3', { text: `Findings (${num(d.findings.length)})` }), bar, el('div', { style: { height: '0.7rem' } }), list]),
        section('The rulebook', rulebook),
    ]);
}
