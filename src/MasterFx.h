#pragma once
#include "KillSwitch.h"
#include "NoiseGate.h"
#include "BrickwallLimiter.h"
#include "ParametricEq.h"
#include "FilterSection.h"
#include "GraphicEq.h"
#include "BandTrim.h"

/**
 * Master effects bus.
 *
 * Orchestrates all master processors in signal-flow order:
 *   1. ParametricEq   : 4-band sweepable peaking EQ (SUB / KICK / MID / TOP)
 *   2. GraphicEq      : 12-band fixed-frequency graphic EQ (40 Hz … 16 kHz)
 *   3. FilterSection  : HPF and LPF with resonance (CDJ-style, bypass when pot at 0)
 *   4. BandTrim       : 4-band ±3 dB gain trim at speaker crossover frequencies
 *   5. KillSwitch     : 4-band crossover kill
 *   6. NoiseGate      : FX return noise suppression (separate path)
 *   7. BrickwallLimiter : output peak protection (called from render.cpp on final mix)
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
 *            BandTrim       ← setBandTrim() × 4 once per block
 *                 │
 *                 ▼
 *            KillSwitch     ← setKills() once per block
 *                 │
 *                 ▼
 *           × masterGain
 *                 │
 *         (FX returns added HERE in render.cpp — post-master, bypasses all DSP)
 *                 │
 *                 ▼
 *         BrickwallLimiter  ← limitOutput() in render.cpp on final sum
 *                 │
 *                 ▼
 *               OUT
 *
 *   effect unit (wet return)
 *       └──► processFxReturn() → NoiseGate → summed post-master in render.cpp
 *            getMasterGain() is used in render.cpp to scale FX returns by master gain
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
     * Updates one band-trim gain. Call for each of the 4 bands once per render block.
     * @param band    Target band (BandTrim::SUB / KICK / MID / TOP)
     * @param gainDb  Gain in dB; 0.0 = transparent (pot at centre)
     */
    void setBandTrim(BandTrim::Band band, float gainDb);

    /**
     * Updates kill targets. The gain ramp advances sample by sample in process().
     * Call once per render block before the sample loop.
     */
    void setKills(bool killSub, bool killKick, bool killMid, bool killTop);

    /**
     * Sets the master output gain applied after the full dry processing chain.
     * FX returns are also scaled by this gain in render.cpp (post-master injection).
     * @param gain  [0.0–1.0]; 0.0 = total silence
     */
    void setMasterGain(float gain);

    /** Returns the current master output gain (used in render.cpp to scale post-master FX returns). */
    float getMasterGain() const { return masterGain_; }

    /**
     * Applies the FX return 1 noise gate to one sample.
     * Suppresses idle hum from the effect unit when no signal is fed.
     */
    float processFxReturn(float sample);

    /**
     * Applies the FX return 2 noise gate to one sample.
     * Suppresses idle hum from the effect unit when no signal is fed.
     */
    float processFxReturn2(float sample);

    /**
     * Applies the brickwall output limiter to one sample.
     * Call on the final mixed master output in render.cpp (after FX return injection).
     */
    float limitOutput(float sample);

    /**
     * Processes one master-bus dry sample through the full chain:
     *   ParametricEq → GraphicEq → FilterSection → BandTrim → KillSwitch → masterGain.
     * FX returns must be added AFTER this call in render.cpp (post-master injection).
     * @param input  Sum of all dry channel outputs (channels + siren, no FX return)
     */
    float process(float input);

private:
    ParametricEq  paramEq_;
    GraphicEq     graphicEq_;
    FilterSection filters_;
    BandTrim      bandTrim_;
    KillSwitch    kills_;
    NoiseGate         fxReturnGate_;
    NoiseGate         fxReturnGate2_;
    BrickwallLimiter  outputLimiter_;

    float masterGain_ = 1.f;
};
