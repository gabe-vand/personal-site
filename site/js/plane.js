// Paper airplane: launched from an element, it flies across the viewport, does a loop-de-loop
// and exits stage right, leaving a dashed trail. The trail is a path rebuilt from where the
// plane has actually been (so it never runs ahead), and "wind" nudges the plane sideways off
// its ideal route. Pure SVG + rAF, no inline styles (CSP). Used by contact.js on send.
const NS = 'http://www.w3.org/2000/svg';
const DURATION = 3200; // ms
const STEP = 6; // px of travel between trail samples

function el(name, attrs) {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
}

function route(sx, sy, vw, vh) {
    // Lift off the button, loop about a third of the way across, then climb out the right edge.
    const r = Math.min(150, vw * 0.16, vh * 0.2);
    const lx = sx + Math.max(200, vw * 0.3);
    const ly = Math.max(sy - 140, r * 2 + 40);
    const ex = vw + 120;
    const ey = Math.max(60, Math.min(ly - 220, vh * 0.25));
    return `M ${sx} ${sy} C ${sx + 80} ${sy - 10}, ${lx - 160} ${ly + 30}, ${lx} ${ly}` +
        ` a ${r} ${r} 0 1 0 0 ${-2 * r} a ${r} ${r} 0 1 0 0 ${2 * r}` +
        ` C ${lx + 200} ${ly - 40}, ${ex - 260} ${ey + 80}, ${ex} ${ey}`;
}

// Wind: two sine gusts of different periods plus a slow drift, applied across the direction of travel.
function gust(len) {
    return 14 * Math.sin(len * 0.021) + 7 * Math.sin(len * 0.057 + 1.3) + 4 * Math.sin(len * 0.0045);
}

export function flyPlane(from) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = from.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const svg = el('svg', { class: 'plane-layer', 'aria-hidden': 'true', viewBox: `0 0 ${vw} ${vh}` });
    const guide = el('path', { d: route(box.left + box.width / 2, box.top + box.height / 2, vw, vh), fill: 'none', stroke: 'none' });
    const trail = el('path', { class: 'plane-trail', d: '', fill: 'none' });
    const plane = el('path', { class: 'plane-body', d: 'M 0 0 L -44 -20 L -30 0 L -44 20 Z' });
    const total = guide.getTotalLength();
    const ease = (u) => 1 - Math.pow(1 - u, 1.7);
    let sampled = 0;
    let d = '';
    let start;

    function pointAt(len) {
        // Ideal point on the route, shoved sideways by the wind (along the route's normal).
        const p = guide.getPointAtLength(len);
        const q = guide.getPointAtLength(Math.min(total, len + 2));
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const n = Math.hypot(dx, dy) || 1;
        const w = gust(len);
        return { x: p.x - (dy / n) * w, y: p.y + (dx / n) * w };
    }
    function place(len) {
        const a = pointAt(len);
        const b = pointAt(Math.min(total, len + 3));
        const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        plane.setAttribute('transform', `translate(${a.x} ${a.y}) rotate(${angle})`);
    }
    function frame(now) {
        start ??= now;
        const u = Math.min(1, (now - start) / DURATION);
        const len = ease(u) * total;
        place(len);
        while (sampled <= len) {
            const s = pointAt(sampled);
            d += (d ? ' L ' : 'M ') + `${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
            sampled += STEP;
        }
        trail.setAttribute('d', d);
        if (u < 1) return requestAnimationFrame(frame);
        svg.classList.add('is-done');
        setTimeout(() => svg.remove(), 1000);
    }

    place(0); // position it before it is ever painted
    svg.append(guide, trail, plane);
    document.body.appendChild(svg);
    requestAnimationFrame(frame);
}
