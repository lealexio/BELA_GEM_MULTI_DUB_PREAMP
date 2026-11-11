# Bela Gem Multi — Dub Preamp

[![Platform](https://img.shields.io/badge/Platform-Bela%20Gem%20Multi-blue.svg)](https://bela.io)
[![Language](https://img.shields.io/badge/Language-C%2B%2B11-orange.svg)](#)
[![Sample Rate](https://img.shields.io/badge/Audio-44.1%20kHz%20%7C%20Ultra--Low%20Latency-green.svg)](#)
[![License](https://img.shields.io/badge/License-MIT-lightgrey.svg)](#)

A dedicated, ultra-low-latency digital dub preamp engineered in **C++11** for the **Bela Gem Multi** embedded platform (ARM Cortex-A8 with Xenomai real-time Linux).  

Designed for live reggae/dub sound system performance, it merges analog tactile control with digital precision: 4 auxiliary channels, dual filtered FX sends, analog-modeled Dub Siren, one-shot sample player, 4-band sweepable parametric EQ, 12-band graphic EQ, resonant filters, band trim, click-free kill switches, and a real-time responsive browser GUI.

---

## Key Features

- **4 Channel Strips (Mono / Stereo):** Input gain with clipping detection, professional downward noise gate, 3-band musical EQ (±6 dB), and dual independent FX sends per channel. Dedicated microphone mode with rumble filter.
- **Dual External FX Loops:** Two independent send/return loops with switchable send filtering (`MIDS`, `TOPS`, or full range) and gated FX returns.
- **Dub Siren & Sample Player:**
  - Classic digital Dub Siren with pitch-drop envelope, phase-accumulator oscillator, and multi-waveform LFO.
  - WAV/MP3 one-shot sample player triggered directly from the web interface.
- **Master Bus Shaping:**
  - **4-Band Parametric EQ:** Logarithmic sweepable frequencies across SUB, KICK, MID, and TOP bands.
  - **12-Band Graphic EQ:** Fixed ISO bands from 40 Hz to 16 kHz (±12 dB).
  - **Resonant Filter Section:** Continuous-state sweepable HPF and LPF with click-free soft bypass.
  - **4-Band Trim:** ±6 dB fine-tuning post-crossover.
  - **Click-Free Kill Switches:** 4-way parallel 24 dB/oct crossover with dual gain ramping (30 ms).
- **Physical Controls & Diagnostics:**
  - Scalable multiplexing architecture supporting up to 8 CD74HC4067 chips (80 physical potentiometers).
  - Center-snapped detents with EMA low-pass jitter filtering on ADC inputs.
  - I2C GPIO expansion (MCP23017) for kill/mode switches and hardware clip LEDs.
- **Interactive Web Interface:** Real-time p5.js dashboard providing live VU meters, theoretical Master EQ frequency curve visualization, sample player triggers, and interactive hardware mapping detection.

---

## Signal Flow Overview

```
                      SOURCES & GENERATORS
IN2,3 (AUX 1 L/R) ──► ChannelStrip 1 ──► dry 1 ──┐
IN4,5 (AUX 2 L/R) ──► ChannelStrip 2 ──► dry 2 ──┤
IN6,7 (AUX 3 L/R) ──► ChannelStrip 3 ──► dry 3 ──┤  fxSend1 (sum) ──► Filter ──► OUT0 (FX1 Send)
IN8,9 (AUX 4 L/R) ──► ChannelStrip 4 ──► dry 4 ──┼──►
                      Dub Siren ───────► siren ──┤  fxSend2 (sum) ──► Filter ──► OUT1 (FX2 Send)
                      Sample Player ───► sample ─┘
                                                 │
                                           Summed Dry Mix
                                                 │
IN0 (FX1 Return) ──► NoiseGate (fx1Gate_) ───────┤
IN1 (FX2 Return) ──► NoiseGate (fx2Gate_) ───────┤
                                                 ▼
                                        MASTER BUS DSP CHAIN
                                       ParametricEq (4 bands)
                                                 ▼
                                        GraphicEq (12 bands)
                                                 ▼
                                      FilterSection (HPF / LPF)
                                                 ▼
                                         BandTrim (4 bands)
                                                 ▼
                                        KillSwitch (4 bands)
                                                 ▼
                                        × masterGain (Linear)
                                                 │
                                     ┌───────────┴───────────┐
                                     ▼                       ▼
                               OUT2 (Master L)         OUT3 (Master R)
                               (summed mono if MASTER_STEREO is disabled)

                                   ANALOG / PWM VU OUTPUTS
                               OUT6: TOP Band     (> 1200 Hz)
                               OUT7: MID Band     (200 – 1200 Hz)
                               OUT8: KICK Band    (80 – 200 Hz)
                               OUT9: SUB Band     (< 80 Hz)
```

---

## Quick Start

### 1. Build the Web GUI (on your development machine)
The front-end is written in modular ES6 under `gui/` and bundled into `src/sketch.js` using esbuild:

```bash
# Install build tools (one time)
npm install

# Bundle GUI for deployment
npm run build:gui
```

*For live editing with automatic rebuilding, use `npm run watch:gui`.*

### 2. Deploy to Bela
Upload or sync the project to your Bela board (via the Bela Web IDE or SSH/rsync):
```bash
rsync -avz --exclude 'node_modules' --exclude '.git' ./ root@bela.local:/root/Bela/projects/BELA_GEM_MULTI_DUB_PREAMP/
```

### 3. Open the Web Interface
Connect to your Bela board over USB or Wi-Fi and open your browser:
```
http://bela.local/gui/
```

---

## Documentation Index

Detailed technical guides are organized in the [`docs/`](docs/) directory and project references:

| Document | Description |
|---|---|
| **[AGENTS.md](AGENTS.md)** | **Definitive Ground Truth** for AI coding assistants: hard real-time rules, Xenomai threading model, ADRs, source file map, and code conventions. |
| **[System Architecture](docs/architecture.md)** | In-depth DSP signal chain, channel strip mechanics, master bus filter stages, and stereo/mono routing logic. |
| **[Hardware & Wiring](docs/hardware.md)** | CD74HC4067 multiplexer connections, MCP23017 I2C expander pinouts, clip LEDs, and Bela Gem Multi 10-in / 10-out audio pinout. |
| **[Configuration & Calibration](docs/configuration.md)** | `config.json` schema, `SoftwareConfig.h` tuning constants, pot centering/deadband calibration, and adding physical controls. |
| **[Web GUI Guide](docs/gui.md)** | Browser interface overview (Live, Meters, Master EQ, Mapping tabs), esbuild build pipeline, and WebSocket protocol. |
| **[Wi-Fi & Fallback Hotspot](docs/wifi-setup.md)** | USB Wi-Fi dongle setup, station mode connection, and automatic failover access point configuration. |

---

## Project Structure

```
├── AGENTS.md               # AI Agent & developer technical specifications
├── README.md               # Project overview & quick start (this file)
├── config.json             # Runtime hardware and routing configuration
├── package.json            # Node.js dependencies & GUI build scripts
├── docs/                   # Detailed technical documentation
│   ├── architecture.md     # DSP pipeline & Xenomai real-time constraints
│   ├── hardware.md         # Multiplexer, switch & audio I/O wiring
│   ├── configuration.md    # config.json, SoftwareConfig.h & calibration
│   ├── gui.md              # p5.js web interface & WebSocket protocol
│   └── wifi-setup.md       # Linux iwd Wi-Fi & auto-hotspot service
├── gui/                    # Web GUI ES6 source code
│   ├── main.js             # p5.js entry point
│   ├── dom/                # Tab components (Live, Meters, Master EQ, Mapping)
│   └── bela/               # WebSocket communication
└── src/                    # C++ Real-Time Firmware & Bela Project
    ├── render.cpp          # Bela audio callbacks (setup / render / cleanup)
    ├── HardwareManager.cpp # ADC multiplexing & I2C switch scanning
    ├── MasterFx.cpp        # Master processing pipeline
    ├── ChannelStrip.cpp    # Per-channel processing (gain, gate, EQ, sends)
    ├── DubSiren.cpp        # Dub Siren synthesis engine
    ├── SamplePlayer.cpp    # Audio sample playback engine
    ├── sketch.js           # Bundled GUI output (deployed to board)
    └── samples/            # WAV / MP3 one-shot sample files
```

---

## License

This project is open-source under the [MIT License](LICENSE).
