// ToxiGuard - Admin Routes (Full Dashboard API)
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { getToxicMessages, deleteMessage, getStats } = require('../models/Message');
const { reloadCache } = require('../utils/toxicityDetector');

// Simple admin key check
const checkAdminKey = (req, res, next) => {
    const key = req.headers['x-admin-key'] || req.query.key;
    if (!key || key !== process.env.ADMIN_KEY) {
        return res.status(403).json({ message: 'Invalid admin key.' });
    }
    next();
};

// ── GET /api/admin/stats ──────────────────────────────────────
// Get analytics overview
router.get('/stats', checkAdminKey, async (req, res) => {
    try {
        const stats = await getStats();
        return res.json(stats);
    } catch (err) {
        console.error('Admin stats error:', err.message);
        return res.status(500).json({ message: 'Server error fetching stats.' });
    }
});

// ── GET /api/admin/users ──────────────────────────────────────
// Get all users with strike info
router.get('/users', checkAdminKey, async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, username, email, strikes, is_blocked, muted_until, blocked_at, created_at FROM users ORDER BY created_at DESC'
        );
        return res.json({ users, total: users.length });
    } catch (err) {
        console.error('Admin users error:', err.message);
        return res.status(500).json({ message: 'Server error fetching users.' });
    }
});

// ── GET /api/admin/blocked ──────────────────────────────────────
// Get all blocked users
router.get('/blocked', checkAdminKey, async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, username, email, strikes, blocked_at FROM users WHERE is_blocked = 1'
        );
        return res.json({
            blockedCount: users.length,
            blockedUsers: users
        });
    } catch (err) {
        console.error('Admin Fetch Blocked error:', err.message);
        return res.status(500).json({ message: 'Server error while fetching blocked users.' });
    }
});

// ── GET /api/admin/toxic-messages ────────────────────────────────
// Get toxic message logs
router.get('/toxic-messages', checkAdminKey, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const messages = await getToxicMessages(limit);
        return res.json({ messages, total: messages.length });
    } catch (err) {
        console.error('Toxic messages error:', err.message);
        return res.status(500).json({ message: 'Server error fetching toxic messages.' });
    }
});

// ── POST /api/admin/unblock/:userId ─────────────────────────────
// Unblock a specific user (manual admin action)
router.post('/unblock/:userId', checkAdminKey, async (req, res) => {
    const userId = parseInt(req.params.userId);
    if (!userId) {
        return res.status(400).json({ message: 'Invalid user ID.' });
    }

    try {
        const [rows] = await db.query('SELECT id, username FROM users WHERE id = ?', [userId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        await db.query(
            'UPDATE users SET is_blocked = 0, strikes = 0, blocked_at = NULL, muted_until = NULL WHERE id = ?',
            [userId]
        );

        return res.json({
            message: `✅ User "${rows[0].username}" has been unblocked successfully.`,
            userId,
            username: rows[0].username
        });
    } catch (err) {
        console.error('Unblock user error:', err.message);
        return res.status(500).json({ message: 'Server error while unblocking user.' });
    }
});

// ── POST /api/admin/unblock-all ──────────────────────────────────
// Unblock ALL blocked users
router.post('/unblock-all', checkAdminKey, async (req, res) => {
    try {
        const [result] = await db.query(
            'UPDATE users SET is_blocked = 0, strikes = 0, blocked_at = NULL, muted_until = NULL WHERE is_blocked = 1'
        );
        return res.json({
            message: `✅ All ${result.affectedRows} blocked user(s) have been unblocked.`,
            count: result.affectedRows
        });
    } catch (err) {
        console.error('Unblock all error:', err.message);
        return res.status(500).json({ message: 'Server error while unblocking all users.' });
    }
});

// ── POST /api/admin/reset-strikes/:userId ────────────────────────
// Reset strikes for a user without changing block status
router.post('/reset-strikes/:userId', checkAdminKey, async (req, res) => {
    const userId = parseInt(req.params.userId);
    if (!userId) {
        return res.status(400).json({ message: 'Invalid user ID.' });
    }

    try {
        const [rows] = await db.query('SELECT id, username FROM users WHERE id = ?', [userId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        await db.query(
            'UPDATE users SET strikes = 0, muted_until = NULL WHERE id = ?',
            [userId]
        );

        return res.json({
            message: `✅ Strikes reset for "${rows[0].username}".`,
            userId,
            username: rows[0].username
        });
    } catch (err) {
        console.error('Reset strikes error:', err.message);
        return res.status(500).json({ message: 'Server error.' });
    }
});

// ── DELETE /api/admin/messages/:id ───────────────────────────────
// Delete a toxic message
router.delete('/messages/:id', checkAdminKey, async (req, res) => {
    const msgId = parseInt(req.params.id);
    if (!msgId) {
        return res.status(400).json({ message: 'Invalid message ID.' });
    }

    try {
        const deleted = await deleteMessage(msgId);
        if (deleted) {
            return res.json({ message: `✅ Message #${msgId} deleted.` });
        } else {
            return res.status(404).json({ message: 'Message not found.' });
        }
    } catch (err) {
        console.error('Delete message error:', err.message);
        return res.status(500).json({ message: 'Server error.' });
    }
});

// ── GET /api/admin/toxic-words ───────────────────────────────────
// Get all toxic words
router.get('/toxic-words', checkAdminKey, async (req, res) => {
    try {
        const [words] = await db.query('SELECT id, word, category, created_at FROM toxic_words ORDER BY category, word');
        return res.json({ words, total: words.length });
    } catch (err) {
        console.error('Get toxic words error:', err.message);
        return res.status(500).json({ message: 'Server error.' });
    }
});

// ── POST /api/admin/toxic-words ──────────────────────────────────
// Add a new toxic word
router.post('/toxic-words', checkAdminKey, async (req, res) => {
    const { word, category } = req.body;
    if (!word || !category) {
        return res.status(400).json({ message: 'Word and category are required.' });
    }

    try {
        await db.query(
            'INSERT IGNORE INTO toxic_words (word, category) VALUES (?, ?)',
            [word.toLowerCase().trim(), category.toLowerCase().trim()]
        );
        // Reload cache
        await reloadCache();
        return res.json({ message: `✅ Added "${word}" to ${category} category.` });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Word already exists in this category.' });
        }
        console.error('Add toxic word error:', err.message);
        return res.status(500).json({ message: 'Server error.' });
    }
});

// ── DELETE /api/admin/toxic-words/:id ────────────────────────────
// Remove a toxic word
router.delete('/toxic-words/:id', checkAdminKey, async (req, res) => {
    const wordId = parseInt(req.params.id);
    if (!wordId) {
        return res.status(400).json({ message: 'Invalid word ID.' });
    }

    try {
        const [result] = await db.query('DELETE FROM toxic_words WHERE id = ?', [wordId]);
        if (result.affectedRows > 0) {
            // Reload cache
            await reloadCache();
            return res.json({ message: `✅ Toxic word removed.` });
        } else {
            return res.status(404).json({ message: 'Word not found.' });
        }
    } catch (err) {
        console.error('Delete toxic word error:', err.message);
        return res.status(500).json({ message: 'Server error.' });
    }
});

module.exports = router;
