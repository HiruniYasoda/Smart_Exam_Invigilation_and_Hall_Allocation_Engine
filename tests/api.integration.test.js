const { describe, it } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const authController = require('../controllers/authController');
const assignmentController = require('../controllers/assignmentController');
const { authenticate, authorizeRoles } = require('../middlewares/auth');
const validateEnv = require('../config/env');
const config = validateEnv();

// Helper to construct mock Express req/res pair
function createMockHttp(reqOverrides = {}) {
  let statusCode = 200;
  let responseData = null;

  const req = {
    body: {},
    params: {},
    query: {},
    headers: {},
    ...reqOverrides
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    send(data) {
      responseData = data;
      return this;
    },
    getStatusCode: () => statusCode,
    getBody: () => responseData
  };

  return { req, res };
}

function createTestToken(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

describe('API Integration & Endpoint Protection Tests', () => {

  describe('Public Registration Security Controls', () => {
    it('rejects public attempts to register as administrator with 403 Forbidden', async () => {
      const { req, res } = createMockHttp({
        body: {
          username: 'malicious_admin',
          password: 'Password123!',
          email: 'hacker@example.com',
          role: 'admin'
        }
      });

      await authController.registerUser(req, res);

      assert.strictEqual(res.getStatusCode(), 403);
      const body = res.getBody();
      assert.strictEqual(body.success, false);
      assert.match(body.message, /Administrative accounts cannot be created/i);
    });

    it('rejects registration with missing mandatory fields with 400 Bad Request', async () => {
      const { req, res } = createMockHttp({
        body: { username: 'incomplete_user' }
      });

      await authController.registerUser(req, res);

      assert.strictEqual(res.getStatusCode(), 400);
      assert.strictEqual(res.getBody().success, false);
    });

    it('rejects registration when password is shorter than 6 characters', async () => {
      const { req, res } = createMockHttp({
        body: {
          username: 'short_pw_user',
          password: '123',
          email: 'short@example.com'
        }
      });

      await authController.registerUser(req, res);

      assert.strictEqual(res.getStatusCode(), 400);
      assert.strictEqual(res.getBody().success, false);
      assert.match(res.getBody().message, /at least 6 characters/i);
    });
  });

  describe('Login Endpoint Validation', () => {
    it('rejects login requests missing credentials with 400 Bad Request', async () => {
      const { req, res } = createMockHttp({ body: {} });

      await authController.loginUser(req, res);

      assert.strictEqual(res.getStatusCode(), 400);
      assert.strictEqual(res.getBody().success, false);
      assert.match(res.getBody().message, /required/i);
    });
  });

  describe('Authentication Middleware (Bearer Token Verification)', () => {
    it('rejects requests missing Authorization header with 401', async () => {
      const { req, res } = createMockHttp();
      let nextCalled = false;

      await authenticate(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.getStatusCode(), 401);
      assert.match(res.getBody().message, /no or malformed token/i);
    });

    it('rejects requests with malformed Authorization header with 401', async () => {
      const { req, res } = createMockHttp({
        headers: { authorization: 'Basic dXNlcjpwYXNz' }
      });
      let nextCalled = false;

      await authenticate(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.getStatusCode(), 401);
    });

    it('rejects requests with forged or tampered token signatures with 401', async () => {
      const forgedToken = createTestToken(
        { id: 'user_123', role: 'admin' },
        'different_unauthorized_secret_key'
      );

      const { req, res } = createMockHttp({
        headers: { authorization: `Bearer ${forgedToken}` }
      });
      let nextCalled = false;

      await authenticate(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.getStatusCode(), 401);
      assert.match(res.getBody().message, /invalid authentication token/i);
    });

    it('authenticates valid Bearer tokens and hydrates req.user', async () => {
      const validToken = createTestToken(
        { id: 'user_456', role: 'lecturer', department: 'Computing' },
        config.JWT_SECRET
      );

      const { req, res } = createMockHttp({
        headers: { authorization: `Bearer ${validToken}` }
      });
      let nextCalled = false;

      await authenticate(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.user.id, 'user_456');
      assert.strictEqual(req.user.role, 'lecturer');
    });
  });

  describe('Role-Based Access Control (RBAC) Protections', () => {
    it('denies students access to administrative endpoints with 403', () => {
      const middleware = authorizeRoles('admin');
      const { req, res } = createMockHttp({
        user: { id: 'student_1', role: 'student' }
      });
      let nextCalled = false;

      middleware(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.getStatusCode(), 403);
      assert.strictEqual(res.getBody().success, false);
    });

    it('permits authorized roles to pass through', () => {
      const middleware = authorizeRoles('admin', 'lecturer');
      const { req, res } = createMockHttp({
        user: { id: 'lecturer_1', role: 'lecturer' }
      });
      let nextCalled = false;

      middleware(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, true);
    });
  });

  describe('Password Reset Anti-Enumeration & Validation', () => {
    it('returns 400 Bad Request if email is missing during forgot-password', async () => {
      const { req, res } = createMockHttp({ body: {} });

      await authController.forgotPassword(req, res);

      assert.strictEqual(res.getStatusCode(), 400);
      assert.strictEqual(res.getBody().success, false);
    });

    it('returns 400 Bad Request when resetting password with missing fields', async () => {
      const { req, res } = createMockHttp({ body: { token: 'sample_token' } });

      await authController.resetPassword(req, res);

      assert.strictEqual(res.getStatusCode(), 400);
      assert.strictEqual(res.getBody().success, false);
      assert.match(res.getBody().message, /required/i);
    });

    it('rejects passwords shorter than 6 characters during password reset', async () => {
      const { req, res } = createMockHttp({
        body: { token: 'sample_token', newPassword: '123' }
      });

      await authController.resetPassword(req, res);

      assert.strictEqual(res.getStatusCode(), 400);
      assert.strictEqual(res.getBody().success, false);
      assert.match(res.getBody().message, /at least 6 characters/i);
    });
  });

  describe('Assignment & Session Workflow Validations', () => {
    it('rejects assignment creation with missing parameters with 400 Bad Request', async () => {
      const { req, res } = createMockHttp({
        body: { assignmentDetails: 'Supervision duty' },
        user: { _id: 'user_123' }
      });

      await assignmentController.createRequest(req, res);

      assert.strictEqual(res.getStatusCode(), 400);
      assert.strictEqual(res.getBody().success, false);
    });

    it('rejects markSessionAsFinished with missing examId or subjectCode with 400', async () => {
      const { req, res } = createMockHttp({
        body: { examId: 'exam_1' },
        user: { id: 'admin_1', role: 'admin' }
      });

      await assignmentController.markSessionAsFinished(req, res);

      assert.strictEqual(res.getStatusCode(), 400);
      assert.strictEqual(res.getBody().success, false);
    });

    it('rejects updateRequestStatus with invalid status value with 400 Bad Request', async () => {
      const { req, res } = createMockHttp({
        body: { status: 'INVALID_STATUS_VALUE' },
        params: { id: 'req_123' },
        user: { id: 'admin_1', role: 'admin' }
      });

      await assignmentController.updateRequestStatus(req, res);

      assert.strictEqual(res.getStatusCode(), 400);
      assert.strictEqual(res.getBody().success, false);
      assert.match(res.getBody().message, /invalid status/i);
    });
  });

});
