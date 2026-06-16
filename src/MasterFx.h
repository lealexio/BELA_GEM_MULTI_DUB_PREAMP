#pragma once
#include "KillSwitch.h"
#include "NoiseGate.h"
#include "ParametricEq.h"
#include "FilterSection.h"
#include "GraphicEq.h"

/**
 * Master effects bus.
 *
 * Orchestrates all master processors in signal-flow order:
 *   1. ParametricEq   : 4-band sweepable peaking EQ (SUB / KICK / MID / TOP)
 *   2. GraphicEq      : 12-band fixed-frequency graphic EQ (40 Hz … 16 kHz)
 *   3. FilterSection  : HPF and LPF with resonance (CDJ-style, bypass when pot at 0)
 *   4. KillSwitch     : 4-band crossover kill
 *   5. NoiseGate      : FX return noise suppression (separate path)
 *
 * Signal flow:
 *   channel strips (dry mix)
 *       └──► process(mix)
 *                 │
 *                 ▼
 *           ParametricEq    ← setParamEqBand() once per block
 *                 │
 *                 ▼
 *            GraphicEq      ← setGraphicEqBand() × 12 once per block
 *                 │
 *                 ▼
 *           FilterSection   ← setHpf() + setLpf() once per block
 *                 │
 *                 ▼
 *            KillSwitch     ← setKills() once per block
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
 *   2. Call set*() methods once per render block (before the sample loop).
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
     * Updates one graphic EQ band. Call for each of the 12 bands once per render block.
     * @param band    Band index (0 = 40 Hz … 11 = 16 kHz)
     * @param gainDb  Gain in dB; 0.0 = transparent (centred pot)
     */
    void setGraphicEqBand(int band, float gainDb);

    /**
     * Updates the HPF cutoff and resonance. Call once per render block.
     * @param freqPot  [0.0–1.0]; below kFilterOffThreshold → HPF bypassed
     * @param resPot   [0.0–1.0] → mapped to Q [kFilterQMin, kFilterQMax]
     */
    void setHpf(float freqPot, float resPot);

    /**
     * Updates the LPF cutoff and resonance. Call once per render block.
     * @param freqPot  [0.0–1.0]; below kFilterOffThreshold → LPF bypassed
     * @param resPot   [0.0–1.0] → mapped to Q [kFilterQMin, kFilterQMax]
     */
    void setLpf(float freqPot, float resPot);

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
     * Processes one master-bus sample: ParametricEq → FilterSection → KillSwitch.
     * @param input  Sum of all dry channel outputs (+ FX return if pre-kill)
     */
    float process(float input);

private:
    ParametricEq  paramEq_;
    GraphicEq     graphicEq_;
    FilterSection filters_;
    KillSwitch    kills_;
    NoiseGate     fxReturnGate_;
};
