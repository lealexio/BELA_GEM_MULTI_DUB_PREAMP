#include "DubDucker.h"

DubDucker::DubDucker() = default;

void DubDucker::setup(float sampleRate) {
    sampleRate_ = sampleRate;
    env_ = 0.f;
    currentGain_ = 1.0f;
    lastReleaseMs_ = -1.f;

    // Fast attack (~1.5 ms)
    attackCoeff_ = onePoleLpCoeff(1.5f, sampleRate_);
    releaseCoeff_ = onePoleLpCoeff(kDubDuckerReleaseDefaultMs, sampleRate_);
}

void DubDucker::setThreshold(float th) {
    threshold_.store(clamp(th, 0.005f, 0.5f), std::memory_order_relaxed);
}

void DubDucker::setReleaseMs(float ms) {
    releaseMs_.store(clamp(ms, kDubDuckerReleaseMinMs, kDubDuckerReleaseMaxMs), std::memory_order_relaxed);
}

void DubDucker::setDuckAmount(float amount) {
    duckAmount_.store(clamp(amount, 0.f, 1.f), std::memory_order_relaxed);
}

void DubDucker::setSource(int src) {
    source_.store(clamp(src, 0, 3), std::memory_order_relaxed);
}

void DubDucker::setEnabled(bool en) {
    enabled_.store(en, std::memory_order_relaxed);
}

void DubDucker::updateKey(float sirenSample, float micSample, float masterSample) {
    if (!enabled_.load(std::memory_order_relaxed)) {
        currentGain_ = 1.0f;
        return;
    }

    int src = source_.load(std::memory_order_relaxed);
    float key = 0.f;

    if (src == 0) {
        // Siren & Sampler
        key = std::fabs(sirenSample);
    } else if (src == 1) {
        // Mic Inputs
        key = std::fabs(micSample);
    } else if (src == 2) {
        // Master
        key = std::fabs(masterSample);
    } else {
        // All sources: take maximum of key inputs
        float kS = std::fabs(sirenSample);
        float kM = std::fabs(micSample);
        float kMaster = std::fabs(masterSample);
        key = std::fmax(kS, std::fmax(kM, kMaster));
    }

    // Update release coefficient if releaseMs changed
    float relMs = releaseMs_.load(std::memory_order_relaxed);
    if (std::fabs(relMs - lastReleaseMs_) > 5.f) {
        releaseCoeff_ = onePoleLpCoeff(relMs, sampleRate_);
        lastReleaseMs_ = relMs;
    }

    // Fast peak attack, smooth exponential release
    float coeff = (key > env_) ? attackCoeff_ : releaseCoeff_;
    env_ += coeff * (key - env_);
    if (env_ < 1e-6f) env_ = 0.f; // Anti-denormal flush

    // Compute ducking gain reduction
    float th = threshold_.load(std::memory_order_relaxed);
    float amt = duckAmount_.load(std::memory_order_relaxed);

    if (std::fabs(th - lastThreshold_) > 0.002f) {
        float range = 1.0f - th;
        if (range < 0.01f) range = 0.01f;
        invRange_ = 1.0f / range;
        lastThreshold_ = th;
    }

    if (env_ > th) {
        float excess = env_ - th;
        float ratio = excess * invRange_;
        if (ratio > 1.0f) ratio = 1.0f;

        float reduction = ratio * amt;
        currentGain_ = 1.0f - reduction;
    } else {
        currentGain_ = 1.0f;
    }
}
