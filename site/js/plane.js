// Paper airplane: launched from an element, it drifts across the viewport on a breeze, does a
// loop-de-loop and glides out the right edge. Breeze = two slow, long-period
// swells across the route plus a lagged heading and a bank on lateral drift, so it floats rather
// than zig-zags. Pure SVG + rAF, no inline styles (CSP). Used by contact.js on send.
const NS = 'http://www.w3.org/2000/svg';
const DURATION = 4200; // ms

function el(name, attrs) {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
}

function route(sx, sy, vw, vh) {
    // Lift off the button, loop about a third of the way across, then climb out the right edge.
    const r = Math.min(160, vw * 0.17, vh * 0.2);
    const lx = sx + Math.max(220, vw * 0.32);
    const ly = Math.max(sy - 150, r * 2 + 50);
    const ex = vw + 160;
    const ey = Math.max(70, Math.min(ly - 220, vh * 0.25));
    return `M ${sx} ${sy} C ${sx + 90} ${sy - 10}, ${lx - 180} ${ly + 30}, ${lx} ${ly}` +
        ` a ${r} ${r} 0 1 0 0 ${-2 * r} a ${r} ${r} 0 1 0 0 ${2 * r}` +
        ` C ${lx + 220} ${ly - 40}, ${ex - 300} ${ey + 90}, ${ex} ${ey}`;
}

// Breeze across the direction of travel: two slow swells (periods ~1100 px and ~560 px).
const swell = (len) => 26 * Math.sin(len * 0.0057 + 0.6) + 11 * Math.sin(len * 0.0112 + 2.1);
// Progress: an ease-out with a gentle surge/glide rhythm layered on, like a plane catching air.
const progress = (u) => Math.min(1, 1 - Math.pow(1 - u, 1.55) + 0.02 * Math.sin(u * Math.PI * 3));

export function flyPlane(from, startDeg = null) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = from.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const svg = el('svg', { class: 'plane-layer', 'aria-hidden': 'true', viewBox: `0 0 ${vw} ${vh}` });
    const guide = el('path', { d: route(box.left + box.width / 2, box.top + box.height / 2, vw, vh), fill: 'none', stroke: 'none' });
    const plane = el('g', { class: 'plane' });
    plane.append(
        el('path', { class: 'plane-wing', d: 'M 0 0 L -64 -30 L -40 -4 Z' }),
        el('path', { class: 'plane-wing plane-wing-low', d: 'M 0 0 L -64 30 L -40 4 Z' }),
        el('path', { class: 'plane-keel', d: 'M 0 0 L -40 -4 L -48 10 L -40 4 Z' }),
    );
    const total = guide.getTotalLength();
    let heading = startDeg === null ? null : (startDeg * Math.PI) / 180;
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
    function place(len) {
        const a = pointAt(len);
        const b = pointAt(Math.min(total, len + 4));
        let target = Math.atan2(b.y - a.y, b.x - a.x);
        if (heading === null) heading = target;
        let diff = target - heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
        heading += diff * 0.18; // lag: the nose settles onto the new heading rather than snapping
        // Bank into lateral drift: the swell's slope is how hard the breeze is pushing sideways.
        const push = (swell(len + 6) - swell(len - 6)) / 12;
        bank += (Math.max(-1, Math.min(1, push * 1.6)) - bank) * 0.08;
        const deg = (heading * 180) / Math.PI;
        plane.setAttribute('transform', `translate(${a.x.toFixed(1)} ${a.y.toFixed(1)}) rotate(${deg.toFixed(1)}) scale(1 ${(1 - Math.abs(bank) * 0.55).toFixed(3)})`);
    }
    function frame(now) {
        start ??= now;
        const u = Math.min(1, (now - start) / DURATION);
        const len = progress(u) * total;
        place(len);
        if (u < 1) return requestAnimationFrame(frame);
        svg.classList.add('is-done');
        setTimeout(() => svg.remove(), 1000);
    }

    place(0); // position it before it is ever painted
    svg.append(guide, plane);
    document.body.appendChild(svg);
    requestAnimationFrame(frame);
}
