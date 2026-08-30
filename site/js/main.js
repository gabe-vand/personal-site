// Entry point. Every feature is its own module and guards its own DOM, so deleting a
// section from src/page/ never breaks the rest of the page.
import { initTelemetry } from './telemetry.js?v=59eb482d';
import { initContour } from './contour.js?v=59eb482d';
import { initTopo } from './topo.js?v=59eb482d';
import { initTicker } from './ticker.js?v=59eb482d';
import { initChat } from './chat.js?v=59eb482d';
import { initChalk } from './chalk.js?v=59eb482d';
import { initReveal, initKonami } from './reveal.js?v=59eb482d';
import { initContact } from './contact.js?v=59eb482d';

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
