#include "MasterFx.h"

void MasterFx::setup(float sampleRate) {
    paramEq_.setup(sampleRate);
    graphicEq_.setup(sampleRate);
    graphicEqMic_.setup(sampleRate);
    filters_.setup(sampleRate);
    bandTrim_.setup(sampleRate);
    bandTrimMic_.setup(sampleRate);
    kills_.setup(sampleRate);
    dynamics_.setup(sampleRate);
    fxReturnGate_.setup(sampleRate);
    fxReturnGate2_.setup(sampleRate);
    outputLimiter_.setup(sampleRate);
    warmthSmoothCoeff_ = onePoleLpCoeff(kMasterWarmthSmoothMs, sampleRate);
    warmthSmooth_ = warmthTarget_;
}

void MasterFx::setParamEqBand(ParametricEq::Band band, float freqPot, float gainDb) {
    paramEq_.setBand(band, freqPot, gainDb);
}

void MasterFx::setGraphicEqBand(int band, float gainDb) {
    graphicEq_.setBandGainDb(band, gainDb);
    graphicEqMic_.setBandGainDb(band, gainDb);
}

void MasterFx::setHpf(float freqPot, float resPot) {
    filters_.setHpf(freqPot, resPot);
}

void MasterFx::setLpf(float freqPot, float resPot) {
    filters_.setLpf(freqPot, resPot);
}

void MasterFx::setBandTrim(BandTrim::Band band, float gainDb) {
    bandTrim_.setBand(band, gainDb);
    bandTrimMic_.setBand(band, gainDb);
}

void MasterFx::setKills(bool killSub, bool killKick, bool killMid, bool killTop) {
    kills_.setKills(killSub, killKick, killMid, killTop);
}

void MasterFx::setMasterGain(float gain) {
    masterGain_ = gain;
}

void MasterFx::setDynamics(float amount) {
    dynamics_.setAmount(amount);
}

void MasterFx::setWarmth(float drive) {
    warmthTarget_ = clamp(drive, 0.f, 1.f);
}

float MasterFx::applyWarmth(float sample) {
    warmthSmooth_ += warmthSmoothCoeff_ * (warmthTarget_ - warmthSmooth_);
    if (warmthSmooth_ < 0.001f) return sample;
    float preGain = 1.f + warmthSmooth_ * (kMasterWarmthMaxGain - 1.f);
    float norm = fastTanh(preGain);
    return (norm > 1e-4f) ? (fastTanh(sample * preGain) / norm) : sample;
}

float MasterFx::processFxReturn(float sample) {
    return fxReturnGate_.process(sample);
}

float MasterFx::processFxReturn2(float sample) {
    return fxReturnGate2_.process(sample);
}

float MasterFx::limitOutput(float sample) {
    return outputLimiter_.process(sample);
}

float MasterFx::process(float input) {
    float out = paramEq_.process(input);
    out = graphicEq_.process(out);
    out = filters_.process(out);
    out = bandTrim_.process(out);
    out = kills_.process(out);
    out = dynamics_.process(out);
    return out * masterGain_;
}

float MasterFx::processMicPath(float input) {
    float out = graphicEqMic_.process(input);
    out = bandTrimMic_.process(out);
    return out * masterGain_;
}
