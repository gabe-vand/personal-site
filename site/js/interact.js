// Pointer and keyboard for a passage. Pointing at a word (or tapping it) unrolls its reel;
// the manuscript is one tab stop, with the arrow keys moving word to word inside it.
import { openReel, closeReel, closeSoon, hoverable } from './reel.js?v=76bf21f9';
import { linkHover } from './seismo.js?v=76bf21f9';

export function wire(p) {
    let hoverTimer = 0;
    p.active = -1;

    const tokAt = (i) => p.ms.querySelector(`.tok[data-i="${i}"]`);
    const light = (i) => {
        p.ms.querySelectorAll('.is-lit').forEach((s) => s.classList.remove('is-lit'));
        const el = i == null ? null : tokAt(i);
        if (el) el.classList.add('is-lit');
    };

    p.ms.addEventListener('pointerover', (e) => {
        const el = e.target.closest('.tok');
        if (!el || !hoverable || p.current.status === 'writing') return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => {
            p.finishReplay();
            openReel(p, +el.dataset.i, el);
        }, 140);
    });
    p.ms.addEventListener('pointerout', (e) => {
        if (!e.target.closest('.tok') || !hoverable) return;
        clearTimeout(hoverTimer);
        closeSoon();
    });
    p.ms.addEventListener('click', (e) => {
        const el = e.target.closest('.tok');
        p.finishReplay();
        if (el) openReel(p, +el.dataset.i, el);
    });

    p.ms.addEventListener('focus', () => {
        if (!p.ms.matches(':focus-visible')) return;  // a click, not a Tab: the click handler takes it
        p.finishReplay();
        if (p.active < 0 || p.active >= p.tokens.length) move(0);
    });
    p.ms.addEventListener('blur', () => p.ms.querySelectorAll('.is-key').forEach((s) => s.classList.remove('is-key')));
    p.ms.addEventListener('keydown', (e) => {
        const n = p.tokens.length;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(Math.min(n - 1, p.active + 1));
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(Math.max(0, p.active - 1));
        else if (e.key === 'Home') move(0);
        else if (e.key === 'End') move(n - 1);
        else if (e.key === 'Enter' || e.key === ' ') {
            const el = tokAt(p.active);
            if (el) openReel(p, p.active, el, { focus: true });
        } else if (e.key === 'Escape') closeReel();
        else return;
        e.preventDefault();
    });

    function move(i) {
        p.active = i;
        p.ms.querySelectorAll('.is-key').forEach((s) => s.classList.remove('is-key'));
        const el = tokAt(i);
        if (!el) return;
        el.classList.add('is-key');
        closeReel();
        el.scrollIntoView({ block: 'nearest' });
    }

    linkHover(p.svg, light);
}
