// ToxiGuard - Auth Routes
const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');

// POST /api/auth/register - Create new account
router.post('/register', register);

// POST /api/auth/login - Login
router.post('/login', login);

module.exports = router;
