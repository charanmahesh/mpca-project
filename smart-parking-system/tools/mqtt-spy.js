#!/usr/bin/env node
/**
 * MQTT Spy - Real-time MQTT message monitoring
 * 
 * Usage:
 *   npm run mqtt:spy
 *   npm run mqtt:spy -- parking/#
 *   npm run mqtt:spy -- "parking/esp32/+/control/#"
 */

const mqtt = require('mqtt');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const TOPICS = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['parking/#'];

console.log('\n' + '='.repeat(60));
console.log('🕵️  MQTT Spy - Message Monitor');
console.log('='.repeat(60));
console.log(`Broker: ${BROKER_URL}`);
console.log(`Topics: ${TOPICS.join(', ')}`);
console.log('Listening... (Ctrl+C to stop)\n');

const client = mqtt.connect(BROKER_URL);
let messageCount = 0;
let startTime = Date.now();

client.on('connect', () => {
  console.log('✅ Connected to MQTT broker\n');
  TOPICS.forEach(topic => client.subscribe(topic, { qos: 1 }));
});

client.on('message', (topic, message) => {
  messageCount++;
  const timestamp = new Date().toISOString();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  let payload;
  try {
    payload = JSON.parse(message.toString());
    payload = JSON.stringify(payload, null, 2);
  } catch (e) {
    payload = message.toString();
  }
  
  console.log(`\n[${timestamp}] (${elapsed}s) Message #${messageCount}`);
  console.log('─'.repeat(60));
  console.log(`Topic: ${topic}`);
  console.log(`Payload:\n${payload}`);
  console.log('─'.repeat(60));
});

client.on('error', (err) => {
  console.error('\n❌ MQTT Error:', err.message);
  if (err.message.includes('ECONNREFUSED')) {
    console.error('   → MQTT broker not running on', BROKER_URL);
    console.error('   → Start EMQX: docker run -d -p 1883:1883 emqx/emqx:latest');
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log(`\n\n📊 Summary:`);
  console.log(`   Messages received: ${messageCount}`);
  console.log(`   Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`   Avg rate: ${(messageCount / ((Date.now() - startTime) / 1000)).toFixed(1)} msg/s`);
  client.end();
  process.exit(0);
});

// Quit on Ctrl+C
process.on('SIGTERM', () => process.exit(0));
