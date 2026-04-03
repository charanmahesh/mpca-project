#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <Adafruit_NeoPixel.h>

// OLED Setup
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// SPI and RFID Pins
#define RFID1_CS 5
#define RFID2_CS 4
#define SCK_PIN 14
#define MISO_PIN 12
#define MOSI_PIN 13

// Pin setup
#define POT_PIN      34   
#define BUZZER_PIN   26   
#define NEOPIXEL_PIN 27   
#define NUM_PIXELS    8   
Adafruit_NeoPixel pixel(NUM_PIXELS, NEOPIXEL_PIN, NEO_GRB + NEO_KHZ800);

// RFID Instances
MFRC522 rfid1(RFID1_CS, 0);
MFRC522 rfid2(RFID2_CS, 0);

// WiFi Credentials
const char *ssid = "arya";
const char *password = "arya2606";

// MQTT Broker
const char *mqttServer = "test.mosquitto.org";
const int mqttPort = 1883;
WiFiClient espClient;
PubSubClient client(espClient);

// Timing Variables for Non-Blocking Delays
unsigned long lastMqttAttempt = 0;
unsigned long lastRfid1Scan = 0;
unsigned long lastRfid2Scan = 0;
const unsigned long SCAN_COOLDOWN = 1500;

// Function Prototypes
void setupWiFiAP();
void connectToMQTT();
void mqtt_callback(char *topic, byte *payload, unsigned int length);
void getTagID(MFRC522 *rfid, char *tagID);
void showDisplay(const char* prefix, const char* message);
void indicateStatus(bool granted);
int getLocationFromPot();
void scanI2C(); // Added missing prototype!

void setup() {
  Serial.begin(115200);
  delay(1000); 
  Serial.println("\n\nStarting setup...");
  
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN);
  Wire.begin();  
  delay(500);

  Serial.println("Initializing OLED display...");
  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("SSD1306 allocation failed"));
    scanI2C();
    while (true) { delay(100); } // Prevent CPU hogging on crash
  }
  
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(WHITE);
  display.setCursor(0, 0);
  display.println("Initializing...");
  display.display();

  pinMode(RFID1_CS, OUTPUT);
  pinMode(RFID2_CS, OUTPUT);
  digitalWrite(RFID1_CS, HIGH);
  digitalWrite(RFID2_CS, HIGH);
  rfid1.PCD_Init();
  rfid2.PCD_Init();

  pinMode(POT_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pixel.begin();
  pixel.clear();
  pixel.show();

  setupWiFiAP();
  client.setServer(mqttServer, mqttPort);
  client.setCallback(mqtt_callback);

  display.clearDisplay();
  display.setCursor(0,0);
  display.println("System Ready");
  display.display();

  // At the end of setup(), after display init
  tone(BUZZER_PIN, 1000, 300);
  delay(400);
  tone(BUZZER_PIN, 1500, 300);
  delay(400);
}

void loop() {
  // 1. Handle MQTT Reconnection with a 5-second delay to prevent spam
  if (!client.connected()) {
    if (millis() - lastMqttAttempt > 5000) {
      lastMqttAttempt = millis();
      connectToMQTT();
    }
  } else {
    client.loop(); // Process incoming messages
  }

  // 2. Scan RFID 1 (IN)
  if (millis() - lastRfid1Scan > SCAN_COOLDOWN) {
    digitalWrite(RFID1_CS, LOW);
    if (rfid1.PICC_IsNewCardPresent() && rfid1.PICC_ReadCardSerial()) {
      char tag[32];
      getTagID(&rfid1, tag);
      if (strlen(tag) > 0) {
        tone(BUZZER_PIN, 2000, 50); // Local beep for scan confirmation
        int location = getLocationFromPot();
        char payload[64];
        snprintf(payload, sizeof(payload), "%s,%d", tag, location);
        client.publish("rfid/in", payload);
        
        char displayMsg[48];
        snprintf(displayMsg, sizeof(displayMsg), "%s @L%d", tag, location);
        showDisplay("IN", displayMsg);
        Serial.printf("IN Tag: %s Location: %d\n", tag, location);
        lastRfid1Scan = millis();
      }
      rfid1.PICC_HaltA();
    }
    digitalWrite(RFID1_CS, HIGH);
  }

  // 3. Scan RFID 2 (OUT)
  if (millis() - lastRfid2Scan > SCAN_COOLDOWN) {
    digitalWrite(RFID2_CS, LOW);
    if (rfid2.PICC_IsNewCardPresent() && rfid2.PICC_ReadCardSerial()) {
      char tag[32];
      getTagID(&rfid2, tag);
      if (strlen(tag) > 0) {
        tone(BUZZER_PIN, 2000, 50); // Local beep for scan confirmation
        int location = getLocationFromPot();
        char payload[64];
        snprintf(payload, sizeof(payload), "%s,%d", tag, location);
        client.publish("rfid/out", payload);
        
        char displayMsg[48];
        snprintf(displayMsg, sizeof(displayMsg), "%s @L%d", tag, location);
        showDisplay("OUT", displayMsg);
        Serial.printf("OUT Tag: %s Location: %d\n", tag, location);
        lastRfid2Scan = millis();
      }
      rfid2.PICC_HaltA();
    }
    digitalWrite(RFID2_CS, HIGH);
  }
}

void scanI2C() {
  Serial.println("Scanning I2C devices...");
  byte error, address;
  int nDevices = 0;
  for (address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    error = Wire.endTransmission();
    if (error == 0) {
      Serial.printf("I2C device found at address 0x%02X\n", address);
      nDevices++;
    }
  }
  if (nDevices == 0) Serial.println("No I2C devices found!");
}

void setupWiFiAP() {
  // ... (Your original WiFi code remains unchanged)
  Serial.println("Connecting to WiFi...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
  } else {
    Serial.println("\nFailed to connect to WiFi");
  }
}

void connectToMQTT() {
  Serial.println("Connecting to MQTT...");
  if (client.connect("ESP32Client_Parking")) {
    Serial.println("Connected to MQTT broker");
    client.subscribe("access/response");
  } else {
    Serial.print("Failed. rc=");
    Serial.println(client.state());
  }
}

void mqtt_callback(char *topic, byte *payload, unsigned int length) {
  char message[100];
  memset(message, 0, sizeof(message));
  memcpy(message, payload, length);
  message[length] = '\0';

  if (strcmp(topic, "access/response") == 0) {
    char *uid = strtok(message, ",");
    char *status = strtok(NULL, ",");
    char *name = strtok(NULL, ",");
    char *spot = strtok(NULL, ",");

    if (uid && status && name) {
      bool allowed = (strcmp(status, "ALLOWED") == 0);
      indicateStatus(allowed);

      char displayMsg[100];
      if (allowed) {
        if (spot && strlen(spot) > 0 && strcmp(spot, "-") != 0) {
          snprintf(displayMsg, sizeof(displayMsg), "\nALLOWED\n%s -> %s", name, spot);
        } else {
          snprintf(displayMsg, sizeof(displayMsg), "\nALLOWED\nWelcome %s", name);
        }
        showDisplay("OK", displayMsg);
      } else {
        snprintf(displayMsg, sizeof(displayMsg), "\nDENIED\nAccess Denied %s", name);
        showDisplay("X", displayMsg);
      }
    }
  }
}

void getTagID(MFRC522 *rfid, char *tagID) {
  tagID[0] = '\0';
  if (rfid->uid.size > 0) {
    for (byte i = 0; i < rfid->uid.size; i++) {
      char byteStr[3];
      snprintf(byteStr, sizeof(byteStr), "%02X", rfid->uid.uidByte[i]);
      strncat(tagID, byteStr, 2);
    }
  }
}

void showDisplay(const char* prefix, const char* message) {
  display.clearDisplay();
  display.setCursor(0, 20);
  display.print("UID ");
  display.print(prefix);
  display.print(": ");
  display.println(message);
  display.display();
}

int getLocationFromPot() {
  int analogVal = analogRead(POT_PIN);
  int location = map(analogVal, 0, 4095, 1, 5);
  if (location < 1) location = 1;
  if (location > 5) location = 5;
  return location;
}

void indicateStatus(bool granted) {
  uint32_t color = granted ? pixel.Color(0, 255, 0) : pixel.Color(255, 0, 0);
  for (int i = 0; i < pixel.numPixels(); i++) {
    pixel.setPixelColor(i, color);
  }
  pixel.show();
  tone(BUZZER_PIN, granted ? 1000 : 200, granted ? 200 : 1000);
  delay(500);
  pixel.clear();
  pixel.show();
}