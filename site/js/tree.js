// The variants: every fork of a passage, drawn as a small stemma (the family tree textual
// critics draw of a manuscript's copies). A is the baked original; B, C... are the visitor's
// forks, each branching off its parent at the word that was changed. Buttons do the work;
// the drawing is decoration.
import { show } from './tokens.js?v=1e12842c';

const NS = 'http://www.w3.org/2000/svg';
const SIGLA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const siglum = (n) => SIGLA[n % SIGLA.length] + (n >= SIGLA.length ? n : '');

function line(svg, cls, x1, y1, x2, y2) {
    const l = document.createElementNS(NS, 'path');
    l.setAttribute('class', cls);
    l.setAttribute('d', `M${x1} ${y1} C${x1 + 10} ${y1} ${x1} ${y2} ${x1 + 12} ${y2} L${x2} ${y2}`);
    svg.append(l);
}

export function drawTree(box, passage) {
    const { versions, current } = passage;
    if (versions.length < 2) {
        box.innerHTML = '<p class="var-hint mono">No variants yet. Pick a different word above to generate one.</p>';
        return;
    }
    const W = 220, row = 18, H = versions.length * row + 6;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'stemma');
    svg.setAttribute('aria-hidden', 'true');
    const y = (v) => 10 + v.id * row;
    const x = (v, i) => 6 + (W - 16) * Math.min(1, i / Math.max(1, v.tokens.length));
    for (const v of versions) {
        const cls = `st-line b${v.id % 5}${v.id === current.id ? ' is-current' : ''}`;
        if (v.parent == null) line(svg, cls, 6, y(v), W - 10, y(v));
        else {
            const par = versions[v.parent];
            line(svg, cls, x(par, v.at), y(par), Math.max(x(par, v.at) + 14, W - 10), y(v));
        }
    }
    const list = document.createElement('ol');
    list.className = 'var-list mono';
    for (const v of versions) {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `var-btn b${v.id % 5}` + (v.id === current.id ? ' is-current' : '');
        b.setAttribute('aria-pressed', v.id === current.id ? 'true' : 'false');
        const what = v.parent == null ? 'original' : `“${show(v.tokens[v.at].was)}” → “${show(v.tokens[v.at].t)}”`;
        const tail = v.status === 'writing' ? ' · writing…' : v.status === 'stopped' ? ' · stopped' : v.status === 'error' ? ' · error' : '';
        b.innerHTML = `<b>${siglum(v.id)}</b><span></span>`;
        b.querySelector('span').textContent = what + tail;
        b.addEventListener('click', () => passage.switchTo(v.id));
        li.append(b);
        list.append(li);
    }
    const label = Object.assign(document.createElement('p'), { className: 'var-label mono', textContent: `Variants · ${versions.length}` });
    box.replaceChildren(label, svg, list);
}
