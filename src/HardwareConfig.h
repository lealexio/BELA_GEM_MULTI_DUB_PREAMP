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
 * Runtime values (all extern) are defined in HardwareConfigData.cpp and
 * populated from config.json by ConfigLoader::load() in setup().
 * If config.json is absent the hardcoded defaults in HardwareConfigData.cpp
 * are used unchanged — the device boots correctly with no JSON file present.
 *
 * How to add a new pot:
 *   1. Declare an extern PotRef here.
 *   2. Define it with default values in HardwareConfigData.cpp.
 *   3. Add an entry for it in config.json under "pots".
 *   4. Add it to the kAllNamedPots[] definition in HardwareConfigData.cpp.
 *   5. Use it in render.cpp via gHardwareManager.getPotValue(MY_POT).
 */

// ---------------------------------------------------------------------------
// MUX topology — compile-time constants (used as array dimensions)
// ---------------------------------------------------------------------------

/// Maximum number of MUX chips the firmware can handle (sets array sizes).
constexpr int kNumMux     = 4;

/// Number of channels per MUX chip (CD74HC4067 = 16).
constexpr int kPotsPerMux = 16;

// ---------------------------------------------------------------------------
// MUX topology — runtime (loaded from JSON "mux" object)
// ---------------------------------------------------------------------------

/// Number of MUX chips physically wired to the Bela (≤ kNumMux).
extern int kActiveMux;

// ---------------------------------------------------------------------------
// Potentiometer calibration — runtime (loaded from JSON "calibration")
// ---------------------------------------------------------------------------

/// Voltage scaling factor: Bela ADC reference (4.096 V) ÷ MUX supply (3.3 V).
extern float kPotScaleRecovery;

/// Raw scaled value that maps to 1.0 (pots rarely reach the exact rail voltage).
extern float kPotMax;

/// Raw scaled values at or below this threshold are clamped to 0.0.
extern float kPotMin;

// ---------------------------------------------------------------------------
// MCP23017 I2C configuration — runtime (loaded from JSON "i2c")
// ---------------------------------------------------------------------------

extern const char* kI2cBus;
extern uint8_t     kMcpAddress;

// ---------------------------------------------------------------------------
// Audio routing — runtime (loaded from JSON "routing")
// ---------------------------------------------------------------------------

constexpr int kMasterOutsMax = 8; ///< Maximum number of master output channels.
extern int MASTER_OUTS[kMasterOutsMax]; ///< List of Bela output indices the master is written to.
extern int MASTER_OUTS_COUNT;           ///< Number of active entries in MASTER_OUTS[].

extern int FX1_SEND_OUT;
extern int FX1_RETURN_IN;
extern int FX2_SEND_OUT;
extern int FX2_RETURN_IN;

extern int VU_SUB_OUT;
extern int VU_KICK_OUT;
extern int VU_MID_OUT;
extern int VU_TOP_OUT;

// ---------------------------------------------------------------------------
// Audio routing — one entry per ChannelStrip instance
// ---------------------------------------------------------------------------

struct ChannelConfig {
    int audioIns[2]; ///< Bela audio input indices (-1 = unused slot).
};

extern ChannelConfig AUX1_CONFIG;
extern ChannelConfig AUX2_CONFIG;
extern ChannelConfig AUX3_CONFIG;
extern ChannelConfig AUX4_CONFIG;

// ---------------------------------------------------------------------------
// Switch mapping (MCP23017 PA/PB pins)
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

extern SwitchRef KILL_SUB;
extern SwitchRef KILL_KICK;
extern SwitchRef KILL_MID;
extern SwitchRef KILL_TOP;

extern SwitchRef FX_FILTER_MIDS;
extern SwitchRef FX_FILTER_TOPS;
extern SwitchRef FX2_FILTER_TOPS;
extern SwitchRef FX2_FILTER_MIDS;

extern SwitchRef SIREN_TRIGGER;

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
 *   name     : human-readable label used in debug logs and JSON key matching.
 *              nullptr = unlabelled.
 *   centered : true = apply power-curve around 0.5 (bipolar controls).
 *              getPotValue(PotRef) automatically calls getCenteredPotValue()
 *              when this flag is set.
 */
struct PotRef {
    int         mux;
    int         pot;
    bool        reversed = false;
    const char* name     = nullptr;
    bool        centered = false;
};

// --- MUX 0 ---
extern PotRef MASTER_GAIN;
extern PotRef SIREN_TYPE;
extern PotRef SIREN_MOD;

// --- MUX 3 — siren + channel gain/send ---
extern PotRef SIREN_GAIN;
extern PotRef SIREN_FX_SEND;
extern PotRef SIREN_FX2_SEND;

// AUX 1 (IN0 → master)
extern PotRef AUX1_INPUT_GAIN;
extern PotRef AUX1_EQ_MID;
extern PotRef AUX1_EQ_LOW;
extern PotRef AUX1_EQ_HIGH;
extern PotRef AUX1_FX_SEND;
extern PotRef AUX1_FX2_SEND;

// AUX 2 (IN1 → master)
extern PotRef AUX2_INPUT_GAIN;
extern PotRef AUX2_EQ_MID;
extern PotRef AUX2_EQ_HIGH;
extern PotRef AUX2_EQ_LOW;
extern PotRef AUX2_FX_SEND;
extern PotRef AUX2_FX2_SEND;

// AUX 3 (IN2 → master)
extern PotRef AUX3_INPUT_GAIN;
extern PotRef AUX3_EQ_LOW;
extern PotRef AUX3_EQ_MID;
extern PotRef AUX3_EQ_HIGH;
extern PotRef AUX3_FX_SEND;
extern PotRef AUX3_FX2_SEND;

// AUX 4 (IN3 → master)
extern PotRef AUX4_INPUT_GAIN;
extern PotRef AUX4_EQ_LOW;
extern PotRef AUX4_EQ_MID;
extern PotRef AUX4_EQ_HIGH;
extern PotRef AUX4_FX_SEND;
extern PotRef AUX4_FX2_SEND;

// Master parametric EQ
extern PotRef MASTER_EQ_SUB_FREQ;
extern PotRef MASTER_EQ_SUB_GAIN;
extern PotRef MASTER_EQ_KICK_FREQ;
extern PotRef MASTER_EQ_KICK_GAIN;
extern PotRef MASTER_EQ_MID_FREQ;
extern PotRef MASTER_EQ_MID_GAIN;
extern PotRef MASTER_EQ_TOP_FREQ;
extern PotRef MASTER_EQ_TOP_GAIN;

// Band Trim
extern PotRef BTRIM_TOP;
extern PotRef BTRIM_MID;
extern PotRef BTRIM_KICK;
extern PotRef BTRIM_SUB;

// Graphic EQ (12 bands)
extern PotRef GEQ_2KHZ;
extern PotRef GEQ_8KHZ;
extern PotRef GEQ_60HZ;
extern PotRef GEQ_40HZ;
extern PotRef GEQ_80HZ;
extern PotRef GEQ_100HZ;
extern PotRef GEQ_250HZ;
extern PotRef GEQ_125HZ;
extern PotRef GEQ_500HZ;
extern PotRef GEQ_4KHZ;
extern PotRef GEQ_1KHZ;
extern PotRef GEQ_16KHZ;

// Master filter section (HPF + LPF)
extern PotRef MASTER_HPF_FREQ;
extern PotRef MASTER_HPF_RES;
extern PotRef MASTER_LPF_RES;
extern PotRef MASTER_LPF_FREQ;

// ---------------------------------------------------------------------------
// All named pots — runtime array, single registration point for name lookup.
// Defined in HardwareConfigData.cpp; size tracked by kAllNamedPotsCount.
// ---------------------------------------------------------------------------

constexpr int kAllNamedPotsMax = 64; ///< Upper bound — increase if more pots are added.
extern PotRef kAllNamedPots[kAllNamedPotsMax];
extern int    kAllNamedPotsCount;

// ---------------------------------------------------------------------------
// Debug logging exclusion list — runtime array.
// ---------------------------------------------------------------------------

constexpr int kIgnoredPotsMax = 16;
extern PotRef kIgnoredPots[kIgnoredPotsMax];
extern int    kIgnoredPotsCount;

// ---------------------------------------------------------------------------
// Pot name lookup — no switch/case needed, name lives in the PotRef itself.
// ---------------------------------------------------------------------------

/// Returns the name of the pot at (mux, pot), or nullptr if unassigned.
inline const char* getPotName(int mux, int pot) {
    for(int i = 0; i < kAllNamedPotsCount; ++i)
        if(kAllNamedPots[i].mux == mux && kAllNamedPots[i].pot == pot)
            return kAllNamedPots[i].name;
    return nullptr;
}

/// Returns the name stored in the PotRef — O(1), no lookup.
inline const char* getPotName(const PotRef& ref) { return ref.name; }
