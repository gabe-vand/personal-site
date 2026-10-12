// Boot: the chat, the contact form and the analytics beacon. The page itself is plain HTML.
import { initChat } from './chat.js?v=bf6a28fc';
import { initLetter } from './letter.js?v=bf6a28fc';
import { initTrack } from './track.js?v=bf6a28fc';

initChat();
initLetter();
initTrack();
