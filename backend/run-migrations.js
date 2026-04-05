/**
 * Run all SQL migrations in order against the database.
 * Usage: node run-migrations.js
 * Reads DATABASE_URL from environment (or .env file).
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const sslConfig = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: sslConfig }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME,
        ssl: sslConfig,
      }
);

const migrationsDir = path.join(__dirname, 'migrations');

(async () => {
  try {
    // Create migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Get already executed migrations
    const { rows: executed } = await pool.query('SELECT name FROM _migrations ORDER BY name');
    const executedSet = new Set(executed.map((r) => r.name));

    // Get all SQL files sorted
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (executedSet.has(file)) {
        console.log(`SKIP  ${file} (already executed)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      console.log(`RUN   ${file}...`);
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      ran++;
      console.log(`DONE  ${file}`);
    }

    console.log(`\nMigrations complete. ${ran} new, ${files.length - ran} skipped.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
})();
