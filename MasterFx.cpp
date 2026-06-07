#include "MasterFx.h"

void MasterFx::setup(float sampleRate) {
    paramEq_.setup(sampleRate);
    kills_.setup(sampleRate);
    fxReturnGate_.setup(sampleRate);
}

void MasterFx::setParamEqBand(ParametricEq::Band band, float freqPot, float gainDb) {
    paramEq_.setBand(band, freqPot, gainDb);
}

void MasterFx::setKills(bool killSub, bool killKick, bool killMid, bool killTop) {
    kills_.setKills(killSub, killKick, killMid, killTop);
}

float MasterFx::processFxReturn(float sample) {
    return fxReturnGate_.process(sample);
}

float MasterFx::process(float input) {
    float equalized = paramEq_.process(input);
    return kills_.process(equalized);
}
