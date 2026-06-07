#include "MasterFx.h"

void MasterFx::setup(float sampleRate) {
    paramEq_.setup(sampleRate);
    filters_.setup(sampleRate);
    kills_.setup(sampleRate);
    fxReturnGate_.setup(sampleRate);
}

void MasterFx::setParamEqBand(ParametricEq::Band band, float freqPot, float gainDb) {
    paramEq_.setBand(band, freqPot, gainDb);
}

void MasterFx::setHpf(float freqPot, float resPot) {
    filters_.setHpf(freqPot, resPot);
}

void MasterFx::setLpf(float freqPot, float resPot) {
    filters_.setLpf(freqPot, resPot);
}

void MasterFx::setKills(bool killSub, bool killKick, bool killMid, bool killTop) {
    kills_.setKills(killSub, killKick, killMid, killTop);
}

float MasterFx::processFxReturn(float sample) {
    return fxReturnGate_.process(sample);
}

float MasterFx::process(float input) {
    float out = paramEq_.process(input);
    out = filters_.process(out);
    return kills_.process(out);
}
