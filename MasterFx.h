#pragma once
#include "KillSwitch.h"
#include "NoiseGate.h"

/**
 * Master effects bus.
 *
 * Orchestrates the two currently active master processors:
 *   - KillSwitch   : 4-band crossover kill (SUB / KICK / MID / TOP)
 *   - NoiseGate    : suppresses idle noise on the FX return line
 *
 * Additional master effects (compressor, limiter, reverb, …) can be added
 * by composing new objects here without modifying the channel strips or
 * the render loop.
 *
 * Signal flow:
 *   channel strips (dry)
 *       └──► process(mix)  ──►  KillSwitch  ──►  OUT
 *
 *   effect unit (wet return)
 *       └──► processFxReturn(sample)  ──►  NoiseGate  ──►  (summed in render.cpp)
 *
 * Usage pattern:
 *   1. Call setup() once with the audio sample rate.
 *   2. Call setKills() once per render block (before the sample loop).
 *   3. Call processFxReturn() and process() once per audio sample.
 */
class MasterFx {
public:
    /** Initialises all sub-processors. Must be called before processing. */
    void setup(float sampleRate);

    /**
     * Updates kill targets. The gain ramp advances sample by sample in process().
     * Call once per render block before the sample loop.
     */
    void setKills(bool killSub, bool killKick, bool killMid, bool killTop);

    /**
     * Applies the FX-return noise gate to one sample.
     * Suppresses idle hum or noise from an effect unit when no signal is fed.
     */
    float processFxReturn(float sample);

    /**
     * Processes one master-bus sample through the kill crossover.
     * @param input  Sum of all dry channel outputs (+ FX return if pre-kill)
     * @return       Kill-filtered output sample
     */
    float process(float input);

private:
    KillSwitch kills_;
    NoiseGate  fxReturnGate_;
};
