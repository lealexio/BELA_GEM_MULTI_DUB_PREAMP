#pragma once
#include <cmath>
#include "SoftwareConfig.h"

/**
 * Feedforward brickwall peak limiter for master output protection.
 *
 * Signal flow:
 *   input → peak detect → target gain → asymmetric smooth → output × gain → safety clamp
 *
 * Attack is instantaneous (catches transients without delay).
 * Release is one-pole smoothed to avoid pumping when gain recovers.
 *
 * All constants are read from SoftwareConfig.h.
 *
 * Usage pattern:
 *   1. Call setup() once with the audio sample rate.
 *   2. Call process() once per sample on the final mixed master output.
 */
struct BrickwallLimiter {
    /** Initialises the release smoothing coefficient. Must be called before processing. */
    void setup(float sampleRate);

    /** Limits one sample and returns the protected output. */
    float process(float input);

    /** Returns true while gain reduction is active (gain below unity). */
    bool isLimiting() const { return gain_ < 0.999f; }

private:
    float gain_          = 1.f;
    float releaseCoeff_  = 0.f;

    /** Converts a time constant (ms) to a one-pole EMA coefficient. */
    static float msToCoeff(float ms, float sampleRate) {
        return expf(-1.f / (ms * 0.001f * sampleRate));
    }
};
