#include "MasterFx.h"

void MasterFx::setup(float sampleRate) {
    kills_.setup(sampleRate);
    fxReturnGate_.setup(sampleRate);
}

void MasterFx::setKills(bool killSub, bool killKick, bool killMid, bool killTop) {
    kills_.setKills(killSub, killKick, killMid, killTop);
}

float MasterFx::processFxReturn(float sample) {
    return fxReturnGate_.process(sample);
}

float MasterFx::process(float input) {
    return kills_.process(input);
}
