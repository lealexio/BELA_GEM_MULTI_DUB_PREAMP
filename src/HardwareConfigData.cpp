#include "HardwareConfig.h"

/**
 * Default definitions for every runtime hardware config variable declared in
 * HardwareConfig.h.  These values are identical to the former compile-time
 * constexpr constants and serve as the fallback when config.json is absent or
 * malformed.  ConfigLoader::load() overwrites them at startup when a valid
 * JSON file is found.
 */

// ---------------------------------------------------------------------------
// MUX topology
// ---------------------------------------------------------------------------

int kActiveMux = 4;

// ---------------------------------------------------------------------------
// Potentiometer calibration
// ---------------------------------------------------------------------------

float kPotScaleRecovery = 4.096f / 3.3f;
float kPotMax           = 0.997f;
float kPotMin           = 0.005f;

// ---------------------------------------------------------------------------
// MCP23017 I2C configuration
// ---------------------------------------------------------------------------

const char* kI2cBus    = "/dev/i2c-1";
uint8_t     kMcpAddress = 0x20;

// ---------------------------------------------------------------------------
// Audio routing
// ---------------------------------------------------------------------------

int MASTER_OUTS[kMasterOutsMax] = {1};
int MASTER_OUTS_COUNT           = 2;

int FX1_SEND_OUT  = 2;
int FX1_RETURN_IN = 6;
int FX2_SEND_OUT  = 3;
int FX2_RETURN_IN = 7;

int VU_SUB_OUT  = 9;
int VU_KICK_OUT = 8;
int VU_MID_OUT  = 7;
int VU_TOP_OUT  = 6;

ChannelConfig AUX1_CONFIG = { {0, -1} };
ChannelConfig AUX2_CONFIG = { {1, -1} };
ChannelConfig AUX3_CONFIG = { {3, -1} };
ChannelConfig AUX4_CONFIG = { {5, -1} };

// ---------------------------------------------------------------------------
// Switch mapping
// ---------------------------------------------------------------------------

SwitchRef KILL_SUB  = {0, false, false};
SwitchRef KILL_KICK = {1, false, false};
SwitchRef KILL_MID  = {2, true,  false};
SwitchRef KILL_TOP  = {3, false, false};

SwitchRef FX_FILTER_MIDS  = {5, false, false};
SwitchRef FX_FILTER_TOPS  = {6, false, false};
SwitchRef FX2_FILTER_TOPS = {4, false, false};
SwitchRef FX2_FILTER_MIDS = {7, false, false};

SwitchRef SIREN_TRIGGER = {0, false, true};

// ---------------------------------------------------------------------------
// Potentiometer mapping
// ---------------------------------------------------------------------------

// MUX 0
PotRef MASTER_GAIN  = {0,  1, true,  "MASTER_GAIN"};
PotRef SIREN_TYPE   = {0, 10, true,  "SIREN_TYPE"};
PotRef SIREN_MOD    = {0,  9, true,  "SIREN_MOD"};

// MUX 3 — siren + channel gain/send
PotRef SIREN_GAIN     = {3,  0, true,  "SIREN_GAIN"};
PotRef SIREN_FX_SEND  = {3, 11, true,  "SIREN_FX_SEND"};
PotRef SIREN_FX2_SEND = {3, 10, true,  "SIREN_FX2_SEND"};

// AUX 1
PotRef AUX1_INPUT_GAIN = {3,  2, true,  "AUX1_INPUT_GAIN"};
PotRef AUX1_EQ_MID     = {0,  5, true,  "AUX1_EQ_MID",  true};
PotRef AUX1_EQ_LOW     = {0, 14, true,  "AUX1_EQ_LOW",  true};
PotRef AUX1_EQ_HIGH    = {0,  3, true,  "AUX1_EQ_HIGH", true};
PotRef AUX1_FX_SEND    = {3,  3, true,  "AUX1_FX_SEND"};
PotRef AUX1_FX2_SEND   = {3,  4, true,  "AUX1_FX2_SEND"};

// AUX 2
PotRef AUX2_INPUT_GAIN = {3,  7, true,  "AUX2_INPUT_GAIN"};
PotRef AUX2_EQ_MID     = {0,  6, true,  "AUX2_EQ_MID",  true};
PotRef AUX2_EQ_HIGH    = {1, 12, true,  "AUX2_EQ_HIGH", true};
PotRef AUX2_EQ_LOW     = {0, 13, true,  "AUX2_EQ_LOW",  true};
PotRef AUX2_FX_SEND    = {3,  6, true,  "AUX2_FX_SEND"};
PotRef AUX2_FX2_SEND   = {3,  5, true,  "AUX2_FX2_SEND"};

// AUX 3
PotRef AUX3_INPUT_GAIN = {3,  8, true,  "AUX3_INPUT_GAIN"};
PotRef AUX3_EQ_LOW     = {0, 12, true,  "AUX3_EQ_LOW",  true};
PotRef AUX3_EQ_MID     = {0,  7, true,  "AUX3_EQ_MID",  true};
PotRef AUX3_EQ_HIGH    = {1, 13, true,  "AUX3_EQ_HIGH", true};
PotRef AUX3_FX_SEND    = {3,  9, true,  "AUX3_FX_SEND"};
PotRef AUX3_FX2_SEND   = {3, 13, true,  "AUX3_FX2_SEND"};

// AUX 4
PotRef AUX4_INPUT_GAIN = {3, 15, true,  "AUX4_INPUT_GAIN"};
PotRef AUX4_EQ_LOW     = {0, 11, true,  "AUX4_EQ_LOW",  true};
PotRef AUX4_EQ_MID     = {0,  8, true,  "AUX4_EQ_MID",  true};
PotRef AUX4_EQ_HIGH    = {1, 14, true,  "AUX4_EQ_HIGH", true};
PotRef AUX4_FX_SEND    = {3, 14, true,  "AUX4_FX_SEND"};
PotRef AUX4_FX2_SEND   = {3, 12, true,  "AUX4_FX2_SEND"};

// Master parametric EQ
PotRef MASTER_EQ_SUB_FREQ  = {2, 14, true,  "MASTER_EQ_SUB_FREQ"};
PotRef MASTER_EQ_SUB_GAIN  = {2, 13, true,  "MASTER_EQ_SUB_GAIN",  true};
PotRef MASTER_EQ_KICK_FREQ = {2,  8, true,  "MASTER_EQ_KICK_FREQ"};
PotRef MASTER_EQ_KICK_GAIN = {2,  9, true,  "MASTER_EQ_KICK_GAIN", true};
PotRef MASTER_EQ_MID_FREQ  = {3,  1, false, "MASTER_EQ_MID_FREQ"};
PotRef MASTER_EQ_MID_GAIN  = {2,  7, true,  "MASTER_EQ_MID_GAIN",  true};
PotRef MASTER_EQ_TOP_FREQ  = {2,  3, true,  "MASTER_EQ_TOP_FREQ"};
PotRef MASTER_EQ_TOP_GAIN  = {2,  6, true,  "MASTER_EQ_TOP_GAIN",  true};

// Band Trim
PotRef BTRIM_TOP  = {1, 2, true, "BTRIM_TOP",  true};
PotRef BTRIM_MID  = {1, 3, true, "BTRIM_MID",  true};
PotRef BTRIM_KICK = {1, 4, true, "BTRIM_KICK", true};
PotRef BTRIM_SUB  = {1, 5, true, "BTRIM_SUB",  true};

// Graphic EQ (12 bands)
PotRef GEQ_2KHZ  = {1,  0, true, "GEQ_2KHZ",  true};
PotRef GEQ_8KHZ  = {1,  1, true, "GEQ_8KHZ",  true};
PotRef GEQ_60HZ  = {1,  6, true, "GEQ_60HZ",  true};
PotRef GEQ_40HZ  = {1,  7, true, "GEQ_40HZ",  true};
PotRef GEQ_80HZ  = {1,  8, true, "GEQ_80HZ",  true};
PotRef GEQ_100HZ = {1,  9, true, "GEQ_100HZ", true};
PotRef GEQ_250HZ = {1, 10, true, "GEQ_250HZ", true};
PotRef GEQ_125HZ = {1, 11, true, "GEQ_125HZ", true};
PotRef GEQ_500HZ = {1, 15, true, "GEQ_500HZ", true};
PotRef GEQ_4KHZ  = {2,  0, true, "GEQ_4KHZ",  true};
PotRef GEQ_1KHZ  = {2, 15, true, "GEQ_1KHZ",  true};
PotRef GEQ_16KHZ = {2,  1, true, "GEQ_16KHZ", true};

// Master filter section
PotRef MASTER_HPF_FREQ = {2, 11, true,  "MASTER_HPF_FREQ"};
PotRef MASTER_HPF_RES  = {2, 12, true,  "MASTER_HPF_RES"};
PotRef MASTER_LPF_RES  = {2, 10, true,  "MASTER_LPF_RES"};
PotRef MASTER_LPF_FREQ = {2,  5, false, "MASTER_LPF_FREQ"};

// ---------------------------------------------------------------------------
// All named pots — single registration point for debug name lookup.
// ConfigLoader rebuilds this array from JSON when a config file is present.
// ---------------------------------------------------------------------------

PotRef kAllNamedPots[kAllNamedPotsMax] = {
    // Channel strips
    AUX1_INPUT_GAIN, AUX1_EQ_MID, AUX1_EQ_LOW, AUX1_EQ_HIGH, AUX1_FX_SEND, AUX1_FX2_SEND,
    AUX2_INPUT_GAIN, AUX2_EQ_MID, AUX2_EQ_HIGH, AUX2_EQ_LOW, AUX2_FX_SEND, AUX2_FX2_SEND,
    AUX3_INPUT_GAIN, AUX3_EQ_LOW, AUX3_EQ_MID, AUX3_EQ_HIGH, AUX3_FX_SEND, AUX3_FX2_SEND,
    AUX4_INPUT_GAIN, AUX4_EQ_LOW, AUX4_EQ_MID, AUX4_EQ_HIGH, AUX4_FX_SEND, AUX4_FX2_SEND,
    // Master output
    MASTER_GAIN,
    // Master parametric EQ
    MASTER_EQ_SUB_FREQ,  MASTER_EQ_SUB_GAIN,
    MASTER_EQ_KICK_FREQ, MASTER_EQ_KICK_GAIN,
    MASTER_EQ_MID_FREQ,  MASTER_EQ_MID_GAIN,
    MASTER_EQ_TOP_FREQ,  MASTER_EQ_TOP_GAIN,
    // Master filter section
    MASTER_HPF_FREQ, MASTER_HPF_RES,
    MASTER_LPF_FREQ, MASTER_LPF_RES,
    // Band Trim
    BTRIM_SUB, BTRIM_KICK, BTRIM_MID, BTRIM_TOP,
    // Dub Siren
    SIREN_TYPE, SIREN_MOD, SIREN_GAIN, SIREN_FX_SEND, SIREN_FX2_SEND,
    // Graphic EQ — 12 bands
    GEQ_40HZ, GEQ_60HZ, GEQ_80HZ, GEQ_100HZ, GEQ_125HZ, GEQ_250HZ,
    GEQ_500HZ, GEQ_1KHZ, GEQ_2KHZ, GEQ_4KHZ, GEQ_8KHZ, GEQ_16KHZ,
};
int kAllNamedPotsCount = 58;

// ---------------------------------------------------------------------------
// Debug logging exclusion list
// ---------------------------------------------------------------------------

PotRef kIgnoredPots[kIgnoredPotsMax] = {
    {2, 2, false, nullptr},
    {0, 2, false, nullptr},
    {0, 4, false, nullptr},
    {2, 4, false, nullptr},
};
int kIgnoredPotsCount = 4;
