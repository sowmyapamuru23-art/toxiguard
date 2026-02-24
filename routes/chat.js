// ToxiGuard - Chat Routes
const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { getRecentMessages } = require('../models/Message');

// GET /api/chat/messages - Get last 50 safe messages (protected)
router.get('/messages', verifyToken, async (req, res) => {
    try {
        const messages = await getRecentMessages(50);
        return res.status(200).json({ messages });
    } catch (err) {
        console.error('Fetch messages error:', err.message);
        return res.status(500).json({ message: 'Failed to fetch messages.' });
    }
});

module.exports = router;
