#include "DigitalFxManager.h"

DigitalFxManager::DigitalFxManager() {
    for (int i = 0; i < kNumAuxChannels; ++i) {
        auxFx1Dest_[i].store(static_cast<uint8_t>(FxSendDest::Hardware), std::memory_order_relaxed);
        auxFx2Dest_[i].store(static_cast<uint8_t>(FxSendDest::Hardware), std::memory_order_relaxed);
    }
}

void DigitalFxManager::setup(float sampleRate) {
    subRoar_.setup(sampleRate);
    echuDub_.setup(sampleRate);
    tubbySpring_.setup(sampleRate);
    blackArk_.setup(sampleRate);

    subRoarIn_ = 0.f;
    echuDubIn_ = 0.f;
    springIn_  = 0.f;
    phaserIn_  = 0.f;
}

void DigitalFxManager::setAuxRouting(int auxIdx, int sendIdx, FxSendDest dest) {
    if (auxIdx < 0 || auxIdx >= kNumAuxChannels) return;
    uint8_t d = static_cast<uint8_t>(dest);
    if (sendIdx == 0) {
        auxFx1Dest_[auxIdx].store(d, std::memory_order_relaxed);
    } else if (sendIdx == 1) {
        auxFx2Dest_[auxIdx].store(d, std::memory_order_relaxed);
    }
}

FxSendDest DigitalFxManager::getAuxRouting(int auxIdx, int sendIdx) const {
    if (auxIdx < 0 || auxIdx >= kNumAuxChannels) return FxSendDest::Hardware;
    uint8_t d = (sendIdx == 0)
        ? auxFx1Dest_[auxIdx].load(std::memory_order_relaxed)
        : auxFx2Dest_[auxIdx].load(std::memory_order_relaxed);
    return static_cast<FxSendDest>(d);
}
