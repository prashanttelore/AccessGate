import pg from 'pg';
import env from './env.js';

const { Pool } = pg;

// Initialize PostgreSQL connection pool
export const pool = new Pool({
  connectionString: env.dbUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Pool error handling for idle clients
pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected error on idle client:', err.message);
});

/**
 * Execute a SQL query using the connection pool
 * @param {string} text - SQL query string
 * @param {Array} [params] - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (!env.isTest && process.env.DEBUG) {
    console.log('[PostgreSQL] Executed query', { text, duration, rows: res.rowCount });
  }
  return res;
};

/**
 * Acquire a client from the pool (useful for transactions)
 * @returns {Promise<pg.PoolClient>}
 */
export const getClient = async () => {
  const client = await pool.connect();
  return client;
};

/**
 * Check if the database connection is alive
 * @returns {Promise<boolean>}
 */
export const checkConnection = async () => {
  try {
    const result = await pool.query('SELECT 1 AS alive');
    return result.rows?.[0]?.alive === 1;
  } catch (err) {
    console.error('[PostgreSQL] Health check failed:', err.message);
    return false;
  }
};

/**
 * Close database pool gracefully
 */
export const close = async () => {
  await pool.end();
};

export default {
  pool,
  query,
  getClient,
  checkConnection,
  close,
};
