#pragma once
#include <atomic>
#include <cmath>
#include "Biquad.h"
#include "DspUtils.h"
#include "SoftwareConfig.h"

/**
 * SubRoar — Dub Sub-Bass Synthesizer & Harmonic Roar Saturator.
 *
 * Signal Flow:
 *   Input ──► Bandpass Detector (60 Hz) ──► Transient Trigger ──┐
 *   Manual Drop (UI Button) ───────────────────────────────────┤
 *                                                              ▼
 *                                                   Pitch-gliding Low Sine Osc
 *                                                              │
 *   Input ──► Direct Sub-Harmonic Path ────────────────────────┤
 *                                                              ▼
 *                                                        Sum (+ Drive)
 *                                                              ▼
 *                                                  Asymmetric Warm Saturation
 *                                                              ▼
 *                                                24 dB/oct Steep Sub LPF
 *                                                              ▼
 *                                                × returnGain_ ──► Output
 *
 * Real-time Xenomai safe: preallocated state, atomic parameter exchange,
 * zero allocations in render().
 */
class SubRoar {
public:
    SubRoar();

    /** Initialise filters and state for the given audio sample rate. */
    void setup(float sampleRate);

    /** Sets the sub oscillator fundamental frequency (Hz). */
    void setTune(float hz);

    /** Sets the saturation / roar drive level [0.0 .. 1.0]. */
    void setDrive(float drive);

    /** Sets the sub decay time (ms). */
    void setDecay(float ms);

    /** Sets the steep 24 dB/oct low-pass filter cutoff (Hz). */
    void setCutoff(float hz);

    /** Sets the return gain into the master bus [0.0 .. 1.5]. */
    void setReturnGain(float gain);

    /** Enables or disables the effect. */
    void setEnabled(bool en);

    /** Processes one audio sample. Returns the wet sub roar signal. */
    float process(float inSample);

    /** Reads and resets the recent peak output for UI metering. */
    float getAndResetPeak();

private:
    float sampleRate_ = kDefaultSampleRate;

    // Thread-safe parameters (written by GUI / seasocks, read by RT audio)
    std::atomic<float> tuneHz_{kSubRoarTuneDefaultHz};
    std::atomic<float> drive_{kSubRoarDriveDefault};
    std::atomic<float> decayMs_{kSubRoarDecayDefaultMs};
    std::atomic<float> cutoffHz_{kSubRoarCutoffDefaultHz};
    std::atomic<float> returnGain_{kSubRoarReturnDefault};
    std::atomic<bool>  enabled_{true};

    // Audio-thread only state
    float phase_            = 0.f;
    float currentPitch_     = 45.f;
    float pitchGlideCoeff_  = 0.005f;
    float attackCoeff_      = 0.01f;
    float env_              = 0.f;
    float decayCoeff_       = 0.999f;
    float lastCutoff_       = -1.f;
    float lastDecayMs_      = -1.f;
    float lastDrive_        = -1.f;
    float driveMult_        = 1.0f;
    float normFactor_       = 1.0f;
    float peakOut_          = 0.f;

    BiquadFilter inBp_; // Input detector filter (400 Hz low-pass)
    BiquadFilter lp1_;  // 24 dB/oct cascade stage 1
    BiquadFilter lp2_;  // 24 dB/oct cascade stage 2
};
