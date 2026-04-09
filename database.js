/* database.js — Dual mode: SQLite (local) / PostgreSQL (Vercel) */
const path = require('path');
const fs = require('fs');

const isPG = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);
let db = null;   // sql.js instance (local only)
let pool = null;  // pg Pool (Vercel only)

/* ── PG helper: convert SQLite SQL to PostgreSQL ── */
function pgify(sql) {
  let i = 0;
  return sql
    .replace(/\?/g, () => `$${++i}`)
    .replace(/datetime\('now',?\s*'localtime'\)/gi, 'NOW()')
    .replace(/date\('now',?\s*'localtime'\)/gi, 'CURRENT_DATE')
    .replace(/json_object\(/gi, 'json_build_object(')
    .replace(/MAX\((\d+),/gi, 'GREATEST($1,');
}

/* ═══════ PostgreSQL path ═══════ */
async function initPG() {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  // Create tables (PG syntax)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS groups (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#2196F3',
      schedule TEXT DEFAULT '',
      max_athletes INTEGER DEFAULT 20,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS athletes (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      telegram TEXT DEFAULT '',
      group_id INTEGER REFERENCES groups(id),
      payment_type TEXT DEFAULT 'subscription' CHECK(payment_type IN ('subscription','single')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      athlete_id INTEGER NOT NULL REFERENCES athletes(id),
      total_sessions INTEGER NOT NULL DEFAULT 8,
      used_sessions INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','expired','frozen')),
      purchased_at DATE DEFAULT CURRENT_DATE,
      frozen_at DATE,
      freeze_reason TEXT DEFAULT '',
      notes TEXT DEFAULT ''
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS trainings (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES groups(id),
      date DATE NOT NULL,
      time TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      training_id INTEGER NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
      athlete_id INTEGER NOT NULL REFERENCES athletes(id),
      subscription_id INTEGER REFERENCES subscriptions(id),
      status TEXT NOT NULL CHECK(status IN ('present','absent_counted','absent_frozen','single_pay','absent_free')),
      amount_paid INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      marked_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications_log (
      id SERIAL PRIMARY KEY,
      athlete_id INTEGER NOT NULL REFERENCES athletes(id),
      subscription_id INTEGER REFERENCES subscriptions(id),
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      is_sent INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_ath_grp ON athletes(group_id)',
    'CREATE INDEX IF NOT EXISTS idx_att_tr ON attendance(training_id)',
    'CREATE INDEX IF NOT EXISTS idx_att_ath ON attendance(athlete_id)',
    'CREATE INDEX IF NOT EXISTS idx_sub_ath ON subscriptions(athlete_id)',
    'CREATE INDEX IF NOT EXISTS idx_sub_st ON subscriptions(status)',
    'CREATE INDEX IF NOT EXISTS idx_tr_date ON trainings(date)',
    'CREATE INDEX IF NOT EXISTS idx_tr_grp ON trainings(group_id)',
  ];
  for (const idx of indexes) await pool.query(idx);

  // Seed groups if empty
  const { rows } = await pool.query('SELECT COUNT(*) as count FROM groups');
  if (parseInt(rows[0].count) === 0) {
    await pool.query("INSERT INTO groups (name, color) VALUES ('Начинающие','#4CAF50'),('Средний','#2196F3'),('Проф','#FF9800'),('Взрослые','#9C27B0')");
    console.log('🌱 Seeded 4 groups');
  }

  console.log('✅ PostgreSQL ready');
}

/* ═══════ SQLite path ═══════ */
async function initSQLite() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const DB_PATH = path.join(__dirname, 'data', 'club.db');
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
    console.log('📂 Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('🆕 Created new database');
  }

  db.run('PRAGMA foreign_keys=ON');

  db.run(`CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    color TEXT DEFAULT '#2196F3', schedule TEXT DEFAULT '',
    max_athletes INTEGER DEFAULT 20,
    created_at DATETIME DEFAULT (datetime('now','localtime'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS athletes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    phone TEXT DEFAULT '', telegram TEXT DEFAULT '',
    group_id INTEGER, payment_type TEXT DEFAULT 'subscription' CHECK(payment_type IN ('subscription','single')),
    status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
    notes TEXT DEFAULT '', created_at DATETIME DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (group_id) REFERENCES groups(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, athlete_id INTEGER NOT NULL,
    total_sessions INTEGER NOT NULL DEFAULT 8, used_sessions INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK(status IN ('active','expired','frozen')),
    purchased_at DATE DEFAULT (date('now','localtime')), frozen_at DATE,
    freeze_reason TEXT DEFAULT '', notes TEXT DEFAULT '',
    FOREIGN KEY (athlete_id) REFERENCES athletes(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS trainings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL,
    date DATE NOT NULL, time TEXT DEFAULT '', notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (group_id) REFERENCES groups(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT, training_id INTEGER NOT NULL,
    athlete_id INTEGER NOT NULL, subscription_id INTEGER,
    status TEXT NOT NULL CHECK(status IN ('present','absent_counted','absent_frozen','single_pay','absent_free')),
    amount_paid INTEGER DEFAULT 0, notes TEXT DEFAULT '',
    marked_at DATETIME DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
    FOREIGN KEY (athlete_id) REFERENCES athletes(id),
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS notifications_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, athlete_id INTEGER NOT NULL,
    subscription_id INTEGER, type TEXT NOT NULL, message TEXT NOT NULL,
    is_sent INTEGER DEFAULT 0, created_at DATETIME DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (athlete_id) REFERENCES athletes(id),
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_athletes_group ON athletes(group_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_attendance_training ON attendance(training_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_attendance_athlete ON attendance(athlete_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_subscriptions_athlete ON subscriptions(athlete_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_trainings_date ON trainings(date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_trainings_group ON trainings(group_id)');

  const gc = db.exec('SELECT COUNT(*) as count FROM groups');
  const count = gc.length > 0 ? gc[0].values[0][0] : 0;
  if (count === 0) {
    db.run("INSERT INTO groups (name,color) VALUES ('Начинающие','#4CAF50')");
    db.run("INSERT INTO groups (name,color) VALUES ('Средний','#2196F3')");
    db.run("INSERT INTO groups (name,color) VALUES ('Проф','#FF9800')");
    db.run("INSERT INTO groups (name,color) VALUES ('Взрослые','#9C27B0')");
    console.log('🌱 Seeded 4 groups');
  }

  saveToFile();
  console.log('✅ SQLite ready');
}

function saveToFile() {
  if (!db) return;
  const DB_PATH = path.join(__dirname, 'data', 'club.db');
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

/* ═══════ Unified API (always async) ═══════ */
async function initDatabase() {
  if (isPG) return initPG();
  return initSQLite();
}

async function queryAll(sql, params = []) {
  if (isPG) {
    const { rows } = await pool.query(pgify(sql), params);
    return rows;
  }
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows[0] || null;
}

async function runSql(sql, params = []) {
  if (isPG) {
    const pgSql = pgify(sql);
    const isInsert = /^\s*INSERT/i.test(pgSql);
    const finalSql = isInsert ? pgSql + ' RETURNING id' : pgSql;
    const { rows, rowCount } = await pool.query(finalSql, params);
    return { changes: rowCount, lastInsertRowid: isInsert && rows[0] ? rows[0].id : null };
  }
  db.run(sql, params);
  const r = db.exec('SELECT changes() as c, last_insert_rowid() as id')[0];
  const result = { changes: r.values[0][0], lastInsertRowid: r.values[0][1] };
  saveToFile();
  return result;
}

module.exports = { initDatabase, queryAll, queryOne, runSql };
