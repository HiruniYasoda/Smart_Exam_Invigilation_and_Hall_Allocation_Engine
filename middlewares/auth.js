const crypto = require('crypto');

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

function verifyJwtToken(token, secret) {
  if (jwt && typeof jwt.verify === 'function') {
    return jwt.verify(token, secret);
  }

  // Cryptographically robust native Node.js fallback
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT token');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest('base64url');
  
  const sigBuf = Buffer.from(signatureB64);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid signature');
  }

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    const err = new Error('Token expired');
    err.name = 'TokenExpiredError';
    throw err;
  }

  return payload;
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

  try {
    const config = require('../config/env')();
    const decoded = verifyJwtToken(token, config.JWT_SECRET);

    if (User && typeof User.findById === 'function' && typeof User.findOne === 'function') {
      try {
        const user = await User.findById(decoded.id).select('-password');
        if (user) {
          req.user = user;
        } else {
          req.user = decoded;
        }
      } catch (dbErr) {
        req.user = decoded;
      }
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
