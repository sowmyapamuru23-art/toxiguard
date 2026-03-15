// ToxiGuard - Chat Client JavaScript

/** ── Auth guard: redirect to login if no token ── */
const token = localStorage.getItem('tg_token');
const username = localStorage.getItem('tg_username');
const myUserId = parseInt(localStorage.getItem('tg_userid'));

if (!token || !username || !myUserId) {
    window.location.href = 'login.html';
}

/** ── State ── */
let selectedUserId = null;
let contacts = [];

/** ── DOM references ── */
const userList = document.getElementById('userList');
const chatMain = document.getElementById('chatMain');
const chatWithTitle = document.getElementById('chatWithTitle');
const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const onlineCount = document.getElementById('onlineCount');
const sidebarUser = document.getElementById('sidebarUsername');
const avatarLetter = document.getElementById('avatarLetter');
const logoutBtn = document.getElementById('logoutBtn');
const toastContainer = document.getElementById('toastContainer');

// Fill sidebar user info
sidebarUser.textContent = username;
avatarLetter.textContent = username.charAt(0).toUpperCase();

/** ── Strike indicator ── */
const strikeBar = document.createElement('div');
strikeBar.id = 'strikeBar';
strikeBar.style.cssText = `
  margin-top: 16px; background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.2); border-radius: 8px;
  padding: 10px 12px; display: none;
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
    if (strikes === 0) { strikeBar.style.display = 'none'; return; }
    strikeBar.style.display = 'block';
    const dots = document.getElementById('strikeDots');
    const text = document.getElementById('strikeText');
    dots.innerHTML = '';
    for (let i = 0; i < maxStrikes; i++) {
        const dot = document.createElement('div');
        dot.style.cssText = `
            width:14px;height:14px;border-radius:50%;
            background:${i < strikes ? '#ef4444' : 'rgba(239,68,68,0.2)'};
            border:1px solid rgba(239,68,68,0.4); transition: background 0.3s;
        `;
        dots.appendChild(dot);
    }
    const remaining = maxStrikes - strikes;
    text.textContent = remaining > 0 ? `${remaining} strike${remaining > 1 ? 's' : ''} remaining` : 'Banned!';
}

/** ── Socket Connectivity ── */
const socket = io({ auth: { token } });

/** ── API Calls ── */

// Fetch all users for the sidebar
async function fetchUsers() {
    try {
        const res = await fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error();
        contacts = await res.json();
        renderUserList();
    } catch (e) {
        userList.innerHTML = `<div style="padding:20px; text-align:center; color:var(--danger); font-size:0.8rem;">Failed to load contacts.</div>`;
    }
}

// Load history for a specific conversation
async function loadHistory(receiverId) {
    messagesArea.innerHTML = '<div class="system-msg">Loading history...</div>';
    try {
        const res = await fetch(`/api/chat/history/${receiverId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        messagesArea.innerHTML = '';
        if (data.messages.length === 0) {
            appendSystem('No messages yet. Say hi!');
        } else {
            data.messages.forEach(msg => {
                appendMessage(msg.username, msg.content, msg.created_at, false);
            });
        }
        scrollBottom();
    } catch (e) {
        appendSystem('Could not load chat history.');
    }
}

/** ── UI Logic ── */

function renderUserList() {
    userList.innerHTML = '';
    if (contacts.length === 0) {
        userList.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:0.8rem;">No other users yet.</div>`;
        return;
    }

    contacts.forEach(user => {
        const div = document.createElement('div');
        div.className = `contact-item ${selectedUserId === user.id ? 'active' : ''}`;
        div.onclick = () => selectContact(user);
        div.innerHTML = `
            <div class="contact-avatar">${user.username.charAt(0).toUpperCase()}</div>
            <div class="contact-info">
                <div class="contact-name">${user.username}</div>
                <div class="contact-status">Click to chat</div>
            </div>
        `;
        userList.appendChild(div);
    });
}

function selectContact(user) {
    if (selectedUserId === user.id) return;

    selectedUserId = user.id;
    chatMain.style.display = 'flex';
    chatWithTitle.textContent = `💬 ${user.username}`;

    // Highlight in list
    renderUserList();

    // Load history
    loadHistory(user.id);

    // UI focus
    messageInput.focus();
}

/** ── Helper Functions ── */

function formatTime(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

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

function appendSystem(text) {
    const div = document.createElement('div');
    div.className = 'system-msg';
    div.textContent = text;
    messagesArea.appendChild(div);
    scrollBottom();
}

function scrollBottom() {
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function showWarningToast(message, strikes, maxStrikes) {
    const toast = document.createElement('div');
    toast.className = 'toast-warning';
    toast.innerHTML = `
        <div class="toast-title">🚫 Message Blocked</div>
        <div class="toast-body">${message}</div>
        ${strikes ? `<div class="toast-body" style="margin-top:5px;color:#ef4444;font-weight:600;">Strike ${strikes}/${maxStrikes}</div>` : ''}
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 350);
    }, 4000);
}

function showBlockScreen(message) {
    document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0d1117,#1a0a2e);font-family:'Inter',sans-serif;color:white;text-align:center;padding:20px;">
      <div style="background:#1c2128;border:1px solid rgba(239,68,68,0.4);border-radius:20px;padding:48px 40px;max-width:440px;box-shadow:0 0 60px rgba(239,68,68,0.15);">
        <div style="font-size:4rem;margin-bottom:16px;">🚫</div>
        <h2 style="font-size:1.4rem;font-weight:700;color:#ef4444;margin-bottom:12px;">Account Blocked</h2>
        <p style="color:#8b949e;font-size:0.9rem;line-height:1.7;white-space:pre-line;">${message}</p>
        <button onclick="logout()" style="margin-top:28px;background:linear-gradient(135deg,#7c3aed,#a855f7);border:none;border-radius:10px;color:white;padding:12px 28px;font-weight:600;cursor:pointer;font-size:0.9rem;">Back to Login</button>
      </div>
    </div>`;
}

function logout() {
    localStorage.removeItem('tg_token');
    localStorage.removeItem('tg_username');
    localStorage.removeItem('tg_userid');
    window.location.href = 'login.html';
}

if (logoutBtn) logoutBtn.addEventListener('click', logout);

function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || !selectedUserId) return;

    socket.emit('chatMessage', { content, receiverId: selectedUserId });

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

messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
});

/** ── Socket Events ── */

socket.on('connect', () => {
    console.log('✅ Connected to ToxiGuard');
    fetchUsers();
});

socket.on('chatMessage', (data) => {
    // Only show if the message belongs to the active conversation
    const isFromSelected = parseInt(data.senderId) === selectedUserId;
    const isToSelected = parseInt(data.receiverId) === selectedUserId && parseInt(data.senderId) === myUserId;

    if (isFromSelected || isToSelected) {
        appendMessage(data.username, data.content, data.timestamp);
    } else {
        // Optional: show notification in sidebar for other users
        console.log(`New message from ${data.username}`);
    }
});

socket.on('userCount', (count) => {
    if (onlineCount) onlineCount.textContent = count;
});

socket.on('warning', (data) => {
    showWarningToast(data.message, data.strikes, data.maxStrikes);
});

socket.on('strikeUpdate', (data) => {
    updateStrikeUI(data.strikes, data.maxStrikes);
});

socket.on('blocked', (data) => {
    showBlockScreen(data.message);
});

socket.on('disconnect', (reason) => {
    if (reason !== 'io client disconnect') {
        appendSystem('⚠️ Disconnected. Reconnecting...');
    }
});
