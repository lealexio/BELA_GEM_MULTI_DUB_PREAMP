#include "MasterFx.h"
#include "SoftwareConfig.h"
#include <algorithm> // std::clamp

// ---------------------------------------------------------------------------
// Band parameters
// ---------------------------------------------------------------------------

static constexpr float kSubFreq  =   80.f;
static constexpr float kKickFreq =  127.f;
static constexpr float kKickQ    =    1.05f;
static constexpr float kMidFreq  =  490.f;
static constexpr float kMidQ     =    0.49f;
static constexpr float kTopFreq  = 1200.f;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

void MasterFx::setup(float sampleRate) {
    sampleRate_ = sampleRate;
    for(int i = 0; i < 4; ++i) {
        currentDb_[i] = kPassDb;
        targetDb_[i]  = kPassDb;
        updateFilter(i, kPassDb);
    }
    fxReturnGate_.setup(sampleRate_);
}

// ---------------------------------------------------------------------------
// Filter update helper — routes to the correct formula per band
// ---------------------------------------------------------------------------

void MasterFx::updateFilter(int band, float gainDb) {
    switch(band) {
        case SUB:  filters_[SUB].setLowShelf (kSubFreq,  gainDb,        sampleRate_); break;
        case KICK: filters_[KICK].setPeaking (kKickFreq, gainDb, kKickQ, sampleRate_); break;
        case MID:  filters_[MID].setPeaking  (kMidFreq,  gainDb, kMidQ,  sampleRate_); break;
        case TOP:  filters_[TOP].setHighShelf(kTopFreq,  gainDb,         sampleRate_); break;
    }
}

// ---------------------------------------------------------------------------
// Kill control — updates targets and advances ramps
// ---------------------------------------------------------------------------

void MasterFx::setKills(bool killSub, bool killKick, bool killMid, bool killTop,
                         unsigned int blockSize) {
    targetDb_[SUB]  = killSub  ? kKillDb : kPassDb;
    targetDb_[KICK] = killKick ? kKillDb : kPassDb;
    targetDb_[MID]  = killMid  ? kKillDb : kPassDb;
    targetDb_[TOP]  = killTop  ? kKillDb : kPassDb;

    // Ramp step in dB for this block: kKillRampMs defines total 0→-60 dB time
    const float rampStep = (60.f / (kKillRampMs * 0.001f * sampleRate_)) * blockSize;

    for(int i = 0; i < 4; ++i) {
        if(currentDb_[i] == targetDb_[i]) continue;

        float step = (targetDb_[i] < currentDb_[i]) ? -rampStep : rampStep;
        currentDb_[i] += step;

        // Clamp to target so we don't overshoot
        if(step < 0.f) currentDb_[i] = std::max(currentDb_[i], targetDb_[i]);
        else           currentDb_[i] = std::min(currentDb_[i], targetDb_[i]);

        updateFilter(i, currentDb_[i]);
    }
}

// ---------------------------------------------------------------------------
// FX return gate
// ---------------------------------------------------------------------------

float MasterFx::processFxReturn(float sample) {
    return fxReturnGate_.process(sample);
}

// ---------------------------------------------------------------------------
// Main processing
// ---------------------------------------------------------------------------

float MasterFx::process(float input) {
    // Bypass all filters when every band is at 0 dB — avoids phase coloration
    bool allPass = true;
    for(int i = 0; i < 4; ++i)
        if(currentDb_[i] != kPassDb) { allPass = false; break; }
    if(allPass) return input;

    float s = filters_[SUB].process(input);
    s = filters_[KICK].process(s);
    s = filters_[MID].process(s);
    return filters_[TOP].process(s);
}
