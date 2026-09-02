export function WiringDiagram() {
  return (
    <figure className="overflow-x-auto rounded-xl bg-surface p-4 shadow-border">
      <figcaption className="mb-3 font-mono text-xs tracking-[0.18em] text-muted uppercase">
        Control + RF wiring · exclusive TX path
      </figcaption>
      <svg
        viewBox="0 0 920 560"
        role="img"
        aria-label="Wiring diagram connecting shack 13.8 volt supply, ESP32 relay board, AT-14 antenna switch, dummy load, and three antennas"
        className="h-auto w-full min-w-[640px] text-fg"
      >
        <rect width="920" height="560" fill="transparent" />

        <g>
          <rect x="20" y="24" width="180" height="88" rx="12" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeOpacity="0.2" />
          <text x="110" y="58" textAnchor="middle" fill="currentColor" fontSize="13" fontFamily="IBM Plex Sans, sans-serif">
            Shack PSU
          </text>
          <text x="110" y="80" textAnchor="middle" fill="currentColor" fillOpacity="0.65" fontSize="11" fontFamily="IBM Plex Mono, monospace">
            13.8 V DC
          </text>
        </g>

        <g>
          <rect x="260" y="20" width="280" height="200" rx="16" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeOpacity="0.2" />
          <text x="400" y="48" textAnchor="middle" fill="currentColor" fontSize="13" fontFamily="IBM Plex Sans, sans-serif">
            ESP32_Relay_4
          </text>
          <text x="400" y="68" textAnchor="middle" fill="currentColor" fillOpacity="0.65" fontSize="11" fontFamily="IBM Plex Mono, monospace">
            DC 7–30 V in · GPIO 32/33/25/26
          </text>
          {[
            ["R1 NO → ANT1", 100],
            ["R2 NO → ANT2", 128],
            ["R3 NO → ANT3", 156],
            ["R4 NO → ANT4", 184],
          ].map(([label, y]) => (
            <text
              key={label}
              x="280"
              y={y as number}
              fill="currentColor"
              fillOpacity="0.8"
              fontSize="12"
              fontFamily="IBM Plex Mono, monospace"
            >
              {label}
            </text>
          ))}
        </g>

        <g>
          <rect x="620" y="20" width="280" height="220" rx="16" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeOpacity="0.2" />
          <text x="760" y="48" textAnchor="middle" fill="currentColor" fontSize="13" fontFamily="IBM Plex Sans, sans-serif">
            AT-14 1×4 coax switch
          </text>
          <text x="760" y="68" textAnchor="middle" fill="currentColor" fillOpacity="0.65" fontSize="11" fontFamily="IBM Plex Mono, monospace">
            +12 V one-hot · SO-239
          </text>
          <circle cx="760" cy="120" r="18" fill="none" stroke="currentColor" strokeOpacity="0.45" />
          <text x="760" y="124" textAnchor="middle" fill="currentColor" fontSize="10" fontFamily="IBM Plex Mono, monospace">
            TX
          </text>
          {[
            [700, 170, "1"],
            [740, 200, "2"],
            [780, 200, "3"],
            [820, 170, "4"],
          ].map(([x, y, n]) => (
            <g key={String(n)}>
              <circle cx={x as number} cy={y as number} r="14" fill="none" stroke="currentColor" strokeOpacity="0.45" />
              <text x={x as number} y={(y as number) + 4} textAnchor="middle" fill="currentColor" fontSize="10" fontFamily="IBM Plex Mono, monospace">
                {n}
              </text>
            </g>
          ))}
        </g>

        <g>
          <rect x="20" y="280" width="200" height="72" rx="12" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeOpacity="0.2" />
          <text x="120" y="312" textAnchor="middle" fill="currentColor" fontSize="13">
            Transceiver
          </text>
          <text x="120" y="332" textAnchor="middle" fill="currentColor" fillOpacity="0.65" fontSize="11" fontFamily="IBM Plex Mono, monospace">
            RF out · 50 Ω
          </text>
        </g>

        <g>
          <rect x="280" y="400" width="150" height="64" rx="12" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeOpacity="0.25" />
          <text x="355" y="428" textAnchor="middle" fill="currentColor" fontSize="13">
            50 Ω dummy
          </text>
          <text x="355" y="448" textAnchor="middle" fill="currentColor" fillOpacity="0.65" fontSize="11" fontFamily="IBM Plex Mono, monospace">
            Port 1 fail-safe
          </text>
        </g>
        {[
          [480, "Antenna 2"],
          [660, "Antenna 3"],
          [840, "Antenna 4"],
        ].map(([x, label], i) => (
          <g key={label}>
            <rect x={(x as number) - 70} y="400" width="140" height="64" rx="12" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeOpacity="0.2" />
            <text x={x as number} y="428" textAnchor="middle" fill="currentColor" fontSize="13">
              {label}
            </text>
            <text x={x as number} y="448" textAnchor="middle" fill="currentColor" fillOpacity="0.65" fontSize="11" fontFamily="IBM Plex Mono, monospace">
              Port {i + 2}
            </text>
          </g>
        ))}

        <path d="M200 68 H260" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" />
        <path d="M540 70 H620" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" />
        <path d="M220 316 H760 V156" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2" />
        <path d="M700 184 V400" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" />
        <path d="M740 214 V400" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" />
        <path d="M780 214 V400" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" />
        <path d="M820 184 V400" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" />

        <text x="20" y="520" fill="currentColor" fillOpacity="0.7" fontSize="12" fontFamily="IBM Plex Sans, sans-serif">
          Hardware mutex: +12 V daisy-chains through NC contacts so only one AT-14 coil can energize.
        </text>
        <text x="20" y="542" fill="currentColor" fillOpacity="0.7" fontSize="12" fontFamily="IBM Plex Sans, sans-serif">
          Firmware parks TX on port 1 (dummy load) at boot, on any error, and before exit.
        </text>
      </svg>
    </figure>
  );
}
