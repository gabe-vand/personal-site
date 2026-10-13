// A one-time note in the margin of the first folio, written from the real numbers: the page's
// first word and the runner-up the model weighed against it.
// It is placed at load (no layout shift mid-read) and folds away after the first reel closes.
import { runnerUp, isFavourite, show, pct } from './tokens.js?v=aa2f1113';

export function coach(p) {
    const tok = p.tokens[0];
    const r = tok && runnerUp(tok);
    let seen = false;
    try { seen = !!sessionStorage.getItem('almost-coached'); } catch { /* storage blocked */ }
    if (!r || seen || document.querySelector('.coach')) return;
    const note = document.createElement('p');
    note.className = 'coach';
    note.innerHTML = '<span class="mono">Try it.</span> <span></span>';
    const other = isFavourite(tok) ? 'its next choice' : 'its top choice';
    note.lastChild.textContent = `The model gave this word ${pct(tok.p)}; ${other} would have started “${show(r.t)}…”. Choose that and it rewrites the rest.`;
    // In the flow, under the question, so it covers nothing and nothing it points at moves
    // while a reel is open. It folds away after the first reel closes.
    p.section.querySelector('.folio-head').append(note);
    requestAnimationFrame(() => note.classList.add('is-in'));
    const fold = () => {
        note.style.height = `${note.offsetHeight}px`;
        requestAnimationFrame(() => note.classList.add('is-gone'));
        setTimeout(() => { note.remove(); p.redraw(); }, 500);
        try { sessionStorage.setItem('almost-coached', '1'); } catch { /* private mode */ }
    };
    document.addEventListener('reel:open', () => document.addEventListener('reel:close', fold, { once: true }), { once: true });
}
