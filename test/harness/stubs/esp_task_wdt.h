#pragma once
// Host stub of esp_task_wdt.h. The watchdog does not fire, but every reset
// feeds a counter so tests can prove long loops keep feeding it.

#include <cstdint>
#include <cstdlib>
#include <unistd.h>

inline long& stubWdtFeedCount() {
  static long n = 0;
  return n;
}
inline bool& stubWdtPanicArmed() {
  static bool b = false;
  return b;
}

inline int esp_task_wdt_init(uint32_t, bool panic) {
  stubWdtPanicArmed() = panic;
  return 0;
}
inline int esp_task_wdt_add(void*) { return 0; }
inline int esp_task_wdt_reset() {
  stubWdtFeedCount()++;
  if (getenv("STUB_WDT_PRINT")) fprintf(stderr, "WDT_FEED %ld\n", stubWdtFeedCount());
  return 0;
}
inline int esp_task_wdt_delete(void*) { return 0; }
