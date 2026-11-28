#pragma once
#include <atomic>
#include "HardwareConfig.h"
#include "SoftwareConfig.h"
#include "SubRoar.h"
#include "EchoDub.h"
#include "TubbySpring.h"
#include "BlackArkPhaser.h"
#include "TapeDrive.h"
#include "ShimmerDelay.h"
#include "DubDucker.h"

/**
 * DigitalFxManager — multi-effects router and engine orchestrator.
 *
 * Responsibilities:
 *   1. Manages dynamic routing destinations for channel sends (AUX 1–4 and DUB SIREN).
 *   2. Diverts audio sends from physical outputs to internal digital effects.
 *   3. Processes active digital DSP effects on each audio frame.
 *   4. Automatic sidechain ducking of time-based effect returns (Echo, Spring, Shimmer).
 *   5. Returns the summed wet audio signal to be mixed into the master bus.
 *
 * Strict Xenomai RT guarantees: zero heap allocations in audio thread,
 * atomic destination state, preallocated static buffers.
 */
class DigitalFxManager {
public:
    /// Total routing send sources: 0..3 = AUX 1..4, 4 = DUB SIREN
    static constexpr int kNumSendSources = 5;

    DigitalFxManager();

    /** Initialises all digital FX at the given audio sample rate. */
    void setup(float sampleRate);

    /**
     * Sets the destination for an audio send.
     * @param srcIdx   Source index (0..3 = AUX 1..4, 4 = DUB SIREN)
     * @param sendIdx  Send index (0 = FX1 Send, 1 = FX2 Send)
     * @param dest     Routing destination enum
     */
    void setAuxRouting(int srcIdx, int sendIdx, FxSendDest dest);

    /** Returns current routing destination for an audio send. */
    FxSendDest getAuxRouting(int srcIdx, int sendIdx) const;

    /**
     * Routes an FX Send 1 sample:
     * If destination is Hardware, adds to hwSumOut.
     * If destination is digital, diverts to internal effect accumulator.
     */
    inline void routeAux1Send(int srcIdx, float sendSample, float &hwSumOut) {
        if (srcIdx < 0 || srcIdx >= kNumSendSources) return;
        FxSendDest dest = static_cast<FxSendDest>(auxFx1Dest_[srcIdx].load(std::memory_order_relaxed));
        switch (dest) {
            case FxSendDest::Hardware:     hwSumOut += sendSample; break;
            case FxSendDest::SubRoar:      subRoarIn_ += sendSample; break;
            case FxSendDest::EchoDub:      echoDubIn_ += sendSample; break;
            case FxSendDest::TubbySpring:  springIn_ += sendSample; break;
            case FxSendDest::BlackArk:     phaserIn_ += sendSample; break;
            case FxSendDest::TapeDrive:    tapeIn_ += sendSample; break;
            case FxSendDest::ShimmerDelay: shimmerIn_ += sendSample; break;
            case FxSendDest::Mute:
            default: break;
        }
    }

    /**
     * Routes an FX Send 2 sample:
     * If destination is Hardware, adds to hwSumOut.
     * If destination is digital, diverts to internal effect accumulator.
     */
    inline void routeAux2Send(int srcIdx, float sendSample, float &hwSumOut) {
        if (srcIdx < 0 || srcIdx >= kNumSendSources) return;
        FxSendDest dest = static_cast<FxSendDest>(auxFx2Dest_[srcIdx].load(std::memory_order_relaxed));
        switch (dest) {
            case FxSendDest::Hardware:     hwSumOut += sendSample; break;
            case FxSendDest::SubRoar:      subRoarIn_ += sendSample; break;
            case FxSendDest::EchoDub:      echoDubIn_ += sendSample; break;
            case FxSendDest::TubbySpring:  springIn_ += sendSample; break;
            case FxSendDest::BlackArk:     phaserIn_ += sendSample; break;
            case FxSendDest::TapeDrive:    tapeIn_ += sendSample; break;
            case FxSendDest::ShimmerDelay: shimmerIn_ += sendSample; break;
            case FxSendDest::Mute:
            default: break;
        }
    }

    /** Sets series send amount from EchoDub output into TubbySpring input [0..1]. */
    void setEchoToSpring(float amt) {
        echoToSpring_.store(clamp(amt, 0.f, 1.f), std::memory_order_relaxed);
    }
    float getEchoToSpring() const { return echoToSpring_.load(std::memory_order_relaxed); }

    /** Sets series send amount from TapeDrive output into EchoDub input [0..1]. */
    void setTapeToEcho(float amt) {
        tapeToEcho_.store(clamp(amt, 0.f, 1.f), std::memory_order_relaxed);
    }
    float getTapeToEcho() const { return tapeToEcho_.load(std::memory_order_relaxed); }

    /**
     * Processes one audio frame through the active digital effects into stereo L/R.
     * Supports TapeDrive -> EchoDub and EchoDub -> TubbySpring series chaining,
     * plus stereo Ping-Pong EchoDub output.
     */
    inline void processStereo(float &outL, float &outR) {
        const float tapeToEcho   = tapeToEcho_.load(std::memory_order_relaxed);
        const float echoToSpring = echoToSpring_.load(std::memory_order_relaxed);

        float outTape = tapeDrive_.process(tapeIn_);

        float echoL = 0.f, echoR = 0.f;
        echoDub_.processStereo(echoDubIn_ + outTape * tapeToEcho, echoL, echoR);
        float echoMono = 0.5f * (echoL + echoR);

        float outSpring  = tubbySpring_.process(springIn_ + echoMono * echoToSpring);
        float outSub     = subRoar_.process(subRoarIn_);
        float outPhaser  = blackArk_.process(phaserIn_);
        float outShimmer = shimmerDelay_.process(shimmerIn_);

        // Apply automatic sidechain ducker attenuation to time-based returns
        float duckGain = dubDucker_.getDuckGain();
        echoL      *= duckGain;
        echoR      *= duckGain;
        outSpring  *= duckGain;
        outShimmer *= duckGain;

        subRoarIn_  = 0.f;
        echoDubIn_  = 0.f;
        springIn_   = 0.f;
        phaserIn_   = 0.f;
        tapeIn_     = 0.f;
        shimmerIn_  = 0.f;

        const float monoSum = outSub + outSpring + outPhaser + outTape + outShimmer;
        outL = monoSum + echoL;
        outR = monoSum + echoR;
    }

    /**
     * Processes one audio frame through the active digital effects (mono sum).
     * Clears input accumulators and returns the wet return sum for the master bus.
     */
    inline float process() {
        float l = 0.f, r = 0.f;
        processStereo(l, r);
        return 0.5f * (l + r);
    }

    /** Accessors for individual effects */
    SubRoar& subRoar() { return subRoar_; }
    EchoDub& echoDub() { return echoDub_; }
    EchoDub& echuDub() { return echoDub_; }
    TubbySpring& tubbySpring() { return tubbySpring_; }
    BlackArkPhaser& blackArk() { return blackArk_; }
    TapeDrive& tapeDrive() { return tapeDrive_; }
    ShimmerDelay& shimmerDelay() { return shimmerDelay_; }
    DubDucker& ducker() { return dubDucker_; }

private:
    SubRoar subRoar_;
    EchoDub echoDub_;
    TubbySpring tubbySpring_;
    BlackArkPhaser blackArk_;
    TapeDrive tapeDrive_;
    ShimmerDelay shimmerDelay_;
    DubDucker dubDucker_;

    // Per-channel send destination (atomic uint8_t for safe lock-free UI mutation)
    std::atomic<uint8_t> auxFx1Dest_[kNumSendSources];
    std::atomic<uint8_t> auxFx2Dest_[kNumSendSources];

    // Series FX chaining amounts
    std::atomic<float> echoToSpring_{kFxChainEchoToSpringDefault};
    std::atomic<float> tapeToEcho_{kFxChainTapeToEchoDefault};

    // Audio-thread per-sample input accumulators
    float subRoarIn_  = 0.f;
    float echoDubIn_  = 0.f;
    float springIn_   = 0.f;
    float phaserIn_   = 0.f;
    float tapeIn_     = 0.f;
    float shimmerIn_  = 0.f;
};
