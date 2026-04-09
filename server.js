const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize DB
let dbReady = false;
let dbError = null;
const dbInit = initDatabase().then(() => {
  dbReady = true;
}).catch(err => {
  console.error('❌ DB init failed:', err);
  dbError = err;
});

// DB check middleware (must be BEFORE API routes)
app.use('/api', async (req, res, next) => {
  if (!dbReady && !dbError) await dbInit;
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

// API Routes
app.use('/api/groups', require('./routes/groups'));
app.use('/api/athletes', require('./routes/athletes'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/singles', require('./routes/subscriptions'));
app.use('/api/trainings', require('./routes/trainings'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Static files (local fallback)
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: true, message: 'Внутренняя ошибка сервера' });
});

// For Vercel: export the app natively
if (process.env.VERCEL) {
  module.exports = app;
} else {
  // Local development — start HTTP server
  dbInit.then(() => {
    app.listen(PORT, () => {
      console.log(`\n🏅 СчётДетей запущен!`);
      console.log(`📍 http://localhost:${PORT}\n`);
    });
  });
}
