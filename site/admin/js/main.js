// Admin app: login gate + hash router. Views are modules that return a DOM node.
import { api, AuthError } from './api.js?v=04c926f4';
import { el } from './ui.js?v=04c926f4';
import { overview } from './views-overview.js?v=04c926f4';
import { humans, visitor } from './views-humans.js?v=04c926f4';
import { ai } from './views-ai.js?v=04c926f4';
import { conversations, conversation } from './views-convos.js?v=04c926f4';
import { emails } from './views-emails.js?v=04c926f4';
import { cloudflare } from './views-cf.js?v=04c926f4';
import { security } from './views-security.js?v=04c926f4';

const $ = (id) => document.getElementById(id);
const VIEWS = { overview, humans, visitor, ai, conversations, conversation, emails, cloudflare, security, audit: security };
let daysSel;

function showLogin(message = '') {
    $('app').hidden = true;
    $('login').hidden = false;
    const err = $('login-error');
    err.textContent = message;
    err.hidden = !message;
    $('login-email').focus();
}

async function render() {
    const [name, arg] = location.hash.replace(/^#/, '').split('/');
    const view = VIEWS[name] || overview;
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${name || 'overview'}`));
    const target = $('view');
    target.replaceChildren(el('p', { class: 'muted mono', text: 'loading…' }));
    try {
        target.replaceChildren(await view({ days: Number(daysSel.value), arg: decodeURIComponent(arg || '') }));
    } catch (err) {
        if (err instanceof AuthError) return showLogin('Session expired. Sign in again.');
        target.replaceChildren(el('p', { class: 'notice', text: `Could not load: ${err.message}` }));
    }
}

async function boot() {
    daysSel = $('days');
    daysSel.addEventListener('change', render);
    addEventListener('hashchange', render);
    $('logout').addEventListener('click', async () => {
        await api('/logout', {}).catch(() => {});
        showLogin('Signed out.');
    });
    $('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = $('login-btn');
        btn.disabled = true;
        try {
            await api('/login', { email: $('login-email').value, password: $('login-password').value, code: $('login-code').value });
            $('login-password').value = '';
            $('login-code').value = '';
            $('login').hidden = true;
            $('app').hidden = false;
            render();
        } catch (err) {
            showLogin(err.message);
        } finally {
            btn.disabled = false;
        }
    });
    try {
        const me = await api('/me');
        if (me.totp) { $('login-code').hidden = false; $('login-code-label').hidden = false; }
        $('app').hidden = false;
        render();
    } catch {
        showLogin();
    }
}

boot();
