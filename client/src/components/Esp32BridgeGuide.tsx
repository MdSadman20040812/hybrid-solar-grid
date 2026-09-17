import { useState } from 'react';
import './Esp32BridgeGuide.css';

export function Esp32BridgeGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const esp32Code = `#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// Network credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Server configuration (Change to your laptop's local IP address)
const char* serverHost = "192.168.137.1"; 
const int serverPort = 3000;
const char* serverPath = "/ws";

WebSocketsClient webSocket;
unsigned long lastTelemetryTime = 0;
const unsigned long telemetryInterval = 1000; 

// GPIO Pins for zone BJT/MOSFET switches
const int ZONE_PINS[5] = {25, 26, 27, 14, 12}; 

void sendHelloPacket() {
  JsonDocument doc;
  doc["type"] = "HELLO";
  doc["role"] = "hardware";
  doc["clientId"] = "esp32-mini-grid-01";
  doc["secret"] = ""; 
  
  String output;
  serializeJson(doc, output);
  webSocket.sendTXT(output);
}

void sendTelemetry() {
  JsonDocument doc;
  doc["type"] = "TELEMETRY";
  
  JsonObject voltages = doc.createNestedObject("voltages");
  voltages["solar"] = (analogRead(34) / 4095.0) * 18.0;
  voltages["battery"] = (analogRead(35) / 4095.0) * 15.0;
  voltages["grid"] = 12.0;
  voltages["load"] = voltages["battery"]; 
  
  JsonObject currents = doc.createNestedObject("currents");
  currents["solar"] = 0.5;
  currents["load"] = 0.3;
  
  JsonObject status = doc.createNestedObject("status");
  status["overChargeTrip"] = false;
  status["overDischargeTrip"] = false;
  status["activeSource"] = "BATTERY";
  
  JsonObject activeZones = doc.createNestedObject("zones");
  activeZones["zone1"] = digitalRead(ZONE_PINS[0]) == HIGH;
  activeZones["zone2"] = digitalRead(ZONE_PINS[1]) == HIGH;
  activeZones["zone3"] = digitalRead(ZONE_PINS[2]) == HIGH;
  activeZones["zone4"] = digitalRead(ZONE_PINS[3]) == HIGH;
  activeZones["zone5"] = digitalRead(ZONE_PINS[4]) == HIGH;
  
  String output;
  serializeJson(doc, output);
  webSocket.sendTXT(output);
}

void sendCommandAck(const char* zone, bool active, const char* commandId, const char* status) {
  JsonDocument doc;
  doc["type"] = "COMMAND_ACK";
  doc["commandId"] = commandId;
  doc["zone"] = zone;
  doc["active"] = active;
  doc["status"] = status;
  
  String output;
  serializeJson(doc, output);
  webSocket.sendTXT(output);
}

void handleWebSocketMessage(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected!");
      break;
    case WStype_CONNECTED:
      Serial.println("[WS] Connected!");
      sendHelloPacket();
      break;
    case WStype_TEXT: {
      JsonDocument doc;
      deserializeJson(doc, payload);
      const char* event = doc["event"];
      if (event && strcmp(event, "zone_command") == 0) {
        const char* zone = doc["zone"];
        bool active = doc["active"];
        const char* commandId = doc["commandId"];
        
        int zoneIndex = -1;
        if (strcmp(zone, "zone1") == 0) zoneIndex = 0;
        else if (strcmp(zone, "zone2") == 0) zoneIndex = 1;
        else if (strcmp(zone, "zone3") == 0) zoneIndex = 2;
        else if (strcmp(zone, "zone4") == 0) zoneIndex = 3;
        else if (strcmp(zone, "zone5") == 0) zoneIndex = 4;
        
        if (zoneIndex >= 0) {
          digitalWrite(ZONE_PINS[zoneIndex], active ? HIGH : LOW);
          sendCommandAck(zone, active, commandId, "success");
        }
      }
      break;
    }
  }
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < 5; i++) {
    pinMode(ZONE_PINS[i], OUTPUT);
    digitalWrite(ZONE_PINS[i], LOW);
  }
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
  
  webSocket.begin(serverHost, serverPort, serverPath);
  webSocket.onEvent(handleWebSocketMessage);
  webSocket.setReconnectInterval(5000);
}

void loop() {
  webSocket.loop();
  if (millis() - lastTelemetryTime >= telemetryInterval) {
    lastTelemetryTime = millis();
    if (WiFi.status() == WL_CONNECTED) {
      sendTelemetry();
    }
  }
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(esp32Code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className={`esp-guide-card ${isOpen ? 'is-open' : ''}`}>
      <div className="esp-guide-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="esp-guide-title">
          <div className="pulse-icon">⚡</div>
          <div>
            <h3>ESP32 Bridge Integration Guide</h3>
            <p>Connect physical hardware components to this dashboard over WiFi</p>
          </div>
        </div>
        <button className="expand-btn">{isOpen ? 'Collapse' : 'Expand'}</button>
      </div>

      {isOpen && (
        <div className="esp-guide-content">
          <div className="guide-steps">
            <h4>How to set up:</h4>
            <ol>
              <li>
                Install <strong>WebSockets</strong> (by Markus Sattler) and <strong>ArduinoJson</strong> in Arduino IDE.
              </li>
              <li>
                Modify the <code>ssid</code>, <code>password</code>, and <code>serverHost</code> with your local WiFi details and laptop IP.
              </li>
              <li>
                Upload the code to your ESP32 board. It will automatically connect as the authoritative physical client.
              </li>
            </ol>
            <button className="copy-code-btn" onClick={copyToClipboard}>
              {copied ? '✓ Copied' : '📋 Copy C++ Template Code'}
            </button>
          </div>

          <div className="code-block-wrapper">
            <pre>
              <code>{esp32Code}</code>
            </pre>
          </div>
        </div>
      )}
    </article>
  );
}
