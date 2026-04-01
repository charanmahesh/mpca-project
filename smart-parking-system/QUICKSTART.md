# 🚀 Smart Parking System - Quick Start (5 Minutes)

## ⚡ One-Command Setup

```bash
cd smart-parking-system
npm run setup
```

This installs backend dependencies and compiles firmware. That's it!

---

## 🎮 Five Key Commands

### 1️⃣ Start Everything (Local Dev)

```bash
# Terminal 1: Start MQTT + Backend
docker-compose up -d
npm run backend:dev

# Terminal 2: Monitor Firmware
npm run firmware:monitor

# Terminal 3: Watch MQTT Messages
npm run mqtt:spy
```

### 2️⃣ Build & Flash Firmware

```bash
npm run firmware:build        # Compile
npm run firmware:upload       # Flash to ESP32
npm run firmware:monitor      # Watch serial output
```

### 3️⃣ Test Everything

```bash
npm run api:test              # Check REST endpoints
npm run mqtt:spy              # Verify MQTT flow
npm run health-check          # Full system status
```

### 4️⃣ Deploy to Production

```bash
docker-compose up -d
# That's it! Backend + MQTT running
```

### 5️⃣ Debug Issues

```bash
# What's wrong?
npm run mqtt:spy              # MQTT working?
npm run backend:dev           # Server logs?
npm run firmware:monitor      # Firmware OK?
npm run db:inspect            # Database accessible?
```

---

## 📋 What You Get

| Component | Status | Access |
|---|---|---|
| **Express API** | Running on :3000 | `http://localhost:3000/api/parking/health` |
| **MQTT Broker** | Running on :1883 | Subscribe: `parking/#` |
| **SQLite DB** | Auto-initialized | `npm run db:inspect` |
| **EMQX Dashboard** | on :18083 | `http://localhost:18083` |
| **Firmware** | Compiled & ready | Upload: `npm run firmware:upload` |

---

## 🎯 Typical Workflow

### First Time Setup
```bash
git clone <repo> && cd smart-parking-system
npm run setup                          # Install + build
docker-compose up -d                   # Start MQTT
npm run backend:start                  # Start server
```

### Daily Development
```bash
# Terminal 1
npm run backend:dev                    # Dev server (auto-reload)

# Terminal 2  
npm run firmware:monitor               # Serial monitor

# Terminal 3
npm run mqtt:spy                       # MQTT watcher
```

### Before Committing
```bash
npm run api:test                       # Endpoints OK?
npm run firmware:build                 # Compiles?
npm run backend:lint                   # Code clean?
```

### Deploying to Production
```bash
docker-compose -f docker-compose.yml up -d
# Verify: curl http://localhost:3000/api/parking/health
```

---

## 🔑 Key Files to Know

| File | Purpose | Edit When... |
|---|---|---|
| `firmware/src/main.cpp` | ESP32 code | Adding RFID logic, LED control |
| `backend/src/services/parking.service.js` | Fee logic | Changing rates, balance rules |
| `.env` | Configuration | Changing MQTT broker, database path |
| `docker-compose.yml` | Deployment | Adding services, changing ports |
| `package.json` | npm scripts | Adding shortcuts for common tasks |

---

## 🆘 Quick Troubleshooting

| Problem | Fix |
|---|---|
| **Backend won't start** | `npm run db:reset` + restart |
| **MQTT not working** | `docker-compose up -d mqtt-broker` |
| **ESP32 won't upload** | Check COM port: `npm run firmware:info` |
| **API returning 500** | Check logs: `npm run backend:dev` |
| **RFID not reading** | Check serial: `npm run firmware:monitor` |

See `TROUBLESHOOTING.md` for detailed debugging.

---

## 📚 More Information

- **Full Setup**: [README.md](README.md)
- **Project Structure**: [STRUCTURE.md](STRUCTURE.md)
- **Implementation Details**: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Firmware Guide**: [.github/instructions/firmware.instructions.md](.github/instructions/firmware.instructions.md)
- **Backend Guide**: [.github/instructions/backend.instructions.md](.github/instructions/backend.instructions.md)

---

## ✅ Success Checklist

After setup, verify:

- [ ] Backend running: `curl http://localhost:3000/api/parking/health`
- [ ] Database exists: `npm run db:inspect`
- [ ] MQTT connected: `npm run mqtt:spy` (should see "Connected")
- [ ] Firmware compiled: `npm run firmware:build` (no errors)
- [ ] API working: `npm run api:test` (7/7 tests pass)

**All green? You're ready to go!** 🎉

---

## 🚀 Next Steps

1. **For Beginners**: Read [STRUCTURE.md](STRUCTURE.md) to understand layout
2. **For Developers**: Start with `npm run backend:dev` + monitor
3. **For DevOps**: Use `docker-compose.yml` for production
4. **For Debugging**: Run `npm run health-check` first

---

**Questions?** Check the appropriate guide file (auto-loaded by Copilot based on what you're editing).
