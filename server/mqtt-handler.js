const mqtt = require('mqtt');
const db = require('./db');

let mqttClient = null;
let io = null;

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

  if (user) {
    name = user.name;
    if (user.is_active) {
      status = 'ALLOWED';
    }
  }

  // Log the event
  db.prepare(
    'INSERT INTO logs (uid, user_name, event_type, location, status) VALUES (?, ?, ?, ?, ?)'
  ).run(uid, name, eventType, location, status);

  // Publish access response back to ESP32: UID,STATUS,NAME
  const response = `${uid},${status},${name}`;
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
    timestamp: new Date().toISOString(),
  };

  if (io) io.emit('parking:event', logEntry);
  console.log(`${status === 'ALLOWED' ? '✅' : '🚫'} ${eventType} | ${uid} | ${name} | Zone ${location}`);
}

/**
 * Simulate an RFID scan (for testing without hardware).
 * Calls the same handleScan pipeline so the full flow is exercised.
 */
function simulateScan(uid, location, eventType) {
  const payload = `${uid},${location}`;
  handleScan(payload, eventType);
}

function getStatus() {
  return mqttClient ? mqttClient.connected : false;
}

module.exports = { init, simulateScan, getStatus };
