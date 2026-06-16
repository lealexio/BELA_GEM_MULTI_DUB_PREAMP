#include "NoiseGate.h"
#include <cmath>

void NoiseGate::setup(float sampleRate) {
    attackCoeff_  = msToCoeff(2.0f,           sampleRate);
    releaseCoeff_ = msToCoeff(kGateReleaseMs,  sampleRate);
    gainAttCoeff_ = msToCoeff(kGateAttackMs,   sampleRate);
    gainRelCoeff_ = msToCoeff(kGateReleaseMs,  sampleRate);
    holdSamples_  = kGateHoldMs * 0.001f * sampleRate;
}

float NoiseGate::process(float input) {
    // 1. Peak envelope follower with asymmetric attack/release
    float absIn    = fabsf(input);
    float envCoeff = (absIn > envelope_) ? attackCoeff_ : releaseCoeff_;
    envelope_ = absIn + envCoeff * (envelope_ - absIn);

    // 2. State machine: CLOSED → ATTACK → HOLD → RELEASE → CLOSED
    switch(state_) {
        case State::CLOSED:
            if(envelope_ >= kGateThreshold)
                state_ = State::ATTACK;
            break;

        case State::ATTACK:
            if(gateGain_ >= 0.999f) {
                gateGain_    = 1.f;
                holdCounter_ = holdSamples_;
                state_       = State::HOLD;
            }
            if(envelope_ < kGateThreshold)
                state_ = State::RELEASE;
            break;

        case State::HOLD:
            if(--holdCounter_ <= 0.f) {
                if(envelope_ >= kGateThreshold)
                    holdCounter_ = holdSamples_;
                else
                    state_ = State::RELEASE;
            }
            break;

        case State::RELEASE:
            if(envelope_ >= kGateThreshold)
                state_ = State::ATTACK;
            else if(gateGain_ <= 0.001f) {
                gateGain_ = 0.f;
                state_    = State::CLOSED;
            }
            break;
    }

    // 3. Smooth gain ramp (avoids clicks on open/close)
    float targetGain = (state_ == State::CLOSED || state_ == State::RELEASE) ? 0.f : 1.f;
    float rampCoeff  = (targetGain > gateGain_) ? gainAttCoeff_ : gainRelCoeff_;
    gateGain_ += (1.f - rampCoeff) * (targetGain - gateGain_);

    return input * gateGain_;
}
