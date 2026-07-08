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
    float       lfoRateMin;       // LFO Hz when mod=0
    float       lfoRateMax;       // LFO Hz when mod=1
    float       lfoDepthMinSemi;  // min LFO depth in semitones at mod=0 (never pure tone)
    float       lfoDepthMaxSemi;  // max LFO depth in semitones at mod=1
    float       dropSemitones;    // pitch drop on gate rising edge
    float       dropDecaySec;     // time for drop to decay to near-zero
};

static constexpr SirenPreset kPresets[DubSiren::kNumPresets] = {
    //  name        freq    osc lfo  rMin   rMax  depMin depMax  drop  decay
    {
        "Wail",
        480.f,
        0,          // sine osc
        0,          // sine lfo
        0.8f,       // rMin
        5.0f,       // rMax
        3.f,        // depMin
        24.f,       // depMax
        3.f,        // drop
        3.6f        // decay
    },
    {
        "Whoop",
        200.f,
        1,          // saw osc
        0,          // sine lfo
        0.5f,       // rMin
        5.0f,       // rMax
        3.f,        // depMin
        48.f,       // depMax
        8.f,        // drop
        1.2f        // decay
    },
    {
        "Police",
        500.f,
        2,          // square osc
        2,          // square lfo
        1.0f,       // rMin
        5.0f,       // rMax
        3.f,        // depMin
        7.f,        // depMax
        0.f,        // drop
        0.f         // decay
    },
    {
        "Scanner",
        620.f,
        1,          // saw osc
        1,          // triangle lfo
        3.0f,       // rMin
        9.0f,       // rMax
        4.f,        // depMin
        14.f,       // depMax
        6.f,        // drop
        0.3f        // decay
    },
    {
        "Spaceship",
        600.f,
        0,          // sine osc
        0,          // sine lfo
        2.0f,       // rMin
        8.0f,       // rMax
        1.f,        // depMin
        5.f,        // depMax
        3.f,        // drop
        0.5f        // decay
    },
    {
        "Riotgun",
        800.f,
        2,          // square osc
        1,          // triangle lfo
        6.0f,       // rMin
        16.0f,      // rMax
        6.f,        // depMin
        20.f,       // depMax
        10.f,       // drop
        0.15f       // decay
    },
    {
        "Laser",
        1000.f,
        2,          // square osc
        2,          // square lfo
        3.0f,       // rMin
        12.0f,      // rMax
        2.f,        // depMin
        8.f,        // depMax
        12.f,       // drop
        0.2f        // decay
    },
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

const char* DubSiren::getPresetName() const {
    int idx = (presetIdx_ >= 0 && presetIdx_ < kNumPresets) ? presetIdx_ : 0;
    return kPresets[idx].name;
}

void DubSiren::setup(float sampleRate) {
    sampleRate_    = sampleRate;
    attackCoeff_   = 1.f - expf(-1.f / (kSirenGateAttackMs  * 0.001f * sampleRate));
    releaseCoeff_  = 1.f - expf(-1.f / (kSirenGateReleaseMs * 0.001f * sampleRate));
    presetIdx_     = -1; // force first-run load
}

void DubSiren::setControls(float typePot, float modPot, float gainPot,
                            float fxSendPot, float fxSend2Pot, bool gate) {
    int newIdx = static_cast<int>(typePot * kNumPresets);
    if(newIdx >= kNumPresets) newIdx = kNumPresets - 1;

    // Hysteresis: only accept a preset change when the pot has moved clearly
    // past the zone boundary, preventing ADC jitter from toggling two presets.
    if(newIdx != presetIdx_ && presetIdx_ >= 0) {
        const float zoneWidth = 1.f / kNumPresets;
        const float boundary  = (newIdx > presetIdx_)
            ? newIdx        * zoneWidth   // rising boundary
            : (newIdx + 1)  * zoneWidth;  // falling boundary
        const bool  cleared   = (newIdx > presetIdx_)
            ? (typePot >= boundary + kSirenPresetHysteresis)
            : (typePot <= boundary - kSirenPresetHysteresis);
        if(!cleared) newIdx = presetIdx_;
    }

    if(newIdx != presetIdx_) {
        // Reset phases on preset change to avoid a click from a stale phase
        oscPhase_  = 0.f;
        lfoPhase_  = 0.f;
        presetIdx_ = newIdx;
        dropDecayCoeff_ = (kPresets[newIdx].dropDecaySec > 0.f)
            ? expf(-1.f / (kPresets[newIdx].dropDecaySec * sampleRate_))
            : 0.f;
    }

    mod_      = modPot;
    gain_     = gainPot;
    fxSend_   = fxSendPot;
    fxSend2_  = fxSend2Pot;
    gate_     = gate;
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
    float depthSemi = p.lfoDepthMinSemi + mod_ * (p.lfoDepthMaxSemi - p.lfoDepthMinSemi);
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
    lastFxOut_   = signal * fxSend_  * kSirenGainScale;
    lastFxOut2_  = signal * fxSend2_ * kSirenGainScale;
    return signal * gain_ * kSirenGainScale;
}
