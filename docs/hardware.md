# Hardware Wiring & Interface Specifications

This guide provides technical specifications for wiring potentiometers, switches, clip LEDs, and audio I/O connections to the **Bela Gem Multi** board.

---

## 1. Bela Gem Multi Overview

The **Bela Gem Multi** is an ultra-low latency audio processing platform based on the BeagleBone Black architecture (ARM Cortex-A8, Xenomai Linux). It features a dedicated multi-channel audio codec providing:
- **10 Audio Inputs** (ADC)
- **10 Audio Outputs** (DAC)
- **8 Analog Inputs** (16-bit SAR ADC, 0–4.096 V reference)
- **Digital I/O & I2C Bus** (3.3 V logic)

---

## 2. Multiplexer Wiring (CD74HC4067)

To interface up to 80 physical potentiometers, the system uses up to 8 **CD74HC4067** 16-channel analog multiplexers (using channels 0 through 9 on each chip).

### 2.1 Digital Address Bus
All multiplexers share the same 4-bit binary address bus driven by Bela digital pins:

| Address Bit | Multiplexer Pin | Bela Digital Pin | Function |
|---|---|---|---|
| **S0** | Pin 10 | **D0** | Address Bit 0 (LSB) |
| **S1** | Pin 11 | **D1** | Address Bit 1 |
| **S2** | Pin 14 | **D2** | Address Bit 2 |
| **S3** | Pin 13 | **D3** | Address Bit 3 (MSB) |
| **$\overline{\text{EN}}$** | Pin 15 | **GND** | Active-low enable (tied to GND) |
| **VCC** | Pin 24 | **3.3 V** | Logic supply |
| **GND** | Pin 12 | **GND** | Common ground |

### 2.2 Analog Signal Lines
The common output pin (`SIG` / Pin 1) of each multiplexer is wired to a dedicated Bela analog input:

| MUX Chip | Channel Label | Bela Analog In | Functional Group |
|---|---|---|---|
| **MUX 0** | Chip 0 | **A0** | AUX 1 (Gain, 3-band EQ, FX1/FX2 Send) + FX Return Gains 1 & 2 |
| **MUX 1** | Chip 1 | **A1** | AUX 2 (Gain, 3-band EQ, FX1/FX2 Send) + Graphic EQ 1 kHz & 2 kHz |
| **MUX 2** | Chip 2 | **A2** | AUX 3 (Gain, 3-band EQ, FX1/FX2 Send) + Graphic EQ 4 kHz & 8 kHz |
| **MUX 3** | Chip 3 | **A3** | AUX 4 (Gain, 3-band EQ, FX1/FX2 Send) + Graphic EQ 16 kHz |
| **MUX 4** | Chip 4 | **A4** | Master Parametric EQ (Freq + Gain × 4) + Master HPF (Freq + Res) |
| **MUX 5** | Chip 5 | **A5** | Master LPF (Freq + Res) + Band Trim (4 bands) + Master Gain + GEQ 250 & 500 Hz |
| **MUX 6** | Chip 6 | **A6** | Dub Siren (Type, Mod, Gain, FX Send 1 & 2) + Graphic EQ 40 Hz to 125 Hz |
| **MUX 7** | Chip 7 | **A7** | Expansion / Auxiliary channels (0 to 9) |

---

## 3. Potentiometer Acquisition & Signal Conditioning

### 3.1 Potentiometer Wiring
- **Terminal 1:** Connect to **3.3 V** (clean rail).
- **Terminal 2 (Wiper):** Connect to MUX channel pin ($C_0 \dots C_9$).
- **Terminal 3:** Connect to **GND**.
- Recommended potentiometer value: **10 kΩ linear** (B10K).

### 3.2 Voltage Scaling & ADC Calibration
- The Bela ADC reference is **4.096 V**, while potentiometers are powered from **3.3 V**.
- The firmware automatically applies a scale recovery factor:
  $$\text{Recovery Factor} = \frac{4.096\,\text{V}}{3.3\,\text{V}} \approx 1.2412$$
- Raw values are mapped between `kPotMin` (clamped to 0.0) and `kPotMax` (mapped to 1.0).

### 3.3 Center Snapping & Filtering
- **Center Snapping:** Centered controls (EQ gain, band trim) use a deadband window (`kSnapRadiusCenter = 0.03`). Any raw read within $[0.47, 0.53]$ snaps strictly to `0.5` (0.0 dB unity). Outside this range, the response scales smoothly and linearly to 0.0 or 1.0.
- **EMA Low-Pass Filtering:** Every potentiometer input passes through a single-pole Exponential Moving Average (EMA) filter (`kPotSmoothingCoeff = 0.15`) in `HardwareManager::scanStep()`:
  $$y[n] = y[n-1] + \alpha \cdot (x[n] - y[n-1])$$
  This provides ~22 dB attenuation of high-frequency ADC noise while preserving an agile ~70 ms rise time.

---

## 4. MCP23017 I2C Expander (Switches & Clip LEDs)

Switches and status LEDs are controlled through a 16-bit **Microchip MCP23017** I2C GPIO expander.

### 4.1 Bus Connection & Addressing
- **SDA:** Bela I2C-1 SDA (Pin P9.18 or Gem Multi header)
- **SCL:** Bela I2C-1 SCL (Pin P9.17 or Gem Multi header)
- **VCC:** 3.3 V, **GND:** Ground
- **Address Selection (A0, A1, A2):** Grounded for address `0x20` (firmware automatically probes `0x20` through `0x27`).

### 4.2 Switch Inputs
Switches connect between the MCP23017 GPIO pin and **GND**. The firmware enables internal $100\text{ k}\Omega$ pull-up resistors on all switch inputs.

| Signal Name | MCP23017 Pin | Port & Pin | Active State | Description |
|---|---|---|---|---|
| `KILL_SUB` | Pin 21 | Port A, Pin 0 | LOW (GND) | Mutes frequencies below 80 Hz |
| `KILL_KICK` | Pin 22 | Port A, Pin 1 | LOW (GND) | Mutes frequencies 80–200 Hz |
| `KILL_MID` | Pin 23 | Port A, Pin 2 | LOW (GND) | Mutes frequencies 200–1200 Hz |
| `KILL_TOP` | Pin 24 | Port A, Pin 3 | LOW (GND) | Mutes frequencies above 1200 Hz |
| `FX_FILTER_MIDS` | Pin 26 | Port A, Pin 5 | LOW (GND) | Filters FX1 send to 250 Hz – 4 kHz |
| `FX_FILTER_TOPS` | Pin 27 | Port A, Pin 6 | LOW (GND) | Filters FX1 send to high-pass (> 4 kHz) |
| `FX2_FILTER_MIDS`| Pin 1 | Port B, Pin 0 | LOW (GND) | Filters FX2 send to 250 Hz – 4 kHz |
| `FX2_FILTER_TOPS`| Pin 2 | Port B, Pin 1 | LOW (GND) | Filters FX2 send to high-pass (> 4 kHz) |
| `SIREN_TRIGGER` | Pin 28 | Port A, Pin 7 | LOW (GND) | Gates the Dub Siren |

### 4.3 Hardware Signal & Clip LEDs
Optional hardware indicators wired to MCP23017 output pins (with series current-limiting resistor, e.g. 330 Ω to 470 Ω):

| Output Name | Port / Pin | Signal Present Mode | Clip Mode | Behavior & Timing |
|---|---|---|---|---|
| `CLIP_LED_MASTER` | Configurable | N/A (Output VU on OUT6–9) | Peak ≥ -0.5 dBFS (`kClipThreshold`) | Solid ON, 1.2 s peak hold |
| `CLIP_LED_AUX1` | Configurable | Peak ≥ -36 dBFS (`kSignalPresentThreshold`) | Peak ≥ -0.5 dBFS (`kClipThreshold`) | Sig: 35 ms flash / 1 Hz blink; Clip: Solid ON, 1.2 s hold |
| `CLIP_LED_AUX2` | Configurable | Peak ≥ -36 dBFS (`kSignalPresentThreshold`) | Peak ≥ -0.5 dBFS (`kClipThreshold`) | Sig: 35 ms flash / 1 Hz blink; Clip: Solid ON, 1.2 s hold |
| `CLIP_LED_AUX3` | Configurable | Peak ≥ -36 dBFS (`kSignalPresentThreshold`) | Peak ≥ -0.5 dBFS (`kClipThreshold`) | Sig: 35 ms flash / 1 Hz blink; Clip: Solid ON, 1.2 s hold |
| `CLIP_LED_AUX4` | Configurable | Peak ≥ -36 dBFS (`kSignalPresentThreshold`) | Peak ≥ -0.5 dBFS (`kClipThreshold`) | Sig: 35 ms flash / 1 Hz blink; Clip: Solid ON, 1.2 s hold |

> **Low-Frequency I2C Rhythm:** To avoid bus saturation and digital audio pollution, LED state changes run strictly at low frequency:
> - **Signal Present:** Instant 35 ms pulse on rising edge; slow 1 Hz repetition under continuous sound (2 I2C writes/s per port, < 0.01% bus load).
> - **Digital Clip:** Solid continuous ON for 1.2 s (0 extra I2C writes while held ON). Clip overrides Signal Present unconditionally.

---

## 5. Audio I/O Mapping (10 In / 10 Out)

| Channel Index | Connector | Direction | Role | Description |
|---|---|---|---|---|
| **IN 0** | Jack / Terminal | Input | `FX1_RETURN_IN` | External FX Loop 1 Return (Wet In) |
| **IN 1** | Jack / Terminal | Input | `FX2_RETURN_IN` | External FX Loop 2 Return (Wet In) |
| **IN 2** | Jack / Terminal | Input | `AUX1_CONFIG.audioIns[0]` | AUX 1 Left / Mono Input |
| **IN 3** | Jack / Terminal | Input | `AUX1_CONFIG.audioIns[1]` | AUX 1 Right Input (optional) |
| **IN 4** | Jack / Terminal | Input | `AUX2_CONFIG.audioIns[0]` | AUX 2 Left / Mono Input |
| **IN 5** | Jack / Terminal | Input | `AUX2_CONFIG.audioIns[1]` | AUX 2 Right Input (optional) |
| **IN 6** | Jack / Terminal | Input | `AUX3_CONFIG.audioIns[0]` | AUX 3 Left / Mono Input |
| **IN 7** | Jack / Terminal | Input | `AUX3_CONFIG.audioIns[1]` | AUX 3 Right Input (optional) |
| **IN 8** | Jack / Terminal | Input | `AUX4_CONFIG.audioIns[0]` | AUX 4 Left / Mono Input |
| **IN 9** | Jack / Terminal | Input | `AUX4_CONFIG.audioIns[1]` | AUX 4 Right Input (optional) |
| **OUT 0** | Jack / Terminal | Output | `FX1_SEND_OUT` | External FX Loop 1 Send (Aux + Siren) |
| **OUT 1** | Jack / Terminal | Output | `FX2_SEND_OUT` | External FX Loop 2 Send (Aux + Siren) |
| **OUT 2** | Jack / Terminal | Output | `MASTER_OUTS[0]` | Main Master Output (Left / Mono) |
| **OUT 3** | Jack / Terminal | Output | `MASTER_OUTS[1]` | Main Master Output (Right in stereo) |
| **OUT 4** | Jack / Terminal | Output | Reserved | Expansion |
| **OUT 5** | Jack / Terminal | Output | Reserved | Expansion |
| **OUT 6** | Jack / Terminal | Output | `VU_TOP_OUT` | Analog VU Meter Output — TOP Band |
| **OUT 7** | Jack / Terminal | Output | `VU_MID_OUT` | Analog VU Meter Output — MID Band |
| **OUT 8** | Jack / Terminal | Output | `VU_KICK_OUT` | Analog VU Meter Output — KICK Band |
| **OUT 9** | Jack / Terminal | Output | `VU_SUB_OUT` | Analog VU Meter Output — SUB Band |

---

## 6. Electrical Specifications

- **Nominal Input Level:** $-10\text{ dBV}$ ($316\text{ mV}_{\text{RMS}}$)
- **Maximum Input Voltage:** $\pm 1.0\text{ V}_{\text{peak}}$ before ADC clipping
- **Codec Input Gain (PGA):** $-12\text{ dB}$ to $+10\text{ dB}$ configurable in `config.json`
- **Codec Output Gain:** $-63\text{ dB}$ to $0\text{ dB}$
- **Analog Output Impedance:** $100\ \Omega$ line out

