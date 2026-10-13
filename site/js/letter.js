// The letter to Gabe: POST /api/contact. No model involved. On send the button folds into a
// paper plane and flies off (paperplane.js), and comes back once the request has settled.
import { launchPlane } from './paperplane.js?v=76bf21f9';
import { getIds, track } from './track.js?v=76bf21f9';
export function initLetter() {
    const form = document.getElementById('letter');
    if (!form) return;
    const note = document.getElementById('letter-note');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        const btn = form.querySelector('button');
        btn.disabled = true;
        note.textContent = '';
        const flight = launchPlane(btn);
        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: data.subject || '', body: data.body || '', from: data.from || '', vid: getIds().vid }),
            });
            const out = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(out.error || 'Couldn’t send.');
            await flight;
            track('contact', 'sent');
            form.reset();
            note.textContent = 'Sent. Thanks.';
            form.classList.add('is-sent');
        } catch (err) {
            await flight;
            note.textContent = `${err.message} Or write to gabe@gabevandevere.com.`;
        } finally {
            btn.classList.remove('is-away');
            btn.disabled = false;
        }
    });
}
