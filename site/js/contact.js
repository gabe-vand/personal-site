// Contact form. POSTs to /api/contact; the board emails Gabe through its own mailbox
// (api/mail.py). The "website" field is a honeypot: hidden from people, filled by bots.
import { flyPlane } from './plane.js?v=1f5bd0fe';

const ADDRESS = 'gabe@gabevandevere.com';

export function initContact() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    const button = form.querySelector('button[type=submit]');
    const note = document.getElementById('contact-note');
    const say = (text, ok) => {
        note.textContent = text;
        note.classList.toggle('is-ok', !!ok);
        note.hidden = false;
    };
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = form.elements.body.value.trim();
        if (!body) return;
        const payload = { subject: form.elements.subject.value.trim(), body, from: form.elements.from.value.trim(), website: form.elements.website.value };
        button.disabled = true;
        button.textContent = 'Sending…';
        flyPlane(button);
        try {
            const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Sending failed.');
            say('Sent. It landed in my inbox — I’ll write back.', true);
            form.reset();
            button.textContent = 'Sent ✓';
        } catch (err) {
            say(`${err.message} (${ADDRESS})`, false);
            button.disabled = false;
            button.textContent = 'Try again →';
        }
    });
}
