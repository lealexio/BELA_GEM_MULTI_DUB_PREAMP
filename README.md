# Bela Gem Multi — Dub Preamp

Reggae/dub digital preamp implemented on **Bela Gem Multi** in C++.  
Ultra-low-latency real-time audio processing, driven by multiplexed physical potentiometers and I2C GPIO switches.

---

## Architecture

```
                 ┌──────────────────────────────────────────────┐
IN0 ─────────►  │ ChannelStrip 1                               │
                 │  gain → NoiseGate → 3-band EQ               │ ──► FX SEND (OUT2)
IN1 ─────────►  │ ChannelStrip 2                               │
                 │  gain → NoiseGate → 3-band EQ               │
                 └────────────────────┬─────────────────────────┘
                                      │ dry mix
                 ┌────────────────────▼─────────────────────────┐
FX RETURN (IN2) ►│ MasterFx                                     │
                 │  NoiseGate (FX return) + 4-band KillSwitch   │
                 └────────────────────┬─────────────────────────┘
                                      │
                               OUT0 + OUT1 (mono)
```

### Source files

| File | Role |
|---|---|
| `render.cpp` | Bela entry point: setup / render / cleanup — orchestrates all modules |
| `HardwareManager.h/cpp` | MUX scan (CD74HC4067) + switch reading (MCP23017 via I2C) |
| `ChannelStrip.h/cpp` | Channel strip: gain → gate → 3-band EQ → FX send |
| `MasterFx.h/cpp` | Master bus: 4-band KillSwitch + FX return noise gate |
| `KillSwitch.h/cpp` | Click-free 4-band parallel crossover kill |
| `NoiseGate.h/cpp` | Professional gate: peak follower + ATTACK/HOLD/RELEASE state machine |
| `Biquad.h/cpp` | 2nd-order IIR biquad filter (low/high shelf, peaking EQ, LP/HP) |
| `HardwareConfig.h` | Hardware mapping: PotRef, SwitchRef, audio routing, I2C/MUX config |
| `SoftwareConfig.h` | DSP parameters: EQ frequencies, kills, gate, debug, clipping |

---

## Physical controls

### MUX 0 — Channel Strip 1 (IN0)

| Pot | Constant | Function |
|---|---|---|
| C01 | `CH1_INPUT_GAIN` | Input gain (0.0 = silence, 1.0 = unity) |
| C14 | `CH1_EQ_LOW` | Low shelf @ `kEqLowFreq` Hz (centre = 0 dB) |
| C00 | `CH1_EQ_MID` | Mid peak  @ `kEqMidFreq` Hz (centre = 0 dB) |
| C15 | `CH1_EQ_HIGH` | High shelf @ `kEqHighFreq` Hz (centre = 0 dB) |
| C13 | `CH1_FX_SEND` | FX send level (post-fader) |

### MUX 0 — Channel Strip 2 (IN1)

| Pot | Constant | Function |
|---|---|---|
| C06 | `CH2_INPUT_GAIN` | Input gain |
| C09 | `CH2_EQ_LOW` | Low shelf |
| C07 | `CH2_EQ_MID` | Mid peak |
| C08 | `CH2_EQ_HIGH` | High shelf |
| C10 | `CH2_FX_SEND` | FX send level |

> EQ potentiometers have a **centre snap** (snap to 0.5 → 0 dB).  
> Snap radius is configurable via `kSnapRadiusCenter` in `SoftwareConfig.h`.

### MCP23017 — Kill switches (port A)

| Pin | Constant | Band |
|---|---|---|
| PA0 | `KILL_KICK` | KICK  80 – 200 Hz |
| PA1 | `KILL_SUB` | SUB   20 – 80 Hz |
| PA2 | `KILL_MID` | MID   200 – 1200 Hz |
| PA3 | `KILL_TOP` | TOP   1200 Hz+ |

> Each switch has a `reversed` flag in `HardwareConfig.h` to invert its logic.

---

## Hardware wiring

### CD74HC4067 multiplexers

```
Bela D0 → S0 (address bit 0)    Bela A0 → MUX 0 signal
Bela D1 → S1 (address bit 1)    Bela A1 → MUX 1 signal
Bela D2 → S2 (address bit 2)    Bela A2 → MUX 2 signal
Bela D3 → S3 (address bit 3)    Bela A3 → MUX 3 signal (reserved)
```

### MCP23017 (switches)

```
Bela SDA → SDA    Bela SCL → SCL
GND → GND         3.3V → VCC
A0 = A1 = A2 = GND → I2C address 0x20
```

### Audio routing

```
Bela IN0  → Channel Strip 1 (input source)
Bela IN1  → Channel Strip 2 (input source)
Bela IN2  → FX Return (wet signal from external effect unit)
Bela OUT0 → Master L (main output)
Bela OUT1 → Master R (main output, same signal — mono)
Bela OUT2 → FX Send  (sum of both channel FX sends)
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
constexpr int kActiveMux = 3;

// Potentiometer calibration
constexpr float kPotMax = 0.997f;  // observed value at full rotation
constexpr float kPotMin = 0.005f;  // observed value at zero

// To add a MUX: increment kActiveMux, uncomment the MUX1 PotRef lines at the bottom of the file
```

### `SoftwareConfig.h` — DSP behaviour constants

```cpp
// Noise gate (per channel and FX return)
constexpr float kGateThreshold = 0.005f; // open threshold (≈ -46 dBFS)
constexpr float kGateHoldMs    = 100.f;  // hold time before closing after signal loss

// Kill switches
constexpr float kKillRampMs      = 30.f; // fade duration on toggle (ms)
constexpr int   kKillFilterStages = 2;   // slope: 1 → 12 dB/oct, 2 → 24 dB/oct

// Kill crossover frequencies
constexpr float kKillFc0 =   80.f;  // SUB  / KICK boundary
constexpr float kKillFc1 =  200.f;  // KICK / MID  boundary
constexpr float kKillFc2 = 1200.f;  // MID  / TOP  boundary

// Channel EQ
constexpr float kEqLowFreq     = 250.f;
constexpr float kEqMidFreq     = 1000.f;
constexpr float kEqHighFreq    = 4000.f;
constexpr float kEqGainRangeDb = 6.f;   // ±6 dB EQ range

// Debug
constexpr bool kDebug = true;
```

### Adding a potentiometer

1. Wire to a MUX Sx input
2. Declare in `HardwareConfig.h`:
```cpp
constexpr PotRef MY_POT     = {0, 5};        // MUX 0, channel 5
constexpr PotRef MY_POT_INV = {0, 5, true};  // same, reversed rotation
```
3. Use in `render.cpp`:
```cpp
gHardwareManager.getPotValue(MY_POT)           // [0.0–1.0]
gHardwareManager.getCenteredPotValue(MY_POT)   // with centre snap to 0.5
```

### Adding a switch

1. Wire to an MCP23017 PA pin
2. Declare in `HardwareConfig.h`:
```cpp
constexpr SwitchRef MY_SWITCH     = {4};        // PA4, active LOW
constexpr SwitchRef MY_SWITCH_INV = {4, true};  // PA4, active HIGH
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
[POT] CH2_EQ_MID       MUX0/C07  →  0.501
```

Switch state changes are printed immediately:
```
[SW]  PA1  →  CLOSED
[SW]  PA1  →  OPEN
```

To exclude a noisy pot from the log (floating input, under investigation…), add it to `HardwareConfig.h`:
```cpp
constexpr PotRef kIgnoredPots[] = {
    {1, 2},  // MUX1/C02 — under investigation
};
```

Clip detection is always active, regardless of `kDebug`:
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
- [ ] Phase 8  — Dub Siren (LFO oscillator + pitch drop + gate)
- [ ] Phase 9  — 4-band parametric EQ
- [ ] Phase 10 — LPF and HPF filters with resonance
- [ ] Phase 11 — Per-band gain
- [ ] Phase 12 — Master gain
