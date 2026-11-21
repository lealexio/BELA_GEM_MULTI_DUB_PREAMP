#pragma once
#include <atomic>
#include <cmath>
#include "DspUtils.h"
#include "SoftwareConfig.h"

/**
 * DubDucker — Automatic Sidechain Ducker for Reverb & Delay.
 *
 * Signal Flow:
 *   Key Inputs (Siren / Mic / Master) ──► Peak Follower (Instant Attack / Smooth Release)
 *                                                      │
 *                                                      ▼
 *                                           Threshold & Ratio Detector
 *                                                      │
 *                                                      ▼
 *                                                duckGain_ [0..1]
 *                                                      │
 *                                                      ▼
 *                              Attenuates time-based FX returns (Echo / Reverb / Shimmer)
 *
 * Keeps massive echo trails and long spring reverb washes in the mix without
 * ever muddying MC vocals, siren punches, or dry master clarity.
 *
 * Real-time Xenomai safe: zero allocations, atomic parameters.
 */
class DubDucker {
public:
    DubDucker();

    /** Initialise envelope detector for the given sample rate. */
    void setup(float sampleRate);

    /** Sets threshold [0.01 .. 0.50] (approx -40 dBFS to -6 dBFS). */
    void setThreshold(float th);

    /** Sets release time in ms [50 .. 1500]. */
    void setReleaseMs(float ms);

    /** Sets ducking attenuation amount [0.0 .. 1.0] (1.0 = full attenuation). */
    void setDuckAmount(float amount);

    /** Sets key source (0 = Siren, 1 = Mic, 2 = Master, 3 = All). */
    void setSource(int src);

    /** Enables or disables the effect. */
    void setEnabled(bool en);

    /**
     * Updates key detector with current audio frame signals.
     * Computes the current ducking attenuation factor.
     */
    void updateKey(float sirenSample, float micSample, float masterSample);

    /** Returns the current gain multiplier to apply to time-based wet FX returns [0..1]. */
    float getDuckGain() const { return currentGain_; }

    /** Returns current gain reduction [0..1] (0 = no ducking, 1 = max ducking) for UI metering. */
    float getGainReductionForMeter() const { return 1.0f - currentGain_; }

private:
    float sampleRate_ = kDefaultSampleRate;

    // Thread-safe parameters
    std::atomic<float> threshold_{kDubDuckerThresholdDefault};
    std::atomic<float> releaseMs_{kDubDuckerReleaseDefaultMs};
    std::atomic<float> duckAmount_{kDubDuckerAmountDefault};
    std::atomic<int>   source_{kDubDuckerSourceDefault};
    std::atomic<bool>  enabled_{true};

    // Audio-thread state
    float env_ = 0.f;
    float currentGain_ = 1.0f;
    float attackCoeff_ = 0.05f;
    float lastReleaseMs_ = -1.f;
    float releaseCoeff_ = 0.001f;
    float lastThreshold_ = -1.f;
    float invRange_ = 1.0f;
};
