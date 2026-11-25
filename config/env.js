/**
 * Fail-Fast Environment Configuration & Security Validator
 */

function validateEnv() {
  const isTest = process.env.NODE_ENV === 'test';
  const isProd = process.env.NODE_ENV === 'production';

  // Strict production assertions
  if (isProd) {
    const requiredInProd = ['MONGO_URI', 'JWT_SECRET'];
    const missing = requiredInProd.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`[FATAL] Missing mandatory production environment variables: ${missing.join(', ')}`);
    }

    const secret = process.env.JWT_SECRET;
    if (secret.includes('replace-with') || secret.length < 32) {
      throw new Error('[FATAL] JWT_SECRET must be at least 32 characters long and not use template values in production');
    }
  }

  // Warning in development if using default secrets
  if (!isTest && !isProd && !process.env.JWT_SECRET) {
    console.warn('[SECURITY WARNING] JWT_SECRET is not set in environment. Using development fallback. DO NOT USE IN PRODUCTION.');
  }

  return {
    PORT: parseInt(process.env.PORT, 10) || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    MONGO_URI: process.env.MONGO_URI || (isTest ? 'mongodb://127.0.0.1:27017/exam_allocation_test' : 'mongodb://127.0.0.1:27017/exam_allocation'),
    JWT_SECRET: process.env.JWT_SECRET || (isTest ? 'test_jwt_secret_key_32_characters_long_for_tests' : 'dev_jwt_secret_key_32_characters_long_for_dev'),
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '2h',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    CORS_ORIGINS: process.env.CORS_ORIGINS || '',
    EMAIL_USER: process.env.EMAIL_USER || '',
    EMAIL_PASS: process.env.EMAIL_PASS || '',
  };
}

module.exports = validateEnv;
