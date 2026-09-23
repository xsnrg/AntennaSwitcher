#pragma once
// Host stub of the Arduino core API. Just enough of ESP32 Arduino for
// firmware/AntennaSwitcher.ino to compile and run on Linux for testing.
// Implemented by test/harness/main.cpp.

#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <sstream>
#include <string>
#include <type_traits>
#include <unistd.h>

using std::isnan;
using std::isinf;

#define PROGMEM
#define IRAM_ATTR
#define ICACHE_RODATA_ATTR

#define HIGH 1
#define LOW 0
#define INPUT 0x0
#define OUTPUT 0x1
#define INPUT_PULLUP 0x2

class String {
  static std::string fromFloat(float f, int d) {
    char buf[64];
    snprintf(buf, sizeof buf, "%.*f", d, (double)f);
    return buf;
  }

 public:
  std::string s;

  String() {}
  String(const char* p) : s(p ? p : "") {}
  String(const String& o) : s(o.s) {}
  String(char c) : s(1, c) {}
  String(bool b) : s(b ? "true" : "false") {}
  String(unsigned char v) : s(std::to_string((unsigned)v)) {}
  String(short v) : s(std::to_string(v)) {}
  String(unsigned short v) : s(std::to_string(v)) {}
  String(int v) : s(std::to_string(v)) {}
  String(unsigned int v) : s(std::to_string(v)) {}
  String(long v) : s(std::to_string(v)) {}
  String(unsigned long v) : s(std::to_string(v)) {}
  String(long long v) : s(std::to_string(v)) {}
  String(unsigned long long v) : s(std::to_string(v)) {}
  String(float f) : s(fromFloat(f, 2)) {}
  String(double d) : s(fromFloat((float)d, 2)) {}
  String(float f, int decimals) : s(fromFloat(f, decimals)) {}

  unsigned int length() const { return (unsigned int)s.size(); }
  const char* c_str() const { return s.c_str(); }
  char charAt(unsigned int i) const { return s[i]; }
  char operator[](unsigned int i) const { return s[i]; }
  char& operator[](unsigned int i) { return s[i]; }
  void reserve(unsigned int n) { s.reserve(n); }
  void clear() { s.clear(); }

  int indexOf(const String& n, unsigned int from = 0) const {
    size_t p = s.find(n.s, from);
    return p == std::string::npos ? -1 : (int)p;
  }
  int indexOf(const char* n, unsigned int from = 0) const {
    return indexOf(String(n), from);
  }
  String substring(unsigned int from) const {
    if (from > s.size()) return String();
    std::string r = s.substr(from);
    return String(r.c_str());
  }
  String substring(unsigned int from, unsigned int to) const {
    if (from > s.size() || to < from || to > s.size()) return String();
    std::string r = s.substr(from, to - from);
    return String(r.c_str());
  }
  String& remove(unsigned int beginIndex,
                 unsigned int endIndex = 4294967295u) {
    if (beginIndex < s.size() && endIndex > beginIndex)
      s.erase(beginIndex, endIndex - beginIndex);
    return *this;
  }
  int toInt() const { return atoi(s.c_str()); }
  float toFloat() const { return (float)atof(s.c_str()); }
  void trim() {
    size_t a = s.find_first_not_of(" \t\r\n");
    if (a == std::string::npos) { s.clear(); return; }
    size_t b = s.find_last_not_of(" \t\r\n");
    s = s.substr(a, b - a + 1);
  }
  bool equals(const String& o) const { return s == o.s; }

  String& operator=(const String& o) { s = o.s; return *this; }
  String& operator=(const char* p) { s = p ? p : ""; return *this; }
  String& operator+=(const String& o) { s += o.s; return *this; }
  String& operator+=(const char* p) { if (p) s += p; return *this; }
  String& operator+=(char c) { s += c; return *this; }
  String& operator+=(int v) { s += String(v).s; return *this; }

  String operator+(const String& o) const { String r(*this); r.s += o.s; return r; }
  String operator+(const char* p) const { String r(*this); if (p) r.s += p; return r; }
  friend String operator+(const char* p, const String& o) {
    String r(p);
    r.s += o.s;
    return r;
  }

  bool operator==(const String& o) const { return s == o.s; }
  bool operator!=(const String& o) const { return s != o.s; }
  bool operator==(const char* p) const { return s == std::string(p ? p : ""); }
  bool operator!=(const char* p) const { return !(*this == p); }
};

class StubPrint {
  template <typename T>
  static typename std::enable_if<std::is_arithmetic<T>::value>::type
  printOne(T v) {
    printf("%lld", (long long)v);
  }
  static void printOne(float v) { printf("%.2f", (double)v); }
  static void printOne(double v) { printf("%.2f", v); }
  template <typename T>
  static typename std::enable_if<!std::is_arithmetic<T>::value>::type
  printOne(const T& v) {
    std::ostringstream o;
    o << v;
    fputs(o.str().c_str(), stdout);
  }

 public:
  void begin(unsigned long) {}
  void print(const String& v) { fputs(v.c_str(), stdout); }
  void print(const char* v) { fputs(v, stdout); }
  void print(char c) { fputc(c, stdout); }
  template <typename T>
  void print(T v) { printOne(v); }
  void println() { fputc('\n', stdout); }
  template <typename T>
  void println(const T& v) { print(v); println(); }
};
extern StubPrint Serial;

unsigned long millis();
unsigned long micros();
void delay(unsigned long ms);

void pinMode(uint8_t pin, uint8_t mode);
void digitalWrite(uint8_t pin, uint8_t val);
int digitalRead(uint8_t pin);

float temperatureRead();

struct ESPClass {
  uint32_t getFreeHeap() { return 240000; }
  uint32_t getChipModel() { return 0; }
};
extern ESPClass ESP;
