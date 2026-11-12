# AGENTS.md — Working Context & Ground Truth for AI Agents

This file serves as the definitive source of truth for any AI agent or developer working on this codebase.  
Read this document completely before modifying any code.

---

## 1. Project Overview & Platform Constraints

- **Project Name:** Dub Preamp BELA GEM MULTI
- **Hardware Platform:** Bela Gem Multi (ARM Cortex-A8 Linux, Xenomai real-time co-kernel, 44.1 kHz, 10-in / 10-out audio codec)
- **Language Standard:** C++11
- **Target Toolchain:** ARM cross-compilation on Bela. Local linters (e.g. Clang / MSVC on host systems) may report false positives for `<cmath>`, `M_PI`, etc. — ignore those specific warnings.

---

## 2. Directory & Source File Map

```
src/
├── render.cpp              # Bela lifecycle entry point (setup / render / cleanup)
├── HardwareManager.h/.cpp  # Multiplexer scanning (CD74HC4067) + I2C GPIO expander (MCP23017)
├── HardwareConfig.h        # Physical wiring declarations: PotRef, SwitchRef, ClipLedRef, I/O routing
├── HardwareConfigData.cpp  # Default hardware mapping definitions & fallback runtime arrays
├── SoftwareConfig.h        # DSP behavior & sound parameters: EQ, gates, kills, siren, debug
├── ConfigLoader.h/.cpp     # Dynamic JSON loader for config.json (boot fallback to hardcoded defaults)
├── ChannelStrip.h/.cpp     # Channel strip processing: input gain → noise gate → 3-band EQ → FX sends
├── MasterFx.h/.cpp         # Master bus orchestrator: ParamEQ → GraphicEQ → Filter → Trim → Kills → Master Gain
├── DubSiren.h/.cpp         # Monophonic dub siren: phase accumulator OSC + LFO + pitch drop envelope
├── SamplePlayer.h/.cpp     # One-shot WAV/MP3 player (src/samples/), mixed at siren point
├── ParametricEq.h/.cpp     # 4-band master parametric EQ (SUB/KICK/MID/TOP, sweepable frequencies)
├── GraphicEq.h/.cpp        # 12-band fixed-frequency graphic EQ (40 Hz … 16 kHz)
├── FilterSection.h/.cpp    # Master resonant HPF + LPF with soft crossfade bypass
├── BandTrim.h/.cpp         # 4-band gain trim (±6 dB) post-crossover (SUB/KICK/MID/TOP)
├── KillSwitch.h/.cpp       # Click-free 4-band parallel crossover kill (24 dB/oct)
├── NoiseGate.h/.cpp        # Downward gate: peak follower + ATTACK/HOLD/RELEASE state machine
├── Biquad.h/.cpp           # 2nd-order IIR biquad filter (shelf, peak, LP, HP)
├── BrickwallLimiter.h      # Output peak limiter / safety guard
├── DspUtils.h              # DSP helper functions (interpolation, conversions, smoothing)
└── samples/                # Directory containing one-shot audio samples (*.wav, *.mp3)

gui/                        # ES6 source modules for Bela Web GUI (edit here!)
src/sketch.js               # Bundled GUI output generated via esbuild (do not edit manually!)
docs/                       # Modular technical documentation
config.json                 # Optional runtime hardware/routing override configuration
```

### Configuration Separation Rule
- **Physical Wiring & Hardware:** Belong exclusively in `HardwareConfig.h` / `HardwareConfigData.cpp` / `config.json`.
- **DSP Behavior & Audio Tuning:** Belong exclusively in `SoftwareConfig.h`.
- **No Magic Numbers:** All values must be named constants or configurable parameters.

---

## 3. Real-Time Threading Model (CRITICAL RULES)

The Bela system executes with strict real-time guarantees under Xenomai Linux:

| Thread | Priority | Permitted Operations |
|---|---|---|
| **Audio RT `render()`** | 95+ (Xenomai) | `scanStep()`, `getPotValue()`, `getSwitchState()`, and all audio DSP |
| **`AuxiliaryTask`** | 50 (Linux RT) | `readMcp23017()` exclusively (blocking I2C transactions) |
| **System / Browser** | Standard | Bela Web IDE, oscilloscope, kernel logs, WebSocket server |

### Absolute Prohibitions in `render()`:
1. **Never make I2C calls or any blocking I/O calls.**
2. **Never invoke dynamic memory allocations (`malloc`, `free`, `new`, `delete`).**
3. **Never use `printf` standard output — use `rt_printf` instead.**
4. **Never instantiate dynamic STL containers (`std::vector`, `std::string`, `std::map`, etc.). Preallocate all storage during `setup()`.**

---

## 4. Signal Flow & Routing Architecture

```
IN2,3 (AUX1 L/R) ──► ChannelStrip 1 ──► dry1 ──┐
IN4,5 (AUX2 L/R) ──► ChannelStrip 2 ──► dry2 ──┤ fxSend1 (sum) ──► mode filter ──► OUT0 (FX1 Send)
IN6,7 (AUX3 L/R) ──► ChannelStrip 3 ──► dry3 ──┤ fxSend2 (sum) ──► mode filter ──► OUT1 (FX2 Send)
IN8,9 (AUX4 L/R) ──► ChannelStrip 4 ──► dry4 ──┤
                      DubSiren ───────► siren ─┤
                      SamplePlayer ───► sample ┘ (shares siren gain / FX sends; UI triggered)
                                               │
                                            dry sum
                                               │
IN0 (FX1 Return) ──► NoiseGate (fx1Gate_) ────►┤
IN1 (FX2 Return) ──► NoiseGate (fx2Gate_) ────►┤
                                               ▼
                                      MasterFx.process()
                                       ParametricEq (4 sweepable peaking bands)
                                       → GraphicEq (12 fixed peaking bands)
                                       → FilterSection (resonant HPF → LPF, warm soft-bypass)
                                       → BandTrim (4 bands ±6 dB)
                                       → KillSwitch (4-band parallel crossover 24 dB/oct)
                                       → × masterGain
                                               │
                                     gMasterFx (L)    gMasterFxR (R)
                                               │              │
                                         OUT2 (L)          OUT3 (R)  (mono summed if MASTER_STEREO=false)

VU Meter (post-master, band-split analog/PWM outputs):
  OUT6 TOP  (> 1200 Hz)
  OUT7 MID  (200–1200 Hz)
  OUT8 KICK (80–200 Hz)
  OUT9 SUB  (< 80 Hz)
```

### ChannelStrip Signal Flow:
```
IN → × inputGain_ → NoiseGate → 3-Band EQ (low shelf / mid peak / high shelf) → Dry Output
                                         └─────────── × fxSendLevel_ ─────────► FX Send Out
```

### Stereo & Mono Topologies:
- **Input Channels:**
  - `audioIns = [N, -1]` (Mono): Same physical input channel processed by left and right channel strips.
  - `audioIns = [L, R]` (Stereo): `gChannelStripX` processes `IN_L`, `gChannelStripXR` processes `IN_R`.
  - Configurable via `config.json` (`"channels": [2, 3]`).
- **Master Output:**
  - `MASTER_OUTS = [L, R]` with `MASTER_STEREO = true`: `OUT2 = Left`, `OUT3 = Right` (two independent `MasterFx` engines).
  - `MASTER_OUTS = [L, R]` with `MASTER_STEREO = false`: Both outputs deliver constant-power summed mono: `kMonoFoldDownGain * (outL + outR)` (0.7071f / -3 dB, AES standard) with optional high-shelf air compensation filter (`kMonoAirCompEnabled = true`, 8 kHz, +1.5 dB) and a dedicated brickwall limiter.
  - Can be toggled on-the-fly without reboot via Web GUI (`Bela.control`: `{ event: 'custom', masterStereo: bool }`) using a click-free 20 ms crossfade (`kMonoCrossfadeMs`).

---

## 5. Physical Audio Routing (Bela Gem Multi — 10 I/O)

| Signal | Bela Gem Multi I/O | HardwareConfig Constant |
|---|---|---|
| **FX 1 Return** | IN0 | `FX1_RETURN_IN` |
| **FX 2 Return** | IN1 | `FX2_RETURN_IN` |
| **AUX 1 Source (L/R)** | IN2, IN3 | `AUX1_CONFIG.audioIns[0, 1]` |
| **AUX 2 Source (L/R)** | IN4, IN5 | `AUX2_CONFIG.audioIns[0, 1]` |
| **AUX 3 Source (L/R)** | IN6, IN7 | `AUX3_CONFIG.audioIns[0, 1]` |
| **AUX 4 Source (L/R)** | IN8, IN9 | `AUX4_CONFIG.audioIns[0, 1]` |
| **FX 1 Send** | OUT0 | `FX1_SEND_OUT` |
| **FX 2 Send** | OUT1 | `FX2_SEND_OUT` |
| **Master Left** | OUT2 | `MASTER_OUTS[0]` |
| **Master Right** | OUT3 | `MASTER_OUTS[1]` (active when `MASTER_OUTS_COUNT >= 2`) |
| **VU Meter TOP** | OUT6 | `VU_TOP_OUT` (> 1200 Hz) |
| **VU Meter MID** | OUT7 | `VU_MID_OUT` (200–1200 Hz) |
| **VU Meter KICK** | OUT8 | `VU_KICK_OUT` (80–200 Hz) |
| **VU Meter SUB** | OUT9 | `VU_SUB_OUT` (< 80 Hz) |

---

## 6. Hardware Mapping & Topologies

- **Multiplexers:** 8 active CD74HC4067 chips (`kActiveMux = 8`, 10 channels each, channels 0..9).
  - MUX 0: AUX 1 (Gain, EQ 3-band, FX Send 1 & 2) + FX Return Gains (1 & 2)
  - MUX 1: AUX 2 (Gain, EQ 3-band, FX Send 1 & 2) + Graphic EQ (1 kHz, 2 kHz)
  - MUX 2: AUX 3 (Gain, EQ 3-band, FX Send 1 & 2) + Graphic EQ (4 kHz, 8 kHz)
  - MUX 3: AUX 4 (Gain, EQ 3-band, FX Send 1 & 2) + Graphic EQ (16 kHz)
  - MUX 4: Master Parametric EQ (Freq + Gain × 4) + Master HPF (Freq + Res)
  - MUX 5: Master LPF (Freq + Res) + Band Trim (4 bands) + Master Gain + Graphic EQ (250 Hz, 500 Hz)
  - MUX 6: Dub Siren (Type, Mod, Gain, FX Send 1 & 2) + Graphic EQ (40 Hz .. 125 Hz)
  - MUX 7: Expansion / Aux channels (0 to 9)

- **Switches (MCP23017 I2C GPIO expander, 0x20..0x27):**
  - 4 Kills: `KILL_SUB`, `KILL_KICK`, `KILL_MID`, `KILL_TOP`
  - 2 Modes FX1 Send: `FX_FILTER_MIDS`, `FX_FILTER_TOPS`
  - 2 Modes FX2 Send: `FX2_FILTER_MIDS`, `FX2_FILTER_TOPS`
  - 1 Siren Gate: `SIREN_TRIGGER`

- **Hardware Clip LEDs (MCP23017 outputs):**
  - `CLIP_LED_MASTER`, `CLIP_LED_AUX1`, `CLIP_LED_AUX2`, `CLIP_LED_AUX3`, `CLIP_LED_AUX4`

---

## 7. Key DSP Parameters (SoftwareConfig.h)

| Constant | Value | Purpose |
|---|---|---|
| `kGateThreshold` | 0.001 | Gate opening threshold (≈ -60 dBFS) |
| `kGateAttackMs` | 2 ms | Gate opening ramp speed |
| `kGateHoldMs` | 100 ms | Gate hold duration before starting release |
| `kGateReleaseMs` | 150 ms | Gate closing ramp speed |
| `kKillRampMs` | 30 ms | Fade duration when toggling band kills |
| `kKillFilterStages` | 2 | Crossover slope: 2 stages = 24 dB/oct per band |
| `kKillFc0` | 80 Hz | Crossover boundary SUB / KICK |
| `kKillFc1` | 200 Hz | Crossover boundary KICK / MID |
| `kKillFc2` | 1200 Hz | Crossover boundary MID / TOP |
| `kEqLowFreq` | 250 Hz | Channel low shelf frequency |
| `kEqMidFreq` | 1000 Hz | Channel mid peak frequency |
| `kEqHighFreq` | 4000 Hz | Channel high shelf frequency |
| `kEqGainRangeDb` | 6 dB | Channel EQ gain range (±6 dB) |
| `kEqGainSmoothMs` | 5 ms | Gain change smoothing to prevent audible clicks |
| `kMasterEqGainRangeDb` | 6 dB | Master parametric EQ range (±6 dB) |
| `kGEqGainRangeDb` | 12 dB | Master graphic EQ range (±12 dB) |
| `kBandTrimGainDb` | 6 dB | Band Trim range (±6 dB) |
| `kHpfFMin` / `FMax` | 20–2000 Hz | Master HPF sweepable range |
| `kLpfFMin` / `FMax` | 200–20000 Hz | Master LPF sweepable range |
| `kFilterQMin` / `Max` | 0.7–4.5 | Master filter resonance range |
| `kFilterOffThreshold` | 0.01 | Pot threshold below which filter is bypassed |
| `kFilterBypassRampMs` | 5 ms | Crossfade ramp time for filter soft-bypass |
| `kSnapRadiusCenter` | 0.03 | Center deadband radius for centered pots (snaps to 0.5) |
| `kPotSmoothingCoeff` | 0.15 | 1st-order EMA low-pass filter coefficient for ADC reads |
| `kSirenGateAttackMs` | 5 ms | Dub Siren gate attack time |
| `kSirenGateReleaseMs`| 80 ms | Dub Siren gate release time |
| `kSirenGainScale` | 0.1 | Siren volume scaling relative to audio channels |
| `kSamplerGainScale` | 0.35 | WAV sampler volume scaling (mixed with siren) |
| `kFxMidLowFreq` | 250 Hz | Lower cutoff for FX send MIDS mode |
| `kFxMidHighFreq` | 4000 Hz | Upper cutoff for FX send MIDS / threshold for TOPS |
| `kSignalPresentThreshold` | 0.01585 | Low threshold for channel signal presence (≈ -36 dBFS) |
| `kSignalFlashDurationMs` | 35 ms | Duration of subtle pulse for signal presence |
| `kSignalFlashPeriodMs` | 1000 ms | Repetition rate (1 Hz) for signal presence on continuous audio |
| `kClipThreshold` | 0.9441 | Digital clip detection ceiling (≈ -0.5 dBFS) |
| `kClipLedHoldMs` | 1200 ms | Solid peak hold duration for digital clip LED (1.2 s) |
| `kDebug` | true | Controls real-time terminal debug logging |

---

## 8. Non-Negotiable Architectural Decisions (ADRs)

1. **MUX Scanning in `render()`, NEVER in an `AuxiliaryTask`:**  
   `analogRead()` and `digitalWrite()` require a valid `BelaContext*` and must execute in the hard real-time audio thread. Calling them from an auxiliary task causes non-deterministic values and ADC corruption.
2. **Parallel Crossover with Dual Ramping for Kill Switches:**  
   The crossover extracts all 4 bands in parallel directly from the input signal (never chained in series) to guarantee zero inter-band bleed. Switching between global bypass and the crossover uses a per-sample smooth ramp (`crossoverMix_`) alongside individual `bandGain_` ramps to avoid switching pops.
3. **Single-Threshold Noise Gate (No Hysteresis):**  
   Dual-threshold hysteresis was evaluated and deliberately removed because it chopped off low-level audio tails. A single threshold combined with a generous hold time (`kGateHoldMs = 100 ms`) is confirmed stable and musically transparent.
4. **Per-Sample EQ Gain Smoothing:**  
   In all EQ classes (`ChannelStrip`, `ParametricEq`, `GraphicEq`, `BandTrim`), gains are smoothed using a one-pole low-pass filter (`kEqGainSmoothMs = 5 ms`). Biquad coefficients are recalculated only when smoothed gain drifts by more than `kGainEpsilonDb` (0.05 dB), eliminating zipper noise during sweeps.
5. **Automatic Filter Bypass in EQ:**  
   When all smoothed gains are within `kGainEpsilonDb`, the biquad calculation loop is cleanly bypassed. This decision uses smoothed gains (not raw targets) to avoid premature bypass during decay.
6. **FilterSection Soft Bypass with Warm Filter State:**  
   Both HPF and LPF biquads run continuously in `FilterSection::process()`, even when dry/wet mix is zero. This keeps their internal delay lines ($z_1, z_2$) updated and prevents clicks upon re-engagement. Transitions are smoothed over 5 ms.
7. **Center Snapping & Linear Response for Centered Pots:**  
   `getCenteredPotValue()` applies a symmetrical linear response around 0.5 with a dedicated deadband:
   - If $|v - 0.5| \le kSnapRadiusCenter$ (0.03): output snaps strictly to `0.5` (0 dB center detent).
   - Otherwise: evolves linearly towards `0.0` or `1.0`.  
   *(Replaces legacy quadratic power curves).*
8. **ADC Potentiometer EMA Low-Pass Filtering:**  
   A 1st-order EMA filter (`kPotSmoothingCoeff = 0.15`) attenuates high-frequency ADC noise by ~22 dB in `HardwareManager::scanStep()`, eliminating jitter without perceptible latency (~70 ms rise time). First scan initializes directly without ramping, and hard limits (0.0 and 1.0) snap cleanly.
9. **Parametric EQ: Block-Rate Frequency Recalculation:**  
   Frequency sweeps update filter coefficients at block-rate (~5.8 ms) using the *current smoothed gain* rather than the target gain to avoid gain discontinuities.

---

## 9. Bela Web GUI Workflow

- The browser GUI lives at `http://bela.local/gui/`.
- Bela IDE loads exclusively from `src/sketch.js`. It does not support ES6 modules natively in browser context.
- **Workflow:**
  1. Edit modular source files in `gui/` (`main.js`, `config.js`, `dom/*`, `bela/*`).
  2. Run `npm run build:gui` to compile bundle into `src/sketch.js` via esbuild.
  3. Deploy the project to Bela.
- **Sample Player:** Loads audio files from `src/samples/*.{wav,mp3}` during `setup()` via `AudioFileUtilities`. Samples are triggered via WebSocket messages (`{ event: 'custom', samplerPlay: index }`).

---

## 10. Code & Quality Conventions

1. **Documentation:** All public class methods must include concise doc-comments in **English**.
2. **Single Responsibility:** Classes should have a single well-defined mission.
3. **No Duplication:** Common logic must be factored into reusable utilities or objects (`DspUtils`).
4. **Naming Standards:**
   - Private member variables: trailing underscore (`gain_`, `smoothLow_`).
   - Software/DSP constants: `k`-prefix in camelCase (`kGateThreshold`, `kKillRampMs`).
   - Hardware pins and config references: uppercase (`MASTER_OUTS`, `AUX1_CONFIG`, `KILL_SUB`).
