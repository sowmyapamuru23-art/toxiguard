// ToxiGuard - Message Model (DB Operations)
const db = require('../config/db');

/**
 * Save a message to the database
 * @param {number} userId - The sender's user ID
 * @param {string} username - The sender's username
 * @param {string} content - Message text
 * @param {boolean} isToxic - Whether the message was flagged
 * @param {string|null} toxicCategory - Category if toxic
 */
const saveMessage = async (userId, username, content, isToxic, toxicCategory = null) => {
    const [result] = await db.query(
        `INSERT INTO messages (user_id, username, content, is_toxic, toxic_category)
     VALUES (?, ?, ?, ?, ?)`,
        [userId, username, content, isToxic ? 1 : 0, toxicCategory]
    );
    return result.insertId;
};

/**
 * Get recent safe messages for chat history
 * @param {number} limit - Number of messages to retrieve
 */
const getRecentMessages = async (limit = 50) => {
    const [rows] = await db.query(
        `SELECT username, content, created_at
     FROM messages
     WHERE is_toxic = 0
     ORDER BY created_at ASC
     LIMIT ?`,
        [limit]
    );
    return rows;
};

module.exports = { saveMessage, getRecentMessages };
