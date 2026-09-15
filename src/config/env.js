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
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};

export default env;
