---
description: "Use when: editing firmware code (firmware/** files). Provides ESP32/Arduino/PlatformIO guidance with GPIO constraints, FreeRTOS patterns, MQTT client config, and memory optimization."
applyTo: "firmware/**"
---

# Firmware-Specific Instructions

## 🎯 Context

You are working on **ESP32 embedded firmware** for a smart parking system RFID reader.

**Key Characteristics:**
- **Language**: C++ (Arduino/PlatformIO)
- **Platform**: ESP32 (Tensilica Xtensa processor, 520KB SRAM)
- **RTOS**: FreeRTOS (preemptive multitasking)
- **Communication**: SPI (RFID readers), I2C (OLED), WiFi AP + MQTT
- **Peripherals**: 2× MFRC522, NeoPixel ring, passive buzzer, OLED display

## ⚡ Critical Constraints

### GPIO Pins (FIXED - Do NOT Change)
```
GPIO 5  ← RFID1 CS (ENTRY reader) [LOCKED]
GPIO 4  ← RFID2 CS (EXIT reader)  [LOCKED]
GPIO 14 ← SPI Clock (shared)      [LOCKED]
GPIO 13 ← SPI MOSI (shared)       [LOCKED]
GPIO 12 ← SPI MISO (shared)       [LOCKED]
GPIO 27 ← NeoPixel Ring           [LOCKED]
GPIO 26 ← Passive Buzzer          [LOCKED]
GPIO 34 ← Potentiometer (ADC)    [LOCKED]
GPIO 21 ← OLED SDA (I2C)         [LOCKED]
GPIO 22 ← OLED SCL (I2C)         [LOCKED]
```

**ALL WIRING IS FINAL. No GPIO changes allowed.**

### Memory Constraints
- **Total SRAM**: 520KB
- **Available for code**: ~300KB (after SDK)
- **Recommendation**: Monitor with `ESP.getFreeHeap()`
- **Watch out**: Large string literals, big arrays, unbounded buffers

### Real-Time Constraints
- **RFID scanning**: < 500ms debounce
- **MQTT publish**: Async, shouldn't block RFID task
- **OLED update**: < 100ms (doesn't block critical tasks)
- **Buzzer tone**: Max 1 second

## 🏗️ Architecture

### FreeRTOS Tasks (Core-Pinned)

```cpp
Task: taskRFID1       (Priority 2, Core 1)
  → Continuously scans RFID Reader #1 (Entry)
  → Publishes: parking/esp32/{device_id}/rfid/scan
  → Debounce: 500ms

Task: taskRFID2       (Priority 2, Core 1)
  → Continuously scans RFID Reader #2 (Exit)
  → Publishes: parking/esp32/{device_id}/rfid/scan
  → Debounce: 500ms

Task: taskResponseHandler (Priority 1, Core 0)
  → Monitors MQTT callbacks for responses
  → Handles timeout (5 seconds → assume approved)
  → Lights LED, plays buzzer, updates OLED

Main Loop (loop())
  → client.loop() [Keeps MQTT alive]
  → delay(100)    [Yield to other tasks]
```

### Communication Protocols

**SPI (RFID Readers)**
- Clock: GPIO 14 @ 1MHz (slow for stability)
- MOSI: GPIO 13
- MISO: GPIO 12
- CS1: GPIO 5 (RFID #1 - pulled HIGH when idle)
- CS2: GPIO 4 (RFID #2 - pulled HIGH when idle)

**I2C (OLED)**
- SDA: GPIO 21 @ 100kHz
- SCL: GPIO 22 @ 100kHz
- Address: 0x3C

**WiFi + MQTT**
- WiFi Mode: AP (Access Point)
- SSID: "ESP32_AP", Password: "password123"
- IP: 192.168.4.1
- MQTT Broker: 192.168.4.2 (usually laptop)
- MQTT Port: 1883 (no encryption in dev)
- Client ID: device1 (must match backend config)

## 📡 MQTT Patterns

### Publishing (Use string topics only, avoid dynamic)

```cpp
// ✅ GOOD: Compile-time topic
char topic[120];
snprintf(topic, sizeof(topic), "parking/esp32/%s/rfid/scan", DEVICE_ID);

// ❌ AVOID: Malloc in real-time task
char* topic = (char*)malloc(50); // Can fragment heap
```

### Subscribing

```cpp
// ✅ Subscribe in setup() only
client.subscribe("parking/esp32/device1/control/led");
client.subscribe("parking/esp32/device1/control/buzzer");
client.subscribe("parking/esp32/device1/control/display");

// ✅ Use MQTT_MAX_PACKET_SIZE for JSON
// ArduinoJson needs enough buffer
DynamicJsonDocument doc(256); // Should fit our payloads
```

### Callback Performance

```cpp
void mqtt_callback(char *topic, byte *payload, unsigned int length) {
  // ⚠️ This runs in TCP task context - MUST be fast
  // ✅ Use DynamicJsonDocument (heap does OK here)
  // ❌ NEVER call delay(), yield(), or blocking I/O
  
  DynamicJsonDocument doc(256);
  deserializeJson(doc, payload, length);
  
  // Set flags for main task to handle
  responseReceived = true; // ← taskResponseHandler checks this
}
```

## 🎮 State Machine

```
State: IDLE
  ↓ RFID1 scan detected
State: ENTRY_SCANNED
  → Publish JSON to MQTT
  → Yellow LED (waiting)
  → 1 beep
  → State: WAITING_RESPONSE
    ↓ MQTT callback / timeout
    ├─ If approved (response from backend)
    │  → Green LED (3s)
    │  → 2 beeps
    │  → Update OLED
    │  → State: IDLE
    └─ If timeout (5 seconds)
       → Assume APPROVED (fail-open)
       → Green LED
       → State: IDLE

(Same flow for RFID2 / EXIT)
```

**Fail-Open Logic**: If backend doesn't respond in 5 seconds, allow entry. This is intentional - customer experience > security (can reconcile in backend).

## 💡 Code Patterns

### Correct RFID Reading

```cpp
if (rfid1.PICC_IsNewCardPresent() && rfid1.PICC_ReadCardSerial()) {
  if (millis() - lastRFIDReadTime > RFID_DEBOUNCE_DELAY) {
    String uid = getTagID(&rfid1);  // ← Converts to HEX "A1B2C3D4"
    
    // Publish immediately
    publishRFIDScan("ENTRY", uid);
    
    // Set state
    currentState = WAITING_RESPONSE;
    lastResponseTime = millis();
    
    rfid1.PICC_HaltA(); // ← Important: Stop reading to prevent multiple scans
    lastRFIDReadTime = millis();
  }
}
```

### Correct MQTT Publishing (JSON)

```cpp
void publishRFIDScan(const char *reader, String uid) {
  char topic[120];
  snprintf(topic, sizeof(topic), "parking/esp32/%s/rfid/scan", DEVICE_ID);
  
  // Use ArduinoJson (pre-allocated, no malloc in real-time)
  StaticJsonDocument<256> doc;
  doc["uid"] = uid;
  doc["reader"] = reader;
  doc["timestamp"] = millis();
  
  char payload[256];
  serializeJson(doc, payload);
  
  client.publish(topic, payload);
  // ✅ This is fire-and-forget (async)
}
```

### Correct LED Control

```cpp
void setLEDColor(uint8_t r, uint8_t g, uint8_t b, uint16_t duration) {
  for (int i = 0; i < pixel.numPixels(); i++) {
    pixel.setPixelColor(i, pixel.Color(r, g, b));
  }
  pixel.show();
  
  // ⚠️ Duration handling:
  // Option 1: Use flag + check in loop()
  // Option 2: Schedule callback with timer
  // ❌ NEVER use delay(duration) in any task
}
```

### Correct OLED Display

```cpp
void updateDisplay(const char *line1, const char *line2) {
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(WHITE);
  display.setCursor(0, 10);
  display.println(line1);        // ← Limit to ~8 chars for readability
  
  display.setTextSize(1);
  display.setCursor(0, 40);
  display.println(line2);        // ← Variable line
  
  display.display();             // ← Commit changes
  // ✅ This is ~50ms (acceptable)
}
```

## 🔍 Debugging

### Serial Logging

```cpp
Serial.println("Entry RFID scan");        // ✅ Clear messages
Serial.printf("UID: %s\n", uid.c_str()); // ✅ Formatted
Serial.println(f"Heap: {ESP.getFreeHeap()}"); // Watch memory

// Check with: npm run firmware:monitor
```

### MQTT Debugging

```cpp
// Print topic and payload when receiving
Serial.printf("MQTT Topic: %s\n", topic);
Serial.printf("Payload: %s\n", (char*)payload);

// Then use: npm run mqtt:spy [from backend terminal]
// To see all messages in real-time
```

### Memory Debugging

```cpp
void checkMemory() {
  uint32_t freeHeap = ESP.getFreeHeap();
  uint32_t maxBlock = ESP.getMaxAllocHeap();
  
  if (freeHeap < 50000) {  // Less than 50KB free
    Serial.printf("⚠️ Low memory: %u bytes\n", freeHeap);
  }
}

// Call periodically in loop()
```

## ✅ Pre-Commit Checklist

Before pushing firmware changes:

- [ ] No new GPIO pins added/modified ✓
- [ ] Memory usage checked (avoid malloc in tasks)
- [ ] MQTT subscriptions only in setup()
- [ ] No blocking calls in MQTT callback
- [ ] State machine handles timeouts
- [ ] RFID debouncing implemented (500ms)
- [ ] LED/Buzzer are non-blocking
- [ ] Serial output for debugging
- [ ] Compile without warnings: `pio run`
- [ ] Successfully flashed to device

## 🚀 Building & Uploading

```bash
# Compile only (check for errors)
pio run -e esp32dev

# Compile + Upload
pio run -t upload -e esp32dev

# Monitor serial (see logs)
pio device monitor --baud 115200

# Or use npm shortcuts:
npm run firmware:build
npm run firmware:upload
npm run firmware:monitor
```

## 🔧 PlatformIO Config

**Required dependencies in platformio.ini:**
```ini
lib_deps =
  adafruit/Adafruit GFX Library
  adafruit/Adafruit SSD1306
  miguelbalboa/MFRC522
  knolleary/PubSubClient
  adafruit/Adafruit NeoPixel
  bblanchon/ArduinoJson@^6.20.0
```

**Do NOT add**:
- `WiFi.h` (already in framework)
- `Wire.h` (already in framework)

## 📚 Key Libraries

| Library | Usage | Docs |
|---------|-------|------|
| MFRC522 | RFID reading | https://github.com/miguelbalboa/rfid |
| Adafruit_SSD1306 | OLED display | https://github.com/adafruit/Adafruit_SSD1306 |
| Adafruit_NeoPixel | LED ring | https://github.com/adafruit/Adafruit_NeoPixel |
| PubSubClient | MQTT | https://github.com/knolleary/pubsubclient |
| ArduinoJson | JSON | https://arduinojson.org/ |

## 🎓 Anti-Patterns (Avoid These)

❌ **Malloc in real-time task**
```cpp
char* topic = (char*)malloc(50); // Can fail, fragments heap
```

✅ **Use stack or static**
```cpp
char topic[120]; // Stack allocation, deterministic
```

---

❌ **Blocking in MQTT callback**
```cpp
void mqtt_callback(...) {
  delay(1000); // Blocks entire TCP stack!
}
```

✅ **Set flag, handle in loop**
```cpp
void mqtt_callback(...) {
  responseReceived = true; // Non-blocking flag
}
// In taskResponseHandler: if (responseReceived) { ... }
```

---

❌ **Unbounded JSON parsing**
```cpp
DynamicJsonDocument doc(1024); // Might fail or waste RAM
deserializeJson(doc, payload, length);
```

✅ **Fixed-size document**
```cpp
StaticJsonDocument<256> doc; // Deterministic, < 256 bytes
deserializeJson(doc, payload, length);
```

---

## 🎯 Quick Wins

1. **Add memory monitoring task** - Print free heap every 10s
2. **Improve RFID filtering** - Track card read count, ignore if duplicate
3. **Add LED patterns** - Pulse on entry processing, solid on approval
4. **Implement watchdog** - Reset if firmware hangs > 30s
5. **Add OTA updates** - Update firmware from backend over MQTT

All of these maintain the fixed GPIO layout. ✓
