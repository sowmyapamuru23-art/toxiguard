// ToxiGuard - Auth Page JavaScript (Login + Register)

// ── Helper: Show alert message ──
function showAlert(id, msg, type = 'error') {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.className = `alert-msg ${type} show`;
}

function setLoading(btn, text, loading) {
    btn.disabled = loading;
    btn.textContent = loading ? 'Please wait...' : text;
}

// ── LOGIN ──────────────────────────────────────────────────
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    // Redirect if already logged in
    if (localStorage.getItem('tg_token')) {
        window.location.href = 'chat.html';
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const btn = document.getElementById('loginBtn');

        if (!email || !password) {
            showAlert('alertMsg', 'Please fill in all fields.', 'error');
            return;
        }

        setLoading(btn, 'Sign In', true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (res.ok) {
                // Save token and user info
                localStorage.setItem('tg_token', data.token);
                localStorage.setItem('tg_username', data.user.username);
                localStorage.setItem('tg_userid', data.user.id);
                showAlert('alertMsg', 'Login successful! Redirecting...', 'success');
                setTimeout(() => { window.location.href = 'chat.html'; }, 800);
            } else {
                showAlert('alertMsg', data.message || 'Login failed.', 'error');
                setLoading(btn, 'Sign In', false);
            }

        } catch (err) {
            showAlert('alertMsg', 'Network error. Is the server running?', 'error');
            setLoading(btn, 'Sign In', false);
        }
    });
}

// ── REGISTER ───────────────────────────────────────────────
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    // Redirect if already logged in
    if (localStorage.getItem('tg_token')) {
        window.location.href = 'chat.html';
    }

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const btn = document.getElementById('registerBtn');

        if (!username || !email || !password) {
            showAlert('alertMsg', 'Please fill in all fields.', 'error');
            return;
        }
        if (username.length < 3) {
            showAlert('alertMsg', 'Username must be at least 3 characters.', 'error');
            return;
        }
        if (password.length < 6) {
            showAlert('alertMsg', 'Password must be at least 6 characters.', 'error');
            return;
        }

        setLoading(btn, 'Create Account', true);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await res.json();

            if (res.ok) {
                showAlert('alertMsg', 'Account created! Redirecting to login...', 'success');
                setTimeout(() => { window.location.href = 'login.html'; }, 1200);
            } else {
                showAlert('alertMsg', data.message || 'Registration failed.', 'error');
                setLoading(btn, 'Create Account', false);
            }

        } catch (err) {
            showAlert('alertMsg', 'Network error. Is the server running?', 'error');
            setLoading(btn, 'Create Account', false);
        }
    });
}
