#include "HardwareManager.h"
#include "SoftwareConfig.h"
#include <cmath>
#include <algorithm>
#include <fcntl.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <linux/i2c-dev.h>

// MCP23017 register addresses (BANK=0, default)
static constexpr uint8_t MCP_IODIRA = 0x00; // I/O direction port A (1=input)
static constexpr uint8_t MCP_IODIRB = 0x01; // I/O direction port B (1=input)
static constexpr uint8_t MCP_GPPUA  = 0x0C; // Pull-up resistors port A
static constexpr uint8_t MCP_GPPUB  = 0x0D; // Pull-up resistors port B
static constexpr uint8_t MCP_GPIOA  = 0x12; // GPIO read port A
static constexpr uint8_t MCP_GPIOB  = 0x13; // GPIO read port B

// Required for constexpr static array members (ODR-used)
constexpr int HardwareManager::addressPins_[4];

HardwareManager::HardwareManager() {
    for(int i = 0; i < kNumMux * kPotsPerMux; i++) potValues_[i] = 0.f;
    currentChannel_ = 0;
    sampleCount_    = 0;
}

HardwareManager::~HardwareManager() {
    closeMcp23017();
}

bool HardwareManager::setup(BelaContext* context) {
    if(context->analogInChannels < (unsigned int)kActiveMux) {
        rt_printf("HardwareManager: WARNING: only %u analog input channels active, but kActiveMux is %d!\n",
                  context->analogInChannels, kActiveMux);
        rt_printf("                          Enable at least %d analog inputs in Bela IDE Project Settings (or pass -C 8).\n",
                  kActiveMux);
    }

    for(int i = 0; i < 4; i++) {
        pinMode(context, 0, addressPins_[i], OUTPUT);
    }
    currentChannel_ = 0;
    sampleCount_    = 0;

    rt_printf("HardwareManager: %d multiplexers configured (%d channels each, S0..S3 on D0..D3)\n",
              kActiveMux, kPotsPerMux);
    return true;
}

void HardwareManager::scanStep(BelaContext* context) {
    if(context->analogFrames == 0 || context->analogInChannels < 1) return;
    int analogFrameRatio = context->audioFrames / context->analogFrames;
    if(analogFrameRatio <= 0) analogFrameRatio = 1;

    unsigned int numFrames = context->audioFrames;
    if(context->digitalFrames > 0 && context->digitalFrames < numFrames)
        numFrames = context->digitalFrames;

    for(unsigned int n = 0; n < numFrames; n++) {
        // Continuous driving of address lines S0..S3 with the current channel (0..9)
        digitalWriteOnce(context, n, addressPins_[0], (currentChannel_ >> 0) & 1);
        digitalWriteOnce(context, n, addressPins_[1], (currentChannel_ >> 1) & 1);
        digitalWriteOnce(context, n, addressPins_[2], (currentChannel_ >> 2) & 1);
        digitalWriteOnce(context, n, addressPins_[3], (currentChannel_ >> 3) & 1);

        sampleCount_++;

        // Leave 16 audio frames (~0.36 ms) for the multiplexers to settle voltage
        if(sampleCount_ >= 16 && (n % analogFrameRatio == 0)) {
            unsigned int analogFrame = n / analogFrameRatio;
            if(analogFrame >= context->analogFrames)
                analogFrame = context->analogFrames - 1;

            for(int m = 0; m < kActiveMux && m < (int)context->analogInChannels; m++) {
                float raw = analogRead(context, analogFrame, m) * kPotScaleRecovery;

                // Clamp with calibrated min/max
                if(raw <= kPotMin) raw = 0.f;
                raw = raw / kPotMax;
                if(raw > 1.f) raw = 1.f;

                // Snap to hard 0 / 1 at the ends of travel
                if(raw <= kSnapRadiusEdge)            raw = 0.f;
                else if(raw >= 1.f - kSnapRadiusEdge) raw = 1.f;

                int idx = m * kPotsPerMux + currentChannel_;
                if(fabsf(raw - potValues_[idx]) >= kJitterThreshold)
                    potValues_[idx] = raw;
            }

            // Advance to next channel (0 to kPotsPerMux - 1)
            currentChannel_ = (currentChannel_ + 1) % kPotsPerMux;
            sampleCount_ = 0;
        }
    }
}

float HardwareManager::getPotValue(int muxId, int potId) const {
    if(muxId < 0 || muxId >= kNumMux || potId < 0 || potId >= kPotsPerMux)
        return 0.f;
    return potValues_[muxId * kPotsPerMux + potId];
}

float HardwareManager::getCenteredPotValue(int muxId, int potId) const {
    float v = getPotValue(muxId, potId);
    float t = (v - 0.5f) * 2.f;                                     // centre-relative [-1, +1]
    float curved = (t < 0.f ? -1.f : 1.f) * powf(fabsf(t), kCenteredPotExponent);
    return curved * 0.5f + 0.5f;
}

// ---------------------------------------------------------------------------
// MCP23017
// ---------------------------------------------------------------------------

bool HardwareManager::probeAndInitMcp(uint8_t addr) {
    if(i2cFd_ < 0) return false;
    if(ioctl(i2cFd_, I2C_SLAVE, addr) < 0) return false;

    // Test writing IODIRA (all inputs = 0xFF)
    uint8_t buf[2];
    buf[0] = MCP_IODIRA; buf[1] = 0xFF;
    if(write(i2cFd_, buf, 2) != 2) return false;

    // IODIRB: all inputs
    buf[0] = MCP_IODIRB; buf[1] = 0xFF;
    if(write(i2cFd_, buf, 2) != 2) return false;

    // GPPUA: enable internal pull-ups on Port A
    buf[0] = MCP_GPPUA; buf[1] = 0xFF;
    if(write(i2cFd_, buf, 2) != 2) return false;

    // GPPUB: enable internal pull-ups on Port B
    buf[0] = MCP_GPPUB; buf[1] = 0xFF;
    if(write(i2cFd_, buf, 2) != 2) return false;

    return true;
}

bool HardwareManager::initMcp23017(bool verbose) {
    if(i2cFd_ < 0) {
        i2cFd_ = open(kI2cBus, O_RDWR);
        if(i2cFd_ < 0) {
            if(verbose)
                rt_fprintf(stderr, "HardwareManager: cannot open I2C bus %s\n", kI2cBus);
            return false;
        }
    }

    mcpConnected_.store(false);
    mcpConsecutiveErrors_ = 0;

    // First try the configured or previously active address
    uint8_t target = activeAddress_ ? activeAddress_ : kMcpAddress;
    bool found = false;
    if(probeAndInitMcp(target)) {
        activeAddress_ = target;
        kMcpAddress    = target;
        found = true;
    } else {
        if(verbose) {
            rt_printf("HardwareManager: MCP23017 not detected at 0x%02X, scanning 0x20..0x27...\n", target);
        }
        for(uint8_t a = 0x20; a <= 0x27; ++a) {
            if(a == target) continue;
            if(probeAndInitMcp(a)) {
                activeAddress_ = a;
                kMcpAddress    = a;
                found = true;
                break;
            }
        }
    }

    if(!found) {
        if(verbose) {
            rt_fprintf(stderr, "HardwareManager: MCP23017 not detected on %s (tested 0x20..0x27)\n", kI2cBus);
        }
        close(i2cFd_);
        i2cFd_ = -1;
        return false;
    }

    mcpConnected_.store(true);
    mcpConsecutiveErrors_ = 0;
    rt_printf("HardwareManager: MCP23017 initialised at 0x%02X on %s (pull-ups enabled on ports A & B)\n",
              activeAddress_, kI2cBus);
    return true;
}

void HardwareManager::readMcp23017() {
    if(!mcpConnected_.load() || i2cFd_ < 0) return;
    uint8_t regA = MCP_GPIOA;
    uint8_t valA = 0xFF;
    uint8_t regB = MCP_GPIOB;
    uint8_t valB = 0xFF;

    bool ok = true;
    if(write(i2cFd_, &regA, 1) != 1 || read(i2cFd_, &valA, 1) != 1) {
        ok = false;
    }
    if(ok && (write(i2cFd_, &regB, 1) != 1 || read(i2cFd_, &valB, 1) != 1)) {
        ok = false;
    }

    if(ok) {
        mcpPortA_.store(valA);
        mcpPortB_.store(valB);
        mcpConsecutiveErrors_ = 0;
    } else {
        mcpConsecutiveErrors_++;
        if(mcpConsecutiveErrors_ >= kMcpMaxConsecutiveErrors) {
            rt_fprintf(stderr, "HardwareManager: MCP23017 connection lost\n");
            closeMcp23017();
        }
    }
}

bool HardwareManager::getSwitchState(int pin) const {
    if(!mcpConnected_.load() || pin < 0 || pin > 7) return false;
    return (mcpPortA_.load() >> pin) & 1;
}

bool HardwareManager::getSwitchStateB(int pin) const {
    if(!mcpConnected_.load() || pin < 0 || pin > 7) return false;
    return (mcpPortB_.load() >> pin) & 1;
}

void HardwareManager::closeMcp23017() {
    if(i2cFd_ >= 0) {
        close(i2cFd_);
        i2cFd_ = -1;
    }
    mcpConnected_.store(false);
    mcpConsecutiveErrors_ = 0;
    mcpPortA_.store(0xFF);
    mcpPortB_.store(0xFF);
}
