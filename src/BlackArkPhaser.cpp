#include "BlackArkPhaser.h"

BlackArkPhaser::BlackArkPhaser() {}

void BlackArkPhaser::setup(float sampleRate) {
    sampleRate_ = sampleRate;
    lfoPhase_ = 0.f;
    lastStageOut_ = 0.f;
    peakOut_ = 0.f;
    currentA_ = 0.5f;
    targetA_ = 0.5f;
    subSampleCount_ = 0;

    for (int s = 0; s < kMaxStages; ++s) {
        x1_[s] = 0.f;
        y1_[s] = 0.f;
    }
}

void BlackArkPhaser::setRate(float hz) {
    rate_.store(clamp(hz, kBlackArkRateMinHz, kBlackArkRateMaxHz), std::memory_order_relaxed);
}

void BlackArkPhaser::setDepth(float depth) {
    depth_.store(clamp(depth, 0.0f, 1.0f), std::memory_order_relaxed);
}

void BlackArkPhaser::setFeedback(float fb) {
    feedback_.store(clamp(fb, -0.92f, 0.92f), std::memory_order_relaxed);
}

void BlackArkPhaser::setStages(int stages) {
    stages_.store((stages >= 10) ? 12 : 6, std::memory_order_relaxed);
}

void BlackArkPhaser::setReturnGain(float gain) {
    returnGain_.store(clamp(gain, 0.0f, 1.5f), std::memory_order_relaxed);
}

void BlackArkPhaser::setEnabled(bool en) {
    enabled_.store(en, std::memory_order_relaxed);
}

float BlackArkPhaser::getAndResetPeak() {
    float p = peakOut_;
    peakOut_ = 0.f;
    return p;
}

float BlackArkPhaser::process(float inSample) {
    if (!enabled_.load(std::memory_order_relaxed)) {
        return 0.f;
    }

    // 1. Advance slow quadrature LFO
    float rate = rate_.load(std::memory_order_relaxed);
    lfoPhase_ += kTwoPi * rate / sampleRate_;
    if (lfoPhase_ >= kTwoPi) lfoPhase_ -= kTwoPi;

    // 2. Sub-sampled all-pass coefficient calculation (every 8 samples)
    // Slices CPU load of heavy powf() and float division by ~88% without audible difference
    if (++subSampleCount_ >= 8) {
        subSampleCount_ = 0;
        float lfo = sinf(lfoPhase_);
        float depth = depth_.load(std::memory_order_relaxed);
        float mod = 0.5f * (1.0f + lfo * depth);
        float sweepFreq = 250.0f * powf(16.8f, mod);
        float w0 = kPi * sweepFreq / sampleRate_;
        targetA_ = clamp((1.0f - w0) / (1.0f + w0), 0.05f, 0.95f);
    }
    // Continuous one-pole smoothing of coefficient
    currentA_ += 0.125f * (targetA_ - currentA_);
    float a = currentA_;

    // 3. Saturating feedback path (Lee Perry tape/console warmth via fast rational tanh)
    float fb = feedback_.load(std::memory_order_relaxed);
    float inWithFb = fastTanh(inSample + fb * lastStageOut_);

    // 4. Cascade all-pass filter stages (6 or 12 poles)
    int numStages = (stages_.load(std::memory_order_relaxed) >= 10) ? 12 : 6;
    float stageInput = inWithFb;
    for (int s = 0; s < numStages; ++s) {
        float y = a * stageInput + x1_[s] - a * y1_[s];
        x1_[s] = flushDenormal(stageInput);
        y1_[s] = flushDenormal(y);
        stageInput = y;
    }
    lastStageOut_ = stageInput;

    // 5. Notch combination (50% dry + 50% all-passed) & scaling
    float phased = 0.5f * (inSample + stageInput);
    float out = phased * returnGain_.load(std::memory_order_relaxed) * kBlackArkGainScale;

    float absOut = std::fabs(out);
    if (absOut > peakOut_) peakOut_ = absOut;

    return out;
}
