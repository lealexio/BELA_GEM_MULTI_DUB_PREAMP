#pragma once
#include "KillSwitch.h"
#include "NoiseGate.h"
#include "ParametricEq.h"

/**
 * Master effects bus.
 *
 * Orchestrates all master processors in signal-flow order:
 *   1. ParametricEq  : 4-band sweepable peaking EQ (SUB / KICK / MID / TOP)
 *   2. KillSwitch    : 4-band crossover kill
 *   3. NoiseGate     : FX return noise suppression (separate path)
 *
 * Signal flow:
 *   channel strips (dry mix)
 *       └──► process(mix)
 *                 │
 *                 ▼
 *           ParametricEq   ← setParamEqBand() once per block
 *                 │
 *                 ▼
 *            KillSwitch    ← setKills() once per block
 *                 │
 *                 ▼
 *               OUT
 *
 *   effect unit (wet return)
 *       └──► processFxReturn() → NoiseGate → (summed in render.cpp)
 *
 * To add a new master effect: create a dedicated object, instantiate it here,
 * and call it in the appropriate place in process().
 *
 * Usage pattern:
 *   1. Call setup() once with the audio sample rate.
 *   2. Call setParamEqBand() and setKills() once per render block.
 *   3. Call processFxReturn() and process() once per audio sample.
 */
class MasterFx {
public:
    /** Initialises all sub-processors. Must be called before processing. */
    void setup(float sampleRate);

    /**
     * Updates one EQ band. Call for each of the 4 bands once per render block.
     * @param band     Target band (ParametricEq::SUB / KICK / MID / TOP)
     * @param freqPot  Raw pot value [0.0–1.0] — mapped to band frequency range
     * @param gainDb   Gain in dB; 0.0 = transparent (pot at centre)
     */
    void setParamEqBand(ParametricEq::Band band, float freqPot, float gainDb);

    /**
     * Updates kill targets. The gain ramp advances sample by sample in process().
     * Call once per render block before the sample loop.
     */
    void setKills(bool killSub, bool killKick, bool killMid, bool killTop);

    /**
     * Applies the FX-return noise gate to one sample.
     * Suppresses idle hum from the effect unit when no signal is fed.
     */
    float processFxReturn(float sample);

    /**
     * Processes one master-bus sample:  ParametricEq → KillSwitch.
     * @param input  Sum of all dry channel outputs (+ FX return if pre-kill)
     */
    float process(float input);

private:
    ParametricEq paramEq_;
    KillSwitch   kills_;
    NoiseGate    fxReturnGate_;
};
