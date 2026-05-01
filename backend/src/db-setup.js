/**
 * Database setup script - runs the schema SQL to create all tables.
 * Usage: node src/db-setup.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'clynicx',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function setup() {
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    console.log('🔧 Running database schema...');
    await pool.query(sql);
    console.log('✅ Database schema applied successfully!');
    console.log('\nTables created:');
    console.log('  - users');
    console.log('  - appointments');
    console.log('  - prescriptions');
    console.log('  - medical_reports');
    console.log('  - doctor_activity');
  } catch (err) {
    console.error('❌ Schema error:', err.message);
  } finally {
    await pool.end();
  }
}

setup();
