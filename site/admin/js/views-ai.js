import { api } from './api.js?v=4e21be70';
import { el, table, when, num, tag, section, bars, ago } from './ui.js?v=4e21be70';

const KLASS = { ai: 'AI crawler', search: 'search engine', preview: 'link preview', tool: 'tool / scanner' };

export async function ai({ days }) {
    const d = await api(`/ai?days=${days}`);
    const cols = [
        { label: 'who', render: (r) => r.bot || 'unknown' },
        { label: 'kind', render: (r) => tag(KLASS[r.klass] || r.klass, r.klass) },
        { label: 'hits', render: (r) => num(r.hits) },
        { label: 'paths', render: (r) => num(r.paths) },
        { label: 'first seen', render: (r) => when(r.first_ts) },
        { label: 'last seen', render: (r) => `${when(r.last_ts)} (${ago(r.last_ts)})` },
    ];
    const recentCols = [
        { label: 'when', render: (r) => when(r.ts) },
        { label: 'who', render: (r) => el('span', {}, [tag(KLASS[r.klass] || r.klass, r.klass), ' ', r.bot || '']) },
        { label: 'path', key: 'path' },
        { label: 'status', key: 'status' },
        { label: 'from', render: (r) => `${r.loc || r.country || '?'} · ${r.ip}` },
        { label: 'user agent', key: 'ua' },
    ];
    const daily = d.daily.map((x) => [x.day.slice(5), (x.ai || 0)]);
    const dailySearch = d.daily.map((x) => [x.day.slice(5), (x.search || 0)]);
    const aiOnly = d.bots.filter((b) => b.klass === 'ai');
    return el('div', { class: 'view' }, [
        el('h2', { text: 'AI & bots' }),
        el('p', { class: 'muted', text: 'Every non-human request at the origin, classified by user agent from the Caddy access log. "AI crawler" covers training crawlers (GPTBot, ClaudeBot, CCBot…) and the on-demand fetchers behind ChatGPT / Claude / Perplexity answers. Requests Cloudflare blocks at the edge never reach here.' }),
        el('div', { class: 'stats' }, [
            el('div', { class: 'stat ai' }, [el('b', { text: num(aiOnly.reduce((n, b) => n + b.hits, 0)) }), el('span', { text: 'AI crawler hits' })]),
            el('div', { class: 'stat ai' }, [el('b', { text: num(aiOnly.length) }), el('span', { text: 'distinct AI crawlers' })]),
            el('div', { class: 'stat' }, [el('b', { text: num(d.bots.filter((b) => b.klass === 'search').reduce((n, b) => n + b.hits, 0)) }), el('span', { text: 'search bot hits' })]),
        ]),
        section('Who has been here', table(cols, d.bots)),
        el('div', { class: 'grid-2' }, [
            section('AI hits per day', bars(daily, 'ai')),
            section('Search bot hits per day', bars(dailySearch, 'search')),
            section('What AI crawlers fetch', bars(d.ai_paths.map((p) => [p.path, p.n]), 'ai')),
        ]),
        section('Recent non-human requests', table(recentCols, d.recent)),
    ]);
}
