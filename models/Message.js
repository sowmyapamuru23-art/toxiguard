// ToxiGuard - Message Model (DB Operations)
const db = require('../config/db');

/**
 * Save a message to the database
 * @param {number} userId - The sender's user ID
 * @param {number|null} receiverId - The receiver's user ID
 * @param {string} username - The sender's username
 * @param {string} content - Message text
 * @param {boolean} isToxic - Whether the message was flagged
 * @param {string|null} toxicCategory - Category if toxic
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
 * Get 1-to-1 chat history between two users
 * @param {number} user1 - First user ID
 * @param {number} user2 - Second user ID
 * @param {number} limit - Number of messages to retrieve
 */
const getChatHistory = async (user1, user2, limit = 50) => {
    const [rows] = await db.query(
        `SELECT user_id, receiver_id, username, content, created_at
     FROM messages
     WHERE is_toxic = 0
     AND ((user_id = ? AND receiver_id = ?) OR (user_id = ? AND receiver_id = ?))
     ORDER BY created_at ASC
     LIMIT ?`,
        [user1, user2, user2, user1, limit]
    );
    return rows;
};

module.exports = { saveMessage, getChatHistory };
