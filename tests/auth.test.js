const { describe, it } = require('node:test');
const assert = require('node:assert');
const { hashPassword, comparePassword, hashToken } = require('../utils/passwordUtils');
const { authorizeRoles } = require('../middlewares/auth');

describe('Security & Authentication - Unit Tests', () => {

  describe('Password Hashing & Verification', () => {
    it('generates a secure non-plaintext hash from password', async () => {
      const password = 'SuperSecretPassword123!';
      const hash = await hashPassword(password);

      assert.notStrictEqual(hash, password);
      assert.strictEqual(typeof hash, 'string');
      assert.strictEqual(hash.length > 20, true);
    });

    it('verifies correct password against hash', async () => {
      const password = 'MySecureAcademicPassword2026';
      const hash = await hashPassword(password);

      const isValid = await comparePassword(password, hash);
      assert.strictEqual(isValid, true);
    });

    it('rejects incorrect password against hash', async () => {
      const password = 'CorrectPassword';
      const hash = await hashPassword(password);

      const isInvalid = await comparePassword('WrongPassword', hash);
      assert.strictEqual(isInvalid, false);
    });

    it('handles empty or missing password candidates safely', async () => {
      const hash = await hashPassword('TestPassword');
      assert.strictEqual(await comparePassword('', hash), false);
      assert.strictEqual(await comparePassword(null, hash), false);
    });
  });

  describe('Token Hashing (SHA-256)', () => {
    it('produces 64-character hex digest', () => {
      const rawToken = '4f8d2b91c0e3a675f9128d54c82b1a0e';
      const hashed = hashToken(rawToken);

      assert.strictEqual(typeof hashed, 'string');
      assert.strictEqual(hashed.length, 64);
    });

    it('is deterministic: same token produces identical hash', () => {
      const token = 'sample_password_reset_token';
      assert.strictEqual(hashToken(token), hashToken(token));
    });

    it('different tokens produce completely distinct hashes', () => {
      assert.notStrictEqual(hashToken('token_1'), hashToken('token_2'));
    });
  });

  describe('Role Authorization Middleware (RBAC)', () => {
    it('allows access when user role matches allowed roles', () => {
      const middleware = authorizeRoles('admin', 'lecturer');
      let nextCalled = false;
      const req = { user: { role: 'admin' } };
      const res = {};
      const next = () => { nextCalled = true; };

      middleware(req, res, next);
      assert.strictEqual(nextCalled, true);
    });

    it('allows access with case-insensitive role match', () => {
      const middleware = authorizeRoles('Admin');
      let nextCalled = false;
      const req = { user: { role: 'admin' } };
      const res = {};
      const next = () => { nextCalled = true; };

      middleware(req, res, next);
      assert.strictEqual(nextCalled, true);
    });

    it('returns 403 Forbidden when student attempts admin action', () => {
      const middleware = authorizeRoles('admin');
      let nextCalled = false;
      let statusCode = null;
      let responseBody = null;

      const req = { user: { role: 'student' } };
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          responseBody = data;
          return this;
        }
      };
      const next = () => { nextCalled = true; };

      middleware(req, res, next);
      assert.strictEqual(nextCalled, false);
      assert.strictEqual(statusCode, 403);
      assert.strictEqual(responseBody.success, false);
    });

    it('returns 403 Forbidden when user is unauthenticated or has no role', () => {
      const middleware = authorizeRoles('admin');
      let statusCode = null;

      const req = {};
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json() { return this; }
      };

      middleware(req, res, () => {});
      assert.strictEqual(statusCode, 403);
    });
  });

});
