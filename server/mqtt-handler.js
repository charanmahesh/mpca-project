const mqtt = require('mqtt');
const db = require('./db');

let mqttClient = null;
let io = null;

function zoneLetter(location) {
  return String.fromCharCode(64 + location); // 1->A, 2->B, ...
}

function getOrAssignSpot(uid, location) {
  const existing = db.prepare('SELECT * FROM active_spots WHERE uid = ?').get(uid);
  if (existing) return existing;

  const zone = db.prepare('SELECT total_capacity FROM slots WHERE location = ?').get(location);
  if (!zone || !zone.total_capacity || zone.total_capacity < 1) return null;

  const occupied = db.prepare('SELECT spot_number FROM active_spots WHERE location = ?').all(location);
  const occupiedSet = new Set(occupied.map((row) => row.spot_number));

  let freeSpot = null;
  for (let i = 1; i <= zone.total_capacity; i++) {
    if (!occupiedSet.has(i)) {
      freeSpot = i;
      break;
    }
  }
  if (!freeSpot) return null;

  const label = `${zoneLetter(location)}${freeSpot}`;
  db.prepare(
    'INSERT INTO active_spots (uid, location, spot_number, spot_label) VALUES (?, ?, ?, ?)'
  ).run(uid, location, freeSpot, label);

  return db.prepare('SELECT * FROM active_spots WHERE uid = ?').get(uid);
}

function releaseSpot(uid) {
  const existing = db.prepare('SELECT * FROM active_spots WHERE uid = ?').get(uid);
  if (!existing) return null;
  db.prepare('DELETE FROM active_spots WHERE uid = ?').run(uid);
  return existing;
}

function init(socketIo) {
  io = socketIo;

  mqttClient = mqtt.connect('mqtt://test.mosquitto.org:1883', {
    clientId: 'parking-server-' + Date.now(),
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  });

  mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT broker');
    mqttClient.subscribe(['rfid/in', 'rfid/out'], (err) => {
      if (err) console.error('MQTT subscribe error:', err);
      else console.log('📡 Subscribed to rfid/in and rfid/out');
    });
    if (io) io.emit('mqtt:status', { connected: true });
  });

  mqttClient.on('error', (err) => {
    console.error('MQTT error:', err.message);
    if (io) io.emit('mqtt:status', { connected: false, error: err.message });
  });

  mqttClient.on('close', () => {
    console.log('❌ MQTT connection closed');
    if (io) io.emit('mqtt:status', { connected: false });
  });

  mqttClient.on('reconnect', () => {
    console.log('🔄 Reconnecting to MQTT...');
  });

  mqttClient.on('message', (topic, message) => {
    const payload = message.toString().trim();
    console.log(`📨 [${topic}] ${payload}`);

    if (topic === 'rfid/in') {
      console.log(`📥 Received scan on [rfid/in]: ${payload}`);
      handleScan(payload, 'IN');
    } else if (topic === 'rfid/out') {
      console.log(`📥 Received scan on [rfid/out]: ${payload}`);
      handleScan(payload, 'OUT');
    }
  });
}

/**
 * Core scan handler — processes both real RFID scans and simulated ones.
 * Looks up the UID, determines access, logs the event, publishes MQTT response,
 * and emits a WebSocket event to all connected dashboard clients.
 */
function handleScan(payload, eventType) {
  const parts = payload.split(',');
  if (parts.length < 2) {
    console.warn('⚠️ Invalid payload format:', payload);
    return;
  }

  const uid = parts[0].trim().toUpperCase();
  const location = parseInt(parts[1].trim(), 10);

  if (isNaN(location) || location < 1 || location > 5) {
    console.warn('⚠️ Invalid location:', parts[1]);
    return;
  }

  // Lookup user in database
  const user = db.prepare('SELECT * FROM users WHERE uid = ?').get(uid);

  let status = 'DENIED';
  let name = 'Unknown';
  let spotLabel = '-';
  let denialReason = '';

  if (user) {
    name = user.name;
    if (user.is_active) {
      if (eventType === 'IN') {
        const assignment = getOrAssignSpot(uid, location);
        if (assignment) {
          status = 'ALLOWED';
          spotLabel = assignment.spot_label;
        } else {
          denialReason = 'zone full (no free spots)';
        }
      } else if (eventType === 'OUT') {
        const released = releaseSpot(uid);
        if (released) {
          status = 'ALLOWED';
          spotLabel = released.spot_label;
        } else {
          denialReason = 'no active spot assigned';
        }
      }
    } else {
      denialReason = 'user is inactive';
    }
  } else {
    denialReason = 'UID not found';
  }

  // Log the event
  db.prepare(
    'INSERT INTO logs (uid, user_name, event_type, location, status) VALUES (?, ?, ?, ?, ?)'
  ).run(uid, name, eventType, location, status);

  // Publish access response back to ESP32: UID,STATUS,NAME,SPOT
  const response = `${uid},${status},${name},${spotLabel}`;
  if (mqttClient && mqttClient.connected) {
    mqttClient.publish('access/response', response);
    console.log(`📤 [access/response] ${response}`);
  }

  // Emit real-time event to web dashboard
  const logEntry = {
    uid,
    user_name: name,
    event_type: eventType,
    location,
    status,
    spot_label: spotLabel,
    timestamp: new Date().toISOString(),
  };

  if (io) io.emit('parking:event', logEntry);
  if (status === 'ALLOWED') {
    console.log(`✅ ${eventType} | ${uid} | ${name} | Zone ${location} | Spot ${spotLabel}`);
  } else {
    console.log(`🚫 ${eventType} | ${uid} | ${name} | Zone ${location} | ${denialReason || 'denied'}`);
  }

  return logEntry;
}

/**
 * Simulate an RFID scan (for testing without hardware).
 * Calls the same handleScan pipeline so the full flow is exercised.
 */
function simulateScan(uid, location, eventType) {
  const payload = `${uid},${location}`;
  return handleScan(payload, eventType);
}

function getStatus() {
  return mqttClient ? mqttClient.connected : false;
}

module.exports = { init, simulateScan, getStatus };
