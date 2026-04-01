const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'parking.db'));

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    vehicle_number TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    user_name TEXT DEFAULT 'Unknown',
    event_type TEXT NOT NULL CHECK(event_type IN ('IN', 'OUT')),
    location INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('ALLOWED', 'DENIED')),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS slots (
    location INTEGER PRIMARY KEY,
    total_capacity INTEGER DEFAULT 10,
    label TEXT DEFAULT ''
  );
`);

// Seed default parking zones if empty
const slotCount = db.prepare('SELECT COUNT(*) as count FROM slots').get();
if (slotCount.count === 0) {
  const insertSlot = db.prepare('INSERT INTO slots (location, total_capacity, label) VALUES (?, ?, ?)');
  const defaults = [
    [1, 10, 'Zone A'],
    [2, 10, 'Zone B'],
    [3, 8,  'Zone C'],
    [4, 8,  'Zone D'],
    [5, 6,  'Zone E'],
  ];
  const seedTransaction = db.transaction(() => {
    for (const s of defaults) insertSlot.run(...s);
  });
  seedTransaction();
  console.log('📦 Seeded default parking zones (1-5)');
}

module.exports = db;
