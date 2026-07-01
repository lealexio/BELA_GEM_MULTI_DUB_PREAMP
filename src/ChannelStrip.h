#pragma once
#include "Biquad.h"
#include "NoiseGate.h"

/**
 * Single input channel strip: gain → noise gate → 3-band parametric EQ → FX send.
 *
 * Signal flow:
 *   IN ──► × inputGain_ ──► NoiseGate ──► EQ (low shelf / mid peak / high shelf)
 *                                              │
 *                                              ├──► dry out            (returned by process())
 *                                              ├──► × fxSendLevel_  ──► FX send 1 (fxOut())
 *                                              └──► × fxSendLevel2_ ──► FX send 2 (fxOut2())
 *
 * EQ frequencies and ranges are configured in SoftwareConfig.h (kEqLowFreq, etc.).
 * The EQ is fully bypassed (no filter in signal path) when all gains are exactly 0 dB.
 *
 * Usage pattern:
 *   1. Call setup() once with the audio sample rate.
 *   2. Call set*() methods once per render block (before the sample loop).
 *   3. Call process() once per sample; call fxOut() immediately after on the same sample.
 */
class ChannelStrip {
public:
    ChannelStrip() = default;

    /** Initialises filters and noise gate at the given sample rate. */
    void setup(float sampleRate);

    /**
     * Sets the input gain (linear).
     * @param gain  0.0 = silence, 1.0 = unity gain
     */
    void setInputGain(float gain);

    /**
     * Updates the 3-band EQ coefficients.
     * Coefficients are only recomputed when a value has changed.
     * @param gainLowDb   Low shelf gain  (dB); ±kEqGainRangeDb, 0 = flat
     * @param gainMidDb   Mid peak  gain  (dB); ±kEqGainRangeDb, 0 = flat
     * @param gainHighDb  High shelf gain (dB); ±kEqGainRangeDb, 0 = flat
     */
    void setEqGains(float gainLowDb, float gainMidDb, float gainHighDb);

    /**
     * Sets the post-fader FX send 1 level.
     * @param level  0.0 = no send, 1.0 = full send (same level as dry out)
     */
    void setFxSendLevel(float level);

    /**
     * Sets the post-fader FX send 2 level.
     * @param level  0.0 = no send, 1.0 = full send (same level as dry out)
     */
    void setFxSend2Level(float level);

    /** Process one sample through the full chain. Returns the dry output. */
    float process(float input);

    /**
     * Returns the FX send 1 sample corresponding to the last call to process().
     * Must be called in the same sample iteration as process().
     */
    float fxOut()  const { return lastOut_ * fxSendLevel_;  }

    /**
     * Returns the FX send 2 sample corresponding to the last call to process().
     * Must be called in the same sample iteration as process().
     */
    float fxOut2() const { return lastOut_ * fxSendLevel2_; }

    /** Returns true while the internal noise gate is open (signal detected). */
    bool gateIsOpen() const { return gate_.isOpen(); }

private:
    float sampleRate_      = 44100.f;
    float inputGain_       = 1.f;
    float fxSendLevel_     = 0.f;
    float fxSendLevel2_    = 0.f;
    float lastOut_         = 0.f;   // stored by process(), read by fxOut()
    float gainSmoothCoeff_ = 0.f;   // one-pole coefficient for EQ gain smoothing

    NoiseGate gate_;

    BiquadFilter low_;  // low  shelf  (kEqLowFreq  Hz)
    BiquadFilter mid_;  // peaking EQ  (kEqMidFreq  Hz, kEqMidQ)
    BiquadFilter high_; // high shelf  (kEqHighFreq Hz)

    float targetLow_  = 0.f; // target gains from setEqGains()
    float targetMid_  = 0.f;
    float targetHigh_ = 0.f;
    float smoothLow_  = 0.f; // per-sample smoothed gains (advanced in process())
    float smoothMid_  = 0.f;
    float smoothHigh_ = 0.f;
    float lastLow_    = 0.f; // gains at which biquad was last computed
    float lastMid_    = 0.f;
    float lastHigh_   = 0.f;
};
