#include "ChannelStrip.h"
#include <cmath>

static constexpr float kGainEpsilonDb = 0.05f; // min change to recompute biquad or enable bypass

// ---------------------------------------------------------------------------
// ChannelStrip
// ---------------------------------------------------------------------------

void ChannelStrip::setup(float sampleRate) {
    sampleRate_      = sampleRate;
    gainSmoothCoeff_ = 1.f - expf(-1.f / (kEqGainSmoothMs * 0.001f * sampleRate_));
    gate_.setup(sampleRate_);
    // Initialise filters at 0 dB so the strip is transparent on startup
    low_.setLowShelf  (kEqLowFreq,  0.f,         sampleRate_);
    mid_.setPeaking   (kEqMidFreq,  0.f, kEqMidQ, sampleRate_);
    high_.setHighShelf(kEqHighFreq, 0.f,         sampleRate_);
}

void ChannelStrip::setInputGain(float gain) {
    inputGain_ = gain;
}

void ChannelStrip::setFxSendLevel(float level) {
    fxSendLevel_ = level;
}

void ChannelStrip::setFxSend2Level(float level) {
    fxSendLevel2_ = level;
}

void ChannelStrip::setEqGains(float gainLowDb, float gainMidDb, float gainHighDb) {
    // Store targets only — smoothers advance per sample in process()
    targetLow_  = gainLowDb;
    targetMid_  = gainMidDb;
    targetHigh_ = gainHighDb;
}

float ChannelStrip::process(float input) {
    // Advance per-sample gain smoothers toward their targets
    smoothLow_  += gainSmoothCoeff_ * (targetLow_  - smoothLow_);
    smoothMid_  += gainSmoothCoeff_ * (targetMid_  - smoothMid_);
    smoothHigh_ += gainSmoothCoeff_ * (targetHigh_ - smoothHigh_);

    // Recompute biquad coefficients only when the smoothed gain has moved enough
    if(fabsf(smoothLow_  - lastLow_)  > kGainEpsilonDb)
        { low_.setLowShelf  (kEqLowFreq,  smoothLow_,  sampleRate_);         lastLow_  = smoothLow_;  }
    if(fabsf(smoothMid_  - lastMid_)  > kGainEpsilonDb)
        { mid_.setPeaking   (kEqMidFreq,  smoothMid_,  kEqMidQ, sampleRate_); lastMid_  = smoothMid_;  }
    if(fabsf(smoothHigh_ - lastHigh_) > kGainEpsilonDb)
        { high_.setHighShelf(kEqHighFreq, smoothHigh_, sampleRate_);           lastHigh_ = smoothHigh_; }

    float gained = input * inputGain_;
    float gated  = gate_.process(gained);

    // EQ — bypassed when all smoothed gains are below the audible threshold
    bool allFlat = fabsf(smoothLow_)  < kGainEpsilonDb
                && fabsf(smoothMid_)  < kGainEpsilonDb
                && fabsf(smoothHigh_) < kGainEpsilonDb;
    float out = allFlat ? gated : high_.process(mid_.process(low_.process(gated)));

    lastOut_ = out;
    return out;
}
