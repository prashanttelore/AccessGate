import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

/**
 * Standard error formatter for rate limiting violations
 */
const rateLimitHandler = (req, res, next, options) => {
  const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
  res.setHeader('Retry-After', retryAfterSeconds);
  res.status(429).json({
    error: 'TooManyRequests',
    message: options.message || 'Too many requests, please try again later.',
    retryAfter: retryAfterSeconds,
  });
};

/**
 * Check if rate limiter should be skipped (e.g. during test suites, unless testing rate limits)
 */
const shouldSkip = (req) => {
  if (env.isTest && req.headers['x-test-ratelimit'] !== 'true') {
    return true;
  }
  return false;
};

/**
 * General API baseline rate limiter
 * Limits general API traffic across endpoints
 */
export const generalLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests to AccessGate API, please try again later.',
  handler: rateLimitHandler,
  skip: shouldSkip,
});

/**
 * Sensitive Auth rate limiter
 * Applies to /auth/* routes (login, register, token refresh)
 */
export const authLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication attempts, please try again later.',
  handler: rateLimitHandler,
  skip: shouldSkip,
});

/**
 * Sensitive Admin rate limiter
 * Applies to /admin/* management routes
 */
export const adminLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.adminRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many admin management requests, please try again later.',
  handler: rateLimitHandler,
  skip: shouldSkip,
});

export default {
  generalLimiter,
  authLimiter,
  adminLimiter,
};
