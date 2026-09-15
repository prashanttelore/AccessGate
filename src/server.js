import app from './app.js';
import env from './config/env.js';
import db from './config/db.js';
import redisClient, { connectRedis, close as closeRedis } from './config/redis.js';

let server;

/**
 * Initialize connections and start HTTP server
 */
const startServer = async () => {
  try {
    // Attempt Redis connection (lazy-connect handles retries)
    await connectRedis();

    server = app.listen(env.port, () => {
      console.log(`[AccessGate] Server running in ${env.nodeEnv} mode on port ${env.port}`);
      console.log(`[AccessGate] Health check available at http://localhost:${env.port}/health`);
    });
  } catch (err) {
    console.error('[AccessGate] Failed to start server:', err);
    process.exit(1);
  }
};

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (signal) => {
  console.log(`\n[AccessGate] Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log('[AccessGate] HTTP server closed');
      try {
        await db.close();
        console.log('[AccessGate] PostgreSQL connection pool drained');
      } catch (err) {
        console.error('[AccessGate] Error closing DB pool:', err.message);
      }

      try {
        await closeRedis();
        console.log('[AccessGate] Redis connection closed');
      } catch (err) {
        console.error('[AccessGate] Error closing Redis client:', err.message);
      }

      console.log('[AccessGate] Graceful shutdown complete');
      process.exit(0);
    });

    // Force close after 10 seconds if shutdown hangs
    setTimeout(() => {
      console.error('[AccessGate] Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
