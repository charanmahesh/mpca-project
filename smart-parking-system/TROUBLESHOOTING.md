# Smart Parking System - Troubleshooting & FAQ

## 🔧 Troubleshooting Guide

### 🚨 Firmware Issues

#### Issue: ESP32 Not Uploading
**Symptoms:** "No serial port detected" or "Failed to connect"

```bash
# Step 1: Verify device detection
npm run firmware:info
platformio device list

# Step 2: Check USB connection
# - Try different USB cable (power cable won't work)
# - Try different USB port
# - Check device manager for COM port

# Step 3: Install USB driver (Windows)
# Driver: CH340 USB-to-Serial (common for ESP32 dev boards)
# Download: https://sparks.gogo.co.nz/ch340.html

# Step 4: Verify platformio.ini board setting
cat firmware/platformio.ini | grep "board"
# Should show: board = esp32dev

# Step 5: Try manual COM port
platformio device monitor --port /dev/ttyUSB0
```

**Solution:** Replace USB cable, install CH340 driver, verify COM port.

---

#### Issue: RFID Not Reading
**Symptoms:** No RFID scan detected, MQTT quiet

```bash
# Step 1: Check firmware serial output
npm run firmware:monitor
# Look for: "RFID scanning..." messages

# Step 2: Verify SPI pins configured correctly
# Check: firmware.instructions.md for GPIO pinout
GPIO5  ← RFID#1 CS
GPIO4  ← RFID#2 CS
GPIO14 ← SPI CLK
GPIO13 ← SPI MOSI
GPIO12 ← SPI MISO

# Step 3: Test RFID reader in isolation
cd firmware && platformio device monitor
# Bring RFID card close (within 3cm)
# Look for: "[RFID1] Card detected: ..."

# Step 4: Check antenna LED (green LED on RFID reader)
# Should blink when powered, scan when card near

# Step 5: Try different RFID cards (multiple card types)
```

**Solution:** Check wiring, verify antenna tuning, try different cards.

---

#### Issue: Out of Memory
**Symptoms:** Reboot loops, crashes after few scans

```cpp
// Add memory monitoring to firmware
void logMemory() {
  Serial.printf("Free heap: %d bytes\n", ESP.getFreeHeap());
  Serial.printf("heap usage: %.1f%%\n", 
    (float)(320000 - ESP.getFreeHeap()) / 320000 * 100);
}

// Call regularly in main loop
// If < 50KB free → memory leak exists
```

**Solution:** Check for malloc without free, reduce buffer sizes, enable memory logging.

---

### 🖥️ Backend Issues

#### Issue: Backend Won't Start
**Symptoms:** `npm run backend:start` exits immediately, no error

```bash
# Step 1: Check specific error
npm run backend:dev              # Shows full error log

# Step 2: Check port 3000 in use
lsof -i :3000                  # macOS/Linux
netstat -ano | findstr :3000   # Windows

# Step 3: Check MQTT broker
npm run mqtt:spy                # If connection error, broker down

# Step 4: Database might be corrupted
npm run db:reset               # Recreates database

# Step 5: Check permissions
ls -la backend/data/           # Should be readable/writable
chmod 755 backend/data
```

**Solution:** Kill process on port 3000, start MQTT broker, reset database.

---

#### Issue: API Returning 500 Error
**Symptoms:** `curl http://localhost:3000/api/parking/health` → 500

```bash
# Step 1: Check backend logs
npm run logs:backend

# Step 2: Test with curl for more details
curl -v http://localhost:3000/api/parking/health

# Step 3: Check database connection
npm run db:inspect
# Type: .tables
# If error → run: npm run db:reset

# Step 4: Check MQTT connection
npm run mqtt:spy
# Should show broker connected

# Step 5: Verify environment variables
cat backend/.env | grep MQTT
cat backend/.env | grep DATABASE
```

**Solution:** Check database file, verify MQTT broker, inspect error logs.

---

#### Issue: Insufficient Balance Error When Balance is High
**Symptoms:** Entry denied with "INSUFFICIENT_BALANCE" despite balance > ₹500

```bash
# Step 1: Check actual balance in database
npm run db:inspect
sqlite> SELECT rfid_uid, current_balance FROM users WHERE rfid_uid='A1B2C3D4';

# Step 2: Check estimated fee calculation
# Estimated fee = ₹81 (8 hours worst case)
# Required: current_balance >= 81

# Step 3: Check for pending transactions
sqlite> SELECT * FROM transactions WHERE user_id='<uid>' ORDER BY created_at DESC LIMIT 5;

# Step 4: Verify balance wasn't deducted twice
# Look for duplicate ENTRY transactions

# Solution: Manually topup user
curl -X POST http://localhost:3000/api/parking/users/A1B2C3D4/topup \
  -H "Content-Type: application/json" \
  -d '{"amount": 500, "reason": "Balance correction"}'
```

**Solution:** Check balance in DB, verify no duplicate charges, manually topup.

---

### 📡 MQTT Issues

#### Issue: MQTT Broker Not Running
**Symptoms:** Connection refused, `npm run mqtt:spy` fails

```bash
# Step 1: Check if Docker running
docker ps | grep emqx

# Step 2: Start MQTT broker
docker-compose up -d mqtt-broker
sleep 5

# Step 3: Verify it's running
docker ps
docker logs smart-parking-mqtt

# Step 4: Test connection
npm run mqtt:spy

# Step 5: Manual EMQX start (alternative)
docker run -d -p 1883:1883 -p 18083:18083 \
  -e EMQX_DEFAULT_USER=admin \
  -e EMQX_DEFAULT_PASS=emqx123 \
  emqx/emqx:latest
```

**Solution:** Start MQTT broker with Docker, verify port 1883 open.

---

#### Issue: MQTT Messages Not Arriving
**Symptoms:** `npm run mqtt:spy` connected but no messages

```bash
# Step 1: Verify firmware publishing
npm run firmware:monitor
# Look for: "Publishing RFID scan: ..."

# Step 2: Check backend publishing
npm run backend:dev
# Look for: "LED published" messages

# Step 3: Verify topic format
npm run mqtt:spy "parking/#"
# If silent → topics might have typo

# Step 4: Check QoS settings
# Firmware publishes with QoS 1 (stored if offline)
# Control topics QoS 0 (fire-and-forget)

# Step 5: Verify broker recording messages
npm run mqtt:spy "parking/esp32/+/rfid/scan"
# Should show entry/exit scans
```

**Solution:** Check firmware logs, verify broker connected, inspect topic names.

---

#### Issue: Firmware Not Receiving MQTT Commands
**Symptoms:** LED not changing, buzzer silent

```bash
# Step 1: Check backend publishing
npm run backend:dev
# Look for: "Publishling LED control..." messages

# Step 2: Manually publish test message
npm run mqtt:spy &
# In another terminal:
mosquitto_pub -h localhost -p 1883 -t "parking/esp32/device1/control/led" \
  -m '{"color":"red","duration":3}'

# Step 3: Check firmware subscribing
npm run firmware:monitor
# Look for: "Subscribed to control topics"

# Step 4: Verify callback is called
# Add debug logs in mqtt_callback()

# Step 5: Check device ID in topic
# Expected: parking/esp32/{device_id}/control/...
# Verify device_id matches firmware setting
```

**Solution:** Verify device ID matches, check subscription, add debug logs.

---

### 🗄️ Database Issues

#### Issue: Database Locked Error
**Symptoms:** "SQLITE_BUSY: database is locked"

```bash
# Step 1: Check for multiple server processes
ps aux | grep backend
npm run backend:start
# Should only be one instance

# Step 2: Kill any hanging processes
killall node
sleep 2
npm run backend:start

# Step 3: Check file permissions
ls -la backend/data/parking.db
# Should have read/write permissions

# Step 4: Reset database if corrupted
npm run db:reset
# This deletes and recreates parking.db

# Step 5: Use Write-Ahead Logging (helps concurrency)
# SQLite enables this by default, verify:
npm run db:inspect
sqlite> PRAGMA journal_mode;
# Should return: wal
```

**Solution:** Kill duplicate processes, check file permissions, reset if corrupted.

---

#### Issue: "No such table" Error
**Symptoms:** API returns "SQLITE_CANTOPEN" or table missing

```bash
# Step 1: Initialize database schema
cd backend
npm start  # This runs init.js automatically
sleep 2
kill %1

# Step 2: Verify schema created
npm run db:inspect
sqlite> .tables
# Should show: users, parking_sessions, transactions, device_status

# Step 3: If missing, manually create
npm run db:inspect
sqlite> .read ../docs/schema.sql  # If SQL dump exists

# Step 4: Reload sample data
# Check database/init.js for INSERT statements
npm run backend:start
# Stop after initialization
```

**Solution:** Run schema initialization, verify tables exist.

---

#### Issue: Duplicate Entries in Database
**Symptoms:** Same RFID card creates multiple sessions

```bash
# Step 1: Check parking_sessions for duplicates
npm run db:inspect
sqlite> SELECT rfid_uid, COUNT(*), entry_time FROM parking_sessions \
  WHERE status='ACTIVE' GROUP BY rfid_uid HAVING COUNT(*) > 1;

# Step 2: Check processEntry() is idempotent
# Look in: backend/src/services/parking.service.js
// Should check for existing ACTIVE session before creating new

# Step 3: Add unique constraint (prevents duplicates)
sqlite> ALTER TABLE parking_sessions ADD CONSTRAINT \
  unique_active_session UNIQUE(rfid_uid) WHERE status='ACTIVE';

# Step 4: Verify MQTT RFID topic not echoing
# Firmware publishes once, should only trigger once
# Check subscriber.js debounce logic
```

**Solution:** Add idempotency check, verify no duplicate MQTT handlers.

---

## ❓ Frequently Asked Questions

### Q: Can I use a different MQTT broker?
**A:** Yes! Update `.env`:
```env
MQTT_BROKER_URL=mqtt://your-broker.com:1883
```
Tested with: EMQX, Mosquitto, CloudMQTT, HiveMQ. Should work with any MQTT 3.1.1+ broker.

---

### Q: Can I add more ESP32 devices?
**A:** Yes! Each device needs a unique ID:
```cpp
#define DEVICE_ID "parking-device-1"
// Change to:
#define DEVICE_ID "parking-device-2"
#define DEVICE_ID "parking-device-3"
```
Topics auto-route: `parking/esp32/{device-1,device-2,...}/`

---

### Q: How do I change parking fees?
**A:** Edit `backend/src/services/parking.service.js`:
```javascript
const FIRST_HOUR_RATE = 20;         // ₹20
const ADDITIONAL_HOUR_RATE = 10;    // ₹10 per hour
const ESTIMATED_MAX_FEE = 81;       // 8-hour hold
```

Redeploy and restart backend. Existing sessions use locked fees.

---

### Q: Can I use PostgreSQL instead of SQLite?
**A:** Yes, but upgrade required (not included in MVP):
1. Migrate schema to PostgreSQL
2. Install `pg` npm package
3. Update `backend/src/database/db.js`
4. Change connection string in `.env`

**Recommended for:** 100+ concurrent users in production.

---

### Q: How do I backup the database?
**A:** 
```bash
# Backup
npm run db:backup

# Restore
cp backend/data/parking.db.backup.1234567890 backend/data/parking.db
npx sqlite3 backend/data/parking.db ".dump" > backup.sql  # Export to SQL
```

---

### Q: Can I change the OLED display text?
**A:** Yes! Backend controls it via MQTT:
```javascript
publishDisplayUpdate(device_id, "Line 1 Text", "Line 2 Text", 3);
// Edit in backend/src/services/parking.service.js
```

---

### Q: How do I view historical parking sessions?
**A:** Query database:
```sql
SELECT * FROM parking_sessions 
WHERE created_at > date('now', '-7 days')
ORDER BY created_at DESC;

-- Or via API:
GET /api/parking/users/{uid}/sessions
```

---

### Q: What happens if power fails?
**A:**
- **Firmware**: Reboots, resynchronizes with backend
- **Backend**: Restarts, uses persistent database
- **MQTT**: Queued messages (QoS 1) delivered when broker recovers
- **Active Sessions**: Preserved in database

---

### Q: Can I test without physical devices?
**A:** Yes! Simulate via API:
```bash
# Simulate entry
curl -X POST http://localhost:3000/api/parking/entry/A1B2C3D4

# Simulate exit  
curl -X POST http://localhost:3000/api/parking/exit/A1B2C3D4

# Verify in MQTT spy
npm run mqtt:spy
```

---

### Q: How do I add new users (RFID cards)?
**A:** Via API:
```bash
curl -X POST http://localhost:3000/api/parking/users \
  -H "Content-Type: application/json" \
  -d '{
    "rfid_uid": "D4E5F6G7",
    "name": "New User",
    "email": "user@example.com",
    "initial_balance": 500
  }'
```

Or edit database directly:
```sql
INSERT INTO users (rfid_uid, name, email, current_balance) 
VALUES ('D4E5F6G7', 'New User', 'user@example.com', 500);
```

---

### Q: How do I monitor in production?
**A:** Enable logging:
```env
LOG_LEVEL=debug                     # Options: error, warn, info, debug
LOG_FILE=backend/logs/app.log      # File destination
SENTRY_DSN=https://...             # Error tracking (optional)
```

Integrate with monitoring stack:
- **Logs**: ELK Stack, Splunk, CloudWatch
- **Metrics**: Prometheus, DataDog, New Relic
- **Alerts**: PagerDuty, Slack webhooks

---

### Q: Can I customize the LED colors?
**A:** Yes! Edit:
```cpp
// firmware/src/main.cpp
void setLEDColor(String color, int duration) {
  if (color == "green") {
    strip.setPixelColor(0, strip.Color(0, 255, 0));
  } else if (color == "red") {
    strip.setPixelColor(0, strip.Color(255, 0, 0));
  } else if (color == "blue") {
    strip.setPixelColor(0, strip.Color(0, 0, 255));
  }
  // Add custom colors here
  strip.show();
  delay(duration * 1000);
}
```

---

## 🆘 Getting Help

### Escalation Path

| Issue Level | Action |
|---|---|
| **Simple** (GPIO, LED) | Check firmware.instructions.md |
| **Moderate** (MQTT flow, API) | Run `npm run mqtt:spy` + `npm run backend:dev` |
| **Complex** (Database, scaling) | Check STRUCTURE.md + docs/ folder |
| **Critical** (Production down) | Execute health-check & verify all 3 layers |

### Debugging Checklist

- [ ] Run `npm run health-check` (verifies all systems)
- [ ] Check `npm run backend:dev` logs (errors listed)
- [ ] Monitor `npm run mqtt:spy` (verify message flow)
- [ ] Run `npm run api:test` (endpoints working?)
- [ ] Check `npm run firmware:monitor` (serial output)
- [ ] Verify database: `npm run db:inspect`
- [ ] Restart all services: `docker-compose restart`

### Good Debugging Practices

1. **Check logs first** — 90% of issues visible in logs
2. **Isolate the layer** — MQTT working? Backend working? Firmware?
3. **Test in isolation** — Use `npm run mqtt:spy`, `npm run api:test`
4. **Restart services** — Often resolves race conditions
5. **Check environment** — .env variables, ports, permissions

---

**Document Updated**: Last revision covers firmware, backend, MQTT, and database issues.

For latest troubleshooting tips, check GitHub issues or project documentation.
