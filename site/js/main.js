// Entry point. Every feature is its own module and guards its own DOM, so deleting a
// section from src/page/ never breaks the rest of the page.
import { initTelemetry } from './telemetry.js?v=1f5bd0fe';
import { initContour } from './contour.js?v=1f5bd0fe';
import { initTopo } from './topo.js?v=1f5bd0fe';
import { initTicker } from './ticker.js?v=1f5bd0fe';
import { initChat } from './chat.js?v=1f5bd0fe';
import { initChalk } from './chalk.js?v=1f5bd0fe';
import { initReveal, initKonami } from './reveal.js?v=1f5bd0fe';
import { initContact } from './contact.js?v=1f5bd0fe';

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
