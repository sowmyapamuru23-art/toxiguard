// ToxiGuard - Socket.io Chat Handler (Enhanced with Tiered Strikes, Mute, Typing, Read Receipts)
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { detectToxicity } = require('../utils/toxicityDetector');
const { saveMessage, markAsRead, getUnreadCounts } = require('../models/Message');

// Track online users count
let onlineUsers = 0;

// User Socket Mapping: { userId -> Set of socketIds }
const onlineUsersMap = new Map();

// Max toxic messages before ban
const MAX_STRIKES = 3;

// Mute duration on 2nd strike (5 minutes)
const MUTE_DURATION_MS = 5 * 60 * 1000;

// Auto-unblock cooldown (24 hours)
const BLOCK_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Rate limiting: max messages per 2 seconds
const RATE_LIMIT_WINDOW = 2000;
const RATE_LIMIT_MAX = 5;
const rateLimitMap = new Map();

// ── Admin Action Helpers ──

const disconnectUserSockets = (io, userId, message) => {
    const sockets = onlineUsersMap.get(userId);
    if (sockets) {
        sockets.forEach(sid => {
            const socket = io.sockets.sockets.get(sid);
            if (socket) {
                socket.emit('blocked', { message });
                socket.disconnect(true);
            }
        });
    }
};

/**
 * Check if user should be auto-unblocked (24h cooldown passed)
 */
async function checkAutoUnblock(userId) {
    try {
        const [rows] = await db.query(
            'SELECT is_blocked, blocked_at FROM users WHERE id = ?', [userId]
        );
        if (rows.length === 0) return false;
        const user = rows[0];

        if (user.is_blocked && user.blocked_at) {
            const blockedTime = new Date(user.blocked_at).getTime();
            if (Date.now() - blockedTime >= BLOCK_COOLDOWN_MS) {
                // Auto-unblock
                await db.query(
                    'UPDATE users SET is_blocked = 0, strikes = 0, blocked_at = NULL, muted_until = NULL WHERE id = ?',
                    [userId]
                );
                console.log(`🔓 Auto-unblocked user ${userId} (24h cooldown expired)`);
                return true;
            }
        }
        return false;
    } catch (err) {
        console.error('Auto-unblock check error:', err.message);
        return false;
    }
}

/**
 * Check if user is currently muted
 */
function isMuted(mutedUntil) {
    if (!mutedUntil) return { muted: false, remaining: 0 };
    const remaining = new Date(mutedUntil).getTime() - Date.now();
    return {
        muted: remaining > 0,
        remaining: Math.max(0, Math.ceil(remaining / 1000))
    };
}

/**
 * Rate limit check
 */
function isRateLimited(userId) {
    const now = Date.now();
    if (!rateLimitMap.has(userId)) {
        rateLimitMap.set(userId, []);
    }
    const timestamps = rateLimitMap.get(userId);
    // Remove old timestamps
    while (timestamps.length > 0 && now - timestamps[0] > RATE_LIMIT_WINDOW) {
        timestamps.shift();
    }
    if (timestamps.length >= RATE_LIMIT_MAX) {
        return true;
    }
    timestamps.push(now);
    return false;
}

/**
 * Initialize Socket.io event handlers
 * @param {import('socket.io').Server} io
 */
const initSocket = (io) => {

    // ── Middleware: Verify JWT ──
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication required. Please login.'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (err) {
            return next(new Error('Invalid or expired token. Please login again.'));
        }
    });

    io.on('connection', async (socket) => {
        const { id: userId, username } = socket.user;

        // ── Database Block & Mute Check ──
        try {
            // First check auto-unblock
            await checkAutoUnblock(userId);

            const [rows] = await db.query(
                'SELECT strikes, is_blocked, muted_until, blocked_at FROM users WHERE id = ?',
                [userId]
            );
            if (rows.length > 0) {
                const userDb = rows[0];
                socket.user.strikes = userDb.strikes;
                socket.user.is_blocked = userDb.is_blocked;
                socket.user.muted_until = userDb.muted_until;

                if (userDb.is_blocked) {
                    const blockedAt = userDb.blocked_at ? new Date(userDb.blocked_at) : new Date();
                    const unblockAt = new Date(blockedAt.getTime() + BLOCK_COOLDOWN_MS);
                    const remainingMs = unblockAt.getTime() - Date.now();
                    const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));

                    socket.emit('blocked', {
                        message: `🚫 You have been blocked from this chat due to repeated toxic behavior.\n\nYou will be automatically unblocked in ~${remainingHours} hour(s), or contact an admin.`
                    });
                    socket.disconnect(true);
                    return;
                }
            }
        } catch (err) {
            console.error('DB fetch error on connect:', err.message);
        }

        // ── Track Online User ──
        if (!onlineUsersMap.has(userId)) {
            onlineUsersMap.set(userId, new Set());
        }
        onlineUsersMap.get(userId).add(socket.id);

        onlineUsers++;
        console.log(`✅ ${username} connected | Online: ${onlineUsers}`);

        // Broadcast updated count
        io.emit('userCount', onlineUsers);

        // Send current strike count
        socket.emit('strikeUpdate', {
            strikes: socket.user.strikes || 0,
            maxStrikes: MAX_STRIKES
        });

        // Send mute status if muted
        const muteStatus = isMuted(socket.user.muted_until);
        if (muteStatus.muted) {
            socket.emit('muted', {
                message: `🔇 You are temporarily muted.`,
                remaining: muteStatus.remaining
            });
        }

        // Send unread counts
        try {
            const unreadCounts = await getUnreadCounts(userId);
            socket.emit('unreadCounts', unreadCounts);
        } catch (err) {
            console.error('Unread counts error:', err.message);
        }

        // ── Handle Typing ──
        socket.on('typing', (data) => {
            const { receiverId, isTyping } = data;
            if (!receiverId) return;

            const receiverSockets = onlineUsersMap.get(parseInt(receiverId));
            if (receiverSockets) {
                receiverSockets.forEach(sid => {
                    io.to(sid).emit('userTyping', {
                        userId,
                        username,
                        isTyping
                    });
                });
            }
        });

        // ── Handle Read Receipt ──
        socket.on('markRead', async (data) => {
            const { senderId } = data;
            if (!senderId) return;

            try {
                await markAsRead(senderId, userId);
                // Notify sender their messages were read
                const senderSockets = onlineUsersMap.get(parseInt(senderId));
                if (senderSockets) {
                    senderSockets.forEach(sid => {
                        io.to(sid).emit('messagesRead', {
                            readBy: userId,
                            readByUsername: username
                        });
                    });
                }
            } catch (err) {
                console.error('Mark read error:', err.message);
            }
        });

        // ── Handle incoming 1-to-1 chat message ──
        socket.on('chatMessage', async (data) => {
            const { content, receiverId } = data;
            if (!content || !content.trim()) return;
            if (!receiverId) return;

            // Rate limit check
            if (isRateLimited(userId)) {
                socket.emit('warning', {
                    message: '⚡ You are sending messages too fast. Please slow down.',
                    category: 'rate_limit',
                    strikes: socket.user.strikes || 0,
                    maxStrikes: MAX_STRIKES,
                    remaining: MAX_STRIKES - (socket.user.strikes || 0)
                });
                return;
            }

            // Check if user got blocked while connected
            if (socket.user.is_blocked) {
                socket.emit('blocked', { message: '🚫 You are blocked from sending messages.' });
                socket.disconnect(true);
                return;
            }

            // Check mute status
            try {
                const [muteRows] = await db.query('SELECT muted_until FROM users WHERE id = ?', [userId]);
                if (muteRows.length > 0 && muteRows[0].muted_until) {
                    const mStatus = isMuted(muteRows[0].muted_until);
                    if (mStatus.muted) {
                        socket.emit('muted', {
                            message: `🔇 You are muted for ${mStatus.remaining} more seconds.`,
                            remaining: mStatus.remaining
                        });
                        return;
                    } else {
                        // Mute expired, clear it
                        await db.query('UPDATE users SET muted_until = NULL WHERE id = ?', [userId]);
                    }
                }
            } catch (err) {
                console.error('Mute check error:', err.message);
            }

            const trimmedContent = content.trim();

            // Run toxicity analysis
            const { isToxic, category } = await detectToxicity(trimmedContent);

            if (isToxic) {
                try {
                    // Update strikes in database
                    await db.query('UPDATE users SET strikes = strikes + 1 WHERE id = ?', [userId]);
                    const [rows] = await db.query('SELECT strikes FROM users WHERE id = ?', [userId]);
                    const strikes = rows[0].strikes;

                    socket.user.strikes = strikes;
                    const remaining = MAX_STRIKES - strikes;

                    console.log(`⚠️  ${username} toxic message [${category}] | Strikes: ${strikes}/${MAX_STRIKES}`);

                    if (strikes >= MAX_STRIKES) {
                        // ── STRIKE 3: BLOCK USER ──
                        await db.query(
                            'UPDATE users SET is_blocked = 1, blocked_at = NOW() WHERE id = ?',
                            [userId]
                        );
                        socket.user.is_blocked = 1;

                        socket.emit('blocked', {
                            message: `🚫 You have been BLOCKED.\nReason: ${MAX_STRIKES} toxic messages detected.\n\nYou will be automatically unblocked after 24 hours, or contact an admin.`
                        });

                        // Disconnect all of the user's active sockets
                        disconnectUserSockets(io, userId,
                            `🚫 You have been BLOCKED.\nReason: ${MAX_STRIKES} toxic messages detected.\n\nYou will be automatically unblocked after 24 hours.`
                        );

                    } else if (strikes === 2) {
                        // ── STRIKE 2: MUTE + FINAL WARNING ──
                        const muteUntil = new Date(Date.now() + MUTE_DURATION_MS);
                        await db.query('UPDATE users SET muted_until = ? WHERE id = ?', [muteUntil, userId]);

                        socket.emit('warning', {
                            message: `🔇 FINAL WARNING! Toxic message blocked (${category.toUpperCase()}).\nYou have been muted for 5 minutes.`,
                            category, strikes, maxStrikes: MAX_STRIKES, remaining
                        });
                        socket.emit('muted', {
                            message: '🔇 You have been temporarily muted for 5 minutes.',
                            remaining: MUTE_DURATION_MS / 1000
                        });
                        socket.emit('strikeUpdate', { strikes, maxStrikes: MAX_STRIKES });

                    } else {
                        // ── STRIKE 1: WARNING ──
                        socket.emit('warning', {
                            message: `⚠️ Warning! Toxic message blocked (${category.toUpperCase()}).\n${remaining} strike${remaining > 1 ? 's' : ''} remaining before ban.`,
                            category, strikes, maxStrikes: MAX_STRIKES, remaining
                        });
                        socket.emit('strikeUpdate', { strikes, maxStrikes: MAX_STRIKES });
                    }
                } catch (err) {
                    console.error('DB Update error (toxic):', err.message);
                }

                // Save toxic message record (always save for logs)
                try {
                    await saveMessage(userId, receiverId, username, trimmedContent, true, category);
                } catch (err) { console.error('DB save error (toxic):', err.message); }

                // Emit toxic feedback to sender only (so they see the red message)
                socket.emit('toxicMessage', {
                    senderId: userId,
                    username,
                    content: trimmedContent,
                    category,
                    timestamp: new Date().toISOString(),
                    receiverId
                });

            } else {
                // ── Safe message: emit to SENDER and RECEIVER ──
                const msgData = {
                    senderId: userId,
                    username,
                    content: trimmedContent,
                    timestamp: new Date().toISOString(),
                    receiverId
                };

                // Send to all of sender's tabs
                const senderSockets = onlineUsersMap.get(userId);
                if (senderSockets) {
                    senderSockets.forEach(sid => io.to(sid).emit('chatMessage', msgData));
                }

                // Send to all of receiver's tabs
                const receiverSockets = onlineUsersMap.get(parseInt(receiverId));
                if (receiverSockets) {
                    receiverSockets.forEach(sid => {
                        io.to(sid).emit('chatMessage', msgData);
                    });
                    // Notify sender that message was delivered
                    if (senderSockets) {
                        senderSockets.forEach(sid => {
                            io.to(sid).emit('messageDelivered', {
                                receiverId,
                                timestamp: msgData.timestamp
                            });
                        });
                    }
                }

                try {
                    await saveMessage(userId, receiverId, username, trimmedContent, false, null);
                } catch (err) { console.error('DB save error (safe):', err.message); }
            }
        });

        // ── Disconnect ──
        socket.on('disconnect', () => {
            const userSockets = onlineUsersMap.get(userId);
            if (userSockets) {
                userSockets.delete(socket.id);
                if (userSockets.size === 0) {
                    onlineUsersMap.delete(userId);
                    onlineUsers = Math.max(0, onlineUsers - 1);
                    io.emit('userCount', onlineUsers);

                    // Notify contacts that user went offline (stop typing)
                    io.emit('userTyping', { userId, username, isTyping: false });

                    console.log(`❌ ${username} went offline | Online: ${onlineUsers}`);
                }
            }
        });

    });
};

module.exports = { initSocket };
