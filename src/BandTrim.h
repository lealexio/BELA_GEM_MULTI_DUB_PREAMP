#pragma once
#include "Biquad.h"

/**
 * 4-band gain trim matching the speaker crossover topology (SUB/KICK/MID/TOP).
 *
 * Each band uses a biquad shelving or peaking filter at its centre/boundary
 * frequency. All bands share a ±kBandTrimGainDb range; pot 0.5 → 0 dB (transparent).
 *
 * Filter types:
 *   SUB   : low-shelf  at kKillFc0        (80 Hz)
 *   KICK  : peaking    at kBandTrimKickFreq (~126 Hz), Q = kBandTrimKickQ
 *   MID   : peaking    at kBandTrimMidFreq  (~490 Hz), Q = kBandTrimMidQ
 *   TOP   : high-shelf at kKillFc2        (1200 Hz)
 *
 * The entire processor is bypassed (no filter in signal path) when all gains
 * are within kBandTrimEpsilonDb of 0 dB.
 *
 * Usage pattern:
 *   1. Call setup() once with the audio sample rate.
 *   2. Call setBand() for each band once per render block.
 *   3. Call process() once per audio sample.
 */
class BandTrim {
public:
    enum Band { SUB = 0, KICK = 1, MID = 2, TOP = 3 };
    static constexpr int kNumBands = 4;

    /** Initialises all filters at 0 dB (transparent). */
    void setup(float sampleRate);

    /**
     * Updates one band's gain. Coefficients are recomputed only when the gain
     * has changed by more than kBandTrimEpsilonDb.
     * @param band    Target band (SUB / KICK / MID / TOP)
     * @param gainDb  Gain in dB; 0.0 = transparent
     */
    void setBand(Band band, float gainDb);

    /**
     * Processes one sample through all active bands.
     * Returns input unchanged when all gains are 0 dB (full bypass).
     */
    float process(float input);

private:
    float sampleRate_ = 44100.f;

    BiquadFilter filters_[kNumBands];
    float        lastGainDb_[kNumBands] = {};
};
