/**
 * login.js
 * - Simple client-side login form that POSTs credentials to `/api/login`
 * - The server must implement secure authentication (see notes)
 *
 * NOTE: Do NOT implement password verification on the client. All verification must happen server-side.
 */

const form = document.getElementById('loginForm');
const msg = document.getElementById('loginMessage');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';

    const username = form.username.value.trim();
    const password = form.password.value;

    if (!username || !password) {
        msg.textContent = 'Please provide username and password.';
        return;
    }

    // POST to /api/login (server should set a secure HttpOnly session cookie on success)
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include' // important: allow cookies to be sent/received
        });

        if (res.status === 200) {
            // login success -> redirect back to calendar or dashboard
            window.location.href = '/';
        } else {
            const j = await res.json().catch(() => ({ message: 'Login failed' }));
            msg.textContent = j.message || 'Invalid credentials';
        }
    } catch (err) {
        console.error(err);
        msg.textContent = 'Network error — try again later.';
    }
});
