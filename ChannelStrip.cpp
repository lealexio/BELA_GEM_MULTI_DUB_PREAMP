#include "ChannelStrip.h"
#include "SoftwareConfig.h"

// ---------------------------------------------------------------------------
// NoiseGate
// ---------------------------------------------------------------------------

void NoiseGate::setup(float sampleRate) {
    // Envelope follower coefficients (fast attack, slow release)
    attackCoeff_  = msToCoeff(2.0f,          sampleRate);
    releaseCoeff_ = msToCoeff(kGateReleaseMs, sampleRate);

    // Gate gain ramp coefficients (how fast the output fades in/out)
    gainAttCoeff_ = msToCoeff(kGateAttackMs,  sampleRate);
    gainRelCoeff_ = msToCoeff(kGateReleaseMs, sampleRate);

    holdSamples_  = kGateHoldMs * 0.001f * sampleRate;
}

float NoiseGate::process(float input) {
    // 1. Peak envelope follower with asymmetric attack/release
    float absIn = fabsf(input);
    float envCoeff = (absIn > envelope_) ? attackCoeff_ : releaseCoeff_;
    envelope_ = absIn + envCoeff * (envelope_ - absIn);

    // 2. State machine: CLOSED → ATTACK → HOLD → RELEASE → CLOSED
    switch(state_) {
        case State::CLOSED:
            if(envelope_ >= kGateThreshold) {
                state_ = State::ATTACK;
            }
            break;

        case State::ATTACK:
            // Gate is ramping open; transition to HOLD once fully open
            if(gateGain_ >= 0.999f) {
                gateGain_    = 1.f;
                holdCounter_ = holdSamples_;
                state_       = State::HOLD;
            }
            // Close immediately if signal disappears during attack
            if(envelope_ < kGateThreshold)
                state_ = State::RELEASE;
            break;

        case State::HOLD:
            if(--holdCounter_ <= 0.f) {
                if(envelope_ >= kGateThreshold)
                    holdCounter_ = holdSamples_; // signal returned — reset hold
                else
                    state_ = State::RELEASE;
            }
            break;

        case State::RELEASE:
            if(envelope_ >= kGateThreshold) {
                state_ = State::ATTACK; // signal came back during release
            } else if(gateGain_ <= 0.001f) {
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

// ---------------------------------------------------------------------------
// ChannelStrip
// ---------------------------------------------------------------------------

void ChannelStrip::setup(float sampleRate) {
    sampleRate_ = sampleRate;
    gate_.setup(sampleRate_);
    // Initialise filters at 0 dB so the strip is transparent on startup
    low_.setLowShelf  (250.f,  0.f,       sampleRate_);
    mid_.setPeaking   (1000.f, 0.f, 1.4f, sampleRate_);
    high_.setHighShelf(4000.f, 0.f,       sampleRate_);
}

void ChannelStrip::setInputGain(float gain) {
    inputGain_ = gain;
}

void ChannelStrip::setFxSendLevel(float level) {
    fxSendLevel_ = level;
}

void ChannelStrip::setEqGains(float gainLowDb, float gainMidDb, float gainHighDb) {
    // Recompute coefficients only when a value has actually changed
    if(gainLowDb != lastLow_) {
        low_.setLowShelf(250.f, gainLowDb, sampleRate_);
        lastLow_ = gainLowDb;
    }
    if(gainMidDb != lastMid_) {
        mid_.setPeaking(1000.f, gainMidDb, 1.4f, sampleRate_);
        lastMid_ = gainMidDb;
    }
    if(gainHighDb != lastHigh_) {
        high_.setHighShelf(4000.f, gainHighDb, sampleRate_);
        lastHigh_ = gainHighDb;
    }
}

float ChannelStrip::process(float input) {
    // 1. Input gain stage
    float gained = input * inputGain_;

    // 2. Noise gate — mutes signal when no input is detected
    float gated = gate_.process(gained);

    // 3. EQ — bypassed entirely when all bands are at 0 dB
    float out = (lastLow_ == 0.f && lastMid_ == 0.f && lastHigh_ == 0.f)
        ? gated
        : high_.process(mid_.process(low_.process(gated)));

    // Store dry output so fxOut() can scale it by fxSendLevel_
    lastOut_ = out;
    return out;
}
