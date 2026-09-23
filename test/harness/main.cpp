// Test harness entry point: implements the host stubs declared in stubs/,
// compiles the real firmware sketch (firmware/AntennaSwitcher.ino) against
// them, then runs setup()/loop() like the Arduino runtime.
//
// Env knobs:
//   STUB_PORT        HTTP port (default 8087)
//   GPIO_LOG         path; every digitalWrite appended as
//                    "millis GPIO LEVEL" lines (relay state transitions)
//   ANTS_NVS_FILE    Preferences backing file (default anst_nvs.tsv in cwd)
//   STUB_RESET_REASON  esp_reset_reason override
//   STUB_WIFI_DOWN=1   WiFi never connects
//   STUB_RSSI / STUB_IP / STUB_DIE_TEMP
//   HARNESS_NO_EXIT_ON_SIGNAL=1  ignore SIGTERM (rarely useful)

#include "Arduino.h"
#include "Preferences.h"
#include "WebServer.h"
#include "esp_system.h"

#include <csignal>
#include <functional>
#include <map>
#include <string>
#include <vector>

StubPrint Serial;
ESPClass ESP;

static FILE* gpioLog() {
  static FILE* f = [] {
    const char* p = getenv("GPIO_LOG");
    return p ? fopen(p, "a") : nullptr;
  }();
  return f;
}

unsigned long millis() {
  static auto t0 = std::chrono::steady_clock::now();
  return (unsigned long)std::chrono::duration_cast<std::chrono::milliseconds>(
             std::chrono::steady_clock::now() - t0)
      .count();
}
unsigned long micros() {
  static auto t0 = std::chrono::steady_clock::now();
  return (unsigned long)std::chrono::duration_cast<std::chrono::microseconds>(
             std::chrono::steady_clock::now() - t0)
      .count();
}
void delay(unsigned long ms) {
  usleep(ms * 1000UL);
}

void pinMode(uint8_t, uint8_t) {}
void digitalWrite(uint8_t pin, uint8_t val) {
  if (FILE* f = gpioLog()) {
    fprintf(f, "%lu %u %u\n", millis(), (unsigned)pin, (unsigned)val);
    fflush(f);
  }
}
int digitalRead(uint8_t) { return LOW; }

float temperatureRead() {
  const char* t = getenv("STUB_DIE_TEMP");
  return t ? (float)atof(t) : 42.5f;
}

// ---------------------------------------------------------------- Preferences

static std::string nvsPath() {
  const char* p = getenv("ANTS_NVS_FILE");
  return p ? p : "ants_nvs.tsv";
}
static std::string b64encode(const std::string& in) {
  static const char* tbl =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string out;
  for (size_t i = 0; i < in.size(); i += 3) {
    uint32_t v = (unsigned char)in[i] << 16;
    if (i + 1 < in.size()) v |= (unsigned char)in[i + 1] << 8;
    if (i + 2 < in.size()) v |= (unsigned char)in[i + 2];
    out += tbl[(v >> 18) & 63];
    out += tbl[(v >> 12) & 63];
    out += (i + 1 < in.size()) ? tbl[(v >> 6) & 63] : '=';
    out += (i + 2 < in.size()) ? tbl[v & 63] : '=';
  }
  return out;
}
static std::string b64decode(const std::string& in) {
  auto val = [](char c) -> int {
    if (c >= 'A' && c <= 'Z') return c - 'A';
    if (c >= 'a' && c <= 'z') return c - 'a' + 26;
    if (c >= '0' && c <= '9') return c - '0' + 52;
    if (c == '+') return 62;
    if (c == '/') return 63;
    return -1;
  };
  std::string out;
  uint32_t acc = 0;
  int bits = 0;
  for (char c : in) {
    int v = val(c);
    if (v < 0) continue;
    acc = (acc << 6) | (uint32_t)v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += (char)((acc >> bits) & 0xFF);
    }
  }
  return out;
}
// store: ns -> key -> value, loaded once, written back on putString.
static std::map<std::string, std::map<std::string, std::string>>& nvsStore() {
  static std::map<std::string, std::map<std::string, std::string>> store;
  static bool loaded = false;
  if (!loaded) {
    loaded = true;
    if (FILE* f = fopen(nvsPath().c_str(), "r")) {
      char line[4096];
      while (fgets(line, sizeof line, f)) {
        std::string l(line);
        while (!l.empty() && (l.back() == '\n' || l.back() == '\r')) l.pop_back();
        size_t t1 = l.find('\t');
        size_t t2 = l.find('\t', t1 == std::string::npos ? 0 : t1 + 1);
        if (t1 == std::string::npos || t2 == std::string::npos) continue;
        store[l.substr(0, t1)][l.substr(t1 + 1, t2 - t1 - 1)] =
            b64decode(l.substr(t2 + 1));
      }
      fclose(f);
    }
  }
  return store;
}
static void nvsFlush() {
  std::string tmp = nvsPath() + ".tmp";
  FILE* f = fopen(tmp.c_str(), "w");
  if (!f) return;
  for (auto& ns : nvsStore())
    for (auto& kv : ns.second)
      fprintf(f, "%s\t%s\t%s\n", ns.first.c_str(), kv.first.c_str(),
              b64encode(kv.second).c_str());
  fclose(f);
  rename(tmp.c_str(), nvsPath().c_str());
}

bool Preferences::begin(const char* name, bool) {
  _ns = name ? name : "";
  _open = true;
  nvsStore();
  return true;
}
String Preferences::getString(const char* key, const String& def) {
  auto it = nvsStore()[_ns].find(key);
  if (it == nvsStore()[_ns].end()) return def;
  std::string v = it->second;
  return String(v.c_str());
}
bool Preferences::putString(const char* key, const String& value) {
  if (!_open) return false;
  nvsStore()[_ns][key] = value.s;
  nvsFlush();
  return true;
}

// ------------------------------------------------------------- esp_system

std::vector<void (*)()>& shutdownHandlersMutable() {
  static std::vector<void (*)()> v;
  return v;
}
const std::vector<void (*)()>& stubShutdownHandlers() {
  return shutdownHandlersMutable();
}
bool esp_register_shutdown_handler(void (*)());
stub_esp_reset_reason_t esp_reset_reason() {
  static stub_esp_reset_reason_t r = [] {
    const char* e = getenv("STUB_RESET_REASON");
    if (!e) return ESP_RST_POWERON;
    if (!strcmp(e, "brownout")) return ESP_RST_BROWNOUT;
    if (!strcmp(e, "panic")) return ESP_RST_PANIC;
    if (!strcmp(e, "task_watchdog")) return ESP_RST_TASK_WDT;
    if (!strcmp(e, "sw")) return ESP_RST_SW;
    return ESP_RST_POWERON;
  }();
  return r;
}

// ------------------------------------------------------------- WebServer

#include <cerrno>
#include <fcntl.h>
#include <map>
#include <netinet/in.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <unistd.h>

struct WebServerImpl {
  struct Route {
    std::string path;
    uint8_t method;
    std::function<void()> fn;
  };
  int listenFd = -1;
  int curFd = -1;
  int port;
  std::vector<Route> routes;
  std::vector<std::pair<std::string, std::string>> hdrs;
  std::string plain;

  static const char* statusText(int code) {
    switch (code) {
      case 200: return "OK";
      case 204: return "No Content";
      case 400: return "Bad Request";
      case 404: return "Not Found";
      case 500: return "Internal Server Error";
      default: return "Status";
    }
  }
  void writeAll(const std::string& s) {
    size_t off = 0;
    while (off < s.size()) {
      ssize_t k = ::write(curFd, s.data() + off, s.size() - off);
      if (k <= 0) {
        if (k < 0 && errno == EINTR) continue;
        return;
      }
      off += (size_t)k;
    }
  }
  void respond(int code, const char* contentType, const std::string& body) {
    std::string r = "HTTP/1.1 " + std::to_string(code) + " ";
    r += statusText(code);
    r += "\r\n";
    if (code != 204) {
      r += "Content-Type: ";
      r += contentType;
      r += "\r\nContent-Length: ";
      r += std::to_string(body.size());
      r += "\r\n";
    }
    for (auto& h : hdrs) r += h.first + ": " + h.second + "\r\n";
    r += "Connection: close\r\n\r\n";
    writeAll(r);
    if (code != 204 && !body.empty()) writeAll(body);
  }
};

static WebServerImpl g_ws;

WebServerStub::WebServerStub(int port) {
  const char* env = getenv("STUB_PORT");
  // The sketch hard-codes port 80; unprivileged hosts default to 8087.
  g_ws.port = env ? atoi(env) : (port == 80 ? 8087 : port);
}
WebServerStub::~WebServerStub() {
  if (g_ws.listenFd >= 0) close(g_ws.listenFd);
}
void WebServerStub::on(const String& url, uint8_t method, std::function<void()> fn) {
  g_ws.routes.push_back({url.s, method, fn});
}
void WebServerStub::begin() {
  g_ws.listenFd = socket(AF_INET, SOCK_STREAM, 0);
  int one = 1;
  setsockopt(g_ws.listenFd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  addr.sin_port = htons((uint16_t)g_ws.port);
  if (bind(g_ws.listenFd, (sockaddr*)&addr, sizeof addr) != 0) {
    perror("harness: bind");
    exit(2);
  }
  if (listen(g_ws.listenFd, 16) != 0) {
    perror("harness: listen");
    exit(2);
  }
  fcntl(g_ws.listenFd, F_SETFL, O_NONBLOCK);
}
void WebServerStub::handleClient() {
  int fd = accept(g_ws.listenFd, nullptr, nullptr);
  if (fd < 0) {
    usleep(2000);  // keep the busy loop from pinning a core on the host
    return;
  }
  // Keep the accepted fd blocking; SO_RCVTIMEO below bounds all reads.
  timeval tv{2, 0};
  setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof tv);
  setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof tv);
  g_ws.curFd = fd;

  std::string req;
  for (;;) {
    char c;
    ssize_t k = recv(fd, &c, 1, 0);
    if (k <= 0) {
      if (k < 0 && errno == EINTR) continue;
      close(fd);
      g_ws.curFd = -1;
      return;
    }
    req += c;
    if (req.find("\r\n\r\n") != std::string::npos || req.size() > 65536) break;
  }

  size_t lineEnd = req.find("\r\n");
  std::string reqLine = req.substr(0, lineEnd);
  size_t sp1 = reqLine.find(' ');
  size_t sp2 = reqLine.find(' ', sp1 + 1);
  if (sp1 == std::string::npos || sp2 == std::string::npos) {
    close(fd);
    g_ws.curFd = -1;
    return;
  }
  std::string method = reqLine.substr(0, sp1);
  std::string path = reqLine.substr(sp1 + 1, sp2 - sp1 - 1);
  size_t q = path.find('?');
  if (q != std::string::npos) path = path.substr(0, q);

  size_t headerEnd = req.find("\r\n\r\n");
  std::string headers = req.substr(lineEnd + 2, headerEnd - lineEnd - 2);
  size_t contentLen = 0;
  {
    size_t p = headers.find("Content-Length:");
    if (p == std::string::npos) p = headers.find("content-length:");
    if (p != std::string::npos)
      contentLen = (size_t)strtoul(headers.c_str() + p + 15, nullptr, 10);
  }
  std::string body = req.substr(headerEnd + 4);
  while (body.size() < contentLen) {
    char c;
    ssize_t k = recv(fd, &c, 1, 0);
    if (k <= 0) {
      if (k < 0 && errno == EINTR) continue;
      break;
    }
    body += c;
  }

  uint8_t mcode = HTTP_ANY;
  if (method == "GET") mcode = HTTP_GET;
  else if (method == "POST") mcode = HTTP_POST;
  else if (method == "HEAD") mcode = HTTP_HEAD;
  else if (method == "OPTIONS") mcode = HTTP_OPTIONS;
  else if (method == "PUT") mcode = HTTP_PUT;

  g_ws.hdrs.clear();
  g_ws.plain = body;

  for (auto& r : g_ws.routes) {
    if (r.path == path && (r.method == mcode || r.method == HTTP_ANY)) {
      r.fn();
      close(fd);
      g_ws.curFd = -1;
      return;
    }
  }
  g_ws.respond(404, "text/plain", "not found\n");
  close(fd);
  g_ws.curFd = -1;
}

String WebServerStub::arg(const String& name) {
  if (name.s == "plain") return String(g_ws.plain.c_str());
  return String();
}
String WebServerStub::arg(const char* name) { return arg(String(name)); }
void WebServerStub::sendHeader(const String& k, const String& v, bool gather) {
  if (gather) g_ws.hdrs.push_back({k.s, v.s});
}
void WebServerStub::sendHeader(const char* k, const char* v, bool gather) {
  sendHeader(String(k), String(v), gather);
}
void WebServerStub::send(int code, const char* contentType, const String& body) {
  g_ws.respond(code, contentType, body.s);
  g_ws.hdrs.clear();
}
void WebServerStub::send_P(int code, const char* contentType, const char* body) {
  g_ws.respond(code, contentType, std::string(body));
  g_ws.hdrs.clear();
}
void WebServerStub::send(int code) {
  g_ws.respond(code, "text/plain", "");
  g_ws.hdrs.clear();
}

// ------------------------------------------------------- firmware glue

#include "../../firmware/AntennaSwitcher.ino"

WiFiClass WiFiStub;
MDNSClassStub MDNSStub;

bool esp_register_shutdown_handler(void (*fn)()) {
  shutdownHandlersMutable().push_back(fn);
  return true;
}

static void runShutdownHandlers() {
  static bool ran = false;
  if (ran) return;
  ran = true;
  for (auto h : stubShutdownHandlers()) h();
}

static void onSignal(int) {
  if (!getenv("HARNESS_NO_EXIT_ON_SIGNAL")) runShutdownHandlers();
  _exit(0);
}

int main() {
  setvbuf(stdout, nullptr, _IOLBF, 0);
  signal(SIGTERM, onSignal);
  signal(SIGINT, onSignal);
  atexit(runShutdownHandlers);
  setup();
  for (;;) loop();
  return 0;
}
