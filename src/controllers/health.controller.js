import db from '../config/db.js';
import redisClient, { checkConnection as checkRedis } from '../config/redis.js';

/**
 * Health check endpoint controller
 * Returns { status: "ok" } with HTTP 200
 */
export const getHealth = (req, res) => {
  res.status(200).json({ status: 'ok' });
};

/**
 * Detailed readiness check for dependencies (PostgreSQL & Redis)
 */
export const getReadiness = async (req, res) => {
  const [dbOk, redisOk] = await Promise.all([
    db.checkConnection(),
    checkRedis(),
  ]);

  const isHealthy = dbOk && redisOk;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? 'up' : 'down',
      redis: redisOk ? 'up' : 'down',
    },
  });
};

export default {
  getHealth,
  getReadiness,
};
