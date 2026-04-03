const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/slots — All zones with live occupancy
router.get('/', (req, res) => {
  try {
    const slots = db.prepare('SELECT * FROM slots ORDER BY location').all();

    const slotsWithOccupancy = slots.map(slot => {
      // Occupancy comes from currently assigned live spots.
      const result = db.prepare(
        'SELECT COUNT(*) as occupied FROM active_spots WHERE location = ?'
      ).get(slot.location);
      const occupied = result.occupied || 0;

      return {
        ...slot,
        occupied,
        available: Math.max(0, slot.total_capacity - occupied),
      };
    });

    res.json(slotsWithOccupancy);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/slots/:location — Update zone capacity or label
router.put('/:location', (req, res) => {
  try {
    const slot = db.prepare('SELECT * FROM slots WHERE location = ?').get(req.params.location);
    if (!slot) return res.status(404).json({ error: 'Zone not found' });

    const { total_capacity, label } = req.body;

    db.prepare('UPDATE slots SET total_capacity = ?, label = ? WHERE location = ?').run(
      total_capacity !== undefined ? parseInt(total_capacity) : slot.total_capacity,
      label !== undefined ? label : slot.label,
      req.params.location
    );

    const updated = db.prepare('SELECT * FROM slots WHERE location = ?').get(req.params.location);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
