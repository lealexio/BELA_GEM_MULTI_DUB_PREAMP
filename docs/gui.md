# Bela Web GUI & Front-End Architecture

This document describes the browser-based interface running on the Bela board, its tab layout, build toolchain, and WebSocket communication protocol.

---

## 1. Overview

The **Dub Preamp GUI** provides an interactive web interface accessible from any browser at:
```
http://bela.local/gui/
```
The interface is implemented using **p5.js** and communicates with the real-time audio backend using Bela's native WebSocket protocol (`Bela.control`).

```
┌──────────────────────────────────────────────────────────────────┐
│                          Bela Web GUI                            │
│  ┌───────────┐  ┌─────────────┐  ┌───────────────────────┐  ┌─────────────┐       │
│  │   Live    │  │     FX      │  │  Contrôles UI (Dev)   │  │   Mapping   │       │
│  └───────────┘  └─────────────┘  └───────────────────────┘  └─────────────┘       │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ WebSockets (Bela.control)
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Bela RT Audio Engine (render.cpp)             │
│            Buffers, Custom Events & Real-time State              │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Tab Navigation

### 2.1 Live Tab
The operational performance dashboard:
- **Dub Siren:** Trigger button, pitch drop, waveform selection, and modulation depth controls.
- **Sample Player:** Visual list of one-shot audio samples detected in `src/samples/*.{wav,mp3}`. Clicking any sample card triggers immediate playback synchronized through the audio engine.
- **Master Status:** Instant Stereo / Mono toggle button (updates `MASTER_STEREO` without rebooting).
- **Channel Strips:** Real-time level indicators and microphone bypass status badges.
- **VU Meters & Master EQ Curve:** Configurable tiles displaying real-time audio ballistics and filter responses.

### 2.2 FX Tab (Digital Multi-FX Engine)
Real-time digital effects and dynamic channel send routing:
- **Send Routing & Direct Trigger:** Dynamic assignment of 5 send sources (AUX 1–4 and Dub Siren) for Send 1 and Send 2 to `HW`, `SUB`, `ECHO`, `SPRING`, `PHASER`, `TAPE`, `SHIM`, or `OFF`. Each send row includes a direct **`Send`** trigger button (momentary by default, or toggled via **`Latch`**) that fires the channel's FX send directly from the FX tab in both Hardware and Virtual modes, plus an optional **`Test Tone`** (220/440 Hz) injection toggle for auditioning AUX sends with no external audio connected.
- **Tape Drive:** Analog tape desk saturation (`fastTanh`), warmth high-cut filtering (6–16 kHz), asymmetry, and return level.
- **Ducker:** Sidechain ducker for time-based returns (Echo, Spring, Shimmer) keyed off Siren, Mic, Master, or All.
- **Sub Roar:** Sub-harmonic synthesizer and saturation (< 80 Hz) with Tune, Drive, Decay, 24 dB/oct Cutoff, and Return.
- **Echo Dub:** Space tape echo and saturating dub delay (40–1500 ms, rhythm sync presets, Feedback up to 115%, Tone, Flutter, Return, `Kill Send`, and `Clear`).
- **Tubby Spring:** Physical spring reverb tank (Dwell, Decay, Tone, Return, and mechanical `Splash` trigger).
- **Black Ark Phaser:** 6 or 12-stage bi-phase swirler with sweep rate presets, depth, feedback, and return.
- **Shimmer Delay:** Pitch-shifted granular delay (-12 to +12 semitones, presets, Delay Time, Feedback, Grain, Return, and `Clear`).

### 2.3 Controls Tab (Virtual Controls)
Compact virtual console for developing, debugging, and testing without physical potentiometers or switches:
- **Mode Toggle:** Instant toggle between `Hardware` and `Virtual · ADC paused` (skips MUX ADC scanning on Bela).
- **Master:** 4-band parallel crossover kills (`SUB`, `KICK`, `MID`, `TOP`), Master Gain, Band Trim (±6 dB), resonant HPF and LPF.
- **Channels (AUX 1–4):** Gain, 3-band EQ (High, Mid, Low), FX1 & FX2 Send levels.
- **Master EQ:** 4-band Parametric EQ and 12-band Graphic EQ with `Flat` reset.
- **FX & Siren:** FX1/FX2 send filters (`Mids`, `Tops`), FX return gains, and Dub Siren controls (`Trigger` momentary & `Latch`).
- **Quick Actions:** `Reset`, `Mute Master`, and `Unkill All`.

### 2.4 Mapping Tab
Guided hardware configuration and direct `config.json` management on the Bela board, organized into 3 sub-views plus a top action bar:
- **Top Action Bar:**
  - **`Load`:** Imports a local `config.json` file from disk into all Mapping sub-views (`Controls`, `Audio I/O`, `Advanced`) for review and editing.
  - **`Export config.json`:** Literally downloads the `config.json` file currently saved on the Bela board (`/root/Bela/projects/<project>/config.json`).
  - **`Save`:** Validates the current Mapping form and writes `config.json` atomically directly onto the Bela board via `Bela.control` (without copying files manually or opening the Bela IDE).
  - **`Restart`:** Cleanly fades out audio (30 ms S-curve) and restarts the Bela audio program (~2–3 s) to reload `config.json`, without dropping Wi-Fi / hotspot connectivity. Prompts for confirmation (with a **`Save & Restart`** shortcut if unsaved changes exist).
- **Controls:** Step-by-step **`Guided Setup`** assistant + grouped collapsible sections (`Master & Filters`, `AUX 1–4`, `Parametric EQ`, `Graphic EQ`, `Siren & FX`) with search/type/conflict filters, live activity meters, polarity `Rev` toggle, and per-row `Learn` auto-detect.
- **Audio I/O:** Physical Bela inputs/outputs assignment (`Ch`, boot `dB` gain, `Stereo` master toggle, `Mic` mode & `HPF` Hz for AUX 1–4). Kept independent from temporary live gain/stereo adjustments on the `Live` tab so `Save` persists only the Mapping form.
- **Advanced:** Excluded MUX pins list with 1-click **`Auto-ignore unmapped`**, **`Clip LEDs (MCP23017)`** pin & polarity editor (with MCP23017 conflict detection against switches), **`Boot & System`** (`developerMode` boot toggle and secondary **`Reboot Bela`** full OS reboot button), and read-only hardware calibration/I2C summary.

---

## 3. Development & Build Workflow

The Bela IDE only loads a single script file: `src/sketch.js`. Because browsers on embedded systems do not natively bundle ES6 modules over file/websocket protocols efficiently, source modules live in `gui/` and are compiled into `src/sketch.js` using **esbuild**.

### 3.1 Directory Structure
```
gui/
├── main.js             # p5.js lifecycle (setup, draw, event hooks)
├── config.js           # UI constants, control names, and buffer IDs
├── board-config.js     # Live config.json HTTP fetch & Bela.control Save/Restart/Reboot RPCs
├── state.js            # Shared mutable application state
├── context.js          # Canvas rendering context helpers
├── css.js              # Injected CSS styles for clean dark UI
├── bela/
│   └── connection.js   # LIVE / LAG / OFFLINE connection badge monitor
└── dom/
    ├── live.js         # Live tab layout & control wiring
    ├── meters.js       # Canvas VU meter rendering
    ├── masterEq.js     # Frequency response curve calculation & plotting
    ├── mapping.js      # Interactive hardware detection & JSON export
    └── sampler.js      # Sample list cards & playback trigger logic
```

### 3.2 Build Commands (Run on your development machine)

1. **Install Dependencies (one-time setup):**
   ```bash
   npm install
   ```

2. **Compile Production Bundle:**
   ```bash
   npm run build:gui
   ```
   *Generates `src/sketch.js` instantly via esbuild.*

3. **Watch Mode (Development):**
   ```bash
   npm run watch:gui
   ```
   *Automatically recompiles `src/sketch.js` upon saving any file in `gui/`.*

> [!WARNING]
> Never edit `src/sketch.js` directly! Any manual changes will be overwritten on the next build. Always make edits inside `gui/`.

---

## 4. Communication Protocol (`Bela.control`)

The GUI communicates with the C++ backend using Bela's bi-directional WebSocket interface:

### 4.1 UI to C++ (Custom Events)
- **Play Sample:**
  ```javascript
  Bela.control.send({ event: 'custom', samplerPlay: sampleIndex });
  ```
- **Toggle Master Stereo / Mono:**
  ```javascript
  Bela.control.send({ event: 'custom', masterStereo: isStereo });
  ```
- **Toggle UI Control (Dev) Mode:**
  ```javascript
  Bela.control.send({ event: 'custom', uiDevMode: true });
  ```
- **Set Virtual Potentiometer Value (0.0 to 1.0):**
  ```javascript
  Bela.control.send({ event: 'custom', uiPot: potIndex, val: 0.75 });
  ```
- **Set Virtual Switch State:**
  ```javascript
  Bela.control.send({ event: 'custom', uiSwitch: switchIndex, val: true });
  ```
- **Reset Virtual Controls to Defaults:**
  ```javascript
  Bela.control.send({ event: 'custom', uiReset: true });
  ```
- **Save `config.json` Directly to Bela (atomic write, replies with `configAction: 'save'` ACK):**
  ```javascript
  Bela.control.send({ event: 'custom', saveConfigText: jsonString, reqId: '...' });
  ```
- **Read Raw `config.json` Fallback (replies with `configAction: 'read'`):**
  ```javascript
  Bela.control.send({ event: 'custom', readConfig: true, reqId: '...' });
  ```
- **Restart Bela Audio Program (~2–3 s, 30 ms fade-out, Wi-Fi preserved):**
  ```javascript
  Bela.control.send({ event: 'custom', restartAudio: true, reqId: '...' });
  ```
- **Reboot Entire Bela Board (~25–30 s OS reboot, 30 ms fade-out):**
  ```javascript
  Bela.control.send({ event: 'custom', rebootBoard: true, reqId: '...' });
  ```

### 4.2 C++ to UI (Data Buffers)
- **Buffer 0:** 60 named potentiometer positions (`kAllNamedPots`).
- **Buffer 1:** 9 switch states (`kGuiSwitchRefs`).
- **Buffer 2:** Siren state [presetIdx, gate, mod].
- **Buffer 3:** Audio peak levels across all 13 monitored points.
- **Buffer 4–5:** Pot and switch hardware mapping.
- **Buffer 6:** Configuration metadata (routing, master stereo, `UI_DEV_MODE` at index 33, ignored pots, `DEV_MODE` boot flag at index 99, Clip LEDs at indices 100–104).
- **Buffer 7:** Raw 80-channel MUX grid for mapping discovery.
- **Buffer 8:** Codec PGA ADC input / DAC output gains.
- **Buffer 9:** CPU core temperature (°C).
- **Buffer 10–11:** Sample list metadata (playback state and packed ASCII filenames).
- **Buffer 12:** Digital FX telemetry [0..5]=peaks (SubRoar, EchoDub, TubbySpring, BlackArk, TapeDrive, ShimmerDelay), [6]=ducking reduction, [7..16]=AUX 1–4 and Siren Send 1 & Send 2 routing destinations.

