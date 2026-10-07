import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  dbUrl: process.env.DB_URL || 'postgres://postgres:postgres@localhost:5432/accessgate',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'default_jwt_access_secret_change_me',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'default_jwt_refresh_secret_change_me',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  authRateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10),
  adminRateLimitMax: parseInt(process.env.ADMIN_RATE_LIMIT_MAX || '30', 10),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};

export default env;
