#pragma once
#include <atomic>
#include <cmath>
#include "Biquad.h"
#include "DspUtils.h"
#include "SoftwareConfig.h"

/**
 * ShimmerDelay — Pitch-Shifted Delay & Granular Re-pitch (Shimmer Dub).
 *
 * Signal Flow:
 *   Input ──► (+) ────────────────────────────────► 68k Ring Buffer (~1.5s)
 *              ▲                                               │
 *              │                                               ▼
 *              │ (Feedback loop)                     Dual Rotating Crossfade Taps
 *              │                                     (Variable Speed Re-pitch)
 *              │                                               │
 *              └── fastTanh ◄── Damping LPF ◄── × Feedback ────┤
 *                                                              ▼
 *                                                     × returnGain_ ──► Output
 *
 * Sound system interest: downward pitch drops (-1 octave) on snares / siren drops,
 * or ethereal soaring delays (+12 semitones / +7 fifths) on vocals and melodica.
 *
 * Real-time Xenomai safe: 68,000 float preallocated static ring buffer,
 * atomic parameter exchange, zero heap allocations.
 */
class ShimmerDelay {
public:
    ShimmerDelay();

    /** Initialise buffer and filter states for the given audio sample rate. */
    void setup(float sampleRate);

    /** Sets the pitch shift in semitones [-12 .. +12]. */
    void setSemitones(int semitones);

    /** Sets delay time in ms [40 .. 1500]. */
    void setDelayTime(float ms);

    /** Sets feedback amount [0.0 .. 0.95]. */
    void setFeedback(float fb);

    /** Sets grain crossfade size in ms [20 .. 100]. */
    void setGrainSize(float ms);

    /** Sets return level into master bus [0.0 .. 1.5]. */
    void setReturnGain(float gain);

    /** Enables or disables the effect. */
    void setEnabled(bool en);

    /** Flushes / clears the delay memory. */
    void clear();

    /** Processes one audio sample. Returns the pitch-shifted delay output. */
    float process(float inSample);

    /** Reads and resets the recent peak output for UI metering. */
    float getAndResetPeak();

private:
    static constexpr int kMaxDelaySamples = 68000; // ~1.54s @ 44.1 kHz

    float sampleRate_ = kDefaultSampleRate;
    float buffer_[kMaxDelaySamples] = {};
    int writePos_ = 0;

    // Thread-safe parameters
    std::atomic<int>   semitones_{kShimmerSemitonesDefault};
    std::atomic<float> delayTimeMs_{kShimmerDelayDefaultMs};
    std::atomic<float> feedback_{kShimmerFeedbackDefault};
    std::atomic<float> grainSizeMs_{kShimmerGrainSizeDefaultMs};
    std::atomic<float> returnGain_{kShimmerReturnDefault};
    std::atomic<bool>  enabled_{true};
    std::atomic<bool>  clearPending_{false};

    // Audio-thread state
    float grainPhase_ = 0.f;
    float peakOut_ = 0.f;
    int   clearRemainingSamples_ = 0;
    float clearFadeGain_ = 1.0f;

    BiquadFilter dampingLpf_; // Damps high frequencies in shimmer feedback (3.5 kHz)
};
