import cors from 'cors';
import env from './env.js';

/**
 * Configure production CORS options
 * Whitelists allowed origins via CORS_ORIGIN environment variable (comma-separated or wildcard '*')
 */
export const configureCors = () => {
  const allowedOrigins = env.corsOrigin === '*'
    ? ['*']
    : env.corsOrigin.split(',').map((origin) => origin.trim().toLowerCase()).filter(Boolean);

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      // If wildcard is enabled, allow all origins
      if (allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.trim().toLowerCase();
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin '${origin}' not allowed by AccessGate CORS policy`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'X-Test-RateLimit',
    ],
    exposedHeaders: [
      'Retry-After',
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
    ],
    maxAge: 86400, // 24 hours cache for preflight OPTIONS requests
  });
};

export default configureCors;
