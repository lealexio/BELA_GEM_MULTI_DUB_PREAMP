#pragma once
#include <cmath>
#include "DspUtils.h"

/**
 * Second-order IIR biquad filter (Direct Form I).
 *
 * Coefficients are normalised (divided by a0).
 * All design formulas follow the Audio EQ Cookbook (R. Bristow-Johnson).
 *
 * Usage pattern:
 *   1. Call one set*() method to load filter coefficients.
 *   2. Call process() once per audio sample inside the render loop.
 *   3. Call reset() before re-enabling a filter that was bypassed,
 *      to clear stale state and avoid a click.
 *
 * Denormal protection: a sub-audible DC offset (+/-1e-25) is injected into
 * the feedback path. This keeps y1/y2 out of the denormal range on ARM
 * processors where the VFP flush-to-zero bit is not set by default.
 * The offset is inaudible (≈ -248 dBFS) and self-cancelling.
 */
struct BiquadFilter {
    float b0 = 1.f, b1 = 0.f, b2 = 0.f; // feedforward coefficients
    float a1 = 0.f, a2 = 0.f;            // feedback  coefficients (a0-normalised)
    float x1 = 0.f, x2 = 0.f;            // input  delay line
    float y1 = 0.f, y2 = 0.f;            // output delay line

    // Alternating DC offset keeps y1/y2 away from the denormal range.
    // Amplitude 1e-25 f is ~248 dBFS below full scale — completely inaudible.
    static constexpr float kDenormalOffset = 1e-25f;

    // Named constant for the Cookbook shelf slope S=1 (sqrt(2)).
    static constexpr float kShelfAlphaFactor = 1.41421356f;

    // Portable Pi constant (from DspUtils.h).
    static constexpr float kPi    = ::kPi;
    static constexpr float kTwoPi = ::kTwoPi;

    /**
     * Process one sample and return the filtered output.
     * Inlined so the compiler can eliminate the call overhead across the
     * 34+ biquad calls per audio sample in the master chain.
     */
    inline float process(float x) {
        // Alternating offset: +1e-25 on one call, -1e-25 on the next.
        // Both y1 and y2 stay above the ARM VFP denormal range.
        x += kDenormalOffset;
        float y = b0*x + b1*x1 + b2*x2 - a1*y1 - a2*y2;
        x2 = x1; x1 = x;
        y2 = y1; y1 = y;
        return y;
    }

    /** Clear filter memory (avoids a click when re-enabling a bypassed filter).
     *  @param sampleRate  Not used; present for forward compatibility.
     */
    void reset() { x1 = x2 = y1 = y2 = 0.f; }

    /**
     * Low-shelf: boosts/cuts all frequencies below freq.
     * @param freq        Shelf transition frequency (Hz)
     * @param gainDb      Shelf gain (dB); 0 = transparent
     * @param sampleRate  Audio sample rate (Hz); must be > 0
     */
    void setLowShelf(float freq, float gainDb, float sampleRate);

    /**
     * High-shelf: boosts/cuts all frequencies above freq.
     * @param freq        Shelf transition frequency (Hz)
     * @param gainDb      Shelf gain (dB); 0 = transparent
     * @param sampleRate  Audio sample rate (Hz); must be > 0
     */
    void setHighShelf(float freq, float gainDb, float sampleRate);

    /**
     * Peaking EQ: boosts/cuts a bell-shaped band centred on freq.
     * @param freq        Centre frequency (Hz)
     * @param gainDb      Peak gain (dB); 0 = transparent
     * @param q           Bandwidth (higher Q = narrower bell)
     * @param sampleRate  Audio sample rate (Hz); must be > 0
     */
    void setPeaking(float freq, float gainDb, float q, float sampleRate);

    /**
     * 2nd-order Butterworth low-pass filter.
     * @param freq        -3 dB cutoff frequency (Hz)
     * @param q           Pole Q; use 0.707 for Butterworth (maximally flat)
     * @param sampleRate  Audio sample rate (Hz); must be > 0
     */
    void setLowPass(float freq, float q, float sampleRate);

    /**
     * 2nd-order Butterworth high-pass filter.
     * @param freq        -3 dB cutoff frequency (Hz)
     * @param q           Pole Q; use 0.707 for Butterworth (maximally flat)
     * @param sampleRate  Audio sample rate (Hz); must be > 0
     */
    void setHighPass(float freq, float q, float sampleRate);
};
