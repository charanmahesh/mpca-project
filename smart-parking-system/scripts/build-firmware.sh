#!/bin/bash
# Build and manage firmware

set -e

FIRMWARE_DIR="firmware"
BUILD_DIR="$FIRMWARE_DIR/.pio/build"

echo "=========================================="
echo "Smart Parking - Firmware Build Manager"
echo "=========================================="

case "${1:-build}" in
  build)
    echo "📦 Compiling firmware for ESP32..."
    cd "$FIRMWARE_DIR"
    platformio run -e esp32dev
    cd ..
    echo "✅ Build successful!"
    echo "   Upload: npm run firmware:upload"
    ;;

  upload)
    echo "📶 Uploading firmware to ESP32..."
    cd "$FIRMWARE_DIR"
    platformio run -t upload -e esp32dev
    cd ..
    echo "✅ Upload complete!"
    echo "   Monitor: npm run firmware:monitor"
    ;;

  monitor)
    echo "📊 Monitoring serial output..."
    cd "$FIRMWARE_DIR"
    platformio device monitor --baud 115200
    cd ..
    ;;

  build-upload)
    echo "🔄 Full cycle: build → upload → monitor"
    npm run firmware:build
    npm run firmware:upload
    sleep 2
    npm run firmware:monitor
    ;;

  clean)
    echo "🧹 Cleaning build artifacts..."
    cd "$FIRMWARE_DIR"
    platformio run --target clean
    cd ..
    echo "✅ Clean complete!"
    ;;

  info)
    echo "ℹ️  Device Info:"
    cd "$FIRMWARE_DIR"
    platformio device list
    cd ..
    ;;

  *)
    echo "Usage: $0 {build|upload|monitor|build-upload|clean|info}"
    echo ""
    echo "Commands:"
    echo "  build        - Compile firmware (creates .pio/build)"
    echo "  upload       - Flash to ESP32 (requires device)"
    echo "  monitor      - Serial monitor (115200 baud)"
    echo "  build-upload - Full cycle: build → upload → monitor"
    echo "  clean        - Remove build artifacts"
    echo "  info         - List connected devices"
    ;;
esac
