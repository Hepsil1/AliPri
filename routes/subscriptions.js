const express = require('express');
const { queryAll, queryOne, runSql } = require('../database');

const router = express.Router();

// GET /api/subscriptions/:athlete_id — subscriptions for athlete
router.get('/:athlete_id', async (req, res) => {
  try {
    const subs = await queryAll(
      'SELECT * FROM subscriptions WHERE athlete_id = ? ORDER BY id DESC',
      [req.params.athlete_id]
    );
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// POST /api/subscriptions — create subscription
router.post('/', async (req, res) => {
  try {
    const { athlete_id, total_sessions } = req.body;
    if (!athlete_id) return res.status(400).json({ error: true, message: 'athlete_id обязателен' });

    const activeSub = await queryOne(
      "SELECT * FROM subscriptions WHERE athlete_id = ? AND status IN ('active', 'frozen')",
      [athlete_id]
    );
    if (activeSub) {
      return res.status(400).json({
        error: true,
        message: 'У спортсмена уже есть активный абонемент. Сначала завершите текущий.'
      });
    }

    const result = await runSql(
      'INSERT INTO subscriptions (athlete_id, total_sessions) VALUES (?, ?)',
      [athlete_id, total_sessions || 8]
    );

    const sub = await queryOne('SELECT * FROM subscriptions WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(sub);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// PUT /api/subscriptions/:id/freeze
router.put('/:id/freeze', async (req, res) => {
  try {
    const sub = await queryOne('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: true, message: 'Абонемент не найден' });
    if (sub.status !== 'active') {
      return res.status(400).json({ error: true, message: 'Можно заморозить только активный абонемент' });
    }

    const { reason } = req.body;
    await runSql(
      "UPDATE subscriptions SET status = 'frozen', frozen_at = date('now', 'localtime'), freeze_reason = ? WHERE id = ?",
      [reason || 'Не указана', req.params.id]
    );

    const updated = await queryOne('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// PUT /api/subscriptions/:id/unfreeze
router.put('/:id/unfreeze', async (req, res) => {
  try {
    const sub = await queryOne('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: true, message: 'Абонемент не найден' });
    if (sub.status !== 'frozen') {
      return res.status(400).json({ error: true, message: 'Абонемент не заморожен' });
    }

    await runSql(
      "UPDATE subscriptions SET status = 'active', frozen_at = NULL, freeze_reason = '' WHERE id = ?",
      [req.params.id]
    );

    const updated = await queryOne('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// PUT /api/subscriptions/:id/expire
router.put('/:id/expire', async (req, res) => {
  try {
    await runSql("UPDATE subscriptions SET status = 'expired' WHERE id = ?", [req.params.id]);
    const updated = await queryOne('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// POST /api/subscriptions/:id/plus — +1 used (remaining goes down)
router.post('/:id/plus', async (req, res) => {
  try {
    const sub = await queryOne('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: true, message: 'Абонемент не найден' });
    await runSql('UPDATE subscriptions SET used_sessions = used_sessions + 1 WHERE id = ?', [req.params.id]);
    const updated = await queryOne('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    const remaining = updated.total_sessions - updated.used_sessions;
    let alert = null;
    if (remaining <= 0) alert = { type: 'expired', remaining: 0 };
    else if (remaining <= 2) alert = { type: 'low', remaining };
    res.json({ subscription: updated, alert });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// POST /api/subscriptions/:id/minus — -1 used (remaining goes up)
router.post('/:id/minus', async (req, res) => {
  try {
    const sub = await queryOne('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: true, message: 'Абонемент не найден' });
    await runSql('UPDATE subscriptions SET used_sessions = MAX(0, used_sessions - 1) WHERE id = ?', [req.params.id]);
    const updated = await queryOne('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    res.json({ subscription: updated, alert: null });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// POST /api/singles/mark — toggle single-visit attendance for today
router.post('/singles/mark', async (req, res) => {
  try {
    const { athlete_id } = req.body;
    if (!athlete_id) return res.status(400).json({ error: true, message: 'athlete_id обязателен' });
    const today = new Date().toISOString().slice(0, 10);
    const existing = await queryOne(
      "SELECT id FROM attendance WHERE athlete_id = ? AND date(marked_at) = ?",
      [athlete_id, today]
    );
    if (existing) {
      await runSql('DELETE FROM attendance WHERE id = ?', [existing.id]);
      res.json({ marked: false });
    } else {
      let training = await queryOne(
        "SELECT id FROM trainings WHERE date = ? LIMIT 1",
        [today]
      );
      if (!training) {
        const r = await runSql("INSERT INTO trainings (group_id, date) VALUES (1, ?)", [today]);
        training = { id: r.lastInsertRowid };
      }
      await runSql(
        "INSERT INTO attendance (training_id, athlete_id, status, amount_paid, marked_at) VALUES (?, ?, 'single_pay', 0, datetime('now','localtime'))",
        [training.id, athlete_id]
      );
      res.json({ marked: true });
    }
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// GET /api/singles/status — today's marks + monthly counts
router.get('/singles/status', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';
    const athletes = await queryAll(
      "SELECT a.*, g.name as group_name, g.color as group_color FROM athletes a LEFT JOIN groups g ON a.group_id = g.id WHERE a.status = 'active' AND a.payment_type = 'single' ORDER BY a.name"
    );
    const result = [];
    for (const a of athletes) {
      const todayMark = await queryOne(
        "SELECT id FROM attendance WHERE athlete_id = ? AND date(marked_at) = ?",
        [a.id, today]
      );
      const monthCount = await queryOne(
        "SELECT COUNT(*) as cnt FROM attendance WHERE athlete_id = ? AND date(marked_at) >= ?",
        [a.id, monthStart]
      );
      result.push({
        ...a,
        marked_today: !!todayMark,
        month_count: monthCount ? monthCount.cnt : 0,
      });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

module.exports = router;
