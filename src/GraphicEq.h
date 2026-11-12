#pragma once
#include "Biquad.h"
#include "DspUtils.h"
#include "SoftwareConfig.h"

/**
 * 12-band fixed-frequency graphic EQ (peaking biquads).
 *
 * Centre frequencies (Hz): 40, 60, 80, 100, 125, 250, 500, 1000, 2000, 4000, 8000, 16000
 *
 * Each band is an independent peaking biquad (Audio EQ Cookbook).
 * Gain per band is set via setBandGainDb(); coefficients are recomputed only
 * when the gain changes beyond kEqGainEpsilonDb to minimise RT overhead.
 *
 * All 12 filters run unconditionally in process() so their state stays warm —
 * this avoids a click when a band is re-engaged after being at 0 dB.
 *
 * Usage pattern:
 *   1. Call setup() once with the audio sample rate.
 *   2. Call setBandGainDb() for each band once per render block (before the sample loop).
 *   3. Call process() once per audio sample.
 */
class GraphicEq {
public:
    static constexpr int kNumBands = 12;

    /**
     * Initialises all bands at 0 dB (transparent) and clears filter state.
     * @param sampleRate  Audio sample rate (Hz); must be > 0
     */
    void setup(float sampleRate);

    /**
     * Updates one band's gain. Recomputes the peaking biquad only when the gain
     * has changed by more than kEqGainEpsilonDb.
     * @param band    Band index (0 = 40 Hz … 11 = 16 kHz); out-of-range is silently ignored
     * @param gainDb  Gain in dB; 0.0 = transparent
     */
    void setBandGainDb(int band, float gainDb);

    /**
     * Processes one sample through all 12 bands in series.
     * Bands at 0 dB have transparent coefficients and add no audible coloration.
     */
    float process(float input);

private:
    float sampleRate_      = kDefaultSampleRate;
    float gainSmoothCoeff_ = 0.f;

    BiquadFilter filters_[kNumBands];

    float targetGainDb_[kNumBands] = {}; // targets from setBandGainDb()
    float smoothGainDb_[kNumBands] = {}; // per-sample smoothed gains
    float lastGainDb_  [kNumBands] = {}; // gains at last biquad recompute
};
