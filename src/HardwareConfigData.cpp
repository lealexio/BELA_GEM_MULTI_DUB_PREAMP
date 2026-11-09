#include "HardwareConfig.h"

/**
 * Default definitions for every runtime hardware config variable declared in
 * HardwareConfig.h.  These values serve as the fallback when config.json is
 * absent or malformed.  ConfigLoader::load() overwrites them at startup when a
 * valid JSON file is found.
 */

// ---------------------------------------------------------------------------
// MUX topology
// ---------------------------------------------------------------------------

int kActiveMux = 8;

// ---------------------------------------------------------------------------
// Potentiometer calibration
// ---------------------------------------------------------------------------

float kPotScaleRecovery = 4.096f / 3.3f;
float kPotMax           = 0.997f;
float kPotMin           = 0.005f;

// ---------------------------------------------------------------------------
// MCP23017 I2C configuration
// ---------------------------------------------------------------------------

const char* kI2cBus     = "/dev/i2c-1";
uint8_t     kMcpAddress = 0x20;

// ---------------------------------------------------------------------------
// Audio routing
// ---------------------------------------------------------------------------

int MASTER_OUTS[kMasterOutsMax] = {2, 3};
int MASTER_OUTS_COUNT           = 2;
bool MASTER_STEREO              = true;

int FX1_SEND_OUT  = 0;
int FX1_RETURN_IN = 0;
int FX2_SEND_OUT  = 1;
int FX2_RETURN_IN = 1;

int VU_SUB_OUT  = 9;
int VU_KICK_OUT = 8;
int VU_MID_OUT  = 7;
int VU_TOP_OUT  = 6;

// Codec defaults — 0 dB (unity). Overwritten from config.json routing.*.gain.
float CODEC_INPUT_GAIN_DB[kCodecChannels] = {};
float CODEC_OUTPUT_GAIN_DB[kCodecChannels] = {};

// AUX1-4: stereo pairs IN2/3, IN4/5, IN6/7, IN8/9
ChannelConfig AUX1_CONFIG = { {2, 3}, false, 0.f };
ChannelConfig AUX2_CONFIG = { {4, 5}, false, 0.f };
ChannelConfig AUX3_CONFIG = { {6, 7}, false, 0.f };
ChannelConfig AUX4_CONFIG = { {8, 9}, false, 0.f };

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
// Clip LED mapping (MCP23017 outputs)
// Disabled by default. All MCP23017 pins remain inputs in read mode unless
// explicitly configured in config.json.
// ---------------------------------------------------------------------------

ClipLedRef CLIP_LED_MASTER = {-1, false, false, false};
ClipLedRef CLIP_LED_AUX1   = {-1, false, false, false};
ClipLedRef CLIP_LED_AUX2   = {-1, false, false, false};
ClipLedRef CLIP_LED_AUX3   = {-1, false, false, false};
ClipLedRef CLIP_LED_AUX4   = {-1, false, false, false};

// ---------------------------------------------------------------------------
// Potentiometer mapping (7 MUX x 10 channels)
// ---------------------------------------------------------------------------

// --- MUX 0: AUX 1 (IN2/3) & FX Return Gains ---
PotRef AUX1_INPUT_GAIN = {0, 0, true, "AUX1_INPUT_GAIN"};
PotRef AUX1_EQ_LOW     = {0, 1, true, "AUX1_EQ_LOW",  true};
PotRef AUX1_EQ_MID     = {0, 2, true, "AUX1_EQ_MID",  true};
PotRef AUX1_EQ_HIGH    = {0, 3, true, "AUX1_EQ_HIGH", true};
PotRef AUX1_FX_SEND    = {0, 4, true, "AUX1_FX_SEND"};
PotRef AUX1_FX2_SEND   = {0, 5, true, "AUX1_FX2_SEND"};
PotRef FX1_RETURN_GAIN = {0, 6, true, "FX1_RETURN_GAIN", false};
PotRef FX2_RETURN_GAIN = {0, 7, true, "FX2_RETURN_GAIN", true};

// --- MUX 1: AUX 2 (IN4/5) & GEQ High ---
PotRef AUX2_INPUT_GAIN = {1, 0, true, "AUX2_INPUT_GAIN"};
PotRef AUX2_EQ_LOW     = {1, 1, true, "AUX2_EQ_LOW",  true};
PotRef AUX2_EQ_MID     = {1, 2, true, "AUX2_EQ_MID",  true};
PotRef AUX2_EQ_HIGH    = {1, 3, true, "AUX2_EQ_HIGH", true};
PotRef AUX2_FX_SEND    = {1, 4, true, "AUX2_FX_SEND"};
PotRef AUX2_FX2_SEND   = {1, 5, true, "AUX2_FX2_SEND"};
PotRef GEQ_1KHZ        = {1, 6, true, "GEQ_1KHZ",     true};
PotRef GEQ_2KHZ        = {1, 7, true, "GEQ_2KHZ",     true};

// --- MUX 2: AUX 3 (IN6/7) & GEQ Very High ---
PotRef AUX3_INPUT_GAIN = {2, 0, true, "AUX3_INPUT_GAIN"};
PotRef AUX3_EQ_LOW     = {2, 1, true, "AUX3_EQ_LOW",  true};
PotRef AUX3_EQ_MID     = {2, 2, true, "AUX3_EQ_MID",  true};
PotRef AUX3_EQ_HIGH    = {2, 3, true, "AUX3_EQ_HIGH", true};
PotRef AUX3_FX_SEND    = {2, 4, true, "AUX3_FX_SEND"};
PotRef AUX3_FX2_SEND   = {2, 5, true, "AUX3_FX2_SEND"};
PotRef GEQ_4KHZ        = {2, 6, true, "GEQ_4KHZ",     true};
PotRef GEQ_8KHZ        = {2, 7, true, "GEQ_8KHZ",     true};

// --- MUX 3: AUX 4 (IN8/9) & GEQ Extreme ---
PotRef AUX4_INPUT_GAIN = {3, 0, true, "AUX4_INPUT_GAIN"};
PotRef AUX4_EQ_LOW     = {3, 1, true, "AUX4_EQ_LOW",  true};
PotRef AUX4_EQ_MID     = {3, 2, true, "AUX4_EQ_MID",  true};
PotRef AUX4_EQ_HIGH    = {3, 3, true, "AUX4_EQ_HIGH", true};
PotRef AUX4_FX_SEND    = {3, 4, true, "AUX4_FX_SEND"};
PotRef AUX4_FX2_SEND   = {3, 5, true, "AUX4_FX2_SEND"};
PotRef GEQ_16KHZ       = {3, 6, true, "GEQ_16KHZ",    true};

// --- MUX 4: Master Parametric EQ & HPF ---
PotRef MASTER_EQ_SUB_FREQ  = {4, 0, true,  "MASTER_EQ_SUB_FREQ"};
PotRef MASTER_EQ_SUB_GAIN  = {4, 1, true,  "MASTER_EQ_SUB_GAIN",  true};
PotRef MASTER_EQ_KICK_FREQ = {4, 2, true,  "MASTER_EQ_KICK_FREQ"};
PotRef MASTER_EQ_KICK_GAIN = {4, 3, true,  "MASTER_EQ_KICK_GAIN", true};
PotRef MASTER_EQ_MID_FREQ  = {4, 4, false, "MASTER_EQ_MID_FREQ"};
PotRef MASTER_EQ_MID_GAIN  = {4, 5, true,  "MASTER_EQ_MID_GAIN",  true};
PotRef MASTER_EQ_TOP_FREQ  = {4, 6, true,  "MASTER_EQ_TOP_FREQ"};
PotRef MASTER_EQ_TOP_GAIN  = {4, 7, true,  "MASTER_EQ_TOP_GAIN",  true};
PotRef MASTER_HPF_FREQ     = {4, 8, true,  "MASTER_HPF_FREQ"};
PotRef MASTER_HPF_RES      = {4, 9, true,  "MASTER_HPF_RES"};

// --- MUX 5: Master Filters, Band Trim, Master Gain ---
PotRef MASTER_LPF_FREQ = {5, 0, false, "MASTER_LPF_FREQ"};
PotRef MASTER_LPF_RES  = {5, 1, false, "MASTER_LPF_RES"};
PotRef BTRIM_SUB       = {5, 2, true,  "BTRIM_SUB",  true};
PotRef BTRIM_KICK      = {5, 3, true,  "BTRIM_KICK", true};
PotRef BTRIM_MID       = {5, 4, true,  "BTRIM_MID",  true};
PotRef BTRIM_TOP       = {5, 5, true,  "BTRIM_TOP",  true};
PotRef MASTER_GAIN     = {5, 6, true,  "MASTER_GAIN"};
PotRef GEQ_250HZ       = {5, 7, true,  "GEQ_250HZ",  true};
PotRef GEQ_500HZ       = {5, 8, true,  "GEQ_500HZ",  true};

// --- MUX 6: Dub Siren & Graphic EQ Low Bands ---
PotRef SIREN_TYPE      = {6, 0, true, "SIREN_TYPE"};
PotRef SIREN_MOD       = {6, 1, true, "SIREN_MOD"};
PotRef SIREN_GAIN      = {6, 2, true, "SIREN_GAIN"};
PotRef SIREN_FX_SEND   = {6, 3, true, "SIREN_FX_SEND"};
PotRef SIREN_FX2_SEND  = {6, 4, true, "SIREN_FX2_SEND"};
PotRef GEQ_40HZ        = {6, 5, true, "GEQ_40HZ",  true};
PotRef GEQ_60HZ        = {6, 6, true, "GEQ_60HZ",  true};
PotRef GEQ_80HZ        = {6, 7, true, "GEQ_80HZ",  true};
PotRef GEQ_100HZ       = {6, 8, true, "GEQ_100HZ", true};
PotRef GEQ_125HZ       = {6, 9, true, "GEQ_125HZ", true};

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
    // FX return input gains
    FX1_RETURN_GAIN, FX2_RETURN_GAIN,
};
int kAllNamedPotsCount = 60;

// ---------------------------------------------------------------------------
// Debug logging exclusion list
// ---------------------------------------------------------------------------

PotRef kIgnoredPots[kIgnoredPotsMax] = {};
int kIgnoredPotsCount = 0;
