const express = require('express');
const { queryAll, queryOne } = require('../database');

const router = express.Router();

// GET /api/dashboard — summary statistics
router.get('/', (req, res) => {
  try {
    // Total active athletes
    const totalAthletes = queryOne("SELECT COUNT(*) as count FROM athletes WHERE status = 'active'");

    // Active subscriptions
    const activeSubs = queryOne("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'");

    // Frozen subscriptions
    const frozenSubs = queryOne("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'frozen'");

    // Expiring soon (1-2 sessions remaining)
    const expiringSoon = queryAll(`
      SELECT s.*, a.name as athlete_name, a.group_id, g.name as group_name, g.color as group_color
      FROM subscriptions s
      JOIN athletes a ON s.athlete_id = a.id
      JOIN groups g ON a.group_id = g.id
      WHERE s.status = 'active' AND (s.total_sessions - s.used_sessions) <= 2
      ORDER BY (s.total_sessions - s.used_sessions) ASC
    `);

    // Recently expired (latest expired subscriptions)
    const recentlyExpired = queryAll(`
      SELECT s.*, a.name as athlete_name, a.group_id, g.name as group_name, g.color as group_color
      FROM subscriptions s
      JOIN athletes a ON s.athlete_id = a.id
      JOIN groups g ON a.group_id = g.id
      WHERE s.status = 'expired'
      ORDER BY s.id DESC
      LIMIT 10
    `);

    // No subscription athletes (active athletes with subscription payment_type but no active sub)
    const noSub = queryAll(`
      SELECT a.*, g.name as group_name, g.color as group_color
      FROM athletes a
      JOIN groups g ON a.group_id = g.id
      WHERE a.status = 'active'
        AND a.payment_type = 'subscription'
        AND NOT EXISTS (
          SELECT 1 FROM subscriptions s 
          WHERE s.athlete_id = a.id AND s.status IN ('active', 'frozen')
        )
      ORDER BY a.name
    `);

    // Groups with athlete counts
    const groups = queryAll(`
      SELECT g.*,
        (SELECT COUNT(*) FROM athletes a WHERE a.group_id = g.id AND a.status = 'active') as athlete_count,
        (SELECT COUNT(*) FROM trainings t WHERE t.group_id = g.id AND t.date = date('now', 'localtime')) as today_trainings
      FROM groups g
      ORDER BY g.id
    `);

    // Today's trainings
    const todayTrainings = queryAll(`
      SELECT t.*, g.name as group_name, g.color as group_color,
        (SELECT COUNT(*) FROM attendance a WHERE a.training_id = t.id) as marked_count,
        (SELECT COUNT(*) FROM athletes a WHERE a.group_id = t.group_id AND a.status = 'active') as total_athletes
      FROM trainings t
      JOIN groups g ON t.group_id = g.id
      WHERE t.date = date('now', 'localtime')
      ORDER BY t.time
    `);

    // Recent trainings (last 7 days)
    const recentTrainings = queryAll(`
      SELECT t.*, g.name as group_name, g.color as group_color,
        (SELECT COUNT(*) FROM attendance a WHERE a.training_id = t.id AND a.status = 'present') as present_count,
        (SELECT COUNT(*) FROM attendance a WHERE a.training_id = t.id) as marked_count
      FROM trainings t
      JOIN groups g ON t.group_id = g.id
      WHERE t.date >= date('now', 'localtime', '-7 days')
      ORDER BY t.date DESC, t.time DESC
      LIMIT 20
    `);

    // Financial summary (single payments this month)
    const monthlyFinance = queryOne(`
      SELECT 
        COALESCE(SUM(amount_paid), 0) as total_single_payments,
        COUNT(*) as single_payment_count
      FROM attendance
      WHERE status = 'single_pay' AND amount_paid > 0
        AND marked_at >= date('now', 'localtime', 'start of month')
    `);

    res.json({
      total_athletes: totalAthletes?.count || 0,
      active_subscriptions: activeSubs?.count || 0,
      frozen_subscriptions: frozenSubs?.count || 0,
      expiring_soon: expiringSoon,
      recently_expired: recentlyExpired,
      no_subscription: noSub,
      groups,
      today_trainings: todayTrainings,
      recent_trainings: recentTrainings,
      monthly_finance: monthlyFinance || { total_single_payments: 0, single_payment_count: 0 }
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

module.exports = router;
