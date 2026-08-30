// The Send button becomes a paper plane. ONE SVG group does everything: it appears over the
// button as a chalk sheet, folds into a dart (vertex keyframes adapted from Aaron Iker's
// paper-plane button), then flies the route while its facets morph into a slender in-flight
// plane. No handoff between renderers, so nothing pops. Pure SVG + rAF (CSP-clean).
const NS = 'http://www.w3.org/2000/svg';
const FOLD_MS = 1140;
const FLIGHT_MS = 3400;
const AWAY_MS = 1500; // how long after launch the caller may bring the button back

// Four facets, each 3 points, in % of the button box (nose ends up at the top centre).
const REST = { lw: [0, 0, 50, 0, 0, 100], lb: [51, 0, 51, 100, 0, 100], rw: [49, 0, 100, 0, 100, 100], rb: [49, 0, 49, 100, 100, 100], rot: 0, sheet: 1, shade: 0 };
const FOLD = [
    { ms: 110, to: { sheet: 0 } },
    { ms: 200, set: { shade: 1 }, to: { lw: [50, 100, 50, 0, 0, 100], rw: [49, 0, 50, 100, 100, 100] } },
    { ms: 200, set: { lw: [50, 0, 40, 100, 0, 100], lb: [51, 0, 51, 100, 40, 100], rw: [50, 0, 60, 100, 100, 100], rb: [49, 0, 49, 100, 60, 100], shade: 2 },
      to: { lw: [50, 0, 40, 90, 20, 90], lb: [51, 0, 51, 100, 40, 90], rw: [50, 0, 60, 90, 80, 90], rb: [49, 0, 49, 100, 60, 90] } },
    { ms: 250, set: { shade: 3 }, to: { rot: 50, lw: [50, 0, 40, 90, 27, 95], rw: [50, 0, 45, 90, 60, 83], rb: [49, 0, 49, 100, 45, 90] } },
    { ms: 220, to: { rot: 58 } },
    { ms: 160, to: { rot: 45 } },
];
// In-flight shape, in px, nose up (local -y), centred on the plane's middle.
const FLIGHT = { lw: [0, -46, -40, 38, -5, 6], lb: [0, -46, -5, 6, 0, 16], rw: [0, -46, 40, 38, 5, 6], rb: [0, -46, 5, 6, 0, 16] };
const FACETS = ['lb', 'rb', 'lw', 'rw']; // bodies first so wings draw on top

const el = (name, attrs) => { const n = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
const lerp = (a, b, t) => a + (b - a) * t;
const inout = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const progress = (u) => (u < 0.18 ? 0.26 * (u / 0.18) ** 2 : 0.26 + 0.74 * (1 - Math.pow(1 - (u - 0.18) / 0.82, 1.5)));
const swell = (len) => Math.min(1, len / 320) ** 2 * (26 * Math.sin(len * 0.0057) + 11 * Math.sin(len * 0.0112));
const size = (u) => 1 + 0.45 * smooth((u - 0.2) / 0.4) - 0.35 * smooth((u - 0.68) / 0.32);

function route(sx, sy, vw, vh, deg) {
    const r = Math.min(160, vw * 0.17, vh * 0.2);
    const lx = sx + Math.max(220, vw * 0.32);
    const ly = Math.max(sy - 150, r * 2 + 50);
    const ex = vw + 160;
    const ey = Math.max(70, Math.min(ly - 220, vh * 0.25));
    const a = (deg * Math.PI) / 180;
    return `M ${sx} ${sy} C ${sx + Math.cos(a) * 120} ${sy + Math.sin(a) * 120}, ${lx - 180} ${ly + 30}, ${lx} ${ly}` +
        ` a ${r} ${r} 0 1 0 0 ${-2 * r} a ${r} ${r} 0 1 0 0 ${2 * r} C ${lx + 220} ${ly - 40}, ${ex - 300} ${ey + 90}, ${ex} ${ey}`;
}

/** Fold the button into a plane and fly it away. Resolves once the button may come back. */
export function launchPlane(button) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
    const box = button.getBoundingClientRect();
    const w = box.width, h = box.height, cx = box.left + w / 2, cy = box.top + h / 2;
    const vw = window.innerWidth, vh = window.innerHeight;
    const svg = el('svg', { class: 'plane-layer', 'aria-hidden': 'true', viewBox: `0 0 ${vw} ${vh}` });
    const guide = el('path', { d: route(cx, cy, vw, vh, -45), fill: 'none', stroke: 'none' });
    const g = el('g', { class: 'pp', 'data-shade': '0' });
    const sheet = el('rect', { class: 'pp-sheet', x: -w / 2, y: -h / 2, width: w, height: h, rx: h / 2 });
    const facets = Object.fromEntries(FACETS.map((k) => [k, el('polygon', { class: `pp-${k}` })]));
    g.append(...FACETS.map((k) => facets[k]), sheet);
    svg.append(guide, g);
    const total = guide.getTotalLength();
    const state = structuredClone(REST);
    let dart = null; // facet px coords at the end of the fold
    let heading = (-45 * Math.PI) / 180, bank = 0, start = null, step = 0, t0 = 0, from = null;

    const pct = (pts) => pts.map((v, i) => (i % 2 ? (v / 100) * h - h / 2 : (v / 100) * w - w / 2));
    const draw = (coords, transform) => {
        for (const k of FACETS) facets[k].setAttribute('points', coords[k].join(' '));
        g.setAttribute('transform', transform);
    };
    const pointAt = (len) => {
        const p = guide.getPointAtLength(len), q = guide.getPointAtLength(Math.min(total, len + 2));
        const dx = q.x - p.x, dy = q.y - p.y, n = Math.hypot(dx, dy) || 1, s = swell(len);
        return { x: p.x - (dy / n) * s, y: p.y + (dx / n) * s };
    };

    function fold(t) {
        if (from === null) { t0 = t; if (FOLD[step].set) Object.assign(state, FOLD[step].set); from = structuredClone(state); g.dataset.shade = state.shade; }
        const k = inout(Math.min(1, (t - t0) / FOLD[step].ms));
        for (const [key, target] of Object.entries(FOLD[step].to)) state[key] = Array.isArray(target) ? target.map((v, i) => lerp(from[key][i], v, k)) : lerp(from[key], target, k);
        sheet.setAttribute('opacity', state.sheet);
        draw(Object.fromEntries(FACETS.map((f) => [f, pct(state[f])])), `translate(${cx} ${cy}) rotate(${state.rot})`);
        if (k >= 1) { step += 1; from = null; }
        return step >= FOLD.length;
    }
    function fly(t) {
        const u = Math.min(1, t / FLIGHT_MS), len = progress(u) * total;
        const a = pointAt(len), b = pointAt(Math.min(total, len + 4));
        const target = Math.atan2(b.y - a.y, b.x - a.x), diff = Math.atan2(Math.sin(target - heading), Math.cos(target - heading));
        heading += diff * 0.18;
        const push = (swell(len + 6) - swell(len - 6)) / 12;
        bank += (Math.max(-1, Math.min(1, push * 1.6)) - bank) * 0.08;
        const m = smooth(u / 0.3), sc = size(u);
        const coords = Object.fromEntries(FACETS.map((f) => [f, dart[f].map((v, i) => lerp(v, FLIGHT[f][i], m))]));
        draw(coords, `translate(${a.x.toFixed(1)} ${a.y.toFixed(1)}) rotate(${((heading * 180) / Math.PI + 90).toFixed(1)}) scale(${(sc * (1 - Math.abs(bank) * 0.55)).toFixed(3)} ${sc.toFixed(3)})`);
        return u >= 1;
    }
    return new Promise((resolve) => {
        function frame(now) {
            start ??= now;
            const t = now - start;
            if (dart === null) {
                if (fold(t)) dart = Object.fromEntries(FACETS.map((f) => [f, pct(state[f])]));
                return requestAnimationFrame(frame);
            }
            if (t - FOLD_MS >= AWAY_MS) resolve();
            if (!fly(t - FOLD_MS)) return requestAnimationFrame(frame);
            resolve();
            svg.classList.add('is-done');
            setTimeout(() => svg.remove(), 1000);
        }
        fold(0);
        document.body.appendChild(svg);
        button.classList.add('is-away');
        requestAnimationFrame(frame);
    });
}
