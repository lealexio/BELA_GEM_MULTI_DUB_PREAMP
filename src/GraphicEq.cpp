#include "GraphicEq.h"
#include "SoftwareConfig.h"
#include <cmath>

/** Fixed centre frequencies — index matches band order 0 = 40 Hz, 11 = 16 kHz. */
static constexpr float kBandFreqs[GraphicEq::kNumBands] = {
    40.f, 60.f, 80.f, 100.f, 125.f, 250.f,
    500.f, 1000.f, 2000.f, 4000.f, 8000.f, 16000.f
};

float GraphicEq::bandFreq(int band) {
    return kBandFreqs[band];
}

void GraphicEq::setup(float sampleRate) {
    sampleRate_ = sampleRate;
    for(int i = 0; i < kNumBands; ++i) {
        lastGainDb_[i] = 0.f;
        filters_[i].setPeaking(kBandFreqs[i], 0.f, kGEqQ, sampleRate_);
    }
}

void GraphicEq::setBandGainDb(int band, float gainDb) {
    if(band < 0 || band >= kNumBands) return;
    if(fabsf(gainDb - lastGainDb_[band]) < kGEqUpdateEpsilonDb) return;
    lastGainDb_[band] = gainDb;
    filters_[band].setPeaking(kBandFreqs[band], gainDb, kGEqQ, sampleRate_);
}

float GraphicEq::process(float input) {
    float out = input;
    for(int i = 0; i < kNumBands; ++i) {
        if(fabsf(lastGainDb_[i]) > kGEqUpdateEpsilonDb)
            out = filters_[i].process(out);
    }
    return out;
}
