// Scroll reveals (added only when JS runs, so nothing is hidden without it) and the
// Konami code, which flips the page into MAXN_SUPER mode.
import { burst } from './chalk.js?v=fe06d338';

const REVEAL = '.about-lede, .about-facts, .pitch-head, .machine-intro, .chat, .telemetry, .contact-form, .contact-alt';
const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export function initReveal(reduced) {
    if (reduced) return;
    const io = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                entry.target.classList.add('is-in');
                io.unobserve(entry.target);
            }
        },
        { threshold: 0.1, rootMargin: '0px 0px -5% 0px' },
    );
    document.querySelectorAll(REVEAL).forEach((el) => {
        el.classList.add('reveal');
        io.observe(el);
    });
}

export function initKonami() {
    let i = 0;
    window.addEventListener('keydown', (e) => {
        if (e.key === CODE[i]) i += 1;
        else i = e.key === CODE[0] ? 1 : 0;
        if (i < CODE.length) return;
        i = 0;
        const root = document.documentElement;
        const on = root.dataset.theme !== 'maxn';
        if (on) root.dataset.theme = 'maxn';
        else delete root.dataset.theme;
        window.dispatchEvent(new Event('theme-change'));
        burst(window.innerWidth / 2, window.innerHeight / 2, 220);
        toast(on ? 'MAXN_SUPER mode: engaged' : 'back to 15 W mode');
    });
}

function toast(message) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    document.body.append(el);
    el.addEventListener('animationend', () => el.remove());
}
