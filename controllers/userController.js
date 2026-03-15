// ToxiGuard - User Controller
const db = require('../config/db');

/**
 * GET /api/users
 * Get all users except the currently logged-in user
 */
const getAllUsers = async (req, res) => {
    try {
        const currentUserId = req.user.id;

        const [rows] = await db.query(
            'SELECT id, username, email FROM users WHERE id != ?',
            [currentUserId]
        );

        return res.status(200).json(rows);
    } catch (err) {
        console.error('Error fetching users:', err.message);
        return res.status(500).json({ message: 'Server error while fetching users.' });
    }
};

module.exports = { getAllUsers };
