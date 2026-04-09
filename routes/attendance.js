const express = require('express');
const { queryAll, queryOne, runSql } = require('../database');

const router = express.Router();

// GET /api/attendance/:training_id — attendance for a training
router.get('/:training_id', (req, res) => {
  try {
    const training = queryOne(`
      SELECT t.*, g.name as group_name
      FROM trainings t JOIN groups g ON t.group_id = g.id
      WHERE t.id = ?
    `, [req.params.training_id]);

    if (!training) return res.status(404).json({ error: true, message: 'Тренировка не найдена' });

    // Get all athletes in this group
    const athletes = queryAll(`
      SELECT a.*,
        (SELECT json_object(
          'id', s.id,
          'total_sessions', s.total_sessions,
          'used_sessions', s.used_sessions,
          'remaining', s.total_sessions - s.used_sessions,
          'status', s.status
        ) FROM subscriptions s WHERE s.athlete_id = a.id AND s.status IN ('active', 'frozen') ORDER BY s.id DESC LIMIT 1) as active_subscription
      FROM athletes a
      WHERE a.group_id = ? AND a.status = 'active'
      ORDER BY a.name
    `, [training.group_id]);

    // Get existing attendance marks for this training
    const marks = queryAll(
      'SELECT * FROM attendance WHERE training_id = ?',
      [req.params.training_id]
    );
    const marksMap = {};
    marks.forEach(m => { marksMap[m.athlete_id] = m; });

    // Combine: each athlete with their attendance status
    const result = athletes.map(a => {
      let sub = null;
      if (a.active_subscription) {
        try { sub = JSON.parse(a.active_subscription); } catch(e) {}
      }
      delete a.active_subscription;

      const mark = marksMap[a.id] || null;
      return {
        athlete_id: a.id,
        athlete_name: a.name,
        payment_type: a.payment_type,
        phone: a.phone,
        telegram: a.telegram,
        subscription: sub,
        attendance: mark ? {
          id: mark.id,
          status: mark.status,
          amount_paid: mark.amount_paid,
          notes: mark.notes,
          marked_at: mark.marked_at
        } : null
      };
    });

    res.json({
      training,
      athletes: result
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// POST /api/attendance — mark attendance
router.post('/', (req, res) => {
  try {
    const { training_id, athlete_id, status, amount_paid, notes } = req.body;

    if (!training_id || !athlete_id || !status) {
      return res.status(400).json({ error: true, message: 'training_id, athlete_id и status обязательны' });
    }

    // Check if already marked
    const existing = queryOne(
      'SELECT * FROM attendance WHERE training_id = ? AND athlete_id = ?',
      [training_id, athlete_id]
    );
    if (existing) {
      return res.status(400).json({
        error: true,
        message: 'Посещение уже отмечено. Используйте PUT для изменения.'
      });
    }

    let subscription_id = null;
    let alert = null;

    // Business logic for subscription deduction
    if (status === 'present' || status === 'absent_counted') {
      // Find active subscription
      const sub = queryOne(
        "SELECT * FROM subscriptions WHERE athlete_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
        [athlete_id]
      );

      if (sub) {
        subscription_id = sub.id;
        const newUsed = sub.used_sessions + 1;
        
        if (newUsed >= sub.total_sessions) {
          // Subscription expired!
          runSql(
            "UPDATE subscriptions SET used_sessions = ?, status = 'expired' WHERE id = ?",
            [newUsed, sub.id]
          );
          alert = {
            type: 'subscription_expired',
            message: `Абонемент закончился! (${newUsed}/${sub.total_sessions})`,
            remaining: 0,
            athlete_id
          };
        } else {
          runSql(
            'UPDATE subscriptions SET used_sessions = ? WHERE id = ?',
            [newUsed, sub.id]
          );
          const remaining = sub.total_sessions - newUsed;
          if (remaining <= 2) {
            alert = {
              type: 'subscription_expiring',
              message: `Осталось ${remaining} ${remaining === 1 ? 'занятие' : 'занятия'}!`,
              remaining,
              athlete_id
            };
          }
        }
      } else if (status === 'present') {
        // No subscription — might need to be single_pay
        alert = {
          type: 'no_subscription',
          message: 'У спортсмена нет активного абонемента',
          athlete_id
        };
      }
    }
    // For absent_frozen and single_pay — no subscription deduction

    const result = runSql(
      'INSERT INTO attendance (training_id, athlete_id, subscription_id, status, amount_paid, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [training_id, athlete_id, subscription_id, status, amount_paid || 0, notes || '']
    );

    const record = queryOne('SELECT * FROM attendance WHERE id = ?', [result.lastInsertRowid]);

    // Get updated subscription info
    let updatedSub = null;
    if (subscription_id) {
      updatedSub = queryOne('SELECT * FROM subscriptions WHERE id = ?', [subscription_id]);
    }

    res.status(201).json({
      attendance: record,
      subscription: updatedSub,
      alert
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// PUT /api/attendance/:id — update attendance status
router.put('/:id', (req, res) => {
  try {
    const existing = queryOne('SELECT * FROM attendance WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: true, message: 'Запись не найдена' });

    const { status, amount_paid, notes } = req.body;
    const oldStatus = existing.status;
    const newStatus = status || oldStatus;

    // Rollback old subscription effect
    if ((oldStatus === 'present' || oldStatus === 'absent_counted') && existing.subscription_id) {
      runSql(
        'UPDATE subscriptions SET used_sessions = MAX(0, used_sessions - 1) WHERE id = ?',
        [existing.subscription_id]
      );
      // Reactivate if was expired
      const sub = queryOne('SELECT * FROM subscriptions WHERE id = ?', [existing.subscription_id]);
      if (sub && sub.status === 'expired' && sub.used_sessions < sub.total_sessions) {
        runSql("UPDATE subscriptions SET status = 'active' WHERE id = ?", [sub.id]);
      }
    }

    // Apply new subscription effect
    let subscription_id = null;
    let alert = null;

    if (newStatus === 'present' || newStatus === 'absent_counted') {
      const sub = queryOne(
        "SELECT * FROM subscriptions WHERE athlete_id = ? AND status IN ('active', 'frozen') ORDER BY id DESC LIMIT 1",
        [existing.athlete_id]
      );
      if (sub && sub.status === 'active') {
        subscription_id = sub.id;
        const newUsed = sub.used_sessions + 1;
        if (newUsed >= sub.total_sessions) {
          runSql("UPDATE subscriptions SET used_sessions = ?, status = 'expired' WHERE id = ?", [newUsed, sub.id]);
          alert = { type: 'subscription_expired', message: `Абонемент закончился! (${newUsed}/${sub.total_sessions})`, remaining: 0 };
        } else {
          runSql('UPDATE subscriptions SET used_sessions = ? WHERE id = ?', [newUsed, sub.id]);
          const remaining = sub.total_sessions - newUsed;
          if (remaining <= 2) {
            alert = { type: 'subscription_expiring', message: `Осталось ${remaining} занятий`, remaining };
          }
        }
      }
    }

    runSql(
      'UPDATE attendance SET status = ?, subscription_id = ?, amount_paid = ?, notes = ? WHERE id = ?',
      [newStatus, subscription_id, amount_paid !== undefined ? amount_paid : existing.amount_paid, notes !== undefined ? notes : existing.notes, req.params.id]
    );

    const updated = queryOne('SELECT * FROM attendance WHERE id = ?', [req.params.id]);
    res.json({ attendance: updated, alert });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// DELETE /api/attendance/:id — remove attendance mark
router.delete('/:id', (req, res) => {
  try {
    const existing = queryOne('SELECT * FROM attendance WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: true, message: 'Запись не найдена' });

    // Rollback subscription
    if ((existing.status === 'present' || existing.status === 'absent_counted') && existing.subscription_id) {
      runSql(
        'UPDATE subscriptions SET used_sessions = MAX(0, used_sessions - 1) WHERE id = ?',
        [existing.subscription_id]
      );
      const sub = queryOne('SELECT * FROM subscriptions WHERE id = ?', [existing.subscription_id]);
      if (sub && sub.status === 'expired' && sub.used_sessions < sub.total_sessions) {
        runSql("UPDATE subscriptions SET status = 'active' WHERE id = ?", [sub.id]);
      }
    }

    runSql('DELETE FROM attendance WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// POST /api/attendance/quick — one-click attendance (auto-creates training)
router.post('/quick', (req, res) => {
  try {
    const { athlete_id, status, amount_paid, notes } = req.body;
    if (!athlete_id || !status) {
      return res.status(400).json({ error: true, message: 'athlete_id и status обязательны' });
    }

    // Get athlete's group
    const athlete = queryOne('SELECT * FROM athletes WHERE id = ?', [athlete_id]);
    if (!athlete) return res.status(404).json({ error: true, message: 'Спортсмен не найден' });

    // Find or create today's training for this group
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    
    let training = queryOne(
      'SELECT * FROM trainings WHERE group_id = ? AND date = ?',
      [athlete.group_id, today]
    );

    if (!training) {
      const result = runSql(
        'INSERT INTO trainings (group_id, date, time) VALUES (?, ?, ?)',
        [athlete.group_id, today, now]
      );
      training = queryOne('SELECT * FROM trainings WHERE id = ?', [result.lastInsertRowid]);
    }

    // Check if already marked today
    const existing = queryOne(
      'SELECT * FROM attendance WHERE training_id = ? AND athlete_id = ?',
      [training.id, athlete_id]
    );
    if (existing) {
      return res.status(400).json({ error: true, message: 'Сегодня уже отмечено' });
    }

    // Business logic - same as POST /
    let subscription_id = null;
    let alert = null;

    if (status === 'present' || status === 'absent_counted') {
      const sub = queryOne(
        "SELECT * FROM subscriptions WHERE athlete_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
        [athlete_id]
      );

      if (sub) {
        subscription_id = sub.id;
        const newUsed = sub.used_sessions + 1;

        if (newUsed >= sub.total_sessions) {
          runSql("UPDATE subscriptions SET used_sessions = ?, status = 'expired' WHERE id = ?", [newUsed, sub.id]);
          alert = { type: 'subscription_expired', message: `Абонемент закончился! (${newUsed}/${sub.total_sessions})`, remaining: 0, athlete_id };
        } else {
          runSql('UPDATE subscriptions SET used_sessions = ? WHERE id = ?', [newUsed, sub.id]);
          const remaining = sub.total_sessions - newUsed;
          if (remaining <= 2) {
            alert = { type: 'subscription_expiring', message: `Осталось ${remaining} ${remaining === 1 ? 'занятие' : 'занятия'}!`, remaining, athlete_id };
          }
        }
      } else {
        alert = { type: 'no_subscription', message: 'Нет активного абонемента', athlete_id };
      }
    }

    const result = runSql(
      'INSERT INTO attendance (training_id, athlete_id, subscription_id, status, amount_paid, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [training.id, athlete_id, subscription_id, status, amount_paid || 0, notes || '']
    );

    const record = queryOne('SELECT * FROM attendance WHERE id = ?', [result.lastInsertRowid]);

    let updatedSub = null;
    if (subscription_id) {
      updatedSub = queryOne('SELECT * FROM subscriptions WHERE id = ?', [subscription_id]);
    } else {
      updatedSub = queryOne(
        "SELECT * FROM subscriptions WHERE athlete_id = ? AND status IN ('active','frozen') ORDER BY id DESC LIMIT 1",
        [athlete_id]
      );
    }

    res.status(201).json({ attendance: record, subscription: updatedSub, alert });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// POST /api/attendance/undo-last — undo last attendance for an athlete
router.post('/undo-last', (req, res) => {
  try {
    const { athlete_id } = req.body;
    const last = queryOne(`
      SELECT att.* FROM attendance att
      JOIN trainings t ON att.training_id = t.id
      WHERE att.athlete_id = ?
      ORDER BY t.date DESC, att.marked_at DESC
      LIMIT 1
    `, [athlete_id]);

    if (!last) return res.status(404).json({ error: true, message: 'Нет записей для отмены' });

    // Rollback subscription
    if ((last.status === 'present' || last.status === 'absent_counted') && last.subscription_id) {
      runSql('UPDATE subscriptions SET used_sessions = MAX(0, used_sessions - 1) WHERE id = ?', [last.subscription_id]);
      const sub = queryOne('SELECT * FROM subscriptions WHERE id = ?', [last.subscription_id]);
      if (sub && sub.status === 'expired' && sub.used_sessions < sub.total_sessions) {
        runSql("UPDATE subscriptions SET status = 'active' WHERE id = ?", [sub.id]);
      }
    }

    runSql('DELETE FROM attendance WHERE id = ?', [last.id]);
    res.json({ success: true, message: 'Последняя отметка отменена' });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

module.exports = router;
