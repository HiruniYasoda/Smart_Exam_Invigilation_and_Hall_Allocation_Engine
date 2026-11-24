const crypto = require('crypto');

/**
 * Enterprise Password & Token Utility
 * Supports bcrypt when available, with a cryptographically secure
 * Scrypt fallback (Node.js built-in crypto) to guarantee secure hashing
 * and constant-time comparison in all execution environments.
 */

let bcrypt = null;
try {
  bcrypt = require('bcrypt');
} catch (e) {
  // Graceful fallback to built-in crypto.scrypt
}

/**
 * Hashes a plaintext password using bcrypt (cost 10) or scrypt (64-byte key).
 * @param {string} password 
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a valid non-empty string');
  }

  if (bcrypt && typeof bcrypt.hash === 'function') {
    return await bcrypt.hash(password, 10);
  }

  // Scrypt fallback with cryptographically random salt
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt:${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Compares a candidate password against an existing hash using timing-safe comparison.
 * @param {string} password 
 * @param {string} storedHash 
 * @returns {Promise<boolean>}
 */
async function comparePassword(password, storedHash) {
  if (!password || !storedHash) return false;

  // Check if hash was generated with bcrypt ($2a$, $2b$, etc.)
  if (storedHash.startsWith('$2') && bcrypt && typeof bcrypt.compare === 'function') {
    return await bcrypt.compare(password, storedHash);
  }

  // Check if hash was generated with scrypt
  if (storedHash.startsWith('scrypt:')) {
    const [, salt, originalKeyHex] = storedHash.split(':');
    return new Promise((resolve) => {
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) return resolve(false);
        const originalKey = Buffer.from(originalKeyHex, 'hex');
        resolve(crypto.timingSafeEqual(originalKey, derivedKey));
      });
    });
  }

  // Fallback for legacy plain text migration (timing safe string comparison)
  const candidateBuf = Buffer.from(password);
  const storedBuf = Buffer.from(storedHash);
  if (candidateBuf.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(candidateBuf, storedBuf);
}

/**
 * Hashes a sensitive token (e.g. password reset token) using SHA-256
 * before storing in the database.
 * @param {string} token 
 * @returns {string}
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  hashPassword,
  comparePassword,
  hashToken
};
