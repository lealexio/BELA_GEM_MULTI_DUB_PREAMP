#include "MasterFx.h"

void MasterFx::setup(float sampleRate) {
    paramEq_.setup(sampleRate);
    graphicEq_.setup(sampleRate);
    filters_.setup(sampleRate);
    bandTrim_.setup(sampleRate);
    kills_.setup(sampleRate);
    fxReturnGate_.setup(sampleRate);
}

void MasterFx::setParamEqBand(ParametricEq::Band band, float freqPot, float gainDb) {
    paramEq_.setBand(band, freqPot, gainDb);
}

void MasterFx::setGraphicEqBand(int band, float gainDb) {
    graphicEq_.setBandGainDb(band, gainDb);
}

void MasterFx::setHpf(float freqPot, float resPot) {
    filters_.setHpf(freqPot, resPot);
}

void MasterFx::setLpf(float freqPot, float resPot) {
    filters_.setLpf(freqPot, resPot);
}

void MasterFx::setBandTrim(BandTrim::Band band, float gainDb) {
    bandTrim_.setBand(band, gainDb);
}

void MasterFx::setKills(bool killSub, bool killKick, bool killMid, bool killTop) {
    kills_.setKills(killSub, killKick, killMid, killTop);
}

void MasterFx::setMasterGain(float gain) {
    masterGain_ = gain;
}

float MasterFx::processFxReturn(float sample) {
    return fxReturnGate_.process(sample);
}

float MasterFx::process(float input) {
    float out = paramEq_.process(input);
    out = graphicEq_.process(out);
    out = filters_.process(out);
    out = bandTrim_.process(out);
    out = kills_.process(out);
    return out * masterGain_;
}
