#pragma once
#include "Biquad.h"
#include "ChannelStrip.h"

/**
 * Master effects bus: receives the summed output of all channel strips
 * and applies 4 independent kill switches.
 *
 * Each kill mutes a specific frequency band via a deep notch (-60 dB).
 * When all kills are OFF every filter sits at 0 dB → perfectly transparent.
 *
 * Band mapping (set in SoftwareConfig.h):
 *   SUB  — low shelf  below kKillSubFreq   (default  80 Hz)
 *   KICK — peaking    around kKillKickFreq (default 127 Hz, Q ≈ 1.05)
 *   MID  — peaking    around kKillMidFreq  (default 490 Hz, Q ≈ 0.49)
 *   TOP  — high shelf above  kKillTopFreq  (default 1200 Hz)
 *
 * Switch assignment (MCP23017 PA pins):
 *   PA0 → KICK   PA1 → SUB   PA2 → MID   PA3 → TOP
 * A pin reads LOW (pressed) when the kill is active.
 */
class MasterFx {
public:
    /** Must be called in setup() with the audio sample rate. */
    void setup(float sampleRate);

    /**
     * Updates kill states. Call once per render block before the sample loop.
     * A kill is active when its argument is true.
     */
    void setKills(bool killSub, bool killKick, bool killMid, bool killTop);

    /**
     * Gates one FX return sample to suppress noise when the effect is idle.
     * Call once per sample, before mixing the return into the master bus.
     */
    float processFxReturn(float sample);

    /** Process one mono sample through the kill stage. */
    float process(float input);

private:
    float sampleRate_ = 44100.f;

    BiquadFilter subKill_;   // low  shelf  @ kKillSubFreq
    BiquadFilter kickKill_;  // peaking     @ kKillKickFreq
    BiquadFilter midKill_;   // peaking     @ kKillMidFreq
    BiquadFilter topKill_;   // high shelf  @ kKillTopFreq

    NoiseGate fxReturnGate_;  // suppresses noise on the FX return bus when idle

    // Track previous states to recompute coefficients only on change
    bool lastSub_  = false;
    bool lastKick_ = false;
    bool lastMid_  = false;
    bool lastTop_  = false;

    // -60 dB is effectively silence; 0 dB = transparent pass-through
    static constexpr float kKillDb = -60.f;
    static constexpr float kPassDb =   0.f;
};
