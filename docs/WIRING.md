# Physical wiring

Two domains, never mixed:

- **RF** stays on the AT-14 SO-239s.
- **12 V control** is switched by the ESP32 board’s dry contacts.

## Invariants

1. TX is connected to **one and only one** AT-14 antenna port at rest.
2. Changeover is **break-before-make** (firmware opens every coil, waits 80 ms, closes one).
3. Port 1 is a **50 Ω dummy load**. Firmware boots there, returns there on any trapped error, and parks there on shutdown.
4. A hardware mutex (NC daisy-chain) makes a two-coil AT-14 state impossible even if two GPIOs glitch.

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

Radio RF ──► AT-14 TX
AT-14 1  ──► 50 Ω dummy load
AT-14 2  ──► Antenna 2
AT-14 3  ──► Antenna 3
AT-14 4  ──► Antenna 4
```

## Hardware mutex

Do **not** bus +12 V onto every COM. Feed +12 V into relay 1 COM only. Each NC feeds the next COM. Then:

- R1 energized → 12 V to AT-14 pin 1; NC opens so R2–R4 are starved.
- R1 off, R2 on → 12 V passes R1 NC into R2, out R2 NO to pin 2; R3–R4 starved.
- All off → 12 V sits on R4 COM and goes nowhere (all NO open). Firmware then closes R1 so the dummy load is the rest state.

## ESP32 power

Screw the shack 13.8 V onto `7–30V` and `GND`. Leave `L/N` empty. Do not feed USB and DC together while programming unless you know the 5 V rail is isolated — prefer programming unpowered from AC/DC, then deploy on 13.8 V.

## GPIO

| Port | GPIO | Relay | AT-14 | Load |
| --- | --- | --- | --- | --- |
| 1 | 32 | 1 | 1 | 50 Ω dummy |
| 2 | 33 | 2 | 2 | Antenna 2 |
| 3 | 25 | 3 | 3 | Antenna 3 |
| 4 | 26 | 4 | 4 | Antenna 4 |
| DC | 34 | — | — | 100 kΩ/10 kΩ VIN sense |

Firmware: `RELAY_PINS[] = {32, 33, 25, 26}`, active HIGH. Confirm on your PCB before on-air use.

## DC supply sense

The board does not measure 13.8 V by itself. Add:

```text
7–30 V screw ── 100 kΩ ── GPIO34 ── 10 kΩ ── GND
                                 └── 100 nF ── GND
```

| Part | Value |
| --- | --- |
| Rtop | 100 kΩ, 1%, ≥0.25 W |
| Rbot | 10 kΩ, 1% |
| C | 100 nF across Rbot |
| Scale | ×11  →  13.8 V → 1.25 V at GPIO34 |

GPIO34 is input-only ADC1. Keep this on the **DC 7–30 V** screw, never on an AC terminal. Without the divider, the UI leaves DC blank; die temp and RSSI still work.

## RF notes

- Never hot-switch while transmitting. The 80 ms open window is for cold changeover; still unkey first.
- Dummy load rating ≥ expected carrier. 500 W PEP switch ≠ 500 W dummy.
- AT-14 metal box: bond to station ground.
- Unused SO-239s keep their weather caps.

## Fail-safe timeline

| Event | Relays |
| --- | --- |
| Power-up | All open, then port 1 closed |
| User select N | All open 80 ms, then N closed |
| Bad HTTP / invalid port / exception | Port 1 closed |
| Watchdog reset / `esp_register_shutdown_handler` | Port 1 pins forced |
| 13.8 V lost | AT-14 coils drop; TX open (safe, not dummy) |
