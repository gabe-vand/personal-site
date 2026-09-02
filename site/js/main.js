// Entry point. Every feature is its own module and guards its own DOM, so deleting a
// section from src/page/ never breaks the rest of the page.
import { initTelemetry } from './telemetry.js?v=04c926f4';
import { initContour } from './contour.js?v=04c926f4';
import { initTopo } from './topo.js?v=04c926f4';
import { initTicker } from './ticker.js?v=04c926f4';
import { initChat } from './chat.js?v=04c926f4';
import { initChalk } from './chalk.js?v=04c926f4';
import { initReveal, initKonami } from './reveal.js?v=04c926f4';
import { initContact } from './contact.js?v=04c926f4';
import { initTrack } from './track.js?v=04c926f4';

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
