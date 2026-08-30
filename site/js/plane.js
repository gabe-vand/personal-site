// Paper airplane: launched from an element, it flies across the viewport, does a loop-de-loop
// and exits stage right, leaving a dotted trail that fades. Pure SVG + rAF (no inline styles,
// so it lives within the CSP). Used by contact.js when a message is sent.
const NS = 'http://www.w3.org/2000/svg';
const DURATION = 2600; // ms
const DOT_EVERY = 14; // px of travel between trail dots

function el(name, attrs) {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
}

function route(sx, sy, vw) {
    // Rise off the button, loop a little past a third of the way, then climb out right.
    const r = Math.min(70, vw * 0.09);
    const lx = sx + Math.max(160, vw * 0.28);
    const ly = sy - 120;
    const ex = vw + 80;
    const ey = Math.max(40, sy - 360);
    return `M ${sx} ${sy} C ${sx + 60} ${sy - 10}, ${lx - 120} ${ly + 20}, ${lx} ${ly}` +
        ` a ${r} ${r} 0 1 0 0 ${-2 * r} a ${r} ${r} 0 1 0 0 ${2 * r}` +
        ` C ${lx + 140} ${ly - 30}, ${ex - 200} ${ey + 60}, ${ex} ${ey}`;
}

export function flyPlane(from) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = from.getBoundingClientRect();
    const vw = window.innerWidth;
    const svg = el('svg', { class: 'plane-layer', 'aria-hidden': 'true', viewBox: `0 0 ${vw} ${window.innerHeight}` });
    const path = el('path', { d: route(box.left + box.width / 2, box.top + box.height / 2, vw), fill: 'none' });
    const trail = el('g', { class: 'plane-trail' });
    const plane = el('path', { class: 'plane-body', d: 'M 0 0 L -18 -8 L -12 0 L -18 8 Z' });
    svg.append(path, trail, plane);
    document.body.appendChild(svg);

    const total = path.getTotalLength();
    const ease = (u) => 1 - Math.pow(1 - u, 1.6);
    let lastDot = -DOT_EVERY;
    let start;
    function frame(now) {
        start ??= now;
        const u = Math.min(1, (now - start) / DURATION);
        const len = ease(u) * total;
        const p = path.getPointAtLength(len);
        const q = path.getPointAtLength(Math.min(total, len + 2));
        const angle = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
        plane.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${angle})`);
        while (len - lastDot >= DOT_EVERY) {
            lastDot += DOT_EVERY;
            const d = path.getPointAtLength(lastDot);
            trail.appendChild(el('circle', { cx: d.x, cy: d.y, r: 1.6 }));
        }
        if (u < 1) return requestAnimationFrame(frame);
        svg.classList.add('is-done');
        setTimeout(() => svg.remove(), 900);
    }
    requestAnimationFrame(frame);
}
