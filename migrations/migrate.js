import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import env from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigrations = async () => {
  console.log('[Migrations] Connecting to PostgreSQL at:', env.dbUrl.replace(/:[^:@]+@/, ':****@'));
  const client = new pg.Client({ connectionString: env.dbUrl });

  try {
    await client.connect();
    console.log('[Migrations] Connected successfully');

    // Create migrations tracker table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get list of already applied migrations
    const { rows: appliedRows } = await client.query('SELECT name FROM _migrations');
    const appliedNames = new Set(appliedRows.map((r) => r.name));

    // Read all .sql files in migrations directory sorted alphabetically
    const files = fs
      .readdirSync(__dirname)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedNames.has(file)) {
        console.log(`[Migrations] Skipping already applied migration: ${file}`);
        continue;
      }

      console.log(`[Migrations] Running migration: ${file}`);
      const filePath = path.join(__dirname, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[Migrations] Successfully applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Migrations] Failed applying migration ${file}:`, err);
        throw err;
      }
    }

    console.log('[Migrations] All migrations completed successfully');
  } catch (err) {
    console.error('[Migrations] Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
};

runMigrations();
