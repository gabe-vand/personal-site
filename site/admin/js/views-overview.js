import { api } from './api.js';
import { el, stat, num, dur, bars, section, table, when } from './ui.js';

export async function overview({ days }) {
    const d = await api(`/overview?days=${days}`);
    const h = d.humans;
    const b = d.bots;
    const avg = h.sessions ? dur(h.seconds / h.sessions) : '—';
    const daily = d.daily.map((x) => [x.day.slice(5), x.humans]);
    const dailyAi = d.daily.map((x) => [x.day.slice(5), x.ai]);
    return el('div', { class: 'view' }, [
        el('h2', { text: 'Overview' }),
        section('Humans', el('div', { class: 'stats' }, [
            stat(num(h.visitors), 'visitors'), stat(num(h.sessions), 'visits'), stat(avg, 'avg time on page'),
            stat(num(h.chats), 'chat questions'), stat(num(h.contacts), 'form sends'), stat(num(h.clicks), 'link-offs'),
        ])),
        section('Machines', el('div', { class: 'stats' }, [
            stat(num(b.ai || 0), 'AI crawler hits', 'ai'), stat(num(b.search || 0), 'search bot hits'), stat(num(b.preview || 0), 'link previews'),
            stat(num(b.tool || 0), 'tools / scanners'), stat(num(d.conversations), 'conversations', 'hot'), stat(`${num(d.emails.ok)} / ${num(d.emails.n)}`, 'emails sent / tried'),
        ])),
        el('div', { class: 'grid-2' }, [
            section('Human visits per day', bars(daily)),
            section('AI crawler hits per day', bars(dailyAi, 'ai')),
            section('Sections reached (visits)', bars(Object.entries(d.sections).sort((a, b2) => b2[1] - a[1]))),
            section('Link-offs', bars(d.clicks.map((c) => [c.detail, c.n]))),
        ]),
        d.totp ? null : el('p', { class: 'notice', text: 'Two-factor is off. To turn it on: add the TOTP secret (see ~/.config/site-api/totp-uri.txt) to an authenticator app, then set TOTP_ENABLED=1 in ~/.config/site-api/admin.' }),
    ]);
}
