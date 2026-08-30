// Contact form. POSTs to /api/contact; the board emails Gabe through its own mailbox
// (api/mail.py). The "website" field is a honeypot: hidden from people, filled by bots.
// On send the button folds itself into a paper plane (fold.js) which then flies off (plane.js),
// and the form gives way to a "Sent." card. The dev "test plane" button runs the identical
// success path with a fake request, so the whole experience can be checked without emailing.
import { foldButton, unfoldButton } from './fold.js?v=75b6b9bd';
import { flyPlane } from './plane.js?v=75b6b9bd';

const ADDRESS = 'gabe@gabevandevere.com';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function initContact() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    const button = form.querySelector('button[type=submit]');
    const label = button.querySelector('.send-label');
    const note = document.getElementById('contact-note');
    const sent = document.getElementById('contact-sent');
    let busy = false;
    const say = (text, ok) => {
        note.textContent = text;
        note.classList.toggle('is-ok', !!ok);
        note.hidden = false;
    };
    async function takeOff() {
        if (reduced()) return;
        await foldButton(button);
        // Launch from where the folded dart actually is (rotation + hop) BEFORE hiding it: flyPlane measures on call.
        flyPlane(button.querySelector('.send-plane i'), -45);
        button.classList.add('is-away');
        await wait(1500);
    }
    function showSent(replyTo) {
        document.getElementById('sent-reply').textContent = replyTo ? ` to ${replyTo}` : '';
        form.classList.add('is-hidden');
        sent.hidden = false;
        sent.querySelector('.sent-title').focus?.();
    }
    async function send(request, replyTo) {
        busy = true;
        button.disabled = true;
        note.hidden = true;
        const flight = takeOff();
        try {
            await request;
            await flight;
            form.reset();
            showSent(replyTo);
        } catch (err) {
            await flight;
            say(`${err.message} (${ADDRESS})`, false);
            label.textContent = 'Try again →';
        } finally {
            unfoldButton(button);
            button.disabled = false;
            busy = false;
        }
    }
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const body = form.elements.body.value.trim();
        if (!body || busy) return;
        const payload = { subject: form.elements.subject.value.trim(), body, from: form.elements.from.value.trim(), website: form.elements.website.value };
        const request = fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Sending failed.');
        });
        send(request, payload.from);
    });
    document.getElementById('sent-again')?.addEventListener('click', () => {
        sent.hidden = true;
        form.classList.remove('is-hidden');
        label.textContent = 'Send it →';
        form.elements.subject.focus();
    });
    // Dev only: identical to a successful send, minus the email.
    document.getElementById('test-plane')?.addEventListener('click', () => {
        if (!busy) send(wait(400), form.elements.from.value.trim());
    });
}
