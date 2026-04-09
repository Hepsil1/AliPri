const express = require('express');
const { queryAll, queryOne, runSql } = require('../database');

const router = express.Router();

// GET /api/subscriptions/:athlete_id — subscriptions for athlete
router.get('/:athlete_id', (req, res) => {
  try {
    const subs = queryAll(
      'SELECT * FROM subscriptions WHERE athlete_id = ? ORDER BY id DESC',
      [req.params.athlete_id]
    );
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// POST /api/subscriptions — create subscription
router.post('/', (req, res) => {
  try {
    const { athlete_id, total_sessions } = req.body;
    if (!athlete_id) return res.status(400).json({ error: true, message: 'athlete_id обязателен' });

    // Check for existing active subscription
    const activeSub = queryOne(
      "SELECT * FROM subscriptions WHERE athlete_id = ? AND status IN ('active', 'frozen')",
      [athlete_id]
    );
    if (activeSub) {
      return res.status(400).json({
        error: true,
        message: 'У спортсмена уже есть активный абонемент. Сначала завершите текущий.'
      });
    }

    const result = runSql(
      'INSERT INTO subscriptions (athlete_id, total_sessions) VALUES (?, ?)',
      [athlete_id, total_sessions || 8]
    );

    const sub = queryOne('SELECT * FROM subscriptions WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(sub);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// PUT /api/subscriptions/:id/freeze — freeze subscription
router.put('/:id/freeze', (req, res) => {
  try {
    const sub = queryOne('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: true, message: 'Абонемент не найден' });
    if (sub.status !== 'active') {
      return res.status(400).json({ error: true, message: 'Можно заморозить только активный абонемент' });
    }

    const { reason } = req.body;
    runSql(
      "UPDATE subscriptions SET status = 'frozen', frozen_at = date('now', 'localtime'), freeze_reason = ? WHERE id = ?",
      [reason || 'Не указана', req.params.id]
    );

    const updated = queryOne('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// PUT /api/subscriptions/:id/unfreeze — unfreeze subscription
router.put('/:id/unfreeze', (req, res) => {
  try {
    const sub = queryOne('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: true, message: 'Абонемент не найден' });
    if (sub.status !== 'frozen') {
      return res.status(400).json({ error: true, message: 'Абонемент не заморожен' });
    }

    runSql(
      "UPDATE subscriptions SET status = 'active', frozen_at = NULL, freeze_reason = '' WHERE id = ?",
      [req.params.id]
    );

    const updated = queryOne('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// PUT /api/subscriptions/:id/expire — manually expire subscription
router.put('/:id/expire', (req, res) => {
  try {
    runSql("UPDATE subscriptions SET status = 'expired' WHERE id = ?", [req.params.id]);
    const updated = queryOne('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

module.exports = router;
