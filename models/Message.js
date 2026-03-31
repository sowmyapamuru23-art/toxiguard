// ToxiGuard - Message Model (Enhanced with read receipts & analytics)
const db = require('../config/db');

/**
 * Save a message to the database
 */
const saveMessage = async (userId, receiverId, username, content, isToxic, toxicCategory = null) => {
    const [result] = await db.query(
        `INSERT INTO messages (user_id, receiver_id, username, content, is_toxic, toxic_category)
     VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, receiverId, username, content, isToxic ? 1 : 0, toxicCategory]
    );
    return result.insertId;
};

/**
 * Get 1-to-1 chat history between two users (non-toxic only)
 */
const getChatHistory = async (user1, user2, limit = 50) => {
    const [rows] = await db.query(
        `SELECT id, user_id, receiver_id, username, content, is_toxic, is_read, created_at
     FROM messages
     WHERE is_toxic = 0
     AND ((user_id = ? AND receiver_id = ?) OR (user_id = ? AND receiver_id = ?))
     ORDER BY created_at ASC
     LIMIT ?`,
        [user1, user2, user2, user1, limit]
    );
    return rows;
};

/**
 * Mark messages as read
 */
const markAsRead = async (senderId, receiverId) => {
    await db.query(
        `UPDATE messages SET is_read = 1 
         WHERE user_id = ? AND receiver_id = ? AND is_read = 0 AND is_toxic = 0`,
        [senderId, receiverId]
    );
};

/**
 * Get unread message count per sender for a user
 */
const getUnreadCounts = async (userId) => {
    const [rows] = await db.query(
        `SELECT user_id as senderId, COUNT(*) as count 
         FROM messages 
         WHERE receiver_id = ? AND is_read = 0 AND is_toxic = 0 
         GROUP BY user_id`,
        [userId]
    );
    return rows;
};

/**
 * Get toxic message logs (for admin)
 */
const getToxicMessages = async (limit = 100) => {
    const [rows] = await db.query(
        `SELECT m.id, m.user_id, m.username, m.content, m.toxic_category, m.created_at,
                u.email as user_email
         FROM messages m
         LEFT JOIN users u ON m.user_id = u.id
         WHERE m.is_toxic = 1
         ORDER BY m.created_at DESC
         LIMIT ?`,
        [limit]
    );
    return rows;
};

/**
 * Delete a message by ID
 */
const deleteMessage = async (messageId) => {
    const [result] = await db.query('DELETE FROM messages WHERE id = ?', [messageId]);
    return result.affectedRows > 0;
};

/**
 * Get analytics stats
 */
const getStats = async () => {
    const [totalMessages] = await db.query('SELECT COUNT(*) as count FROM messages');
    const [toxicMessages] = await db.query('SELECT COUNT(*) as count FROM messages WHERE is_toxic = 1');
    const [totalUsers] = await db.query('SELECT COUNT(*) as count FROM users');
    const [blockedUsers] = await db.query('SELECT COUNT(*) as count FROM users WHERE is_blocked = 1');
    const [categories] = await db.query(
        `SELECT toxic_category, COUNT(*) as count 
         FROM messages WHERE is_toxic = 1 AND toxic_category IS NOT NULL 
         GROUP BY toxic_category ORDER BY count DESC`
    );

    return {
        totalMessages: totalMessages[0].count,
        toxicMessages: toxicMessages[0].count,
        totalUsers: totalUsers[0].count,
        blockedUsers: blockedUsers[0].count,
        toxicPercentage: totalMessages[0].count > 0
            ? ((toxicMessages[0].count / totalMessages[0].count) * 100).toFixed(1)
            : '0.0',
        topCategories: categories
    };
};

module.exports = { saveMessage, getChatHistory, markAsRead, getUnreadCounts, getToxicMessages, deleteMessage, getStats };
