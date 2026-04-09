const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'club.db');

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();

  // Ensure data directory exists
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('📂 Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('🆕 Created new database');
  }

  // Note: sql.js (WASM) does NOT support WAL mode
  db.run('PRAGMA foreign_keys=ON;');

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#2196F3',
      schedule TEXT DEFAULT '',
      max_athletes INTEGER DEFAULT 20,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS athletes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      telegram TEXT DEFAULT '',
      group_id INTEGER,
      payment_type TEXT DEFAULT 'subscription' CHECK(payment_type IN ('subscription', 'single')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (group_id) REFERENCES groups(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      athlete_id INTEGER NOT NULL,
      total_sessions INTEGER NOT NULL DEFAULT 8,
      used_sessions INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'expired', 'frozen')),
      purchased_at DATE DEFAULT (date('now', 'localtime')),
      frozen_at DATE,
      freeze_reason TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      FOREIGN KEY (athlete_id) REFERENCES athletes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS trainings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      date DATE NOT NULL,
      time TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (group_id) REFERENCES groups(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      training_id INTEGER NOT NULL,
      athlete_id INTEGER NOT NULL,
      subscription_id INTEGER,
      status TEXT NOT NULL CHECK(status IN ('present', 'absent_counted', 'absent_frozen', 'single_pay', 'absent_free')),
      amount_paid INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      marked_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
      FOREIGN KEY (athlete_id) REFERENCES athletes(id),
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      athlete_id INTEGER NOT NULL,
      subscription_id INTEGER,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      is_sent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (athlete_id) REFERENCES athletes(id),
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
    )
  `);

  // Create indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_athletes_group ON athletes(group_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_attendance_training ON attendance(training_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_attendance_athlete ON attendance(athlete_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_subscriptions_athlete ON subscriptions(athlete_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_trainings_date ON trainings(date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_trainings_group ON trainings(group_id)');

  // Seed default groups if empty
  const groupCount = db.exec('SELECT COUNT(*) as count FROM groups');
  const count = groupCount.length > 0 ? groupCount[0].values[0][0] : 0;
  if (count === 0) {
    db.run("INSERT INTO groups (name, color, schedule) VALUES ('Начинающие', '#4CAF50', '')");
    db.run("INSERT INTO groups (name, color, schedule) VALUES ('Средний', '#2196F3', '')");
    db.run("INSERT INTO groups (name, color, schedule) VALUES ('Проф', '#FF9800', '')");
    db.run("INSERT INTO groups (name, color, schedule) VALUES ('Взрослые', '#9C27B0', '')");
    console.log('🌱 Seeded 4 default groups');
  }

  // Persist to disk
  saveDatabase();
  console.log('✅ Database initialized');

  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// Helper: run query and return results as array of objects
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper: run query and return single row as object
function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

// Helper: run INSERT/UPDATE/DELETE and return changes info
function runSql(sql, params = []) {
  db.run(sql, params);
  const changes = db.exec('SELECT changes() as changes, last_insert_rowid() as lastId')[0];
  const result = {
    changes: changes.values[0][0],
    lastInsertRowid: changes.values[0][1]
  };
  saveDatabase();
  return result;
}

module.exports = { initDatabase, getDb, saveDatabase, queryAll, queryOne, runSql };
