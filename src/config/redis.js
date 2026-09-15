import Redis from 'ioredis';
import env from './env.js';

/**
 * Initialize Redis Client instance
 */
export const redisClient = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 10) {
      console.warn('[Redis] Max reconnect attempts reached');
      return null; // Stop retrying
    }
    const delay = Math.min(times * 100, 2000);
    return delay;
  },
  enableReadyCheck: true,
  lazyConnect: true, // Connect explicitly or on first command
});

redisClient.on('connect', () => {
  console.log('[Redis] Connected to Redis server');
});

redisClient.on('ready', () => {
  console.log('[Redis] Connection ready to accept commands');
});

redisClient.on('error', (err) => {
  console.error('[Redis] Client error:', err.message);
});

redisClient.on('close', () => {
  console.warn('[Redis] Connection closed');
});

/**
 * Explicitly connect to Redis
 */
export const connectRedis = async () => {
  try {
    if (redisClient.status === 'wait') {
      await redisClient.connect();
    }
  } catch (err) {
    console.error('[Redis] Failed to connect initially:', err.message);
  }
};

/**
 * Check if Redis is responsive
 * @returns {Promise<boolean>}
 */
export const checkConnection = async () => {
  try {
    if (redisClient.status === 'wait') {
      await redisClient.connect();
    }
    const ping = await redisClient.ping();
    return ping === 'PONG';
  } catch (err) {
    console.error('[Redis] Health check failed:', err.message);
    return false;
  }
};

/**
 * Gracefully close Redis connection
 */
export const close = async () => {
  try {
    if (redisClient.status !== 'end') {
      await redisClient.quit();
    }
  } catch (err) {
    console.error('[Redis] Error during shutdown:', err.message);
  }
};

export default redisClient;
