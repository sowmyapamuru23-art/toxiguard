// ToxiGuard - JWT Authentication Middleware
const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token from Authorization header
 * Attaches decoded user data to req.user
 */
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    // Expect format: "Bearer <token>"
    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Invalid token format. Use: Bearer <token>' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { id, username, email }
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Token is invalid or has expired.' });
    }
};

module.exports = verifyToken;
