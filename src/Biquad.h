#pragma once
#include <cmath>

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
 */
struct BiquadFilter {
    float b0 = 1.f, b1 = 0.f, b2 = 0.f; // feedforward coefficients
    float a1 = 0.f, a2 = 0.f;            // feedback  coefficients (a0-normalised)
    float x1 = 0.f, x2 = 0.f;            // input  delay line
    float y1 = 0.f, y2 = 0.f;            // output delay line

    /** Process one sample and return the filtered output. */
    float process(float x);

    /** Clear filter memory (avoids a click when re-enabling a bypassed filter). */
    void reset() { x1 = x2 = y1 = y2 = 0.f; }

    /**
     * Low-shelf: boosts/cuts all frequencies below freq.
     * @param freq      Shelf transition frequency (Hz)
     * @param gainDb    Shelf gain (dB); 0 = transparent
     * @param sampleRate  Audio sample rate (Hz)
     */
    void setLowShelf(float freq, float gainDb, float sampleRate);

    /**
     * High-shelf: boosts/cuts all frequencies above freq.
     * @param freq      Shelf transition frequency (Hz)
     * @param gainDb    Shelf gain (dB); 0 = transparent
     * @param sampleRate  Audio sample rate (Hz)
     */
    void setHighShelf(float freq, float gainDb, float sampleRate);

    /**
     * Peaking EQ: boosts/cuts a bell-shaped band centred on freq.
     * @param freq      Centre frequency (Hz)
     * @param gainDb    Peak gain (dB); 0 = transparent
     * @param q         Bandwidth (higher Q = narrower bell)
     * @param sampleRate  Audio sample rate (Hz)
     */
    void setPeaking(float freq, float gainDb, float q, float sampleRate);

    /**
     * 2nd-order Butterworth low-pass filter.
     * @param freq      -3 dB cutoff frequency (Hz)
     * @param q         Pole Q; use 0.707 for Butterworth (maximally flat)
     * @param sampleRate  Audio sample rate (Hz)
     */
    void setLowPass(float freq, float q, float sampleRate);

    /**
     * 2nd-order Butterworth high-pass filter.
     * @param freq      -3 dB cutoff frequency (Hz)
     * @param q         Pole Q; use 0.707 for Butterworth (maximally flat)
     * @param sampleRate  Audio sample rate (Hz)
     */
    void setHighPass(float freq, float q, float sampleRate);
};
