const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'clinic.db');

let db;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      treatments TEXT,
      therapist TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS blocked_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      unit TEXT,
      low_stock_threshold INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reason TEXT,
      reference_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add is_vip column if it doesn't exist yet (migration for existing DBs)
  try { db.run('ALTER TABLE clients ADD COLUMN is_vip INTEGER DEFAULT 0'); } catch (e) {}
  // Patient chart fields
  try { db.run('ALTER TABLE clients ADD COLUMN birthdate TEXT'); } catch (e) {}
  try { db.run('ALTER TABLE clients ADD COLUMN sex TEXT'); } catch (e) {}
  try { db.run('ALTER TABLE clients ADD COLUMN address TEXT'); } catch (e) {}
  try { db.run('ALTER TABLE clients ADD COLUMN occupation TEXT'); } catch (e) {}
  try { db.run('ALTER TABLE clients ADD COLUMN civil_status TEXT'); } catch (e) {}
  try { db.run('ALTER TABLE clients ADD COLUMN medical_history TEXT'); } catch (e) {}
  // Inventory unit conversion
  try { db.run('ALTER TABLE inventory_items ADD COLUMN conversion_unit TEXT'); } catch (e) {}
  try { db.run('ALTER TABLE inventory_items ADD COLUMN conversion_factor REAL'); } catch (e) {}
  try { db.run('ALTER TABLE inventory_items ADD COLUMN preferred_unit TEXT'); } catch (e) {}
  // Add therapist column if it doesn't exist yet (migration for existing DBs)
  try { db.run('ALTER TABLE appointments ADD COLUMN therapist TEXT'); } catch (e) {}
  // Add email tracking columns (migration for existing DBs)
  try { db.run('ALTER TABLE appointments ADD COLUMN reminder_24h_sent INTEGER DEFAULT 0'); } catch (e) {}
  try { db.run('ALTER TABLE appointments ADD COLUMN reminder_same_day_sent INTEGER DEFAULT 0'); } catch (e) {}
  try { db.run('ALTER TABLE appointments ADD COLUMN followup_sent INTEGER DEFAULT 0'); } catch (e) {}
  // Add email timestamp columns (migration for existing DBs)
  try { db.run('ALTER TABLE appointments ADD COLUMN confirmation_sent_at TEXT'); } catch (e) {}
  try { db.run('ALTER TABLE appointments ADD COLUMN reminder_24h_sent_at TEXT'); } catch (e) {}
  try { db.run('ALTER TABLE appointments ADD COLUMN reminder_same_day_sent_at TEXT'); } catch (e) {}
  try { db.run('ALTER TABLE appointments ADD COLUMN followup_sent_at TEXT'); } catch (e) {}
  try { db.run('ALTER TABLE appointments ADD COLUMN rescheduled_at TEXT'); } catch (e) {}
  try { db.run('ALTER TABLE appointments ADD COLUMN confirmation_token TEXT'); } catch (e) {}
  try { db.run('ALTER TABLE appointments ADD COLUMN client_confirmed_at TEXT'); } catch (e) {}
  try { db.run("ALTER TABLE appointments ADD COLUMN status TEXT DEFAULT 'confirmed'"); } catch (e) {}
  try { db.run('ALTER TABLE appointments ADD COLUMN cancelled_at TEXT'); } catch (e) {}

  save();
  return db;
}

function save() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

module.exports = { getDb, save };
