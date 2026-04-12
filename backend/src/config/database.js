const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const sslConfig = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

const basicConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  database: process.env.DB_NAME,
};

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: sslConfig,
        max: process.env.DB_POOL_MAX ? Number(process.env.DB_POOL_MAX) : 20,
        idleTimeoutMillis: process.env.DB_IDLE_TIMEOUT_MS
          ? Number(process.env.DB_IDLE_TIMEOUT_MS)
          : 10000,
        connectionTimeoutMillis: process.env.DB_CONN_TIMEOUT_MS
          ? Number(process.env.DB_CONN_TIMEOUT_MS)
          : 5000,
      }
    : {
        ...basicConfig,
        ssl: sslConfig,
        max: process.env.DB_POOL_MAX ? Number(process.env.DB_POOL_MAX) : 20,
        idleTimeoutMillis: process.env.DB_IDLE_TIMEOUT_MS
          ? Number(process.env.DB_IDLE_TIMEOUT_MS)
          : 10000,
        connectionTimeoutMillis: process.env.DB_CONN_TIMEOUT_MS
          ? Number(process.env.DB_CONN_TIMEOUT_MS)
          : 5000,
      }
);

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
  // Don't crash on transient errors — pool will reconnect automatically
});

const connectDatabase = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('Database connected');
  } catch (error) {
    console.error('Database connection failed', error.message);
    throw error;
  }
};

const query = (text, params) => pool.query(text, params);

const withTransaction = async (executor) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await executor(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Expose pool.connect() for manual transaction handling (used by chatModel.sendGroupMessage)
const connect = () => pool.connect();

module.exports = {
  query,
  connect,
  connectDatabase,
  withTransaction,
};
