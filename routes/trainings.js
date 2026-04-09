const express = require('express');
const { queryAll, queryOne, runSql } = require('../database');

const router = express.Router();

// GET /api/trainings
router.get('/', async (req, res) => {
  try {
    const { group_id, date, limit } = req.query;
    let sql = `
      SELECT t.*, g.name as group_name, g.color as group_color,
        (SELECT COUNT(*) FROM attendance a WHERE a.training_id = t.id) as marked_count
      FROM trainings t
      JOIN groups g ON t.group_id = g.id
      WHERE 1=1
    `;
    const params = [];
    if (group_id) { sql += ' AND t.group_id = ?'; params.push(group_id); }
    if (date) { sql += ' AND t.date = ?'; params.push(date); }
    sql += ' ORDER BY t.date DESC, t.time DESC';
    if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }

    const trainings = await queryAll(sql, params);
    res.json(trainings);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// GET /api/trainings/:id
router.get('/:id', async (req, res) => {
  try {
    const training = await queryOne(`
      SELECT t.*, g.name as group_name, g.color as group_color
      FROM trainings t JOIN groups g ON t.group_id = g.id WHERE t.id = ?
    `, [req.params.id]);
    if (!training) return res.status(404).json({ error: true, message: 'Тренировка не найдена' });

    training.attendance = await queryAll(`
      SELECT att.*, a.name as athlete_name, a.payment_type,
        s.total_sessions, s.used_sessions, s.status as sub_status
      FROM attendance att
      JOIN athletes a ON att.athlete_id = a.id
      LEFT JOIN subscriptions s ON att.subscription_id = s.id
      WHERE att.training_id = ? ORDER BY a.name
    `, [req.params.id]);

    res.json(training);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// POST /api/trainings
router.post('/', async (req, res) => {
  try {
    const { group_id, date, time, notes } = req.body;
    if (!group_id) return res.status(400).json({ error: true, message: 'Группа обязательна' });
    if (!date) return res.status(400).json({ error: true, message: 'Дата обязательна' });

    const existing = await queryOne(
      'SELECT * FROM trainings WHERE group_id = ? AND date = ? AND time = ?',
      [group_id, date, time || '']
    );
    if (existing) return res.status(400).json({ error: true, message: 'Тренировка уже существует' });

    const result = await runSql(
      'INSERT INTO trainings (group_id, date, time, notes) VALUES (?, ?, ?, ?)',
      [group_id, date, time || '', notes || '']
    );

    const training = await queryOne(`
      SELECT t.*, g.name as group_name, g.color as group_color
      FROM trainings t JOIN groups g ON t.group_id = g.id WHERE t.id = ?
    `, [result.lastInsertRowid]);
    res.status(201).json(training);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// DELETE /api/trainings/:id
router.delete('/:id', async (req, res) => {
  try {
    const attendanceRecords = await queryAll(
      "SELECT * FROM attendance WHERE training_id = ? AND subscription_id IS NOT NULL AND status IN ('present', 'absent_counted')",
      [req.params.id]
    );

    for (const record of attendanceRecords) {
      await runSql('UPDATE subscriptions SET used_sessions = MAX(0, used_sessions - 1) WHERE id = ?', [record.subscription_id]);
      const sub = await queryOne('SELECT * FROM subscriptions WHERE id = ?', [record.subscription_id]);
      if (sub && sub.status === 'expired' && sub.used_sessions < sub.total_sessions) {
        await runSql("UPDATE subscriptions SET status = 'active' WHERE id = ?", [sub.id]);
      }
    }

    await runSql('DELETE FROM attendance WHERE training_id = ?', [req.params.id]);
    await runSql('DELETE FROM trainings WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

module.exports = router;
