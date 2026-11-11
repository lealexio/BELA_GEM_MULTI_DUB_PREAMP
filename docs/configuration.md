# Configuration & Calibration Guide

This guide describes how to configure the preamp at runtime via `config.json`, tune DSP behavior in `SoftwareConfig.h`, and add new physical controls.

---

## 1. Runtime Configuration (`config.json`)

The firmware loads settings dynamically from `config.json` located at the root of the project upon boot.  
If `config.json` is missing or invalid, the system automatically falls back to default hardcoded configurations in `src/HardwareConfigData.cpp`.

### 1.1 Complete `config.json` Structure Example

```json
{
  "mux": {
    "activeMux": 8
  },
  "calibration": {
    "potScaleRecovery": 1.2412,
    "potMin": 0.005,
    "potMax": 0.997
  },
  "i2c": {
    "bus": "/dev/i2c-1",
    "address": "0x20"
  },
  "routing": {
    "in": {
      "aux1": { "channels": [2, 3], "mic": false, "hpf": 0, "gain": 0 },
      "aux2": { "channels": [4, 5], "mic": false, "hpf": 0, "gain": 0 },
      "aux3": { "channels": [6, 7], "mic": false, "hpf": 0, "gain": 0 },
      "aux4": { "channels": [8, 9], "mic": false, "hpf": 0, "gain": 0 },
      "fx1Return": { "channel": 0, "gain": 0 },
      "fx2Return": { "channel": 1, "gain": 0 }
    },
    "out": {
      "master": { "channels": [2, 3], "stereo": true, "gain": 0 },
      "fx1Send": { "channel": 0, "gain": 0 },
      "fx2Send": { "channel": 1, "gain": 0 },
      "vu": {
        "top": 6,
        "mid": 7,
        "kick": 8,
        "sub": 9
      }
    }
  },
  "switches": {
    "killSub": { "pin": 1, "reversed": false, "portB": false },
    "killKick": { "pin": 0, "reversed": false, "portB": false },
    "killMid": { "pin": 2, "reversed": false, "portB": false },
    "killTop": { "pin": 3, "reversed": false, "portB": false },
    "fxFilterMids": { "pin": 5, "reversed": false, "portB": false },
    "fxFilterTops": { "pin": 6, "reversed": false, "portB": false },
    "sirenTrigger": { "pin": 7, "reversed": false, "portB": false }
  },
  "clipLeds": {
    "master": { "pin": 4, "portB": true, "activeLow": false, "enabled": true }
  }
}
```

### 1.2 Channel Routing Options
- **Mono Source:** `"channels": [2, -1]` (Input on channel 2 duplicated to left and right).
- **Stereo Source:** `"channels": [2, 3]` (Left on channel 2, Right on channel 3).
- **Mic Mode:** `"mic": true` — Bypasses master parametric EQ, filters, and kills for this channel.
- **Rumble Cutoff (`hpf`):** `"hpf": 80` applies an 80 Hz high-pass filter when `mic: true`.

---

## 2. DSP Tuning (`src/SoftwareConfig.h`)

All algorithmic and audio parameters live in `src/SoftwareConfig.h`.

### 2.1 Crossover & Kills
```cpp
constexpr float kKillRampMs       = 30.0f; // Crossfade ramp time when toggling kills
constexpr int   kKillFilterStages = 2;     // 2 cascaded biquads = 24 dB/oct slope
constexpr float kKillFc0          = 80.0f; // SUB / KICK boundary
constexpr float kKillFc1          = 200.0f;// KICK / MID boundary
constexpr float kKillFc2          = 1200.0f;// MID / TOP boundary
```

### 2.2 Noise Gate
```cpp
constexpr float kGateThreshold    = 0.001f; // Peak open threshold (approx. -60 dBFS)
constexpr float kGateAttackMs     = 2.0f;   // Gate opening time
constexpr float kGateHoldMs       = 100.0f; // Hold duration before starting release
constexpr float kGateReleaseMs    = 150.0f; // Closing decay time
```

### 2.3 Equalizer & Filters
```cpp
constexpr float kEqGainRangeDb        = 6.0f;  // Channel 3-band EQ range (±6 dB)
constexpr float kMasterEqGainRangeDb  = 6.0f;  // Master Parametric EQ range (±6 dB)
constexpr float kGEqGainRangeDb       = 12.0f; // Master Graphic EQ range (±12 dB)
constexpr float kBandTrimGainDb       = 6.0f;  // Post-crossover band trim range (±6 dB)
constexpr float kEqGainSmoothMs       = 5.0f;  // Gain change smoothing time constant
constexpr float kFilterBypassRampMs   = 5.0f;  // Crossfade time when HPF/LPF soft-bypass
```

### 2.4 Potentiometer Acquisition
```cpp
constexpr float kSnapRadiusCenter   = 0.03f; // Deadband radius around 0.5 (snaps to 0.5)
constexpr float kPotSmoothingCoeff  = 0.15f; // EMA 1st-order low-pass coefficient
```

---

## 3. Adding New Controls

### 3.1 Adding a Potentiometer
1. **Declare in `src/HardwareConfig.h`:**
   ```cpp
   extern PotRef MY_NEW_POT;
   ```
2. **Define default mapping in `src/HardwareConfigData.cpp`:**
   ```cpp
   PotRef MY_NEW_POT = {7, 0, false, "MY_NEW_POT", true}; 
   // MUX 7, Channel 0, not reversed, label "MY_NEW_POT", centered=true
   ```
3. **Register in `kAllNamedPots[]` array** in `HardwareConfigData.cpp`.
4. **Use in `src/render.cpp`:**
   ```cpp
   float potVal = gHardwareManager.getPotValue(MY_NEW_POT);
   ```

### 3.2 Adding a Switch
1. **Declare in `src/HardwareConfig.h`:**
   ```cpp
   extern SwitchRef MY_NEW_SWITCH;
   ```
2. **Define in `src/HardwareConfigData.cpp`:**
   ```cpp
   SwitchRef MY_NEW_SWITCH = {4, false, true}; // Pin 4, not inverted, Port B
   ```
3. **Read in `src/render.cpp`:**
   ```cpp
   bool isActive = gHardwareManager.getSwitchState(MY_NEW_SWITCH);
   ```

---

## 4. Debugging & Real-Time Logging

Enable terminal debugging in `src/SoftwareConfig.h`:
```cpp
constexpr bool kDebug = true;
```

When enabled, movements greater than `kDebugPotMinMove` (0.01) and switch toggles print to the Bela IDE terminal in real time:
```
[POT] AUX1_INPUT_GAIN    MUX0/C00  ->  0.725
[POT] MASTER_HPF_FREQ    MUX4/C08  ->  0.420
[SW]  KILL_SUB           ->  KILL
[SW]  SIREN_TRIGGER      ->  ON
```
Audio clipping triggers warning messages indicating the overloaded channel:
```
WARNING Canal 2 clipping!
```

