import { api } from './api.js';
import { el, table, when, tag, section } from './ui.js';

export async function emails({ days }) {
    const d = await api(`/emails?days=${days}`);
    const detail = el('div');
    const cols = [
        { label: 'when', render: (r) => when(r.ts) },
        { label: 'kind', render: (r) => tag(r.kind, r.kind === 'notify' ? 'ai' : '') },
        { label: 'to', key: 'to_addr' },
        { label: 'reply-to', render: (r) => r.reply_to || '—' },
        { label: 'subject', key: 'subject', wrap: true },
        { label: 'status', render: (r) => (r.ok ? tag('sent', 'ok') : tag(r.error || 'failed', 'fail')) },
        { label: 'from ip', key: 'ip' },
    ];
    const show = (r) => detail.replaceChildren(
        el('h3', { text: `${when(r.ts)} · ${r.subject}` }),
        el('pre', { class: 'mail', text: `To: ${r.to_addr}\nReply-To: ${r.reply_to || '—'}\nKind: ${r.kind}\nStatus: ${r.ok ? 'sent' : `FAILED — ${r.error}`}\n\n${r.body}` }),
    );
    return el('div', { class: 'view' }, [
        el('h2', { text: 'Emails' }),
        el('p', { class: 'muted', text: 'Everything the board has sent through Zoho: contact-form messages and conversation notifications, with full bodies. Click a row to read it.' }),
        section(`${d.emails.length} emails`, table(cols, d.emails, show)),
        detail,
    ]);
}
