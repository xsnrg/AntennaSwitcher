#pragma once
// Host stub of ESP32 Arduino WebServer: a minimal single-threaded HTTP/1.1
// server over POSIX sockets. Supports the subset used by the sketch:
// on(path, METHOD, fn), arg("plain"), sendHeader, send, send_P, handleClient.
// Port comes from env STUB_PORT if set, else the ctor argument.
// Implemented by test/harness/main.cpp.

#include "Arduino.h"
#include <cstdint>
#include <functional>
#include <string>
#include <vector>

#define HTTP_ANY 0
#define HTTP_GET 1
#define HTTP_POST 2
#define HTTP_HEAD 4
#define HTTP_PUT 32
#define HTTP_PATCH 64
#define HTTP_OPTIONS 16

class WebServerStub {
 public:
  explicit WebServerStub(int port);
  ~WebServerStub();

  void on(const String& url, uint8_t method, std::function<void()> fn);
  void begin();
  void handleClient();

  String arg(const String& name);
  String arg(const char* name);

  void sendHeader(const String& k, const String& v, bool gather = true);
  void sendHeader(const char* k, const char* v, bool gather = true);

  void send(int code, const char* contentType, const String& body);
  void send_P(int code, const char* contentType, const char* body);
  void send(int code);
};
#define WebServer WebServerStub
