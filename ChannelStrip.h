#pragma once
#include "Biquad.h"
#include "SoftwareConfig.h"

/**
 * Professional noise gate using a peak envelope follower with
 * independent attack, hold and release stages.
 *
 * Signal flow: input → envelope detection → threshold → smooth gain → output
 *
 * The gate gain ramps smoothly to avoid clicks:
 *   - Attack  : gain ramps to 1.0 when envelope > threshold
 *   - Hold    : gain stays at 1.0 for kGateHoldMs after signal drops
 *   - Release : gain ramps to 0.0 after the hold period expires
 */
struct NoiseGate {
    /** Must be called once with the audio sample rate before processing. */
    void setup(float sampleRate);

    /** Process one sample and return the gated output. */
    float process(float input);

    /** Returns true if the gate is currently open (signal detected). */
    bool isOpen() const { return gateGain_ > 0.5f; }

private:
    enum class State { CLOSED, ATTACK, HOLD, RELEASE };

    float envelope_     = 0.f;
    float gateGain_     = 0.f;
    float holdCounter_  = 0.f;

    float attackCoeff_  = 0.f;  // per-sample EMA coefficient for envelope attack
    float releaseCoeff_ = 0.f;  // per-sample EMA coefficient for envelope release
    float gainAttCoeff_ = 0.f;  // per-sample gain ramp up
    float gainRelCoeff_ = 0.f;  // per-sample gain ramp down
    float holdSamples_  = 0.f;  // hold duration in samples

    State state_ = State::CLOSED;

    /** Converts a time constant in ms to a one-pole EMA coefficient. */
    static float msToCoeff(float ms, float sampleRate) {
        return expf(-1.f / (ms * 0.001f * sampleRate));
    }
};

/**
 * Models one input channel: input gain → noise gate → 3-band parametric EQ.
 *
 * Signal flow:
 *   IN → gain → gate → EQ → dry out
 *                        └──────────► × fxSendLevel → FX send out
 *
 * The FX send is post-fader (after gain, gate and EQ).
 * Call set*() methods once per render block, then process() once per sample.
 */
class ChannelStrip {
public:
    ChannelStrip() = default;

    /** Must be called in setup() with the audio sample rate. */
    void setup(float sampleRate);

    /**
     * Sets the input gain (linear, 0.0 = silence, 1.0 = unity).
     * Call once per render block before the sample loop.
     */
    void setInputGain(float gain);

    /**
     * Updates EQ filter coefficients when gains change.
     * Call once per render block before the sample loop.
     * @param gainLowDb  Low shelf gain  in dB  (-6 to +6)
     * @param gainMidDb  Mid peak  gain  in dB  (-6 to +6)
     * @param gainHighDb High shelf gain in dB  (-6 to +6)
     */
    void setEqGains(float gainLowDb, float gainMidDb, float gainHighDb);

    /**
     * Sets the FX send level (0.0 = no send, 1.0 = full post-fader signal).
     * Call once per render block before the sample loop.
     */
    void setFxSendLevel(float level);

    /** Process one sample: gain → gate → EQ. Returns the dry output. */
    float process(float input);

    /**
     * Returns the FX send sample for the last processed input.
     * Must be called after process() on the same sample.
     */
    float fxOut() const { return lastOut_ * fxSendLevel_; }

    /** Returns true if the noise gate is currently open. */
    bool gateIsOpen() const { return gate_.isOpen(); }

private:
    float sampleRate_   = 44100.f;
    float inputGain_    = 1.f;
    float fxSendLevel_  = 0.f;
    float lastOut_      = 0.f;  // last dry output, used by fxOut()

    NoiseGate    gate_;

    BiquadFilter low_;   // low  shelf  @ 250 Hz
    BiquadFilter mid_;   // peaking EQ  @ 1 kHz, Q=1.4
    BiquadFilter high_;  // high shelf  @ 4 kHz

    float lastLow_  = 0.f;
    float lastMid_  = 0.f;
    float lastHigh_ = 0.f;
};
