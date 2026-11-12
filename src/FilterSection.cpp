#include "FilterSection.h"
#include "DspUtils.h"
#include <cmath>

void FilterSection::setup(float sampleRate) {
    sampleRate_      = sampleRate;
    hpfMix_ = hpfTarget_ = 0.f;
    lpfMix_ = lpfTarget_ = 0.f;
    lastHpfFreq_ = -1.f;
    lastHpfRes_  = -1.f;
    lastLpfFreq_ = -1.f;
    lastLpfRes_  = -1.f;
    bypassRampCoeff_ = onePoleLpCoeff(kFilterBypassRampMs, sampleRate_);

    // Baseline filter coefficients:
    // HPF at minimum cutoff (kHpfFMin = 20 Hz, flat Q = kFilterQMin)
    // LPF at maximum cutoff (kLpfFMax = 20000 Hz, flat Q = kFilterQMin)
    hpf_.setHighPass(kHpfFMin, kFilterQMin, sampleRate_);
    lpf_.setLowPass(kLpfFMax, kFilterQMin, sampleRate_);
    hpf_.reset();
    lpf_.reset();
    hpfInitialised_  = false;
    lpfInitialised_  = false;
}

void FilterSection::setHpf(float freqPot, float resPot) {
    if(freqPot < kFilterOffThreshold) {
        hpfTarget_ = 0.f;
        // Keep the idle background filter pre-warmed at baseline 20 Hz
        // tracking the actual physical resonance pot so that engaging the filter
        // causes NO sudden jump in Q or filter coefficients.
        bool resChanged = fabsf(resPot - lastHpfRes_) > kPotEpsilon;
        if(!hpfInitialised_ || resChanged || lastHpfFreq_ != 0.f) {
            float q = linInterp(kFilterQMin, kFilterQMax, resPot);
            hpf_.setHighPass(kHpfFMin, q, sampleRate_);
            lastHpfRes_     = resPot;
            lastHpfFreq_    = 0.f;
            hpfInitialised_ = true;
        }
        return;
    }

    bool freqChanged = fabsf(freqPot - lastHpfFreq_) > kPotEpsilon;
    bool resChanged  = fabsf(resPot  - lastHpfRes_)  > kPotEpsilon;

    if(!hpfInitialised_ || freqChanged || resChanged) {
        float fc = logInterp(kHpfFMin, kHpfFMax, freqPot);
        float q  = linInterp(kFilterQMin, kFilterQMax, resPot);
        hpf_.setHighPass(fc, q, sampleRate_);
        lastHpfFreq_    = freqPot;
        lastHpfRes_     = resPot;
        hpfInitialised_ = true;
    }
    hpfTarget_ = 1.f;
}

void FilterSection::setLpf(float freqPot, float resPot) {
    if(freqPot < kFilterOffThreshold) {
        lpfTarget_ = 0.f;
        // Keep the idle background filter pre-warmed at baseline 20 kHz
        // tracking the actual physical resonance pot so that engaging the filter
        // causes NO sudden jump in Q or filter coefficients.
        bool resChanged = fabsf(resPot - lastLpfRes_) > kPotEpsilon;
        if(!lpfInitialised_ || resChanged || lastLpfFreq_ != 0.f) {
            float q = linInterp(kFilterQMin, kFilterQMax, resPot);
            lpf_.setLowPass(kLpfFMax, q, sampleRate_);
            lastLpfRes_     = resPot;
            lastLpfFreq_    = 0.f;
            lpfInitialised_ = true;
        }
        return;
    }

    bool freqChanged = fabsf(freqPot - lastLpfFreq_) > kPotEpsilon;
    bool resChanged  = fabsf(resPot  - lastLpfRes_)  > kPotEpsilon;

    if(!lpfInitialised_ || freqChanged || resChanged) {
        // Inverted mapping: pot near 0 = filter wide open (fMax), pot at 1 = maximum cut (fMin)
        float fc = logInterp(kLpfFMax, kLpfFMin, freqPot);
        float q  = linInterp(kFilterQMin, kFilterQMax, resPot);
        lpf_.setLowPass(fc, q, sampleRate_);
        lastLpfFreq_    = freqPot;
        lastLpfRes_     = resPot;
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
