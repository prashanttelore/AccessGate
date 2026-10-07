import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import env from './env.js';

let isMock = env.isTest;
let mockInstance = isMock ? new RedisMock() : null;

// Create live Redis client instance with lazy connect and short timeout
const liveClient = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 1,
  retryStrategy: () => null, // don't loop endlessly if redis is not running
  enableReadyCheck: false,
  lazyConnect: true,
  connectTimeout: 1500,
});

liveClient.on('error', (err) => {
  if (!isMock && err.code !== 'ECONNREFUSED') {
    console.error('[Redis] Unexpected error on client:', err.message);
  }
});

let activeClient = isMock ? mockInstance : liveClient;

/**
 * Get active Redis client (or switch to mock if live is unreachable)
 */
export const getRedisClient = async () => {
  if (isMock) return activeClient;
  try {
    if (activeClient.status === 'wait') {
      await activeClient.connect();
    }
    return activeClient;
  } catch (err) {
    if (!isMock) {
      mockInstance = new RedisMock();
      activeClient = mockInstance;
      isMock = true;
    }
    return activeClient;
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
    mockInstance = new RedisMock();
    activeClient = mockInstance;
    isMock = true;
  }
};

/**
 * Check if Redis is responsive
 */
export const checkConnection = async () => {
  try {
    if (isMock) return true;
    if (activeClient.status === 'wait') {
      await activeClient.connect();
    }
    const ping = await activeClient.ping();
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
    if (!isMock && activeClient.status !== 'end') {
      await activeClient.quit();
    }
  } catch {}
};

/**
 * Proxy export to ensure all method calls hit the current active Redis client
 */
export const redisClient = new Proxy({}, {
  get(target, prop) {
    const client = isMock ? (mockInstance || activeClient) : activeClient;
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export default redisClient;
