#pragma once
#include "Biquad.h"
#include "SoftwareConfig.h"

/**
 * 4-band parallel crossover kill switch.
 *
 * The input is split into four isolated frequency bands via cascaded LP/HP
 * Butterworth filters; each band can be independently killed (faded to
 * silence) or passed through; the four bands are then re-summed.
 *
 *   SUB   =  LP(kKillFc0)
 *   KICK  =  HP(kKillFc0) → LP(kKillFc1)
 *   MID   =  HP(kKillFc1) → LP(kKillFc2)
 *   TOP   =  HP(kKillFc2)
 *
 *   Default crossover points (SoftwareConfig.h):
 *     kKillFc0 =   80 Hz   (SUB  / KICK boundary)
 *     kKillFc1 =  200 Hz   (KICK / MID  boundary)
 *     kKillFc2 = 1200 Hz   (MID  / TOP  boundary)
 *   Slope: kKillFilterStages × 12 dB/oct per edge.
 *
 * Click-free design — two independent ramps advance per sample in process():
 *
 *   crossoverMix_  0 → 1 : crossfade from clean bypass to crossover path.
 *                           Engages as soon as any kill is targeted, so the
 *                           signal never switches abruptly between paths.
 *   bandGain_[i]   1 → 0 : per-band fade when a kill is activated.
 *                   0 → 1 : fade-in when the kill is released.
 *
 * When no kill is active, crossoverMix_ returns to 0 and the raw input is
 * passed directly — crossover filters add no phase or magnitude artefact
 * during normal playback.
 *
 * Ramp duration: kKillRampMs (SoftwareConfig.h, default 30 ms).
 *
 * Usage pattern:
 *   1. Call setup() once with the audio sample rate.
 *   2. Call setKills() once per render block (before the sample loop).
 *   3. Call process() once per audio sample.
 */
class KillSwitch {
public:
    /** Initialises crossover filters and gain ramp step. */
    void setup(float sampleRate);

    /**
     * Updates kill targets. Both ramps (crossoverMix_ and bandGain_) advance
     * automatically inside process() — no blockSize argument needed.
     * Call once per render block before the sample loop.
     */
    void setKills(bool killSub, bool killKick, bool killMid, bool killTop);

    /** Process one mono sample through the 4-band kill stage. */
    float process(float input);

private:
    enum { SUB = 0, KICK = 1, MID = 2, TOP = 3 };
    enum { FC0 = 0, FC1 = 1, FC2 = 2 };

    float sampleRate_ = 44100.f;
    float rampStep_   = 0.f; // per-sample increment, computed from kKillRampMs

    BiquadFilter lp_[3][kKillFilterStages]; // [crossover index][stage]
    BiquadFilter hp_[3][kKillFilterStages];

    float bandGain_[4]   = {1.f, 1.f, 1.f, 1.f}; // current per-band gain (ramped per sample)
    float targetGain_[4] = {1.f, 1.f, 1.f, 1.f}; // target set by setKills()

    float crossoverMix_       = 0.f; // current blend: 0 = bypass, 1 = crossover sum
    float targetCrossoverMix_ = 0.f; // 1 when any kill is active, 0 otherwise
};
