import pg from 'pg';
import crypto from 'node:crypto';
import env from './env.js';

const { Pool } = pg;

export let pool = new Pool({
  connectionString: env.dbUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  if (err.code !== 'ECONNREFUSED') {
    console.error('[PostgreSQL] Unexpected error on idle client:', err.message);
  }
});

let memPool = null;
let useFallback = false;

/**
 * Initialize embedded in-memory PostgreSQL instance for local development/testing without Docker
 */
export const getMemPool = async () => {
  if (memPool) return memPool;
  const { newDb } = await import('pg-mem');
  const memDb = newDb();

  memDb.public.registerFunction({
    name: 'gen_random_uuid',
    implementation: () => crypto.randomUUID(),
    impure: true,
  });

  memDb.public.none(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) DEFAULT '',
      role VARCHAR(50) NOT NULL DEFAULT 'user',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      device_info TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      revoked_at TIMESTAMP WITH TIME ZONE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      email VARCHAR(255) NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      successful BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const { Pool: MemPool } = memDb.adapters.createPg();
  memPool = new MemPool();
  return memPool;
};

/**
 * Execute a SQL query using either the live pool or in-memory fallback
 */
export const query = async (text, params) => {
  if (useFallback) {
    const mp = await getMemPool();
    return mp.query(text, params);
  }

  try {
    return await pool.query(text, params);
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
      useFallback = true;
      const mp = await getMemPool();
      return mp.query(text, params);
    }
    throw err;
  }
};

/**
 * Acquire a client from the pool (transaction support)
 */
export const getClient = async () => {
  if (useFallback) {
    const mp = await getMemPool();
    return mp.connect();
  }

  try {
    return await pool.connect();
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
      useFallback = true;
      const mp = await getMemPool();
      return mp.connect();
    }
    throw err;
  }
};

/**
 * Check if the database connection is alive
 */
export const checkConnection = async () => {
  try {
    if (useFallback) {
      const mp = await getMemPool();
      const res = await mp.query('SELECT 1 AS alive');
      return res.rows?.[0]?.alive === 1;
    }
    const res = await pool.query('SELECT 1 AS alive');
    return res.rows?.[0]?.alive === 1;
  } catch (err) {
    if (!useFallback && (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED'))) {
      useFallback = true;
      const mp = await getMemPool();
      const res = await mp.query('SELECT 1 AS alive');
      return res.rows?.[0]?.alive === 1;
    }
    return false;
  }
};

/**
 * Close database pool gracefully
 */
export const close = async () => {
  if (memPool) {
    await memPool.end();
  }
  try {
    await pool.end();
  } catch {}
};

export default {
  pool,
  query,
  getClient,
  checkConnection,
  close,
  getMemPool,
};
