// Drifting contour lines behind the hero, like a topo map that will not sit still.
// Cheap on purpose: ~34 polylines x 96 points of 2D noise per frame, only while the hero
// is on screen and the tab is visible. The pointer pushes the lines apart as it passes.
import { noise2 } from './noise.js?v=fe06d338';

const LINES = 34;
const STEPS = 96;

export function initContour(reduced) {
    const canvas = document.getElementById('contour');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
    let w = 0;
    let h = 0;
    let t = 0;
    let raf = 0;
    let visible = true;
    let color = '#ece7dc';

    function readColor() {
        color = getComputedStyle(document.documentElement).getPropertyValue('--chalk').trim() || color;
    }

    function resize() {
        const dpr = Math.min(1.5, window.devicePixelRatio || 1);
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        readColor();
        if (reduced) draw();
    }

    function draw() {
        ctx.clearRect(0, 0, w, h);
        pointer.x += (pointer.tx - pointer.x) * 0.08;
        pointer.y += (pointer.ty - pointer.y) * 0.08;
        ctx.strokeStyle = color;
        ctx.lineJoin = 'round';
        for (let i = 0; i < LINES; i++) {
            const base = ((i + 0.5) / LINES) * h;
            const index = i % 5 === 0;
            ctx.lineWidth = index ? 1.1 : 0.7;
            ctx.globalAlpha = index ? 0.22 : 0.11;
            ctx.beginPath();
            for (let s = 0; s <= STEPS; s++) {
                const x = (s / STEPS) * w;
                const n = noise2(x * 0.0014 + t * 0.06, base * 0.0024 + i * 0.09 - t * 0.025);
                const dx = x - pointer.x;
                const dy = base - pointer.y;
                const push = 70 * Math.exp(-(dx * dx + dy * dy) / 26000) * (dy < 0 ? -1 : 1);
                const y = base + n * 34 + push;
                if (s === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    function loop() {
        if (!visible || document.hidden) {
            raf = 0;
            return;
        }
        draw();
        t += 0.014;
        raf = requestAnimationFrame(loop);
    }

    function wake() {
        if (!raf && !reduced) raf = requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener('resize', resize);
    new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        wake();
    }).observe(canvas);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('theme-change', readColor);
    if (reduced) return;
    window.addEventListener(
        'pointermove',
        (e) => {
            const r = canvas.getBoundingClientRect();
            pointer.tx = e.clientX - r.left;
            pointer.ty = e.clientY - r.top;
        },
        { passive: true },
    );
    document.addEventListener('pointerleave', () => {
        pointer.tx = -9999;
        pointer.ty = -9999;
    });
    wake();
}
