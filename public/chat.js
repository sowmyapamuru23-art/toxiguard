// ToxiGuard - Chat Client JavaScript

// ── Auth guard: redirect to login if no token ──
const token = localStorage.getItem('tg_token');
const username = localStorage.getItem('tg_username');

if (!token || !username) {
    window.location.href = 'login.html';
}

// ── DOM references ──
const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const onlineCount = document.getElementById('onlineCount');
const sidebarUser = document.getElementById('sidebarUsername');
const avatarLetter = document.getElementById('avatarLetter');
const logoutBtn = document.getElementById('logoutBtn');
const toastContainer = document.getElementById('toastContainer');

// ── Fill sidebar user info ──
sidebarUser.textContent = username;
avatarLetter.textContent = username.charAt(0).toUpperCase();

// ── Strike indicator (added to sidebar dynamically) ──
const strikeBar = document.createElement('div');
strikeBar.id = 'strikeBar';
strikeBar.style.cssText = `
  margin-top: 16px;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 8px;
  padding: 10px 12px;
  display: none;
`;
strikeBar.innerHTML = `
  <div style="font-size:0.72rem;font-weight:600;color:#ef4444;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px;">
    ⚠️ Toxic Strikes
  </div>
  <div id="strikeDots" style="display:flex;gap:6px;margin-bottom:6px;"></div>
  <div id="strikeText" style="font-size:0.75rem;color:#8b949e;"></div>
`;
document.querySelector('.user-info-card').before(strikeBar);

function updateStrikeUI(strikes, maxStrikes) {
    if (strikes === 0) {
        strikeBar.style.display = 'none';
        return;
    }
    strikeBar.style.display = 'block';
    const dots = document.getElementById('strikeDots');
    const text = document.getElementById('strikeText');
    dots.innerHTML = '';
    for (let i = 0; i < maxStrikes; i++) {
        const dot = document.createElement('div');
        dot.style.cssText = `
      width:14px;height:14px;border-radius:50%;
      background:${i < strikes ? '#ef4444' : 'rgba(239,68,68,0.2)'};
      border:1px solid rgba(239,68,68,0.4);
      transition: background 0.3s;
    `;
        dots.appendChild(dot);
    }
    const remaining = maxStrikes - strikes;
    text.textContent = remaining > 0
        ? `${remaining} strike${remaining > 1 ? 's' : ''} remaining before ban`
        : 'Banned!';
}

// ── Connect Socket.io with JWT ──
const socket = io({
    auth: { token }
});

// ── Load message history from API ──
async function loadHistory() {
    try {
        const res = await fetch('/api/chat/messages', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        data.messages.forEach(msg => appendMessage(msg.username, msg.content, msg.created_at, false));
        scrollBottom();
    } catch (e) {
        appendSystem('Could not load chat history.');
    }
}

// ── Format timestamp ──
function formatTime(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Append a chat message bubble ──
function appendMessage(user, content, timestamp, scroll = true) {
    const isSelf = user === username;
    const wrapper = document.createElement('div');
    wrapper.className = `msg-wrapper ${isSelf ? 'self' : 'other'}`;

    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.textContent = isSelf ? `You · ${formatTime(timestamp || new Date())}` : `${user} · ${formatTime(timestamp || new Date())}`;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = content;

    wrapper.appendChild(meta);
    wrapper.appendChild(bubble);
    messagesArea.appendChild(wrapper);

    if (scroll) scrollBottom();
}

// ── Append a system / info message ──
function appendSystem(text) {
    const div = document.createElement('div');
    div.className = 'system-msg';
    div.textContent = text;
    messagesArea.appendChild(div);
    scrollBottom();
}

// ── Scroll to bottom of chat ──
function scrollBottom() {
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// ── Show warning toast ──
function showWarningToast(message, strikes, maxStrikes) {
    const toast = document.createElement('div');
    toast.className = 'toast-warning';
    toast.innerHTML = `
    <div class="toast-title">🚫 Message Blocked</div>
    <div class="toast-body">${message}</div>
    ${strikes ? `<div class="toast-body" style="margin-top:5px;color:#ef4444;font-weight:600;">Strike ${strikes}/${maxStrikes}</div>` : ''}
  `;
    toastContainer.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 350);
    }, 4000);
}

// ── Show block screen (full overlay) ──
function showBlockScreen(message) {
    document.body.innerHTML = `
    <div style="
      min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg,#0d1117,#1a0a2e);
      font-family:'Inter',sans-serif;color:white;text-align:center;padding:20px;
    ">
      <div style="
        background:#1c2128;border:1px solid rgba(239,68,68,0.4);
        border-radius:20px;padding:48px 40px;max-width:440px;
        box-shadow:0 0 60px rgba(239,68,68,0.15);
      ">
        <div style="font-size:4rem;margin-bottom:16px;">🚫</div>
        <h2 style="font-size:1.4rem;font-weight:700;color:#ef4444;margin-bottom:12px;">Account Blocked</h2>
        <p style="color:#8b949e;font-size:0.9rem;line-height:1.7;white-space:pre-line;">${message}</p>
        <button onclick="logout()" style="
          margin-top:28px;background:linear-gradient(135deg,#7c3aed,#a855f7);
          border:none;border-radius:10px;color:white;padding:12px 28px;
          font-weight:600;cursor:pointer;font-size:0.9rem;
        ">Back to Login</button>
      </div>
    </div>
  `;
}

// ── Logout ──
function logout() {
    localStorage.removeItem('tg_token');
    localStorage.removeItem('tg_username');
    localStorage.removeItem('tg_userid');
    window.location.href = 'login.html';
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
}

// ── Send message ──
function sendMessage() {
    const content = messageInput.value.trim();
    if (!content) return;
    socket.emit('chatMessage', content);
    messageInput.value = '';
    messageInput.style.height = 'auto';
    messageInput.focus();
}

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Auto-grow textarea
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
});

// ── Socket Events ──

socket.on('connect', () => {
    console.log('✅ Connected to ToxiGuard server');
    loadHistory();
});

socket.on('connect_error', (err) => {
    appendSystem(`⚠️ Connection failed: ${err.message}`);
});

// Safe message received
socket.on('chatMessage', (data) => {
    appendMessage(data.username, data.content, data.timestamp);
});

// System announcement (join/leave)
socket.on('systemMessage', (msg) => {
    appendSystem(msg);
});

// Online user count update
socket.on('userCount', (count) => {
    if (onlineCount) onlineCount.textContent = count;
});

// Warning: toxic message blocked
socket.on('warning', (data) => {
    showWarningToast(data.message, data.strikes, data.maxStrikes);
});

// Strike count update
socket.on('strikeUpdate', (data) => {
    updateStrikeUI(data.strikes, data.maxStrikes);
});

// User blocked event
socket.on('blocked', (data) => {
    showBlockScreen(data.message);
});

socket.on('disconnect', (reason) => {
    if (reason !== 'io client disconnect') {
        appendSystem('⚠️ Disconnected from server. Trying to reconnect...');
    }
});
