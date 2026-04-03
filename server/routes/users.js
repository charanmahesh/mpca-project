const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/users — List all registered users
router.get('/', (req, res) => {
  try {
    let query = `
      SELECT
        u.*,
        a.location AS current_location,
        a.spot_label AS current_spot
      FROM users u
      LEFT JOIN active_spots a ON a.uid = u.uid
    `;
    const params = [];

    if (req.query.search) {
      query += ' WHERE u.name LIKE ? OR u.uid LIKE ? OR u.vehicle_number LIKE ?';
      const term = `%${req.query.search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY created_at DESC';
    const users = db.prepare(query).all(...params);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id — Get a single user
router.get('/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// POST /api/users — Register a new RFID user
router.post('/', (req, res) => {
  const { uid, name, vehicle_number, phone } = req.body;
  if (!uid || !name) {
    return res.status(400).json({ error: 'UID and Name are required' });
  }

  try {
    const result = db.prepare(
      'INSERT INTO users (uid, name, vehicle_number, phone) VALUES (?, ?, ?, ?)'
    ).run(uid.toUpperCase().trim(), name.trim(), vehicle_number || '', phone || '');

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(user);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'This UID is already registered' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id — Update user info
router.put('/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { name, vehicle_number, phone, is_active } = req.body;

  try {
    db.prepare(
      'UPDATE users SET name = ?, vehicle_number = ?, phone = ?, is_active = ? WHERE id = ?'
    ).run(
      name !== undefined ? name.trim() : user.name,
      vehicle_number !== undefined ? vehicle_number : user.vehicle_number,
      phone !== undefined ? phone : user.phone,
      is_active !== undefined ? (is_active ? 1 : 0) : user.is_active,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id — Remove user
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true });
});

module.exports = router;
