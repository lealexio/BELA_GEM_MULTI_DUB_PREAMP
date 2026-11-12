#include "FilterSection.h"
#include "DspUtils.h"
#include <cmath>

void FilterSection::setup(float sampleRate) {
    sampleRate_      = sampleRate;
    hpfMix_ = hpfTarget_ = 0.f;
    lpfMix_ = lpfTarget_ = 0.f;
    lastHpfFreq_ = 0.f;
    lastHpfRes_  = 0.f;
    lastLpfFreq_ = 0.f;
    lastLpfRes_  = 0.f;
    bypassRampCoeff_ = onePoleLpCoeff(kFilterBypassRampMs, sampleRate_);

    // Pre-warm biquads at their neutral baseline filter frequencies:
    // HPF at minimum cutoff (kHpfFMin = 20 Hz, flat Q = kFilterQMin)
    // LPF at maximum cutoff (kLpfFMax = 20000 Hz, flat Q = kFilterQMin)
    // Both biquads run unconditionally from boot so their internal delay
    // lines (z1, z2) stay warm at all times, eliminating coefficient-jump
    // transients and pops on first activation (ADR 6).
    hpf_.setHighPass(kHpfFMin, kFilterQMin, sampleRate_);
    lpf_.setLowPass(kLpfFMax, kFilterQMin, sampleRate_);
    hpf_.reset();
    lpf_.reset();
    hpfInitialised_  = true;
    lpfInitialised_  = true;
}

void FilterSection::setHpf(float freqPot, float resPot) {
    if(freqPot < kFilterOffThreshold) {
        hpfTarget_ = 0.f;
        return;
    }

    bool freqChanged = fabsf(freqPot - lastHpfFreq_) > kPotEpsilon;
    bool resChanged  = fabsf(resPot  - lastHpfRes_)  > kPotEpsilon;

    if(!hpfInitialised_ || freqChanged || resChanged) {
        float fc = logInterp(kHpfFMin, kHpfFMax, freqPot);
        float q  = linInterp(kFilterQMin, kFilterQMax, resPot);
        hpf_.setHighPass(fc, q, sampleRate_);
        lastHpfFreq_ = freqPot;
        lastHpfRes_  = resPot;
        hpfInitialised_ = true;
    }
    hpfTarget_ = 1.f;
}

void FilterSection::setLpf(float freqPot, float resPot) {
    if(freqPot < kFilterOffThreshold) {
        lpfTarget_ = 0.f;
        return;
    }

    bool freqChanged = fabsf(freqPot - lastLpfFreq_) > kPotEpsilon;
    bool resChanged  = fabsf(resPot  - lastLpfRes_)  > kPotEpsilon;

    if(!lpfInitialised_ || freqChanged || resChanged) {
        // Inverted mapping: pot near 0 = filter wide open (fMax), pot at 1 = maximum cut (fMin)
        float fc = logInterp(kLpfFMax, kLpfFMin, freqPot);
        float q  = linInterp(kFilterQMin, kFilterQMax, resPot);
        lpf_.setLowPass(fc, q, sampleRate_);
        lastLpfFreq_ = freqPot;
        lastLpfRes_  = resPot;
        lpfInitialised_ = true;
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
