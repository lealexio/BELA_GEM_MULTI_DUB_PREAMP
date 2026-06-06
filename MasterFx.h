#pragma once
#include "Biquad.h"
#include "ChannelStrip.h"

/**
 * Master effects bus: receives the summed output of all channel strips
 * and applies 4 independent kill switches.
 *
 * Each kill smoothly ramps its band gain from 0 dB to -60 dB (and back)
 * over kKillRampMs to avoid pops. The ramp is updated once per render block.
 *
 * Band mapping:
 *   SUB  — low shelf  below  80 Hz
 *   KICK — peaking    around 127 Hz
 *   MID  — peaking    around 490 Hz
 *   TOP  — high shelf above 1200 Hz
 *
 * Switch assignment (MCP23017 PA pins):
 *   PA0 → KICK   PA1 → SUB   PA2 → MID   PA3 → TOP
 */
class MasterFx {
public:
    /** Must be called in setup() with the audio sample rate. */
    void setup(float sampleRate);

    /**
     * Updates kill states and advances gain ramps. Call once per render block.
     * @param blockSize number of audio frames in the current render block
     */
    void setKills(bool killSub, bool killKick, bool killMid, bool killTop,
                  unsigned int blockSize);

    /**
     * Gates one FX return sample to suppress noise when the effect is idle.
     * Call once per sample, before mixing the return into the master bus.
     */
    float processFxReturn(float sample);

    /** Process one mono sample through the kill stage. */
    float process(float input);

private:
    // Band indices
    enum { SUB = 0, KICK = 1, MID = 2, TOP = 3 };

    float sampleRate_ = 44100.f;

    BiquadFilter filters_[4];    // one per band
    float currentDb_[4] = {};    // current gain in dB for each band (starts at 0)
    float targetDb_[4]  = {};    // target gain in dB (0 = pass, -60 = kill)

    NoiseGate fxReturnGate_;

    /** Updates one filter's coefficients for the given gain in dB. */
    void updateFilter(int band, float gainDb);

    static constexpr float kKillDb = -60.f;
    static constexpr float kPassDb =   0.f;
};
