#include "ChannelStrip.h"

// ---------------------------------------------------------------------------
// ChannelStrip
// ---------------------------------------------------------------------------

void ChannelStrip::setup(float sampleRate) {
    sampleRate_ = sampleRate;
    gate_.setup(sampleRate_);
    // Initialise filters at 0 dB so the strip is transparent on startup
    low_.setLowShelf  (kEqLowFreq,  0.f,       sampleRate_);
    mid_.setPeaking   (kEqMidFreq,  0.f, kEqMidQ, sampleRate_);
    high_.setHighShelf(kEqHighFreq, 0.f,       sampleRate_);
}

void ChannelStrip::setInputGain(float gain) {
    inputGain_ = gain;
}

void ChannelStrip::setFxSendLevel(float level) {
    fxSendLevel_ = level;
}

void ChannelStrip::setEqGains(float gainLowDb, float gainMidDb, float gainHighDb) {
    // Recompute coefficients only when a value has actually changed
    if(gainLowDb != lastLow_) {
        low_.setLowShelf(kEqLowFreq, gainLowDb, sampleRate_);
        lastLow_ = gainLowDb;
    }
    if(gainMidDb != lastMid_) {
        mid_.setPeaking(kEqMidFreq, gainMidDb, kEqMidQ, sampleRate_);
        lastMid_ = gainMidDb;
    }
    if(gainHighDb != lastHigh_) {
        high_.setHighShelf(kEqHighFreq, gainHighDb, sampleRate_);
        lastHigh_ = gainHighDb;
    }
}

float ChannelStrip::process(float input) {
    // 1. Input gain stage
    float gained = input * inputGain_;

    // 2. Noise gate — mutes signal when no input is detected
    float gated = gate_.process(gained);

    // 3. EQ — bypassed entirely when all bands are at 0 dB
    float out = (lastLow_ == 0.f && lastMid_ == 0.f && lastHigh_ == 0.f)
        ? gated
        : high_.process(mid_.process(low_.process(gated)));

    // Store dry output so fxOut() can scale it by fxSendLevel_
    lastOut_ = out;
    return out;
}
