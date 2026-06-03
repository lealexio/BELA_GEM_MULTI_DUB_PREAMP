#include "MasterFx.h"
#include "SoftwareConfig.h"

// ---------------------------------------------------------------------------
// Band centre frequencies and Q values
// Geometric-mean centres of each band; Q = f0 / bandwidth
//
//   SUB  : shelf below 80 Hz
//   KICK : sqrt(80 * 200)  ≈ 127 Hz, BW = 120 Hz → Q ≈ 1.05
//   MID  : sqrt(200 * 1200) ≈ 490 Hz, BW = 1000 Hz → Q ≈ 0.49
//   TOP  : shelf above 1200 Hz
// ---------------------------------------------------------------------------

static constexpr float kSubFreq  =   80.f;
static constexpr float kKickFreq =  127.f;
static constexpr float kKickQ    =    1.05f;
static constexpr float kMidFreq  =  490.f;
static constexpr float kMidQ     =    0.49f;
static constexpr float kTopFreq  = 1200.f;

void MasterFx::setup(float sampleRate) {
    sampleRate_ = sampleRate;
    // All kills OFF → 0 dB on every filter → transparent signal path
    subKill_.setLowShelf (kSubFreq,  kPassDb,        sampleRate_);
    kickKill_.setPeaking (kKickFreq, kPassDb, kKickQ, sampleRate_);
    midKill_.setPeaking  (kMidFreq,  kPassDb, kMidQ,  sampleRate_);
    topKill_.setHighShelf(kTopFreq,  kPassDb,         sampleRate_);
    fxReturnGate_.setup(sampleRate_);
}

void MasterFx::setKills(bool killSub, bool killKick, bool killMid, bool killTop) {
    if(killSub != lastSub_) {
        // Reset filter state on activation to avoid transients from stale history
        if(killSub) subKill_.reset();
        subKill_.setLowShelf(kSubFreq, killSub ? kKillDb : kPassDb, sampleRate_);
        lastSub_ = killSub;
    }
    if(killKick != lastKick_) {
        if(killKick) kickKill_.reset();
        kickKill_.setPeaking(kKickFreq, killKick ? kKillDb : kPassDb, kKickQ, sampleRate_);
        lastKick_ = killKick;
    }
    if(killMid != lastMid_) {
        if(killMid) midKill_.reset();
        midKill_.setPeaking(kMidFreq, killMid ? kKillDb : kPassDb, kMidQ, sampleRate_);
        lastMid_ = killMid;
    }
    if(killTop != lastTop_) {
        if(killTop) topKill_.reset();
        topKill_.setHighShelf(kTopFreq, killTop ? kKillDb : kPassDb, sampleRate_);
        lastTop_ = killTop;
    }
}

float MasterFx::processFxReturn(float sample) {
    return fxReturnGate_.process(sample);
}

float MasterFx::process(float input) {
    // Full bypass when no kill is active: avoids phase coloration from 4 serial
    // biquads that would make noise-gate transitions slightly audible.
    if(!lastSub_ && !lastKick_ && !lastMid_ && !lastTop_)
        return input;

    float s = subKill_.process(input);
    s = kickKill_.process(s);
    s = midKill_.process(s);
    return topKill_.process(s);
}
