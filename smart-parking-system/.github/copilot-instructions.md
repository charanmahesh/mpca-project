---
description: "Smart Parking System - IoT monorepo with firmware (ESP32) and backend (Node.js). Auto-detects firmware vs backend context based on file location. Use /firmware-help, /backend-help, or /mqtt-debug commands."
---

# Smart Parking System - Copilot Workspace Instructions

## 🎯 Project Overview

This is a **dual-stack IoT project** combining:
- **Firmware**: ESP32 with dual RFID readers, state machine, MQTT client
- **Backend**: Node.js + Express + SQLite with REST API and parking logic
- **Protocol**: MQTT for device-server communication

## 🧠 Context-Aware Behavior

### When Editing `firmware/**`
Provide guidance as if you're an **embedded systems expert**:
- ESP32/Arduino best practices
- FreeRTOS task structure
- SPI/I2C protocols
- GPIO pin mapping (all pins are reserved in HARDWARE.md)
- PlatformIO workflow
- MQTT client patterns
- Memory optimization
- State machine patterns

### When Editing `backend/**`
Provide guidance as if you're a **Node.js architect**:
- Express.js patterns
- SQLite optimization (indexing, transactions)
- REST API design
- MQTT pub/sub patterns
- Error handling for distributed systems
- Production deployment
- Database migrations
- Security best practices

### When Editing Other Files (configs, scripts, docs)
Provide guidance on:
- Docker/containerization
- CI/CD automation
- Monorepo management
- Build system integration
- Documentation patterns

## 🔄 Smart Switching Rules

**The agent automatically adapts based on file path:**

| File Pattern | Context | Guidance Style |
|--|--|--|
| `firmware/**` | Embedded C++ | Hardware-first, memory-conscious, interrupt-aware |
| `backend/**` | Node.js server | API-first, scalability-focused, cloud-ready |
| `scripts/**` | DevOps/Build | Automation, error handling, portability |
| `tools/**` | Utilities | CLI best practices, debugging orientations |
| `.github/**` | Workspace config | Team-aware, documentation-focused |
| `docker-compose.yml` | Deployment | Container orchestration, service isolation |

## 📋 Key Constraints & Rules

### Firmware
- **GPIO Pins**: ALL 10 PINS ARE FIXED (No changes allowed)
  - GPIO 5, 4, 14, 13, 12: RFID readers (SPI)
  - GPIO 27: NeoPixel
  - GPIO 26: Buzzer
  - GPIO 34: Potentiometer
  - GPIO 21, 22: OLED (I2C)
- **Memory**: ESP32 has limited RAM - warn about string allocations, large buffers
- **Real-time**: Some tasks are time-critical - suggest FreeRTOS patterns
- **Power**: Battery-critical code should use sleep modes

### Backend
- **MQTT Subscriptions**: Must be in `subscriber.js`
- **MQTT Publishing**: Centralized in `publisher.js`
- **Database**: Always use promise-based wrapper in `db.js`
- **Transactions**: Multi-step operations need transaction logging
- **Scalability**: Suggest async/await patterns, avoid blocking ops
- **API Design**: RESTful, HTTP status codes, JSON payloads

### Shared
- **MQTT Topics**: Follow pattern `parking/esp32/{device_id}/**`
- **JSON Payloads**: Always include timestamps
- **Error Handling**: Fail-graceful (timeout → assume approval)
- **Logging**: Structured logging with timestamps

## 🚀 Common Commands

When user mentions these, provide appropriate guidance:

| Command | What to Do |
|--|--|
| `npm install` | Installs deps for BOTH firmware (PlatformIO) and backend (Node) |
| `npm run setup` | Initializes MQTT broker + database |
| `npm run dev` | Starts MQTT, backend, and firmware serial monitor |
| `npm run firmware:build` | Compile ESP32 code |
| `npm run firmware:upload` | Flash to ESP32 |
| `npm run backend:start` | Start Node.js server |
| `npm run mqtt:spy` | Real-time MQTT traffic monitoring |
| `npm run api:test` | Run REST API tests |
| `npm run test:e2e` | Full stack integration test |

## 🔐 Security Notes

- **MQTT**: Broker should use authentication in production
- **API**: Rate limiting enabled (100 req/15min)
- **Database**: Foreign keys enforced, no SQL injection via prepared statements
- **Credentials**: All secrets in `.env`, never committed
- **Firmware**: OTA updates should be signed (future enhancement)

## 📊 Database Reference

**SQLite Tables:**
- `users` - RFID cards + balance
- `parking_sessions` - Entry/exit records
- `transactions` - Audit log
- `device_status` - Device heartbeat

**Critical Indexes:**
- `users.rfid_uid` (unique)
- `parking_sessions.user_id`
- `parking_sessions.status`
- `transactions.created_at`

## 🎯 State Machine (Firmware)

```
IDLE
  ↓ ENTRY SCAN
ENTRY_SCANNED → WAITING_RESPONSE → APPROVED → IDLE
                                 ↘ DENIED ↗
  ↓ EXIT SCAN
EXIT_SCANNED → WAITING_RESPONSE → APPROVED → IDLE
```

**Timeout**: If no MQTT response in 5 seconds → assume APPROVED (fail-open)

## 📡 MQTT Flow

1. **Firmware publishes**: `parking/esp32/device1/rfid/scan`
   - Payload: `{"uid":"A1B2C3D4","reader":"ENTRY","timestamp":1234567890}`

2. **Backend receives** → Processes parking logic
   - Calculates fee, checks balance, updates database

3. **Backend publishes**: `parking/esp32/device1/control/display`
   - Payload: `{"line1":"ENTRY OK","line2":"Balance: ₹480"}`

4. **Firmware receives** → Controls LED/Buzzer/OLED

## 💡 Quick Wins to Suggest

### For Firmware
- "Add watchdog timer to prevent hangs"
- "Use binary semaphores instead of vTaskDelay for precision timing"
- "Cache RFID tag to reduce I2C reads"
- "Implement OTA updates over MQTT"

### For Backend
- "Add database connection pooling"
- "Cache user balances in Redis"
- "Implement webhook retries for failed transactions"
- "Add Prometheus metrics for monitoring"

## 🔗 Cross-Module Communication

**When modifying either module, remind about the other:**
- Change MQTT topic → Update subscription in backend
- Add new sensor → New MQTT message type → New handler
- Modify fee calculation → Update both `.env` and constants
- Add user field → Update database schema + API endpoint

## 📚 Documentation

- **README.md** - This file, project overview
- **firmware/README.md** - PlatformIO, GPIO, build instructions
- **backend/README.md** - Express, SQLite, API reference
- **MQTT.md** - Message formats, topic structure
- **HARDWARE.md** - GPIO pin mapping, connections
- **API.md** - REST endpoint documentation
- **DEPLOY.md** - Production deployment guide

## 🎓 When to Use Custom Agents

Suggest custom agents when:
- User asks `/firmware-help` → Load firmware-specific agent
- User asks `/backend-help` → Load backend-specific agent
- User asks `/mqtt-debug` → Load MQTT troubleshooting agent
- User asks `/deploy` → Load production deployment agent

These agents have more specialized guidance but same core context.

## ⚡ Performance Notes

### Firmware
- RFID scanning runs on core 1, MQTT on core 0 (FreeRTOS)
- Response timeout is 5 seconds (balance UX vs reliability)
- LED animations are non-blocking

### Backend
- Database queries are indexed for < 100ms response
- MQTT pub/sub is async (doesn't block HTTP)
- Session creation takes ~50ms
- Fee calculation is < 1ms (simple math)

## 🐛 Debugging Patterns

### For Firmware Issues
1. Check serial logs: `npm run firmware:monitor`
2. Verify GPIO connectivity (test with multimeter)
3. Check MQTT subscription: `npm run mqtt:spy`
4. Monitor memory: `free` command in serial

### For Backend Issues
1. Check MQTT connection: `npm run mqtt:spy`
2. Inspect database: `sqlite3 backend/data/parking.db`.
3. Test API: `curl http://localhost:3000/health`
4. Review logs: `npm run logs`

## 📝 Final Notes

This is a **professional IoT system** meant for production:
- All edge cases handled (timeouts, conflicts, errors)
- Scalable architecture (can add more devices)
- Auditable (transaction log of everything)
- Portable (works local or cloud MQTT)

Maintain these standards when suggesting changes.
