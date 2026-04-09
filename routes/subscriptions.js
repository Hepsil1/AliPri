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

// POST /api/subscriptions/:id/plus — used +1 (athlete came, remaining goes down)
router.post('/:id/plus', (req, res) => {
  try {
    const sub = queryOne('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: true, message: 'Абонемент не найден' });
    runSql('UPDATE subscriptions SET used_sessions = used_sessions + 1 WHERE id = ?', [req.params.id]);
    const updated = queryOne('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    const remaining = updated.total_sessions - updated.used_sessions;
    let alert = null;
    if (remaining <= 0) alert = { type: 'expired', remaining: 0 };
    else if (remaining <= 2) alert = { type: 'low', remaining };
    res.json({ subscription: updated, alert });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// POST /api/subscriptions/:id/minus — used -1 (undo, remaining goes up)
router.post('/:id/minus', (req, res) => {
  try {
    const sub = queryOne('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: true, message: 'Абонемент не найден' });
    runSql('UPDATE subscriptions SET used_sessions = MAX(0, used_sessions - 1) WHERE id = ?', [req.params.id]);
    const updated = queryOne('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    res.json({ subscription: updated, alert: null });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// POST /api/singles/mark — toggle single-visit attendance for today
router.post('/singles/mark', (req, res) => {
  try {
    const { athlete_id } = req.body;
    if (!athlete_id) return res.status(400).json({ error: true, message: 'athlete_id обязателен' });
    const today = new Date().toISOString().slice(0, 10);
    // Check if already marked today
    const existing = queryOne(
      "SELECT id FROM attendance WHERE athlete_id = ? AND date(marked_at) = ?",
      [athlete_id, today]
    );
    if (existing) {
      // Unmark
      runSql('DELETE FROM attendance WHERE id = ?', [existing.id]);
      res.json({ marked: false });
    } else {
      // Ensure training exists for today
      let training = queryOne(
        "SELECT id FROM trainings WHERE date = ? LIMIT 1",
        [today]
      );
      if (!training) {
        const r = runSql("INSERT INTO trainings (group_id, date) VALUES (1, ?)", [today]);
        training = { id: r.lastInsertRowid };
      }
      runSql(
        "INSERT INTO attendance (training_id, athlete_id, status, amount_paid, marked_at) VALUES (?, ?, 'single_pay', 0, datetime('now','localtime'))",
        [training.id, athlete_id]
      );
      res.json({ marked: true });
    }
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// GET /api/singles/status — get today's marks + monthly counts for all single-pay athletes
router.get('/singles/status', (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';
    const athletes = queryAll(
      "SELECT a.*, g.name as group_name, g.color as group_color FROM athletes a LEFT JOIN groups g ON a.group_id = g.id WHERE a.status = 'active' AND a.payment_type = 'single' ORDER BY a.name"
    );
    const result = athletes.map(a => {
      const todayMark = queryOne(
        "SELECT id FROM attendance WHERE athlete_id = ? AND date(marked_at) = ?",
        [a.id, today]
      );
      const monthCount = queryOne(
        "SELECT COUNT(*) as cnt FROM attendance WHERE athlete_id = ? AND date(marked_at) >= ?",
        [a.id, monthStart]
      );
      return {
        ...a,
        marked_today: !!todayMark,
        month_count: monthCount ? monthCount.cnt : 0,
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

module.exports = router;
