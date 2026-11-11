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
│  ┌───────────┐  ┌───────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   Live    │  │  Meters   │  │  Master EQ  │  │   Mapping   │  │
│  └───────────┘  └───────────┘  └─────────────┘  └─────────────┘  │
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

### 2.2 Meters Tab
Precision audio monitoring:
- High-resolution canvas VU meters for all 10 audio input and output channels.
- Four-band frequency-split output levels (SUB, KICK, MID, TOP).
- Direct ADC / DAC PGA gain calibration sliders (adjusting codec gain stages).

### 2.3 Master EQ Tab
Visual acoustic feedback:
- Plots the combined theoretical magnitude transfer function (in dB vs. frequency from 20 Hz to 20 kHz).
- Dynamically superimposes:
  - 4-Band Parametric EQ curves
  - 12-Band Graphic EQ responses
  - High-Pass Filter (HPF) and Low-Pass Filter (LPF) resonance slopes
  - Band Trim offsets
- Updates in real time as physical potentiometers are turned.

### 2.4 Mapping Tab
Hardware diagnostic and configuration utility:
- Visual display of all 8 multiplexer channels and MCP23017 GPIO pins.
- **Live Pot Detection:** Highlights which potentiometer is currently moving to verify wiring.
- **Configuration Exporter:** Generates a ready-to-use `config.json` file reflecting the live physical setup.

---

## 3. Development & Build Workflow

The Bela IDE only loads a single script file: `src/sketch.js`. Because browsers on embedded systems do not natively bundle ES6 modules over file/websocket protocols efficiently, source modules live in `gui/` and are compiled into `src/sketch.js` using **esbuild**.

### 3.1 Directory Structure
```
gui/
├── main.js             # p5.js lifecycle (setup, draw, event hooks)
├── config.js           # UI constants, control names, and buffer IDs
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
- **Trigger Dub Siren:**
  ```javascript
  Bela.control.send({ event: 'custom', sirenTrigger: true });
  ```

### 4.2 C++ to UI (Data Buffers)
- **Buffer 0–7:** Multiplexer potentiometer raw smoothed values.
- **Buffer 8:** MCP23017 switch states.
- **Buffer 9:** Output VU meter peak and RMS levels.
- **Buffer 10–11:** Sample list metadata (names and durations).

