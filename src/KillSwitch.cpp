#include "KillSwitch.h"
#include <algorithm>

void KillSwitch::setup(float sampleRate) {
    sampleRate_ = sampleRate;
    rampStep_   = 1.f / (kKillRampMs * 0.001f * sampleRate_);

    for(int s = 0; s < kKillFilterStages; ++s) {
        lp_[FC0][s].setLowPass (kKillFc0, kKillCrossoverQ, sampleRate_);
        lp_[FC1][s].setLowPass (kKillFc1, kKillCrossoverQ, sampleRate_);
        lp_[FC2][s].setLowPass (kKillFc2, kKillCrossoverQ, sampleRate_);
        hp_[FC0][s].setHighPass(kKillFc0, kKillCrossoverQ, sampleRate_);
        hp_[FC1][s].setHighPass(kKillFc1, kKillCrossoverQ, sampleRate_);
        hp_[FC2][s].setHighPass(kKillFc2, kKillCrossoverQ, sampleRate_);
    }

    for(int i = 0; i < 4; ++i) {
        bandGain_[i]   = 1.f;
        targetGain_[i] = 1.f;
    }
    crossoverMix_       = 0.f;
    targetCrossoverMix_ = 0.f;
}

void KillSwitch::setKills(bool killSub, bool killKick, bool killMid, bool killTop) {
    targetGain_[SUB]  = killSub  ? 0.f : 1.f;
    targetGain_[KICK] = killKick ? 0.f : 1.f;
    targetGain_[MID]  = killMid  ? 0.f : 1.f;
    targetGain_[TOP]  = killTop  ? 0.f : 1.f;

    // Engage the crossover path as soon as any kill is targeted,
    // and release it only when every band is back to full pass.
    targetCrossoverMix_ = (killSub || killKick || killMid || killTop) ? 1.f : 0.f;
}

float KillSwitch::process(float input) {
    // --- Advance all ramps by one sample step ---

    // Crossover mix: 0 = clean bypass, 1 = crossover sum path
    if(crossoverMix_ < targetCrossoverMix_)
        crossoverMix_ = std::min(targetCrossoverMix_, crossoverMix_ + rampStep_);
    else if(crossoverMix_ > targetCrossoverMix_)
        crossoverMix_ = std::max(targetCrossoverMix_, crossoverMix_ - rampStep_);

    // Per-band kill gains
    for(int i = 0; i < 4; ++i) {
        if(bandGain_[i] < targetGain_[i])
            bandGain_[i] = std::min(targetGain_[i], bandGain_[i] + rampStep_);
        else if(bandGain_[i] > targetGain_[i])
            bandGain_[i] = std::max(targetGain_[i], bandGain_[i] - rampStep_);
    }

    // --- Always extract bands to keep filter state warm ---
    float sub = input;
    for(int s = 0; s < kKillFilterStages; ++s) sub = lp_[FC0][s].process(sub);

    float kick = input;
    for(int s = 0; s < kKillFilterStages; ++s) kick = hp_[FC0][s].process(kick);
    for(int s = 0; s < kKillFilterStages; ++s) kick = lp_[FC1][s].process(kick);

    float mid = input;
    for(int s = 0; s < kKillFilterStages; ++s) mid = hp_[FC1][s].process(mid);
    for(int s = 0; s < kKillFilterStages; ++s) mid = lp_[FC2][s].process(mid);

    float top = input;
    for(int s = 0; s < kKillFilterStages; ++s) top = hp_[FC2][s].process(top);

    // --- Blend bypass and crossover sum ---
    // crossoverMix_ = 0 → output = input  (no crossover coloration)
    // crossoverMix_ = 1 → output = band sum with per-kill gains applied
    float crossSum = sub  * bandGain_[SUB]
                   + kick * bandGain_[KICK]
                   + mid  * bandGain_[MID]
                   + top  * bandGain_[TOP];

    return input + crossoverMix_ * (crossSum - input);
}
