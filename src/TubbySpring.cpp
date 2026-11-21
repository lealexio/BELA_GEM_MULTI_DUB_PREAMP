#include "TubbySpring.h"

TubbySpring::TubbySpring() {}

void TubbySpring::setup(float sampleRate) {
    sampleRate_ = sampleRate;

    // Input bandpass: cuts sub rumble (<120 Hz) and harsh highs (>4.5 kHz)
    inHpf_.setHighPass(120.f, kButterworthQ, sampleRate);
    inLpf_.setLowPass(4500.f, kButterworthQ, sampleRate);

    // Master tone damping
    float tone = toneHz_.load(std::memory_order_relaxed);
    outToneLpf_.setLowPass(tone, kButterworthQ, sampleRate);
    lastToneHz_ = tone;

    // Calculate loop damping coefficient: 1-pole lowpass
    float w = kTwoPi * tone / sampleRate;
    loopToneCoeff_ = clamp(w / (w + 1.0f), 0.05f, 0.95f);

    // Splash decay rate: ~350 ms ring
    splashDecayCoeff_ = std::exp(-1.0f / (0.001f * 350.0f * sampleRate));
    splashEnv_ = 0.f;
    splashPhase_ = 0.f;

    // Clear all static delay buffers
    for (int s = 0; s < kNumApStages; ++s) {
        apIndex_[s] = 0;
        for (int i = 0; i < kMaxApLength; ++i) apBuffer_[s][i] = 0.f;
    }
    for (int c = 0; c < kNumCombs; ++c) {
        combIndex_[c] = 0;
        combLp_[c] = 0.f;
        for (int i = 0; i < kMaxCombLength; ++i) combBuffer_[c][i] = 0.f;
    }
}

void TubbySpring::setDwell(float dwell) {
    dwell_.store(clamp(dwell, 0.0f, 1.5f), std::memory_order_relaxed);
}

void TubbySpring::setDecay(float decay) {
    decay_.store(clamp(decay, 0.2f, 0.95f), std::memory_order_relaxed);
}

void TubbySpring::setTone(float hz) {
    toneHz_.store(clamp(hz, 1000.f, 5000.f), std::memory_order_relaxed);
}

void TubbySpring::setReturnGain(float gain) {
    returnGain_.store(clamp(gain, 0.0f, 1.5f), std::memory_order_relaxed);
}

void TubbySpring::setEnabled(bool en) {
    enabled_.store(en, std::memory_order_relaxed);
}

void TubbySpring::triggerSplash() {
    splashTrigger_.store(true, std::memory_order_relaxed);
}

float TubbySpring::getAndResetPeak() {
    float p = peakOut_;
    peakOut_ = 0.f;
    return p;
}

float TubbySpring::process(float inSample) {
    // 1. Check virtual spring splash impact trigger first
    if (splashTrigger_.load(std::memory_order_relaxed)) {
        splashTrigger_.store(false, std::memory_order_relaxed);
        splashEnv_ = 1.0f;
        splashPhase_ = 0.f;
    }

    bool en = enabled_.load(std::memory_order_relaxed);
    if (!en && splashEnv_ <= 0.0001f) {
        return 0.f;
    }

    // 2. Physical spring splash calculation
    float splashSample = 0.f;
    if (splashEnv_ > 0.0001f) {
        splashPhase_ += kTwoPi * 160.0f / sampleRate_;
        if (splashPhase_ >= kTwoPi) splashPhase_ -= kTwoPi;
        float noise = fastRand();
        splashSample = (noise * 0.45f + sinf(splashPhase_) * 0.55f) * splashEnv_ * 1.8f;
        splashEnv_ *= splashDecayCoeff_;
        if (splashEnv_ < 1e-5f) splashEnv_ = 0.f;
    }

    // 3. Input conditioning & non-linear magnetic coil drive (fast rational tanh)
    float filtered = inHpf_.process(inSample);
    filtered = inLpf_.process(filtered);
    float dwell = dwell_.load(std::memory_order_relaxed);
    float driven = fastTanh((filtered * dwell * 2.2f) + splashSample);

    // 4. Dispersive All-Pass Ladder (creates the transient metallic "chirp/boing")
    float xAp = driven;
    constexpr float kApFeedback = 0.58f;
    for (int s = 0; s < kNumApStages; ++s) {
        int rIdx = apIndex_[s] - apDelay_[s];
        if (rIdx < 0) rIdx += kMaxApLength;
        float delayed = apBuffer_[s][rIdx];
        float y = -kApFeedback * xAp + delayed;
        apBuffer_[s][apIndex_[s]] = flushDenormal(xAp + kApFeedback * y);
        if (++apIndex_[s] >= kMaxApLength) apIndex_[s] = 0;
        xAp = y;
    }

    // 5. Parallel Prime Comb Filters (reverberant spring tank resonance)
    float decay = decay_.load(std::memory_order_relaxed);
    float tankSum = 0.f;

    // Check if tone cutoff changed
    float tone = toneHz_.load(std::memory_order_relaxed);
    if (std::abs(tone - lastToneHz_) > 10.f) {
        lastToneHz_ = tone;
        outToneLpf_.setLowPass(tone, kButterworthQ, sampleRate_);
        float w = kTwoPi * tone / sampleRate_;
        loopToneCoeff_ = clamp(w / (w + 1.0f), 0.05f, 0.95f);
    }

    for (int c = 0; c < kNumCombs; ++c) {
        int rIdx = combIndex_[c] - combDelay_[c];
        if (rIdx < 0) rIdx += kMaxCombLength;
        float delayed = combBuffer_[c][rIdx];

        // 1-pole damping in feedback loop with denormal protection
        combLp_[c] += loopToneCoeff_ * (delayed - combLp_[c]);
        combLp_[c] = flushDenormal(combLp_[c]);
        float fb = combLp_[c] * decay;
        combBuffer_[c][combIndex_[c]] = xAp + fb;
        if (++combIndex_[c] >= kMaxCombLength) combIndex_[c] = 0;

        // Alternate polarity for rich diffusion
        tankSum += ((c & 1) ? -1.f : 1.f) * delayed;
    }
    tankSum *= 0.35f;

    // 6. Output filtering, gain scaling, and peak metering
    float out = outToneLpf_.process(tankSum) * returnGain_.load(std::memory_order_relaxed) * kTubbySpringGainScale;
    float absOut = std::abs(out);
    if (absOut > peakOut_) peakOut_ = absOut;

    return out;
}
