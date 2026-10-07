import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import env from './env.js';

let isMock = env.isTest;
const mockInstance = new RedisMock();

// Create live Redis client instance with lazy connect and short timeout
const liveClient = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 1,
  retryStrategy: () => null, // don't loop endlessly if redis is not running
  enableReadyCheck: false,
  lazyConnect: true,
  connectTimeout: 1000,
});

liveClient.on('error', (err) => {
  // Switch to in-memory mock if live Redis server is unavailable
  isMock = true;
});

/**
 * Get active Redis client
 */
export const getRedisClient = async () => {
  if (isMock) return mockInstance;
  try {
    if (liveClient.status === 'wait') {
      await liveClient.connect();
    }
    return liveClient;
  } catch (err) {
    isMock = true;
    return mockInstance;
  }
};

/**
 * Connect to Redis or gracefully switch to in-memory mock if server is down
 */
export const connectRedis = async () => {
  if (isMock) return;
  try {
    if (liveClient.status === 'wait') {
      await liveClient.connect();
    }
  } catch (err) {
    isMock = true;
  }
};

/**
 * Check if Redis is responsive
 */
export const checkConnection = async () => {
  try {
    if (isMock) return true;
    if (liveClient.status === 'wait') {
      await liveClient.connect();
    }
    const ping = await liveClient.ping();
    return ping === 'PONG';
  } catch (err) {
    return false;
  }
};

/**
 * Gracefully close Redis connection
 */
export const close = async () => {
  try {
    if (!isMock && liveClient.status !== 'end') {
      await liveClient.quit();
    }
  } catch {}
};

/**
 * Proxy export to ensure all method calls hit the current active Redis client
 * Automatically fails over to in-memory RedisMock on connection failure
 */
export const redisClient = new Proxy({}, {
  get(target, prop) {
    const client = isMock ? mockInstance : liveClient;
    const value = client[prop];
    if (typeof value === 'function') {
      return async (...args) => {
        if (isMock) {
          return mockInstance[prop](...args);
        }
        try {
          return await liveClient[prop](...args);
        } catch (err) {
          isMock = true;
          return mockInstance[prop](...args);
        }
      };
    }
    return value;
  },
});

export default redisClient;
