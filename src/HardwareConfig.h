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
 * How to add a new pot:
 *   1. Declare a constexpr PotRef with mux, pot, reversed, and name.
 *   2. Add it to kAllNamedPots[].
 *   3. Use it in render.cpp via gHardwareManager.getPotValue(MY_POT).
 *   getPotName() will automatically pick up the name — no switch/case to update.
 *
 * How to add a new MUX:
 *   1. Increment kActiveMux.
 *   2. Add PotRef entries with mux = <new index>.
 *   3. Add them to kAllNamedPots[].
 */

// ---------------------------------------------------------------------------
// MUX topology
// ---------------------------------------------------------------------------

/// Maximum number of MUX chips the firmware can handle (sets array sizes).
constexpr int kNumMux     = 4;

/// Number of MUX chips physically wired to the Bela (≤ kNumMux).
/// Increase this when you connect additional CD74HC4067 boards.
constexpr int kActiveMux  = 4;

/// Number of channels per MUX chip (CD74HC4067 = 16).
constexpr int kPotsPerMux = 16;

// ---------------------------------------------------------------------------
// Potentiometer calibration
// ---------------------------------------------------------------------------

/// Voltage scaling factor: Bela ADC reference (4.096 V) ÷ MUX supply (3.3 V).
constexpr float kPotScaleRecovery = 4.096f / 3.3f;

/// Raw scaled value that maps to 1.0 (pots rarely reach the exact rail voltage).
constexpr float kPotMax = 0.997f;

/// Raw scaled values at or below this threshold are clamped to 0.0.
constexpr float kPotMin = 0.005f;

// ---------------------------------------------------------------------------
// MCP23017 I2C configuration
// ---------------------------------------------------------------------------

constexpr const char* kI2cBus    = "/dev/i2c-1";
constexpr uint8_t     kMcpAddress = 0x20; // A0=A1=A2=GND

// ---------------------------------------------------------------------------
// Master audio output routing
// ---------------------------------------------------------------------------

constexpr int MASTER_OUT_L = 0;
constexpr int MASTER_OUT_R = 1;

// ---------------------------------------------------------------------------
// Audio routing — one entry per ChannelStrip instance
// ---------------------------------------------------------------------------

struct ChannelConfig {
    int audioIns[2];
    int audioOut;
};

constexpr ChannelConfig CH1_CONFIG = { {0, -1}, MASTER_OUT_L };
constexpr ChannelConfig CH2_CONFIG = { {1, -1}, MASTER_OUT_R };

// ---------------------------------------------------------------------------
// FX Send / Return routing
// ---------------------------------------------------------------------------

constexpr int FX1_SEND_OUT  = 2; // Bela OUT2
constexpr int FX1_RETURN_IN = 2; // Bela IN2

// ---------------------------------------------------------------------------
// Switch mapping (MCP23017 PA pins)
// ---------------------------------------------------------------------------

/**
 * Reference to one MCP23017 switch.
 *   pin      : GPIO pin index (0–7) within the port
 *   reversed : invert logic — true means HIGH = active instead of LOW
 *   portB    : false = port A (default), true = port B
 */
struct SwitchRef {
    int  pin;
    bool reversed = false;
    bool portB    = false;
};

constexpr SwitchRef KILL_SUB  = {0, true,  false}; // PA1 → kill SUB  (< 80 Hz)
constexpr SwitchRef KILL_KICK = {1, true,  false}; // PA0 → kill KICK (80–200 Hz)
constexpr SwitchRef KILL_MID  = {2, false,  false}; // PA2 → kill MID  (200–1200 Hz)
constexpr SwitchRef KILL_TOP  = {3, true, false}; // PA3 → kill TOP  (> 1200 Hz)

// Port B switches
constexpr SwitchRef SIREN_TRIGGER = {0, false, true}; // PB0 → dub siren gate

// ---------------------------------------------------------------------------
// Potentiometer mapping
// ---------------------------------------------------------------------------

/**
 * Named reference to one MUX pot.
 *
 * Fields:
 *   mux      : MUX chip index (0 … kActiveMux-1)
 *   pot      : channel on that MUX (0 … kPotsPerMux-1)
 *   reversed : true = invert the reading (physically rotated backwards)
 *   name     : human-readable label used in debug logs — must match the
 *              variable name so logs are unambiguous. nullptr = unlabelled.
 *
 * Single source of truth: the name lives here, not in a separate switch/case.
 * Add the pot to kAllNamedPots[] so getPotName() can find it automatically.
 */
struct PotRef {
    int         mux;
    int         pot;
    bool        reversed = false;
    const char* name     = nullptr;
};

// --- MUX 0  (analog input A0) ---

// Dub Siren controls
constexpr PotRef SIREN_TYPE    = {0, 10, false, "SIREN_TYPE"};    // preset selector
constexpr PotRef SIREN_MOD     = {0,  9, false, "SIREN_MOD"};     // LFO depth + rate

// --- MUX 3  (analog input A3) — siren + channel gain/send ---

constexpr PotRef SIREN_GAIN    = {3,  0, false, "SIREN_GAIN"};    // siren output gain
constexpr PotRef SIREN_FX_SEND = {3, 11, false, "SIREN_FX_SEND"}; // siren FX send level

// Channel Strip 1 (IN0 → master)
constexpr PotRef CH1_INPUT_GAIN = {3,  2, true,  "CH1_INPUT_GAIN"};
constexpr PotRef CH1_EQ_MID     = {0,  5, true,  "CH1_EQ_MID"};
constexpr PotRef CH1_EQ_LOW     = {0, 14, true,  "CH1_EQ_LOW"};
constexpr PotRef CH1_EQ_HIGH    = {0, 3, true,  "CH1_EQ_HIGH"};
constexpr PotRef CH1_FX_SEND    = {3, 3, false, "CH1_FX_SEND"};

// Channel Strip 2 (IN1 → master)
constexpr PotRef CH2_INPUT_GAIN = {3,  7, true,  "CH2_INPUT_GAIN"};
constexpr PotRef CH2_EQ_MID     = {0,  6, true,  "CH2_EQ_MID"};
constexpr PotRef CH2_EQ_HIGH    = {1,  12, true,  "CH2_EQ_HIGH"};
constexpr PotRef CH2_EQ_LOW     = {0,  13, true,  "CH2_EQ_LOW"};
constexpr PotRef CH2_FX_SEND    = {3, 6, false, "CH2_FX_SEND"};


// Master parametric EQ
constexpr PotRef MASTER_EQ_SUB_FREQ  = {2, 14, false, "MASTER_EQ_SUB_FREQ"};
constexpr PotRef MASTER_EQ_SUB_GAIN  = {2, 13, false, "MASTER_EQ_SUB_GAIN"};
constexpr PotRef MASTER_EQ_KICK_FREQ = {2,  8, false, "MASTER_EQ_KICK_FREQ"};
constexpr PotRef MASTER_EQ_KICK_GAIN = {2,  9, false, "MASTER_EQ_KICK_GAIN"};
constexpr PotRef MASTER_EQ_MID_FREQ  = {1, 14, false, "MASTER_EQ_MID_FREQ"};
constexpr PotRef MASTER_EQ_MID_GAIN  = {2,  7, false, "MASTER_EQ_MID_GAIN"};
constexpr PotRef MASTER_EQ_TOP_FREQ  = {2,  3, false, "MASTER_EQ_TOP_FREQ"};
constexpr PotRef MASTER_EQ_TOP_GAIN  = {2,  6, false, "MASTER_EQ_TOP_GAIN"};

// --- Graphic EQ (12 bands) ---
// MUX 1 — low and mid bands
constexpr PotRef GEQ_2KHZ  = {1,  0, false, "GEQ_2KHZ"};
constexpr PotRef GEQ_8KHZ  = {1,  1, false, "GEQ_8KHZ"};
constexpr PotRef GEQ_60HZ  = {1,  6, false, "GEQ_60HZ"};
constexpr PotRef GEQ_40HZ  = {1,  7, false, "GEQ_40HZ"};
constexpr PotRef GEQ_80HZ  = {1,  8, false, "GEQ_80HZ"};
constexpr PotRef GEQ_100HZ = {1,  9, false, "GEQ_100HZ"};
constexpr PotRef GEQ_250HZ = {1, 10, false, "GEQ_250HZ"};
constexpr PotRef GEQ_125HZ = {1, 11, false, "GEQ_125HZ"};
constexpr PotRef GEQ_500HZ = {1, 15, false, "GEQ_500HZ"};
// MUX 2 — high bands (note: "1600hz" in user spec → interpreted as 16 kHz)
constexpr PotRef GEQ_4KHZ  = {2,  0, false, "GEQ_4KHZ"};
constexpr PotRef GEQ_1KHZ  = {2, 15, false, "GEQ_1KHZ"};
constexpr PotRef GEQ_16KHZ = {2,  1, false, "GEQ_16KHZ"};

// Master filter section (HPF + LPF)
constexpr PotRef MASTER_HPF_FREQ = {2,  11, false, "MASTER_HPF_FREQ"};
constexpr PotRef MASTER_HPF_RES  = {2, 12, false, "MASTER_HPF_RES"};
constexpr PotRef MASTER_LPF_RES  = {2, 10, false, "MASTER_LPF_RES"};
constexpr PotRef MASTER_LPF_FREQ    = {2,  5, false, "MASTER_LPF_FREQ"};

// ---------------------------------------------------------------------------
// All named pots — single registration point for debug name lookup.
// Add every new PotRef here; getPotName() will find it automatically.
// ---------------------------------------------------------------------------

constexpr PotRef kAllNamedPots[] = {
    // Channel strips
    CH1_INPUT_GAIN, CH1_EQ_MID, CH1_EQ_LOW, CH1_EQ_HIGH, CH1_FX_SEND,
    CH2_INPUT_GAIN, CH2_EQ_MID, CH2_EQ_HIGH, CH2_EQ_LOW, CH2_FX_SEND,
    // Master parametric EQ
    MASTER_EQ_SUB_FREQ,  MASTER_EQ_SUB_GAIN,
    MASTER_EQ_KICK_FREQ, MASTER_EQ_KICK_GAIN,
    MASTER_EQ_MID_FREQ,  MASTER_EQ_MID_GAIN,
    MASTER_EQ_TOP_FREQ,  MASTER_EQ_TOP_GAIN,
    // Master filter section
    MASTER_HPF_FREQ, MASTER_HPF_RES,
    MASTER_LPF_FREQ, MASTER_LPF_RES,
    // Dub Siren
    SIREN_TYPE, SIREN_MOD, SIREN_GAIN, SIREN_FX_SEND,
    // Graphic EQ — 12 bands (40 Hz … 16 kHz)
    GEQ_40HZ, GEQ_60HZ, GEQ_80HZ, GEQ_100HZ, GEQ_125HZ, GEQ_250HZ,
    GEQ_500HZ, GEQ_1KHZ, GEQ_2KHZ, GEQ_4KHZ, GEQ_8KHZ, GEQ_16KHZ,
};

// ---------------------------------------------------------------------------
// Debug logging exclusion list
// ---------------------------------------------------------------------------

constexpr PotRef kIgnoredPots[] = {
    {2, 2, false, nullptr}, // MUX2/C02 — unassigned / floating
	{0, 4, false, nullptr}, // MUX2/C04 — unassigned / floating
};
constexpr int kIgnoredPotsCount = sizeof(kIgnoredPots) / sizeof(kIgnoredPots[0]);

// ---------------------------------------------------------------------------
// Pot name lookup — no switch/case needed, name lives in the PotRef itself.
// ---------------------------------------------------------------------------

/// Returns the name of the pot at (mux, pot), or nullptr if unassigned.
inline const char* getPotName(int mux, int pot) {
    for(const auto& p : kAllNamedPots)
        if(p.mux == mux && p.pot == pot) return p.name;
    return nullptr;
}

/// Returns the name stored in the PotRef — O(1), no lookup.
inline const char* getPotName(const PotRef& ref) { return ref.name; }
