#include "DubSiren.h"
#include "SoftwareConfig.h"
#include <cmath>

// ---------------------------------------------------------------------------
// Factory presets
// ---------------------------------------------------------------------------

struct SirenPreset {
  const char *name;
  float baseFreq;   // Hz
  int oscWave;      // 0=sine  1=saw  2=square
  int lfoShape;     // 0=sine  1=triangle  2=square  3=rampUp  4=rampDown
  float lfoRateMin; // LFO Hz when mod=0
  float lfoRateMax; // LFO Hz when mod=1
  float
      lfoDepthMinSemi; // min LFO depth in semitones at mod=0 (never pure tone)
  float lfoDepthMaxSemi; // max LFO depth in semitones at mod=1
  float dropSemitones;   // pitch drop on gate rising edge
  float dropDecaySec;    // time for drop to decay to near-zero
};

static constexpr SirenPreset kPresets[DubSiren::kNumPresets] = {
    //  name        freq    osc lfo  rMin   rMax  depMin depMax  drop  decay
    {
        "NJD BipBoop", // 2-tons UK Roots (quarte -> quinte)
        580.f,
        2,    // square osc
        2,    // square lfo
        1.2f, // rMin
        7.5f, // rMax
        5.f,  // depMin (quarte juste)
        7.f,  // depMax (quinte juste)
        0.f,  // drop
        0.f   // decay
    },
    {
        "NJD Wail", // Sirène balayage Triangle + montée condensateur au trigger
        440.f,
        2,    // square osc
        1,    // triangle lfo
        0.4f, // rMin
        4.5f, // rMax
        6.f,  // depMin
        19.f, // depMax
        -7.f, // drop négatif = attaque basse qui monte vers baseFreq
        0.9f  // decay
    },
    {
        "NJD Yelp", // Ramp Up : montée pure en boucle (classique NJD SE1)
        480.f,
        2,    // square osc
        3,    // rampUp lfo
        0.8f, // rMin
        6.0f, // rMax
        7.f,  // depMin
        17.f, // depMax
        0.f,  // drop
        0.f   // decay
    },
    {
        "NJD Bubble", // Trille liquide rapide pour envoi Spring Reverb / Delay
        660.f,
        2,     // square osc
        0,     // sine lfo
        5.0f,  // rMin
        14.0f, // rMax
        2.f,   // depMin
        12.f,  // depMax
        7.f,   // drop
        0.25f  // decay
    },
    {
        "King Tubby", // Générateur BF studio 70s (onde pure + gros sweep)
        520.f,
        0,    // sine osc
        1,    // triangle lfo
        0.6f, // rMin
        6.0f, // rMax
        4.f,  // depMin
        24.f, // depMax
        12.f, // drop
        0.8f  // decay
    },
    {
        "Lickshot", // Ramp Down : laser / salve descendante répétée
        880.f,
        2,     // square osc
        4,     // rampDown lfo
        2.5f,  // rMin
        12.0f, // rMax
        8.f,   // depMin
        24.f,  // depMax
        12.f,  // drop
        0.18f  // decay
    },
};

// ---------------------------------------------------------------------------
// Waveform helpers
// ---------------------------------------------------------------------------

float DubSiren::oscSample(int wave, float phase) {
  switch (wave) {
  case 1:
    return 2.f * phase - 1.f; // saw
  case 2:
    return phase < 0.5f ? 1.f : -1.f; // square
  default:
    return sinf(2.f * static_cast<float>(M_PI) * phase); // sine
  }
}

float DubSiren::lfoSample(int shape, float phase) {
  switch (shape) {
  case 1: // triangle
    return phase < 0.5f ? (4.f * phase - 1.f) : (3.f - 4.f * phase);
  case 2: // square
    return phase < 0.5f ? 1.f : -1.f;
  case 3: // ramp up (NJD rising sweep: -1 to +1)
    return 2.f * phase - 1.f;
  case 4: // ramp down (NJD falling laser: +1 to -1)
    return 1.f - 2.f * phase;
  default: // sine
    return sinf(2.f * static_cast<float>(M_PI) * phase);
  }
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

const char *DubSiren::getPresetName() const {
  int idx = (presetIdx_ >= 0 && presetIdx_ < kNumPresets) ? presetIdx_ : 0;
  return kPresets[idx].name;
}

void DubSiren::setup(float sampleRate) {
  sampleRate_ = sampleRate;
  attackCoeff_ = 1.f - expf(-1.f / (kSirenGateAttackMs * 0.001f * sampleRate));
  releaseCoeff_ =
      1.f - expf(-1.f / (kSirenGateReleaseMs * 0.001f * sampleRate));
  crossfadeStep_ = 1.f / (kSirenPresetCrossfadeMs * 0.001f * sampleRate);
  lpfCoeff_ = 1.f - expf(-2.f * static_cast<float>(M_PI) * 2800.f / sampleRate);
  lpfState_ = 0.f;
  presetIdx_ = -1; // force first-run load
}

void DubSiren::setControls(float typePot, float modPot, float gainPot,
                           float fxSendPot, float fxSend2Pot, bool gate) {
  int newIdx = static_cast<int>(typePot * kNumPresets);
  if (newIdx >= kNumPresets)
    newIdx = kNumPresets - 1;

  // Hysteresis: only accept a preset change when the pot has moved clearly
  // past the zone boundary, preventing ADC jitter from toggling two presets.
  if (newIdx != presetIdx_ && presetIdx_ >= 0) {
    const float zoneWidth = 1.f / kNumPresets;
    const float boundary = (newIdx > presetIdx_)
                               ? newIdx * zoneWidth        // rising boundary
                               : (newIdx + 1) * zoneWidth; // falling boundary
    const bool cleared = (newIdx > presetIdx_)
                             ? (typePot >= boundary + kSirenPresetHysteresis)
                             : (typePot <= boundary - kSirenPresetHysteresis);
    if (!cleared)
      newIdx = presetIdx_;
  }

  if (newIdx != presetIdx_) {
    if (presetIdx_ >= 0) {
      // Snapshot current oscillator state so it can keep running during
      // crossfade
      prevPresetIdx_ = presetIdx_;
      prevOscPhase_ = oscPhase_;
      prevLfoPhase_ = lfoPhase_;
      prevPitchDropSemi_ = pitchDropSemi_;
      prevDropDecayCoeff_ = dropDecayCoeff_;
      crossfade_ = 0.f; // restart crossfade from old preset
    }
    // New preset starts from continuous phase (no hard reset → no click)
    presetIdx_ = newIdx;
    dropDecayCoeff_ =
        (kPresets[newIdx].dropDecaySec > 0.f)
            ? expf(-1.f / (kPresets[newIdx].dropDecaySec * sampleRate_))
            : 0.f;
  }

  mod_ = modPot;
  gain_ = gainPot;
  fxSend_ = fxSendPot;
  fxSend2_ = fxSend2Pot;
  gate_ = gate;
}

float DubSiren::process() {
  const SirenPreset &p = kPresets[presetIdx_ >= 0 ? presetIdx_ : 0];

  // Gate rising edge: retrigger pitch drop and sync LFO start phase
  bool risingEdge = gate_ && !prevGate_;
  if (risingEdge) {
    pitchDropSemi_ = p.dropSemitones;
    lfoPhase_ = 0.f;
  }
  prevGate_ = gate_;

  // --- New preset oscillator ---
  float lfoRate = p.lfoRateMin + mod_ * (p.lfoRateMax - p.lfoRateMin);
  float lfoVal = lfoSample(p.lfoShape, lfoPhase_);
  lfoPhase_ += lfoRate / sampleRate_;
  if (lfoPhase_ >= 1.f)
    lfoPhase_ -= 1.f;

  float depthSemi =
      p.lfoDepthMinSemi + mod_ * (p.lfoDepthMaxSemi - p.lfoDepthMinSemi);
  float pitchSemi = lfoVal * depthSemi + pitchDropSemi_;
  float freq = p.baseFreq * powf(2.f, pitchSemi / 12.f);
  float osc = oscSample(p.oscWave, oscPhase_);
  oscPhase_ += freq / sampleRate_;
  if (oscPhase_ >= 1.f)
    oscPhase_ -= 1.f;
  pitchDropSemi_ *= dropDecayCoeff_;

  float signal;
  if (crossfade_ < 1.f) {
    // --- Previous preset oscillator (fading out) ---
    const SirenPreset &prev = kPresets[prevPresetIdx_];
    float prevLfoRate =
        prev.lfoRateMin + mod_ * (prev.lfoRateMax - prev.lfoRateMin);
    float prevLfoVal = lfoSample(prev.lfoShape, prevLfoPhase_);
    prevLfoPhase_ += prevLfoRate / sampleRate_;
    if (prevLfoPhase_ >= 1.f)
      prevLfoPhase_ -= 1.f;

    float prevDepth = prev.lfoDepthMinSemi +
                      mod_ * (prev.lfoDepthMaxSemi - prev.lfoDepthMinSemi);
    float prevPitch = prevLfoVal * prevDepth + prevPitchDropSemi_;
    float prevFreq = prev.baseFreq * powf(2.f, prevPitch / 12.f);
    float prevOsc = oscSample(prev.oscWave, prevOscPhase_);
    prevOscPhase_ += prevFreq / sampleRate_;
    if (prevOscPhase_ >= 1.f)
      prevOscPhase_ -= 1.f;
    prevPitchDropSemi_ *= prevDropDecayCoeff_;

    // Linear crossfade: old fades out, new fades in
    signal = prevOsc * (1.f - crossfade_) + osc * crossfade_;
    crossfade_ += crossfadeStep_;
    if (crossfade_ > 1.f)
      crossfade_ = 1.f;
  } else {
    signal = osc;
  }

  // Analog-style one-pole low-pass filter (~2.8 kHz) to tame harsh square edges
  lpfState_ += lpfCoeff_ * (signal - lpfState_);
  signal = lpfState_;

  // Gate smoothing (one-pole IIR) — applied to the final mixed signal
  float target = gate_ ? 1.f : 0.f;
  float coeff = gate_ ? attackCoeff_ : releaseCoeff_;
  gateSmooth_ += coeff * (target - gateSmooth_);
  signal *= gateSmooth_;

  // Post-fader FX sends: gain_ scales dry and send together (same as
  // ChannelStrip).
  float dry = signal * gain_ * kSirenGainScale;
  lastFxOut_ = dry * fxSend_;
  lastFxOut2_ = dry * fxSend2_;
  return dry;
}