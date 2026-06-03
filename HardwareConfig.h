#pragma once

/**
 * Physical mapping of all potentiometers.
 *
 * Usage:
 *   gHardwareManager.getPotValue(INPUT_GAIN)        // PotRef overload
 *   gHardwareManager.getPotValue(INPUT_GAIN.mux, INPUT_GAIN.pot)
 *
 * To add a new MUX: increment kActiveMux in HardwareManager.h,
 * then define your new PotRef entries with mux = 1 (or 2, 3).
 */

struct PotRef {
    int mux;
    int pot;
};

// ---------------------------------------------------------------------------
// MUX 0  (analog input A0)
// ---------------------------------------------------------------------------

constexpr PotRef EQ_LOW_GAIN   = {0,  0};  // C00 — low  shelf  equaliser
constexpr PotRef INPUT_GAIN    = {0,  1};  // C01 — input volume
constexpr PotRef POT_MUX0_C02  = {0,  2};  // C02 — unassigned
constexpr PotRef POT_MUX0_C03  = {0,  3};  // C03 — unassigned
constexpr PotRef POT_MUX0_C04  = {0,  4};  // C04 — unassigned
constexpr PotRef POT_MUX0_C05  = {0,  5};  // C05 — unassigned
constexpr PotRef POT_MUX0_C06  = {0,  6};  // C06 — unassigned
constexpr PotRef POT_MUX0_C07  = {0,  7};  // C07 — unassigned
constexpr PotRef POT_MUX0_C08  = {0,  8};  // C08 — unassigned
constexpr PotRef POT_MUX0_C09  = {0,  9};  // C09 — unassigned
constexpr PotRef POT_MUX0_C10  = {0, 10};  // C10 — unassigned
constexpr PotRef POT_MUX0_C11  = {0, 11};  // C11 — unassigned
constexpr PotRef POT_MUX0_C12  = {0, 12};  // C12 — unassigned
constexpr PotRef POT_MUX0_C13  = {0, 13};  // C13 — unassigned
constexpr PotRef EQ_HIGH_GAIN  = {0, 14};  // C14 — high shelf  equaliser
constexpr PotRef EQ_MID_GAIN   = {0, 15};  // C15 — mid  peak   equaliser

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
            case  0: return "EQ_LOW_GAIN";
            case  1: return "INPUT_GAIN";
            case 14: return "EQ_HIGH_GAIN";
            case 15: return "EQ_MID_GAIN";
            default: return nullptr; // unassigned → caller prints raw index
        }
    }
    return nullptr;
}

inline const char* getPotName(PotRef ref) { return getPotName(ref.mux, ref.pot); }
