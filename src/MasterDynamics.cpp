#include "MasterDynamics.h"
#include <cmath>

void MasterDynamics::setup(float sampleRate) {
    sampleRate_ = sampleRate > 0.f ? sampleRate : kDefaultSampleRate;
    amountCoeff_  = onePoleLpCoeff(kMasterBusSmoothMs, sampleRate_);
    attackCoeff_  = onePoleLpCoeff(kMasterDynamicsAttackMs, sampleRate_);
    releaseCoeff_ = onePoleLpCoeff(kMasterDynamicsReleaseMs, sampleRate_);

    const float fcs[3] = { kKillFc0, kKillFc1, kKillFc2 };
    for (int i = 0; i < 3; ++i) {
        lp_[i].setLowPass(fcs[i], kButterworthQ, sampleRate_);
        hp_[i].setHighPass(fcs[i], kButterworthQ, sampleRate_);
    }
    for (int b = 0; b < 4; ++b) env_[b] = 0.f;
    smoothAmount_ = targetAmount_;
    wasBypassed_  = (smoothAmount_ < 0.001f);
}

void MasterDynamics::setAmount(float amount) {
    targetAmount_ = clamp(amount, 0.f, 1.f);
}

float MasterDynamics::process(float input) {
    smoothAmount_ += amountCoeff_ * (targetAmount_ - smoothAmount_);
    if (smoothAmount_ < 0.001f && targetAmount_ < 0.001f) {
        smoothAmount_ = 0.f;
        wasBypassed_ = true;
        return input;
    }

    if (wasBypassed_) {
        for (int i = 0; i < 3; ++i) {
            lp_[i].reset();
            hp_[i].reset();
        }
        for (int b = 0; b < 4; ++b) env_[b] = 0.f;
        wasBypassed_ = false;
    }

    // Parallel crossover extraction matching KillSwitch boundaries
    float bSub  = lp_[0].process(input);
    float bKick = lp_[1].process(hp_[0].process(input));
    float bMid  = lp_[2].process(hp_[1].process(input));
    float bTop  = hp_[2].process(input);

    float bands[4] = { bSub, bKick, bMid, bTop };
    const float thresholds[4] = {
        kMasterDynamicsThreshold * 1.15f,
        kMasterDynamicsThreshold,
        kMasterDynamicsThreshold * 0.9f,
        kMasterDynamicsThreshold * 0.8f
    };
    const float invRatioMinusOne = 1.f - (1.f / kMasterDynamicsRatio);

    float wet = 0.f;
    for (int b = 0; b < 4; ++b) {
        float mag = fabsf(bands[b]);
        float coeff = (mag > env_[b]) ? attackCoeff_ : releaseCoeff_;
        env_[b] += coeff * (mag - env_[b]);
        env_[b] = flushDenormal(env_[b]);

        float gain = 1.f;
        float th = thresholds[b];
        if (env_[b] > th && env_[b] > 1e-6f) {
            float overDbRatio = th / env_[b];
            gain = powf(overDbRatio, invRatioMinusOne);
        }
        // Subtle sound-system makeup (+1.5 dB max at full punch)
        float makeup = 1.f + 0.22f * smoothAmount_;
        wet += bands[b] * gain * makeup;
    }

    return input + smoothAmount_ * (wet - input);
}
