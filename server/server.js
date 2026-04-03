const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./db');
const mqttHandler = require('./mqtt-handler');

const usersRouter = require('./routes/users');
const logsRouter = require('./routes/logs');
const slotsRouter = require('./routes/slots');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ─── Middleware ───
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── API Routes ───
app.use('/api/users', usersRouter);
app.use('/api/logs', logsRouter);
app.use('/api/slots', slotsRouter);

// GET /api/dashboard — Aggregated stats for dashboard
app.get('/api/dashboard', (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

    const todayEntries = db.prepare(
      "SELECT COUNT(*) as count FROM logs WHERE date(timestamp) = date('now', 'localtime')"
    ).get().count;

    // Currently parked across all zones = number of active spot assignments.
    const parked = db.prepare('SELECT COUNT(*) as count FROM active_spots').get();
    const currentlyParked = parked.count || 0;

    const totalCapacity = db.prepare('SELECT SUM(total_capacity) as total FROM slots').get().total || 42;

    // Recent activity (last 15 events)
    const recentLogs = db.prepare('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 15').all();

    res.json({
      totalUsers,
      currentlyParked,
      totalCapacity,
      todayEntries,
      availableSlots: Math.max(0, totalCapacity - currentlyParked),
      recentLogs,
      mqttConnected: mqttHandler.getStatus(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/simulate — Simulate an RFID scan (dev/test tool)
app.post('/api/simulate', (req, res) => {
  const { uid, location, event_type } = req.body;
  if (!uid || !location || !event_type) {
    return res.status(400).json({ error: 'uid, location, and event_type are required' });
  }
  const result = mqttHandler.simulateScan(uid.toUpperCase().trim(), parseInt(location), event_type.toUpperCase());
  const spotSuffix = result && result.spot_label && result.spot_label !== '-' ? ` (Spot ${result.spot_label})` : '';
  res.json({
    success: true,
    message: `Simulated ${event_type.toUpperCase()} scan for ${uid.toUpperCase()} at Zone ${location}${spotSuffix}`,
    spot_label: result ? result.spot_label : '-',
    status: result ? result.status : 'DENIED',
  });
});

// ─── Socket.IO ───
io.on('connection', (socket) => {
  console.log('🌐 Dashboard client connected');
  socket.emit('mqtt:status', { connected: mqttHandler.getStatus() });

  socket.on('disconnect', () => {
    console.log('🌐 Dashboard client disconnected');
  });
});

// ─── Initialize MQTT ───
mqttHandler.init(io);

// ─── Start Server ───
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   🚗  Smart Parking System — Server         ║
╠══════════════════════════════════════════════╣
║   Dashboard:  http://localhost:${PORT}           ║
║   API:        http://localhost:${PORT}/api       ║
║   MQTT:       test.mosquitto.org:1883       ║
╚══════════════════════════════════════════════╝
  `);
});
