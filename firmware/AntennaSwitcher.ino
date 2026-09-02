/*
  AntennaSwitcher — single-file ESP32 firmware
  Board: ESP32-WROOM-32E 4-ch AC/DC relay (ASIN B0DCZ549VQ / ESP32_Relay_4)
  RF:    AT-14 1x4 coax switch 1.8–60 MHz 500W PEP (ASIN B0DY7K5KSN)

  Invariants:
    1. TX is connected to exactly one antenna port at rest.
    2. Changeover is break-before-make (all coils open, then one closes).
    3. Any error, panic, watchdog, or shutdown parks TX on port 1 (dummy load).

  Arduino IDE: ESP32 Dev Module, 4 MB flash. Libraries: none beyond the core.

  Optional DC sense: 100 kΩ from the 7–30 V terminal to GPIO34, 10 kΩ + 100 nF
  from GPIO34 to GND. Without it, DC supply shows "—" (die temp and RSSI still work).
*/

#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <ESPmDNS.h>
#include <esp_system.h>
#include <esp_task_wdt.h>

#ifndef WIFI_SSID
#define WIFI_SSID "YOUR_SSID"
#endif
#ifndef WIFI_PASS
#define WIFI_PASS "YOUR_PASSWORD"
#endif

static const uint8_t RELAY_PINS[4] = {32, 33, 25, 26};
static const bool RELAY_ACTIVE_HIGH = true;
static const uint8_t FAILSAFE_PORT = 1;
static const uint32_t BREAK_BEFORE_MAKE_MS = 80;
static const uint32_t WDT_TIMEOUT_S = 8;
static const int VIN_ADC_PIN = 34;
static const float VIN_DIVIDER = 11.0f; /* (100k + 10k) / 10k from 7–30 V terminal */
static const float VIN_PRESENT_MIN = 4.0f;

WebServer server(80);
Preferences prefs;

String portNames[4] = {"Dummy Load", "Antenna 2", "Antenna 3", "Antenna 4"};
String theme = "system";
uint8_t activePort = FAILSAFE_PORT;
bool switching = false;
uint32_t selectCount[4] = {0, 0, 0, 0};
uint32_t totalSelectedMs[4] = {0, 0, 0, 0};
uint32_t lastSelectedAt[4] = {0, 0, 0, 0};
uint32_t operationCount = 0;
uint32_t errorCount = 0;
String lastError = "none";
uint32_t bootMs = 0;
uint32_t lastTickMs = 0;
float vinVoltsCached = NAN;
float tempCCached = NAN;
uint32_t lastSenseMs = 0;

float readVinVolts() {
  uint32_t acc = 0;
  uint32_t mn = 5000;
  uint32_t mx = 0;
  for (int i = 0; i < 16; i++) {
    uint32_t mv = analogReadMilliVolts(VIN_ADC_PIN);
    acc += mv;
    if (mv < mn) mn = mv;
    if (mv > mx) mx = mv;
    delayMicroseconds(200);
  }
  if (mx > mn && (mx - mn) > 400) return NAN; /* floating GPIO34 */
  float vin = (acc / 16.0f / 1000.0f) * VIN_DIVIDER;
  if (vin < VIN_PRESENT_MIN) return NAN;
  return vin;
}

void sampleBoard() {
  uint32_t now = millis();
  if (now - lastSenseMs < 400 && lastSenseMs != 0) return;
  lastSenseMs = now;
  vinVoltsCached = readVinVolts();
  tempCCached = temperatureRead();
}

void setRelay(uint8_t index, bool on) {
  uint8_t level = RELAY_ACTIVE_HIGH ? (on ? HIGH : LOW) : (on ? LOW : HIGH);
  digitalWrite(RELAY_PINS[index], level);
}

void deenergizeAll() {
  for (uint8_t i = 0; i < 4; i++) setRelay(i, false);
}

void accumulateTime() {
  uint32_t now = millis();
  uint32_t delta = now - lastTickMs;
  if (delta && activePort >= 1 && activePort <= 4 && !switching) {
    totalSelectedMs[activePort - 1] += delta;
  }
  lastTickMs = now;
}

void applyPort(uint8_t port) {
  deenergizeAll();
  setRelay(port - 1, true);
  activePort = port;
  lastSelectedAt[port - 1] = millis();
}

void failsafe(const char *reason) {
  errorCount++;
  lastError = reason;
  switching = false;
  deenergizeAll();
  delay(BREAK_BEFORE_MAKE_MS);
  applyPort(FAILSAFE_PORT);
  selectCount[FAILSAFE_PORT - 1]++;
}

void IRAM_ATTR shutdownHook() {
  for (uint8_t i = 0; i < 4; i++) {
    uint8_t on = (i == 0);
    uint8_t level = RELAY_ACTIVE_HIGH ? (on ? HIGH : LOW) : (on ? LOW : HIGH);
    digitalWrite(RELAY_PINS[i], level);
  }
}

bool selectPort(uint8_t port, const char *why) {
  if (port < 1 || port > 4) {
    failsafe("invalid port");
    return false;
  }
  if (switching) {
    failsafe("reentrant select");
    return false;
  }
  if (port == activePort) return true;

  switching = true;
  accumulateTime();
  deenergizeAll();
  delay(BREAK_BEFORE_MAKE_MS);
  applyPort(port);
  selectCount[port - 1]++;
  operationCount++;
  switching = false;
  lastError = "none";
  (void)why;
  return true;
}

String jsonEscape(const String &in) {
  String out;
  out.reserve(in.length() + 4);
  for (size_t i = 0; i < in.length(); i++) {
    char c = in[i];
    if (c == '"' || c == '\\') {
      out += '\\';
      out += c;
    } else if (c == '\n') {
      out += "\\n";
    } else {
      out += c;
    }
  }
  return out;
}

String stateJson() {
  accumulateTime();
  sampleBoard();
  String json = "{";
  json += "\"activePort\":" + String(activePort) + ",";
  json += "\"switching\":";
  json += switching ? "true," : "false,";
  json += "\"operationCount\":" + String(operationCount) + ",";
  json += "\"errorCount\":" + String(errorCount) + ",";
  json += "\"lastError\":\"" + jsonEscape(lastError) + "\",";
  json += "\"uptimeMs\":" + String(millis() - bootMs) + ",";
  json += "\"theme\":\"" + jsonEscape(theme) + "\",";
  json += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  json += "\"heap\":" + String(ESP.getFreeHeap()) + ",";
  json += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
  if (isnan(vinVoltsCached)) json += "\"vinVolts\":null,";
  else json += "\"vinVolts\":" + String(vinVoltsCached, 2) + ",";
  if (isnan(tempCCached)) json += "\"tempC\":null,";
  else json += "\"tempC\":" + String(tempCCached, 1) + ",";
  json += "\"ports\":[";
  for (uint8_t i = 0; i < 4; i++) {
    if (i) json += ",";
    json += "{";
    json += "\"id\":" + String(i + 1) + ",";
    json += "\"name\":\"" + jsonEscape(portNames[i]) + "\",";
    json += "\"gpio\":" + String(RELAY_PINS[i]) + ",";
    json += "\"relay\":" + String(i + 1) + ",";
    json += "\"isDummyLoad\":";
    json += (i == 0) ? "true," : "false,";
    json += "\"selectCount\":" + String(selectCount[i]) + ",";
    json += "\"totalSelectedMs\":" + String(totalSelectedMs[i]) + ",";
    json += "\"lastSelectedAt\":" + String(lastSelectedAt[i]);
    json += "}";
  }
  json += "]}";
  return json;
}

void sendCors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

const char INDEX_HTML[] PROGMEM = R"HTML(
<!DOCTYPE html>
<html lang="en" data-theme="system">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>AntennaSwitcher</title>
<style>
:root{--bg:#efece4;--surface:#f7f4ee;--surface2:#e5e0d6;--fg:#1c1f24;--muted:#5c6370;--accent:#0f6e5f;--accentfg:#f7f4ee;--border:rgba(28,31,36,.12);--radius:16px}
[data-theme=dark]{--bg:#0c0e12;--surface:#161a20;--surface2:#1e242c;--fg:#e8eaed;--muted:#8b939e;--accent:#3dbea0;--accentfg:#0c0e12;--border:rgba(232,234,237,.12)}
[data-theme=grey]{--bg:#3a3d42;--surface:#4a4e55;--surface2:#585d66;--fg:#f2f3f5;--muted:#c5c8ce;--accent:#d7dbe2;--accentfg:#2c2f34;--border:rgba(242,243,245,.14)}
@media (prefers-color-scheme:dark){[data-theme=system]{--bg:#0c0e12;--surface:#161a20;--surface2:#1e242c;--fg:#e8eaed;--muted:#8b939e;--accent:#3dbea0;--accentfg:#0c0e12;--border:rgba(232,234,237,.12)}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 "IBM Plex Sans",system-ui,sans-serif}
header{position:sticky;top:0;background:color-mix(in oklab,var(--bg) 90%,transparent);backdrop-filter:blur(8px);padding:16px 20px;border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
h1{margin:0;font-size:1.15rem;letter-spacing:-.02em}
.kicker{font:11px/1.3 ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.themes{display:flex;background:var(--surface2);padding:4px;border-radius:10px}
.themes button{border:0;background:transparent;color:var(--muted);min-width:44px;min-height:36px;border-radius:8px}
.themes button[aria-checked=true]{background:var(--surface);color:var(--fg)}
main{max-width:980px;margin:0 auto;padding:20px;display:grid;gap:16px}
.path,.card,.panel{background:var(--surface);border-radius:var(--radius);box-shadow:0 0 0 1px var(--border);padding:16px}
.grid{display:grid;gap:12px}
@media(min-width:640px){.grid{grid-template-columns:1fr 1fr}}
.port h2{margin:4px 0 12px;font-size:1.1rem}
.port .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font:12px/1.3 ui-monospace,monospace;color:var(--muted)}
.port .meta b{display:block;color:var(--fg);font-weight:500}
input[type=text]{width:100%;border:0;background:var(--surface2);color:var(--fg);border-radius:8px;padding:8px 10px;font:inherit}
button.select,button.ghost{width:100%;min-height:44px;border:0;border-radius:12px;font:500 14px/1 system-ui;margin-top:12px}
button.select{background:var(--surface2);color:var(--fg)}
button.select[data-on=true]{background:var(--accent);color:var(--accentfg)}
button.ghost{background:var(--surface2)}
.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
@media(min-width:640px){.stats{grid-template-columns:repeat(4,1fr)}}
.metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:10px}
@media(min-width:640px){.metrics{grid-template-columns:repeat(4,1fr)}}
.metrics b{display:block;font:500 22px/1.2 ui-monospace,monospace}
.metrics .hint{color:var(--muted);font-size:12px}
.warn{color:#9b3b3b}
.chip{display:inline-flex;align-items:center;min-height:36px;padding:0 10px;border-radius:8px;background:var(--surface2)}
.live{background:var(--accent);color:var(--accentfg)}
button{cursor:pointer}
button:active{transform:scale(.96)}
</style>
</head>
<body>
<header>
  <div>
    <div class="kicker">HF · 1.8–60 MHz · 500 W PEP</div>
    <h1>AntennaSwitcher</h1>
  </div>
  <div class="themes" role="radiogroup" aria-label="Color theme">
    <button data-theme-id="system" aria-label="System">Sys</button>
    <button data-theme-id="light" aria-label="Light">Lt</button>
    <button data-theme-id="dark" aria-label="Dark">Dk</button>
    <button data-theme-id="grey" aria-label="Grey">Gy</button>
  </div>
</header>
<main>
  <section class="path" id="path"></section>
  <section class="card" id="board"></section>
  <section class="grid" id="ports"></section>
  <section class="panel">
    <div class="kicker">Console stats</div>
    <div class="stats" id="stats"></div>
    <p style="color:var(--muted);font-size:14px">TX is connected to exactly one port. Faults return the path to port 1, the 50 Ω dummy load.</p>
  </section>
</main>
<script>
const $ = (id) => document.getElementById(id);
let state = null;
function fmt(ms){
  const s = Math.floor(ms/1000);
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  if(h) return h+'h '+m+'m';
  if(m) return m+'m '+sec+'s';
  return sec+'s';
}
function applyTheme(id){
  document.documentElement.dataset.theme = id;
  document.querySelectorAll('[data-theme-id]').forEach(b=>{
    b.setAttribute('aria-checked', b.dataset.themeId===id ? 'true':'false');
  });
}
function render(){
  if(!state) return;
  applyTheme(state.theme);
  const active = state.ports.find(p=>p.id===state.activePort);
  $('path').innerHTML = '<div class="kicker">RF path · TX to one port only</div>'+
    '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">'+
    '<span class="chip">Radio</span><span class="chip">TX</span>'+
    '<span class="chip live">'+(state.switching?'OPEN':(active?('P'+active.id+' - '+active.name):'OPEN'))+'</span></div>';
  const vin = state.vinVolts;
  const vinTxt = (vin==null||!(vin>=0))?'—':vin.toFixed(1)+' V';
  const vinHint = (vin==null||!(vin>=0))?'Fit 100 kΩ / 10 kΩ on GPIO34':(vin<11?'low':(vin>16?'high':'GPIO34 divider'));
  const vinWarn = (vin!=null && (vin<11 || vin>16))?' warn':'';
  const temp = state.tempC;
  const tempTxt = (temp==null||!(temp===temp))?'—':Math.round(temp)+' °C';
  const tempF = (temp==null||!(temp===temp))?'—':Math.round(temp*9/5+32)+' °F';
  const rssi = state.rssi;
  const rssiTxt = (rssi==null)?'—':rssi+' dBm';
  const heap = state.heap==null?'—':Math.round(state.heap/1024)+' kB';
  $('board').innerHTML = '<div class="kicker">Board · '+(state.ip||'ESP32')+'</div>'+
    '<div class="metrics">'+
    '<div>DC supply<b class="'+vinWarn+'" id="vin">'+vinTxt+'</b><div class="hint'+vinWarn+'">'+vinHint+'</div></div>'+
    '<div>Die temp<b>'+tempTxt+'</b><div class="hint">'+tempF+'</div></div>'+
    '<div>WiFi<b>'+rssiTxt+'</b><div class="hint">RSSI</div></div>'+
    '<div>Free heap<b>'+heap+'</b><div class="hint">SRAM</div></div></div>';
  $('ports').innerHTML = state.ports.map(p=>{
    const on = !state.switching && p.id===state.activePort;
    return `<article class="card port" data-selected="${on}">
      <div class="kicker">Port ${p.id}${p.isDummyLoad?' · Dummy':''}</div>
      <h2>${p.name}</h2>
      <form data-rename="${p.id}">
        <input type="text" maxlength="32" value="${p.name.replace(/"/g,'')}" aria-label="Name for port ${p.id}"/>
      </form>
      <div class="meta">
        <div>GPIO<b>${p.gpio}</b></div>
        <div>Selects<b>${p.selectCount}</b></div>
        <div>On time<b>${fmt(p.totalSelectedMs)}</b></div>
      </div>
      <button class="select" data-on="${on}" data-select="${p.id}" ${on||state.switching?'disabled':''}>${on?'Selected':(state.switching?'Switching':'Select')}</button>
    </article>`;
  }).join('');
  $('stats').innerHTML =
    `<div>Uptime<b style="display:block;font:500 14px/1.4 ui-monospace,monospace">${fmt(state.uptimeMs)}</b></div>
     <div>Operations<b style="display:block;font:500 14px/1.4 ui-monospace,monospace">${state.operationCount}</b></div>
     <div>Errors<b style="display:block;font:500 14px/1.4 ui-monospace,monospace">${state.errorCount}</b></div>
     <div>Last error<b style="display:block;font:500 14px/1.4 ui-monospace,monospace">${state.lastError}</b></div>`;
}
async function refresh(){
  try{
    const r = await fetch('/api/state');
    state = await r.json();
    render();
  }catch(e){}
}
document.addEventListener('click', async (e)=>{
  const t = e.target;
  if(t.dataset.themeId){
    await fetch('/api/theme',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({theme:t.dataset.themeId})});
    refresh();
  }
  if(t.dataset.select){
    await fetch('/api/select',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({port:Number(t.dataset.select)})});
    refresh();
  }
});
document.addEventListener('submit', async (e)=>{
  const form = e.target;
  if(!form.dataset.rename) return;
  e.preventDefault();
  const name = form.querySelector('input').value;
  await fetch('/api/rename',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({port:Number(form.dataset.rename),name})});
  refresh();
});
refresh();
setInterval(refresh,1000);
</script>
</body>
</html>
)HTML";

int parseJsonInt(const String &body, const char *key, int fallback) {
  String needle = String("\"") + key + "\":";
  int i = body.indexOf(needle);
  if (i < 0) return fallback;
  return body.substring(i + needle.length()).toInt();
}

String parseJsonString(const String &body, const char *key) {
  String needle = String("\"") + key + "\":\"";
  int i = body.indexOf(needle);
  if (i < 0) return "";
  int start = i + needle.length();
  int end = body.indexOf("\"", start);
  if (end < 0) return "";
  return body.substring(start, end);
}

void handleRoot() {
  server.send_P(200, "text/html", INDEX_HTML);
}

void handleState() {
  sendCors();
  server.send(200, "application/json", stateJson());
}

void handleSelect() {
  sendCors();
  int port = parseJsonInt(server.arg("plain"), "port", -1);
  bool ok = selectPort((uint8_t)port, "http");
  server.send(ok ? 200 : 400, "application/json", stateJson());
}

void handleRename() {
  sendCors();
  int port = parseJsonInt(server.arg("plain"), "port", -1);
  String name = parseJsonString(server.arg("plain"), "name");
  name.trim();
  if (port < 1 || port > 4 || name.length() == 0) {
    failsafe("rename rejected");
    server.send(400, "application/json", stateJson());
    return;
  }
  if (name.length() > 32) name = name.substring(0, 32);
  portNames[port - 1] = name;
  prefs.putString(("n" + String(port)).c_str(), name);
  server.send(200, "application/json", stateJson());
}

void handleTheme() {
  sendCors();
  String t = parseJsonString(server.arg("plain"), "theme");
  if (t == "system" || t == "light" || t == "dark" || t == "grey") {
    theme = t;
    prefs.putString("theme", t);
  }
  server.send(200, "application/json", stateJson());
}

void handleFault() {
  sendCors();
  failsafe("http fault");
  server.send(200, "application/json", stateJson());
}

void handleOptions() {
  sendCors();
  server.send(204);
}

void setup() {
  Serial.begin(115200);
  bootMs = millis();
  lastTickMs = bootMs;

  for (uint8_t i = 0; i < 4; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    setRelay(i, false);
  }
  analogReadResolution(12);
  analogSetPinAttenuation(VIN_ADC_PIN, ADC_11db);
  pinMode(VIN_ADC_PIN, INPUT);
  sampleBoard();
  applyPort(FAILSAFE_PORT);
  selectCount[FAILSAFE_PORT - 1] = 1;
  lastSelectedAt[FAILSAFE_PORT - 1] = millis();

  esp_register_shutdown_handler(shutdownHook);
  esp_task_wdt_init(WDT_TIMEOUT_S, true);
  esp_task_wdt_add(NULL);

  prefs.begin("antsw", false);
  for (uint8_t i = 0; i < 4; i++) {
    String saved = prefs.getString(("n" + String(i + 1)).c_str(), portNames[i]);
    if (saved.length()) portNames[i] = saved;
  }
  theme = prefs.getString("theme", "system");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(250);
    Serial.print('.');
    esp_task_wdt_reset();
  }
  Serial.println();
  Serial.print("IP ");
  Serial.println(WiFi.localIP());
  MDNS.begin("antennaswitcher");

  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/state", HTTP_GET, handleState);
  server.on("/api/select", HTTP_POST, handleSelect);
  server.on("/api/rename", HTTP_POST, handleRename);
  server.on("/api/theme", HTTP_POST, handleTheme);
  server.on("/api/fault", HTTP_POST, handleFault);
  server.on("/api/select", HTTP_OPTIONS, handleOptions);
  server.on("/api/rename", HTTP_OPTIONS, handleOptions);
  server.on("/api/theme", HTTP_OPTIONS, handleOptions);
  server.begin();
}

void loop() {
  esp_task_wdt_reset();
  accumulateTime();
  sampleBoard();
  server.handleClient();
  if (WiFi.status() != WL_CONNECTED) {
    static uint32_t lastAttempt = 0;
    if (millis() - lastAttempt > 5000) {
      lastAttempt = millis();
      WiFi.reconnect();
    }
  }
}

