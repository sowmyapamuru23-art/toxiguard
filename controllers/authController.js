// ToxiGuard - Auth Controller (Enhanced with auto-unblock)
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// 24 hour cooldown for auto-unblock
const BLOCK_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a signed JWT token for a user
 */
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            email: user.email,
            strikes: user.strikes || 0,
            is_blocked: user.is_blocked || 0
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
};

/**
 * Check if a blocked user should be auto-unblocked
 */
async function tryAutoUnblock(user) {
    if (user.is_blocked && user.blocked_at) {
        const blockedTime = new Date(user.blocked_at).getTime();
        if (Date.now() - blockedTime >= BLOCK_COOLDOWN_MS) {
            await db.query(
                'UPDATE users SET is_blocked = 0, strikes = 0, blocked_at = NULL, muted_until = NULL WHERE id = ?',
                [user.id]
            );
            user.is_blocked = 0;
            user.strikes = 0;
            console.log(`🔓 Auto-unblocked user "${user.username}" on login (24h cooldown expired)`);
            return true;
        }
    }
    return false;
}

/**
 * POST /api/auth/register
 */
const register = async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    try {
        const [existing] = await db.query(
            'SELECT id FROM users WHERE email = ? OR username = ?',
            [email, username]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: 'Username or email already taken.' });
        }

        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        const [result] = await db.query(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, password_hash]
        );

        const newUser = { id: result.insertId, username, email };
        const token = generateToken(newUser);

        return res.status(201).json({
            message: 'Registration successful!',
            token,
            user: { id: newUser.id, username, email }
        });
    } catch (err) {
        console.error('Register error:', err.message);
        return res.status(500).json({ message: 'Server error. Please try again.' });
    }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const user = rows[0];

        // Check if user is blocked — try auto-unblock first
        if (user.is_blocked) {
            const unblocked = await tryAutoUnblock(user);
            if (!unblocked) {
                // Still blocked — show remaining time
                const blockedAt = user.blocked_at ? new Date(user.blocked_at) : new Date();
                const unblockAt = new Date(blockedAt.getTime() + BLOCK_COOLDOWN_MS);
                const remainingMs = unblockAt.getTime() - Date.now();
                const remainingHours = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));

                return res.status(403).json({
                    message: `🚫 Your account is blocked due to repeated toxic behavior.\n\nAuto-unblock in ~${remainingHours} hour(s), or contact an admin.`
                });
            }
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const token = generateToken(user);

        return res.status(200).json({
            message: 'Login successful!',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                strikes: user.strikes,
                is_blocked: user.is_blocked
            }
        });
    } catch (err) {
        console.error('Login error:', err.message);
        return res.status(500).json({ message: 'Server error. Please try again.' });
    }
};

module.exports = { register, login };
