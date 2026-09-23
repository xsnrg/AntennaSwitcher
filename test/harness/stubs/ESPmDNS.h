#pragma once
#include "Arduino.h"
struct MDNSClassStub {
  bool begin(const char*) { return true; }
  void end() {}
};
extern MDNSClassStub MDNSStub;
#define MDNS MDNSStub
