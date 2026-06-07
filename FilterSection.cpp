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
    sampleRate_ = sampleRate;
    hpfActive_  = false;
    lpfActive_  = false;
    lastHpfFreq_ = lastHpfRes_ = lastLpfFreq_ = lastLpfRes_ = -1.f;
}

void FilterSection::setHpf(float freqPot, float resPot) {
    if(freqPot < kFilterOffThreshold) {
        hpfActive_ = false;
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
}

void FilterSection::setLpf(float freqPot, float resPot) {
    if(freqPot < kFilterOffThreshold) {
        lpfActive_ = false;
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
}

float FilterSection::process(float input) {
    float out = input;
    if(hpfActive_) out = hpf_.process(out);
    if(lpfActive_) out = lpf_.process(out);
    return out;
}
