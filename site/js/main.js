// Entry point. Every feature is its own module and guards its own DOM, so deleting a
// section from src/page/ never breaks the rest of the page.
import { initTelemetry } from './telemetry.js?v=fe06d338';
import { initContour } from './contour.js?v=fe06d338';
import { initTopo } from './topo.js?v=fe06d338';
import { initTicker } from './ticker.js?v=fe06d338';
import { initChat } from './chat.js?v=fe06d338';
import { initChalk } from './chalk.js?v=fe06d338';
import { initReveal, initKonami } from './reveal.js?v=fe06d338';
import { initContact } from './contact.js?v=fe06d338';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('has-js');
document.querySelectorAll('#year').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
});

initTelemetry();
initContour(reduced);
initTopo();
initTicker(reduced);
initChat();
initChalk(reduced);
initReveal(reduced);
initKonami();
initContact();
