// Fetch wrapper for /api/admin/*. Sends the X-Admin header (CSRF token-by-convention) and the
// session cookie; a 401 anywhere flips the page back to the login form.
export class AuthError extends Error {}

export async function api(path, body) {
    const res = await fetch('/api/admin' + path, {
        method: body ? 'POST' : 'GET',
        headers: { 'X-Admin': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'same-origin',
        cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new AuthError(data.error || 'not logged in');
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}
