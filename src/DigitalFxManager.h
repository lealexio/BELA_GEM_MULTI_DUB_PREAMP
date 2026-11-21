#pragma once
#include <atomic>
#include "HardwareConfig.h"
#include "SoftwareConfig.h"
#include "SubRoar.h"
#include "EchuDub.h"
#include "TubbySpring.h"
#include "BlackArkPhaser.h"

/**
 * DigitalFxManager — multi-effects router and engine orchestrator.
 *
 * Responsibilities:
 *   1. Manages dynamic routing destinations for channel sends (AUX 1–4, Send 1 & Send 2).
 *   2. Diverts audio sends from physical outputs to digital effects (SUB ROAR, ECHU DUB,
 *      TUBBY SPRING, BLACK ARK PHASER).
 *   3. Processes active digital DSP effects on each audio frame.
 *   4. Returns the summed wet audio signal to be mixed into the master bus.
 *
 * Strict Xenomai RT guarantees: zero heap allocations in audio thread,
 * atomic destination state, preallocated static buffers.
 */
class DigitalFxManager {
public:
    DigitalFxManager();

    /** Initialises all digital FX at the given audio sample rate. */
    void setup(float sampleRate);

    /**
     * Sets the destination for an AUX send.
     * @param auxIdx   AUX channel index (0..kNumAuxChannels-1)
     * @param sendIdx  Send index (0 = FX1 Send, 1 = FX2 Send)
     * @param dest     Routing destination (Hardware, SubRoar, EchuDub, TubbySpring, BlackArk, Mute)
     */
    void setAuxRouting(int auxIdx, int sendIdx, FxSendDest dest);

    /** Returns current routing destination for an AUX send. */
    FxSendDest getAuxRouting(int auxIdx, int sendIdx) const;

    /**
     * Routes an AUX Send 1 sample:
     * If destination is Hardware, adds to hwSumOut.
     * If destination is digital, diverts to internal effect accumulator.
     */
    inline void routeAux1Send(int auxIdx, float sendSample, float &hwSumOut) {
        FxSendDest dest = static_cast<FxSendDest>(auxFx1Dest_[auxIdx].load(std::memory_order_relaxed));
        switch (dest) {
            case FxSendDest::Hardware:    hwSumOut += sendSample; break;
            case FxSendDest::SubRoar:     subRoarIn_ += sendSample; break;
            case FxSendDest::EchuDub:     echuDubIn_ += sendSample; break;
            case FxSendDest::TubbySpring: springIn_ += sendSample; break;
            case FxSendDest::BlackArk:    phaserIn_ += sendSample; break;
            case FxSendDest::Mute:
            default: break;
        }
    }

    /**
     * Routes an AUX Send 2 sample:
     * If destination is Hardware, adds to hwSumOut.
     * If destination is digital, diverts to internal effect accumulator.
     */
    inline void routeAux2Send(int auxIdx, float sendSample, float &hwSumOut) {
        FxSendDest dest = static_cast<FxSendDest>(auxFx2Dest_[auxIdx].load(std::memory_order_relaxed));
        switch (dest) {
            case FxSendDest::Hardware:    hwSumOut += sendSample; break;
            case FxSendDest::SubRoar:     subRoarIn_ += sendSample; break;
            case FxSendDest::EchuDub:     echuDubIn_ += sendSample; break;
            case FxSendDest::TubbySpring: springIn_ += sendSample; break;
            case FxSendDest::BlackArk:    phaserIn_ += sendSample; break;
            case FxSendDest::Mute:
            default: break;
        }
    }

    /**
     * Processes one audio frame through the active digital effects.
     * Clears input accumulators and returns the wet return sum for the master bus.
     */
    inline float process() {
        float outSub    = subRoar_.process(subRoarIn_);
        float outDub    = echuDub_.process(echuDubIn_);
        float outSpring = tubbySpring_.process(springIn_);
        float outPhaser = blackArk_.process(phaserIn_);

        subRoarIn_ = 0.f;
        echuDubIn_ = 0.f;
        springIn_  = 0.f;
        phaserIn_  = 0.f;

        return outSub + outDub + outSpring + outPhaser;
    }

    /** Accessors for individual effects */
    SubRoar& subRoar() { return subRoar_; }
    EchuDub& echuDub() { return echuDub_; }
    TubbySpring& tubbySpring() { return tubbySpring_; }
    BlackArkPhaser& blackArk() { return blackArk_; }

private:
    SubRoar subRoar_;
    EchuDub echuDub_;
    TubbySpring tubbySpring_;
    BlackArkPhaser blackArk_;

    // Per-channel send destination (atomic uint8_t for safe lock-free UI mutation)
    std::atomic<uint8_t> auxFx1Dest_[kNumAuxChannels];
    std::atomic<uint8_t> auxFx2Dest_[kNumAuxChannels];

    // Audio-thread per-sample input accumulators
    float subRoarIn_ = 0.f;
    float echuDubIn_ = 0.f;
    float springIn_  = 0.f;
    float phaserIn_  = 0.f;
};
