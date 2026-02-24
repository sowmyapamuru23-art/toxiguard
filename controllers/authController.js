// ToxiGuard - Auth Controller (Register + Login)
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Generate a signed JWT token for a user
 */
const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, username: user.username, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
};

/**
 * POST /api/auth/register
 * Register a new user
 */
const register = async (req, res) => {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    try {
        // Check if username or email already exists
        const [existing] = await db.query(
            'SELECT id FROM users WHERE email = ? OR username = ?',
            [email, username]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: 'Username or email already taken.' });
        }

        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Insert new user
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
 * Login with email and password
 */
const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        // Find user by email
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const user = rows[0];

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const token = generateToken(user);

        return res.status(200).json({
            message: 'Login successful!',
            token,
            user: { id: user.id, username: user.username, email: user.email }
        });

    } catch (err) {
        console.error('Login error:', err.message);
        return res.status(500).json({ message: 'Server error. Please try again.' });
    }
};

module.exports = { register, login };
