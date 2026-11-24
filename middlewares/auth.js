let jwt = null;
try {
  jwt = require('jsonwebtoken');
} catch (e) {
  // Gracefully handle uninstalled dependency during offline tests
}

let User = null;
try {
  User = require('../models/User');
} catch (e) {
  // Gracefully handle model resolution
}

/**
 * Authentication middleware.
 * Verifies Bearer JWT and hydrates req.user.
 */
exports.authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No or malformed token provided' });
  }

  const token = authHeader.split(' ')[1];

  if (!jwt) {
    return res.status(500).json({ success: false, message: 'JWT library not loaded' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret_key_change_in_prod';
    const decoded = jwt.verify(token, jwtSecret);

    if (User && typeof User.findById === 'function') {
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ success: false, message: 'Unauthorized: User account no longer exists' });
      }
      req.user = user;
    } else {
      req.user = decoded;
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired: Please log in again' });
    }
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid authentication token' });
  }
};

/**
 * Role-based authorization middleware.
 * Case-insensitive comparison against user's assigned role.
 */
exports.authorizeRoles = (...roles) => {
  const normalizedRoles = roles.map(r => r.toLowerCase());
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ success: false, message: 'Forbidden: Access denied' });
    }

    const userRole = req.user.role.toLowerCase();
    if (!normalizedRoles.includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Insufficient privileges' });
    }

    next();
  };
};
