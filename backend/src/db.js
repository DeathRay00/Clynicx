const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'clynicx',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Failed to connect to PostgreSQL:', err.message);
  } else {
    console.log('✅ Connected to PostgreSQL database');
    release();
  }
});

module.exports = pool;
