#pragma once
#include <cmath>
#include "SoftwareConfig.h"

/**
 * Second-order IIR biquad filter.
 * Coefficients are normalised (divided by a0).
 * State variables use Direct Form I.
 */
struct BiquadFilter {
    float b0 = 1.f, b1 = 0.f, b2 = 0.f;
    float a1 = 0.f, a2 = 0.f;
    float x1 = 0.f, x2 = 0.f;
    float y1 = 0.f, y2 = 0.f;

    /** Process one sample in-place. */
    float process(float x);

    /** Low-shelf: boosts/cuts frequencies below freq. */
    void setLowShelf(float freq, float gainDb, float sampleRate);

    /** High-shelf: boosts/cuts frequencies above freq. */
    void setHighShelf(float freq, float gainDb, float sampleRate);

    /** Peaking EQ: boosts/cuts a band centred on freq with given Q. */
    void setPeaking(float freq, float gainDb, float q, float sampleRate);
};

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
 * Intended to be instantiated once per physical input.
 * Call setInputGain() and setEqGains() once per render block,
 * then process() once per sample.
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

    /** Process one sample: gain → gate → EQ. */
    float process(float input);

    /** Returns true if the noise gate is currently open. */
    bool gateIsOpen() const { return gate_.isOpen(); }

private:
    float sampleRate_ = 44100.f;
    float inputGain_  = 1.f;

    NoiseGate    gate_;

    BiquadFilter low_;   // low  shelf  @ 250 Hz
    BiquadFilter mid_;   // peaking EQ  @ 1 kHz, Q=1.4
    BiquadFilter high_;  // high shelf  @ 4 kHz

    float lastLow_  = 0.f;
    float lastMid_  = 0.f;
    float lastHigh_ = 0.f;
};
