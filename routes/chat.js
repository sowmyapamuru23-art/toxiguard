// ToxiGuard - Chat Routes
const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { getChatHistory } = require('../models/Message');

// GET /api/chat/history/:receiverId - Get 1-to-1 message history (protected)
router.get('/history/:receiverId', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const receiverId = req.params.receiverId;

        if (!receiverId) {
            return res.status(400).json({ message: 'Receiver ID is required.' });
        }

        const messages = await getChatHistory(userId, receiverId, 50);
        return res.status(200).json({ messages });
    } catch (err) {
        console.error('Fetch history error:', err.message);
        return res.status(500).json({ message: 'Failed to fetch chat history.' });
    }
});

module.exports = router;
