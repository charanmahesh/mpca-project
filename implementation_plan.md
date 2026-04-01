# Buzzer Connection and Project Status Analysis

The user reported that the buzzer doesn't sound when an RFID tag is scanned. This plan identifies the root cause and outlines the steps to fix the communication gap between the ESP32 and the Backend.

## User Review Required

> [!IMPORTANT]
> **MQTT Broker Mismatch Detected:**
> The ESP32 is currently configured to use a public broker (`test.mosquitto.org`), while the Backend is configured for a local IP (`192.168.4.2`). They are essentially speaking on different "phone lines."
> **Proposed Fix:** Align both to use `test.mosquitto.org` for testing purposes, or a local MQTT server if you have one running.

## Proposed Changes

### [Component] ESP32 Firmware

#### [MODIFY] [main.cpp](file:///d:/~PES%20-%20S4/MPCA/MPCA_Project/MPCA_Project/firmware/src/main.cpp)
*   **Synchronize Broker**: Change the MQTT server to match the backend.
*   **Immediate Scan Feedback**: Add a 50ms `tone()` call immediately after a successful RFID read. This provides instant hardware confirmation even before the backend responds.
*   **Status Indication**: Verify that `indicateStatus()` is correctly processing the backend's response.

---

### [Component] Backend Server

#### [MODIFY] [mqtt-handler.js](file:///d:/~PES%20-%20S4/MPCA/MPCA_Project/MPCA_Project/server/mqtt-handler.js)
*   **Synchronize Broker**: Update the connection string to match the ESP32's broker.
*   **Logging**: Enhance logging to show when a scan is received vs. when it's ignored due to a database miss.

---

### [Component] Database

#### [VERIFY] [parking.db](file:///d:/~PES%20-%20S4/MPCA/MPCA_Project/MPCA_Project/server/parking.db)
*   Ensure the UID being scanned exists in the `users` table with `is_active = 1`.

## List of Pending Parts

Based on the codebase analysis, here are the parts that appear to be pending or need attention:

1.  **Frontend/Admin UI**: While the backend exists, there is no clear evidence of a web interface to manage users (add/edit tags and balances).
2.  **User Enrollment Flow**: A way to "register" a new tag directly from the scanner (currently, tags must be pre-populated in the database).
3.  **Balance Management**: The logic for fee calculation and balance tracking is present in docs but needs verification in the actual `parking.service.js` (if it exists).
4.  **Error Handling for "Broker Down"**: The ESP32 should have a visual/audible cue if it's not connected to MQTT (e.g., a specific LED pattern).

## Open Questions

1.  **Which MQTT Broker should I use?** Should I use the public `test.mosquitto.org` for both, or do you have a local broker running at `192.168.4.2`?
2.  **What is the UID of the tag you are using?** I can help you add it to the database so the backend recognizes it.

## Verification Plan

### Automated Tests
*   Run the backend server and use a tool (like `mosquitto_pub`) to simulate an RFID scan to see if the backend responds.
*   Check the ESP32 Serial Monitor to see if it's successfully publishing to the broker.

### Manual Verification
*   **Startup Check**: Confirm the ESP32 makes two beeps on reset (logic already exists).
*   **Scan Check**: Tap the tag and listen for the *new* immediate feedback beep.
*   **Backend Check**: Verify the terminal logs on the server show "📨 [rfid/in] ..." followed by "📤 [access/response] ...".
