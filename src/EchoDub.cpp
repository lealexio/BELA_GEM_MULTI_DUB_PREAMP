#include "EchoDub.h"

EchoDub::EchoDub() = default;

void EchoDub::setup(float sampleRate) {
    sampleRate_ = sampleRate;
    writePos_ = 0;
    peakOut_ = 0.f;
    for (int i = 0; i < kMaxDelaySamples; ++i) {
        buffer_[i] = 0.f;
        bufferR_[i] = 0.f;
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
    loopHpfR_.setHighPass(180.f, kButterworthQ, sampleRate_);

    // LPF at toneHz controls tape high-frequency absorption
    float tone = toneHz_.load(std::memory_order_relaxed);
    loopLpf_.setLowPass(tone, kButterworthQ, sampleRate_);
    loopLpfR_.setLowPass(tone, kButterworthQ, sampleRate_);
    lastToneHz_ = tone;
}

void EchoDub::setTime(float ms) {
    if (ms < kEchoDubMinDelayMs) ms = kEchoDubMinDelayMs;
    if (ms > kEchoDubMaxDelayMs) ms = kEchoDubMaxDelayMs;
    timeMs_.store(ms, std::memory_order_relaxed);
}

void EchoDub::setFeedback(float fb) {
    if (fb < 0.f) fb = 0.f;
    if (fb > kEchoDubMaxFeedback) fb = kEchoDubMaxFeedback;
    feedback_.store(fb, std::memory_order_relaxed);
}

void EchoDub::setTone(float hz) {
    if (hz < kEchoDubMinToneHz) hz = kEchoDubMinToneHz;
    if (hz > kEchoDubMaxToneHz) hz = kEchoDubMaxToneHz;
    toneHz_.store(hz, std::memory_order_relaxed);
}

void EchoDub::setFlutter(float depth) {
    if (depth < 0.f) depth = 0.f;
    if (depth > 1.f) depth = 1.f;
    flutter_.store(depth, std::memory_order_relaxed);
}

void EchoDub::setKillSend(bool kill) {
    killSend_.store(kill, std::memory_order_relaxed);
}

void EchoDub::setReturnGain(float gain) {
    if (gain < 0.f) gain = 0.f;
    if (gain > 1.5f) gain = 1.5f;
    returnGain_.store(gain, std::memory_order_relaxed);
}

void EchoDub::setEnabled(bool en) {
    enabled_.store(en, std::memory_order_relaxed);
}

void EchoDub::setPingPong(bool pp) {
    pingPong_.store(pp, std::memory_order_relaxed);
}

void EchoDub::clear() {
    clearPending_.store(true, std::memory_order_release);
}

float EchoDub::getAndResetPeak() {
    float p = peakOut_;
    peakOut_ = 0.f;
    return p;
}

float EchoDub::process(float inSample) {
    float outL = 0.f, outR = 0.f;
    processStereo(inSample, outL, outR);
    return 0.5f * (outL + outR);
}

void EchoDub::processStereo(float inSample, float &outL, float &outR) {
    if (clearPending_.exchange(false, std::memory_order_acquire)) {
        clearRemainingSamples_ = kMaxDelaySamples;
        clearFadeGain_ = 0.f;
        writePos_ = 0;
        loopHpf_.reset();
        loopLpf_.reset();
        loopHpfR_.reset();
        loopLpfR_.reset();
    }

    if (clearRemainingSamples_ > 0) {
        int toClear = (clearRemainingSamples_ > 64) ? 64 : clearRemainingSamples_;
        int startIdx = kMaxDelaySamples - clearRemainingSamples_;
        for (int i = 0; i < toClear; ++i) {
            buffer_[startIdx + i] = 0.f;
            bufferR_[startIdx + i] = 0.f;
        }
        clearRemainingSamples_ -= toClear;
    }

    if (clearFadeGain_ < 1.0f) {
        clearFadeGain_ += 0.005f;
        if (clearFadeGain_ > 1.0f) clearFadeGain_ = 1.0f;
    }

    if (!enabled_.load(std::memory_order_relaxed)) {
        outL = 0.f;
        outR = 0.f;
        return;
    }

    const float targetTimeMs = timeMs_.load(std::memory_order_relaxed);
    const float fb = feedback_.load(std::memory_order_relaxed);
    const float tone = toneHz_.load(std::memory_order_relaxed);
    const float flutterDepth = flutter_.load(std::memory_order_relaxed);
    const float retGain = returnGain_.load(std::memory_order_relaxed);
    const bool kill = killSend_.load(std::memory_order_relaxed);
    const bool pp = pingPong_.load(std::memory_order_relaxed);

    // Update loop LPF if tone changed
    if (fabsf(tone - lastToneHz_) > 5.f) {
        loopLpf_.setLowPass(tone, kButterworthQ, sampleRate_);
        loopLpfR_.setLowPass(tone, kButterworthQ, sampleRate_);
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
    int i0 = (i1 > 0) ? (i1 - 1) : (kMaxDelaySamples - 1);
    int i2 = i1 + 1;
    if (i2 >= kMaxDelaySamples) i2 -= kMaxDelaySamples;
    int i3 = i1 + 2;
    if (i3 >= kMaxDelaySamples) i3 -= kMaxDelaySamples;

    // Hermite 4-point interpolation for pitch-gliding delay playback
    float delayedL = hermite4(frac, buffer_[i0], buffer_[i1], buffer_[i2], buffer_[i3]);

    if (pp) {
        float delayedR = hermite4(frac, bufferR_[i0], bufferR_[i1], bufferR_[i2], bufferR_[i3]);

        // Cross-coupled Ping-Pong feedback: L -> R and R -> L
        float fbLtoR = fastTanh(loopLpfR_.process(loopHpfR_.process(delayedL))) * fb;
        float fbRtoL = fastTanh(loopLpf_.process(loopHpf_.process(delayedR))) * fb;

        buffer_[writePos_]  = actualIn + fbRtoL;
        bufferR_[writePos_] = fbLtoR;

        writePos_++;
        if (writePos_ >= kMaxDelaySamples) writePos_ = 0;

        const float scale = retGain * clearFadeGain_;
        outL = delayedL * scale;
        outR = delayedR * scale;
    } else {
        // Classic mono tape delay
        float fbSignal = loopHpf_.process(delayedL);
        fbSignal = loopLpf_.process(fbSignal);
        fbSignal = fastTanh(fbSignal) * fb;

        buffer_[writePos_]  = actualIn + fbSignal;
        bufferR_[writePos_] = 0.f;
        writePos_++;
        if (writePos_ >= kMaxDelaySamples) writePos_ = 0;

        float outSample = delayedL * retGain * clearFadeGain_;
        outL = outSample;
        outR = outSample;
    }

    // Peak tracking for UI meter
    float absOut = fmaxf(fabsf(outL), fabsf(outR));
    if (absOut > peakOut_) {
        peakOut_ = absOut;
    }
}
