# Bela Gem Multi — Dub Preamp

Reggae/dub digital preamp implemented on **Bela Gem Multi** in C++.  
Ultra-low-latency real-time audio processing, driven by multiplexed physical potentiometers and I2C GPIO switches.

---

## Architecture

```
IN0 ──► ChannelStrip 1 (gain→gate→3-band EQ) ──────────────────────────► fxSend ──┐
IN1 ──► ChannelStrip 2 (gain→gate→3-band EQ) ───────────────────────────────────── ┤ filtered
IN2 ──► ChannelStrip 3 AUX (gain→gate→3-band EQ) ──────────────────────────────── ┤ by mode
IN3 ──► ChannelStrip 4 AUX (gain→gate→3-band EQ) ──────────────────────────────── ┤ → OUT2
         DubSiren (phase-acc osc + LFO + pitch drop) ──────────────────────────── ┘
                                │
                          dry mix sum
                                │
IN9 (FX return) ──► NoiseGate ──┤
                                ▼
                        MasterFx.process()
                         ParametricEq  (4-band sweepable peaking)
                         → GraphicEq  (12-band fixed peaking)
                         → FilterSection  (HPF + LPF with resonance)
                         → BandTrim   (SUB/KICK/MID/TOP ±6 dB)
                         → KillSwitch (4-band parallel crossover)
                         → × masterGain
                                │
                         OUT0 + OUT1 (mono)
                                │
                    band-split VU meter outputs
                    OUT6 TOP  OUT7 MID  OUT8 KICK  OUT9 SUB
```

### Source files

| File | Role |
|---|---|
| `render.cpp` | Bela entry point: setup / render / cleanup — orchestrates all modules |
| `HardwareManager.h/cpp` | MUX scan (CD74HC4067) + switch reading (MCP23017 via I2C) |
| `ChannelStrip.h/cpp` | Channel strip: gain → gate → 3-band EQ → FX send |
| `MasterFx.h/cpp` | Master bus: parametric EQ → graphic EQ → filter → trim → kills |
| `DubSiren.h/cpp` | Monophonic dub siren: phase-acc OSC + LFO + pitch-drop envelope |
| `ParametricEq.h/cpp` | 4-band master parametric EQ (SUB/KICK/MID/TOP, sweepable freq) |
| `GraphicEq.h/cpp` | 12-band fixed-frequency graphic EQ (40 Hz … 16 kHz) |
| `FilterSection.h/cpp` | Master HPF + LPF with sweepable frequency and resonance |
| `BandTrim.h/cpp` | 4-band ±6 dB post-crossover gain trim |
| `KillSwitch.h/cpp` | Click-free 4-band parallel crossover kill |
| `NoiseGate.h/cpp` | Professional gate: peak follower + ATTACK/HOLD/RELEASE state machine |
| `Biquad.h/cpp` | 2nd-order IIR biquad filter (low/high shelf, peaking EQ, LP/HP) |
| `HardwareConfig.h` | Hardware mapping: PotRef, SwitchRef, audio routing, I2C/MUX config |
| `SoftwareConfig.h` | DSP parameters: EQ frequencies, gains, gate, kills, siren, debug |
| `sketch.js` | Bela web GUI bundle (p5.js) — generated, deployed to the board |
| `gui/` | GUI source modules (ES6) — edit here, rebuild with `npm run build:gui` |

---

## Bela web GUI

The browser UI at `http://bela.local/gui/` is a **p5.js** sketch. The Bela IDE loads a single file: `src/sketch.js`. It does not support ES modules in the browser, so the GUI sources live in `gui/` at the repo root and are **bundled** into `src/sketch.js` before deployment.

```
gui/*.js  ──►  npm run build:gui  ──►  src/sketch.js  ──►  upload src/ to Bela
  (edit)         (dev machine)         (deploy)
```

The GUI has four tabs: **Live** (siren, console, switches), **Meters** (canvas VU meters), **Master EQ** (theoretical magnitude curve from pot/switch buffers), and **Mapping** (pot/switch detect + config JSON export). Constants in `gui/config.js` must stay in sync with `render.cpp`, `HardwareConfig.h`, and `SoftwareConfig.h`.

### Build commands

One-time setup (Node.js required on your dev machine only — not on the Bela board):

```bash
npm install
```

Production bundle (run after any change under `gui/`):

```bash
npm run build:gui
```

Watch mode (rebuilds `src/sketch.js` on every save while editing):

```bash
npm run watch:gui
```

### Deploy workflow

1. Edit files in `gui/` (`main.js`, `config.js`, `dom/*`, `bela/*`).
2. Run `npm run build:gui` (or keep `npm run watch:gui` running).
3. Sync **`src/`** to Bela as usual — same as before. Only `src/sketch.js` is used by the GUI; `gui/` is dev-only and does not need to be on the board.

Do **not** edit `src/sketch.js` by hand — it is auto-generated (see the header comment at the top of the file).

### GUI module layout

| Path | Role |
|---|---|
| `gui/main.js` | p5.js entry point (`setup` / `draw`) |
| `gui/config.js` | Pot/switch names, Master EQ constants, buffer layout |
| `gui/state.js` + `gui/context.js` | Shared mutable runtime state |
| `gui/css.js` | Injected styles |
| `gui/dom/` | Tab panes, shell, meters, Master EQ curve, mapping |
| `gui/bela/connection.js` | LIVE / LAG / OFFLINE connection badge |

---

## Physical controls

### Channel Strips (×4 — MUX 0 and MUX 3)

| Constant | Channel | Function |
|---|---|---|
| `CH1_INPUT_GAIN` | Strip 1 | Input gain |
| `CH1_EQ_LOW/MID/HIGH` | Strip 1 | 3-band EQ (centre = 0 dB) |
| `CH1_FX_SEND` | Strip 1 | FX send level |
| `CH2_INPUT_GAIN` | Strip 2 | Input gain |
| `CH2_EQ_LOW/MID/HIGH` | Strip 2 | 3-band EQ |
| `CH2_FX_SEND` | Strip 2 | FX send level |
| `AUX3_INPUT_GAIN` | AUX 3 | Input gain |
| `AUX3_EQ_LOW/MID/HIGH` | AUX 3 | 3-band EQ |
| `AUX3_FX_SEND` | AUX 3 | FX send level |
| `AUX4_INPUT_GAIN` | AUX 4 | Input gain |
| `AUX4_EQ_LOW/MID/HIGH` | AUX 4 | 3-band EQ |
| `AUX4_FX_SEND` | AUX 4 | FX send level |

> EQ potentiometers use a **power curve** centred at 0.5 — low sensitivity near 0 dB, increasing toward the extremes.  
> Curve exponent is configurable via `kCenteredPotExponent` in `SoftwareConfig.h` (default: 2.0 = quadratic).

### Master parametric EQ (MUX 2)

| Band | Freq pot | Gain pot | Range |
|---|---|---|---|
| SUB | `MASTER_EQ_SUB_FREQ` | `MASTER_EQ_SUB_GAIN` | 20–80 Hz |
| KICK | `MASTER_EQ_KICK_FREQ` | `MASTER_EQ_KICK_GAIN` | 80–200 Hz |
| MID | `MASTER_EQ_MID_FREQ` | `MASTER_EQ_MID_GAIN` | 200–1200 Hz |
| TOP | `MASTER_EQ_TOP_FREQ` | `MASTER_EQ_TOP_GAIN` | 1200–16000 Hz |

Gain range: ±`kMasterEqGainRangeDb` = **±6 dB**.

### Master graphic EQ — 12 bands (MUX 1 + MUX 2)

`GEQ_40HZ`, `GEQ_60HZ`, `GEQ_80HZ`, `GEQ_100HZ`, `GEQ_125HZ`, `GEQ_250HZ`,  
`GEQ_500HZ`, `GEQ_1KHZ`, `GEQ_2KHZ`, `GEQ_4KHZ`, `GEQ_8KHZ`, `GEQ_16KHZ`

Gain range: ±`kGEqGainRangeDb` = **±12 dB** per band.

### Master filter section (MUX 2)

| Constant | Function |
|---|---|
| `MASTER_HPF_FREQ` | HPF cutoff (20–2000 Hz); pot at 0 = filter OFF |
| `MASTER_HPF_RES` | HPF resonance (Q 0.7–4.5) |
| `MASTER_LPF_FREQ` | LPF cutoff (200–20000 Hz); pot at 0 = filter OFF |
| `MASTER_LPF_RES` | LPF resonance (Q 0.7–4.5) |

> HPF and LPF use a **soft bypass** (5 ms crossfade ramp on activation/deactivation) to prevent clicks.

### Band Trim (MUX 1)

| Constant | Band |
|---|---|
| `BTRIM_SUB` | Low-shelf @ 80 Hz |
| `BTRIM_KICK` | Peaking @ 126 Hz |
| `BTRIM_MID` | Peaking @ 490 Hz |
| `BTRIM_TOP` | High-shelf @ 1200 Hz |

Gain range: ±`kBandTrimGainDb` = **±6 dB**.

### Master gain

| Constant | Function |
|---|---|
| `MASTER_GAIN` | Master output level (0.0 = silence, 1.0 = unity) |

### Dub Siren (MUX 0 + MUX 3)

| Constant | Function |
|---|---|
| `SIREN_TYPE` | Preset selector (8 factory presets) |
| `SIREN_MOD` | LFO depth + rate |
| `SIREN_GAIN` | Output gain |
| `SIREN_FX_SEND` | FX send level |
| `SIREN_TRIGGER` (switch) | Gate: ON = siren active |

### MCP23017 — Switches

| Constant | Pin | Function |
|---|---|---|
| `KILL_KICK` | PA0 | Kill KICK band (80–200 Hz) |
| `KILL_SUB` | PA1 | Kill SUB band (20–80 Hz) |
| `KILL_MID` | PA2 | Kill MID band (200–1200 Hz) |
| `KILL_TOP` | PA3 | Kill TOP band (1200 Hz+) |
| `FX_FILTER_MIDS` | PA5 | FX send filter: MIDS only (250 Hz – 4 kHz) |
| `FX_FILTER_TOPS` | PA6 | FX send filter: TOPS only (> 4 kHz) |
| `SIREN_TRIGGER` | PA7 | Dub siren gate |

---

## Hardware wiring

### CD74HC4067 multiplexers

```
Bela D0 → S0 (address bit 0)    Bela A0 → MUX 0 signal
Bela D1 → S1 (address bit 1)    Bela A1 → MUX 1 signal
Bela D2 → S2 (address bit 2)    Bela A2 → MUX 2 signal
Bela D3 → S3 (address bit 3)    Bela A3 → MUX 3 signal
```

### MCP23017 (switches)

```
Bela SDA → SDA    Bela SCL → SCL
GND → GND         3.3V → VCC
A0 = A1 = A2 = GND → I2C address 0x20
```

### Audio routing

```
Bela IN0  → Channel Strip 1 (source)
Bela IN1  → Channel Strip 2 (source)
Bela IN2  → AUX Channel 3   (source)
Bela IN3  → AUX Channel 4   (source)
Bela IN9  → FX Return       (wet signal from external effect unit)

Bela OUT0 → Master L        (main output, mono)
Bela OUT1 → Master R        (main output, mono)
Bela OUT2 → FX Send         (all channels + siren, optionally filtered)
Bela OUT6 → VU TOP          (band-split for VU meter, > 1200 Hz)
Bela OUT7 → VU MID          (200–1200 Hz)
Bela OUT8 → VU KICK         (80–200 Hz)
Bela OUT9 → VU SUB          (< 80 Hz)
```

### Audio levels

- Nominal input level: **±316 mV** (line level –10 dBV)
- Maximum input before ADC clipping: **±1 V**
- Recommended source level: keep at 60–70% of maximum volume

---

## Configuration

### `HardwareConfig.h` — physical constants

```cpp
// Number of MUX boards physically connected (≤ kNumMux)
constexpr int kActiveMux = 4;

// Potentiometer calibration
constexpr float kPotMax = 0.997f;  // observed value at full rotation
constexpr float kPotMin = 0.005f;  // observed value at zero
```

### `SoftwareConfig.h` — DSP behaviour constants

```cpp
// Noise gate (per channel and FX return)
constexpr float kGateThreshold = 0.001f; // open threshold (≈ -60 dBFS)
constexpr float kGateHoldMs    = 100.f;  // hold time before closing after signal loss

// Kill switches
constexpr float kKillRampMs      = 30.f; // fade duration on toggle (ms)
constexpr int   kKillFilterStages = 2;   // slope: 1 → 12 dB/oct, 2 → 24 dB/oct

// Kill crossover frequencies
constexpr float kKillFc0 =   80.f;  // SUB  / KICK boundary
constexpr float kKillFc1 =  200.f;  // KICK / MID  boundary
constexpr float kKillFc2 = 1200.f;  // MID  / TOP  boundary

// Channel EQ
constexpr float kEqLowFreq      = 250.f;
constexpr float kEqMidFreq      = 1000.f;
constexpr float kEqHighFreq     = 4000.f;
constexpr float kEqGainRangeDb  = 6.f;    // ±6 dB
constexpr float kEqGainSmoothMs = 5.f;    // gain smoothing to prevent clicks

// Centered pot response curve
constexpr float kCenteredPotExponent = 2.0f; // 1.0=linear, 2.0=quadratic (recommended)

// Dub Siren
constexpr float kSirenGateAttackMs  = 5.f;
constexpr float kSirenGateReleaseMs = 80.f;
constexpr float kSirenGainScale     = 0.1f;

// Debug
constexpr bool kDebug = true;
```

### Adding a potentiometer

1. Wire to a MUX Sx input
2. Declare in `HardwareConfig.h`:
```cpp
// {mux, pot, reversed, name, centered}
constexpr PotRef MY_POT    = {0, 5, false, "MY_POT"};
constexpr PotRef MY_EQ_POT = {0, 5, false, "MY_EQ_POT", true}; // centred + power curve
```
3. Add to `kAllNamedPots[]` for automatic debug logging
4. Use in `render.cpp`:
```cpp
gHardwareManager.getPotValue(MY_POT)  // [0.0–1.0], power curve applied if centered=true
```

### Adding a switch

1. Wire to an MCP23017 PA or PB pin
2. Declare in `HardwareConfig.h`:
```cpp
// {pin, reversed, portB}
constexpr SwitchRef MY_SWITCH = {4, false, false}; // PA4, active LOW
```
3. Use in `render.cpp`:
```cpp
gHardwareManager.getSwitchState(MY_SWITCH)  // true = switch active
```

---

## Debug

Enable or disable logging in `SoftwareConfig.h`:

```cpp
constexpr bool kDebug = true;  // false = no pot/switch logging
```

With `kDebug = true`, any pot that moves beyond `kDebugPotMinMove` (0.01) prints:
```
[POT] CH1_INPUT_GAIN   MUX0/C01  →  0.742
[POT] GEQ_40HZ         MUX1/C07  →  0.500
[FX]  Send mode  →  MIDS (250Hz-4kHz)
```

Switch state changes:
```
[SW]  KILL_KICK        →  KILL
[SW]  SIREN_TRIGGER    →  ON
```

Clip detection is always active:
```
WARNING Canal 0 clipping
```

---

## Roadmap

- [x] Phase 1  — MUX scan via `HardwareManager` (real-time ADC scan)
- [x] Phase 2  — Input gain + 3-band EQ via `ChannelStrip`
- [x] Phase 3  — Per-channel noise gate (`NoiseGate`)
- [x] Phase 4  — MCP23017 switch reading via I2C (`AuxiliaryTask`)
- [x] Phase 5  — Click-free 4-band kill switches (`KillSwitch`, parallel crossover)
- [x] Phase 6  — FX Send / Return with gated return (`MasterFx`)
- [x] Phase 7  — Multi-MUX, multi-channel, centralised config
- [x] Phase 8  — Dub Siren (LFO oscillator + pitch drop + gate envelope)
- [x] Phase 9  — 4-band parametric EQ (`ParametricEq`, sweepable frequency)
- [x] Phase 10 — LPF and HPF filters with resonance (`FilterSection`)
- [x] Phase 11 — Per-band gain trim (`BandTrim`, ±6 dB, 4 bands)
- [x] Phase 12 — Master gain + graphic EQ 12 bands (`GraphicEq`)
- [x] Phase 13 — AUX 3 + AUX 4 channel strips
- [x] Phase 14 — VU meter band-split outputs (OUT6–OUT9)
- [x] Phase 15 — EQ gain smoothing (click-free pot sweeping, `kEqGainSmoothMs`)
- [x] Phase 16 — Power curve for centred pots (`kCenteredPotExponent`)
