// ToxiGuard - Socket.io Chat Handler (with Strike-Based User Blocking)
const jwt = require('jsonwebtoken');
const { detectToxicity } = require('../utils/toxicityDetector');
const { saveMessage } = require('../models/Message');

// Track online users count
let onlineUsers = 0;

// Strike tracker: { userId -> strikeCount }
const userStrikes = {};

// Permanently blocked users (this session): Set of userIds
const blockedUsers = new Set();

// Max toxic messages before ban
const MAX_STRIKES = 3;

// ── Unblock a user (called by admin route) ──
const unblockUser = (userId) => {
    blockedUsers.delete(userId);
    delete userStrikes[userId];
};

// ── Get all blocked user IDs ──
const getBlockedUsers = () => Array.from(blockedUsers);
const getAllStrikes = () => ({ ...userStrikes });


/**
 * Initialize Socket.io event handlers
 * @param {import('socket.io').Server} io
 */
const initSocket = (io) => {

    // ── Middleware: Verify JWT on every socket connection ──
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication required. Please login.'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded; // { id, username, email }
            next();
        } catch (err) {
            return next(new Error('Invalid or expired token. Please login again.'));
        }
    });

    io.on('connection', (socket) => {
        const { id: userId, username } = socket.user;

        // ── Block check: reject if user was banned this session ──
        if (blockedUsers.has(userId)) {
            socket.emit('blocked', {
                message: '🚫 You have been blocked from this chat due to repeated toxic behavior.'
            });
            socket.disconnect(true);
            return;
        }

        onlineUsers++;
        console.log(`✅ ${username} connected | Online: ${onlineUsers}`);

        // Send current strike count to reconnecting user
        socket.emit('strikeUpdate', {
            strikes: userStrikes[userId] || 0,
            maxStrikes: MAX_STRIKES
        });

        // Notify all of updated count & join message
        io.emit('userCount', onlineUsers);
        io.emit('systemMessage', `${username} joined the chat.`);

        // ── Handle incoming chat message ──
        socket.on('chatMessage', async (content) => {
            if (!content || content.trim() === '') return;

            // Check if user got blocked while connected
            if (blockedUsers.has(userId)) {
                socket.emit('blocked', {
                    message: '🚫 You are blocked from sending messages.'
                });
                socket.disconnect(true);
                return;
            }

            const trimmedContent = content.trim();

            // Run toxicity analysis
            const { isToxic, category } = detectToxicity(trimmedContent);

            if (isToxic) {
                // Increment strike counter
                userStrikes[userId] = (userStrikes[userId] || 0) + 1;
                const strikes = userStrikes[userId];
                const remaining = MAX_STRIKES - strikes;

                console.log(`⚠️  ${username} toxic message [${category}] | Strikes: ${strikes}/${MAX_STRIKES}`);

                if (strikes >= MAX_STRIKES) {
                    // ── BAN the user ──
                    blockedUsers.add(userId);

                    socket.emit('blocked', {
                        message: `🚫 You have been BLOCKED from ToxiGuard chat.\nReason: ${MAX_STRIKES} toxic messages detected.\nPlease contact admin to appeal.`
                    });

                    // Notify all that user was removed
                    io.emit('systemMessage', `⚠️ ${username} has been removed for toxic behavior.`);

                    try {
                        await saveMessage(userId, username, trimmedContent, true, category);
                    } catch (err) {
                        console.error('DB save error (ban):', err.message);
                    }

                    socket.disconnect(true);

                } else {
                    // ── Warn the user (not yet banned) ──
                    socket.emit('warning', {
                        message: `⚠️ Toxic message blocked! (${category.replace(/_/g, ' ').toUpperCase()})`,
                        category,
                        strikes,
                        maxStrikes: MAX_STRIKES,
                        remaining
                    });

                    // Send updated strike count
                    socket.emit('strikeUpdate', { strikes, maxStrikes: MAX_STRIKES });

                    try {
                        await saveMessage(userId, username, trimmedContent, true, category);
                    } catch (err) {
                        console.error('DB save error (toxic):', err.message);
                    }
                }

            } else {
                // ── Safe message: broadcast to everyone ──
                const msgData = {
                    username,
                    content: trimmedContent,
                    timestamp: new Date().toISOString()
                };
                io.emit('chatMessage', msgData);

                // Reset strikes on good behavior (optional: comment out to keep cumulative)
                // userStrikes[userId] = 0;

                try {
                    await saveMessage(userId, username, trimmedContent, false, null);
                } catch (err) {
                    console.error('DB save error (safe):', err.message);
                }
            }
        });

        // ── Disconnect ──
        socket.on('disconnect', () => {
            onlineUsers = Math.max(0, onlineUsers - 1);
            io.emit('userCount', onlineUsers);
            if (!blockedUsers.has(userId)) {
                io.emit('systemMessage', `${username} left the chat.`);
            }
            console.log(`❌ ${username} disconnected | Online: ${onlineUsers}`);
        });

    });
};

module.exports = { initSocket, unblockUser, getBlockedUsers, getAllStrikes };
