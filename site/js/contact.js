// Contact form. POSTs to /api/contact; the board emails Gabe through its own mailbox
// (api/mail.py). The "website" field is a honeypot: hidden from people, filled by bots.
// On send the button folds itself into a paper plane (fold.js) which then flies off (plane.js).
import { foldButton, unfoldButton } from './fold.js?v=943620da';
import { flyPlane } from './plane.js?v=943620da';

const ADDRESS = 'gabe@gabevandevere.com';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function initContact() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    const button = form.querySelector('button[type=submit]');
    const label = button.querySelector('.send-label');
    const note = document.getElementById('contact-note');
    let busy = false;
    const say = (text, ok) => {
        note.textContent = text;
        note.classList.toggle('is-ok', !!ok);
        note.hidden = false;
    };
    async function takeOff() {
        if (reduced()) return;
        await foldButton(button);
        button.classList.add('is-away');
        flyPlane(button, -45);
        await wait(1600);
    }
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = form.elements.body.value.trim();
        if (!body || busy) return;
        busy = true;
        const payload = { subject: form.elements.subject.value.trim(), body, from: form.elements.from.value.trim(), website: form.elements.website.value };
        button.disabled = true;
        note.hidden = true;
        const request = fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'Sending failed.');
            });
        const flight = takeOff();
        try {
            await request;
            await flight;
            say('Sent. It landed in my inbox — I’ll write back.', true);
            form.reset();
            label.textContent = 'Sent ✓';
        } catch (err) {
            await flight;
            say(`${err.message} (${ADDRESS})`, false);
            label.textContent = 'Try again →';
            button.disabled = false;
        } finally {
            unfoldButton(button);
            busy = false;
        }
    });
}
