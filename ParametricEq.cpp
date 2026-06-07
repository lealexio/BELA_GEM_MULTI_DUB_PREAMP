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
    sampleRate_ = sampleRate;
    // Initialise all bands at centre frequency, 0 dB gain (transparent)
    for(int i = 0; i < kNumBands; ++i) {
        float fc = logInterp(kFMin[i], kFMax[i], 0.5f);
        filters_[i].setPeaking(fc, 0.f, kMasterEqQ, sampleRate_);
        lastFreqPot_[i] = 0.5f;
        lastGainDb_[i]  = 0.f;
    }
}

void ParametricEq::setBand(Band band, float freqPot, float gainDb) {
    bool freqChanged = fabsf(freqPot - lastFreqPot_[band]) > kFreqPotEpsilon;
    bool gainChanged = fabsf(gainDb  - lastGainDb_[band])  > kGainDbEpsilon;

    if(freqChanged || gainChanged) {
        float fc = logInterp(kFMin[band], kFMax[band], freqPot);
        filters_[band].setPeaking(fc, gainDb, kMasterEqQ, sampleRate_);
        lastFreqPot_[band] = freqPot;
        lastGainDb_[band]  = gainDb;
    }
}

float ParametricEq::process(float input) {
    // Bypass entirely when all bands are at 0 dB — no phase coloration
    bool allFlat = true;
    for(int i = 0; i < kNumBands; ++i) {
        if(fabsf(lastGainDb_[i]) > kGainDbEpsilon) { allFlat = false; break; }
    }
    if(allFlat) return input;

    float out = input;
    for(int i = 0; i < kNumBands; ++i)
        out = filters_[i].process(out);
    return out;
}
