// Entry point. Every feature is its own module and guards its own DOM, so deleting a
// section from src/page/ never breaks the rest of the page.
import { initTelemetry } from './telemetry.js?v=efe4755f';
import { initContour } from './contour.js?v=efe4755f';
import { initTopo } from './topo.js?v=efe4755f';
import { initTicker } from './ticker.js?v=efe4755f';
import { initChat } from './chat.js?v=efe4755f';
import { initChalk } from './chalk.js?v=efe4755f';
import { initReveal, initKonami } from './reveal.js?v=efe4755f';
import { initContact } from './contact.js?v=efe4755f';

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
