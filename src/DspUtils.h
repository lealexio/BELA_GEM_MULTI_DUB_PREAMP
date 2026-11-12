#pragma once
#include <cmath>

/**
 * Shared DSP utility functions used across multiple audio processing classes.
 *
 * Keep this header lightweight — inline math helpers only, no state, no
 * dependencies beyond <cmath>.
 */

// Portable Pi constants (M_PI is POSIX-only, not in the standard C++ library).
static constexpr float kPi    = 3.14159265358979323846f;
static constexpr float kTwoPi = 2.f * kPi;

/**
 * Converts a duration in milliseconds to number of samples at sampleRate.
 *
 * @param ms          Duration in milliseconds
 * @param sampleRate  Audio sample rate (Hz)
 */
static inline float msToSamples(float ms, float sampleRate) {
    if (ms <= 0.f || sampleRate <= 0.f) return 0.f;
    return ms * 0.001f * sampleRate;
}

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
    if (ms <= 0.f || sampleRate <= 0.f) return 1.f;
    return 1.f - expf(-1.f / (ms * 0.001f * sampleRate));
}

/**
 * One-pole decay coefficient for a given time constant (ms) and sample rate.
 *
 * Returns alpha such that y[n] = alpha * y[n-1] decays with a time constant
 * of 'ms' milliseconds. Equivalent to (1.f - onePoleLpCoeff(ms, sampleRate)).
 *
 * @param ms          Decay time constant (ms); must be > 0
 * @param sampleRate  Audio sample rate (Hz); must be > 0
 */
static inline float onePoleDecayCoeff(float ms, float sampleRate) {
    if (ms <= 0.f || sampleRate <= 0.f) return 0.f;
    return expf(-1.f / (ms * 0.001f * sampleRate));
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
    if (fMin <= 0.f || fMax <= 0.f) return fMin;
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
