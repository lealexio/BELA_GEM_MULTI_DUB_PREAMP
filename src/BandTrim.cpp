#include "BandTrim.h"
#include "DspUtils.h"
#include "SoftwareConfig.h"
#include <cmath>

void BandTrim::setup(float sampleRate) {
    sampleRate_      = sampleRate;
    gainSmoothCoeff_ = onePoleLpCoeff(kEqGainSmoothMs, sampleRate_);
    for(int i = 0; i < kNumBands; ++i) {
        targetGainDb_[i] = smoothGainDb_[i] = lastGainDb_[i] = 0.f;
    }
    filters_[SUB ].setLowShelf (kKillFc0,         0.f, sampleRate_);
    filters_[KICK].setPeaking  (kBandTrimKickFreq, 0.f, kBandTrimKickQ, sampleRate_);
    filters_[MID ].setPeaking  (kBandTrimMidFreq,  0.f, kBandTrimMidQ,  sampleRate_);
    filters_[TOP ].setHighShelf(kKillFc2,          0.f, sampleRate_);
    for(int i = 0; i < kNumBands; ++i)
        filters_[i].reset();
}

void BandTrim::setBand(Band band, float gainDb) {
    targetGainDb_[band] = gainDb; // smoother advances in process()
}

float BandTrim::process(float input) {
    // All 4 filters run unconditionally so their internal state stays warm
    // even when a band is near 0 dB — avoids a click on re-engagement.
    // At 0 dB the peaking/shelf coefficients are transparent, so a flat band
    // only costs the biquad multiply-adds with no audible effect.
    float out = input;
    for(int i = 0; i < kNumBands; ++i) {
        smoothGainDb_[i] += gainSmoothCoeff_ * (targetGainDb_[i] - smoothGainDb_[i]);

        if(fabsf(smoothGainDb_[i] - lastGainDb_[i]) > kEqGainEpsilonDb) {
            float g = smoothGainDb_[i];
            switch(i) {
                case SUB:  filters_[SUB ].setLowShelf (kKillFc0,         g, sampleRate_);               break;
                case KICK: filters_[KICK].setPeaking  (kBandTrimKickFreq, g, kBandTrimKickQ, sampleRate_); break;
                case MID:  filters_[MID ].setPeaking  (kBandTrimMidFreq,  g, kBandTrimMidQ,  sampleRate_); break;
                case TOP:  filters_[TOP ].setHighShelf(kKillFc2,          g, sampleRate_);               break;
            }
            lastGainDb_[i] = g;
        }

        out = filters_[i].process(out);
    }
    return out;
}
