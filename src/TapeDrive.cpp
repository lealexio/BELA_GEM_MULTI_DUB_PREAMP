#include "TapeDrive.h"

TapeDrive::TapeDrive() = default;

void TapeDrive::setup(float sampleRate) {
    sampleRate_ = sampleRate;
    lastIn_ = 0.f;
    dcOut_ = 0.f;
    lastWarmthHz_ = -1.f;
    peakOut_ = 0.f;

    warmthLpf_.setLowPass(kTapeWarmthDefaultHz, 0.707f, sampleRate_);
}

void TapeDrive::setDrive(float drive) {
    drive_.store(clamp(drive, 0.f, 1.f), std::memory_order_relaxed);
}

void TapeDrive::setWarmth(float hz) {
    warmthHz_.store(clamp(hz, kTapeWarmthMinHz, kTapeWarmthMaxHz), std::memory_order_relaxed);
}

void TapeDrive::setAsymmetry(float asym) {
    asymmetry_.store(clamp(asym, 0.f, 1.f), std::memory_order_relaxed);
}

void TapeDrive::setReturnGain(float gain) {
    returnGain_.store(clamp(gain, 0.f, 1.5f), std::memory_order_relaxed);
}

void TapeDrive::setEnabled(bool en) {
    enabled_.store(en, std::memory_order_relaxed);
}

float TapeDrive::process(float inSample) {
    if (!enabled_.load(std::memory_order_relaxed)) {
        return 0.f;
    }

    float wHz = warmthHz_.load(std::memory_order_relaxed);
    if (std::fabs(wHz - lastWarmthHz_) > 20.f) {
        warmthLpf_.setLowPass(wHz, 0.707f, sampleRate_);
        lastWarmthHz_ = wHz;
    }

    float drv = drive_.load(std::memory_order_relaxed);
    float asym = asymmetry_.load(std::memory_order_relaxed);
    float ret = returnGain_.load(std::memory_order_relaxed);

    // Drive gain [1.0 .. 6.0]
    float gain = 1.0f + drv * 5.0f;
    float x = inSample * gain;

    // Asymmetric bias adds 2nd order harmonic (even harmonics)
    float xBiased = x + asym * 0.25f * (x * x);

    // Fast Padé tanh saturation
    float ySat = fastTanh(xBiased);

    // DC Blocker (fc ~ 8 Hz): removes DC offset from even harmonic generation
    float yDc = ySat - lastIn_ + 0.999f * dcOut_;
    lastIn_ = ySat;
    dcOut_ = flushDenormal(yDc);

    // Tape warmth low-pass filter
    float yFilt = warmthLpf_.process(dcOut_);

    // Output level scaling
    float out = yFilt * kTapeGainScale * ret;

    float mag = std::fabs(out);
    if (mag > peakOut_) {
        peakOut_ = mag;
    }

    return out;
}

float TapeDrive::getAndResetPeak() {
    float p = peakOut_;
    peakOut_ = 0.f;
    return p;
}
