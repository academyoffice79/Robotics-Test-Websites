// login.js - client-side glue for login page.
// This script POSTS credentials to /api/login which MUST verify passwords server-side and set a secure HttpOnly cookie.

const form = document.getElementById('loginForm');
const msg = document.getElementById('loginMessage');

function getQueryParam(name) {
    const params = new URLSearchParams(location.search);
    return params.get(name) || '/';
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';

    const username = form.username.value.trim();
    const password = form.password.value;

    if (!username || !password) {
        msg.textContent = 'Please provide username and password.';
        return;
    }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include'
        });

        if (res.status === 200) {
            // successful login -> redirect to "next" or home
            const next = getQueryParam('next');
            window.location.href = next;
        } else {
            const j = await res.json().catch(() => ({ message: 'Login failed' }));
            msg.textContent = j.message || 'Invalid credentials';
        }
    } catch (err) {
        console.error(err);
        msg.textContent = 'Network error — try again later.';
    }
});
