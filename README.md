# 🅿️ Smart Parking System

A full-stack RFID-based smart parking management system built with **ESP32** + **Node.js** + **MQTT**.

## Architecture

```
ESP32 (WiFi AP: 192.168.4.1)
  ├── RFID Reader 1 (Entry)          → publishes to  rfid/in
  ├── RFID Reader 2 (Exit)           → publishes to  rfid/out
  ├── OLED Display                   ← shows access result
  ├── NeoPixel Ring                  ← green/red indicator
  ├── Buzzer                         ← audio feedback
  └── Potentiometer                  → selects zone (1-5)

Laptop (connects to ESP32_AP WiFi, IP: 192.168.4.2)
  ├── Mosquitto MQTT Broker (:1883)
  └── Node.js Server (:3000)
       ├── MQTT Client               ← subscribes rfid/in, rfid/out
       │                             → publishes access/response
       ├── SQLite Database            ← users, logs, slots
       ├── REST API                   ← /api/users, /api/logs, /api/slots
       ├── WebSocket (Socket.IO)      ← real-time dashboard updates
       └── Web Dashboard              ← served at http://localhost:3000
```

## Prerequisites

1. **Node.js** v18+ installed on your laptop
2. **Mosquitto MQTT Broker** installed and running on your laptop
   - Download: https://mosquitto.org/download/
   - Start with: `mosquitto -v`
3. **ESP32** flashed with the firmware (see `firmware/main.cpp`)

## Quick Start

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Start Mosquitto MQTT Broker
```bash
mosquitto -v
```

### 3. Connect to ESP32 WiFi
Connect your laptop to the WiFi network:
- **SSID:** `ESP32_AP`
- **Password:** `password123`
- Your laptop should get IP `192.168.4.2`

### 4. Start the Server
```bash
cd server
npm start
```

### 5. Open the Dashboard
Open `http://localhost:3000` in your browser.

## Testing Without Hardware

The dashboard includes a **Simulate Scan** page where you can test the full flow without the ESP32:

1. Go to the **Users** page and register a test user with UID `A1B2C3D4`
2. Go to the **Simulate Scan** page
3. Enter `A1B2C3D4`, select a zone, and click **Simulate IN**
4. Watch the dashboard update in real-time!

## MQTT Topics

| Topic | Direction | Payload | Example |
|---|---|---|---|
| `rfid/in` | ESP32 → Server | `UID,location` | `A1B2C3D4,3` |
| `rfid/out` | ESP32 → Server | `UID,location` | `A1B2C3D4,3` |
| `access/response` | Server → ESP32 | `UID,STATUS,NAME` | `A1B2C3D4,ALLOWED,Charan` |

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard` | Dashboard stats |
| `GET` | `/api/users` | List users |
| `POST` | `/api/users` | Register user |
| `PUT` | `/api/users/:id` | Update user |
| `DELETE` | `/api/users/:id` | Delete user |
| `GET` | `/api/logs` | Filtered/paginated logs |
| `GET` | `/api/logs/export` | Download CSV |
| `GET` | `/api/slots` | Zone occupancy |
| `PUT` | `/api/slots/:loc` | Update zone |
| `POST` | `/api/simulate` | Simulate scan |

## Hardware Connections (ESP32)

| Component | Pin |
|---|---|
| RFID 1 (Entry) CS | GPIO 5 |
| RFID 2 (Exit) CS | GPIO 4 |
| SPI SCK | GPIO 14 |
| SPI MISO | GPIO 12 |
| SPI MOSI | GPIO 13 |
| OLED SDA | GPIO 21 (default I2C) |
| OLED SCL | GPIO 22 (default I2C) |
| Potentiometer | GPIO 34 |
| Buzzer | GPIO 26 |
| NeoPixel (8 LEDs) | GPIO 27 |
