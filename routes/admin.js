// ToxiGuard - Admin Routes (Unblock Users)
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { unblockUser, getBlockedUsers, getAllStrikes } = require('../socket/chatSocket');

// Simple admin key check (set ADMIN_KEY in .env)
const checkAdminKey = (req, res, next) => {
    const key = req.headers['x-admin-key'] || req.query.key;
    if (!key || key !== process.env.ADMIN_KEY) {
        return res.status(403).json({ message: 'Invalid admin key.' });
    }
    next();
};

// ── GET /api/admin/blocked ──────────────────────────────────────
// View all currently blocked user IDs + strike counts
router.get('/blocked', checkAdminKey, async (req, res) => {
    try {
        const blockedIds = getBlockedUsers();
        const strikes = getAllStrikes();

        // Fetch usernames for blocked IDs from DB
        let users = [];
        if (blockedIds.length > 0) {
            const placeholders = blockedIds.map(() => '?').join(',');
            const [rows] = await db.query(
                `SELECT id, username, email FROM users WHERE id IN (${placeholders})`,
                blockedIds
            );
            users = rows.map(u => ({
                ...u,
                strikes: strikes[u.id] || 0
            }));
        }

        return res.json({
            blockedCount: blockedIds.length,
            blockedUsers: users
        });
    } catch (err) {
        return res.status(500).json({ message: 'Server error.' });
    }
});

// ── POST /api/admin/unblock/:userId ─────────────────────────────
// Unblock a specific user by ID
router.post('/unblock/:userId', checkAdminKey, async (req, res) => {
    const userId = parseInt(req.params.userId);
    if (!userId) {
        return res.status(400).json({ message: 'Invalid user ID.' });
    }

    // Check user exists
    const [rows] = await db.query('SELECT id, username FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
        return res.status(404).json({ message: 'User not found.' });
    }

    unblockUser(userId);

    return res.json({
        message: `✅ User "${rows[0].username}" has been unblocked successfully.`,
        userId,
        username: rows[0].username
    });
});

// ── POST /api/admin/unblock-all ──────────────────────────────────
// Unblock ALL blocked users at once
router.post('/unblock-all', checkAdminKey, (req, res) => {
    const blocked = getBlockedUsers();
    blocked.forEach(id => unblockUser(id));
    return res.json({
        message: `✅ All ${blocked.length} blocked user(s) have been unblocked.`,
        count: blocked.length
    });
});

module.exports = router;
