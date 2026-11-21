#include "EchuDub.h"

EchuDub::EchuDub() = default;

void EchuDub::setup(float sampleRate) {
    sampleRate_ = sampleRate;
    writePos_ = 0;
    peakOut_ = 0.f;
    for (int i = 0; i < kMaxDelaySamples; ++i) {
        buffer_[i] = 0.f;
    }

    float initialMs = timeMs_.load(std::memory_order_relaxed);
    currentDelaySamples_ = msToSamples(initialMs, sampleRate_);
    delaySlewCoeff_ = onePoleLpCoeff(45.f, sampleRate_); // tape glide inertia

    // Flutter LFO (~0.85 Hz)
    lfoPhase_ = 0.f;
    lfoInc_ = kTwoPi * 0.85f / sampleRate_;

    // Tape feedback filters:
    // HPF at 180 Hz cuts rumble build-up in repeated echoes
    loopHpf_.setHighPass(180.f, kButterworthQ, sampleRate_);

    // LPF at toneHz controls tape high-frequency absorption
    float tone = toneHz_.load(std::memory_order_relaxed);
    loopLpf_.setLowPass(tone, kButterworthQ, sampleRate_);
    lastToneHz_ = tone;
}

void EchuDub::setTime(float ms) {
    if (ms < kEchuDubMinDelayMs) ms = kEchuDubMinDelayMs;
    if (ms > kEchuDubMaxDelayMs) ms = kEchuDubMaxDelayMs;
    timeMs_.store(ms, std::memory_order_relaxed);
}

void EchuDub::setFeedback(float fb) {
    if (fb < 0.f) fb = 0.f;
    if (fb > kEchuDubMaxFeedback) fb = kEchuDubMaxFeedback;
    feedback_.store(fb, std::memory_order_relaxed);
}

void EchuDub::setTone(float hz) {
    if (hz < kEchuDubMinToneHz) hz = kEchuDubMinToneHz;
    if (hz > kEchuDubMaxToneHz) hz = kEchuDubMaxToneHz;
    toneHz_.store(hz, std::memory_order_relaxed);
}

void EchuDub::setFlutter(float depth) {
    if (depth < 0.f) depth = 0.f;
    if (depth > 1.f) depth = 1.f;
    flutter_.store(depth, std::memory_order_relaxed);
}

void EchuDub::setKillSend(bool kill) {
    killSend_.store(kill, std::memory_order_relaxed);
}

void EchuDub::setReturnGain(float gain) {
    if (gain < 0.f) gain = 0.f;
    if (gain > 1.5f) gain = 1.5f;
    returnGain_.store(gain, std::memory_order_relaxed);
}

void EchuDub::setEnabled(bool en) {
    enabled_.store(en, std::memory_order_relaxed);
}

void EchuDub::clear() {
    clearPending_.store(true, std::memory_order_release);
}

float EchuDub::getAndResetPeak() {
    float p = peakOut_;
    peakOut_ = 0.f;
    return p;
}

float EchuDub::process(float inSample) {
    if (!enabled_.load(std::memory_order_relaxed)) {
        return 0.f;
    }

    // Flush buffer if clear was requested
    if (clearPending_.exchange(false, std::memory_order_acquire)) {
        for (int i = 0; i < kMaxDelaySamples; ++i) {
            buffer_[i] = 0.f;
        }
        loopHpf_.reset();
        loopLpf_.reset();
        return 0.f;
    }

    const float targetTimeMs = timeMs_.load(std::memory_order_relaxed);
    const float fb = feedback_.load(std::memory_order_relaxed);
    const float tone = toneHz_.load(std::memory_order_relaxed);
    const float flutterDepth = flutter_.load(std::memory_order_relaxed);
    const float retGain = returnGain_.load(std::memory_order_relaxed);
    const bool kill = killSend_.load(std::memory_order_relaxed);

    // Update loop LPF if tone changed
    if (fabsf(tone - lastToneHz_) > 5.f) {
        loopLpf_.setLowPass(tone, kButterworthQ, sampleRate_);
        lastToneHz_ = tone;
    }

    // Input gating via Kill Send
    float actualIn = kill ? 0.f : inSample;

    // Advance flutter LFO
    lfoPhase_ += lfoInc_;
    if (lfoPhase_ >= kTwoPi) {
        lfoPhase_ -= kTwoPi;
    }
    float flutterSamples = sinf(lfoPhase_) * (flutterDepth * 12.f);

    // Smooth delay target (tape speed inertia glide)
    float targetSamples = msToSamples(targetTimeMs, sampleRate_);
    currentDelaySamples_ += delaySlewCoeff_ * (targetSamples - currentDelaySamples_);

    float readPos = (float)writePos_ - currentDelaySamples_ + flutterSamples;
    while (readPos < 0.f) {
        readPos += (float)kMaxDelaySamples;
    }
    while (readPos >= (float)kMaxDelaySamples) {
        readPos -= (float)kMaxDelaySamples;
    }

    int i1 = (int)readPos;
    float frac = readPos - (float)i1;
    int i0 = (i1 - 1 + kMaxDelaySamples) % kMaxDelaySamples;
    int i2 = (i1 + 1) % kMaxDelaySamples;
    int i3 = (i1 + 2) % kMaxDelaySamples;

    // Hermite 4-point interpolation for pitch-gliding delay playback
    float delayedSample = hermite4(frac, buffer_[i0], buffer_[i1], buffer_[i2], buffer_[i3]);

    // Tape feedback path: filter -> saturate -> feedback gain
    float fbSignal = loopHpf_.process(delayedSample);
    fbSignal = loopLpf_.process(fbSignal);

    // Tape saturation: tanh soft-clipping for warm dub self-oscillation
    fbSignal = tanhf(fbSignal);
    fbSignal *= fb;

    // Write sum to delay buffer
    buffer_[writePos_] = actualIn + fbSignal;
    writePos_ = (writePos_ + 1) % kMaxDelaySamples;

    // Output wet signal
    float outSample = delayedSample * retGain;

    // Peak tracking for UI meter
    float absOut = fabsf(outSample);
    if (absOut > peakOut_) {
        peakOut_ = absOut;
    }

    return outSample;
}
