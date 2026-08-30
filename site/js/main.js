// Entry point. Every feature is its own module and guards its own DOM, so deleting a
// section from src/page/ never breaks the rest of the page.
import { initTelemetry } from './telemetry.js?v=0a57082b';
import { initContour } from './contour.js?v=0a57082b';
import { initTopo } from './topo.js?v=0a57082b';
import { initTicker } from './ticker.js?v=0a57082b';
import { initChat } from './chat.js?v=0a57082b';
import { initChalk } from './chalk.js?v=0a57082b';
import { initReveal, initKonami } from './reveal.js?v=0a57082b';
import { initContact } from './contact.js?v=0a57082b';

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
