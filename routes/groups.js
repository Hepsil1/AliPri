const express = require('express');
const { queryAll, queryOne, runSql } = require('../database');

const router = express.Router();

// GET /api/groups — all groups with athlete count
router.get('/', (req, res) => {
  try {
    const groups = queryAll(`
      SELECT g.*, 
        (SELECT COUNT(*) FROM athletes a WHERE a.group_id = g.id AND a.status = 'active') as athlete_count
      FROM groups g
      ORDER BY g.id
    `);
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// GET /api/groups/:id — single group
router.get('/:id', (req, res) => {
  try {
    const group = queryOne('SELECT * FROM groups WHERE id = ?', [req.params.id]);
    if (!group) return res.status(404).json({ error: true, message: 'Группа не найдена' });
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// POST /api/groups — create group
router.post('/', (req, res) => {
  try {
    const { name, color, schedule, max_athletes } = req.body;
    if (!name) return res.status(400).json({ error: true, message: 'Название группы обязательно' });

    const result = runSql(
      'INSERT INTO groups (name, color, schedule, max_athletes) VALUES (?, ?, ?, ?)',
      [name, color || '#2196F3', schedule || '', max_athletes || 20]
    );
    const group = queryOne('SELECT * FROM groups WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// PUT /api/groups/:id — update group
router.put('/:id', (req, res) => {
  try {
    const { name, color, schedule, max_athletes } = req.body;
    const existing = queryOne('SELECT * FROM groups WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: true, message: 'Группа не найдена' });

    runSql(
      'UPDATE groups SET name = ?, color = ?, schedule = ?, max_athletes = ? WHERE id = ?',
      [
        name || existing.name,
        color || existing.color,
        schedule !== undefined ? schedule : existing.schedule,
        max_athletes || existing.max_athletes,
        req.params.id
      ]
    );
    const group = queryOne('SELECT * FROM groups WHERE id = ?', [req.params.id]);
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// DELETE /api/groups/:id — delete group
router.delete('/:id', (req, res) => {
  try {
    const athleteCount = queryOne(
      'SELECT COUNT(*) as count FROM athletes WHERE group_id = ? AND status = ?',
      [req.params.id, 'active']
    );
    if (athleteCount && athleteCount.count > 0) {
      return res.status(400).json({
        error: true,
        message: `Нельзя удалить группу: в ней ${athleteCount.count} активных спортсменов`
      });
    }
    runSql('DELETE FROM groups WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

module.exports = router;
