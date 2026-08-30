// Paper airplane: launched from an element, it drifts across the viewport on a breeze, does a
// loop-de-loop and glides out the right edge. Breeze = two slow, long-period
// swells across the route plus a lagged heading and a bank on lateral drift, so it floats rather
// than zig-zags. Pure SVG + rAF, no inline styles (CSP). Used by contact.js on send.
const NS = 'http://www.w3.org/2000/svg';
const DURATION = 3400; // ms

function el(name, attrs) {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
}

function route(sx, sy, vw, vh, deg) {
    // Leave along the launch heading, loop about a third of the way across, then climb out right.
    const r = Math.min(160, vw * 0.17, vh * 0.2);
    const lx = sx + Math.max(220, vw * 0.32);
    const ly = Math.max(sy - 150, r * 2 + 50);
    const ex = vw + 160;
    const ey = Math.max(70, Math.min(ly - 220, vh * 0.25));
    const a = (deg * Math.PI) / 180;
    const c1x = sx + Math.cos(a) * 120;
    const c1y = sy + Math.sin(a) * 120;
    return `M ${sx} ${sy} C ${c1x} ${c1y}, ${lx - 180} ${ly + 30}, ${lx} ${ly}` +
        ` a ${r} ${r} 0 1 0 0 ${-2 * r} a ${r} ${r} 0 1 0 0 ${2 * r}` +
        ` C ${lx + 220} ${ly - 40}, ${ex - 300} ${ey + 90}, ${ex} ${ey}`;
}

// Breeze across the direction of travel: two slow swells (periods ~1100 px and ~560 px).
// Faded in over the first 320 px so both its value AND slope are zero at launch: the plane
// leaves the dart with no sidestep, no heading kick and no bank.
const swell = (len) => {
    const env = Math.min(1, len / 320) ** 2;
    return env * (26 * Math.sin(len * 0.0057) + 11 * Math.sin(len * 0.0112));
};
// Progress: accelerates gently out of the button's hop (so the handoff has no velocity jump),
// then a long ease-out with a faint surge/glide rhythm, like a plane catching air.
const progress = (u) => {
    const base = u < 0.18 ? 0.26 * (u / 0.18) * (u / 0.18) : 0.26 + 0.74 * (1 - Math.pow(1 - (u - 0.18) / 0.82, 1.5));
    const surge = Math.max(0, Math.min(1, (u - 0.3) / 0.2)); // no wobble until it is well away from the button
    return Math.min(1, base + surge * 0.015 * Math.sin(u * Math.PI * 3));
};
const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/** Fly from the centre of `from` (an element) heading `startDeg` (screen degrees, negative = up). */
export function flyPlane(from, startDeg = -20) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = from.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const svg = el('svg', { class: 'plane-layer', 'aria-hidden': 'true', viewBox: `0 0 ${vw} ${vh}` });
    const guide = el('path', { d: route(box.left + box.width / 2, box.top + box.height / 2, vw, vh, startDeg), fill: 'none', stroke: 'none' });
    const plane = el('g', { class: 'plane' });
    plane.append(
        // Origin is the plane's centre (nose at +46, tail at -38) so it sits exactly on the folded dart at launch.
        el('path', { class: 'plane-wing', d: 'M 46 0 L -38 -40 L -6 -5 Z' }),
        el('path', { class: 'plane-wing plane-wing-low', d: 'M 46 0 L -38 40 L -6 5 Z' }),
        el('path', { class: 'plane-keel', d: 'M 46 0 L -6 -5 L -16 13 L -6 5 Z' }),
    );
    const total = guide.getTotalLength();
    let heading = (startDeg * Math.PI) / 180;
    let bank = 0;
    let start;

    function pointAt(len) {
        const p = guide.getPointAtLength(len);
        const q = guide.getPointAtLength(Math.min(total, len + 2));
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const n = Math.hypot(dx, dy) || 1;
        const w = swell(len);
        return { x: p.x - (dy / n) * w, y: p.y + (dx / n) * w };
    }
    // Size over the flight: the folded dart's size, held while it leaves the button, then swelling
    // toward the viewer through the loop and settling as it exits.
    const size = (u) => 0.72 + 0.5 * smooth((u - 0.14) / 0.42) - 0.3 * smooth((u - 0.68) / 0.32);
    function place(len, u) {
        const a = pointAt(len);
        const b = pointAt(Math.min(total, len + 4));
        let target = Math.atan2(b.y - a.y, b.x - a.x);
        let diff = target - heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
        heading += diff * 0.18; // lag: the nose settles onto the new heading rather than snapping
        // Bank into lateral drift: the swell's slope is how hard the breeze is pushing sideways.
        const push = (swell(len + 6) - swell(len - 6)) / 12;
        bank += (Math.max(-1, Math.min(1, push * 1.6)) - bank) * 0.08;
        const deg = (heading * 180) / Math.PI;
        const k = size(u);
        plane.setAttribute('transform', `translate(${a.x.toFixed(1)} ${a.y.toFixed(1)}) rotate(${deg.toFixed(1)}) scale(${k.toFixed(3)} ${(k * (1 - Math.abs(bank) * 0.55)).toFixed(3)})`);
    }
    function frame(now) {
        start ??= now;
        const u = Math.min(1, (now - start) / DURATION);
        const len = progress(u) * total;
        place(len, u);
        if (u < 1) return requestAnimationFrame(frame);
        svg.classList.add('is-done');
        setTimeout(() => svg.remove(), 1000);
    }

    place(0, 0); // position it before it is ever painted
    svg.append(guide, plane);
    document.body.appendChild(svg);
    requestAnimationFrame(frame);
}
