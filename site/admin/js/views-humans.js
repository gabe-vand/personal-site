import { api } from './api.js?v=4e21be70';
import { el, table, when, dur, num, tag, section, kv, bars, ago } from './ui.js?v=4e21be70';

const go = (hash) => { location.hash = hash; };

export async function humans({ days }) {
    const d = await api(`/humans?days=${days}`);
    const cols = [
        { label: 'when', render: (r) => when(r.start_ts) },
        { label: 'visitor', render: (r) => el('a', { href: `#visitor/${r.vid}`, text: r.vid.slice(0, 8) }) },
        { label: 'visit #', render: (r) => `${r.visits || 1}` },
        { label: 'from', render: (r) => `${r.loc || r.country || '?'} · ${r.ip || '?'}` },
        { label: 'device', render: (r) => `${r.device}${r.width ? ` · ${r.width}px` : ''}` },
        { label: 'time', render: (r) => dur(r.seconds) },
        { label: 'sections', render: (r) => r.sections || '—' },
        { label: 'chat', render: (r) => (r.chats ? tag(`${r.chats} q`, 'ai') : '—') },
        { label: 'form', render: (r) => (r.contacts ? tag('sent', 'ok') : '—') },
        { label: 'clicks', render: (r) => num(r.clicks) },
        { label: 'referrer', key: 'referrer' },
    ];
    return el('div', { class: 'view' }, [
        el('h2', { text: 'Humans' }),
        el('p', { class: 'muted', text: 'One row per visit (browser tab). Click a visitor id for their full history. Bots never appear here: they are filtered by user agent and most never run the beacon at all.' }),
        section(`${d.sessions.length} visits`, table(cols, d.sessions, (r) => go(`#visitor/${r.vid}`))),
        el('div', { class: 'grid-2' }, [
            section('Sections reached', bars(Object.entries(d.sections).sort((a, b) => b[1] - a[1]))),
            section('Link-offs', bars(d.clicks.map((c) => [c.detail, c.n]))),
        ]),
    ]);
}

export async function visitor({ arg }) {
    const v = await api(`/visitor?vid=${encodeURIComponent(arg)}`);
    const evCols = [
        { label: 'when', render: (r) => when(r.ts) },
        { label: 'visit', render: (r) => r.sid.slice(0, 8) },
        { label: 'event', key: 'kind' },
        { label: 'detail', key: 'detail', wrap: true },
    ];
    const sessCols = [
        { label: 'when', render: (r) => when(r.start_ts) },
        { label: 'time', render: (r) => dur(r.seconds) },
        { label: 'sections', key: 'sections' },
        { label: 'chat q', key: 'chats' }, { label: 'form', key: 'contacts' }, { label: 'clicks', key: 'clicks' },
        { label: 'referrer', key: 'referrer' }, { label: 'width', key: 'width' },
    ];
    return el('div', { class: 'view' }, [
        el('a', { class: 'back', href: '#humans', text: '← humans' }),
        el('h2', { text: `Visitor ${arg.slice(0, 8)}` }),
        kv([
            ['first seen', `${when(v.first_ts)} (${ago(v.first_ts)})`], ['last seen', `${when(v.last_ts)} (${ago(v.last_ts)})`],
            ['visits', num(v.sessions)], ['page views', num(v.views)], ['from', `${v.loc || v.country || '?'} · ${v.ip || '?'}`], ['device', v.device], ['user agent', v.ua],
        ]),
        v.conversations.length ? section('Conversations', el('ul', { class: 'mono' }, v.conversations.map((c) => el('li', {}, [
            el('a', { href: `#conversation/${c.id}`, text: `${when(c.start_ts)} · ${c.turns} exchange${c.turns === 1 ? '' : 's'}` }),
        ])))) : null,
        v.emails.length ? section('Emails from this visitor', el('ul', { class: 'mono' }, v.emails.map((m) => el('li', { text: `${when(m.ts)} · ${m.kind} · ${m.subject}` })))) : null,
        section('Visits', table(sessCols, v.sessions_list)),
        section('Events', table(evCols, v.events)),
    ]);
}
