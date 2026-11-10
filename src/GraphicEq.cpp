#include "GraphicEq.h"
#include "DspUtils.h"
#include "SoftwareConfig.h"

/** Fixed centre frequencies — index matches band order 0 = 40 Hz, 11 = 16 kHz. */
static constexpr float kBandFreqs[GraphicEq::kNumBands] = {
    40.f, 60.f, 80.f, 100.f, 125.f, 250.f,
    500.f, 1000.f, 2000.f, 4000.f, 8000.f, 16000.f
};

void GraphicEq::setup(float sampleRate) {
    sampleRate_      = sampleRate;
    gainSmoothCoeff_ = onePoleLpCoeff(kEqGainSmoothMs, sampleRate);
    for(int i = 0; i < kNumBands; ++i) {
        targetGainDb_[i] = smoothGainDb_[i] = lastGainDb_[i] = 0.f;
        filters_[i].setPeaking(kBandFreqs[i], 0.f, kGEqQ, sampleRate_);
        filters_[i].reset();
    }
}

void GraphicEq::setBandGainDb(int band, float gainDb) {
    if(band < 0 || band >= kNumBands) return;
    targetGainDb_[band] = gainDb; // smoother advances in process()
}

float GraphicEq::process(float input) {
    // All 12 filters run unconditionally so their internal state (x1/x2/y1/y2)
    // stays warm even when a band is near 0 dB. This avoids a click when the
    // band is re-engaged after being bypassed — same pattern as FilterSection.
    // The coefficient at 0 dB is transparent (b0=1, b1=b2=a1=a2=0 after the
    // peaking formula with gainDb=0), so running a flat band costs only the
    // biquad multiply-adds with no audible effect.
    float out = input;
    for(int i = 0; i < kNumBands; ++i) {
        smoothGainDb_[i] += gainSmoothCoeff_ * (targetGainDb_[i] - smoothGainDb_[i]);

        if(fabsf(smoothGainDb_[i] - lastGainDb_[i]) > kEqGainEpsilonDb) {
            filters_[i].setPeaking(kBandFreqs[i], smoothGainDb_[i], kGEqQ, sampleRate_);
            lastGainDb_[i] = smoothGainDb_[i];
        }

        out = filters_[i].process(out);
    }
    return out;
}
