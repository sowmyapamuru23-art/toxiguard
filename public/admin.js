// ToxiGuard - Admin Dashboard Frontend Logic (Full Rewrite)

document.addEventListener('DOMContentLoaded', () => {
    // ── UI Elements ──
    const authSection = document.getElementById('adminAuthSection');
    const dashboardSection = document.getElementById('adminDashboardSection');
    const adminKeyInput = document.getElementById('adminKeyInput');
    const loginBtn = document.getElementById('adminLoginBtn');
    const authMessage = document.getElementById('authMessage');

    // State
    let adminKey = localStorage.getItem('tg_admin_key') || '';

    if (adminKey) adminKeyInput.value = adminKey;

    // ── Helpers ──
    function showAlert(elementId, msg, type = 'error') {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.textContent = msg;
        el.className = `alert-msg ${type} show`;
        setTimeout(() => el.classList.remove('show'), 5000);
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    async function apiCall(endpoint, method = 'GET', body = null) {
        const opts = {
            method,
            headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' }
        };
        if (body) opts.body = JSON.stringify(body);

        const url = method === 'GET' && !endpoint.includes('?')
            ? `${endpoint}?key=${encodeURIComponent(adminKey)}`
            : endpoint;

        const res = await fetch(url, opts);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Request failed');
        return data;
    }

    // ── Authentication ──
    loginBtn.addEventListener('click', async () => {
        const key = adminKeyInput.value.trim();
        if (!key) {
            showAlert('authMessage', 'Admin Key cannot be empty.');
            return;
        }

        loginBtn.textContent = 'Verifying...';
        loginBtn.disabled = true;

        try {
            await fetch(`/api/admin/blocked?key=${encodeURIComponent(key)}`).then(r => {
                if (!r.ok) throw new Error('Invalid key');
                return r.json();
            });

            adminKey = key;
            localStorage.setItem('tg_admin_key', key);

            authSection.style.display = 'none';
            dashboardSection.style.display = 'block';

            loadAllData();
        } catch (err) {
            showAlert('authMessage', 'Invalid Admin Key.');
        } finally {
            loginBtn.textContent = 'Access Dashboard';
            loginBtn.disabled = false;
        }
    });

    // Enter key on admin input
    adminKeyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loginBtn.click();
    });

    // ── Tab System ──
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

            tab.classList.add('active');
            const target = document.getElementById(`tab-${tab.dataset.tab}`);
            if (target) target.classList.add('active');
        });
    });

    // ── Data Loading ──
    async function loadAllData() {
        loadStats();
        loadUsers();
        loadToxicLogs();
        loadBlockedUsers();
        loadWords();
    }

    // ── Overview Tab ──
    async function loadStats() {
        try {
            const stats = await apiCall('/api/admin/stats');

            document.getElementById('statTotalMessages').textContent = stats.totalMessages.toLocaleString();
            document.getElementById('statToxicMessages').textContent = stats.toxicMessages.toLocaleString();
            document.getElementById('statTotalUsers').textContent = stats.totalUsers.toLocaleString();
            document.getElementById('statBlockedUsers').textContent = stats.blockedUsers.toLocaleString();
            document.getElementById('statToxicPercent').textContent = stats.toxicPercentage + '%';

            // Category chart
            const chartEl = document.getElementById('categoryChart');
            if (stats.topCategories.length === 0) {
                chartEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;">No toxic messages recorded yet.</div>';
                return;
            }

            const maxCount = Math.max(...stats.topCategories.map(c => c.count));
            chartEl.innerHTML = stats.topCategories.map(cat => {
                const pct = Math.max(5, (cat.count / maxCount) * 100);
                return `
                    <div class="category-bar-item">
                        <div class="cat-name">${cat.toxic_category || 'Unknown'}</div>
                        <div class="cat-bar-wrapper">
                            <div class="cat-bar" style="width: ${pct}%">${cat.count}</div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error('Stats error:', err);
        }
    }

    // ── Users Tab ──
    async function loadUsers() {
        const tbody = document.getElementById('usersTableBody');
        try {
            const data = await apiCall('/api/admin/users');
            if (!data.users || data.users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:20px;">No users found.</td></tr>';
                return;
            }

            tbody.innerHTML = data.users.map(user => {
                let statusBadge;
                if (user.is_blocked) {
                    statusBadge = '<span class="bad-badge">Blocked</span>';
                } else if (user.muted_until && new Date(user.muted_until) > new Date()) {
                    statusBadge = '<span class="muted-badge">Muted</span>';
                } else {
                    statusBadge = '<span class="good-badge">Active</span>';
                }

                const strikeBadge = user.strikes > 0
                    ? `<span class="bad-badge">${user.strikes}</span>`
                    : `<span class="good-badge">0</span>`;

                return `
                    <tr>
                        <td>#${user.id}</td>
                        <td style="font-weight:500;">${user.username}</td>
                        <td class="text-muted">${user.email}</td>
                        <td>${strikeBadge}</td>
                        <td>${statusBadge}</td>
                        <td>
                            ${user.strikes > 0 ? `<button class="btn btn-sm warning-btn" onclick="adminActions.resetStrikes(${user.id})">Reset</button>` : ''}
                            ${user.is_blocked ? `<button class="btn btn-sm success-btn" onclick="adminActions.unblock(${user.id})">Unblock</button>` : ''}
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color:var(--danger);padding:20px;">Failed to load users.</td></tr>';
        }
    }

    // ── Toxic Logs Tab ──
    async function loadToxicLogs() {
        const tbody = document.getElementById('toxicLogsTableBody');
        try {
            const data = await apiCall('/api/admin/toxic-messages');
            if (!data.messages || data.messages.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:20px;">✅ No toxic messages recorded.</td></tr>';
                return;
            }

            tbody.innerHTML = data.messages.map(msg => `
                <tr>
                    <td>#${msg.id}</td>
                    <td style="font-weight:500;">${msg.username}</td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--danger);" title="${msg.content.replace(/"/g, '&quot;')}">${msg.content}</td>
                    <td><span class="category-badge">${msg.toxic_category || '—'}</span></td>
                    <td class="text-muted" style="font-size:0.78rem;">${formatDate(msg.created_at)}</td>
                    <td><button class="btn btn-sm danger-btn" onclick="adminActions.deleteMessage(${msg.id})">Delete</button></td>
                </tr>
            `).join('');
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color:var(--danger);padding:20px;">Failed to load logs.</td></tr>';
        }
    }

    // ── Blocked Users Tab ──
    async function loadBlockedUsers() {
        const tbody = document.getElementById('blockedUsersTableBody');
        try {
            const data = await apiCall('/api/admin/blocked');
            if (!data.blockedUsers || data.blockedUsers.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:20px;">✅ No blocked users.</td></tr>';
                return;
            }

            tbody.innerHTML = data.blockedUsers.map(user => `
                <tr>
                    <td>#${user.id}</td>
                    <td style="font-weight:500;">${user.username}</td>
                    <td class="text-muted">${user.email}</td>
                    <td><span class="bad-badge">${user.strikes} Strikes</span></td>
                    <td class="text-muted" style="font-size:0.78rem;">${formatDate(user.blocked_at)}</td>
                    <td><button class="btn btn-sm success-btn" onclick="adminActions.unblock(${user.id})">Unblock</button></td>
                </tr>
            `).join('');
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color:var(--danger);padding:20px;">Failed to load.</td></tr>';
        }
    }

    // ── Words Tab ──
    async function loadWords() {
        const tbody = document.getElementById('wordsTableBody');
        try {
            const data = await apiCall('/api/admin/toxic-words');
            if (!data.words || data.words.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:20px;">No toxic words configured.</td></tr>';
                return;
            }

            tbody.innerHTML = data.words.map(word => `
                <tr>
                    <td>#${word.id}</td>
                    <td style="font-weight:500; color:var(--danger);">${word.word}</td>
                    <td><span class="category-badge">${word.category}</span></td>
                    <td class="text-muted" style="font-size:0.78rem;">${formatDate(word.created_at)}</td>
                    <td><button class="btn btn-sm danger-btn" onclick="adminActions.deleteWord(${word.id})">Remove</button></td>
                </tr>
            `).join('');
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="color:var(--danger);padding:20px;">Failed to load words.</td></tr>';
        }
    }

    // ── Global Actions (exposed to inline onclick) ──
    window.adminActions = {
        async unblock(userId) {
            if (!confirm(`Unblock User #${userId}?`)) return;
            try {
                const data = await apiCall(`/api/admin/unblock/${userId}`, 'POST');
                showAlert('blockedActionMessage', data.message, 'success');
                loadAllData();
            } catch (err) {
                showAlert('blockedActionMessage', err.message, 'error');
            }
        },

        async resetStrikes(userId) {
            if (!confirm(`Reset strikes for User #${userId}?`)) return;
            try {
                const data = await apiCall(`/api/admin/reset-strikes/${userId}`, 'POST');
                showAlert('blockedActionMessage', data.message, 'success');
                loadAllData();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        },

        async deleteMessage(msgId) {
            if (!confirm(`Delete toxic message #${msgId}?`)) return;
            try {
                await apiCall(`/api/admin/messages/${msgId}`, 'DELETE');
                loadToxicLogs();
                loadStats();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        },

        async deleteWord(wordId) {
            if (!confirm(`Remove this toxic word?`)) return;
            try {
                await apiCall(`/api/admin/toxic-words/${wordId}`, 'DELETE');
                showAlert('wordActionMessage', 'Word removed successfully.', 'success');
                loadWords();
            } catch (err) {
                showAlert('wordActionMessage', err.message, 'error');
            }
        }
    };

    // ── Add Word ──
    document.getElementById('addWordBtn').addEventListener('click', async () => {
        const word = document.getElementById('newWordInput').value.trim();
        const category = document.getElementById('newWordCategory').value;

        if (!word) {
            showAlert('wordActionMessage', 'Please enter a word.', 'error');
            return;
        }

        try {
            const data = await apiCall('/api/admin/toxic-words', 'POST', { word, category });
            showAlert('wordActionMessage', data.message, 'success');
            document.getElementById('newWordInput').value = '';
            loadWords();
        } catch (err) {
            showAlert('wordActionMessage', err.message, 'error');
        }
    });

    // ── Unblock All ──
    document.getElementById('unblockAllBtn').addEventListener('click', async () => {
        if (!confirm('Unblock ALL blocked users?')) return;
        try {
            const data = await apiCall('/api/admin/unblock-all', 'POST');
            showAlert('blockedActionMessage', data.message, 'success');
            loadAllData();
        } catch (err) {
            showAlert('blockedActionMessage', err.message, 'error');
        }
    });

    // ── Refresh Buttons ──
    document.getElementById('refreshUsersBtn').addEventListener('click', loadUsers);
    document.getElementById('refreshLogsBtn').addEventListener('click', loadToxicLogs);
    document.getElementById('refreshBlockedBtn').addEventListener('click', loadBlockedUsers);
    document.getElementById('refreshWordsBtn').addEventListener('click', loadWords);

    // ── Auto-login if key is saved ──
    if (adminKey) {
        loginBtn.click();
    }
});
