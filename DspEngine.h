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
 * 3-band parametric equaliser (low shelf / mid peak / high shelf).
 * Gains are expressed in dB; call setGains() once per render block.
 */
class DspEngine {
public:
    DspEngine() = default;

    /** Must be called in setup() with the audio sample rate. */
    void setup(float sampleRate);

    /**
     * Updates filter coefficients when gains change.
     * Call once per render block, before the sample loop.
     * @param gainLowDb  Low shelf gain  in dB  (-6 to +6)
     * @param gainMidDb  Mid peak  gain  in dB  (-6 to +6)
     * @param gainHighDb High shelf gain in dB  (-6 to +6)
     */
    void setGains(float gainLowDb, float gainMidDb, float gainHighDb);

    /** Process one sample through the 3-band EQ chain. */
    float process(float input);

private:
    float sampleRate_  = 44100.f;

    BiquadFilter low_;   // low  shelf  @ 250 Hz
    BiquadFilter mid_;   // peaking EQ  @ 1 kHz, Q=1.4
    BiquadFilter high_;  // high shelf  @ 4 kHz

    float lastLow_  = 0.f;
    float lastMid_  = 0.f;
    float lastHigh_ = 0.f;
};
