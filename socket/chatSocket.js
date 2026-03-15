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

// User Socket Mapping: { userId -> Set of socketIds } (to handle multiple tabs)
const onlineUsersMap = new Map();

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

        // ── Block check ──
        if (blockedUsers.has(userId)) {
            socket.emit('blocked', {
                message: '🚫 You have been blocked from this chat due to repeated toxic behavior.'
            });
            socket.disconnect(true);
            return;
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
        // io.emit('systemMessage', `${username} joined the chat.`); // Global join msg (optional for personal)

        // Send current strike count
        socket.emit('strikeUpdate', {
            strikes: userStrikes[userId] || 0,
            maxStrikes: MAX_STRIKES
        });

        // ── Handle incoming 1-to-1 chat message ──
        socket.on('chatMessage', async (data) => {
            const { content, receiverId } = data;
            if (!content || !content.trim()) return;
            if (!receiverId) return;

            // Check if user got blocked while connected
            if (blockedUsers.has(userId)) {
                socket.emit('blocked', { message: '🚫 You are blocked from sending messages.' });
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
                    blockedUsers.add(userId);
                    socket.emit('blocked', {
                        message: `🚫 You have been BLOCKED.\nReason: ${MAX_STRIKES} toxic messages detected.`
                    });
                    socket.disconnect(true);
                } else {
                    socket.emit('warning', {
                        message: `⚠️ Toxic message blocked! (${category.toUpperCase()})`,
                        category, strikes, maxStrikes: MAX_STRIKES, remaining
                    });
                    socket.emit('strikeUpdate', { strikes, maxStrikes: MAX_STRIKES });
                }

                // Save toxic message record
                try {
                    await saveMessage(userId, receiverId, username, trimmedContent, true, category);
                } catch (err) { console.error('DB save error (toxic):', err.message); }

            } else {
                // ── Safe message: emit only to SENDER and RECEIVER ──
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
                    receiverSockets.forEach(sid => io.to(sid).emit('chatMessage', msgData));
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
                    console.log(`❌ ${username} went offline | Online: ${onlineUsers}`);
                }
            }
        });

    });
};

module.exports = { initSocket, unblockUser, getBlockedUsers, getAllStrikes };
