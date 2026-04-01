# Smart Parking System - Project Structure Guide

## 📂 Directory Layout

```
smart-parking-system/
│
├── 📄 README.md                          # Main project overview
├── 📄 package.json                       # Root npm scripts (monorepo)
├── 📄 docker-compose.yml                 # Full stack deployment
│
├── 🔧 firmware/                          # ESP32 embedded code
│   ├── platformio.ini                    # PLatformIO config
│   ├── src/
│   │   └── main.cpp                      # Main firmware code
│   └── .pio/                             # Build artifacts (git-ignored)
│
├── 🖥️  backend/                          # Node.js Express server
│   ├── package.json                      # Backend dependencies
│   ├── .env                              # Environment variables (git-ignored)
│   ├── src/
│   │   ├── server.js                     # Express entry point
│   │   ├── database/
│   │   │   ├── db.js                     # Promise-based SQLite wrapper
│   │   │   └── init.js                   # Schema initialization
│   │   ├── services/
│   │   │   └── parking.service.js        # Business logic
│   │   ├── mqtt/
│   │   │   ├── publisher.js              # Publish to ESP32
│   │   │   └── subscriber.js             # Handle ESP32 messages
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   └── parking.routes.js     # 11 API endpoints
│   │   │   └── controllers/
│   │   │       └── parking.controller.js # Request handlers
│   │   └── middleware/
│   │       └── error-handler.js          # Express error middleware
│   ├── data/
│   │   └── parking.db                    # SQLite database (git-ignored)
│   └── logs/
│       └── *.log                         # Server logs (git-ignored)
│
├── 🎨 frontend/                          # React dashboard (optional)
│   ├── package.json
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.js
│       ├── pages/
│       │   ├── ActiveSessions.js
│       │   ├── UserBalance.js
│       │   ├── Reports.js
│       │   └── AdminDashboard.js
│       └── components/
│
├── 📚 docs/                              # Documentation
│   ├── API.md                            # API endpoints reference
│   ├── MQTT_TOPICS.md                    # MQTT protocol spec
│   ├── DATABASE.md                       # Database schema
│   ├── DEPLOYMENT.md                     # Production deployment guide
│   └── TROUBLESHOOTING.md                # Common issues & fixes
│
├── .github/
│   ├── copilot-instructions.md           # Workspace-level Copilot guidance
│   ├── instructions/
│   │   ├── firmware.instructions.md      # Applies to firmware/**
│   │   └── backend.instructions.md       # Applies to backend/**
│   ├── agents/                           # Custom Copilot agents (future)
│   │   ├── firmware-help.agent.md
│   │   ├── backend-help.agent.md
│   │   ├── mqtt-debug.agent.md
│   │   └── deploy.agent.md
│   └── workflows/                        # CI/CD (future)
│       ├── firmware-test.yml
│       └── backend-test.yml
│
├── 📦 scripts/                           # Build & deployment automation
│   ├── build-firmware.sh                 # PlatformIO build wrapper
│   ├── start-backend.sh                  # Backend startup wrapper
│   ├── setup-mqtt.sh                     # EMQX setup (future)
│   ├── deploy-all.sh                     # Full stack deployment (future)
│   └── docker-build.sh                   # Docker image builder (future)
│
├── 🧪 tools/                             # Testing & debugging utilities
│   ├── mqtt-spy.js                       # Real-time MQTT monitor
│   ├── api-tester.js                     # REST endpoint tester
│   ├── health-check.js                   # System health probe (future)
│   ├── doc-generator.js                  # Auto-generate docs (future)
│   └── calibration-tool.js               # Sensor calibration (future)
│
└── 📋 .gitignore                         # Git exclusions
```

---

## 🔄 Context Switching (Auto-Detect)

The workspace uses **path-based context detection**. Copilot automatically applies the right expertise:

| Path Pattern | Copilot Mode | Guidance File |
|---|---|---|
| `firmware/**/*.cpp` | Embedded Systems | `firmware.instructions.md` |
| `firmware/**/*.ini` | PlatformIO Config | `firmware.instructions.md` |
| `backend/**/*.js` | Node.js/Express | `backend.instructions.md` |
| `backend/**/*.json` | Backend Build | `backend.instructions.md` |
| `scripts/**/*.sh` | DevOps/Bash | `copilot-instructions.md` |
| `tools/**/*.js` | Utility Scripts | `copilot-instructions.md` |
| `.github/**` | Workspace Config | `copilot-instructions.md` |
| `docs/**` | Documentation | `copilot-instructions.md` |

**No manual mode switching needed** — just open the file you want to edit! ✨

---

## 🚀 Quick Start

### 1️⃣ Setup (First Time)

```bash
# Clone repo
git clone <repo> smart-parking-system
cd smart-parking-system

# Install dependencies
npm run setup
# or: npm run backend:install && npm run firmware:build
```

### 2️⃣ Local Development

**Terminal 1 - Start MQTT & Backend:**
```bash
docker-compose up -d              # Start MQTT broker
npm run backend:dev               # Start Node.js server (auto-reload)
```

**Terminal 2 - Build & Monitor Firmware:**
```bash
npm run firmware:build            # Compile firmware
npm run firmware:upload           # Flash to ESP32
npm run firmware:monitor          # Watch serial output
```

**Terminal 3 - Monitor MQTT Messages:**
```bash
npm run mqtt:spy                  # Real-time message viewer
```

**Terminal 4 - Test API:**
```bash
npm run api:test                  # Run endpoint tests
npm run health-check              # Check system status
```

### 3️⃣ Production Deployment

```bash
# Build Docker images
docker-compose -f docker-compose.yml build

# Start full stack
docker-compose -f docker-compose.yml up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f mqtt-broker

# Stop everything
docker-compose down
```

---

## 📡 Key Services & Endpoints

### Express Backend (Port 3000)
```
GET    /api/parking/health                    Health check
GET    /api/parking/active                    Active sessions
GET    /api/parking/users                     List users
GET    /api/parking/users/:uid/balance        User balance
POST   /api/parking/users/:uid/topup          Add balance
GET    /api/parking/users/:uid/sessions       Session history
GET    /api/parking/session/:id               Session details
GET    /api/parking/transactions              All transactions
POST   /api/parking/entry/:uid                Simulate entry
POST   /api/parking/exit/:uid                 Simulate exit
GET    /api/parking/report/revenue             Revenue report
```

### MQTT Topics
```
parking/esp32/{device_id}/rfid/scan          ← Entry/exit events
parking/esp32/{device_id}/status             ← Device status
parking/esp32/{device_id}/control/led        → LED commands
parking/esp32/{device_id}/control/buzzer     → Buzzer commands
parking/esp32/{device_id}/control/display    → OLED updates
```

### EMQX Dashboard (Port 18083)
```
http://localhost:18083
Username: admin
Password: emqx123
```

---

## 🔒 Security Configuration

### Environment Variables (.env)

```env
# Development
NODE_ENV=development
PORT=3000
MQTT_BROKER_URL=mqtt://localhost:1883
DATABASE_PATH=./data/parking.db

# Production (.env.production)
NODE_ENV=production
PORT=3000
MQTT_BROKER_URL=mqtt://emqx.yourdomain.com:1883
MQTT_USERNAME=production_user
MQTT_PASSWORD=<SECURE_PASSWORD>
DATABASE_PATH=/var/lib/parking/parking.db
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Database Credentials

- SQLite: File-based, no credentials needed
- MQTT: Default `admin`/`emqx123` (change in production)

---

## 📊 Development Workflow

### Making Changes to Firmware

```bash
# 1. Edit firmware code
vim firmware/src/main.cpp

# 2. Build and verify
npm run firmware:build

# 3. Upload to device
npm run firmware:upload

# 4. Watch serial logs
npm run firmware:monitor

# 5. Commit
git add firmware/
git commit -m "Add feature: X"
```

### Making Changes to Backend

```bash
# 1. Edit backend code
vim backend/src/services/parking.service.js

# 2. Server auto-reloads (dev mode)
npm run backend:dev

# 3. Test endpoints
npm run api:test

# 4. Check database
npm run db:inspect

# 5. Commit
git add backend/
git commit -m "Fix: Y"
```

### Debugging MQTT Flow

```bash
# Spy on all messages
npm run mqtt:spy "parking/#"

# Spy on specific device
npm run mqtt:spy "parking/esp32/device1/+"

# Spy on entry scans only
npm run mqtt:spy "parking/esp32/+/rfid/scan"
```

---

## 🧪 Testing

### Unit Tests (Backend)
```bash
npm run backend:test
```

### Integration Tests
```bash
npm run api:test
```

### Device Tests (Firmware)
```bash
npm run firmware:test
```

### Full System Smoke Test
```bash
npm run health-check
```

---

## 📈 Monitoring & Logs

### View Backend Logs
```bash
npm run logs:backend
# or
tail -f backend/logs/app.log
```

### View Device Status
```
GET /api/parking/active          # Active sessions
GET /api/parking/devices         # Device health (future)
```

### Database Inspection
```bash
npm run db:inspect               # Launch SQLite CLI
# Then: sqlite> SELECT * FROM users;
```

---

## 🐛 Troubleshooting

| Issue | Command | Solution |
|---|---|---|
| ESP32 not uploading | `npm run firmware:info` | Check device detection |
| Backend won't start | `npm run backend:dev` | Check logs, ports, MQTT |
| MQTT connection failed | `npm run mqtt:spy` | Check broker running |
| Database locked | `npm run db:reset` | Recreate database |
| API returns 404 | `npm run api:test` | Verify backend running |

See `docs/TROUBLESHOOTING.md` for detailed debugging guide.

---

## 📚 Documentation Files

- **[README.md](../README.md)** — Project overview & quick start
- **[docs/API.md](../docs/API.md)** — Complete API reference (future)
- **[docs/MQTT_TOPICS.md](../docs/MQTT_TOPICS.md)** — MQTT protocol (future)
- **[docs/DATABASE.md](../docs/DATABASE.md)** — Schema & optimization (future)
- **[docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)** — Production guide (future)
- **[.github/copilot-instructions.md](../.github/copilot-instructions.md)** — Workspace instructions
- **[.github/instructions/firmware.instructions.md](../.github/instructions/firmware.instructions.md)** — Embedded systems guide
- **[.github/instructions/backend.instructions.md](../.github/instructions/backend.instructions.md)** — Backend guide

---

## 🤝 Contributing

1. **Create a branch**: `git checkout -b feature/your-feature`
2. **Make changes**: Edit firmware/** or backend/** (context auto-detected)
3. **Test locally**: `npm run backend:dev` + `npm run firmware:monitor`
4. **Run tests**: `npm test`
5. **Commit**: `git commit -am "Add feature: X"`
6. **Push**: `git push origin feature/your-feature`
7. **PR**: Create pull request with description

---

## 📝 License

MIT - See LICENSE.md

---

**Need help?** Check the relevant `.instructions.md` file for your task (auto-loaded by Copilot based on file location).
