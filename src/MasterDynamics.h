#pragma once
#include "Biquad.h"
#include "DspUtils.h"
#include "SoftwareConfig.h"

/**
 * Lightweight 4-band sound-system dynamics / punch processor.
 *
 * Splits the signal along the master crossover boundaries (kKillFc0/1/2)
 * and applies gentle per-band compression + make-up glue blended by `amount`
 * [0.0 .. 1.0]. Completely bypassed when amount <= 0.001f.
 */
class MasterDynamics {
public:
    /** Initialises crossover filters and envelope time constants. */
    void setup(float sampleRate);

    /** Sets punch / multiband compression blend [0.0 .. 1.0]. */
    void setAmount(float amount);

    /** Processes one sample through the 4-band dynamics stage. */
    float process(float input);

private:
    enum { SUB = 0, KICK = 1, MID = 2, TOP = 3 };

    float sampleRate_     = kDefaultSampleRate;
    float targetAmount_   = kMasterDynamicsDefault;
    float smoothAmount_   = kMasterDynamicsDefault;
    float amountCoeff_    = 0.f;
    float attackCoeff_    = 0.f;
    float releaseCoeff_   = 0.f;
    bool  wasBypassed_    = true;

    BiquadFilter lp_[3];
    BiquadFilter hp_[3];
    float env_[4] = {0.f, 0.f, 0.f, 0.f};
};
