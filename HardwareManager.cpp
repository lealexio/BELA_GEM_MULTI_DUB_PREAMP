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
    // 1. Read the value for the channel addressed in the previous render.
    //    Frame 0 is valid here because we are inside render().
    float rawValue = analogRead(context, 0, 0) * kScaleRecovery;
    // Normalise to [0.0, 1.0]: divide by observed practical max, then clamp.
    rawValue = rawValue / kPotMax;
    if(rawValue <= kPotMin) rawValue = 0.0f;
    if(rawValue >  1.0f)   rawValue = 1.0f;

    // Only update if the change exceeds the jitter threshold.
    if(fabsf(rawValue - potValues[currentChannel]) >= kJitterThreshold)
        potValues[currentChannel] = rawValue;

    // 2. Advance to the next channel.
    currentChannel = (currentChannel + 1) % kPotsPerMux;

    // 3. Set the address pins on the LAST digital frame so the MUX
    //    has the full duration of the next buffer to settle (~0.3–1 ms).
    setMuxAddress(context, context->digitalFrames - 1, currentChannel);
}

void HardwareManager::setMuxAddress(BelaContext *context, int frame, int channel) {
    for(int bit = 0; bit < 4; bit++)
        digitalWrite(context, frame, addressPins[bit], (channel >> bit) & 1);
}
