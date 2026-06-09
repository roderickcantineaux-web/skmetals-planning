require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'skmetals.db');
let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDatabase() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      license_plate TEXT NOT NULL,
      material_type TEXT NOT NULL,
      booking_date TEXT NOT NULL,
      slot_index INTEGER NOT NULL,
      slot_time TEXT NOT NULL,
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'confirmed',
      is_walkin INTEGER DEFAULT 0,
      is_priority INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS slot_limits (
      material_type TEXT PRIMARY KEY,
      max_per_slot INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const insertLimit = database.prepare(
    'INSERT OR IGNORE INTO slot_limits (material_type, max_per_slot) VALUES (?, ?)'
  );
  insertLimit.run('e-motoren', 2);
  insertLimit.run('kabels', 3);
  insertLimit.run('compressoren', 2);
  insertLimit.run('rest', 3);

  database.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('max_per_slot_total', '6');

  console.log('Database geïnitialiseerd.');
}

module.exports = { getDb, initDatabase };
