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
- **Channel Sends Routing Matrix:** Dynamic assignment of 5 send sources (AUX 1–4 and Dub Siren) for Send 1 and Send 2 to `[HW Out]`, `[SUB]`, `[ECHO]`, `[SPRING]`, `[PHASER]`, `[TAPE]`, `[SHIM]`, or `[OFF]`. Diverts sends away from physical jacks directly into internal digital processors while keeping hardware knob control.
- **TAPE DRIVE Module:** Analog tape desk saturation and coloration with asymmetric even harmonics (`fastTanh`), warmth high-cut filtering (6–16 kHz), and output gain scaling.
- **DUB DUCKER Module:** Automatic sidechain ducker for time-based FX returns (Echo, Spring, Shimmer) keyed off Dub Siren / Sampler, Mic inputs, or Master bus.
- **SUB ROAR Module:** Sub-harmonic bass synthesizer and asymmetric saturation (< 80 Hz) driven by a continuous broadband musical envelope follower. Parameters: Tune (30–90 Hz), Roar Drive (0–100%), Decay (100–3000 ms), 24 dB/oct Sub Cutoff (40–120 Hz), Return Level (0–150%).
- **ECHO DUB Module:** Authentic space tape echo and saturating dub delay. Parameters: Delay Time (40–1500 ms) with rhythm sync buttons (1/16, 1/8, 1/8d, 1/4, Dub Long), Feedback (0–115%, with self-oscillation above 85%), Tape Tone High-Cut (1000–5000 Hz), Wow/Flutter (0–100%), Return Level (0–100%). Includes a **"KILL SEND"** latching button and a real-time safe **"CLEAR ECHO"** flush button.
- **TUBBY SPRING Module:** King Tubby style physical spring reverb tank with 4-stage all-pass dispersion ladder, 4 prime comb filters, high-damping tone, and an interactive **"SPRING SPLASH"** button simulating a knuckle/kick on the physical reverb tank.
- **BLACK ARK PHASER Module:** Lee "Scratch" Perry Mu-Tron style 6 or 12-pole bi-phase swirler with saturating feedback and sub-sampled coefficient glide.
- **SHIMMER DELAY Module:** Pitch-shifted granular delay (-12 to +12 semitones, 5th, octave) with raised cosine dual-tap windowing, feedback damping, and a **"CLEAR SHIMMER"** flush button.

### 2.3 Contrôles UI Tab (Dev Mode / Virtual Controls)
Full virtual console for developing, debugging, and testing without physical potentiometers or switches:
- **Mode Toggle:** Instant toggle between Hardware Control Mode and UI Control (Dev) Mode.
  - *When Inactive:* **0% CPU overhead**, standard physical MUX & MCP23017 scanning.
  - *When Active:* MUX ADC scanning is bypassed to prevent floating pin noise from forcing unnecessary biquad recalculations, saving CPU on Bela.
- **Master & Kills:** 4-band parallel crossover kills (SUB, KICK, MID, TOP), Master Volume fader, Band Trim (±6 dB), resonant HPF and LPF controls.
- **Channel Strips (AUX 1–4):** Input Gain, 3-band EQ (Low, Mid, High with center-snap at 0 dB), FX1 & FX2 Send levels.
- **Master EQ Section:** 4-band parametric EQ (sweepable frequency and gain) and 12-band Graphic EQ with "Flat" reset.
- **Effects & Dub Siren:** FX send mode selectors (MIDS, TOPS), FX return gains, siren parameters, and momentary / latching siren trigger buttons.
- **Quick Actions:** "Réinitialiser aux valeurs neutres" (resets all virtual controls to musical nominals) and "Mute Master".

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

### 4.2 C++ to UI (Data Buffers)
- **Buffer 0:** 60 named potentiometer positions (`kAllNamedPots`).
- **Buffer 1:** 9 switch states (`kGuiSwitchRefs`).
- **Buffer 2:** Siren state [presetIdx, gate, mod].
- **Buffer 3:** Audio peak levels across all 13 monitored points.
- **Buffer 4–5:** Pot and switch hardware mapping.
- **Buffer 6:** Configuration metadata (routing, master stereo, `UI_DEV_MODE` at index 33, ignored pots).
- **Buffer 7:** Raw 80-channel MUX grid for mapping discovery.
- **Buffer 8:** Codec PGA ADC input / DAC output gains.
- **Buffer 9:** CPU core temperature (°C).
- **Buffer 10–11:** Sample list metadata (playback state and packed ASCII filenames).
- **Buffer 12:** Digital FX telemetry [0..5]=peaks (SubRoar, EchoDub, TubbySpring, BlackArk, TapeDrive, ShimmerDelay), [6]=ducking reduction, [7..16]=AUX 1–4 and Siren Send 1 & Send 2 routing destinations.

