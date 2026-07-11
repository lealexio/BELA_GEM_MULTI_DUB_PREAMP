#include "BrickwallLimiter.h"
#include <cmath>

void BrickwallLimiter::setup(float sampleRate) {
    releaseCoeff_ = msToCoeff(kLimiterReleaseMs, sampleRate);
}

float BrickwallLimiter::process(float input) {
    if(!kLimiterEnabled)
        return input;

    const float absIn = fabsf(input);
    float targetGain  = 1.f;
    if(absIn > kLimiterCeiling)
        targetGain = kLimiterCeiling / absIn;

    // Instant attack, smoothed release (inverse of NoiseGate gain ramp logic)
    if(targetGain < gain_)
        gain_ = targetGain;
    else
        gain_ = targetGain + releaseCoeff_ * (gain_ - targetGain);

    float out = input * gain_;

    // Safety clamp — catches numerical edge cases
    return fminf(fmaxf(out, -kLimiterCeiling), kLimiterCeiling);
}
