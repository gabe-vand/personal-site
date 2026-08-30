// Entry point. Every feature is its own module and guards its own DOM, so deleting a
// section from src/page/ never breaks the rest of the page.
import { initTelemetry } from './telemetry.js?v=b3c3cbb1';
import { initContour } from './contour.js?v=b3c3cbb1';
import { initTopo } from './topo.js?v=b3c3cbb1';
import { initTicker } from './ticker.js?v=b3c3cbb1';
import { initChat } from './chat.js?v=b3c3cbb1';
import { initChalk } from './chalk.js?v=b3c3cbb1';
import { initReveal, initKonami } from './reveal.js?v=b3c3cbb1';
import { initContact } from './contact.js?v=b3c3cbb1';

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
