#pragma once
#include "Biquad.h"
#include "SoftwareConfig.h"

/**
 * Master filter section: independent HPF and LPF with sweepable frequency and resonance.
 *
 * Each filter can be independently enabled or bypassed:
 *   - HPF (High-Pass Filter): attenuates frequencies below the cutoff — removes rumble / low-end.
 *   - LPF (Low-Pass Filter): attenuates frequencies above the cutoff — darkens the mix, classic dub sweep.
 *
 * Frequency is mapped logarithmically across the band so each octave takes equal pot travel.
 * Resonance (Q) is mapped linearly from kFilterQMin (flat) to kFilterQMax (CDJ-style peak).
 *
 * Both filters are bypassed (no filter in signal path) when their FREQ pot is below
 * kFilterOffThreshold. This ensures zero coloration when the pots are at minimum.
 *
 * Frequency ranges and Q limits are configured in SoftwareConfig.h.
 *
 * Usage pattern:
 *   1. Call setup() once with the audio sample rate.
 *   2. Call setHpf() and setLpf() once per render block (before the sample loop).
 *   3. Call process() once per audio sample.
 */
class FilterSection {
public:
    /** Initialises both filters. Must be called before processing. */
    void setup(float sampleRate);

    /**
     * Updates the HPF state. Call once per render block.
     * @param freqPot  Raw pot value [0.0–1.0]. Below kFilterOffThreshold → HPF bypassed.
     * @param resPot   Raw pot value [0.0–1.0] → mapped linearly to [kFilterQMin, kFilterQMax].
     */
    void setHpf(float freqPot, float resPot);

    /**
     * Updates the LPF state. Call once per render block.
     * @param freqPot  Raw pot value [0.0–1.0]. Below kFilterOffThreshold → LPF bypassed.
     * @param resPot   Raw pot value [0.0–1.0] → mapped linearly to [kFilterQMin, kFilterQMax].
     */
    void setLpf(float freqPot, float resPot);

    /**
     * Process one sample through the active filters (HPF → LPF).
     * Bypassed filters are not in the signal path — no phase coloration when OFF.
     */
    float process(float input);

private:
    float sampleRate_ = 44100.f;

    BiquadFilter hpf_;
    BiquadFilter lpf_;

    // Coefficient tracking: true once the biquad has been computed at least once.
    bool  hpfActive_ = false;
    bool  lpfActive_ = false;

    // Per-sample one-pole mix ramp: 0 = fully dry, 1 = fully wet.
    // Both biquads run at all times so their internal state stays warm;
    // the ramp crossfades dry↔wet to avoid clicks on activation/deactivation.
    float bypassRampCoeff_ = 0.f;
    float hpfMix_    = 0.f;
    float lpfMix_    = 0.f;
    float hpfTarget_ = 0.f;
    float lpfTarget_ = 0.f;

    float lastHpfFreq_ = -1.f; // cached pot values to skip redundant coefficient recalc
    float lastHpfRes_  = -1.f;
    float lastLpfFreq_ = -1.f;
    float lastLpfRes_  = -1.f;

    /** Logarithmic interpolation: maps t ∈ [0,1] to [fMin, fMax] on a log scale. */
    static float logInterp(float fMin, float fMax, float t);

    /** Linear interpolation: maps t ∈ [0,1] to [qMin, qMax]. */
    static float linInterp(float qMin, float qMax, float t);
};
