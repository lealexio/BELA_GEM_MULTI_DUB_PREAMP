#include "ChannelStrip.h"
#include "SoftwareConfig.h"

// ---------------------------------------------------------------------------
// BiquadFilter — Audio EQ Cookbook formulas (R. Bristow-Johnson)
// ---------------------------------------------------------------------------

float BiquadFilter::process(float x) {
    float y = b0*x + b1*x1 + b2*x2 - a1*y1 - a2*y2;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
    return y;
}

void BiquadFilter::setLowShelf(float freq, float gainDb, float sampleRate) {
    float A  = powf(10.f, gainDb / 40.f);
    float w0 = 2.f * M_PI * freq / sampleRate;
    float cw = cosf(w0);
    float sw = sinf(w0);
    float alpha = sw / 2.f * sqrtf(2.f); // shelf slope S=1

    float sqA = sqrtf(A);
    float a0 =  (A+1) + (A-1)*cw + 2.f*sqA*alpha;
    b0 =  A * ((A+1) - (A-1)*cw + 2.f*sqA*alpha) / a0;
    b1 =  2.f*A * ((A-1) - (A+1)*cw)              / a0;
    b2 =  A * ((A+1) - (A-1)*cw - 2.f*sqA*alpha)  / a0;
    a1 = -2.f * ((A-1) + (A+1)*cw)                / a0;
    a2 =       ((A+1) + (A-1)*cw - 2.f*sqA*alpha) / a0;
}

void BiquadFilter::setHighShelf(float freq, float gainDb, float sampleRate) {
    float A  = powf(10.f, gainDb / 40.f);
    float w0 = 2.f * M_PI * freq / sampleRate;
    float cw = cosf(w0);
    float sw = sinf(w0);
    float alpha = sw / 2.f * sqrtf(2.f); // shelf slope S=1

    float sqA = sqrtf(A);
    float a0 =  (A+1) - (A-1)*cw + 2.f*sqA*alpha;
    b0 =  A * ((A+1) + (A-1)*cw + 2.f*sqA*alpha)  / a0;
    b1 = -2.f*A * ((A-1) + (A+1)*cw)               / a0;
    b2 =  A * ((A+1) + (A-1)*cw - 2.f*sqA*alpha)   / a0;
    a1 =  2.f * ((A-1) - (A+1)*cw)                 / a0;
    a2 =       ((A+1) - (A-1)*cw - 2.f*sqA*alpha)  / a0;
}

void BiquadFilter::setPeaking(float freq, float gainDb, float q, float sampleRate) {
    float A  = powf(10.f, gainDb / 40.f);
    float w0 = 2.f * M_PI * freq / sampleRate;
    float alpha = sinf(w0) / (2.f * q);
    float cw = cosf(w0);

    float a0 = 1.f + alpha / A;
    b0 =  (1.f + alpha * A) / a0;
    b1 = (-2.f * cw)        / a0;
    b2 =  (1.f - alpha * A) / a0;
    a1 = (-2.f * cw)        / a0;
    a2 =  (1.f - alpha / A) / a0;
}

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
    if(lastLow_ == 0.f && lastMid_ == 0.f && lastHigh_ == 0.f)
        return gated;

    return high_.process(mid_.process(low_.process(gated)));
}
