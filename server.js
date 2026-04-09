const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 1. Сначала отдаем статику мгновенно, без ожидания базы
app.use(express.static(path.join(__dirname, 'public')));

// 2. БД инициализируется ТОЛЬКО ПРИ ПЕРВОМ API ЗАПРОСЕ (Lazy Load).
// Это спасает Vercel от таймаута при инициализации контейнера.
let dbReady = false;
let dbError = null;
let dbInitPromise = null;

app.use('/api', async (req, res, next) => {
  if (!dbInitPromise) {
    dbInitPromise = initDatabase().then(() => {
      dbReady = true;
    }).catch(err => {
      console.error('❌ DB init failed:', err);
      dbError = err;
    });
  }

  if (!dbReady && !dbError) {
    await dbInitPromise;
  }

  if (dbError) {
    return res.status(500).json({ 
      error: true, 
      message: 'Database connection failed', 
      details: dbError.message || String(dbError),
      hasPostgresEnv: !!process.env.POSTGRES_URL,
      hasDatabaseEnv: !!process.env.DATABASE_URL
    });
  }
  next();
});

// 3. API Маршруты
app.use('/api/groups', require('./routes/groups'));
app.use('/api/athletes', require('./routes/athletes'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/singles', require('./routes/subscriptions'));
app.use('/api/trainings', require('./routes/trainings'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/dashboard', require('./routes/dashboard'));

// 4. SPA fallback (отдаем index.html для любых других путей)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 5. Обработчик ошибок
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: true, message: 'Внутренняя ошибка сервера - ' + String(err) });
});

// Экспорт для Vercel
if (process.env.VERCEL) {
  module.exports = app;
} else {
  // Локальная разработка
  dbInitPromise = initDatabase().then(() => {
    dbReady = true;
    app.listen(PORT, () => {
      console.log(`\n🏅 СчётДетей запущен!`);
      console.log(`📍 http://localhost:${PORT}\n`);
    });
  }).catch(err => {
    console.error('DB init failed', err);
    process.exit(1);
  });
}
