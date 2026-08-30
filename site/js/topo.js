// Route-topo navigation: draws a chalk line through the holds, fills it with scroll
// progress, and marks the hold for the section currently on screen. Works for the
// vertical rail (desktop) and the horizontal bar (phones) because it measures the dots.
export function initTopo() {
    const nav = document.querySelector('.topo');
    if (!nav) return;
    const holds = [...nav.querySelectorAll('.hold')];
    const svg = nav.querySelector('.topo-line');
    const track = svg.querySelector('.topo-track');
    const progress = svg.querySelector('.topo-progress');
    const sections = holds.map((h) => document.querySelector(h.getAttribute('href')));
    let length = 0;

    function layout() {
        const nr = nav.getBoundingClientRect();
        svg.setAttribute('viewBox', `0 0 ${nr.width} ${nr.height}`);
        const pts = holds.map((h) => {
            const d = h.querySelector('.hold-dot').getBoundingClientRect();
            return { x: d.left + d.width / 2 - nr.left, y: d.top + d.height / 2 - nr.top };
        });
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1];
            const b = pts[i];
            const horizontal = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
            const off = (i % 2 ? 1 : -1) * 7;
            const cx = horizontal ? (a.x + b.x) / 2 : a.x + off;
            const cy = horizontal ? a.y + off : (a.y + b.y) / 2;
            d += ` Q ${cx} ${cy} ${b.x} ${b.y}`;
        }
        track.setAttribute('d', d);
        progress.setAttribute('d', d);
        length = progress.getTotalLength();
        progress.style.strokeDasharray = `${length}`;
        update();
    }

    function update() {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
        progress.style.strokeDashoffset = `${length * (1 - p)}`;
        const mid = window.innerHeight * 0.45;
        let idx = 0;
        sections.forEach((s, i) => {
            if (s && s.getBoundingClientRect().top <= mid) idx = i;
        });
        if (p > 0.995) idx = holds.length - 1;
        holds.forEach((h, i) => {
            h.classList.toggle('is-here', i === idx);
            h.classList.toggle('is-past', i < idx);
            if (i === idx) h.setAttribute('aria-current', 'location');
            else h.removeAttribute('aria-current');
        });
    }

    let ticking = false;
    window.addEventListener(
        'scroll',
        () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                update();
                ticking = false;
            });
        },
        { passive: true },
    );
    window.addEventListener('resize', layout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    layout();
}
