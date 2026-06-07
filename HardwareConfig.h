#pragma once
#include <stdint.h>

/**
 * Physical hardware mapping: MUX topology, pot calibration, I2C configuration,
 * audio I/O routing and all named control references.
 *
 * Split with SoftwareConfig.h:
 *   HardwareConfig  → physical wiring, calibration, I/O indices
 *   SoftwareConfig  → DSP parameters, processing behaviour, debug settings
 *
 * How to add a new MUX:
 *   1. Increment kActiveMux.
 *   2. Add PotRef entries with mux = <new index>.
 *   3. Add names to getPotName().
 */

// ---------------------------------------------------------------------------
// MUX topology
// ---------------------------------------------------------------------------

/// Maximum number of MUX chips the firmware can handle (sets array sizes).
constexpr int kNumMux     = 4;

/// Number of MUX chips physically wired to the Bela (≤ kNumMux).
/// Increase this when you connect additional CD74HC4067 boards.
constexpr int kActiveMux  = 3;

/// Number of channels per MUX chip (CD74HC4067 = 16).
constexpr int kPotsPerMux = 16;

// ---------------------------------------------------------------------------
// Potentiometer calibration
// ---------------------------------------------------------------------------

/// Voltage scaling factor: Bela ADC reference (4.096 V) ÷ MUX supply (3.3 V).
/// Adjusts raw ADC readings so a pot at full-scale returns 1.0.
constexpr float kPotScaleRecovery = 4.096f / 3.3f;

/// Raw scaled value that maps to 1.0 (pots rarely reach the exact rail voltage).
/// Lower this if your pots never reach 1.0.
constexpr float kPotMax = 0.997f;

/// Raw scaled values at or below this threshold are clamped to 0.0.
/// Raise this if your pots rest slightly above 0.0 when fully closed.
constexpr float kPotMin = 0.005f;

// ---------------------------------------------------------------------------
// MCP23017 I2C configuration
// ---------------------------------------------------------------------------

/// I2C bus device path on the Bela's Linux system.
constexpr const char* kI2cBus    = "/dev/i2c-1";

/// 7-bit I2C address of the MCP23017 (A0=A1=A2=GND → 0x20).
constexpr uint8_t     kMcpAddress = 0x20;

// ---------------------------------------------------------------------------
// Master audio output routing
// ---------------------------------------------------------------------------

/// Bela audio output index for the left  master channel (mono → both channels).
constexpr int MASTER_OUT_L = 0;

/// Bela audio output index for the right master channel.
constexpr int MASTER_OUT_R = 1;

// ---------------------------------------------------------------------------
// Audio routing — one entry per ChannelStrip instance
// ---------------------------------------------------------------------------

/**
 * Describes which Bela audio inputs feed a channel strip.
 * audioIns[i] = -1 means "unused slot".
 * If both slots are valid, the two inputs are averaged to mono.
 */
struct ChannelConfig {
    int audioIns[2];
    int audioOut;
};

constexpr ChannelConfig CH1_CONFIG = { {0, -1}, MASTER_OUT_L }; // IN0 → master
constexpr ChannelConfig CH2_CONFIG = { {1, -1}, MASTER_OUT_R }; // IN1 → master

// ---------------------------------------------------------------------------
// FX Send / Return routing
// Master output : MASTER_OUT_L + MASTER_OUT_R (mono)
// FX send bus   : OUT2  (sum of all channel post-fader sends → effect unit)
// FX return     : IN2   (wet signal back from the effect unit → master bus)
// ---------------------------------------------------------------------------

constexpr int FX1_SEND_OUT  = 2; // Bela OUT2
constexpr int FX1_RETURN_IN = 2; // Bela IN2

// ---------------------------------------------------------------------------
// Switch mapping (MCP23017 PA pins)
// ---------------------------------------------------------------------------

/**
 * Reference to one MCP23017 switch.
 * reversed = true : invert logic — HIGH = active instead of LOW.
 */
struct SwitchRef {
    int  pin;
    bool reversed = false;
};

// Kill switches wired to port A of the MCP23017
constexpr SwitchRef KILL_KICK = {0, true};  // PA0 → kill KICK (80–200 Hz)
constexpr SwitchRef KILL_SUB  = {1, true};  // PA1 → kill SUB  (< 80 Hz)
constexpr SwitchRef KILL_MID  = {2, true};  // PA2 → kill MID  (200–1200 Hz)
constexpr SwitchRef KILL_TOP  = {3, false}; // PA3 → kill TOP  (> 1200 Hz)

// ---------------------------------------------------------------------------
// Potentiometer mapping
// ---------------------------------------------------------------------------

/**
 * Named reference to one MUX pot.
 * reversed = true : invert the reading (physical pot rotated backwards).
 */
struct PotRef {
    int  mux;
    int  pot;
    bool reversed = false;
};

// --- MUX 0  (analog input A0) ---

// Channel Strip 1 (IN0 → master)
constexpr PotRef CH1_INPUT_GAIN = {0,  1, true}; // C01 — input volume
constexpr PotRef CH1_EQ_MID     = {0,  0, true}; // C00 — mid  peak
constexpr PotRef CH1_EQ_LOW     = {0, 14, true}; // C14 — low  shelf
constexpr PotRef CH1_EQ_HIGH    = {0, 15, true}; // C15 — high shelf
constexpr PotRef CH1_FX_SEND    = {0, 13};        // C13 — FX send level

// Channel Strip 2 (IN1 → master)
constexpr PotRef CH2_INPUT_GAIN = {0,  6, true}; // C06 — input volume
constexpr PotRef CH2_EQ_MID     = {0,  7, true}; // C07 — mid  peak
constexpr PotRef CH2_EQ_HIGH    = {0,  8, true}; // C08 — high shelf
constexpr PotRef CH2_EQ_LOW     = {0,  9, true}; // C09 — low  shelf
constexpr PotRef CH2_FX_SEND    = {0, 10};        // C10 — FX send level

// --- MUX 1  (analog input A1) — uncomment when physically connected ---
//     Also increment kActiveMux above.
// constexpr PotRef POT_MUX1_C00 = {1, 0};
// constexpr PotRef POT_MUX1_C01 = {1, 1};

// --- MUX 2  (analog input A2) — Master parametric EQ ---

constexpr PotRef MASTER_EQ_SUB_FREQ  = {2,  8}; // C08 — SUB  freq sweep  (20–80 Hz)
constexpr PotRef MASTER_EQ_SUB_GAIN  = {2,  6}; // C06 — SUB  gain        (±kMasterEqGainRangeDb dB)
constexpr PotRef MASTER_EQ_KICK_FREQ = {2, 11}; // C11 — KICK freq sweep  (80–200 Hz)
constexpr PotRef MASTER_EQ_KICK_GAIN = {2, 13}; // C13 — KICK gain        (±kMasterEqGainRangeDb dB)
constexpr PotRef MASTER_EQ_MID_FREQ  = {2,  0}; // C00 — MID  freq sweep  (200–1200 Hz)
constexpr PotRef MASTER_EQ_MID_GAIN  = {2, 14}; // C14 — MID  gain        (±kMasterEqGainRangeDb dB)
constexpr PotRef MASTER_EQ_TOP_FREQ  = {0,  4}; // MUX0 C04 — TOP freq sweep  (1200–16000 Hz)
constexpr PotRef MASTER_EQ_TOP_GAIN  = {0,  2}; // MUX0 C02 — TOP gain        (±kMasterEqGainRangeDb dB)

// ---------------------------------------------------------------------------
// Debug logging exclusion list
// Add pots that are floating / noisy / under investigation to suppress spam.
// ---------------------------------------------------------------------------

constexpr PotRef kIgnoredPots[] = {
    {1, 2}, // MUX1/C02 — under investigation
    {2, 2}, // MUX2/C02 — unassigned / floating
};
constexpr int kIgnoredPotsCount = sizeof(kIgnoredPots) / sizeof(kIgnoredPots[0]);

// ---------------------------------------------------------------------------
// Human-readable pot name lookup — keep in sync with PotRef entries above.
// ---------------------------------------------------------------------------

inline const char* getPotName(int mux, int pot) {
    if(mux == 0) {
        switch(pot) {
            case  0: return "CH1_EQ_MID";
            case  1: return "CH1_INPUT_GAIN";
            case  2: return "MEQ_TOP_GAIN";
            case  4: return "MEQ_TOP_FREQ";
            case  6: return "CH2_INPUT_GAIN";
            case  7: return "CH2_EQ_MID";
            case  8: return "CH2_EQ_HIGH";
            case  9: return "CH2_EQ_LOW";
            case 10: return "CH2_FX_SEND";
            case 13: return "CH1_FX_SEND";
            case 14: return "CH1_EQ_LOW";
            case 15: return "CH1_EQ_HIGH";
            default: return nullptr;
        }
    }
    if(mux == 2) {
        switch(pot) {
            case  0: return "MEQ_MID_FREQ";
            case  6: return "MEQ_SUB_GAIN";
            case  8: return "MEQ_SUB_FREQ";
            case 11: return "MEQ_KICK_FREQ";
            case 13: return "MEQ_KICK_GAIN";
            case 14: return "MEQ_MID_GAIN";
            default: return nullptr;
        }
    }
    return nullptr;
}

inline const char* getPotName(PotRef ref) { return getPotName(ref.mux, ref.pot); }
