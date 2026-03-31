// ToxiGuard - Chat Client JavaScript (Enhanced)

/** ── Auth guard ── */
const token = localStorage.getItem('tg_token');
const username = localStorage.getItem('tg_username');
const myUserId = parseInt(localStorage.getItem('tg_userid'));

if (!token || !username || !myUserId) {
    window.location.href = 'login.html';
}

/** ── State ── */
let selectedUserId = null;
let contacts = [];
let typingTimeout = null;
let muteInterval = null;
let unreadMap = {}; // { senderId: count }

/** ── Theme ── */
function initTheme() {
    const saved = localStorage.getItem('tg_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('tg_theme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

initTheme();

/** ── DOM references ── */
const userList = document.getElementById('userList');
const chatMain = document.getElementById('chatMain');
const emptyState = document.getElementById('emptyState');
const chatContent = document.getElementById('chatContent');
const chatWithTitle = document.getElementById('chatWithTitle');
const chatWithSubtitle = document.getElementById('chatWithSubtitle');
const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const onlineCount = document.getElementById('onlineCount');
const sidebarUser = document.getElementById('sidebarUsername');
const avatarLetter = document.getElementById('avatarLetter');
const logoutBtn = document.getElementById('logoutBtn');
const toastContainer = document.getElementById('toastContainer');
const themeToggle = document.getElementById('themeToggle');
const typingIndicator = document.getElementById('typingIndicator');
const typingText = document.getElementById('typingText');
const inputWrapper = document.getElementById('inputWrapper');
const muteBanner = document.getElementById('muteBanner');
const muteTimer = document.getElementById('muteTimer');

// Fill sidebar user info
sidebarUser.textContent = username;
avatarLetter.textContent = username.charAt(0).toUpperCase();

// Theme toggle
if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

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
  <div id="strikeText" style="font-size:0.75rem;color:var(--text-muted);"></div>
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
    if (remaining > 0) {
        text.textContent = `${remaining} strike${remaining > 1 ? 's' : ''} remaining`;
    } else {
        text.textContent = 'Banned!';
        text.style.color = '#ef4444';
    }
}

/** ── Socket Connectivity ── */
const socket = io({ auth: { token } });

/** ── API Calls ── */

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
            appendSystem('No messages yet. Say hi! 👋');
        } else {
            data.messages.forEach(msg => {
                const isSelf = msg.user_id === myUserId;
                appendMessage(msg.username, msg.content, msg.created_at, false, {
                    isToxic: false,
                    isRead: msg.is_read
                });
            });
        }
        scrollBottom();

        // Mark messages as read
        socket.emit('markRead', { senderId: receiverId });
        // Clear unread badge
        if (unreadMap[receiverId]) {
            delete unreadMap[receiverId];
            renderUserList();
        }
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

        const unread = unreadMap[user.id] || 0;
        const badgeHtml = unread > 0
            ? `<span class="unread-badge">${unread > 9 ? '9+' : unread}</span>`
            : '';

        div.innerHTML = `
            <div class="contact-avatar">
                ${user.username.charAt(0).toUpperCase()}
                ${badgeHtml}
            </div>
            <div class="contact-info">
                <div class="contact-name">${user.username}</div>
                <div class="contact-status" id="status-${user.id}">Click to chat</div>
            </div>
        `;
        userList.appendChild(div);
    });
}

function selectContact(user) {
    if (selectedUserId === user.id) return;

    selectedUserId = user.id;
    
    // Show chat content, hide empty state
    if (emptyState) emptyState.style.display = 'none';
    if (chatContent) {
        chatContent.style.display = 'flex';
        chatContent.style.flexDirection = 'column';
        chatContent.style.flex = '1';
        chatContent.style.overflow = 'hidden';
    }

    chatWithTitle.textContent = `💬 ${user.username}`;
    chatWithSubtitle.textContent = 'Messages are screened for toxicity';

    // Highlight in list
    renderUserList();

    // Load history
    loadHistory(user.id);

    // Reset typing indicator
    typingIndicator.style.opacity = '0';

    // UI focus
    messageInput.focus();
}

/** ── Helper Functions ── */

function formatTime(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function appendMessage(user, content, timestamp, scroll = true, options = {}) {
    const isSelf = user === username;
    const wrapper = document.createElement('div');
    wrapper.className = `msg-wrapper ${isSelf ? 'self' : 'other'}`;

    if (options.isToxic) {
        wrapper.classList.add('toxic');
    }

    const meta = document.createElement('div');
    meta.className = 'msg-meta';

    let metaContent = isSelf
        ? `You · ${formatTime(timestamp || new Date())}`
        : `${user} · ${formatTime(timestamp || new Date())}`;

    // Add read receipt for self messages
    if (isSelf && !options.isToxic) {
        const receiptClass = options.isRead ? 'read' : 'delivered';
        const receiptSymbol = options.isRead ? '✓✓' : '✓';
        metaContent += ` <span class="read-receipt ${receiptClass}">${receiptSymbol}</span>`;
    }

    // Add toxic label
    if (options.isToxic && options.category) {
        metaContent += ` <span class="toxic-label">🚫 ${options.category}</span>`;
    }

    meta.innerHTML = metaContent;

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
    }, 5000);
}

function showBlockScreen(message) {
    localStorage.removeItem('tg_token');
    localStorage.removeItem('tg_username');
    localStorage.removeItem('tg_userid');

    document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0d1117,#1a0a2e);font-family:'Inter',sans-serif;color:white;text-align:center;padding:20px;">
      <div style="background:#1c2128;border:1px solid rgba(239,68,68,0.4);border-radius:20px;padding:48px 40px;max-width:440px;box-shadow:0 0 60px rgba(239,68,68,0.15);">
        <div style="font-size:4rem;margin-bottom:16px;">🚫</div>
        <h2 style="font-size:1.4rem;font-weight:700;color:#ef4444;margin-bottom:12px;">Account Blocked</h2>
        <p style="color:#8b949e;font-size:0.9rem;line-height:1.7;white-space:pre-line;">${message}</p>
        <button onclick="window.location.href='login.html'" style="margin-top:28px;background:linear-gradient(135deg,#7c3aed,#a855f7);border:none;border-radius:10px;color:white;padding:12px 28px;font-weight:600;cursor:pointer;font-size:0.9rem;">Back to Login</button>
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

/** ── Mute System ── */
function showMuteBanner(remainingSeconds) {
    if (muteBanner) muteBanner.style.display = 'flex';
    if (inputWrapper) inputWrapper.classList.add('disabled');

    if (muteInterval) clearInterval(muteInterval);

    let remaining = remainingSeconds;
    updateMuteDisplay(remaining);

    muteInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(muteInterval);
            hideMuteBanner();
        } else {
            updateMuteDisplay(remaining);
        }
    }, 1000);
}

function updateMuteDisplay(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (muteTimer) muteTimer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}

function hideMuteBanner() {
    if (muteBanner) muteBanner.style.display = 'none';
    if (inputWrapper) inputWrapper.classList.remove('disabled');
}

/** ── Send Message ── */
function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || !selectedUserId) return;

    socket.emit('chatMessage', { content, receiverId: selectedUserId });

    // Stop typing
    socket.emit('typing', { receiverId: selectedUserId, isTyping: false });

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

// Auto-resize & typing indicator
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';

    // Emit typing
    if (selectedUserId) {
        socket.emit('typing', { receiverId: selectedUserId, isTyping: true });

        // Clear previous timeout
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit('typing', { receiverId: selectedUserId, isTyping: false });
        }, 2000);
    }
});

/** ── Socket Events ── */

socket.on('connect', () => {
    console.log('✅ Connected to ToxiGuard');
    fetchUsers();
});

socket.on('chatMessage', (data) => {
    const isFromSelected = parseInt(data.senderId) === selectedUserId;
    const isToSelected = parseInt(data.receiverId) === selectedUserId && parseInt(data.senderId) === myUserId;

    if (isFromSelected || isToSelected) {
        appendMessage(data.username, data.content, data.timestamp, true, {
            isToxic: false,
            isRead: false
        });
        // Mark as read if from selected contact
        if (isFromSelected) {
            socket.emit('markRead', { senderId: data.senderId });
        }
    } else {
        // Show notification badge for other users
        const senderId = parseInt(data.senderId);
        if (senderId !== myUserId) {
            unreadMap[senderId] = (unreadMap[senderId] || 0) + 1;
            renderUserList();
        }
    }
});

// Toxic message feedback (shown to sender in red)
socket.on('toxicMessage', (data) => {
    if (parseInt(data.receiverId) === selectedUserId) {
        appendMessage(data.username, data.content, data.timestamp, true, {
            isToxic: true,
            category: data.category
        });
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

socket.on('muted', (data) => {
    showMuteBanner(data.remaining);
    showWarningToast(data.message, null, null);
});

socket.on('unreadCounts', (counts) => {
    if (Array.isArray(counts)) {
        counts.forEach(c => {
            if (c.senderId !== selectedUserId) {
                unreadMap[c.senderId] = c.count;
            }
        });
        renderUserList();
    }
});

// Typing indicator
socket.on('userTyping', (data) => {
    if (parseInt(data.userId) === selectedUserId) {
        if (data.isTyping) {
            typingText.textContent = `${data.username} is typing`;
            typingIndicator.style.opacity = '1';
        } else {
            typingIndicator.style.opacity = '0';
        }
    }

    // Update sidebar status
    const statusEl = document.getElementById(`status-${data.userId}`);
    if (statusEl) {
        if (data.isTyping) {
            statusEl.textContent = 'typing...';
            statusEl.className = 'contact-status typing';
        } else {
            statusEl.textContent = 'Click to chat';
            statusEl.className = 'contact-status';
        }
    }
});

// Message delivered / read
socket.on('messageDelivered', (data) => {
    // Update last message receipt to delivered
    updateReceiptsInView('delivered');
});

socket.on('messagesRead', (data) => {
    if (parseInt(data.readBy) === selectedUserId) {
        updateReceiptsInView('read');
    }
});

function updateReceiptsInView(status) {
    const receipts = messagesArea.querySelectorAll('.msg-wrapper.self .read-receipt');
    receipts.forEach(r => {
        r.className = `read-receipt ${status}`;
        r.textContent = status === 'read' ? '✓✓' : '✓';
    });
}

socket.on('disconnect', (reason) => {
    if (reason !== 'io client disconnect') {
        appendSystem('⚠️ Disconnected. Reconnecting...');
    }
});
