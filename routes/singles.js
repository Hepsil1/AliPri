const express = require('express');
const { queryAll, queryOne, runSql } = require('../database');

const router = express.Router();

// POST /api/singles/mark — toggle single-visit attendance for today
router.post('/mark', async (req, res) => {
  try {
    const { athlete_id } = req.body;
    if (!athlete_id) return res.status(400).json({ error: true, message: 'athlete_id обязателен' });
    
    const today = new Date().toISOString().slice(0, 10);
    const existing = await queryOne(
      "SELECT id FROM attendance WHERE athlete_id = ? AND CAST(marked_at AS DATE) = CAST(? AS DATE)",
      [athlete_id, today]
    );

    if (existing) {
      await runSql('DELETE FROM attendance WHERE id = ?', [existing.id]);
      res.json({ marked: false });
    } else {
      let training = await queryOne(
        "SELECT id FROM trainings WHERE CAST(date AS DATE) = CAST(? AS DATE) LIMIT 1",
        [today]
      );
      if (!training) {
        const r = await runSql("INSERT INTO trainings (group_id, date) VALUES (1, ?)", [today]);
        // handle both sqlite lastInsertRowid and Postgres RETURNING id via trigger/driver
        training = { id: r.lastInsertRowid || (r.rows && r.rows[0] ? r.rows[0].id : 1) };
      }
      await runSql(
        "INSERT INTO attendance (training_id, athlete_id, status, amount_paid, marked_at) VALUES (?, ?, 'single_pay', 0, CURRENT_TIMESTAMP)",
        [training.id, athlete_id]
      );
      res.json({ marked: true });
    }
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// GET /api/singles/status — today's marks + monthly counts
router.get('/status', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';
    
    const athletes = await queryAll(
      "SELECT a.*, g.name as group_name, g.color as group_color FROM athletes a LEFT JOIN groups g ON a.group_id = g.id WHERE a.status = 'active' AND a.payment_type = 'single' ORDER BY a.name"
    );
    
    const result = [];
    for (const a of athletes) {
      const todayMark = await queryOne(
        "SELECT id FROM attendance WHERE athlete_id = ? AND CAST(marked_at AS DATE) = CAST(? AS DATE)",
        [a.id, today]
      );
      const monthCount = await queryOne(
        "SELECT COUNT(*) as cnt FROM attendance WHERE athlete_id = ? AND CAST(marked_at AS DATE) >= CAST(? AS DATE)",
        [a.id, monthStart]
      );
      result.push({
        ...a,
        marked_today: !!todayMark,
        month_count: monthCount ? parseInt(monthCount.cnt) : 0,
      });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

module.exports = router;
