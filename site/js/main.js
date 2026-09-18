// Entry point. Every feature is its own module and guards its own DOM, so deleting a
// section from src/page/ never breaks the rest of the page.
import { initTelemetry } from './telemetry.js?v=d3533e7a';
import { initContour } from './contour.js?v=d3533e7a';
import { initTopo } from './topo.js?v=d3533e7a';
import { initTicker } from './ticker.js?v=d3533e7a';
import { initChat } from './chat.js?v=d3533e7a';
import { initChalk } from './chalk.js?v=d3533e7a';
import { initReveal, initKonami } from './reveal.js?v=d3533e7a';
import { initContact } from './contact.js?v=d3533e7a';
import { initTrack } from './track.js?v=d3533e7a';

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
