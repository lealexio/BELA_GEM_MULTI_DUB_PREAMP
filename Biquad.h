#pragma once
#include <cmath>

/**
 * Second-order IIR biquad filter.
 * Coefficients are normalised (divided by a0).
 * State variables use Direct Form I.
 *
 * All Audio EQ Cookbook formulas (R. Bristow-Johnson).
 */
struct BiquadFilter {
    float b0 = 1.f, b1 = 0.f, b2 = 0.f;
    float a1 = 0.f, a2 = 0.f;
    float x1 = 0.f, x2 = 0.f;
    float y1 = 0.f, y2 = 0.f;

    /** Process one sample. */
    float process(float x);

    /** Clear filter memory (call before reactivating a previously bypassed filter). */
    void reset() { x1 = x2 = y1 = y2 = 0.f; }

    /** Low-shelf: boosts/cuts frequencies below freq. */
    void setLowShelf(float freq, float gainDb, float sampleRate);

    /** High-shelf: boosts/cuts frequencies above freq. */
    void setHighShelf(float freq, float gainDb, float sampleRate);

    /** Peaking EQ: boosts/cuts a band centred on freq with given Q. */
    void setPeaking(float freq, float gainDb, float q, float sampleRate);
};
