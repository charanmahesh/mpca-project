# 🚗 Smart Parking System - Unified Monorepo

[![Firmware](https://img.shields.io/badge/Firmware-ESP32,%20C++-blue)](#-firmware) 
[![Backend](https://img.shields.io/badge/Backend-Node.js,%20Express-green)](#-backend) 
[![MQTT](https://img.shields.io/badge/Protocol-MQTT,%20JSON-orange)](#-mqtt-integration)

A production-ready IoT smart parking system with **dual-mode development** for embedded firmware and cloud backend, unified in a single repository.

## 📦 Repository Structure

```
smart-parking-system/
│
├── firmware/                          # ESP32 Firmware (C++/Arduino)
│   ├── src/
│   │   └── main.cpp                  # State machine & RFID logic
│   ├── platformio.ini
│   └── README.md
│
├── backend/                           # Node.js Backend (Express + SQLite)
│   ├── src/
│   │   ├── mqtt/                     # MQTT pub/sub
│   │   ├── services/                 # Business logic
│   │   ├── api/                      # REST endpoints
│   │   └── database/                 # SQLite schema
│   ├── package.json
│   └── README.md
│
├── scripts/                           # Unified Build & Deploy
│   ├── build-firmware.sh              # Compile ESP32 firmware
│   ├── start-backend.sh               # Start Node backend
│   ├── deploy-all.sh                  # Full stack deployment
│   └── setup-mqtt.sh                  # MQTT broker setup
│
├── tools/                             # Testing & Utilities
│   ├── mqtt-spy.js                   # MQTT message inspector
│   ├── api-tester.js                 # REST API test client
│   └── doc-generator.js              # Auto-generate docs
│
├── .github/
│   ├── copilot-instructions.md        # Workspace-wide context
│   ├── AGENTS.md                      # Custom agents
│   └── instructions/
│       ├── firmware.instructions.md   # Firmware-specific rules
│       └── backend.instructions.md    # Backend-specific rules
│
├── docker-compose.yml                 # Full stack in containers
├── package.json                       # Root scripts
└── README.md                          # This file
```

---

## 🎯 Quick Start

### One-Command Setup
```bash
npm install                # Install all deps (firmware + backend)
npm run setup             # Initialize MQTT + database
npm run dev               # Start MQTT, backend, and firmware monitor
```

### Individual Commands
```bash
# Firmware Development
npm run firmware:build     # Compile ESP32
npm run firmware:upload    # Flash to device
npm run firmware:monitor   # Serial monitor

# Backend Development
npm run backend:install    # Install Node deps
npm run backend:start      # Start Express server
npm run backend:migrate    # Initialize database

# Testing & Tools
npm run mqtt:spy          # Monitor MQTT messages
npm run api:test          # Test REST endpoints
npm run docs:generate     # Build documentation
```

---

## 🔧 Development Workflows

### Working on Firmware?
```
When you edit files in firmware/**, Copilot automatically provides:
✅ PlatformIO-specific guidance
✅ Arduino/ESP32 best practices
✅ GPIO pin reference
✅ FreeRTOS patterns
✅ MQTT client configuration
```

### Working on Backend?
```
When you edit files in backend/**, Copilot automatically provides:
✅ Node.js/Express patterns
✅ SQLite optimization tips
✅ REST API design
✅ MQTT pub/sub best practices
✅ Production deployment patterns
```

**No manual mode switching needed!** The context adapts based on your current file.

---

## 📡 MQTT Topics Reference

### Device → Server
```
parking/esp32/device1/rfid/scan              # RFID scan events
parking/esp32/device1/status/online          # Device heartbeat
parking/esp32/device1/sensor/potentiometer   # Location data
```

### Server → Device
```
parking/esp32/device1/control/led            # LED color control
parking/esp32/device1/control/buzzer         # Buzzer patterns
parking/esp32/device1/control/display        # OLED updates
```

---

## 💰 Parking Fee Logic

| Duration | Fee |
|----------|-----|
| ≤ 1 hour | ₹20 |
| 1-2 hours | ₹30 |
| 2-3 hours | ₹40 |
| 3-4 hours | ₹50 |
| +1 hour | +₹10 |

**Entry**: Deduct estimated fee (₹81 for 8-hour max)  
**Exit**: Calculate actual fee, refund difference

---

## 🧪 Testing

### Test MQTT Flow
```bash
npm run mqtt:spy         # Terminal 1: Watch messages
# Then scan RFID card in firmware - see real-time MQTT
```

### Test API Endpoints
```bash
npm run api:test         # Terminal 1: Run test suite
# Checks entry/exit/balance/history endpoints
```

### Test Full Stack
```bash
npm run test:e2e         # End-to-end: Firmware → MQTT → Backend → API
```

---

## 📊 API Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | `GET` | System status |
| `/api/parking/active` | `GET` | Currently parked vehicles |
| `/api/parking/users/{uid}/balance` | `GET` | Check balance |
| `/api/parking/users/{uid}/sessions` | `GET` | Parking history |
| `/api/parking/users/{uid}/topup` | `POST` | Add balance (admin) |
| `/api/parking/revenue/daily` | `GET` | Daily revenue report |

See [Backend README](./backend/README.md) for full API docs.

---

## 🔌 Hardware Pin Mapping

| Component | GPIO | Protocol | Status |
|-----------|------|----------|--------|
| RFID Reader #1 (Entry) | 5 | SPI | ✅ Used |
| RFID Reader #2 (Exit) | 4 | SPI | ✅ Used |
| SPI Clock | 14 | SPI | ✅ Used |
| SPI MOSI | 13 | SPI | ✅ Used |
| SPI MISO | 12 | SPI | ✅ Used |
| NeoPixel Ring | 27 | Digital | ✅ Used |
| Buzzer | 26 | Digital | ✅ Used |
| Potentiometer | 34 | Analog | ✅ Used |
| OLED SDA | 21 | I2C | ✅ Used |
| OLED SCL | 22 | I2C | ✅ Used |

**All GPIO fixed and documented ✓**

---

## 🚀 Deployment

### Local Development
```bash
docker-compose up -d      # Start MQTT + PostgreSQL
npm run setup
npm run dev
```

### Production
```bash
# Deploy firmware
npm run firmware:build
pio run -t upload --upload-port /dev/ttyUSB0

# Deploy backend
npm run backend:install
npm run backend:start &   # or use PM2
```

---

## 📚 Documentation

- **[Firmware Guide](./firmware/README.md)** - PlatformIO, GPIO, state machine
- **[Backend Guide](./backend/README.md)** - Express, SQLite, REST API
- **[MQTT Protocol](./MQTT.md)** - Message formats, topics
- **[Hardware Wiring](./HARDWARE.md)** - GPIO pin mappings, connections
- **[API Reference](./API.md)** - Complete endpoint documentation
- **[Deployment Guide](./DEPLOY.md)** - Production setup

---

## 🛠️ Technology Stack

| Layer | Tech |
|-------|------|
| **Firmware** | ESP32, Arduino, FreeRTOS, PlatformIO |
| **Protocol** | MQTT, JSON, HTTP/REST |
| **Backend** | Node.js, Express.js, SQLite3 |
| **Broker** | EMQX (local or cloud) |
| **Tools** | npm, docker-compose |

---

## 🎓 Smart Context Switching

This monorepo uses **VS Code Copilot instructions** to automatically adapt to your context:

**Workspace Instructions** (`copilot-instructions.md`)
- Global project knowledge
- How firmware and backend interact

**Firmware Instructions** (applies to `firmware/**`)
- ESP32-specific patterns
- Arduino best practices
- GPIO & MQTT client config

**Backend Instructions** (applies to `backend/**`)
- Node.js patterns
- Express middleware
- SQLite optimization
- REST API design

**Custom Agents** (via `/` commands)
- `/firmware-help` - Firmware-specific guidance
- `/backend-help` - Backend-specific guidance
- `/mqtt-debug` - MQTT troubleshooting
- `/deploy` - Production deployment

---

## 🐛 Troubleshooting

### Firmware Issues
```bash
# Check ESP32 connection
pio device list

# Monitor serial output
npm run firmware:monitor

# See GPIO conflicts
# (All pins in HARDWARE.md are reserved)
```

### Backend Issues
```bash
# Check MQTT connection
npm run mqtt:spy

# Verify database
sqlite3 backend/data/parking.db ".tables"

# Test API
curl http://localhost:3000/health
```

### MQTT Issues
```bash
# Check broker running
docker ps | grep emqx

# Inspect messages in real-time
npm run mqtt:spy
```

---

## 📞 Support

1. **Check the README** in `firmware/` or `backend/` directories
2. **Run tests** - `npm run test:e2e`
3. **Inspect logs** - `npm run logs`
4. **Monitor MQTT** - `npm run mqtt:spy`

---

## 📝 Contributing

1. **Firmware changes** → Edit `firmware/src/main.cpp`
2. **Backend changes** → Edit `backend/src/**`
3. **Tests pass?** → `npm run test:all`
4. **Documentation updated?** → Run `npm run docs:generate`

---

**Happy Parking! 🚗✨**

Built with ❤️ for IoT + Smart Parking Systems
