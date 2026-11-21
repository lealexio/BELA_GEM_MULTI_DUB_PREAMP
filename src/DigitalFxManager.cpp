#include "DigitalFxManager.h"

DigitalFxManager::DigitalFxManager() {
    for (int i = 0; i < kNumSendSources; ++i) {
        auxFx1Dest_[i].store(static_cast<uint8_t>(FxSendDest::Hardware), std::memory_order_relaxed);
        auxFx2Dest_[i].store(static_cast<uint8_t>(FxSendDest::Hardware), std::memory_order_relaxed);
    }
}

void DigitalFxManager::setup(float sampleRate) {
    subRoar_.setup(sampleRate);
    echoDub_.setup(sampleRate);
    tubbySpring_.setup(sampleRate);
    blackArk_.setup(sampleRate);
    tapeDrive_.setup(sampleRate);
    shimmerDelay_.setup(sampleRate);
    dubDucker_.setup(sampleRate);

    subRoarIn_  = 0.f;
    echoDubIn_  = 0.f;
    springIn_   = 0.f;
    phaserIn_   = 0.f;
    tapeIn_     = 0.f;
    shimmerIn_  = 0.f;
}

void DigitalFxManager::setAuxRouting(int srcIdx, int sendIdx, FxSendDest dest) {
    if (srcIdx < 0 || srcIdx >= kNumSendSources) return;
    uint8_t d = static_cast<uint8_t>(dest);
    if (sendIdx == 0) {
        auxFx1Dest_[srcIdx].store(d, std::memory_order_relaxed);
    } else if (sendIdx == 1) {
        auxFx2Dest_[srcIdx].store(d, std::memory_order_relaxed);
    }
}

FxSendDest DigitalFxManager::getAuxRouting(int srcIdx, int sendIdx) const {
    if (srcIdx < 0 || srcIdx >= kNumSendSources) return FxSendDest::Hardware;
    uint8_t d = (sendIdx == 0)
        ? auxFx1Dest_[srcIdx].load(std::memory_order_relaxed)
        : auxFx2Dest_[srcIdx].load(std::memory_order_relaxed);
    return static_cast<FxSendDest>(d);
}
