// ToxiGuard - User Routes
const express = require('express');
const router = express.Router();
const { getAllUsers } = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

// GET /api/users - Get contact list (requires authentication)
router.get('/', authMiddleware, getAllUsers);

module.exports = router;
