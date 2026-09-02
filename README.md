# AntennaSwitcher

WiFi control for a 4-port HF antenna switch. One ESP32 sketch, one TX path, fail-safe to a 50 Ω dummy load.

**Hardware**

- [AC/DC ESP32-WROOM-32E 4-relay board](https://www.amazon.com/dp/B0DCZ549VQ) (ASIN B0DCZ549VQ)
- [AT-14 1×4 coax switch, 1.8–60 MHz, 500 W PEP, SO-239](https://www.amazon.com/dp/B0DY7K5KSN) (ASIN B0DY7K5KSN)

**Invariants**

1. The TX port is connected to one and only one antenna port at rest.
2. Every error path, watchdog, and shutdown parks the switch on **port 1**.
3. Port 1 is a 50 Ω dummy load.

## Docs

- [docs/HARDWARE.md](docs/HARDWARE.md) — device research, pin maps, sources
- [docs/WIRING.md](docs/WIRING.md) — RF + 12 V control, NC daisy-chain mutex
- [firmware/AntennaSwitcher.ino](firmware/AntennaSwitcher.ino) — single-file web UI + relay control

## Flash

Arduino IDE 2, *ESP32 Dev Module*, 4 MB flash.

1. Set `WIFI_SSID` / `WIFI_PASS` at the top of the sketch.
2. 3.3 V USB-serial to the board UART header (cross TX/RX). Hold IO0, tap RST.
3. Upload. Serial prints the station IP. Browser: that IP, or `http://antennaswitcher.local/`.

The page names ports, switches with one tap, shows per-port stats, and supports light / dark / grey / system themes. It is a single HTML document served by the sketch.

## GPIO (ESP32_Relay_4)

| Port | GPIO | AT-14 | Load |
| --- | --- | --- | --- |
| 1 | 32 | 1 | Dummy load |
| 2 | 33 | 2 | Antenna 2 |
| 3 | 25 | 3 | Antenna 3 |
| 4 | 26 | 4 | Antenna 4 |

Active HIGH. Confirm on your PCB before transmitting.

## Safety

- Break-before-make, 80 ms open.
- Hardware mutex: +12 V daisy-chains through NC so two AT-14 coils cannot energize.
- Unkey before switching.
- Never put RF on the ESP32 terminals. Never feed AC mains and DC into the ESP32 board together.

## License

MIT
