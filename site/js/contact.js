// Contact form. No backend, by design: build a mailto: URL and hand it to the visitor's mail
// app. Nothing is sent to this server, so there is nothing to secure or lose.
// EDIT: change ADDRESS here AND in the fallback link in src/page/70-contact.html.
const ADDRESS = 'gabe@gabevandevere.com';

export function initContact() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const subject = form.elements.subject.value.trim() || 'Hello from your website';
        const body = form.elements.body.value.trim();
        if (!body) return;
        window.location.href = `mailto:${ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
}
