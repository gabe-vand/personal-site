import { api } from './api.js?v=28c88bc3';
import { el, table, when, num, tag, section, kv, dur, ago } from './ui.js?v=28c88bc3';

export async function conversations({ days }) {
    const d = await api(`/conversations?days=${days}`);
    const cols = [
        { label: 'when', render: (r) => when(r.start_ts) },
        { label: 'exchanges', render: (r) => num(r.turns) },
        { label: 'first question', key: 'first_q', wrap: true },
        { label: 'visitor', render: (r) => (r.vid ? el('a', { href: `#visitor/${r.vid}`, text: r.vid.slice(0, 8) }) : tag('anonymous')) },
        { label: 'from', render: (r) => `${r.loc || r.country || '?'} · ${r.ip || '?'}` },
        { label: 'device', key: 'device' },
        { label: 'emailed', render: (r) => (r.notified_ts ? tag('yes', 'ok') : tag('pending')) },
    ];
    return el('div', { class: 'view' }, [
        el('h2', { text: 'Conversations' }),
        el('p', { class: 'muted', text: 'Every chat with the machine, one row per visitor tab. You get an email once a conversation has been quiet for five minutes.' }),
        section(`${d.conversations.length} conversations`, table(cols, d.conversations, (r) => { location.hash = `#conversation/${r.id}`; })),
    ]);
}

export async function conversation({ arg }) {
    const c = await api(`/conversation?id=${encodeURIComponent(arg)}`);
    const s = c.session;
    return el('div', { class: 'view' }, [
        el('a', { class: 'back', href: '#conversations', text: '← conversations' }),
        el('h2', { text: `Conversation #${c.id}` }),
        kv([
            ['started', `${when(c.start_ts)} (${ago(c.start_ts)})`], ['last message', when(c.last_ts)], ['exchanges', num(c.turns)],
            ['from', `${c.loc || c.country || '?'} · ${c.ip || '?'}`], ['device', c.device],
            ['visitor', c.vid ? el('a', { href: `#visitor/${c.vid}`, text: `${c.vid.slice(0, 8)} · ${c.visitor ? `${c.visitor.sessions} visit(s) since ${when(c.visitor.first_ts)}` : ''}` }) : 'anonymous (beacon off)'],
            ['this visit', s ? `${dur(s.seconds)} on page · sections ${s.sections || '—'} · referrer ${s.referrer || 'direct'}` : '—'],
            ['emailed you', c.notified_ts ? when(c.notified_ts) : 'not yet (waits 5 min of quiet)'],
        ]),
        section('Thread', el('div', { class: 'thread' }, c.messages.map((m) => el('div', { class: `msg ${m.role}` }, [
            m.content,
            el('small', { text: `${m.role === 'user' ? 'visitor' : 'machine'} · ${when(m.ts)}${m.tokens ? ` · ${m.tokens} tok · ${m.tps ? m.tps.toFixed(1) : '?'} tok/s · ${((m.ms || 0) / 1000).toFixed(1)} s` : ''}` }),
        ])))),
    ]);
}
