#pragma once
#include <atomic>
#include <cmath>
#include "Biquad.h"
#include "DspUtils.h"
#include "SoftwareConfig.h"

/**
 * TubbySpring — King Tubby Space Reverb & Spring Tank with physical Splash trigger.
 *
 * Signal Flow:
 *   Input ──► Bandpass Filter (120 Hz HPF + 4.5 kHz LPF) ──┐
 *   Virtual Spring Splash (UI Trigger Button) ─────────────┼──► Asymmetric Drive (tanh)
 *                                                          │
 *                                                          ▼
 *                                            4-Stage All-Pass Disperser (Chirp)
 *                                                          │
 *                                                          ▼
 *                                            4 Parallel Prime Comb Filters (Tank)
 *                                             (with high-frequency damping loop)
 *                                                          │
 *                                                          ▼
 *                                             Tone Damping Biquad Filter
 *                                                          │
 *                                                          ▼
 *                                                × returnGain_ ──► Output
 *
 * Real-time Xenomai safe: preallocated static delay buffers (~16 KB),
 * atomic parameter exchange, zero heap allocations in render().
 */
class TubbySpring {
public:
    TubbySpring();

    /** Initialise filters and buffers for the given audio sample rate. */
    void setup(float sampleRate);

    /** Sets input coil drive / dwell level [0.0 .. 1.5]. */
    void setDwell(float dwell);

    /** Sets spring decay / ring time coefficient [0.2 .. 0.95]. */
    void setDecay(float decay);

    /** Sets the high-frequency damping tone cutoff (Hz) [1000 .. 5000]. */
    void setTone(float hz);

    /** Sets the wet return gain into the master bus [0.0 .. 1.5]. */
    void setReturnGain(float gain);

    /** Enables or disables the effect. */
    void setEnabled(bool en);

    /** Triggers the virtual physical spring splash impact (knuckle/kick on the rack). */
    void triggerSplash();

    /** Processes one audio sample. Returns the wet spring reverb signal. */
    float process(float inSample);

    /** Reads and resets the recent peak output for UI metering. */
    float getAndResetPeak();

private:
    static constexpr int kMaxCombLength = 2048;
    static constexpr int kMaxApLength   = 256;
    static constexpr int kNumCombs      = 4;
    static constexpr int kNumApStages   = 4;

    float sampleRate_ = kDefaultSampleRate;

    // Thread-safe parameters
    std::atomic<float> dwell_{kTubbySpringDwellDefault};
    std::atomic<float> decay_{kTubbySpringDecayDefault};
    std::atomic<float> toneHz_{kTubbySpringToneDefaultHz};
    std::atomic<float> returnGain_{kTubbySpringReturnDefault};
    std::atomic<bool>  enabled_{true};
    std::atomic<bool>  splashTrigger_{false};

    // Audio-thread state
    float peakOut_ = 0.f;
    float lastToneHz_ = -1.f;
    float loopToneCoeff_ = 0.5f;

    // Spring splash physical impulse state
    float splashEnv_ = 0.f;
    float splashPhase_ = 0.f;
    float splashDecayCoeff_ = 0.9985f;
    uint32_t prngSeed_ = 133742u;

    // Input bandpass conditioning
    BiquadFilter inHpf_; // 120 Hz HPF
    BiquadFilter inLpf_; // 4.5 kHz LPF
    BiquadFilter outToneLpf_; // Master tone damping

    // All-pass dispersion delay buffers & indices
    float apBuffer_[kNumApStages][kMaxApLength] = {};
    int   apIndex_[kNumApStages] = {};
    int   apDelay_[kNumApStages] = {67, 113, 149, 181}; // Dispersive sample lengths

    // Comb filter tank buffers & indices
    float combBuffer_[kNumCombs][kMaxCombLength] = {};
    int   combIndex_[kNumCombs] = {};
    int   combDelay_[kNumCombs] = {839, 1213, 1543, 1877}; // Prime sample lengths (~19..42 ms)
    float combLp_[kNumCombs] = {}; // 1-pole damping state per comb

    // Simple fast linear congruential PRNG for RT noise burst
    inline float fastRand() {
        prngSeed_ = prngSeed_ * 1664525u + 1013904223u;
        return ((float)(prngSeed_ & 0x00FFFFFF) / (float)0x007FFFFF) - 1.0f;
    }
};
