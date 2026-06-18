#include "BandTrim.h"
#include "SoftwareConfig.h"
#include <cmath>

void BandTrim::setup(float sampleRate) {
    sampleRate_ = sampleRate;
    for(int i = 0; i < kNumBands; ++i) {
        lastGainDb_[i] = 0.f;
    }
    // Initialise all filters at 0 dB (transparent coefficients)
    filters_[SUB ].setLowShelf (kKillFc0,           0.f, sampleRate_);
    filters_[KICK].setPeaking  (kBandTrimKickFreq,   0.f, kBandTrimKickQ, sampleRate_);
    filters_[MID ].setPeaking  (kBandTrimMidFreq,    0.f, kBandTrimMidQ,  sampleRate_);
    filters_[TOP ].setHighShelf(kKillFc2,            0.f, sampleRate_);
}

void BandTrim::setBand(Band band, float gainDb) {
    if(fabsf(gainDb - lastGainDb_[band]) < kBandTrimEpsilonDb) return;
    lastGainDb_[band] = gainDb;
    switch(band) {
        case SUB:  filters_[SUB ].setLowShelf (kKillFc0,         gainDb, sampleRate_);         break;
        case KICK: filters_[KICK].setPeaking  (kBandTrimKickFreq, gainDb, kBandTrimKickQ, sampleRate_); break;
        case MID:  filters_[MID ].setPeaking  (kBandTrimMidFreq,  gainDb, kBandTrimMidQ,  sampleRate_); break;
        case TOP:  filters_[TOP ].setHighShelf(kKillFc2,          gainDb, sampleRate_);         break;
    }
}

float BandTrim::process(float input) {
    // Full bypass when all gains are at 0 dB
    bool allFlat = true;
    for(int i = 0; i < kNumBands; ++i)
        if(fabsf(lastGainDb_[i]) >= kBandTrimEpsilonDb) { allFlat = false; break; }
    if(allFlat) return input;

    float out = input;
    for(int i = 0; i < kNumBands; ++i)
        if(fabsf(lastGainDb_[i]) >= kBandTrimEpsilonDb)
            out = filters_[i].process(out);
    return out;
}
