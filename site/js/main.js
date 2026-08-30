// Entry point. Every feature is its own module and guards its own DOM, so deleting a
// section from src/page/ never breaks the rest of the page.
import { initTelemetry } from './telemetry.js?v=3fba1559';
import { initContour } from './contour.js?v=3fba1559';
import { initTopo } from './topo.js?v=3fba1559';
import { initTicker } from './ticker.js?v=3fba1559';
import { initChat } from './chat.js?v=3fba1559';
import { initChalk } from './chalk.js?v=3fba1559';
import { initReveal, initKonami } from './reveal.js?v=3fba1559';
import { initContact } from './contact.js?v=3fba1559';
import { initTrack } from './track.js?v=3fba1559';

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
initTrack();
