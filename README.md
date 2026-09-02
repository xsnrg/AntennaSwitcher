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

---

## What you need

| Item | Notes |
| --- | --- |
| ESP32 4-relay board (B0DCZ549VQ) | Silkscreen `ESP32_Relay_4` |
| AT-14 1×4 coax switch (B0DY7K5KSN) | Leave the rotary controller in the bag |
| 50 Ω dummy load | Port 1. ≥100 W continuous; match your PEP |
| Shack 13.8 V PSU | Fused ~1 A on the control run |
| 5–6 conductor cable | ESP32 in the shack → AT-14 |
| PL-259 jumpers | Radio→TX, port 1→dummy, 2–4→antennas |
| 3.3 V USB-serial adapter | CP2102 / CH340 / FT232, **3.3 V logic** |
| Arduino IDE 2 | Plus the Espressif esp32 board package |

Do not use a 5 V serial adapter on the ESP32 UART pins.

---

## Flash

The board has no USB jack. First flash is over the 6-pin UART header next to the ESP32 module.

### 1. Install the toolchain

1. Install [Arduino IDE 2](https://www.arduino.cc/en/software).
2. **File → Preferences → Additional boards manager URLs**, add:

   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`

3. **Tools → Board → Boards Manager**, search **esp32** (Espressif), install.
4. No extra libraries. The sketch uses `WiFi`, `WebServer`, `Preferences`, and `ESPmDNS` from the core.

### 2. Configure WiFi

Open `firmware/AntennaSwitcher.ino` and set your station:

```cpp
#define WIFI_SSID "YOUR_SSID"
#define WIFI_PASS "YOUR_PASSWORD"
```

Optional: confirm the GPIO map matches your PCB (see [GPIO](#gpio-esp32_relay_4) below). Default is active HIGH on 32, 33, 25, 26.

### 3. Wire the USB-serial adapter

Power the board from USB-serial **3.3 V only** for this step. Leave the AC `L/N` terminals empty. Do not also feed 13.8 V while programming.

| Adapter | Board UART header |
| --- | --- |
| GND | GND |
| 3V3 | 3V3 (if the header has it; otherwise power via 5 V only if the board regulator is in-circuit) |
| TX | **RX** (crossed) |
| RX | **TX** (crossed) |
| — | IO0 used as a strap, not a data pin |

### 4. Enter download mode and upload

1. **Tools → Board → ESP32 Arduino → ESP32 Dev Module**
2. **Tools** settings:
   - Flash Size: **4 MB**
   - Upload Speed: **115200**
   - Port: the USB-serial device
3. Hold **IO0 to GND**.
4. Tap **RST**, then release IO0.
5. Click **Upload**.
6. After “Hard resetting…”, tap RST again so it boots the new sketch.
7. Open **Tools → Serial Monitor** at 115200. You should see dots, then `IP 192.168.x.x`.

If upload fails with a timeout: stay in download mode (IO0 held through the start of the upload), check TX/RX are crossed, and confirm the adapter is 3.3 V.

### 5. Open the control page

On a phone or shack PC on the same WiFi:

- `http://<the printed IP>/`
- or `http://antennaswitcher.local/`

The page is the whole UI: four port buttons, rename fields, stats, light / dark / grey / system themes. Names and theme persist on the ESP32 in NVS.

---

## Hardware setup

Do this **after** a successful flash, with the radio unkeyed.

### Power

Screw shack **13.8 V** onto the ESP32 board `7–30V` and `GND`. Leave `L/N` empty. Never apply AC mains and DC at the same time.

### Control (12 V, not RF)

Do **not** bus +12 V onto every COM. Daisy-chain so only one AT-14 coil can ever be hot:

```text
13.8 V PSU ──► ESP32 DC 7–30V / GND
            └─► +12V ──► R1 COM
                              R1 NC ──► R2 COM
                              R2 NC ──► R3 COM
                              R3 NC ──► R4 COM
                              R1 NO ──► AT-14 pin 1   (dummy load)
                              R2 NO ──► AT-14 pin 2
                              R3 NO ──► AT-14 pin 3
                              R4 NO ──► AT-14 pin 4
            └─► GND ────────► AT-14 GND
```

### RF

```text
Radio RF ──► AT-14 TX
AT-14 1  ──► 50 Ω dummy load
AT-14 2  ──► Antenna 2
AT-14 3  ──► Antenna 3
AT-14 4  ──► Antenna 4
```

Bond the AT-14 chassis to station ground. Keep weather caps on unused SO-239s.

Full diagrams: [docs/WIRING.md](docs/WIRING.md).

### First on-air check

1. Power the ESP32. It must boot on **port 1** (dummy). You should hear/see relay 1.
2. Open the web UI. Dummy Load shows as selected.
3. With the radio unkeyed, tap port 2. Only one AT-14 LED/coil should fire.
4. Confirm SWR on the dummy, then on a live antenna.
5. Unkey before every switch. The firmware opens all relays for 80 ms; that is not a substitute for unkeying.

---

## GPIO (ESP32_Relay_4)

| Port | GPIO | AT-14 | Load |
| --- | --- | --- | --- |
| 1 | 32 | 1 | Dummy load |
| 2 | 33 | 2 | Antenna 2 |
| 3 | 25 | 3 | Antenna 3 |
| 4 | 26 | 4 | Antenna 4 |

Active HIGH. Confirm with a continuity check from the GPIO pad to the relay driver before transmitting.

## Safety

- Break-before-make, 80 ms open.
- Hardware mutex: +12 V daisy-chains through NC so two AT-14 coils cannot energize.
- Unkey before switching.
- Never put RF on the ESP32 terminals. Never feed AC mains and DC into the ESP32 board together.
- If 13.8 V is lost, AT-14 coils drop and TX is open (safe, not dummy). Restore power and the sketch parks on port 1 again.

## License

MIT
