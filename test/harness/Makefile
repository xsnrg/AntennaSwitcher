# Host test harness for firmware/AntennaSwitcher.ino.
# Builds the real sketch against stubbed Arduino/ESP32 APIs (stubs/).
# `make` produces ./harness; `make run` starts it on STUB_PORT (default 8087).

CXX ?= g++
CXXFLAGS ?= -std=c++17 -O1 -g -Wall

harness: main.cpp stubs/Arduino.h stubs/WiFi.h stubs/WebServer.h \
         stubs/Preferences.h stubs/ESPmDNS.h stubs/esp_system.h \
         stubs/esp_task_wdt.h ../../firmware/AntennaSwitcher.ino
	$(CXX) $(CXXFLAGS) -Istubs main.cpp -o harness

run: harness
	STUB_PORT=$${STUB_PORT:-8087} ./harness

clean:
	rm -f harness

.PHONY: run clean
