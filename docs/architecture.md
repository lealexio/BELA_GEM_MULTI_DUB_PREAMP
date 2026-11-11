# System Architecture & Audio DSP

This document details the signal processing chain, real-time audio constraints, and software component architecture of the **Bela Gem Multi Dub Preamp**.

---

## 1. Complete Signal Flow

The preamp combines four auxiliary audio sources (mono or stereo), an internal analog-modeled Dub Siren, a one-shot sample player, dual external FX loops, and a comprehensive master shaping bus.

```
                  AUXILIARY INPUTS & SOUND GENERATORS
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
                                                 ▼
                                         [ gMasterFx L/R ]
                                                 │
                                    ┌────────────┴────────────┐
                                    ▼                         ▼
                              OUT2 (Master L)           OUT3 (Master R)
                              (or summed mono if MASTER_STEREO is false)

                                  ANALOG / PWM VU OUTPUTS
                              OUT6: TOP Band     (> 1200 Hz)
                              OUT7: MID Band     (200 – 1200 Hz)
                              OUT8: KICK Band    (80 – 200 Hz)
                              OUT9: SUB Band     (< 80 Hz)
```

---

## 2. Channel Strip Architecture

Each of the 4 auxiliary input channels runs through an identical `ChannelStrip` pipeline:

```
Audio Input ──► Input Gain ──► NoiseGate ──► 3-Band EQ ──► Dry Output
                                                  │
                                                  ├─► × fxSend1 ──► fxOut1
                                                  └─► × fxSend2 ──► fxOut2
```

1. **Input Gain:** Pre-amplification with clipping supervision.
2. **Noise Gate:** State-machine gate with peak envelope follower (`kGateThreshold`, 2 ms attack, 100 ms hold, 150 ms release). Silences background noise, hum, and open turntable inputs.
3. **3-Band Channel EQ:**
   - Low-shelf biquad (`kEqLowFreq = 250 Hz`)
   - Peaking mid-band biquad (`kEqMidFreq = 1000 Hz`)
   - High-shelf biquad (`kEqHighFreq = 4000 Hz`)
   - Gain range: ±6 dB (`kEqGainRangeDb`)
   - All gains are smoothed per-sample (`kEqGainSmoothMs = 5 ms`). If all smoothed gains are near zero (< 0.05 dB), filter computation is bypassed.
4. **Dual FX Sends:** Independent gain tap per auxiliary channel post-EQ for FX1 and FX2.
5. **Mic Mode:** When a channel is designated as a microphone input in `config.json`, the master EQ, filters, and kills are bypassed on its dry path, while retaining an optional high-pass rumble filter (`hpfHz`).

---

## 3. FX Sends & Returns

The preamp features two independent external effect loops:

- **FX Send Filtering:** Each FX send bus can be routed unfiltered or shaped by a hardware switch:
  - `MIDS`: Bandpass isolating 250 Hz to 4 kHz.
  - `TOPS`: High-pass isolating above 4 kHz.
  - `OFF` (Normal): Full-range signal sent to external delays/reverbs.
- **FX Returns:** External effects return on `IN0` (FX1) and `IN1` (FX2), pass through dedicated noise gates (`fx1Gate_`, `fx2Gate_`), gain scaling pots, and inject directly into the master bus summing point.

---

## 4. Master Bus DSP Pipeline

### 4.1 4-Band Parametric EQ (`ParametricEq`)
- **Bands:** SUB (20–80 Hz), KICK (80–200 Hz), MID (200–1200 Hz), TOP (1.2–16 kHz).
- **Control:** Logarithmic frequency sweep and ±6 dB gain peaking filter per band.
- **Recalculation:** Frequency updates occur at block rate (~5.8 ms) using current smoothed gains to prevent audible artifacts. Gain values are smoothed per-sample.

### 4.2 12-Band Graphic EQ (`GraphicEq`)
- **Fixed Center Frequencies:** 40, 60, 80, 100, 125, 250, 500, 1000, 2000, 4000, 8000, 16000 Hz.
- **Gain Range:** ±12 dB per band.
- Individual biquad stages with per-sample gain interpolation and automatic idle bypass.

### 4.3 Resonant Filter Section (`FilterSection`)
- **High-Pass Filter (HPF):** Sweepable 20 Hz – 2 kHz, resonance $Q \in [0.7, 4.5]$.
- **Low-Pass Filter (LPF):** Sweepable 200 Hz – 20 kHz, resonance $Q \in [0.7, 4.5]$.
- **Soft Bypass & Warm State:** Both filters process samples continuously, maintaining their internal delay line history ($z_1, z_2$). Turning a filter pot to zero triggers a 5 ms linear crossfade to dry bypass, guaranteeing click-free re-engagement during live performance sweeps.

### 4.4 Band Trim (`BandTrim`)
- Precise ±6 dB fine-tuning post-crossover across SUB (80 Hz shelf), KICK (126 Hz peak), MID (490 Hz peak), and TOP (1.2 kHz shelf).

### 4.5 Click-Free Kill Switches (`KillSwitch`)
- **Topology:** True 4-way **parallel crossover** (24 dB/oct Linkwitz-Riley equivalent using 2 cascaded 2nd-order stages).
- **Boundaries:** 80 Hz, 200 Hz, 1200 Hz.
- **Click Elimination:** Uses two concurrent ramps:
  1. Per-band linear gain ramp (30 ms).
  2. Master crossover engage/disengage crossfade (`crossoverMix_`). When all kills are inactive, the signal path bypasses the crossover entirely; as soon as any kill is activated, the crossover transitions smoothly into the path.

### 4.6 Master Output & Stereo / Mono Fold-Down
- **Stereo Mode (`MASTER_STEREO = true`):** Left channel outputs to `OUT2`, Right channel outputs to `OUT3`, driven by two independent `MasterFx` and `BrickwallLimiter` instances.
- **Mono Fold-Down (`MASTER_STEREO = false`):**
  - **Constant Power Summing:** Uses `kMonoFoldDownGain = 0.7071f` ($\approx -3\text{ dB}$, AES/EBU broadcast standard) rather than linear division, preserving perceived acoustic loudness of stereo side elements, reverbs, and stereo sample plays.
  - **Air Compensation:** A subtle high-shelf boost (`kMonoAirCompEnabled = true`, 8 kHz, +1.5 dB) counteracts comb-filtering phase cancellation in high frequencies before final limiting.
  - **Anti-Click Crossfade:** Toggling between stereo and mono live in the Web GUI applies a 20 ms linear crossfade (`kMonoCrossfadeMs = 20.0f`).
  - **Dedicated Mono Limiter:** Mono fold-down passes through its own `gMonoLimiter` (`BrickwallLimiter`) to ensure zero inter-sample peak distortion.

---

## 5. Real-Time Threading Model (Xenomai)

Bela runs a dual-kernel architecture (Linux OS + Xenomai real-time co-kernel):

```
                   ┌──────────────────────────────────────────────┐
                   │           AUDIO RT THREAD (Priority 95+)     │
                   │  - render() callback (every ~0.36 ms / 16 smp)│
                   │  - Multiplexer scan (analogRead, digiWrite)  │
                   │  - Complete Audio DSP calculation            │
                   └──────────────────────┬───────────────────────┘
                                          │ Non-blocking
                                          │ Shared memory buffers
                                          ▼
                   ┌──────────────────────────────────────────────┐
                   │         AUXILIARY TASK (Priority 50)         │
                   │  - readMcp23017() I2C switch / LED reads     │
                   └──────────────────────┬───────────────────────┘
                                          │ Async events
                                          ▼
                   ┌──────────────────────────────────────────────┐
                   │             LINUX USER SPACE                 │
                   │  - Bela Web IDE & WebSocket Server           │
                   │  - p5.js Web GUI (HTTP / WS)                 │
                   │  - Linux network stack / Wi-Fi               │
                   └──────────────────────────────────────────────┘
```

### Safety Rules:
- **Zero Allocations:** Memory allocation (`malloc`, `new`) is strictly prohibited in `render()`.
- **Zero Blocking I/O:** I2C transactions (MCP23017) are decoupled into the `AuxiliaryTask` thread to protect the audio buffer from buffer underruns (dropouts / mode switches).
- **Fast Math & Approximations:** Smoothers and filters use fast single-pole IIR routines (`y += coeff * (target - y)`).

---

## 6. C++ Class Directory

| Class | Location | Primary Role |
|---|---|---|
| `render.cpp` | `src/` | Bela audio lifecycle, buffer distribution, auxiliary task orchestration |
| `HardwareManager` | `src/` | MUX analog acquisition, MCP23017 I2C communication, pot centering/smoothing |
| `HardwareConfig` | `src/` | Physical hardware constants, pin assignments, runtime routing definitions |
| `SoftwareConfig` | `src/` | DSP frequencies, ramp timings, thresholds, and operational limits |
| `ConfigLoader` | `src/` | Parses `config.json` at boot; falls back to `HardwareConfigData.cpp` |
| `ChannelStrip` | `src/` | Single channel processing (gain, gate, 3-band EQ, dual FX sends) |
| `MasterFx` | `src/` | Master signal chain host (orchestrates ParamEQ, GraphicEQ, Filter, Trim, Kills) |
| `DubSiren` | `src/` | Digital Dub Siren synthesis (pitch-drop envelope, multi-waveform LFO) |
| `SamplePlayer` | `src/` | One-shot sample player loading WAV/MP3 files from `src/samples/` |
| `ParametricEq` | `src/` | 4-band sweepable parametric peaking equalizer |
| `GraphicEq` | `src/` | 12-band ISO graphic equalizer |
| `FilterSection` | `src/` | Resonant HPF and LPF with click-free soft crossfade |
| `BandTrim` | `src/` | 4-band ±6 dB balance adjustment |
| `KillSwitch` | `src/` | 4-band parallel crossover kill system with 30 ms ramping |
| `NoiseGate` | `src/` | Downward audio gate with peak detection and envelope state machine |
| `Biquad` | `src/` | Canonical direct form II transposed biquad filter |
| `BrickwallLimiter` | `src/` | Master audio peak protector |
| `DspUtils` | `src/` | Fast math, logarithmic interpolation, decibel/linear conversion helpers |
