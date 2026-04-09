const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/groups', require('./routes/groups'));
app.use('/api/athletes', require('./routes/athletes'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/singles', require('./routes/subscriptions'));
app.use('/api/trainings', require('./routes/trainings'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/dashboard', require('./routes/dashboard'));

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: true, message: 'Внутренняя ошибка сервера' });
});

// Start server
async function start() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`\n🏅 СчётДетей запущен!`);
      console.log(`📍 http://localhost:${PORT}\n`);
    });
  } catch (err) {
    console.error('❌ Failed to start:', err);
    process.exit(1);
  }
}

start();
