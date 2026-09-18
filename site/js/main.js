// Entry point. Every feature is its own module and guards its own DOM, so deleting a
// section from src/page/ never breaks the rest of the page.
import { initTelemetry } from './telemetry.js?v=36781b6f';
import { initContour } from './contour.js?v=36781b6f';
import { initTopo } from './topo.js?v=36781b6f';
import { initTicker } from './ticker.js?v=36781b6f';
import { initChat } from './chat.js?v=36781b6f';
import { initChalk } from './chalk.js?v=36781b6f';
import { initReveal, initKonami } from './reveal.js?v=36781b6f';
import { initContact } from './contact.js?v=36781b6f';
import { initTrack } from './track.js?v=36781b6f';
import { initEdit } from './edit.js?v=36781b6f';

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
initEdit();
