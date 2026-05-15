#pragma once
#include <cmath>

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
 * Models one input channel: gain stage followed by a 3-band parametric EQ
 * (low shelf / mid peak / high shelf).
 *
 * Intended to be instantiated once per physical input in the future.
 * Call setInputGain() and setEqGains() once per render block, then
 * process() once per sample.
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

    /** Process one sample: applies input gain then the 3-band EQ. */
    float process(float input);

private:
    float sampleRate_  = 44100.f;
    float inputGain_   = 1.f;

    BiquadFilter low_;   // low  shelf  @ 250 Hz
    BiquadFilter mid_;   // peaking EQ  @ 1 kHz, Q=1.4
    BiquadFilter high_;  // high shelf  @ 4 kHz

    float lastLow_  = 0.f;
    float lastMid_  = 0.f;
    float lastHigh_ = 0.f;
};
