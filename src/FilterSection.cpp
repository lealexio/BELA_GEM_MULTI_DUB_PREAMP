#include "FilterSection.h"
#include <cmath>

static constexpr float kEpsilonFreq = 0.005f; // ~0.5% pot travel — avoids recomputing on noise
static constexpr float kEpsilonRes  = 0.005f;

float FilterSection::logInterp(float fMin, float fMax, float t) {
    return fMin * powf(fMax / fMin, t);
}

float FilterSection::linInterp(float qMin, float qMax, float t) {
    return qMin + t * (qMax - qMin);
}

void FilterSection::setup(float sampleRate) {
    sampleRate_      = sampleRate;
    hpfActive_       = false;
    lpfActive_       = false;
    hpfMix_ = hpfTarget_ = 0.f;
    lpfMix_ = lpfTarget_ = 0.f;
    lastHpfFreq_ = lastHpfRes_ = lastLpfFreq_ = lastLpfRes_ = -1.f;
    bypassRampCoeff_ = 1.f - expf(-1.f / (kFilterBypassRampMs * 0.001f * sampleRate));
}

void FilterSection::setHpf(float freqPot, float resPot) {
    if(freqPot < kFilterOffThreshold) {
        hpfTarget_ = 0.f;
        return;
    }

    bool freqChanged = fabsf(freqPot - lastHpfFreq_) > kEpsilonFreq;
    bool resChanged  = fabsf(resPot  - lastHpfRes_)  > kEpsilonRes;

    if(!hpfActive_ || freqChanged || resChanged) {
        float fc = logInterp(kHpfFMin, kHpfFMax, freqPot);
        float q  = linInterp(kFilterQMin, kFilterQMax, resPot);
        hpf_.setHighPass(fc, q, sampleRate_);
        lastHpfFreq_ = freqPot;
        lastHpfRes_  = resPot;
        hpfActive_   = true;
    }
    hpfTarget_ = 1.f;
}

void FilterSection::setLpf(float freqPot, float resPot) {
    if(freqPot < kFilterOffThreshold) {
        lpfTarget_ = 0.f;
        return;
    }

    bool freqChanged = fabsf(freqPot - lastLpfFreq_) > kEpsilonFreq;
    bool resChanged  = fabsf(resPot  - lastLpfRes_)  > kEpsilonRes;

    if(!lpfActive_ || freqChanged || resChanged) {
        // Inverted mapping: pot near 0 = filter wide open (fMax), pot at 1 = maximum cut (fMin)
        float fc = logInterp(kLpfFMax, kLpfFMin, freqPot);
        float q  = linInterp(kFilterQMin, kFilterQMax, resPot);
        lpf_.setLowPass(fc, q, sampleRate_);
        lastLpfFreq_ = freqPot;
        lastLpfRes_  = resPot;
        lpfActive_   = true;
    }
    lpfTarget_ = 1.f;
}

float FilterSection::process(float input) {
    // Advance mix smoothers one step toward their targets.
    hpfMix_ += bypassRampCoeff_ * (hpfTarget_ - hpfMix_);
    lpfMix_ += bypassRampCoeff_ * (lpfTarget_ - lpfMix_);

    // Both biquads run unconditionally so their internal state (z1/z2) stays
    // warm at all times — no stale-state click on re-activation.
    float afterHpf = hpf_.process(input);
    float mid      = input + hpfMix_ * (afterHpf - input);   // dry↔wet HPF crossfade

    float afterLpf = lpf_.process(mid);
    return mid + lpfMix_ * (afterLpf - mid);                  // dry↔wet LPF crossfade
}
