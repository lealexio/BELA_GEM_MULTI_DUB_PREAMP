#pragma once
#include <cmath>
#include "SoftwareConfig.h"

/**
 * Professional noise gate using a peak envelope follower with
 * independent attack, hold and release stages.
 *
 * Signal flow:
 *   input → envelope follower → threshold → state machine → smooth gain → output
 *
 * State machine:
 *   CLOSED  : gate is shut; gain = 0. Opens when envelope ≥ kGateThreshold.
 *   ATTACK  : gain ramps to 1.0 over kGateAttackMs.
 *   HOLD    : gain stays at 1.0 for kGateHoldMs after signal drops.
 *   RELEASE : gain ramps to 0.0 over kGateReleaseMs, then returns to CLOSED.
 *
 * All timing constants are read from SoftwareConfig.h.
 *
 * Usage pattern:
 *   1. Call setup() once with the audio sample rate.
 *   2. Call process() once per sample inside the render loop.
 */
struct NoiseGate {
    /** Initialises timing coefficients. Must be called before processing. */
    void setup(float sampleRate);

    /** Process one sample and return the gated output. */
    float process(float input);

    /** Returns true while the gate is open (signal above threshold). */
    bool isOpen() const { return gateGain_ > 0.5f; }

private:
    enum class State { CLOSED, ATTACK, HOLD, RELEASE };

    float envelope_    = 0.f;
    float gateGain_    = 0.f;
    float holdCounter_ = 0.f;

    float attackCoeff_  = 0.f; // EMA coefficient for envelope attack
    float releaseCoeff_ = 0.f; // EMA coefficient for envelope release
    float gainAttCoeff_ = 0.f; // per-sample gain ramp-up coefficient
    float gainRelCoeff_ = 0.f; // per-sample gain ramp-down coefficient
    float holdSamples_  = 0.f; // kGateHoldMs expressed in samples

    State state_ = State::CLOSED;

    /** Converts a time constant (ms) to a one-pole EMA coefficient. */
    static float msToCoeff(float ms, float sampleRate) {
        return expf(-1.f / (ms * 0.001f * sampleRate));
    }
};
