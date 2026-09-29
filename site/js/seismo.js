// The hesitation seismograph in the left margin. One sample per token, placed at the token's
// own line, sliding down through the line as the word moves right: read top to bottom, the
// trace is the passage. It swings left where the model was unsure. Real numbers, no smoothing.
import { hesitation } from './tokens.js?v=e7bfc830';

const NS = 'http://www.w3.org/2000/svg';

function el(name, attrs) {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
}

export function samples(ms, tokens) {
    const box = ms.getBoundingClientRect();
    const lineH = parseFloat(getComputedStyle(ms).lineHeight) || 40;
    const out = [];
    for (const span of ms.querySelectorAll('.tok')) {
        const tok = tokens[+span.dataset.i];
        if (!tok) continue;
        const r = span.getBoundingClientRect();
        const frac = box.width ? (r.left + r.width / 2 - box.left) / box.width : 0;
        const mid = r.top + r.height / 2 - box.top;
        out.push({ i: +span.dataset.i, y: mid + (frac - 0.5) * lineH * 0.8, h: hesitation(tok.p) });
    }
    return out;
}

export function draw(svg, ms, tokens) {
    const w = svg.clientWidth || 56;
    const hgt = Math.max(ms.offsetHeight, 10);
    svg.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
    svg.style.height = `${hgt}px`;
    svg.replaceChildren();
    const pts = samples(ms, tokens);
    const base = w - 3;
    svg.append(el('line', { class: 'sz-base', x1: base, y1: 0, x2: base, y2: hgt }));
    for (let y = 0; y < hgt; y += 24) svg.append(el('line', { class: 'sz-tick', x1: base - 3, y1: y, x2: base, y2: y }));
    if (!pts.length) return pts;
    const x = (h) => base - h * (w - 8);
    let d = `M${base} ${Math.max(0, pts[0].y - 12).toFixed(1)}`;
    for (const p of pts) d += `L${x(p.h).toFixed(1)} ${p.y.toFixed(1)}`;
    svg.append(el('path', { class: 'sz-trace', d }));
    for (const p of pts) {
        if (p.h > 0.55) svg.append(el('circle', { class: 'sz-peak', cx: x(p.h).toFixed(1), cy: p.y.toFixed(1), r: 2.2 }));
    }
    const nib = el('circle', { class: 'sz-nib', cx: x(pts[pts.length - 1].h), cy: pts[pts.length - 1].y, r: 3 });
    svg.append(nib);
    svg.__pts = pts;
    return pts;
}

// Hovering the trace lights the word it belongs to.
export function linkHover(svg, onPick) {
    const pick = (e) => {
        const pts = svg.__pts;
        if (!pts || !pts.length) return;
        const r = svg.getBoundingClientRect();
        const y = e.clientY - r.top;
        let best = pts[0];
        for (const p of pts) if (Math.abs(p.y - y) < Math.abs(best.y - y)) best = p;
        onPick(best.i);
    };
    svg.addEventListener('pointermove', pick);
    svg.addEventListener('pointerleave', () => onPick(null));
}
