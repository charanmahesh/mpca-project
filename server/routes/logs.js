const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/logs — Paginated & filterable access logs
router.get('/', (req, res) => {
  try {
    let whereClause = ' WHERE 1=1';
    const params = [];

    if (req.query.uid) {
      whereClause += ' AND uid LIKE ?';
      params.push(`%${req.query.uid}%`);
    }
    if (req.query.event_type) {
      whereClause += ' AND event_type = ?';
      params.push(req.query.event_type);
    }
    if (req.query.status) {
      whereClause += ' AND status = ?';
      params.push(req.query.status);
    }
    if (req.query.date_from) {
      whereClause += ' AND timestamp >= ?';
      params.push(req.query.date_from);
    }
    if (req.query.date_to) {
      whereClause += ' AND timestamp <= ?';
      params.push(req.query.date_to + ' 23:59:59');
    }

    // Total count for pagination
    const total = db.prepare('SELECT COUNT(*) as total FROM logs' + whereClause).get(...params).total;

    // Paginated results
    const limit = parseInt(req.query.limit) || 25;
    const offset = parseInt(req.query.offset) || 0;

    const logs = db.prepare(
      'SELECT * FROM logs' + whereClause + ' ORDER BY timestamp DESC LIMIT ? OFFSET ?'
    ).all(...params, limit, offset);

    res.json({ logs, total, limit, offset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/logs/export — Download all logs as CSV
router.get('/export', (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM logs ORDER BY timestamp DESC').all();

    let csv = 'ID,UID,User Name,Event Type,Location,Status,Timestamp\n';
    for (const log of logs) {
      csv += `${log.id},"${log.uid}","${log.user_name}",${log.event_type},${log.location},${log.status},"${log.timestamp}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=parking_logs.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
