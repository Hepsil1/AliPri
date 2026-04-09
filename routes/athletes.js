const express = require('express');
const { queryAll, queryOne, runSql } = require('../database');

const router = express.Router();

// GET /api/athletes — all athletes (optional filter by group_id, status)
router.get('/', async (req, res) => {
  try {
    const { group_id, status } = req.query;
    let sql = `
      SELECT a.*, g.name as group_name, g.color as group_color,
        (SELECT json_object(
          'id', s.id,
          'total_sessions', s.total_sessions,
          'used_sessions', s.used_sessions,
          'remaining', s.total_sessions - s.used_sessions,
          'status', s.status,
          'purchased_at', s.purchased_at,
          'frozen_at', s.frozen_at,
          'freeze_reason', s.freeze_reason
        ) FROM subscriptions s WHERE s.athlete_id = a.id AND s.status IN ('active', 'frozen') ORDER BY s.id DESC LIMIT 1) as active_subscription
      FROM athletes a
      LEFT JOIN groups g ON a.group_id = g.id
      WHERE 1=1
    `;
    const params = [];

    if (group_id) {
      sql += ' AND a.group_id = ?';
      params.push(group_id);
    }
    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    } else {
      sql += " AND a.status = 'active'";
    }

    sql += ' ORDER BY a.name';

    const athletes = (await queryAll(sql, params)).map(a => {
      if (a.active_subscription) {
        try {
          if (typeof a.active_subscription === 'string') {
            a.active_subscription = JSON.parse(a.active_subscription);
          }
        } catch (e) {
          a.active_subscription = null;
        }
      }
      return a;
    });

    res.json(athletes);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// GET /api/athletes/:id — full athlete card with history
router.get('/:id', async (req, res) => {
  try {
    const athlete = await queryOne(`
      SELECT a.*, g.name as group_name, g.color as group_color
      FROM athletes a
      LEFT JOIN groups g ON a.group_id = g.id
      WHERE a.id = ?
    `, [req.params.id]);

    if (!athlete) return res.status(404).json({ error: true, message: 'Спортсмен не найден' });

    // Get subscriptions
    athlete.subscriptions = await queryAll(
      'SELECT * FROM subscriptions WHERE athlete_id = ? ORDER BY id DESC',
      [req.params.id]
    );

    // Get recent attendance (last 30)
    athlete.attendance_history = await queryAll(`
      SELECT att.*, t.date, t.time, g.name as group_name
      FROM attendance att
      JOIN trainings t ON att.training_id = t.id
      JOIN groups g ON t.group_id = g.id
      WHERE att.athlete_id = ?
      ORDER BY t.date DESC, t.time DESC
      LIMIT 30
    `, [req.params.id]);

    res.json(athlete);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// POST /api/athletes — create athlete
router.post('/', async (req, res) => {
  try {
    const { name, phone, telegram, group_id, payment_type, notes } = req.body;
    if (!name) return res.status(400).json({ error: true, message: 'Имя обязательно' });
    if (!group_id) return res.status(400).json({ error: true, message: 'Группа обязательна' });

    const result = await runSql(
      'INSERT INTO athletes (name, phone, telegram, group_id, payment_type, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [name, phone || '', telegram || '', group_id, payment_type || 'subscription', notes || '']
    );

    const athlete = await queryOne('SELECT * FROM athletes WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(athlete);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// PUT /api/athletes/:id — update athlete
router.put('/:id', async (req, res) => {
  try {
    const existing = await queryOne('SELECT * FROM athletes WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: true, message: 'Спортсмен не найден' });

    const { name, phone, telegram, group_id, payment_type, status, notes } = req.body;

    await runSql(
      'UPDATE athletes SET name = ?, phone = ?, telegram = ?, group_id = ?, payment_type = ?, status = ?, notes = ? WHERE id = ?',
      [
        name || existing.name,
        phone !== undefined ? phone : existing.phone,
        telegram !== undefined ? telegram : existing.telegram,
        group_id || existing.group_id,
        payment_type || existing.payment_type,
        status || existing.status,
        notes !== undefined ? notes : existing.notes,
        req.params.id
      ]
    );

    const athlete = await queryOne('SELECT * FROM athletes WHERE id = ?', [req.params.id]);
    res.json(athlete);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// DELETE /api/athletes/:id — soft delete (deactivate)
router.delete('/:id', async (req, res) => {
  try {
    const existing = await queryOne('SELECT * FROM athletes WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: true, message: 'Спортсмен не найден' });

    await runSql("UPDATE athletes SET status = 'inactive' WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Спортсмен деактивирован' });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

module.exports = router;
