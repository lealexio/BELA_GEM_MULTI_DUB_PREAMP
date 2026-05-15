#include "HardwareManager.h"
#include <cmath>

HardwareManager::HardwareManager()
    : currentChannel(0)
{
    for(int i = 0; i < kNumMux * kPotsPerMux; i++) potValues[i] = 0.0f;
}

HardwareManager::~HardwareManager() {}

bool HardwareManager::setup(BelaContext *context) {
    for(int i = 0; i < 4; i++)
        pinMode(context, 0, addressPins[i], OUTPUT);

    // Prime the MUX address for channel 0 before the first render
    setMuxAddress(context, 0, currentChannel);
    return true;
}

void HardwareManager::scanStep(BelaContext *context) {
    // Read all active MUX inputs for the channel set in the previous render
    for(int m = 0; m < kActiveMux; m++) {
        float rawValue = analogRead(context, 0, m) * kScaleRecovery;

        // Clamp to [0.0, 1.0] with min/max calibration
        if(rawValue <= kPotMin) rawValue = 0.0f;
        if(rawValue >  1.0f)   rawValue = 1.0f;
        rawValue = rawValue / kPotMax;
        if(rawValue > 1.0f)    rawValue = 1.0f;

        int index = m * kPotsPerMux + currentChannel;
        // Only update if the change exceeds the jitter threshold
        if(fabsf(rawValue - potValues[index]) >= kJitterThreshold)
            potValues[index] = rawValue;
    }

    // Advance to the next channel and set address pins on the last frame
    currentChannel = (currentChannel + 1) % kPotsPerMux;
    setMuxAddress(context, context->digitalFrames - 1, currentChannel);
}

float HardwareManager::getPotValue(int muxId, int potId) const {
    if(muxId < 0 || muxId >= kNumMux || potId < 0 || potId >= kPotsPerMux)
        return 0.0f;
    return potValues[muxId * kPotsPerMux + potId];
}

float HardwareManager::getPotValue(int index) const {
    return (index >= 0 && index < kNumMux * kPotsPerMux) ? potValues[index] : 0.0f;
}

float HardwareManager::getCenteredPotValue(int muxId, int potId) const {
    float v = getPotValue(muxId, potId);
    return (fabsf(v - 0.5f) <= kSnapRadiusCenter) ? 0.5f : v;
}

void HardwareManager::setMuxAddress(BelaContext *context, int frame, int channel) {
    for(int bit = 0; bit < 4; bit++)
        digitalWrite(context, frame, addressPins[bit], (channel >> bit) & 1);
}
