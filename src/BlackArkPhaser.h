#pragma once
#include <atomic>
#include <cmath>
#include "DspUtils.h"
#include "SoftwareConfig.h"

/**
 * BlackArkPhaser — Lee "Scratch" Perry Mu-Tron style Bi-Phase & Deep Dub Swirl.
 *
 * Signal Flow:
 *   Input ──► (+) ◄─────────────────────────────────┐ (Feedback)
 *              │                                     │
 *              ▼                                     │
 *   Cascade of 6 or 12 All-Pass Filter Stages        │
 *   (sweep modulated by slow quadrature LFO)         │
 *              │                                     │
 *              ├─────────────────────────────────────┤
 *              ▼                                     │
 *   Mix (0.5 * (Dry + AllPass))                      │
 *              │                                     ▼
 *              ▼                               Saturator (tanh)
 *   × returnGain_ ──► Output
 *
 * Real-time Xenomai safe: fixed arrays, atomic parameter exchange, zero allocations.
 */
class BlackArkPhaser {
public:
    BlackArkPhaser();

    /** Initialise filter states for the given audio sample rate. */
    void setup(float sampleRate);

    /** Sets the LFO sweep rate in Hz [0.02 .. 6.0]. */
    void setRate(float hz);

    /** Sets the sweep depth [0.0 .. 1.0]. */
    void setDepth(float depth);

    /** Sets the feedback resonance amount [-0.92 .. +0.92]. */
    void setFeedback(float fb);

    /** Sets the number of all-pass stages (6 or 12). */
    void setStages(int stages);

    /** Sets the wet return gain into the master bus [0.0 .. 1.5]. */
    void setReturnGain(float gain);

    /** Enables or disables the effect. */
    void setEnabled(bool en);

    /** Processes one audio sample. Returns the wet phased signal. */
    float process(float inSample);

    /** Reads and resets the recent peak output for UI metering. */
    float getAndResetPeak();

private:
    static constexpr int kMaxStages = 12;

    float sampleRate_ = kDefaultSampleRate;

    // Thread-safe parameters
    std::atomic<float> rate_{kBlackArkRateDefaultHz};
    std::atomic<float> depth_{kBlackArkDepthDefault};
    std::atomic<float> feedback_{kBlackArkFeedbackDefault};
    std::atomic<int>   stages_{kBlackArkStagesDefault};
    std::atomic<float> returnGain_{kBlackArkReturnDefault};
    std::atomic<bool>  enabled_{true};

    // Audio-thread state
    float lfoPhase_ = 0.f;
    float lastStageOut_ = 0.f;
    float peakOut_ = 0.f;
    float currentA_ = 0.5f;
    float targetA_ = 0.5f;
    int   subSampleCount_ = 0;

    // 1st-order all-pass delay registers (x[n-1] and y[n-1] per stage)
    float x1_[kMaxStages] = {};
    float y1_[kMaxStages] = {};
};
