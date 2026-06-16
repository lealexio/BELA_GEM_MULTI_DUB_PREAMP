#include "DubSiren.h"
#include "SoftwareConfig.h"
#include <cmath>

// ---------------------------------------------------------------------------
// Factory presets
// ---------------------------------------------------------------------------

struct SirenPreset {
    const char* name;
    float       baseFreq;         // Hz
    int         oscWave;          // 0=sine  1=saw  2=square
    int         lfoShape;         // 0=sine  1=triangle  2=square
    float       lfoRateMin;       // LFO Hz when mod=0 (depth will be 0)
    float       lfoRateMax;       // LFO Hz when mod=1
    float       lfoDepthMaxSemi;  // max LFO depth in semitones at mod=1
    float       dropSemitones;    // pitch drop on gate rising edge
    float       dropDecaySec;     // time for drop to decay to near-zero
};

static constexpr SirenPreset kPresets[DubSiren::kNumPresets] = {
    // name         freq   osc lfo  rMin  rMax  dep   drop  decay
    { "Classic",   300.f,  0,  0,  0.5f, 3.0f,  6.f,  4.f, 0.8f },
    { "Whoop",     200.f,  1,  0,  0.3f, 2.0f, 12.f,  8.f, 1.2f },
    { "Police",    500.f,  2,  2,  1.0f, 5.0f,  7.f,  0.f, 0.f  },
    { "Submarine",  80.f,  0,  1,  0.2f, 1.0f,  8.f, 12.f, 2.0f },
    { "Spaceship", 600.f,  0,  0,  2.0f, 8.0f,  5.f,  3.f, 0.5f },
    { "Trumpet",   440.f,  1,  0,  0.5f, 4.0f,  4.f,  6.f, 0.3f },
    { "Ghost",     180.f,  0,  1,  0.1f, 0.8f, 10.f,  6.f, 1.5f },
    { "Laser",    1000.f,  2,  2,  3.0f,12.0f,  8.f, 12.f, 0.2f },
};

// ---------------------------------------------------------------------------
// Waveform helpers
// ---------------------------------------------------------------------------

float DubSiren::oscSample(int wave, float phase) {
    switch(wave) {
        case 1:  return 2.f * phase - 1.f;                          // saw
        case 2:  return phase < 0.5f ? 1.f : -1.f;                  // square
        default: return sinf(2.f * static_cast<float>(M_PI) * phase); // sine
    }
}

float DubSiren::lfoSample(int shape, float phase) {
    switch(shape) {
        case 1:  // triangle
            return phase < 0.5f ? (4.f * phase - 1.f) : (3.f - 4.f * phase);
        case 2:  // square
            return phase < 0.5f ? 1.f : -1.f;
        default: // sine
            return sinf(2.f * static_cast<float>(M_PI) * phase);
    }
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

void DubSiren::setup(float sampleRate) {
    sampleRate_    = sampleRate;
    attackCoeff_   = 1.f - expf(-1.f / (kSirenGateAttackMs  * 0.001f * sampleRate));
    releaseCoeff_  = 1.f - expf(-1.f / (kSirenGateReleaseMs * 0.001f * sampleRate));
    presetIdx_     = -1; // force first-run load
}

void DubSiren::setControls(float typePot, float modPot, float gainPot,
                            float fxSendPot, bool gate) {
    int idx = static_cast<int>(typePot * kNumPresets);
    if(idx >= kNumPresets) idx = kNumPresets - 1;

    if(idx != presetIdx_) {
        // Reset phases on preset change to avoid a click from a stale phase
        oscPhase_  = 0.f;
        lfoPhase_  = 0.f;
        presetIdx_ = idx;
        dropDecayCoeff_ = (kPresets[idx].dropDecaySec > 0.f)
            ? expf(-1.f / (kPresets[idx].dropDecaySec * sampleRate_))
            : 0.f;
    }

    mod_     = modPot;
    gain_    = gainPot;
    fxSend_  = fxSendPot;
    gate_    = gate;
}

float DubSiren::process() {
    const SirenPreset& p = kPresets[presetIdx_ >= 0 ? presetIdx_ : 0];

    // Gate rising edge: retrigger pitch drop
    bool risingEdge = gate_ && !prevGate_;
    if(risingEdge)
        pitchDropSemi_ = p.dropSemitones;
    prevGate_ = gate_;

    // LFO
    float lfoRate = p.lfoRateMin + mod_ * (p.lfoRateMax - p.lfoRateMin);
    float lfoVal  = lfoSample(p.lfoShape, lfoPhase_);
    lfoPhase_ += lfoRate / sampleRate_;
    if(lfoPhase_ >= 1.f) lfoPhase_ -= 1.f;

    // Pitch (semitone offset from LFO + drop envelope)
    float depthSemi = mod_ * p.lfoDepthMaxSemi;
    float pitchSemi = lfoVal * depthSemi + pitchDropSemi_;

    // Oscillator
    float freq = p.baseFreq * powf(2.f, pitchSemi / 12.f);
    float osc  = oscSample(p.oscWave, oscPhase_);
    oscPhase_ += freq / sampleRate_;
    if(oscPhase_ >= 1.f) oscPhase_ -= 1.f;

    // Pitch drop decay
    pitchDropSemi_ *= dropDecayCoeff_;

    // Gate smoothing (one-pole IIR)
    float target = gate_ ? 1.f : 0.f;
    float coeff  = gate_ ? attackCoeff_ : releaseCoeff_;
    gateSmooth_ += coeff * (target - gateSmooth_);

    float signal = osc * gateSmooth_;
    lastFxOut_   = signal * fxSend_;
    return signal * gain_;
}
