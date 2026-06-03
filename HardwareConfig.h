#pragma once

/**
 * Physical mapping of all potentiometers and audio routing per channel strip.
 *
 * ChannelConfig defines which Bela audio inputs feed a strip and which output
 * it drives. When numIns == 2, the two inputs are averaged to mono before
 * entering the DSP chain.
 *
 * Usage:
 *   gHardwareManager.getPotValue(CH1_INPUT_GAIN)        // PotRef overload
 *   gHardwareManager.getPotValue(CH1_INPUT_GAIN.mux, CH1_INPUT_GAIN.pot)
 *
 * To add a new MUX: increment kActiveMux in HardwareManager.h,
 * then define your new PotRef entries with mux = 1 (or 2, 3).
 */

// ---------------------------------------------------------------------------
// Audio routing — one entry per ChannelStrip instance
// ---------------------------------------------------------------------------

struct ChannelConfig {
    int audioIns[2]; // Bela audio input indices; -1 = unused slot
    int audioOut;    // Bela audio output index
};

constexpr ChannelConfig CH1_CONFIG = { {0, -1}, 0 }; // IN0 → OUT0
constexpr ChannelConfig CH2_CONFIG = { {1, -1}, 1 }; // IN1 → OUT1

// ---------------------------------------------------------------------------
// Pot mapping structs
// ---------------------------------------------------------------------------

struct PotRef {
    int  mux;
    int  pot;
    bool reversed = false; // true = invert rotation (1.0 → 0.0 becomes 0.0 → 1.0)
};

// ---------------------------------------------------------------------------
// MUX 0  (analog input A0)
// ---------------------------------------------------------------------------

// --- Channel Strip 1 (IN0 → OUT0) ---
constexpr PotRef CH1_INPUT_GAIN  = {0,  1, true};  // C01 — channel 1 input volume
constexpr PotRef CH1_EQ_MID      = {0,  0, true};  // C00 — channel 1 mid  peak
constexpr PotRef CH1_EQ_LOW      = {0, 14, true};  // C14 — channel 1 low  shelf
constexpr PotRef CH1_EQ_HIGH     = {0, 15, true};  // C15 — channel 1 high shelf

// --- Channel Strip 2 (IN1 → OUT1) ---
constexpr PotRef CH2_INPUT_GAIN  = {0,  6, true};        // C03 — channel 2 input volume
constexpr PotRef CH2_EQ_MID      = {0,  7, true};        // C07 — channel 2 mid  peak
constexpr PotRef CH2_EQ_HIGH     = {0,  8, true};        // C08 — channel 2 high shelf
constexpr PotRef CH2_EQ_LOW      = {0,  9, true};        // C09 — channel 2 low  shelf

// ---------------------------------------------------------------------------
// MUX 1  (analog input A1) — uncomment when physically connected
//         and set kActiveMux = 2 in HardwareManager.h
// ---------------------------------------------------------------------------

// constexpr PotRef POT_MUX1_C00 = {1,  0};
// constexpr PotRef POT_MUX1_C01 = {1,  1};
// ... (add entries as needed)

// ---------------------------------------------------------------------------
// Pots to exclude from debug logging (floating inputs, under investigation…)
// Add or remove entries as needed; leave the array empty to log everything.
// ---------------------------------------------------------------------------

constexpr PotRef kIgnoredPots[] = {
    {1, 2},  // MUX1/C02 — under investigation
    {2, 2},  // MUX2/C02 — under investigation
};
constexpr int kIgnoredPotsCount = sizeof(kIgnoredPots) / sizeof(kIgnoredPots[0]);

// ---------------------------------------------------------------------------
// Human-readable name lookup — update when you assign new pots
// Max 4 MUX × 16 pots = 64 entries; unassigned slots show "MUX{m}/C{p}"
// ---------------------------------------------------------------------------

inline const char* getPotName(int mux, int pot) {
    if(mux == 0) {
        switch(pot) {
            case  0: return "CH1_EQ_MID";
            case  1: return "CH1_INPUT_GAIN";
            case  6: return "CH2_INPUT_GAIN";
            case  7: return "CH2_EQ_MID";
            case  8: return "CH2_EQ_HIGH";
            case  9: return "CH2_EQ_LOW";
            case 14: return "CH1_EQ_LOW";
            case 15: return "CH1_EQ_HIGH";
            default: return nullptr; // unassigned → caller prints raw index
        }
    }
    return nullptr;
}

inline const char* getPotName(PotRef ref) { return getPotName(ref.mux, ref.pot); }
