const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Verify JWT and attach user to request.
 */
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorised — token missing' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role guard. Usage: requireRole('interviewer')
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Forbidden — insufficient role' });
  }
  next();
};

/**
 * Verify secret key for administrative actions (e.g., employee registration).
 */
const verifyAdminKey = (req, res, next) => {
  const adminKey = req.body.adminKey;
  const secret = process.env.ADMIN_REGISTRATION_KEY || 'FALLBACK_SECRET_CHANGE_ME';
  
  if (!adminKey || adminKey !== secret) {
    return res.status(403).json({ success: false, message: 'Invalid Admin Registration Key' });
  }
  next();
};

module.exports = { protect, requireRole, verifyAdminKey };
