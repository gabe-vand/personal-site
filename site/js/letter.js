// The letter to Gabe: POST /api/contact. No model involved. Everything the server would reject
// is caught here first; the button folds into a paper plane (paperplane.js) only once the server
// has actually sent the email, so a plane never flies for a message that didn't go.
import { launchPlane } from './paperplane.js?v=aa2f1113';
import { getIds, track } from './track.js?v=aa2f1113';

const EMAIL = /^[^@\s]{1,64}@[^@\s]{1,190}\.[a-zA-Z]{2,}$/; // same rule as api/mail.py
const FALLBACK = 'Couldn’t send. Email gabe@gabevandevere.com instead.';

export function initLetter() {
    const form = document.getElementById('letter');
    if (!form) return;
    const note = document.getElementById('letter-note');
    const btn = form.querySelector('button');
    const fail = (msg, field) => {
        note.textContent = msg;
        field?.focus();
    };
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        const from = (data.from || '').trim(), body = (data.body || '').trim();
        if (!body) return fail('Write a message first.', form.elements.body);
        if (from && !EMAIL.test(from)) return fail('Check your email address.', form.elements.from);
        btn.disabled = true;
        note.textContent = 'Sending…';
        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: data.subject || '', body, from, vid: getIds().vid }),
            });
            const out = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(out.error || FALLBACK);
            track('contact', 'sent');
            note.textContent = '';
            await launchPlane(btn);
            form.reset();
            note.textContent = 'Sent. Thanks.';
        } catch (err) {
            note.textContent = err instanceof TypeError ? FALLBACK : err.message;
        } finally {
            btn.classList.remove('is-away');
            btn.disabled = false;
        }
    });
}
