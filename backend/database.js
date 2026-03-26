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

  // Add is_vip column if it doesn't exist yet (migration for existing DBs)
  try { db.run('ALTER TABLE clients ADD COLUMN is_vip INTEGER DEFAULT 0'); } catch (e) {}
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
