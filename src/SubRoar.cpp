#include "SubRoar.h"

SubRoar::SubRoar() = default;

void SubRoar::setup(float sampleRate) {
    sampleRate_ = sampleRate;
    phase_ = 0.f;
    currentPitch_ = tuneHz_.load(std::memory_order_relaxed);
    env_ = 0.f;
    peakOut_ = 0.f;

    // Broadband detector: low-pass at 450 Hz captures all kicks, rimshots, vocals, bass notes
    inBp_.setLowPass(450.f, kButterworthQ, sampleRate_);

    // Attack smoothing ~3 ms (fast musical transient tracking)
    attackCoeff_ = onePoleLpCoeff(3.0f, sampleRate_);

    // Pitch glide ~30 ms time constant
    pitchGlideCoeff_ = onePoleLpCoeff(30.f, sampleRate_);

    // Initialise decay coefficient
    float decay = decayMs_.load(std::memory_order_relaxed);
    decayCoeff_ = onePoleDecayCoeff(decay, sampleRate_);
    lastDecayMs_ = decay;

    // Initialise steep 24 dB/oct Butterworth filter (2 cascaded 2nd-order stages)
    float cutoff = cutoffHz_.load(std::memory_order_relaxed);
    lp1_.setLowPass(cutoff, kButterworthQ, sampleRate_);
    lp2_.setLowPass(cutoff, kButterworthQ, sampleRate_);
    lastCutoff_ = cutoff;
}

void SubRoar::setTune(float hz) {
    if (hz < kSubRoarTuneMinHz) hz = kSubRoarTuneMinHz;
    if (hz > kSubRoarTuneMaxHz) hz = kSubRoarTuneMaxHz;
    tuneHz_.store(hz, std::memory_order_relaxed);
}

void SubRoar::setDrive(float drive) {
    if (drive < 0.f) drive = 0.f;
    if (drive > 1.f) drive = 1.f;
    drive_.store(drive, std::memory_order_relaxed);
}

void SubRoar::setDecay(float ms) {
    if (ms < kSubRoarDecayMinMs) ms = kSubRoarDecayMinMs;
    if (ms > kSubRoarDecayMaxMs) ms = kSubRoarDecayMaxMs;
    decayMs_.store(ms, std::memory_order_relaxed);
}

void SubRoar::setCutoff(float hz) {
    if (hz < kSubRoarCutoffMinHz) hz = kSubRoarCutoffMinHz;
    if (hz > kSubRoarCutoffMaxHz) hz = kSubRoarCutoffMaxHz;
    cutoffHz_.store(hz, std::memory_order_relaxed);
}

void SubRoar::setReturnGain(float gain) {
    if (gain < 0.f) gain = 0.f;
    if (gain > 2.f) gain = 2.f;
    returnGain_.store(gain, std::memory_order_relaxed);
}

void SubRoar::setEnabled(bool en) {
    enabled_.store(en, std::memory_order_relaxed);
}

float SubRoar::getAndResetPeak() {
    float p = peakOut_;
    peakOut_ = 0.f;
    return p;
}

float SubRoar::process(float inSample) {
    if (!enabled_.load(std::memory_order_relaxed)) {
        return 0.f;
    }

    const float targetTune = tuneHz_.load(std::memory_order_relaxed);
    const float decayMs = decayMs_.load(std::memory_order_relaxed);
    const float cutoff = cutoffHz_.load(std::memory_order_relaxed);
    const float drive = drive_.load(std::memory_order_relaxed);
    const float retGain = returnGain_.load(std::memory_order_relaxed);

    // Update decay coefficient if decay parameter changed
    if (fabsf(decayMs - lastDecayMs_) > 1.0f) {
        decayCoeff_ = onePoleDecayCoeff(decayMs, sampleRate_);
        lastDecayMs_ = decayMs;
    }

    // Update low-pass filter if cutoff changed
    if (fabsf(cutoff - lastCutoff_) > 0.5f) {
        lp1_.setLowPass(cutoff, kButterworthQ, sampleRate_);
        lp2_.setLowPass(cutoff, kButterworthQ, sampleRate_);
        lastCutoff_ = cutoff;
    }

    // Update cached drive multipliers when drive parameter changes
    if (fabsf(drive - lastDrive_) > 0.005f) {
        driveMult_ = 1.0f + drive * 3.5f;
        normFactor_ = 1.0f / sqrtf(1.0f + 0.7f * drive);
        lastDrive_ = drive;
    }

    // 1. Broadband Musical Energy Follower
    // inBp_ filters down to 450 Hz, isolating rhythm and musical body
    float filtered = inBp_.process(inSample);
    float inMag = fabsf(filtered);

    // Continuous envelope follower with no binary threshold
    if (inMag > env_) {
        // Fast attack catching transients
        env_ += attackCoeff_ * (inMag - env_);
        // Punchy pitch drop: higher initial pitch that glides smoothly to targetTune
        currentPitch_ = targetTune + 25.f * (env_ > 1.0f ? 1.0f : env_);
    } else {
        // Smooth exponential release governed by Decay parameter
        env_ *= decayCoeff_;
        if (env_ < 1e-6f) env_ = 0.f; // Anti-denormal flush
    }

    // 2. Sub Sine Oscillator (running smoothly at targetTune)
    currentPitch_ += pitchGlideCoeff_ * (targetTune - currentPitch_);
    phase_ += kTwoPi * currentPitch_ / sampleRate_;
    if (phase_ >= kTwoPi) {
        phase_ -= kTwoPi;
    }
    float oscOut = sinf(phase_) * env_;

    // 3. Direct Sub-Harmonic Body Path
    float direct = filtered * 0.5f;

    // 4. Combined signal + Auto-Gain Roar Drive
    float combined = oscOut * 1.3f + direct;
    float preDriven = combined * driveMult_;

    // Saturation with subtle asymmetric 2nd harmonic (fast rational tanh)
    float driven = fastTanh(preDriven);
    driven += 0.10f * (driven * driven);

    // Auto-gain compensation keeps output volume consistent across drive levels
    driven *= normFactor_;

    // 5. Steep 24 dB/oct Low-Pass filtering (< cutoff)
    float subFiltered = lp2_.process(lp1_.process(driven));

    // Master Headroom Scaling (kSubRoarGainScale = 0.55) + Return Gain
    float outSample = subFiltered * (kSubRoarGainScale * retGain);

    // Peak tracking for UI meter (normalized relative to sub headroom)
    float absOut = fabsf(outSample) / kSubRoarGainScale;
    if (absOut > peakOut_) {
        peakOut_ = absOut;
    }

    return outSample;
}
