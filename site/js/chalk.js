// Chalk burst: a puff of particles when you top out (reach the contact section), when you
// click the mark, and when the Konami code lands. ("Top out" = reaching the end of the page.) Draws on the fixed #chalk canvas.
let canvas = null;
let ctx = null;
let particles = [];
let raf = 0;
let still = false;

export function initChalk(reduced) {
    still = reduced;
    canvas = document.getElementById('chalk');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    const target = document.getElementById('contact');
    if (target) {
        let fired = false;
        new IntersectionObserver(
            (entries) => {
                if (fired || !entries[0].isIntersecting) return;
                fired = true;
                const title = target.querySelector('.pitch-title');
                const r = title ? title.getBoundingClientRect() : null;
                const x = r ? r.left + Math.min(r.width, 420) / 2 : window.innerWidth / 2;
                const y = r ? r.top + r.height / 2 : window.innerHeight / 2;
                burst(x, y, 170);
            },
            { threshold: 0.4 },
        ).observe(target);
    }
    const mark = document.querySelector('.mark');
    if (mark) mark.addEventListener('click', (e) => burst(e.clientX || 40, e.clientY || 40, 40));
}

export function burst(x, y, count = 120) {
    if (!ctx || still) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const chalk = getComputedStyle(document.documentElement).getPropertyValue('--chalk').trim();
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 7;
        particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 3, r: 1 + Math.random() * 3.5, life: 1, decay: 0.008 + Math.random() * 0.014, color: chalk });
    }
    if (!raf) raf = requestAnimationFrame(tick);
}

function tick() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    particles = particles.filter((p) => p.life > 0);
    for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy = p.vy * 0.96 + 0.12;
        p.life -= p.decay;
        ctx.globalAlpha = Math.max(0, p.life) * 0.85;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.5 + p.life / 2), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    raf = particles.length ? requestAnimationFrame(tick) : 0;
    if (!raf) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}
