#pragma once
#include <atomic>
#include <cmath>
#include "Biquad.h"
#include "DspUtils.h"
#include "SoftwareConfig.h"

/**
 * EchoDub — Jamaican Dub Tape Delay & Space Echo with saturating feedback loop.
 *
 * Signal Flow:
 *   Input ──► [Kill Send Switch] ──┐
 *                                  ▼
 *                              (+) ◄─────────────┐ (Feedback loop)
 *                               │                 │
 *                               ▼                 │
 *                   Interpolated Delay Line       │
 *                               │                 │
 *                               ├──► Wow/Flutter  │
 *                               ▼                 │
 *                     Tape Filter (HPF + LPF)     │
 *                               │                 │
 *                               ▼                 │
 *                     Tape Saturation (tanh) ─────┤
 *                               │                 │
 *                               ▼                 │
 *                         × Feedback ─────────────┘
 *                               │
 *                               ▼
 *                         × returnGain_ ──► Output
 *
 * Real-time Xenomai safe: 96,000 samples preallocated static ring buffer (~2.1s),
 * Hermite 4-point interpolation for pitch-glide on delay time sweeps, zero allocations.
 */
class EchoDub {
public:
    EchoDub();

    /** Initialise buffer and feedback filters for the given audio sample rate. */
    void setup(float sampleRate);

    /** Sets the delay time (ms). */
    void setTime(float ms);

    /** Sets the feedback amount [0.0 .. 1.15] (> 0.85 = dub self-oscillation). */
    void setFeedback(float fb);

    /** Sets the tape tone damping filter cutoff (Hz). */
    void setTone(float hz);

    /** Sets the tape wow/flutter depth [0.0 .. 1.0]. */
    void setFlutter(float depth);

    /** Mutes the delay input without cutting the existing feedback echo trail. */
    void setKillSend(bool kill);

    /** Sets the wet return level into the master bus [0.0 .. 1.0]. */
    void setReturnGain(float gain);

    /** Enables or disables the effect. */
    void setEnabled(bool en);

    /** Enables or disables stereo Ping-Pong cross-feedback mode. */
    void setPingPong(bool pp);

    /** Returns true if Ping-Pong stereo mode is enabled. */
    bool isPingPong() const { return pingPong_.load(std::memory_order_relaxed); }

    /** Immediately clears / flushes the delay memory buffer. */
    void clear();

    /** Returns true if kill send is currently active. */
    bool isKillSendActive() const { return killSend_.load(std::memory_order_relaxed); }

    /** Processes one audio sample (mono sum). Returns the wet delay output. */
    float process(float inSample);

    /** Processes one audio sample into stereo wet outputs (ping-pong when enabled). */
    void processStereo(float inSample, float &outL, float &outR);

    /** Reads and resets the recent peak output for UI metering. */
    float getAndResetPeak();

private:
    static constexpr int kMaxDelaySamples = 96000; // ~2.17 seconds at 44.1 kHz

    float sampleRate_ = kDefaultSampleRate;
    float buffer_[kMaxDelaySamples] = {};
    float bufferR_[kMaxDelaySamples] = {};
    int   writePos_ = 0;

    // Thread-safe parameters
    std::atomic<float> timeMs_{kEchoDubDefaultDelayMs};
    std::atomic<float> feedback_{kEchoDubDefaultFeedback};
    std::atomic<float> toneHz_{kEchoDubDefaultToneHz};
    std::atomic<float> flutter_{kEchoDubDefaultFlutter};
    std::atomic<float> returnGain_{kEchoDubReturnDefault};
    std::atomic<bool>  killSend_{false};
    std::atomic<bool>  clearPending_{false};
    std::atomic<bool>  enabled_{true};
    std::atomic<bool>  pingPong_{kEchoDubPingPongDefault};

    // Audio-thread state
    float currentDelaySamples_ = 16537.5f; // smoothed read position
    float delaySlewCoeff_      = 0.002f;   // tape motor inertia glide
    float lfoPhase_            = 0.f;
    float lfoInc_              = 0.f;
    float lastToneHz_          = -1.f;
    float peakOut_             = 0.f;
    int   clearRemainingSamples_ = 0;
    float clearFadeGain_       = 1.0f;

    BiquadFilter loopHpf_;  // Loop high-pass filter (180 Hz) L
    BiquadFilter loopLpf_;  // Loop tape tone low-pass filter L
    BiquadFilter loopHpfR_; // Loop high-pass filter (180 Hz) R (Ping-Pong)
    BiquadFilter loopLpfR_; // Loop tape tone low-pass filter R (Ping-Pong)

    /** 4-point Hermite cubic interpolation for clean delay pitch bending. */
    static inline float hermite4(float frac, float y0, float y1, float y2, float y3) {
        float c0 = y1;
        float c1 = 0.5f * (y2 - y0);
        float c2 = y0 - 2.5f * y1 + 2.0f * y2 - 0.5f * y3;
        float c3 = 0.5f * (y3 - y0) + 1.5f * (y1 - y2);
        return ((c3 * frac + c2) * frac + c1) * frac + c0;
    }
};

// Backward compatibility alias
using EchuDub = EchoDub;
