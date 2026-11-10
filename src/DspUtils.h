#pragma once
#include <cmath>

/**
 * Shared DSP utility functions used across multiple audio processing classes.
 *
 * Keep this header lightweight — inline math helpers only, no state, no
 * dependencies beyond <cmath>.
 */

/**
 * One-pole low-pass coefficient for a given time constant (ms) and sample rate.
 *
 * Returns a coefficient c such that the EMA recurrence
 *   smooth += c * (target - smooth)
 * converges to 'target' with a time constant of 'ms' milliseconds.
 *
 * @param ms          Smoothing time (ms); must be > 0
 * @param sampleRate  Audio sample rate (Hz); must be > 0
 */
static inline float onePoleLpCoeff(float ms, float sampleRate) {
    return 1.f - expf(-1.f / (ms * 0.001f * sampleRate));
}

/**
 * Logarithmic interpolation between fMin and fMax.
 *
 * Maps a normalised pot value t ∈ [0, 1] to a frequency on a log scale:
 *   t = 0 → fMin,  t = 1 → fMax.
 *
 * Matches the mapping used in ParametricEq::setBand() and
 * FilterSection::setHpf()/setLpf().
 *
 * @param fMin  Lower frequency bound (Hz)
 * @param fMax  Upper frequency bound (Hz)
 * @param t     Normalised pot position [0, 1]
 */
static inline float logInterp(float fMin, float fMax, float t) {
    return fMin * powf(fMax / fMin, t);
}

/**
 * Linear interpolation between vMin and vMax.
 *
 * @param vMin  Value at t = 0
 * @param vMax  Value at t = 1
 * @param t     Normalised position [0, 1]
 */
static inline float linInterp(float vMin, float vMax, float t) {
    return vMin + t * (vMax - vMin);
}
