#include "ShimmerDelay.h"

ShimmerDelay::ShimmerDelay() = default;

void ShimmerDelay::setup(float sampleRate) {
    sampleRate_ = sampleRate;
    for (int i = 0; i < kMaxDelaySamples; ++i) {
        buffer_[i] = 0.f;
    }
    writePos_ = 0;
    grainPhase_ = 0.f;
    peakOut_ = 0.f;

    dampingLpf_.setLowPass(3500.f, 0.707f, sampleRate_);
}

void ShimmerDelay::setSemitones(int semitones) {
    semitones_.store(clamp(semitones, kShimmerSemitonesMin, kShimmerSemitonesMax), std::memory_order_relaxed);
}

void ShimmerDelay::setDelayTime(float ms) {
    delayTimeMs_.store(clamp(ms, kShimmerDelayMinMs, kShimmerDelayMaxMs), std::memory_order_relaxed);
}

void ShimmerDelay::setFeedback(float fb) {
    feedback_.store(clamp(fb, 0.f, 0.95f), std::memory_order_relaxed);
}

void ShimmerDelay::setGrainSize(float ms) {
    grainSizeMs_.store(clamp(ms, 20.f, 100.f), std::memory_order_relaxed);
}

void ShimmerDelay::setReturnGain(float gain) {
    returnGain_.store(clamp(gain, 0.f, 1.5f), std::memory_order_relaxed);
}

void ShimmerDelay::setEnabled(bool en) {
    enabled_.store(en, std::memory_order_relaxed);
}

void ShimmerDelay::clear() {
    clearPending_.store(true, std::memory_order_relaxed);
}

float ShimmerDelay::process(float inSample) {
    if (clearPending_.exchange(false, std::memory_order_relaxed)) {
        clearRemainingSamples_ = kMaxDelaySamples;
        clearFadeGain_ = 0.f;
        writePos_ = 0;
    }

    if (clearRemainingSamples_ > 0) {
        int toClear = (clearRemainingSamples_ > 64) ? 64 : clearRemainingSamples_;
        int startIdx = kMaxDelaySamples - clearRemainingSamples_;
        for (int i = 0; i < toClear; ++i) {
            buffer_[startIdx + i] = 0.f;
        }
        clearRemainingSamples_ -= toClear;
    }

    if (clearFadeGain_ < 1.0f) {
        clearFadeGain_ += 0.005f;
        if (clearFadeGain_ > 1.0f) clearFadeGain_ = 1.0f;
    }

    if (!enabled_.load(std::memory_order_relaxed)) {
        return 0.f;
    }

    int semi     = semitones_.load(std::memory_order_relaxed);
    float dMs    = delayTimeMs_.load(std::memory_order_relaxed);
    float fb     = feedback_.load(std::memory_order_relaxed);
    float gMs    = grainSizeMs_.load(std::memory_order_relaxed);
    float ret    = returnGain_.load(std::memory_order_relaxed);

    float baseDelaySamples = msToSamples(dMs, sampleRate_);
    float grainSamples = msToSamples(gMs, sampleRate_);
    if (grainSamples < 100.f) grainSamples = 100.f;

    // Fast pitch ratio lookup: 2^(semi / 12) from table without powf()
    float speedRatio = pitchRatioFromSemitones(semi);
    float deltaSpeed = speedRatio - 1.0f;

    // Advance grain phase [0 .. 1)
    float phaseInc = (grainSamples > 0.f) ? (deltaSpeed / grainSamples) : 0.f;
    grainPhase_ += phaseInc;
    if (grainPhase_ >= 1.0f) grainPhase_ -= 1.0f;
    if (grainPhase_ < 0.0f)  grainPhase_ += 1.0f;

    // Tap 1 & Tap 2 (180 deg offset)
    float phase1 = grainPhase_;
    float phase2 = grainPhase_ + 0.5f;
    if (phase2 >= 1.0f) phase2 -= 1.0f;

    // Raised cosine window weights: w2 == 1.0 - w1 due to cos(x + pi) == -cos(x)
    float w1 = 0.5f * (1.0f - cosf(kTwoPi * phase1));
    float w2 = 1.0f - w1;

    // Calculate delay read positions
    float offset1 = phase1 * grainSamples;
    float offset2 = phase2 * grainSamples;

    auto readInterpolated = [this](float delay) -> float {
        float rPos = (float)writePos_ - delay;
        while (rPos < 0.f) rPos += (float)kMaxDelaySamples;
        while (rPos >= (float)kMaxDelaySamples) rPos -= (float)kMaxDelaySamples;

        int i0 = (int)rPos;
        int i1 = i0 + 1;
        if (i1 >= kMaxDelaySamples) i1 = 0;
        float frac = rPos - (float)i0;
        return buffer_[i0] + frac * (buffer_[i1] - buffer_[i0]);
    };

    float tap1 = readInterpolated(baseDelaySamples + offset1);
    float tap2 = readInterpolated(baseDelaySamples + offset2);

    float pitchShifted = w1 * tap1 + w2 * tap2;

    // Damping LPF in feedback loop + soft saturation
    float dampedFb = dampingLpf_.process(pitchShifted);
    float fbSample = fastTanh(dampedFb * fb);

    // Write back into circular buffer
    buffer_[writePos_] = inSample + fbSample;
    writePos_++;
    if (writePos_ >= kMaxDelaySamples) writePos_ = 0;

    float out = pitchShifted * kShimmerGainScale * ret * clearFadeGain_;

    float mag = std::fabs(out);
    if (mag > peakOut_) {
        peakOut_ = mag;
    }

    return out;
}

float ShimmerDelay::getAndResetPeak() {
    float p = peakOut_;
    peakOut_ = 0.f;
    return p;
}
