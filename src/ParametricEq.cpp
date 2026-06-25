#include "ParametricEq.h"
#include <cmath>

// Frequency boundaries for each band — order matches Band enum (SUB, KICK, MID, TOP)
static constexpr float kFMin[ParametricEq::kNumBands] = {
    kMasterEqSubFMin, kMasterEqKickFMin, kMasterEqMidFMin, kMasterEqTopFMin
};
static constexpr float kFMax[ParametricEq::kNumBands] = {
    kMasterEqSubFMax, kMasterEqKickFMax, kMasterEqMidFMax, kMasterEqTopFMax
};

// Minimum change thresholds — avoids recomputing biquad coefficients on noise
static constexpr float kFreqPotEpsilon = 0.005f; // ~0.5% pot travel
static constexpr float kGainDbEpsilon  = 0.05f;  // 0.05 dB

float ParametricEq::logInterp(float fMin, float fMax, float t) {
    return fMin * powf(fMax / fMin, t);
}

void ParametricEq::setup(float sampleRate) {
    sampleRate_      = sampleRate;
    gainSmoothCoeff_ = 1.f - expf(-1.f / (kEqGainSmoothMs * 0.001f * sampleRate_));
    for(int i = 0; i < kNumBands; ++i) {
        float fc = logInterp(kFMin[i], kFMax[i], 0.5f);
        filters_[i].setPeaking(fc, 0.f, kMasterEqQ, sampleRate_);
        lastFreqPot_[i]  = 0.5f;
        targetGainDb_[i] = smoothGainDb_[i] = lastGainDb_[i] = 0.f;
    }
}

void ParametricEq::setBand(Band band, float freqPot, float gainDb) {
    targetGainDb_[band] = gainDb; // smoother advances in process()

    // Frequency changes are handled immediately at block rate; use current
    // smoothed gain so the recompute doesn't introduce a gain discontinuity.
    if(fabsf(freqPot - lastFreqPot_[band]) > kFreqPotEpsilon) {
        float fc = logInterp(kFMin[band], kFMax[band], freqPot);
        filters_[band].setPeaking(fc, smoothGainDb_[band], kMasterEqQ, sampleRate_);
        lastFreqPot_[band] = freqPot;
        lastGainDb_[band]  = smoothGainDb_[band]; // sync last-computed gain
    }
}

float ParametricEq::process(float input) {
    bool allFlat = true;
    for(int i = 0; i < kNumBands; ++i) {
        smoothGainDb_[i] += gainSmoothCoeff_ * (targetGainDb_[i] - smoothGainDb_[i]);

        if(fabsf(smoothGainDb_[i] - lastGainDb_[i]) > kGainDbEpsilon) {
            float fc = logInterp(kFMin[i], kFMax[i], lastFreqPot_[i]);
            filters_[i].setPeaking(fc, smoothGainDb_[i], kMasterEqQ, sampleRate_);
            lastGainDb_[i] = smoothGainDb_[i];
        }

        if(fabsf(smoothGainDb_[i]) > kGainDbEpsilon) allFlat = false;
    }
    if(allFlat) return input;

    float out = input;
    for(int i = 0; i < kNumBands; ++i)
        out = filters_[i].process(out);
    return out;
}
