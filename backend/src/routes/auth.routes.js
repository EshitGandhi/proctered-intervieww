const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, verifyAdminKey } = require('../middleware/auth.middleware');

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /api/auth/verify-key
router.post('/verify-key', verifyAdminKey, (req, res) => {
  res.json({ success: true, message: 'Key verified' });
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role, domain, adminKey } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Role Assignment with Secret Key Verification
    let userRole = 'candidate';
    if (['admin', 'interviewer'].includes(role)) {
      const secret = process.env.ADMIN_REGISTRATION_KEY || 'FALLBACK_SECRET_CHANGE_ME';
      if (!adminKey || adminKey !== secret) {
        return res.status(403).json({ success: false, message: 'Invalid Admin Registration Key' });
      }
      userRole = role;
    }

    const user = await User.create({ name, email, password, role: userRole, domain });
    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, domain: user.domain },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = signToken(user._id);

    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, domain: user.domain },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res, next) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        domain: req.user.domain,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
