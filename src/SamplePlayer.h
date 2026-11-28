#pragma once

#include <atomic>
#include <vector>
#include "SoftwareConfig.h"

/**
 * Monophonic one-shot sample player mixed at the Dub Siren bus point.
 *
 * Loads WAV/MP3 from samples/ at setup via Bela AudioFileUtilities
 * (full decode into RAM for RT-safe one-shot playback / retrigger).
 * Playback is triggered from the GUI only; hardware siren gate is ignored.
 * Gain and FX send levels are supplied externally (typically SIREN_* pots).
 *
 * Signal flow (per sample):
 *   buffer[readPtr] ──► × fade ──► × gain × kSamplerGainScale ──► dry
 *                                                         ├─────► × fxSend  ──► fx1
 *                                                         └─────► × fxSend2 ──► fx2
 *
 * Usage:
 *   1. Call setup() once with sample rate and project name.
 *   2. Call setControls() once per render block.
 *   3. Call trigger(slot) from the GUI control thread (atomic).
 *   4. Call process() per audio sample; then fxOut() / fxOut2().
 */
class SamplePlayer {
public:
    /** Scans samples/, loads audio via AudioFileUtilities (stereo→mono). */
    void setup(float sampleRate, const char* projectName);

    /**
     * Caches gain / FX send levels for the upcoming render block.
     * @param gainPot   [0–1] output gain (shared with siren)
     * @param fxSendPot [0–1] FX send 1 level (post-gain)
     * @param fxSend2Pot [0–1] FX send 2 level (post-gain)
     */
    void setControls(float gainPot, float fxSendPot, float fxSend2Pot);

    /**
     * Arms playback of slot from the start (retrigger). Safe from any thread.
     * @param slot zero-based index into the loaded sample list
     */
    void trigger(int slot);

    /** Stops currently playing sample with a click-free fade-out. Safe from any thread. */
    void stop();

    /** Sets per-slot loop flag, gain [0..1.5], and pitch in semitones [-12..+12]. */
    void setSlotParams(int slot, bool loop, float gain, float pitchSt);

    /**
     * Reloads samples from disk into the standby bank and queues a lock-free
     * atomic bank swap for the audio thread. Call ONLY from a non-RT thread.
     * Returns true if new bank was queued.
     */
    bool reloadFromDisk();

    /** Returns true once when a bank reload just completed on the audio thread. */
    bool consumeBankReloaded();

    /** Returns the resolved samples directory path (populated at setup). */
    const char* samplesDir() const { return samplesDir_; }

    /**
     * Processes one audio sample.
     * @return Dry output with gain applied (0 when idle).
     */
    float process();

    /** Returns the FX send 1 sample for the last process() call. */
    float fxOut()  const { return lastFxOut_;  }

    /** Returns the FX send 2 sample for the last process() call. */
    float fxOut2() const { return lastFxOut2_; }

    /** True when the samples/ directory was found at setup. */
    bool folderOk() const { return banks_[activeBank_].folderOk; }

    /** Number of successfully loaded samples. */
    int sampleCount() const { return banks_[activeBank_].count; }

    /** Filename for slot (empty string if out of range). */
    const char* sampleName(int slot) const;

    /** Currently playing slot, or -1 when idle. */
    int playingSlot() const { return playing_ ? activeSlot_ : -1; }

    /** True while a sample is actively sounding. */
    bool isPlaying() const { return playing_; }

    /** Normalised playhead [0–1], or 0 when idle. */
    float playhead() const;

private:
    float sampleRate_   = kDefaultSampleRate;
    float gain_         = 0.f;
    float fxSend_       = 0.f;
    float fxSend2_      = 0.f;

    float fade_         = 0.f;
    float fadeStep_     = 0.f;  // per-sample linear fade increment
    int   fadeSamples_  = 1;    // cached fade length in samples
    bool  fadingOut_    = false;

    float lastFxOut_    = 0.f;
    float lastFxOut2_   = 0.f;

    struct SampleBank {
        std::vector<float> buffers[kMaxSamples];
        char names[kMaxSamples][kMaxSampleNameLen];
        bool folderOk = false;
        int  count    = 0;
    };

    SampleBank banks_[2];
    int        activeBank_ = 0;
    char       projectName_[128] = {};
    char       samplesDir_[512]  = {};

    int    activeSlot_  = -1;
    double readPtrF_    = 0.0;
    bool   playing_     = false;

    /// Per-slot playback settings (lock-free atomic arrays)
    std::atomic<bool>  slotLoop_[kMaxSamples];
    std::atomic<float> slotGain_[kMaxSamples];
    std::atomic<float> slotPitchSt_[kMaxSamples];

    /// Written by GUI/non-RT thread; consumed in process(). -1 = none pending.
    std::atomic<int>  pendingTrigger_{-1};
    std::atomic<bool> stopPending_{false};
    std::atomic<int>  pendingBank_{-1};
    std::atomic<int>  audioActiveBank_{0};
    std::atomic<bool> reloading_{false};
    bool              bankReloadedFlag_ = false;

    bool loadBankFromDisk(SampleBank& bank);
};
