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
 * Fast rational Padé approximation of hyperbolic tangent (tanh).
 * Monotonic, smooth, zero branching, accurate to <0.1% for |x| <= 3.
 */
static inline float fastTanh(float x) {
    if (x <= -3.f) return -1.f;
    if (x >= 3.f) return 1.f;
    float x2 = x * x;
    return x * (27.f + x2) / (27.f + 9.f * x2);
}

/**
 * Clamps a value v between minVal and maxVal (C++11 compatible).
 */
template <typename T>
static inline T clamp(T v, T minVal, T maxVal) {
    if (v < minVal) return minVal;
    if (v > maxVal) return maxVal;
    return v;
}

/**
 * Flush denormal / subnormal numbers to zero to prevent VFP performance traps on ARM.
 */
static inline float flushDenormal(float v) {
    return (std::fabs(v) < 1e-15f) ? 0.f : v;
}

/**
 * Fast lookup for pitch ratio 2^(semi / 12) for semitones in range [-12, +12].
 * Avoids calling powf() inside the real-time audio thread.
 */
static inline float pitchRatioFromSemitones(int semi) {
    static const float kPitchRatios[25] = {
        0.50000000f, 0.52973155f, 0.56123102f, 0.59460356f, 0.62996052f, 0.66741993f,
        0.70710678f, 0.74915354f, 0.79370053f, 0.84089642f, 0.89089872f, 0.94387431f,
        1.00000000f, // semi = 0 (index 12)
        1.05946309f, 1.12246205f, 1.18920712f, 1.25992105f, 1.33483985f, 1.41421356f,
        1.49830708f, 1.58740105f, 1.68179283f, 1.78179744f, 1.88774863f, 2.00000000f
    };
    int idx = clamp(semi + 12, 0, 24);
    return kPitchRatios[idx];
}

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
