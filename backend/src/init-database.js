/**
 * Initialize SQLite database
 * Creates tables from schema.sql
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../database/bhaktimap.db');
const schemaPath = path.join(__dirname, '../database/schema.sql');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create database connection
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Read and execute schema
const schema = fs.readFileSync(schemaPath, 'utf8');

// Split by semicolon and execute each statement
const statements = schema
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

console.log('📦 Initializing database...');

try {
  db.exec('BEGIN TRANSACTION');

  for (const statement of statements) {
    db.exec(statement);
  }

  db.exec('COMMIT');

  console.log('✅ Database initialized successfully!');
  console.log(`📍 Location: ${dbPath}`);

  // Show tables
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  console.log('\n📋 Tables created:');
  tables.forEach(t => console.log(`   - ${t.name}`));

} catch (error) {
  db.exec('ROLLBACK');
  console.error('❌ Database initialization failed:', error.message);
  process.exit(1);
}

db.close();
