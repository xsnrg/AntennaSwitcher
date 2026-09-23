#pragma once
// Host stub of the ESP32 Arduino WiFi class.
// Env knobs: STUB_RSSI (dBm), STUB_IP, STUB_WIFI_DOWN=1 (never connects).

#include "Arduino.h"
#include <cstdlib>
#include <ostream>

enum wl_connect_status_stub {
  WL_DISCONNECTED = 6,
  WL_CONNECTED = 3,
};

enum wifi_mode_stub { WIFI_MODE_NULL = 0, WIFI_MODE_STA = 1, WIFI_MODE_AP = 2 };
#define WIFI_STA WIFI_MODE_STA

class IPAddress {
 public:
  std::string ip;
  IPAddress() : ip("127.0.0.1") {}
  String toString() const { return String(ip.c_str()); }
};
inline std::ostream& operator<<(std::ostream& o, const IPAddress& a) {
  return o << a.ip;
}

class WiFiClass {
 public:
  void mode(int) {}
  bool begin(const char*, const char*) { return status() == WL_CONNECTED; }
  int status() {
    const char* down = getenv("STUB_WIFI_DOWN");
    return (down && down[0] == '1') ? WL_DISCONNECTED : WL_CONNECTED;
  }
  int RSSI() {
    const char* r = getenv("STUB_RSSI");
    return r ? atoi(r) : -55;
  }
  IPAddress localIP() {
    IPAddress a;
    const char* ip = getenv("STUB_IP");
    a.ip = ip ? ip : "127.0.0.1";
    return a;
  }
  bool reconnect() { return begin("", ""); }
};
extern WiFiClass WiFiStub;
#define WiFi WiFiStub
