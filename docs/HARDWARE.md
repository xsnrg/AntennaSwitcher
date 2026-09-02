# Hardware research — AntennaSwitcher

Research compiled 2026-09-01 for the two Amazon parts that make up this project. Prices move; electrical facts below are from listings, silkscreen, datasheets, and public teardowns.

Related public build (different controller topology — discrete ESP32 + 5 V relay brick + buck converter): Tech Minds, *Four Way 500 Watt Antenna Switch With An ESP32 Twist* ([video](https://www.youtube.com/watch?v=UB6Tlh_ZC4s), [sketch](https://github.com/TechMindsYT/ESP32-Antenna-Switch)). This project uses the **integrated AC/DC ESP32 4-relay board** instead, so the 12 V interposer, 5 V rail, and MCU live on one PCB.

---

## 1. AC/DC Power Supply ESP32 Development Board

| Field | Value |
| --- | --- |
| Amazon | [B0DCZ549VQ](https://www.amazon.com/dp/B0DCZ549VQ) |
| Listing title | AC/DC Power Supply ESP32 Development Board Programmable Development Board Wireless WiFi 4 Way Channel 5V Relay Module ESP32-WROOM-32E for Arduino AC 90–250 V / DC 7–30 V |
| Brand (FCC / device.report) | ACEIRMC |
| PCB silkscreen | `ESP32_Relay_4` |
| Family | LC Technology / DORHEA / Fasizi ESP32 4-ch AC/DC relay |

### What it is

A single blue PCB that combines:

- Espressif **ESP32-WROOM-32E** module (4 MB flash, 802.11 b/g/n, Bluetooth 4.2 BR/EDR + BLE)
- On-board **AC–DC** switcher plus a DC input, both feeding a 5 V rail for the MCU and relay coils
- Four **SONGLE SRD-05VDC-SL-C** SPDT relays with screw terminals `NOx / COMx / NCx`
- Full GPIO breakout beside the module
- UART programming header and RST button

Front of board (left to right in typical photos): AC `L/N` terminal, DC `7–30V / GND / 5V` terminal, Hi-Link-style AC-DC brick, 5 V regulator (AMS1117-3.3 nearby for the module), ESP32-WROOM-32E, opto/transistor drivers, four blue relays, four 3-pole screw blocks.

### Electrical

| Rail | Spec | Use in this project |
| --- | --- | --- |
| AC in | 90–250 V (also listed as 220 V) | **Do not use.** RF shack already has 13.8 V. |
| DC in | 7–30 V (some clones print 5–30 V) | **13.8 V shack PSU** on the `7–30V` and `GND` screws |
| 5 V pin | Regulated output | Relay coils; do not back-feed |
| 3.3 V | Module rail | Do not load this with coils |
| Relay contacts | 10 A @ 250 VAC / 10 A @ 30 VDC / 10 A @ 125 VAC | Switching **+12 V control**, not RF, not AC mains |

**Do not apply AC and DC at the same time.**

Relay coils are 5 V. Contact side is dry: we feed shack +12 V into the daisy-chained COM/NC path and take NO out to the AT-14.

### GPIO map (ESP32_Relay_4 / Tasmota `ESP32_Relay_X4`)

Verify with a continuity check from GPIO pad to the relay driver before first TX. This is the map used by firmware and by the LC Technology Tasmota template:

| Relay | GPIO | AT-14 line | Default load |
| --- | --- | --- | --- |
| 1 | 32 | Control 1 | 50 Ω dummy load |
| 2 | 33 | Control 2 | Antenna 2 |
| 3 | 25 | Control 3 | Antenna 3 |
| 4 | 26 | Control 4 | Antenna 4 |
| LED | 23 | — | Status (unused) |

Logic is **active HIGH** on this family (GPIO HIGH energizes the 5 V coil). Contrast: the Tech Minds discrete relay brick was active LOW.

Safe GPIOs for this job: 25, 26, 32, 33 (not strapping, not flash, output-capable).

### Module (ESP32-WROOM-32E)

From the Espressif datasheet:

- Xtensa dual-core LX6, up to 240 MHz
- 802.11 b/g/n, up to 150 Mbps
- Bluetooth v4.2 BR/EDR + BLE
- Module 18.0 × 25.5 × 3.1 mm
- Flash 4 MB (this board)
- Module VDD 3.0–3.6 V
- TX 802.11b peak ~379 mA; plan the 5 V rail accordingly
- Ambient −40 to 85 °C

### Programming

No USB-UART on the board. Use a **3.3 V** USB-serial adapter on the 6-pin header next to the module:

1. GND common
2. Adapter TX → board RX, adapter RX → board TX
3. Hold IO0 to GND, tap RST, release IO0 (download mode)
4. Arduino IDE: *ESP32 Dev Module*, 4 MB flash, 115200
5. Sketch: `firmware/AntennaSwitcher.ino`

Reddit reports of the 4-relay version confirm flashing from the UART pins on the relay edge of the PCB.

### Mechanical

- Four mounting holes
- Fits a small outdoor/indoor ABS box (see public 3D-printed ESP32 Relay X4 enclosures)
- Keep it **in the shack**, not at the tower: only the AT-14 needs to live with the antennas
- Control cable: 5–6 conductor, 20–22 AWG, length to the AT-14 (often roof/tower)

---

## 2. AT-14 Heavy-Duty 4-Way Coaxial Remote Antenna Switch

| Field | Value |
| --- | --- |
| Amazon | [B0DY7K5KSN](https://www.amazon.com/dp/B0DY7K5KSN) |
| Listing title | AT-14 Heavy-Duty 4-Way Coaxial Remote Antenna Switch Kit — 500 W PEP, 1.8 MHz–60 MHz, SO-239 Connectors |
| Other storefronts | Walmart, Banggood, AliExpress (same AT-14 1×4 kit) |
| Control voltage | **+12 V** |
| RF connectors | SO-239 (UHF female) × 5 |
| Body size (Banggood) | 10 × 11.5 × 3.5 cm |

### What it is

A 1×4 HF coaxial relay box:

- Center SO-239 labeled **TX** (radio)
- Four corner SO-239 labeled **1 2 3 4** (antennas)
- Gland for a multi-conductor control cable
- Optional indoor **rotary controller** (4-position switch, 4 LEDs, barrel jack, 6-way terminal `1 2 3 4 GND` plus `12V GND`)

The kit is also sold as a PCB set: octagonal RF board with four HF relays and five SO-239, plus the small controller PCB. Assembled Amazon units ship in a black metal enclosure with weather caps on the SO-239s. The enclosure is **not a rated outdoor box** — add a proper enclosure or mount under an eave if it lives on a roof.

### RF

| Spec | Value | Note |
| --- | --- | --- |
| Frequency | 1.8–60 MHz | 160 m through 6 m |
| Power | 500 W PEP | Not a legal-limit amp switch |
| Impedance | 50 Ω | Dummy load on port 1 must be 50 Ω |
| Connectors | SO-239 | Mate with PL-259 |
| Path | 1 TX → 1 of 4 | Software + hardware mutex in this project |

Insertion loss / isolation are not published on the Amazon listing. Treat it as a budget HF relay box: fine through 10 m, check SWR on 6 m after install. Do not use above 60 MHz.

### Control interface (critical)

From the rotary head silkscreen, listings, and the Tech Minds teardown of the same AT-14:

| Terminal | Function |
| --- | --- |
| 1, 2, 3, 4 | +12 V **one-hot**. Applying 12 V to line *n* closes the RF relay for antenna *n*. |
| GND | Return, common with the 12 V supply |
| Barrel jack (controller only) | 12 V DC in for the rotary box — unused here |

There is **no BCD**. Two lines high at once would try to close two RF relays — that is the failure this firmware and the NC daisy-chain exist to prevent.

With **no** control voltage, AT-14 RF relays are open: TX is disconnected from every antenna. That is safe for lightning isolation, but it is **not** a dummy load. Firmware therefore **drives port 1** at boot, on error, and on shutdown so a keyed radio sees 50 Ω.

Coil current is a typical 12 V HF relay (tens of mA each). One coil only.

### Rotary controller

Not used. Leave it in the bag. The ESP32 board replaces it.

---

## 3. Supporting parts (not on the two Amazon links)

| Part | Why |
| --- | --- |
| 50 Ω dummy load, ≥100 W continuous (500 W PEP preferred) | Port 1 fail-safe |
| Shack 13.8 V PSU, fused ~1 A on the control run | ESP32 DC in + AT-14 coils |
| 5–6 conductor control cable | ESP32 shack → AT-14 |
| PL-259 jumpers | Radio→TX, port 1→dummy, ports 2–4→antennas |
| 3.3 V USB-serial adapter | First flash |
| Enclosure for the ESP32 board | Strain relief, no stray 12 V shorts |
| Optional: Polyfuse on +12 V into the daisy-chain | Coil/wiring faults |

---

## 4. Why this pairing works

1. The ESP32 board already has four dry contacts and a 7–30 V input. A separate 5 V relay brick and buck converter (Tech Minds topology) are unnecessary.
2. AT-14 wants +12 V one-hot. Shack 13.8 V is in spec for both the ESP32 DC input and the AT-14 coils.
3. Relays on the ESP32 board isolate 3.3 V GPIOs from the 12 V control pair.
4. Four contacts map 1:1 onto four AT-14 lines.

---

## 5. Sources

- Amazon B0DCZ549VQ / B0DY7K5KSN listing titles and feature bullets
- [device.report ACEIRMC B0DCZ549VQ](https://device.report/aceirmc/b0dcz549vq)
- Product photos: SONGLE SRD-05VDC-SL-C, `ESP32_Relay_4` silkscreen, AT-14 `1×4` enclosure + rotary head
- Tasmota template [ESP32_Relay_X4](https://templates.blakadder.com/ESP32_Relay_X4.html) (GPIO 32/33/25/26)
- [ESP32-WROOM-32E datasheet](https://documentation.espressif.com/esp32-wroom-32e_esp32-wroom-32ue_datasheet_en.html)
- [Tech Minds AT-14 + ESP32 video](https://www.youtube.com/watch?v=UB6Tlh_ZC4s) (control cable: 1 ground + 4 × 12 V)
- Banggood AT-14: +12 V control, 10 × 11.5 × 3.5 cm, 500 W PEP, 1.8–60 MHz, SO-239
