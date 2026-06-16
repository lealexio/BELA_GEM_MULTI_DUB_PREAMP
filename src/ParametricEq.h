#pragma once
#include "Biquad.h"
#include "SoftwareConfig.h"

/**
 * 4-band master parametric EQ — peaking filters with sweepable frequency.
 *
 * Bands match the kill-switch crossover topology:
 *   SUB   20 – 80 Hz      (kMasterEqSubFMin  … kMasterEqSubFMax)
 *   KICK  80 – 200 Hz     (kMasterEqKickFMin … kMasterEqKickFMax)
 *   MID   200 – 1200 Hz   (kMasterEqMidFMin  … kMasterEqMidFMax)
 *   TOP   1200 – 16000 Hz (kMasterEqTopFMin  … kMasterEqTopFMax)
 *
 * Each band is a peaking biquad (Audio EQ Cookbook, Q = kMasterEqQ).
 * The FREQ pot is mapped logarithmically across the band's range so that
 * each octave occupies the same physical pot travel.
 *
 * The EQ is fully bypassed (no filter in signal path) when all gains are 0 dB,
 * to avoid any phase coloration during normal playback.
 *
 * Usage pattern:
 *   1. Call setup() once with the audio sample rate.
 *   2. Call setBand() for each band once per render block (before the sample loop).
 *   3. Call process() once per audio sample.
 */
class ParametricEq {
public:
    enum Band { SUB = 0, KICK = 1, MID = 2, TOP = 3 };
    static constexpr int kNumBands = 4;

    /** Initialises all filters at 0 dB (transparent). */
    void setup(float sampleRate);

    /**
     * Updates one band's peaking filter. Coefficients are recomputed only when
     * frequency or gain has changed beyond a small epsilon.
     *
     * @param band     Target band (SUB / KICK / MID / TOP)
     * @param freqPot  Raw pot value [0.0–1.0] → mapped logarithmically to band range
     * @param gainDb   Gain in dB; 0.0 = transparent (pot at centre)
     */
    void setBand(Band band, float freqPot, float gainDb);

    /**
     * Process one sample through all active bands.
     * Returns input unchanged when all gains are 0 dB (full bypass).
     */
    float process(float input);

private:
    float sampleRate_ = 44100.f;

    BiquadFilter filters_[kNumBands];

    float lastFreqPot_[kNumBands] = {-1.f, -1.f, -1.f, -1.f}; // -1 forces first-run update
    float lastGainDb_[kNumBands]  = {0.f,  0.f,  0.f,  0.f};

    /**
     * Logarithmic interpolation: maps t ∈ [0,1] to [fMin, fMax] on a log scale.
     * Ensures equal perceptual travel per octave across the pot range.
     */
    static float logInterp(float fMin, float fMax, float t);
};
