#pragma once
// Host stub of esp_system.h. Reset reason comes from env STUB_RESET_REASON
// (e.g. "brownout", "panic", "task watchdog"; default power-on).
// Shutdown handlers registered via esp_register_shutdown_handler run on
// SIGTERM/SIGINT and at normal exit.

#include <cstdint>
#include <vector>

typedef enum {
  ESP_RST_UNKNOWN = 0,
  ESP_RST_POWERON = 1,
  ESP_RST_EXT = 2,
  ESP_RST_SW = 3,
  ESP_RST_PANIC = 4,
  ESP_RST_TASK_WDT = 6,
  ESP_RST_INT_WDT = 7,
  ESP_RST_WDT = 5,
  ESP_RST_DEEPSLEEP = 8,
  ESP_RST_BROWNOUT = 9,
  ESP_RST_SDIO = 10,
} stub_esp_reset_reason_t;
#define esp_reset_reason_t stub_esp_reset_reason_t

stub_esp_reset_reason_t esp_reset_reason();
bool esp_register_shutdown_handler(void (*)());
const std::vector<void (*)()>& stubShutdownHandlers();
