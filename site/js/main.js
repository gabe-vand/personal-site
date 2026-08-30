// Entry point. Every feature is its own module and guards its own DOM, so deleting a
// section from src/page/ never breaks the rest of the page.
import { initTelemetry } from './telemetry.js?v=b2502c20';
import { initContour } from './contour.js?v=b2502c20';
import { initTopo } from './topo.js?v=b2502c20';
import { initTicker } from './ticker.js?v=b2502c20';
import { initChat } from './chat.js?v=b2502c20';
import { initChalk } from './chalk.js?v=b2502c20';
import { initReveal, initKonami } from './reveal.js?v=b2502c20';
import { initContact } from './contact.js?v=b2502c20';

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
