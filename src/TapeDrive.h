#pragma once
#include <atomic>
#include <cmath>
#include "Biquad.h"
#include "DspUtils.h"
#include "SoftwareConfig.h"

/**
 * TapeDrive — Analog Tape Saturation, Headroom Drive & Warmth coloration.
 *
 * Signal Flow:
 *   Input ──► × (1 + Drive × 5) ──► Asymmetric Bias (Even Harmonics)
 *                                               │
 *                                               ▼
 *                                     Padé Fast Tanh Saturation
 *                                               │
 *                                               ▼
 *                                          DC Blocker
 *                                               │
 *                                               ▼
 *                                   Tape Warmth LPF (10–12 kHz)
 *                                               │
 *                                               ▼
 *                                      × returnGain_ ──► Output
 *
 * Provides warm analog saturation, rounded transients for the Dub Siren,
 * and even-harmonic richness without digital clipping.
 *
 * Real-time Xenomai safe: atomic parameters, zero dynamic allocations.
 */
class TapeDrive {
public:
    TapeDrive();

    /** Initialise filters and state for the given audio sample rate. */
    void setup(float sampleRate);

    /** Sets saturation drive [0.0 .. 1.0] (0 = subtle warmth, 1 = heavy tape crunch). */
    void setDrive(float drive);

    /** Sets tape warmth high-frequency cutoff in Hz [6000 .. 16000]. */
    void setWarmth(float hz);

    /** Sets even-harmonic asymmetry amount [0.0 .. 1.0]. */
    void setAsymmetry(float asym);

    /** Sets return level into master bus [0.0 .. 1.5]. */
    void setReturnGain(float gain);

    /** Enables or disables the effect. */
    void setEnabled(bool en);

    /** Processes one audio sample. Returns wet tape saturation signal (or 0 when disabled). */
    float process(float inSample);

    /** Reads and resets the recent peak output for UI metering. */
    float getAndResetPeak();

private:
    float sampleRate_ = kDefaultSampleRate;

    // Thread-safe parameters
    std::atomic<float> drive_{kTapeDriveDefault};
    std::atomic<float> warmthHz_{kTapeWarmthDefaultHz};
    std::atomic<float> asymmetry_{kTapeAsymmetryDefault};
    std::atomic<float> returnGain_{kTapeReturnDefault};
    std::atomic<bool>  enabled_{true};

    // Audio-thread state
    float lastIn_ = 0.f;
    float dcOut_ = 0.f;
    float lastWarmthHz_ = -1.f;
    float peakOut_ = 0.f;

    BiquadFilter warmthLpf_;
};
