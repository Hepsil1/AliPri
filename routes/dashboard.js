const express = require('express');
const { queryAll, queryOne } = require('../database');

const router = express.Router();

// GET /api/dashboard
router.get('/', async (req, res) => {
  try {
    const totalAthletes = await queryOne("SELECT COUNT(*) as count FROM athletes WHERE status = 'active'");
    const activeSubs = await queryOne("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'");
    const frozenSubs = await queryOne("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'frozen'");

    const expiringSoon = await queryAll(`
      SELECT s.*, a.name as athlete_name, a.group_id, g.name as group_name, g.color as group_color
      FROM subscriptions s JOIN athletes a ON s.athlete_id = a.id JOIN groups g ON a.group_id = g.id
      WHERE s.status = 'active' AND (s.total_sessions - s.used_sessions) <= 2
      ORDER BY (s.total_sessions - s.used_sessions) ASC
    `);

    const groups = await queryAll(`
      SELECT g.*,
        (SELECT COUNT(*) FROM athletes a WHERE a.group_id = g.id AND a.status = 'active') as athlete_count
      FROM groups g ORDER BY g.id
    `);

    res.json({
      total_athletes: totalAthletes?.count || 0,
      active_subscriptions: activeSubs?.count || 0,
      frozen_subscriptions: frozenSubs?.count || 0,
      expiring_soon: expiringSoon,
      groups,
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

module.exports = router;
