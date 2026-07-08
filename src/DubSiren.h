#pragma once

/**
 * Monophonic dub siren: phase-accumulator oscillator modulated by an LFO.
 *
 * Eight factory presets are selectable via a pot (0.0–1.0 → 8 positions).
 * The Mod pot interpolates LFO depth between a per-preset minimum (mod=0)
 * and maximum (mod=1), ensuring the siren is always modulated — no pure
 * continuous tone is ever produced. LFO rate follows the same interpolation.
 *
 * A pitch-drop envelope is triggered on each gate rising edge, adding
 * a short downward sweep that decays back to the base pitch.
 *
 * Signal flow (per sample):
 *   gate ramp  ──► amp envelope
 *   LFO        ──► pitch (semitones)
 *   drop env   ──► pitch (semitones)
 *   OSC ──► × amp ──► × gain  ──► dry out
 *              ├──────────────────► × fxSend  ──► fx1 out
 *              └──────────────────► × fxSend2 ──► fx2 out
 *
 * Usage pattern:
 *   1. Call setup() once with the audio sample rate.
 *   2. Call setControls() once per render block (before the sample loop).
 *   3. Call process() once per audio sample → returns the dry gained output.
 *   4. Call fxOut() / fxOut2() after process() to retrieve the FX send samples.
 */
class DubSiren {
public:
    /** Total number of factory presets. */
    static constexpr int kNumPresets = 7;

    /** Initialises oscillator, LFO, and envelope state. */
    void setup(float sampleRate);

    /**
     * Caches all control values for the upcoming render block.
     * A preset change resets oscillator and LFO phases to avoid a click.
     *
     * @param typePot     [0.0–1.0] quantised to one of kNumPresets
     * @param modPot      [0.0–1.0] LFO intensity (depth + rate)
     * @param gainPot     [0.0–1.0] output gain
     * @param fxSendPot   [0.0–1.0] FX send 1 level (pre-gain)
     * @param fxSend2Pot  [0.0–1.0] FX send 2 level (pre-gain)
     * @param gate        true = siren active; false = fade to silence
     */
    void setControls(float typePot, float modPot, float gainPot,
                     float fxSendPot, float fxSend2Pot, bool gate);

    /**
     * Processes one audio sample.
     * @return Siren output with gain applied.
     */
    float process();

    /** Returns the FX send 1 sample for the last process() call. */
    float fxOut()  const { return lastFxOut_;  }

    /** Returns the FX send 2 sample for the last process() call. */
    float fxOut2() const { return lastFxOut2_; }

    /** Returns the name of the currently selected preset (never nullptr). */
    const char* getPresetName() const;

private:
    float sampleRate_     = 44100.f;

    float oscPhase_       = 0.f;  // oscillator phase [0, 1)
    float lfoPhase_       = 0.f;  // LFO phase [0, 1)
    float pitchDropSemi_  = 0.f;  // decaying pitch offset in semitones
    float dropDecayCoeff_ = 0.f;  // per-sample exponential decay for pitch drop
    float gateSmooth_     = 0.f;  // smoothed gate amplitude [0, 1]
    float attackCoeff_    = 0.f;
    float releaseCoeff_   = 0.f;

    bool  prevGate_       = false;
    int   presetIdx_      = -1;   // -1 forces first-run preset load
    float mod_            = 0.f;
    float gain_           = 0.f;
    float fxSend_         = 0.f;
    float fxSend2_        = 0.f;
    bool  gate_           = false;

    float lastFxOut_      = 0.f;
    float lastFxOut2_     = 0.f;

    static float oscSample (int wave,  float phase);
    static float lfoSample (int shape, float phase);
};
