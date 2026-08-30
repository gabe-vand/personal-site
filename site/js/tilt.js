// Project cards lean toward the pointer. Sets CSS custom properties only; the stylesheet
// does the transform. Skipped on touch screens and under prefers-reduced-motion.
export function initTilt(reduced) {
    if (reduced || !window.matchMedia('(hover: hover)').matches) return;
    document.querySelectorAll('.card').forEach((card) => {
        card.addEventListener('pointermove', (e) => {
            const r = card.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width;
            const y = (e.clientY - r.top) / r.height;
            card.style.setProperty('--ry', `${((x - 0.5) * 9).toFixed(2)}deg`);
            card.style.setProperty('--rx', `${((0.5 - y) * 9).toFixed(2)}deg`);
            card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
            card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
        });
        card.addEventListener('pointerleave', () => {
            card.style.removeProperty('--rx');
            card.style.removeProperty('--ry');
        });
    });
}
