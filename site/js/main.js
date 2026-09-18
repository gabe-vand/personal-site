// Entry point. Every feature is its own module and guards its own DOM, so deleting a
// section from src/page/ never breaks the rest of the page.
import { initTelemetry } from './telemetry.js?v=a7e8f368';
import { initContour } from './contour.js?v=a7e8f368';
import { initTopo } from './topo.js?v=a7e8f368';
import { initTicker } from './ticker.js?v=a7e8f368';
import { initChat } from './chat.js?v=a7e8f368';
import { initChalk } from './chalk.js?v=a7e8f368';
import { initReveal, initKonami } from './reveal.js?v=a7e8f368';
import { initContact } from './contact.js?v=a7e8f368';
import { initTrack } from './track.js?v=a7e8f368';
import { initEdit } from './edit.js?v=a7e8f368';

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
