#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

// WiFi credentials
const char* ssid     = "My Project";
const char* password = "00000000";

// Pins and state
const int RELAY_PIN = D5;
const int BUTTON_PIN = D6; // Manual override push button

bool pumpState = false;        
unsigned long pumpStartTime = 0;
const unsigned long AUTO_OFF_MS = 30000; 
  
// CORRECTED Button debounce variables
int buttonState = HIGH;             // Current debounced state
int lastButtonState = HIGH;         // Previous flicker state
unsigned long lastDebounceTime = 0; 
const unsigned long debounceDelay = 50;

ESP8266WebServer server(80);

// HTML for the control page
String buildPage() {
  String state    = pumpState ? "ON" : "OFF";
  String btnColor = pumpState ? "#5C3D1E" : "#8B5E3C";
  String action   = pumpState ? "/off" : "/on";
  String btnText  = pumpState ? "TURN OFF" : "TURN ON";

  String html = "<!DOCTYPE html><html><head>";
  html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<meta http-equiv='refresh' content='5'>";
  html += "<title>Solar Panel Cleaner</title>";
  html += "<style>";
  html += "  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Lato:wght@400;700&display=swap');";
  html += "  * { margin:0; padding:0; box-sizing:border-box; }";
  html += "  body { background:#2C1A0E; font-family:'Lato',sans-serif; min-height:100vh;";
  html += "         display:flex; flex-direction:column; align-items:center;";
  html += "         justify-content:center; padding:24px; }";
  html += "  .card { background:#3D2410; border-radius:16px; padding:36px 28px;";
  html += "          max-width:380px; width:100%; box-shadow:0 8px 32px rgba(0,0,0,0.5);";
  html += "          border:1px solid #5C3D1E; }";
  html += "  h1 { font-family:'Playfair Display',serif; color:#D4A96A; font-size:24px;";
  html += "       text-align:center; margin-bottom:6px; letter-spacing:0.5px; }";
  html += "  .subtitle { color:#A07848; font-size:13px; text-align:center;";
  html += "              margin-bottom:28px; font-weight:700; letter-spacing:1px;";
  html += "              text-transform:uppercase; }";
  html += "  .status-box { background:#2C1A0E; border-radius:10px; padding:16px;";
  html += "                text-align:center; margin-bottom:24px;";
  html += "                border:1px solid #5C3D1E; }";
  html += "  .status-label { color:#A07848; font-size:11px; font-weight:700;";
  html += "                  letter-spacing:2px; text-transform:uppercase; margin-bottom:6px; }";
  html += "  .status-value { font-family:'Playfair Display',serif; font-size:36px;";
  html += "                  font-weight:700; color:";
  html += pumpState ? "#D4A96A;" : "#8B5E3C;";
  html += "                  }";
  html += "  .btn { display:block; width:100%; padding:18px; border:none;";
  html += "         border-radius:10px; font-family:'Lato',sans-serif;";
  html += "         font-size:16px; font-weight:700; letter-spacing:2px;";
  html += "         text-transform:uppercase; cursor:pointer;";
  html += "         text-decoration:none; text-align:center;";
  html += "         background:" + btnColor + ";";
  html += "         color:#D4A96A; border:2px solid #D4A96A;";
  html += "         margin-bottom:12px; transition:opacity 0.2s; }";
  html += "  .btn:hover { opacity:0.85; }";
  html += "  .btn-off { background:#1A0E06; color:#8B5E3C; border-color:#5C3D1E; }";
  html += "  .timer { color:#A07848; font-size:12px; text-align:center;";
  html += "           font-weight:700; letter-spacing:1px; margin-top:8px; }";
  html += "  .dot { display:inline-block; width:8px; height:8px; border-radius:50%;";
  html += "         margin-right:6px; background:";
  html += pumpState ? "#D4A96A;" : "#5C3D1E;";
  html += "          }";
  html += "</style></head><body>";
  html += "<div class='card'>";
  html += "  <h1>Solar Panel Cleaner</h1>";
  html += "  <div class='subtitle'>IoT Control System</div>";
  html += "  <div class='status-box'>";
  html += "    <div class='status-label'><span class='dot'></span>Pump Status</div>";
  html += "    <div class='status-value'>" + state + "</div>";
  html += "  </div>";
  html += "  <a href='" + action + "' class='btn'>" + btnText + "</a>";
  if (pumpState) {
    unsigned long elapsed = (millis() - pumpStartTime) / 1000;
    unsigned long remaining = (AUTO_OFF_MS / 1000) - elapsed;
    html += "  <a href='/off' class='btn btn-off'>STOP PUMP</a>";
    html += "  <div class='timer'>Auto-off in " + String(remaining) + "s</div>";
  }
  html += "</div></body></html>";
  return html;
}

void setPumpState(bool turnOn) {
  if (turnOn) {
    // Turn ON: Connect the pin and pull it LOW
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW);
  } else {
    // Turn OFF: Disconnect the pin (High Impedance) to kill the ghost voltage
    pinMode(RELAY_PIN, INPUT);
  }
}

// Route handlers
void handleRoot() {
  server.send(200, "text/html", buildPage());
}

void handleOn() {
  pumpState = true;
  pumpStartTime = millis();
  setPumpState(true);
  server.sendHeader("Location", "/");
  server.send(303);               
}

void handleOff() {
  pumpState = false;
  setPumpState(false);  
  server.sendHeader("Location", "/");
  server.send(303);
}

void setup() {
  Serial.begin(115200);
  delay(2000); 
  
  // Ensure pump is OFF on startup using the new trick
  setPumpState(false);  

  // Manual push button with internal pullup
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  // Clear Wi-Fi cache
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);

  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nConnected!");
  Serial.print("Open this address on your phone: http://");
  Serial.println(WiFi.localIP());

  server.on("/",    handleRoot);
  server.on("/on",  handleOn);
  server.on("/off", handleOff);
  server.begin();
}

void loop() {
  server.handleClient();  

  // Auto-off check
  if (pumpState && (millis() - pumpStartTime >= AUTO_OFF_MS)) {
    pumpState = false;
    setPumpState(false); // New trick here
  }
  
  // Manual Push Button check
  int reading = digitalRead(BUTTON_PIN);
  
  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  }

  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (reading != buttonState) {
      buttonState = reading;

      if (buttonState == LOW) {
        pumpState = !pumpState; 
        
        if (pumpState) {
          setPumpState(true); // Turn ON
          pumpStartTime = millis(); 
        } else {
          setPumpState(false); // Turn OFF
        }
      }
    }
  }
  lastButtonState = reading;
}