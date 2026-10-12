// The reel: point at a word and it unrolls into every candidate the model weighed there,
// the chosen one sitting exactly where the word was, the others rolled out above and below.
// Choose another and the passage forks from that word.
import { show, pct } from './tokens.js?v=ac8e6355';

const reel = document.getElementById('reel');
const hoverable = matchMedia('(hover: hover) and (pointer: fine)').matches;
let open = null;     // { passage, i, el }
let closeTimer = 0;

export const reelFor = () => open;

export function openReel(passage, i, el, { focus = false } = {}) {
    clearTimeout(closeTimer);
    if (open && open.el === el) return;
    const tok = passage.tokens[i];
    if (!tok || !tok.alts || !tok.alts.length) return closeReel();
    if (open) open.el.classList.remove('is-open');
    open = { passage, i, el };
    el.classList.add('is-open');
    const alts = tok.alts.some((a) => a.t === tok.t) ? tok.alts : [...tok.alts, { t: tok.t, p: tok.p }];
    const head = Object.assign(document.createElement('p'), { className: 'reel-head mono' });
    head.textContent = `word ${i + 1} · ${alts.length} options`;
    const seen = alts.map((a) => show(a.t));
    const label = (a, k) => (seen.indexOf(seen[k]) !== seen.lastIndexOf(seen[k]) && !/^\s/.test(a.t) ? `‿${seen[k]}` : seen[k]);
    const rows = alts.map((a, k) => row(a, k, a.t === tok.t, tok, alts[0], label(a, k)));
    const foot = Object.assign(document.createElement('p'), { className: 'reel-foot mono' });
    foot.textContent = passage.canFork(i) ? 'pick another word to rewrite from here' : passage.whyNot(i);
    reel.replaceChildren(head, ...rows, foot);
    reel.hidden = false;
    place(el, rows[alts.findIndex((a) => a.t === tok.t)]);
    document.dispatchEvent(new CustomEvent('reel:open'));
    rows.forEach((r) => r.addEventListener('click', () => choose(r, alts)));
    if (focus) (rows.find((r) => !r.disabled) || rows[0]).focus();
}

function row(alt, k, chosen, tok, top, text) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'reel-row' + (chosen ? ' is-chosen' : '');
    b.dataset.k = k;
    b.setAttribute('role', 'option');
    b.setAttribute('aria-selected', chosen ? 'true' : 'false');
    const word = Object.assign(document.createElement('span'), { className: 'rr-t', textContent: text });
    const bar = Object.assign(document.createElement('span'), { className: 'rr-bar' });
    const fill = document.createElement('i');
    fill.style.width = `${Math.max(1.5, (alt.p || 0) * 100)}%`;
    bar.append(fill);
    const p = Object.assign(document.createElement('span'), { className: 'rr-p mono', textContent: pct(alt.p) });
    b.append(word, bar, p);
    if (chosen) {
        const tag = alt === top ? 'chosen' : 'chosen · not its favourite';
        b.append(Object.assign(document.createElement('span'), { className: 'rr-tag mono', textContent: tok.forked ? 'your choice' : tag }));
        b.setAttribute('aria-disabled', 'true');
    }
    b.setAttribute('aria-label', `${text}, ${pct(alt.p)}${chosen ? ', chosen' : ''}`);
    return b;
}

function place(el, chosenRow) {
    const r = el.getBoundingClientRect();
    const rw = reel.offsetWidth;
    const left = Math.min(Math.max(8, r.left + scrollX - 18), scrollX + innerWidth - rw - 8);
    const rowTop = chosenRow ? chosenRow.offsetTop + chosenRow.offsetHeight / 2 : 0;
    reel.style.left = `${left}px`;
    reel.style.top = `${r.top + scrollY + r.height / 2 - rowTop}px`;
    for (const rowEl of reel.querySelectorAll('.reel-row')) {
        rowEl.style.setProperty('--from', `${rowTop - (rowEl.offsetTop + rowEl.offsetHeight / 2)}px`);
    }
    reel.classList.remove('is-in');
    void reel.offsetWidth;
    reel.classList.add('is-in');
}

function choose(rowEl, alts) {
    if (!open || rowEl.getAttribute('aria-disabled') === 'true') return;
    const { passage, i } = open;
    if (!passage.canFork(i)) return;
    closeReel();
    passage.fork(i, alts[+rowEl.dataset.k]);
}

export function closeReel({ refocus = false } = {}) {
    clearTimeout(closeTimer);
    if (!open) return;
    open.el.classList.remove('is-open');
    if (refocus) open.passage.ms.focus();
    open = null;
    reel.hidden = true;
    document.dispatchEvent(new CustomEvent('reel:close'));
}

export function closeSoon() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => closeReel(), 260);
}

export function bindReel() {
    reel.addEventListener('pointerenter', () => clearTimeout(closeTimer));
    reel.addEventListener('pointerleave', () => { if (hoverable) closeSoon(); });
    reel.addEventListener('keydown', (e) => {
        const rows = [...reel.querySelectorAll('.reel-row')];
        const at = rows.indexOf(document.activeElement);
        if (e.key === 'Escape') { e.preventDefault(); closeReel({ refocus: true }); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            rows[(at + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length].focus();
        }
    });
    document.addEventListener('pointerdown', (e) => {
        if (open && !reel.contains(e.target) && e.target !== open.el && !open.el.contains(e.target)) closeReel();
    });
    addEventListener('resize', () => closeReel());
}

export { hoverable };
